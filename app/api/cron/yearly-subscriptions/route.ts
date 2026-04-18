import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import prisma from '@/lib/prisma';
import { YEARLY_PROGRAM_CONFIG } from '@/lib/yearlyProgramConfig';
import { closeAccessInCourse, lookupStudentIdByEmail } from '@/lib/sendpulse';
import { verifyBearer } from '@/lib/authTiming';

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
/// — Шле нагадування за 3 та 1 день до expiresAt.
export async function GET(req: NextRequest) {
  if (!verifyBearer(req.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: StepResult[] = [];

  results.push(await transitionActiveToGrace());
  results.push(await expireGraceSubscriptions());
  results.push(await sendReminders());

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
          await sendExpiredEmail(sub.user.email, sub.user.name);
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

async function sendReminders(): Promise<StepResult> {
  const errors: string[] = [];
  const now = new Date();
  let processed = 0;

  for (const daysBefore of YEARLY_PROGRAM_CONFIG.reminderDaysBefore) {
    const windowStart = new Date(now.getTime() + (daysBefore - 1) * 24 * 60 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + daysBefore * 24 * 60 * 60 * 1000);
    const fieldName = daysBefore === 3 ? 'reminderSent3d' : 'reminderSent1d';

    const subs = await prisma.yearlyProgramSubscription.findMany({
      where: {
        status: 'ACTIVE',
        plan: 'MONTHLY',
        expiresAt: { gte: windowStart, lt: windowEnd },
        [fieldName]: false,
      },
      include: { user: true },
    });

    for (const sub of subs) {
      try {
        if (!sub.user?.email || !sub.expiresAt) continue;
        await sendReminderEmail(sub.user.email, sub.user.name, sub.expiresAt, daysBefore);
        await prisma.yearlyProgramSubscription.update({
          where: { id: sub.id },
          data: { [fieldName]: true },
        });
        await prisma.yearlyProgramSubscriptionEvent.create({
          data: {
            subscriptionId: sub.id,
            type: daysBefore === 3 ? 'reminder_3d' : 'reminder_1d',
            message: `Expires ${sub.expiresAt.toISOString().slice(0, 10)}`,
          },
        });
        processed++;
      } catch (e) {
        errors.push(`${sub.id} d${daysBefore}: ${(e as Error).message}`);
      }
    }
  }

  return { step: 'reminders', processed, errors };
}

async function sendReminderEmail(
  email: string,
  name: string | null,
  expiresAt: Date,
  daysBefore: number,
): Promise<void> {
  const nameSafe = name ?? 'друже';
  const dateStr = expiresAt.toISOString().slice(0, 10);
  const subject = daysBefore === 1
    ? 'Завтра закінчується ваша підписка на Річну програму'
    : 'Через 3 дні закінчується ваша підписка на Річну програму';

  await resend.emails.send({
    from: FROM,
    to: email,
    subject,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; color: #1c1917;">
        <h2 style="color: #1C3A2E;">Вітаю, ${nameSafe}!</h2>
        <p>Нагадую, що ваша підписка на <strong>Річну програму</strong> закінчується <strong>${dateStr}</strong>.</p>
        <p>Щоб не втратити доступ до навчання — переконайтеся, що на картці є достатньо коштів для автоматичного списання. Якщо списання не відбудеться протягом 1 дня після дати завершення — доступ до курсу буде закрито.</p>
        <p>Якщо у вас є питання — напишіть у відповідь на цей лист.</p>
        <p style="margin-top: 32px;">З теплом,<br/>Команда UIMP</p>
      </div>
    `,
  });
}

async function sendExpiredEmail(email: string, name: string | null): Promise<void> {
  const nameSafe = name ?? 'друже';
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Доступ до Річної програми закрито',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; color: #1c1917;">
        <h2 style="color: #1C3A2E;">Вітаю, ${nameSafe}!</h2>
        <p>На жаль, ми не отримали оплату за чергову підписку на <strong>Річну програму</strong>, тому доступ до курсу тимчасово закрито.</p>
        <p>Ви можете відновити підписку в будь-який момент — просто напишіть нам або оформіть нову оплату на сайті.</p>
        <p style="margin-top: 32px;">З повагою,<br/>Команда UIMP</p>
      </div>
    `,
  });
}
