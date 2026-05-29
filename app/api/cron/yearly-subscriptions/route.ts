import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import prisma from '@/lib/prisma';
import { YEARLY_PROGRAM_CONFIG, getYearlyGraceDays } from '@/lib/yearlyProgramConfig';
import {
  closeAccessInCourse,
  lookupStudentIdByEmail,
} from '@/lib/sendpulse';
import { removeSubscriptionAutopay } from '@/lib/yearlyProgramAutopay';
import { syncYearlyProgress } from '@/lib/certificates/syncYearlyProgress';
import { verifyBearer } from '@/lib/authTiming';
import {
  manualBeforeExpiry,
  manualOnExpiry,
  manualGraceStart,
  manualGraceMid,
  manualGraceLast,
  cyclicalChargeFailed1,
  cyclicalGraceMid,
  cyclicalGraceLast,
  accessClosed,
} from '@/lib/emailTemplates/yearlyProgram';

import { MAILER_FROM_EMAIL } from '@/lib/mailer';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = MAILER_FROM_EMAIL;
const CONCURRENCY = 5;

interface StepResult {
  step: string;
  processed: number;
  errors: string[];
}

async function processInParallel<T>(
  items: T[],
  handler: (item: T) => Promise<void>,
): Promise<void> {
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    await Promise.all(items.slice(i, i + CONCURRENCY).map(handler));
  }
}

