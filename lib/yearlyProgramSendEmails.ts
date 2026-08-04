/// Shared логіка bulk-розсилки welcome-листа cohort-у.
///
/// Викликається з трьох місць:
///   1. POST /api/admin/yearly-program/cohorts/[id]/send-emails — кнопка "Дослати лист"
///      у CohortActions (per-recipient resend або повторна bulk-розсилка).
///   2. POST /api/admin/yearly-program/cohorts/[id]/launch — режим "запустити зараз"
///      з опцією `sendEmailsTogether=true` (default ON у LaunchProgramModal).
///   3. /api/cron/yearly-subscriptions — щоденний обхід (a) запланованих launch-ів,
///      які мають `emailScheduledFor` на ту ж дату, (b) самостійних запланованих розсилок.
///
/// Dedup-контракт: для кожного успішно надісланого листа створюється
/// `YearlyProgramSubscriptionEvent { type: 'launch_email_sent', metadata.cohortId }`.
/// Перед надсиланням перевіряємо, чи такий event уже існує — якщо так, пропускаємо.
/// `force=true` ігнорує dedup (per-recipient resend або bulk-override від менеджера).
///
/// Telegram: якщо канал налаштований і autoAdd увімкнено, до кожного листа додається блок
/// з invite-кнопкою (`renderTelegramInviteEmailBlock`). Лінк перегенеровується, якщо його
/// немає або він старший за 25 днів — інакше покупці, що оплатили за місяці до запуску,
/// отримали б протермінований (30 днів) лінк.
///
/// Контракт `emailSentAt`: оновлюємо тільки коли була повна bulk-розсилка (без `targetIds`).
/// Per-recipient resend не зачіпає cohort-таймстемп — він репрезентує "коли по cohort-у
/// пройшла масова розсилка".

import prisma from '@/lib/prisma';
import { sendEmail } from '@/lib/mailer';
import {
  renderLaunchEmailTemplate,
  DEFAULT_LAUNCH_EMAIL_BODY,
  DEFAULT_LAUNCH_EMAIL_SUBJECT,
} from '@/lib/yearlyProgramCohort';
import {
  generateInviteForSubscription,
  getYearlyProgramTelegramSettings,
  renderTelegramInviteEmailBlock,
} from '@/lib/yearlyProgramTelegram';

/// Invite-лінк живе 30 днів (`createChatInviteLink`, expireSeconds). Все, що старше 25 днів,
/// у масовій розсилці перегенеровуємо: покупці квітня–червня інакше отримали б на дату
/// запуску мертве посилання.
const INVITE_MAX_AGE_MS = 25 * 24 * 60 * 60 * 1000;

export interface SendLaunchEmailsCohort {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  launchEmailSubject: string | null;
  launchEmailBody: string | null;
}

export interface SendLaunchEmailsResult {
  subscriptionId: string;
  email: string;
  sent: boolean;
  /// Set коли стався справжній збій SMTP/Resend (counter `failed`).
  error?: string;
  /// Set коли підписку свідомо пропущено — НЕ помилка (counter `skipped`).
  ///   no_email          → у юзера відсутній email
  ///   already_sent      → welcome-лист цього cohort-у вже надсилався (dedup)
  ///   no_paid_payments  → підписка є, але платіж ще не пройшов
  ///   no_access_opened  → доступ у SendPulse ще не відкрито (лист стверджує зворотнє)
  skipped?: 'no_email' | 'already_sent' | 'no_paid_payments' | 'no_access_opened';
  /// `true` якщо в лист вкладено кнопку Telegram-каналу зі свіжим invite-лінком.
  telegramInvite?: boolean;
}

export interface SendLaunchEmailsSummary {
  total: number;
  sent: number;
  skipped: number;
  failed: number;
  results: SendLaunchEmailsResult[];
}

