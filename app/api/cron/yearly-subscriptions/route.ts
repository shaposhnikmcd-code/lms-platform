import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import prisma from '@/lib/prisma';
import { YEARLY_PROGRAM_CONFIG } from '@/lib/yearlyProgramConfig';
import { closeAccessInCourse, lookupStudentIdByEmail } from '@/lib/sendpulse';
import { verifyBearer } from '@/lib/authTiming';
import {
  manualBeforeExpiry,
  manualOnExpiry,
  manualGraceStart,
  cyclicalChargeFailed1,
  cyclicalChargeFailed3,
  accessClosed,
} from '@/lib/emailTemplates/yearlyProgram';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = 'UIMP <onboarding@resend.dev>';

interface StepResult {
  step: string;
  processed: number;
  errors: string[];
}

/// Щоденний cron Річної програми.
/// — Переводить ACTIVE → GRACE коли expiresAt у минулому.
/// — Закриває доступ (GRACE → EXPIRED) коли grace-період вийшов.
/// — Шле нагадування:
///   MANUAL (клієнт платить сам): за 3 дні до експайру, у день експайру, день +1 grace, день +7 закриття.
///   CYCLICAL (автосписання): тільки при failure — день +1, день +3, день +7.
export async function GET(req: NextRequest) {
  if (!verifyBearer(req.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: StepResult[] = [];

  results.push(await transitionActiveToGrace());
  results.push(await expireGraceSubscriptions());
  results.push(await sendManualBeforeExpiryReminders());
  results.push(await sendManualOnExpiryReminders());
  results.push(await sendGraceStartReminders());
  results.push(await sendCyclicalGraceMidReminders());

  return NextResponse.json({ ok: true, results, timestamp: new Date().toISOString() });
}

async function transitionActiveToGrace(): Promise<StepResult> {
  const now = new Date();
  const errors: string[] = [];
  const gracePeriodEndsAt = new Date(now.getTime() + YEARLY_PROGRAM_CONFIG.graceDays * 24 * 60 * 60 * 1000);
  const subs = await prisma.yearlyProgramSubscription.findMany({
    where: {
      status: 'ACTIVE',
      expiresAt: { lt: now },
    },
    select: { id: true, userId: true, plan: true, expiresAt: true },
  });

  for (const s of subs) {
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
  }

  return { step: 'active_to_grace', processed: subs.length, errors };
}

async function expireGraceSubscriptions(): Promise<StepResult> {
  const now = new Date();
  const graceCutoff = new Date(now.getTime() - YEARLY_PROGRAM_CONFIG.graceDays * 24 * 60 * 60 * 1000);
  const errors: string[] = [];

  // Нова семантика: експайраємо коли gracePeriodEndsAt < now.
  // Fallback для legacy-рядків (до міграції add_grace_period_ends_at) — лишаємо
  // старий фільтр по expiresAt. Коли всі існуючі GRACE пройдуть хоча б один cron —
  // fallback можна прибрати.
  const subs = await prisma.yearlyProgramSubscription.findMany({
    where: {
      status: 'GRACE',
      OR: [
        { gracePeriodEndsAt: { lt: now } },
        { gracePeriodEndsAt: null, expiresAt: { lt: graceCutoff } },
      ],
    },
    include: { user: true },
  });

  for (const sub of subs) {
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
              message: `SendPulse DELETE /students/${studentId}/${courseId}`,
            },
          });
        } catch (e) {
          errors.push(`${sub.id} close: ${(e as Error).message}`);
          // Не скидаємо на EXPIRED якщо не змогли закрити — спробуємо знову завтра.
          continue;
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
            message: courseId
              ? 'Marked EXPIRED without SendPulse closure — studentId not found'
              : 'Marked EXPIRED locally — SENDPULSE_YEARLY_COURSE_ID not configured',
          },
        });
      }

      // Шлемо лист про закриття доступу, якщо ще не слали
      if (sub.user?.email && !sub.reminderSentExpired) {
        try {
          const { subject, html } = accessClosed({ name: sub.user.name });
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
  }

  return { step: 'expire_grace', processed: subs.length, errors };
}

