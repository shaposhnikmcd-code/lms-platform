import prisma from '@/lib/prisma';
import { openAccessViaEvent, lookupStudentIdByEmail } from '@/lib/sendpulse';
import { YEARLY_PROGRAM_CONFIG, getYearlyPostAccessMonths } from '@/lib/yearlyProgramConfig';
import { calculateAccessUntil } from '@/lib/yearlyProgramAccess';
import { sendEmail } from '@/lib/mailer';
import {
  renderLaunchEmailTemplate,
  DEFAULT_LAUNCH_EMAIL_BODY,
  DEFAULT_LAUNCH_EMAIL_SUBJECT,
} from '@/lib/yearlyProgramCohort';
import { renderTelegramInviteEmailBlock } from '@/lib/yearlyProgramTelegram';

/// Спільна логіка "запустити cohort": викликається з адмінки (POST .../launch) і з cron-у
/// (для cohort-ів зі `launchScheduledFor` у минулому). Приймає cohort, який ВЖЕ має
/// `launchedAt` (тобто claim або cron вже виставили цю дату). Виконує SendPulse +
/// перерахунок expiresAt + лог events.
///
/// Idempotent: для підписок, у яких `sendpulseAccessOpenedAt` вже виставлений, пропускає
/// SendPulse-виклик (тільки оновлює статус та expiresAt).
///
/// Класифікація результату:
///   accessOpened=true                   → opened
///   accessOpened=false + skipReason     → skipped (очікуваний пропуск, не помилка)
///   accessOpened=false + error          → failed (справжній збій SP/мережі)
export type LaunchSkipReason = 'no_paid_payments';

export interface LaunchResult {
  subscriptionId: string;
  email: string;
  accessOpened: boolean;
  expiresAt: string | null;
  /// Set коли підписку свідомо пропустили (не платив, нема email тощо).
  /// Не вважається помилкою — окремий counter `skipped` у summary.
  skipReason?: LaunchSkipReason;
  /// Set коли стався справжній збій (SP API down, мережа). Counter `failed`.
  error?: string;
}

export interface LaunchSummary {
  total: number;
  opened: number;
  /// Свідомо пропущені (нема оплати). НЕ збільшує `failed` — це expected behaviour.
  skipped: number;
  failed: number;
  results: LaunchResult[];
}

export async function executeLaunchLoop(
  cohort: { id: string; startDate: Date; endDate: Date },
  actorLabel: string,
): Promise<LaunchSummary> {
  const subs = await prisma.yearlyProgramSubscription.findMany({
    where: {
      cohortId: cohort.id,
      status: { in: ['PENDING', 'ACTIVE', 'GRACE'] },
    },
    include: {
      user: { select: { id: true, email: true } },
      payments: { select: { amount: true, status: true, paidAt: true, createdAt: true } },
    },
  });

  const postAccessMonths = await getYearlyPostAccessMonths(prisma);
  const results: LaunchResult[] = [];

  for (const s of subs) {
    if (!s.user?.email) continue;
    const paidPayments = s.payments.filter((p) => p.status === 'PAID');
    if (paidPayments.length === 0) {
      // Свідомий пропуск: підписка існує, але платіж ще не пройшов. Не вважається
      // помилкою (counter `skipped`, не `failed`). Не пишемо event — це не failure.
      results.push({
        subscriptionId: s.id,
        email: s.user.email,
        accessOpened: false,
        expiresAt: null,
        skipReason: 'no_paid_payments',
      });
      continue;
    }

    let openedNow = false;
    let openErr: string | null = null;
    if (!s.sendpulseAccessOpenedAt) {
      try {
        await openAccessViaEvent(
          s.user.email,
          YEARLY_PROGRAM_CONFIG.sendpulseEventSlug,
          paidPayments[0]!.amount,
        );
        openedNow = true;
        if (!s.sendpulseStudentId && YEARLY_PROGRAM_CONFIG.sendpulseCourseId) {
          try {
            const studentId = await lookupStudentIdByEmail(
              YEARLY_PROGRAM_CONFIG.sendpulseCourseId,
              s.user.email,
            );
            if (studentId) {
              await prisma.yearlyProgramSubscription.update({
                where: { id: s.id },
                data: { sendpulseStudentId: studentId },
              });
            }
          } catch {
            // ignore lookup err — буде підтянуто пізніше cron-ом
          }
        }
      } catch (e) {
        openErr = (e as Error).message;
      }
    } else {
      openedNow = true;
    }

    const newExpiresAt = calculateAccessUntil({
      plan: s.plan,
      autoRenew: s.autoRenew,
      cohort: { startDate: cohort.startDate, endDate: cohort.endDate },
      payments: s.payments,
      postAccessMonths,
    });

    await prisma.yearlyProgramSubscription.update({
      where: { id: s.id },
      data: {
        status: 'ACTIVE',
        startDate: s.startDate ?? cohort.startDate,
        expiresAt: newExpiresAt,
        ...(openedNow && !s.sendpulseAccessOpenedAt
          ? { sendpulseAccessOpenedAt: new Date(), sendpulseAccessClosedAt: null }
          : {}),
      },
    });

    // Тип події точно відображає семантику: success → "access_opened", failure → "access_open_failed".
    // Issue-tracker полюється на ці типи, плюс старі записи (legacy "admin_action" з FAILED у message)
    // ловить regex-fallback у classifyEvent.
    const eventType = openErr
      ? 'access_open_failed'
      : (openedNow && !s.sendpulseAccessOpenedAt ? 'access_opened' : 'admin_action');
    await prisma.yearlyProgramSubscriptionEvent.create({
      data: {
        subscriptionId: s.id,
        type: eventType,
        message: openErr
          ? `Cohort launch · access open FAILED: ${openErr.slice(0, 200)}`
          : `Cohort launch by ${actorLabel} · expiresAt=${newExpiresAt?.toISOString().slice(0, 10) ?? 'null'}`,
        metadata: { cohortId: cohort.id, openedNow, openErr },
      },
    });

    results.push({
      subscriptionId: s.id,
      email: s.user.email,
      accessOpened: openedNow && !openErr,
      expiresAt: newExpiresAt?.toISOString() ?? null,
      error: openErr ?? undefined,
    });
  }

  const opened = results.filter((r) => r.accessOpened).length;
  const skipped = results.filter((r) => !r.accessOpened && r.skipReason).length;
  const failed = results.filter((r) => !r.accessOpened && !r.skipReason).length;
  return { total: results.length, opened, skipped, failed, results };
}