/// Щоденний cron Річної програми.
/// — Переводить ACTIVE → GRACE коли expiresAt у минулому.
/// — Закриває доступ (GRACE → EXPIRED) коли grace-період вийшов.
/// — Шле нагадування за адаптивним розкладом, що залежить від `graceDays` із налаштувань:
///   MANUAL: за 3 дні до експайру → у день експайру → день +1 (start) → mid (≥5д) → last (≥3д) → закриття
///   CYCLICAL (тільки при charge failure): день +1 (start) → mid (≥5д) → last (≥3д) → закриття
export async function GET(req: NextRequest) {
  if (!verifyBearer(req.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: StepResult[] = [];

  results.push(await runScheduledCohortLaunches());
  results.push(await transitionActiveToGrace());
  results.push(await expireGraceSubscriptions());
  results.push(await sendManualBeforeExpiryReminders());
  results.push(await sendManualOnExpiryReminders());
  results.push(await sendGraceStartReminders());
  results.push(await sendGraceMidReminders());
  results.push(await sendGraceLastReminders());
  results.push(await sendScheduledCohortLaunchEmails());
  results.push(await syncYearlyCourseProgress());

  return NextResponse.json({ ok: true, results, timestamp: new Date().toISOString() });
}

/// Запланований запуск cohort-у. Менеджер міг натиснути 🚀 Запустити з відстрочкою —
/// `launchScheduledFor` у майбутньому. Cron перевіряє: коли launchScheduledFor <= now
/// AND launchedAt IS NULL → атомарно claim-имо launchedAt і запускаємо executeLaunchLoop
/// (відкриття SendPulse + перерахунок expiresAt + лог events). Idempotent через атомарний
/// claim — якщо інший процес встиг раніше, цей пропускає.
async function runScheduledCohortLaunches(): Promise<StepResult> {
  const errors: string[] = [];
  const now = new Date();
  const cohorts = await prisma.yearlyProgramCohort.findMany({
    where: {
      launchScheduledFor: { lte: now },
      launchedAt: null,
    },
    select: { id: true, name: true, startDate: true, endDate: true, launchScheduledFor: true },
  });
  if (cohorts.length === 0) return { step: 'runScheduledCohortLaunches', processed: 0, errors };

  const { executeLaunchLoop } = await import('@/lib/yearlyProgramLaunch');

  let processed = 0;
  for (const c of cohorts) {
    try {
      // Атомарний claim, аналогічно до launch-route — захищає від паралельного запуску.
      const claim = await prisma.yearlyProgramCohort.updateMany({
        where: { id: c.id, launchedAt: null },
        data: { launchedAt: now, launchScheduledFor: null },
      });
      if (claim.count === 0) continue; // інший процес уже claim-ив

      const summary = await executeLaunchLoop(
        { id: c.id, startDate: c.startDate, endDate: c.endDate },
        'scheduled-cron',
      );
      processed++;
      if (summary.failed > 0) {
        errors.push(`${c.name}: ${summary.failed}/${summary.total} failed`);
      }
    } catch (e) {
      errors.push(`cohort ${c.id}: ${(e as Error).message.slice(0, 200)}`);
    }
  }

  return { step: 'runScheduledCohortLaunches', processed, errors };
}

/// Запланована welcome-розсилка cohort-у. Менеджер міг (а) при запуску LaunchProgramModal
/// поставити чекбокс "✉️ Надіслати лист одразу" разом зі scheduled launch — `emailScheduledFor`
/// = `launchScheduledFor`; (б) пізніше, коли cohort уже launched, запланувати розсилку
/// окремо. В обох випадках cron перевіряє `emailScheduledFor <= now AND emailSentAt = null`
/// і виконує розсилку.
///
/// Порядок у GET handler гарантує: спочатку `runScheduledCohortLaunches` відкриває доступ
/// (виставляє статус ACTIVE), і тільки потім ця функція шле листи. Тому навіть для парного
/// сценарію launch+email розсилка йде ПІСЛЯ відкриття доступу — посилання у листі вже
/// працюють.
async function sendScheduledCohortLaunchEmails(): Promise<StepResult> {
  const errors: string[] = [];
  const now = new Date();
  const cohorts = await prisma.yearlyProgramCohort.findMany({
    where: {
      emailScheduledFor: { lte: now },
      emailSentAt: null,
    },
    select: { id: true, name: true, startDate: true, endDate: true, launchEmailSubject: true, launchEmailBody: true },
  });

  if (cohorts.length === 0) return { step: 'sendScheduledCohortLaunchEmails', processed: 0, errors };

  const { sendCohortLaunchEmails } = await import('@/lib/yearlyProgramSendEmails');

  let processed = 0;
  for (const cohort of cohorts) {
    try {
      const summary = await sendCohortLaunchEmails(cohort, {
        actorLabel: 'scheduled-cron',
        source: 'cron',
      });
      processed += summary.sent;
      if (summary.failed > 0) {
        errors.push(`${cohort.name}: ${summary.failed}/${summary.total} failed`);
      }
    } catch (e) {
      errors.push(`cohort ${cohort.id}: ${(e as Error).message.slice(0, 200)}`);
    }
  }

  return { step: 'sendScheduledCohortLaunchEmails', processed, errors };
}

async function transitionActiveToGrace(): Promise<StepResult> {
  const now = new Date();
  const errors: string[] = [];
  const graceDays = await getYearlyGraceDays(prisma);
  const gracePeriodEndsAt = new Date(now.getTime() + graceDays * 24 * 60 * 60 * 1000);
  const candidates = await prisma.yearlyProgramSubscription.findMany({
    where: {
      status: 'ACTIVE',
      expiresAt: { lt: now },
    },
    select: { id: true, userId: true, plan: true, autoRenew: true, failedChargeCount: true, expiresAt: true },
  });

  // Буфер для MONTHLY-автоплатежу: WFP списує за розкладом, а cron біжить щодня о 04:00.
  // Якщо чергове списання за цей день ще не надійшло (Approved-callback приходить пізніше),
  // не штовхаємо підписку в GRACE одразу — інакше студент отримує хибний grace-лист, хоча
  // гроші спишуться за кілька годин і підписка повернеться в ACTIVE. Переводимо в GRACE лише
  // якщо: (а) списання реально провалилось — failedChargeCount > 0, або (б) доступ
  // протермінований довше за буфер (WFP тихо перестав списувати — тоді експайр обов'язковий,
  // щоб не лишити неоплачений доступ назавжди). Для YEARLY і MONTHLY-РАЗОВА буфера немає.
  const AUTOPAY_GRACE_BUFFER_MS = 2 * 24 * 60 * 60 * 1000;
  const subs = candidates.filter((s) => {
    const isAutopay = s.plan === 'MONTHLY' && s.autoRenew;
    if (!isAutopay) return true;
    if ((s.failedChargeCount ?? 0) > 0) return true;
    return s.expiresAt != null && s.expiresAt.getTime() < now.getTime() - AUTOPAY_GRACE_BUFFER_MS;
  });

  await processInParallel(subs, async (s) => {
    try {
      // Ставимо graceStartedAt=now і gracePeriodEndsAt=now+graceDays, щоб
      // expireGraceSubscriptions експайрав саме через graceDays після переходу,
      // а не одразу якщо cron пропустив день (Bug #8 fix).
      await prisma.yearlyProgramSubscription.update({
        where: { id: s.id },
        data: {
          status: 'GRACE',
          graceStartedAt: now,
          gracePeriodEndsAt,
        },
      });
      await prisma.yearlyProgramSubscriptionEvent.create({
        data: {
          subscriptionId: s.id,
          type: 'grace_entered',
          message: `Moved to GRACE — expiresAt ${s.expiresAt?.toISOString().slice(0, 10)} · grace ends ${gracePeriodEndsAt.toISOString().slice(0, 10)}`,
        },
      });
    } catch (e) {
      errors.push(`${s.id}: ${(e as Error).message}`);
    }
  });

  return { step: 'active_to_grace', processed: subs.length, errors };
}

async function expireGraceSubscriptions(): Promise<StepResult> {
  const now = new Date();
  const graceDays = await getYearlyGraceDays(prisma);
  const graceCutoff = new Date(now.getTime() - graceDays * 24 * 60 * 60 * 1000);
  const errors: string[] = [];

  // Семантика: експайраємо коли grace-період вже завершився (gracePeriodEndsAt <= now).
  // Beremo `lte` (не строго <), бо cron + transitionActiveToGrace стартують в одну й ту саму
  // годину — gracePeriodEndsAt = graceStartedAt + graceDays днів збігається з cron-«now»
  // на час закриття. Зі строгим `<` close спрацьовував би на день пізніше за очікуване.
  // Fallback для legacy-рядків (до міграції add_grace_period_ends_at) — старий фільтр по expiresAt.
  const subs = await prisma.yearlyProgramSubscription.findMany({
    where: {
      status: 'GRACE',
      OR: [
        { gracePeriodEndsAt: { lte: now } },
        { gracePeriodEndsAt: null, expiresAt: { lt: graceCutoff } },
      ],
    },
    include: { user: true },
  });

  await processInParallel(subs, async (sub) => {
    try {
      // Закриваємо доступ у SendPulse (якщо можемо — є studentId і courseId).
      const courseId = YEARLY_PROGRAM_CONFIG.sendpulseCourseId;
      let studentId = sub.sendpulseStudentId;

      if (courseId && !studentId && sub.user?.email) {
        // Останній шанс знайти studentId
        try {
          studentId = await lookupStudentIdByEmail(courseId, sub.user.email);
          if (studentId) {
            await prisma.yearlyProgramSubscription.update({
              where: { id: sub.id },
              data: { sendpulseStudentId: studentId },
            });
          }
        } catch (e) {
          errors.push(`${sub.id} lookup: ${(e as Error).message}`);
        }
      }

      // Знімаємо WFP-регулярки перш ніж позначити EXPIRED — інакше autopay-списання
      // продовжаться навіть після закриття доступу (orphan charges). Робимо до SP-close
      // і до flip-у, щоб у випадку SP-помилки нижче (return без flip) регулярки все ж
      // були зняті — захист від ситуації де доступу нема, а гроші продовжують списуватись.
      const autopay = await removeSubscriptionAutopay(sub.id);
      const wfpSummary = sub.plan === 'MONTHLY'
        ? ` · WFP REMOVE: ${autopay.removed}/${autopay.attempted}${autopay.error ? ` (errors: ${autopay.error.slice(0, 200)})` : ''}`
        : '';

      if (courseId && studentId) {
        try {
          await closeAccessInCourse(studentId, courseId);
          await prisma.yearlyProgramSubscription.update({
            where: { id: sub.id },
            data: {
              status: 'EXPIRED',
              sendpulseAccessClosedAt: new Date(),
            },
          });
          await prisma.yearlyProgramSubscriptionEvent.create({
            data: {
              subscriptionId: sub.id,
              type: 'access_closed',
              message: `SendPulse DELETE /students/${studentId}/${courseId}${wfpSummary}`,
              metadata: {
                wfpRemovedCount: autopay.removed,
                wfpAttemptedCount: autopay.attempted,
                wfpError: autopay.error,
              },
            },
          });
        } catch (e) {
          errors.push(`${sub.id} close: ${(e as Error).message}`);
          // Не скидаємо на EXPIRED якщо не змогли закрити — спробуємо знову завтра.
          return;
        }
      } else {
        // Без courseId/studentId — позначаємо EXPIRED локально, але з поміткою.
        await prisma.yearlyProgramSubscription.update({
          where: { id: sub.id },
          data: { status: 'EXPIRED' },
        });
        await prisma.yearlyProgramSubscriptionEvent.create({
          data: {
            subscriptionId: sub.id,
            type: 'access_closed',
            message: (courseId
              ? 'Marked EXPIRED without SendPulse closure — studentId not found'
              : 'Marked EXPIRED locally — SENDPULSE_YEARLY_COURSE_ID not configured') + wfpSummary,
            metadata: {
              wfpRemovedCount: autopay.removed,
              wfpAttemptedCount: autopay.attempted,
              wfpError: autopay.error,
            },
          },
        });
      }

      // Шлемо лист про закриття доступу, якщо ще не слали
      if (sub.user?.email && !sub.reminderSentExpired) {
        try {
          const { subject, html } = await accessClosed({ name: sub.user.name });
          await resend.emails.send({ from: FROM, to: sub.user.email, subject, html });
          await prisma.yearlyProgramSubscription.update({
            where: { id: sub.id },
            data: { reminderSentExpired: true },
          });
          await prisma.yearlyProgramSubscriptionEvent.create({
            data: { subscriptionId: sub.id, type: 'reminder_expired' },
          });
        } catch (e) {
          errors.push(`${sub.id} email_expired: ${(e as Error).message}`);
        }
      }
    } catch (e) {
      errors.push(`${sub.id}: ${(e as Error).message}`);
    }
  });

  return { step: 'expire_grace', processed: subs.length, errors };
}

/// MANUAL #1: за 3 дні до експайру. Тільки MANUAL (autoRenew=false) ACTIVE.
async function sendManualBeforeExpiryReminders(): Promise<StepResult> {
  const errors: string[] = [];
  const now = new Date();
  const windowStart = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const subs = await prisma.yearlyProgramSubscription.findMany({
    where: {
      status: 'ACTIVE',
      plan: 'MONTHLY',
      autoRenew: false,
      expiresAt: { gte: windowStart, lt: windowEnd },
      reminderSent3d: false,
    },
    include: { user: true },
  });

  let processed = 0;
  await processInParallel(subs, async (sub) => {
    try {
      if (!sub.user?.email || !sub.expiresAt) return;
      const { subject, html } = await manualBeforeExpiry({ name: sub.user.name, expiresAt: sub.expiresAt });
      await resend.emails.send({ from: FROM, to: sub.user.email, subject, html });
      await prisma.yearlyProgramSubscription.update({
        where: { id: sub.id },
        data: { reminderSent3d: true },
      });
      await prisma.yearlyProgramSubscriptionEvent.create({
        data: {
          subscriptionId: sub.id,
          type: 'reminder_manual_before',
          message: `Manual 3d-before · expires ${sub.expiresAt.toISOString().slice(0, 10)}`,
        },
      });
      processed++;
    } catch (e) {
      errors.push(`${sub.id}: ${(e as Error).message}`);
    }
  });

  return { step: 'manual_before_expiry', processed, errors };
}

/// MANUAL #2: у день закінчення. Тільки MANUAL.
async function sendManualOnExpiryReminders(): Promise<StepResult> {
  const errors: string[] = [];
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setUTCHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

  const subs = await prisma.yearlyProgramSubscription.findMany({
    where: {
      status: 'ACTIVE',
      plan: 'MONTHLY',
      autoRenew: false,
      expiresAt: { gte: startOfToday, lt: startOfTomorrow },
      reminderSentOnExpiry: false,
    },
    include: { user: true },
  });

  let processed = 0;
  await processInParallel(subs, async (sub) => {
    try {
      if (!sub.user?.email) return;
      const { subject, html } = await manualOnExpiry({ name: sub.user.name });
      await resend.emails.send({ from: FROM, to: sub.user.email, subject, html });
      await prisma.yearlyProgramSubscription.update({
        where: { id: sub.id },
        data: { reminderSentOnExpiry: true },
      });
      await prisma.yearlyProgramSubscriptionEvent.create({
        data: {
          subscriptionId: sub.id,
          type: 'reminder_manual_on_expiry',
          message: 'Manual on-expiry (last day)',
        },
      });
      processed++;
    } catch (e) {
      errors.push(`${sub.id}: ${(e as Error).message}`);
    }
  });

  return { step: 'manual_on_expiry', processed, errors };
}

/// MANUAL #3 + CYCLICAL #1: день +1 після експайру.
/// Manual: "grace стартував". Cyclical: "charge failed" (тільки якщо failedChargeCount > 0).
async function sendGraceStartReminders(): Promise<StepResult> {
  const errors: string[] = [];
  // Поточне значення graceDays із налаштувань — передаємо у render-функції, щоб тексти
  // листів автоматично відображали актуальну тривалість пільгового періоду.
  const graceDays = await getYearlyGraceDays(prisma);

  const subs = await prisma.yearlyProgramSubscription.findMany({
    where: {
      status: 'GRACE',
      plan: 'MONTHLY',
      reminderSentGraceStart: false,
      gracePeriodEndsAt: { not: null },
    },
    include: { user: true },
  });

  let processed = 0;
  await processInParallel(subs, async (sub) => {
    try {
      if (!sub.user?.email || !sub.gracePeriodEndsAt) return;
      // Для cyclical (autoRenew=true) — шлемо тільки якщо були failed charge attempts.
      // Для manual (autoRenew=false) — шлемо завжди (grace стартував).
      const isManual = !sub.autoRenew;
      if (!isManual && (sub.failedChargeCount ?? 0) === 0) return;

      const { subject, html } = isManual
        ? await manualGraceStart({ name: sub.user.name, gracePeriodEndsAt: sub.gracePeriodEndsAt, graceDays })
        : await cyclicalChargeFailed1({ name: sub.user.name, gracePeriodEndsAt: sub.gracePeriodEndsAt, graceDays });
      await resend.emails.send({ from: FROM, to: sub.user.email, subject, html });
      await prisma.yearlyProgramSubscription.update({
        where: { id: sub.id },
        data: { reminderSentGraceStart: true },
      });
      await prisma.yearlyProgramSubscriptionEvent.create({
        data: {
          subscriptionId: sub.id,
          type: isManual ? 'reminder_manual_grace_start' : 'reminder_cyclical_failed1',
          message: `Grace ends ${sub.gracePeriodEndsAt.toISOString().slice(0, 10)}`,
        },
      });
      processed++;
    } catch (e) {
      errors.push(`${sub.id}: ${(e as Error).message}`);
    }
  });

  return { step: 'grace_start', processed, errors };
}

/// MID — день grace-періоду номер `midDay = ceil(graceDays/2)`.
/// Тригер: минуло щонайменше `midDay - 1` днів від graceStartedAt → сьогодні і є день номер midDay.
/// Спрацьовує тільки якщо graceDays ≥ 5 (інакше точка занадто близько до start/last → колізія).
/// Manual (autoRenew=false) і cyclical (autoRenew=true з failedChargeCount > 0) обробляються разом —
/// різні шаблони, спільне поле reminderSentGraceMid.
async function sendGraceMidReminders(): Promise<StepResult> {
  const graceDays = await getYearlyGraceDays(prisma);
  if (graceDays < 5) {
    return { step: 'grace_mid', processed: 0, errors: [] };
  }
  const errors: string[] = [];
  const now = new Date();
  const midDay = Math.ceil(graceDays / 2);
  // День +1 grace = graceStartedAt. Хочемо fire на день +midDay → потрібно щоб минуло (midDay - 1) діб.
  // Беремо <= щоб точка-в-точку співпадіння теж тригерило (cron + transitionActiveToGrace на одній годині).
  const cutoff = new Date(now.getTime() - (midDay - 1) * 24 * 60 * 60 * 1000);

  const subs = await prisma.yearlyProgramSubscription.findMany({
    where: {
      status: 'GRACE',
      plan: 'MONTHLY',
      reminderSentGraceMid: false,
      graceStartedAt: { lte: cutoff },
      gracePeriodEndsAt: { not: null },
    },
    include: { user: true },
  });

  let processed = 0;
  await processInParallel(subs, async (sub) => {
    try {
      if (!sub.user?.email || !sub.gracePeriodEndsAt) return;
      const isManual = !sub.autoRenew;
      // Cyclical-mid шлемо тільки якщо був хоч один failed charge — інакше підписка не в реальному
      // grace-флоу autopay (це може бути CANCELLED-перехідний стан тощо).
      if (!isManual && (sub.failedChargeCount ?? 0) === 0) return;

      const { subject, html } = isManual
        ? await manualGraceMid({ name: sub.user.name, gracePeriodEndsAt: sub.gracePeriodEndsAt })
        : await cyclicalGraceMid({ name: sub.user.name, gracePeriodEndsAt: sub.gracePeriodEndsAt });
      await resend.emails.send({ from: FROM, to: sub.user.email, subject, html });
      await prisma.yearlyProgramSubscription.update({
        where: { id: sub.id },
        data: { reminderSentGraceMid: true },
      });
      await prisma.yearlyProgramSubscriptionEvent.create({
        data: {
          subscriptionId: sub.id,
          type: isManual ? 'reminder_manual_grace_mid' : 'reminder_cyclical_grace_mid',
          message: `Grace ends ${sub.gracePeriodEndsAt.toISOString().slice(0, 10)} · midDay=${midDay} · graceDays=${graceDays}`,
        },
      });
      processed++;
    } catch (e) {
      errors.push(`${sub.id}: ${(e as Error).message}`);
    }
  });

  return { step: 'grace_mid', processed, errors };
}

/// LAST — день grace-періоду номер `graceDays` (за день до закриття).
/// Тригер: минуло щонайменше `graceDays - 1` днів від graceStartedAt → сьогодні останній день grace
/// (закриття буде завтра в `expireGraceSubscriptions`). Спрацьовує тільки якщо graceDays ≥ 3 —
/// інакше колізія зі start (при graceDays=2 day-of-grace=2 = day закриття; при graceDays=1 — взагалі немає сенсу).
async function sendGraceLastReminders(): Promise<StepResult> {
  const graceDays = await getYearlyGraceDays(prisma);
  if (graceDays < 3) {
    return { step: 'grace_last', processed: 0, errors: [] };
  }
  const errors: string[] = [];
  const now = new Date();
  // Той самий принцип, що й у mid — fire на день +graceDays від graceStartedAt.
  const cutoff = new Date(now.getTime() - (graceDays - 1) * 24 * 60 * 60 * 1000);

  const subs = await prisma.yearlyProgramSubscription.findMany({
    where: {
      status: 'GRACE',
      plan: 'MONTHLY',
      reminderSentGraceLast: false,
      graceStartedAt: { lte: cutoff },
      // Safety: не шлемо «завтра закриваємо» якщо grace вже фактично завершився
      // (рідкісний edge — cron не запускався і експайр пропустили).
      gracePeriodEndsAt: { gt: now },
    },
    include: { user: true },
  });

  let processed = 0;
  await processInParallel(subs, async (sub) => {
    try {
      if (!sub.user?.email || !sub.gracePeriodEndsAt) return;
      const isManual = !sub.autoRenew;
      if (!isManual && (sub.failedChargeCount ?? 0) === 0) return;

      const { subject, html } = isManual
        ? await manualGraceLast({ name: sub.user.name, gracePeriodEndsAt: sub.gracePeriodEndsAt })
        : await cyclicalGraceLast({ name: sub.user.name, gracePeriodEndsAt: sub.gracePeriodEndsAt });
      await resend.emails.send({ from: FROM, to: sub.user.email, subject, html });
      await prisma.yearlyProgramSubscription.update({
        where: { id: sub.id },
        data: { reminderSentGraceLast: true },
      });
      await prisma.yearlyProgramSubscriptionEvent.create({
        data: {
          subscriptionId: sub.id,
          type: isManual ? 'reminder_manual_grace_last' : 'reminder_cyclical_grace_last',
          message: `Grace ends ${sub.gracePeriodEndsAt.toISOString().slice(0, 10)} · graceDays=${graceDays}`,
        },
      });
      processed++;
    } catch (e) {
      errors.push(`${sub.id}: ${(e as Error).message}`);
    }
  });

  return { step: 'grace_last', processed, errors };
}

/// Тонкий враппер навколо shared `syncYearlyProgress` (lib/certificates/syncYearlyProgress.ts).
/// Логіка винесена щоб шарити її з manual-trigger ендпойнтом адмінки.
async function syncYearlyCourseProgress(): Promise<StepResult> {
  const result = await syncYearlyProgress();
  return { step: 'sync_progress', processed: result.processed, errors: result.errors };
}