/// MANUAL #1: за 3 дні до експайру. Тільки MANUAL (recToken=null) ACTIVE.
async function sendManualBeforeExpiryReminders(): Promise<StepResult> {
  const errors: string[] = [];
  const now = new Date();
  const windowStart = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const subs = await prisma.yearlyProgramSubscription.findMany({
    where: {
      status: 'ACTIVE',
      plan: 'MONTHLY',
      recToken: null,
      expiresAt: { gte: windowStart, lt: windowEnd },
      reminderSent3d: false,
    },
    include: { user: true },
  });

  let processed = 0;
  for (const sub of subs) {
    try {
      if (!sub.user?.email || !sub.expiresAt) continue;
      const { subject, html } = manualBeforeExpiry({ name: sub.user.name, expiresAt: sub.expiresAt });
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
  }

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
      recToken: null,
      expiresAt: { gte: startOfToday, lt: startOfTomorrow },
      reminderSentOnExpiry: false,
    },
    include: { user: true },
  });

  let processed = 0;
  for (const sub of subs) {
    try {
      if (!sub.user?.email) continue;
      const { subject, html } = manualOnExpiry({ name: sub.user.name });
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
  }

  return { step: 'manual_on_expiry', processed, errors };
}

/// MANUAL #3 + CYCLICAL #1: день +1 після експайру.
/// Manual: "grace стартував". Cyclical: "charge failed" (тільки якщо failedChargeCount > 0).
async function sendGraceStartReminders(): Promise<StepResult> {
  const errors: string[] = [];

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
  for (const sub of subs) {
    try {
      if (!sub.user?.email || !sub.gracePeriodEndsAt) continue;
      // Для cyclical — шлемо тільки якщо були failed charge attempts.
      // Для manual — шлемо завжди (grace стартував).
      const isManual = !sub.recToken;
      if (!isManual && (sub.failedChargeCount ?? 0) === 0) continue;

      const { subject, html } = isManual
        ? manualGraceStart({ name: sub.user.name, gracePeriodEndsAt: sub.gracePeriodEndsAt })
        : cyclicalChargeFailed1({ name: sub.user.name, gracePeriodEndsAt: sub.gracePeriodEndsAt });
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
  }

  return { step: 'grace_start', processed, errors };
}

/// CYCLICAL #2: день +3 під час grace. Тільки cyclical (recToken set).
async function sendCyclicalGraceMidReminders(): Promise<StepResult> {
  const errors: string[] = [];
  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  const subs = await prisma.yearlyProgramSubscription.findMany({
    where: {
      status: 'GRACE',
      plan: 'MONTHLY',
      recToken: { not: null },
      graceStartedAt: { lt: threeDaysAgo },
      reminderSentGraceMid: false,
      gracePeriodEndsAt: { not: null },
    },
    include: { user: true },
  });

  let processed = 0;
  for (const sub of subs) {
    try {
      if (!sub.user?.email || !sub.gracePeriodEndsAt) continue;
      const { subject, html } = cyclicalChargeFailed3({ name: sub.user.name, gracePeriodEndsAt: sub.gracePeriodEndsAt });
      await resend.emails.send({ from: FROM, to: sub.user.email, subject, html });
      await prisma.yearlyProgramSubscription.update({
        where: { id: sub.id },
        data: { reminderSentGraceMid: true },
      });
      await prisma.yearlyProgramSubscriptionEvent.create({
        data: {
          subscriptionId: sub.id,
          type: 'reminder_cyclical_failed3',
          message: `Grace ends ${sub.gracePeriodEndsAt.toISOString().slice(0, 10)}`,
        },
      });
      processed++;
    } catch (e) {
      errors.push(`${sub.id}: ${(e as Error).message}`);
    }
  }

  return { step: 'cyclical_grace_mid', processed, errors };
}