export interface ExtraLaunchResult {
  ok: boolean;
  reason?: string;
  expiresAt: string | null;
  sendpulseAccessOpened: boolean;
  studentId: number | null;
  email: { sent: boolean; skipped?: string; error?: string };
}

/// "Екстра запуск" для одного студента, який оплатив після того як cohort вже launched
/// (вручну менеджером через UI або автоматично з callback-у при первинній оплаті).
/// Виконує: openAccessViaEvent → lookup studentId → update sub (ACTIVE + expiresAt + access flags)
/// → лог access_opened → cohort launch lett (з тих самих shablonів що й при груповій розсилці).
/// Idempotent: якщо доступ вже відкрито → reason='already_opened'; якщо лист уже надсилався —
/// пропускаємо лист.
export async function runExtraLaunchForSubscription(
  subscriptionId: string,
  actorLabel: string,
  options: { telegramInviteLink?: string | null } = {},
): Promise<ExtraLaunchResult> {
  const sub = await prisma.yearlyProgramSubscription.findUnique({
    where: { id: subscriptionId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      cohort: true,
      payments: { select: { amount: true, status: true, paidAt: true, createdAt: true } },
      events: { where: { type: 'launch_email_sent' }, select: { metadata: true } },
    },
  });
  if (!sub) return { ok: false, reason: 'sub_not_found', expiresAt: null, sendpulseAccessOpened: false, studentId: null, email: { sent: false } };
  if (!sub.user?.email) return { ok: false, reason: 'no_user_email', expiresAt: null, sendpulseAccessOpened: false, studentId: null, email: { sent: false } };
  if (!sub.cohort) return { ok: false, reason: 'no_cohort', expiresAt: null, sendpulseAccessOpened: false, studentId: null, email: { sent: false } };
  if (!sub.cohort.launchedAt) return { ok: false, reason: 'cohort_not_launched', expiresAt: null, sendpulseAccessOpened: false, studentId: null, email: { sent: false } };
  if (sub.sendpulseAccessOpenedAt) return { ok: false, reason: 'already_opened', expiresAt: sub.expiresAt?.toISOString() ?? null, sendpulseAccessOpened: true, studentId: sub.sendpulseStudentId, email: { sent: false, skipped: 'already_opened' } };

  const paidPayments = sub.payments.filter((p) => p.status === 'PAID');
  if (paidPayments.length === 0) return { ok: false, reason: 'no_paid_payments', expiresAt: null, sendpulseAccessOpened: false, studentId: null, email: { sent: false } };

  let openErr: string | null = null;
  let studentId: number | null = sub.sendpulseStudentId;
  try {
    await openAccessViaEvent(sub.user.email, YEARLY_PROGRAM_CONFIG.sendpulseEventSlug, paidPayments[0]!.amount);
    if (!studentId && YEARLY_PROGRAM_CONFIG.sendpulseCourseId) {
      try {
        studentId = await lookupStudentIdByEmail(YEARLY_PROGRAM_CONFIG.sendpulseCourseId, sub.user.email);
      } catch {
        // ignore lookup err — досипається пізніше
      }
    }
  } catch (e) {
    openErr = (e as Error).message;
  }
  if (openErr) {
    await prisma.yearlyProgramSubscriptionEvent.create({
      data: {
        subscriptionId: sub.id,
        type: 'admin_action',
        message: `Extra-launch FAILED (SendPulse): ${openErr.slice(0, 200)}`,
        metadata: { extraLaunch: true, openErr, actor: actorLabel },
      },
    });
    return { ok: false, reason: `sendpulse_open_failed:${openErr}`, expiresAt: null, sendpulseAccessOpened: false, studentId, email: { sent: false } };
  }

  const postAccessMonths = await getYearlyPostAccessMonths(prisma);
  const newExpiresAt = calculateAccessUntil({
    plan: sub.plan,
    autoRenew: sub.autoRenew,
    cohort: { startDate: sub.cohort.startDate, endDate: sub.cohort.endDate },
    payments: sub.payments,
    postAccessMonths,
  });

  await prisma.yearlyProgramSubscription.update({
    where: { id: sub.id },
    data: {
      status: 'ACTIVE',
      startDate: sub.startDate ?? sub.cohort.startDate,
      expiresAt: newExpiresAt,
      sendpulseAccessOpenedAt: new Date(),
      sendpulseAccessClosedAt: null,
      ...(studentId ? { sendpulseStudentId: studentId } : {}),
    },
  });

  await prisma.yearlyProgramSubscriptionEvent.create({
    data: {
      subscriptionId: sub.id,
      type: 'access_opened',
      message: `Extra-launch by ${actorLabel} · expiresAt=${newExpiresAt?.toISOString().slice(0, 10) ?? 'null'}`,
      metadata: { extraLaunch: true, cohortId: sub.cohort.id, actor: actorLabel },
    },
  });

  // Cohort launch lett (з manager-customizable shablonів). Idempotent: якщо вже шили — пропускаємо.
  const alreadySent = sub.events.some((ev) => {
    const m = ev.metadata as { cohortId?: string } | null;
    return m?.cohortId === sub.cohort?.id;
  });

  let emailResult: ExtraLaunchResult['email'] = { sent: false };
  if (alreadySent) {
    emailResult = { sent: false, skipped: 'already_sent' };
  } else {
    const subjectTpl = sub.cohort.launchEmailSubject ?? DEFAULT_LAUNCH_EMAIL_SUBJECT;
    const bodyTpl = sub.cohort.launchEmailBody ?? DEFAULT_LAUNCH_EMAIL_BODY;
    const { subject, body } = renderLaunchEmailTemplate({
      subject: subjectTpl,
      body: bodyTpl,
      variables: {
        name: sub.user.name,
        email: sub.user.email,
        startDate: sub.cohort.startDate,
        endDate: sub.cohort.endDate,
        cohortName: sub.cohort.name,
      },
    });
    try {
      const fullBody = body + renderTelegramInviteEmailBlock(options.telegramInviteLink ?? sub.telegramInviteLink ?? null);
      const res = await sendEmail({ to: sub.user.email, subject, html: fullBody });
      if (!res.ok) throw new Error(res.error ?? 'send failed');
      await prisma.yearlyProgramSubscriptionEvent.create({
        data: {
          subscriptionId: sub.id,
          type: 'launch_email_sent',
          message: `Welcome email (extra-launch) by ${actorLabel}`,
          metadata: { cohortId: sub.cohort.id, extraLaunch: true, messageId: res.messageId },
        },
      });
      emailResult = { sent: true };
    } catch (e) {
      emailResult = { sent: false, error: (e as Error).message.slice(0, 200) };
      await prisma.yearlyProgramSubscriptionEvent.create({
        data: {
          subscriptionId: sub.id,
          type: 'admin_action',
          message: `Extra-launch email FAILED: ${emailResult.error}`,
          metadata: { extraLaunch: true, emailErr: emailResult.error },
        },
      });
    }
  }

  return {
    ok: true,
    expiresAt: newExpiresAt?.toISOString() ?? null,
    sendpulseAccessOpened: true,
    studentId,
    email: emailResult,
  };
}