export interface SendLaunchEmailsOptions {
  /// Ігнорує dedup-перевірку (повторна відправка тим, хто вже отримав).
  /// Set автоматично якщо передані `targetIds` — per-recipient resend завжди явний вибір.
  force?: boolean;
  /// Якщо передано — шлемо тільки цим підпискам (для per-recipient resend).
  /// `null`/`undefined` — bulk-розсилка всім PENDING/ACTIVE/GRACE підпискам cohort-у.
  targetIds?: string[] | null;
  /// Лейбл актора для логу events (email менеджера, "scheduled-cron", "auto-launch").
  actorLabel: string;
  /// Звідки прийшла розсилка — записується у `event.metadata.source` для аудиту.
  /// "manager" (через UI кнопкою), "launch" (одночасно з запуском), "cron" (scheduled).
  source: 'manager' | 'launch' | 'cron';
}

/// Виконує bulk-розсилку welcome-листа всім кваліфікованим підпискам cohort-у.
/// Sequential через Resend API rate limit; повертає підсумок з per-recipient результатами.
export async function sendCohortLaunchEmails(
  cohort: SendLaunchEmailsCohort,
  opts: SendLaunchEmailsOptions,
): Promise<SendLaunchEmailsSummary> {
  const force = opts.force === true || (Array.isArray(opts.targetIds) && opts.targetIds.length > 0);
  const targetIds = Array.isArray(opts.targetIds) && opts.targetIds.length > 0 ? opts.targetIds : null;

  const subs = await prisma.yearlyProgramSubscription.findMany({
    where: {
      cohortId: cohort.id,
      status: { in: ['PENDING', 'ACTIVE', 'GRACE'] },
      ...(targetIds ? { id: { in: targetIds } } : {}),
    },
    include: {
      user: { select: { name: true, email: true } },
      // Тягнемо payments щоб у per-sub циклі скіпнути тих, хто ще не оплатив
      // (симетрично з executeLaunchLoop). Welcome-лист "вітаємо у програмі" не має
      // йти неоплаченим — навіть якщо менеджер натиснув "Дослати лист".
      payments: { select: { status: true } },
      events: {
        where: { type: 'launch_email_sent' },
        select: { id: true, metadata: true },
      },
    },
  });

  const subjectTpl = cohort.launchEmailSubject ?? DEFAULT_LAUNCH_EMAIL_SUBJECT;
  const bodyTpl = cohort.launchEmailBody ?? DEFAULT_LAUNCH_EMAIL_BODY;

  // Telegram-налаштування читаємо один раз на всю розсилку (singleton-рядок).
  const tgSettings = await getYearlyProgramTelegramSettings();
  const tgActive = Boolean(tgSettings.autoAdd && tgSettings.chatId);

  const results: SendLaunchEmailsResult[] = [];

  for (const s of subs) {
    if (!s.user?.email) {
      results.push({ subscriptionId: s.id, email: '', sent: false, skipped: 'no_email' });
      continue;
    }

    // Skip-чек № 1: підписка без PAID-платежу. Welcome-лист про "ви в програмі"
    // не має йти неоплаченим — навіть на manager-trigger. Targeted resend (`force`)
    // НЕ обходить це: відправити лист тому, хто не платив, було б помилкою UX.
    const hasPaid = s.payments.some((p) => p.status === 'PAID');
    if (!hasPaid) {
      results.push({ subscriptionId: s.id, email: s.user.email, sent: false, skipped: 'no_paid_payments' });
      continue;
    }

    // Skip-чек № 2: доступ у SendPulse ще не відкрито. Текст листа стверджує «доступ
    // відкрито» і веде на платформу — відправити його раніше за реальне відкриття означає
    // послати людину в нікуди. Force (targeted resend) це НЕ обходить: спершу треба
    // полагодити відкриття доступу («Екстра Запуск»), потім слати лист.
    if (!s.sendpulseAccessOpenedAt) {
      results.push({ subscriptionId: s.id, email: s.user.email, sent: false, skipped: 'no_access_opened' });
      continue;
    }

    const alreadySent = s.events.some((ev) => {
      const m = ev.metadata as { cohortId?: string } | null;
      return m?.cohortId === cohort.id;
    });
    if (alreadySent && !force) {
      results.push({ subscriptionId: s.id, email: s.user.email, sent: false, skipped: 'already_sent' });
      continue;
    }

    const { subject, body } = renderLaunchEmailTemplate({
      subject: subjectTpl,
      body: bodyTpl,
      variables: {
        name: s.user.name,
        email: s.user.email,
        startDate: cohort.startDate,
        endDate: cohort.endDate,
        cohortName: cohort.name,
      },
    });

    // Telegram-кнопка у лист. Лінк має бути ЖИВИЙ на момент відправки: якщо його немає
    // або він старший за 25 днів — перегенеровуємо (force сам відкликає старий).
    // Помилка генерації не валить лист: він піде без кнопки, а причина осяде в
    // `telegramInviteError` підписки (вкладка «Помилки»).
    let telegramInviteLink: string | null = null;
    if (tgActive && s.telegramUsername) {
      const stale =
        !s.telegramInviteLink ||
        !s.telegramInvitedAt ||
        Date.now() - s.telegramInvitedAt.getTime() > INVITE_MAX_AGE_MS;
      const invite = await generateInviteForSubscription({
        subscriptionId: s.id,
        prefetched: {
          id: s.id,
          telegramInviteLink: s.telegramInviteLink,
          userEmail: s.user.email,
          userName: s.user.name,
        },
        force: stale,
        triggeredBy: `cohort-launch-email:${opts.actorLabel}`,
      });
      telegramInviteLink = invite.inviteLink;
    }

    try {
      const html = body + renderTelegramInviteEmailBlock(telegramInviteLink);
      const res = await sendEmail({ to: s.user.email, subject, html });
      if (!res.ok) throw new Error(res.error ?? 'send failed');
      await prisma.yearlyProgramSubscriptionEvent.create({
        data: {
          subscriptionId: s.id,
          type: 'launch_email_sent',
          message: `Welcome email sent by ${opts.actorLabel}`,
          metadata: {
            cohortId: cohort.id,
            messageId: res.messageId,
            source: opts.source,
            telegramInvite: Boolean(telegramInviteLink),
          },
        },
      });
      results.push({ subscriptionId: s.id, email: s.user.email, sent: true, telegramInvite: Boolean(telegramInviteLink) });
    } catch (e) {
      const errMsg = (e as Error).message.slice(0, 200);
      // Persistent failure event — потрібно для issue-tracker-а, щоб збій дійшов
      // у вкладку "Помилки", а не зник у тому самому HTTP-respnse-і.
      await prisma.yearlyProgramSubscriptionEvent.create({
        data: {
          subscriptionId: s.id,
          type: 'launch_email_failed',
          message: `Welcome email FAILED: ${errMsg}`,
          metadata: { cohortId: cohort.id, source: opts.source, error: errMsg },
        },
      });
      results.push({
        subscriptionId: s.id,
        email: s.user.email,
        sent: false,
        error: errMsg,
      });
    }
  }

  // Bulk-розсилка фіксує `emailSentAt` (і чистить `emailScheduledFor` — план виконано).
  // Per-recipient resend (`targetIds`) не оновлює таймстемп: він репрезентує
  // "коли востаннє пройшла bulk-розсилка по cohort-у", а не одиничну ручну дію.
  if (!targetIds) {
    await prisma.yearlyProgramCohort.update({
      where: { id: cohort.id },
      data: { emailSentAt: new Date(), emailScheduledFor: null },
    });
  }

  return {
    total: results.length,
    sent: results.filter((r) => r.sent).length,
    skipped: results.filter((r) => r.skipped).length,
    failed: results.filter((r) => !r.sent && !r.skipped).length,
    results,
  };
}
