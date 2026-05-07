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
  skipped?: 'no_email' | 'already_sent' | 'no_paid_payments';
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

    try {
      const res = await sendEmail({ to: s.user.email, subject, html: body });
      if (!res.ok) throw new Error(res.error ?? 'send failed');
      await prisma.yearlyProgramSubscriptionEvent.create({
        data: {
          subscriptionId: s.id,
          type: 'launch_email_sent',
          message: `Welcome email sent by ${opts.actorLabel}`,
          metadata: { cohortId: cohort.id, messageId: res.messageId, source: opts.source },
        },
      });
      results.push({ subscriptionId: s.id, email: s.user.email, sent: true });
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
