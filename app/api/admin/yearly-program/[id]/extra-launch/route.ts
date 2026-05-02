import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAdmin, getAdminActor } from '@/lib/adminAuth';
import { openAccessViaEvent, lookupStudentIdByEmail } from '@/lib/sendpulse';
import { YEARLY_PROGRAM_CONFIG } from '@/lib/yearlyProgramConfig';
import { calculateAccessUntil } from '@/lib/yearlyProgramAccess';
import { sendEmail } from '@/lib/mailer';
import {
  renderLaunchEmailTemplate,
  DEFAULT_LAUNCH_EMAIL_BODY,
  DEFAULT_LAUNCH_EMAIL_SUBJECT,
} from '@/lib/yearlyProgramCohort';

/// POST /api/admin/yearly-program/[id]/extra-launch
/// "Екстра Запуск нового студента" — індивідуальна версія 🚀 для одного manual-add студента,
/// додатого через invite-link після основного запуску cohort-у.
///
/// Виконує одночасно:
/// 1. openAccessViaEvent → SendPulse відкриває доступ до курсу
/// 2. lookup sendpulseStudentId
/// 3. update subscription: status=ACTIVE, startDate, expiresAt (cohort-aware), sendpulseAccessOpenedAt
/// 4. render + send welcome email (cohort.launchEmailSubject/Body)
/// 5. log events: `access_opened` (метадата extraLaunch:true) + `launch_email_sent`
///
/// Idempotent: якщо доступ вже відкрито → 409. Якщо лист вже надсилався → пропускаємо лист,
/// все одно update sub/access.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Немає доступу' }, { status: 403 });
  }
  const actor = await getAdminActor(req);
  const actorLabel = actor?.email ?? actor?.name ?? 'admin';
  const { id } = await params;

  const sub = await prisma.yearlyProgramSubscription.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      cohort: true,
      payments: { select: { amount: true, status: true, paidAt: true, createdAt: true } },
      events: {
        where: { type: 'launch_email_sent' },
        select: { metadata: true },
      },
    },
  });
  if (!sub) {
    return NextResponse.json({ error: 'Підписка не знайдена' }, { status: 404 });
  }
  if (!sub.user?.email) {
    return NextResponse.json({ error: 'У підписки немає користувача з email' }, { status: 400 });
  }
  if (!sub.cohort) {
    return NextResponse.json({ error: 'Підписка не прив\'язана до cohort-у' }, { status: 400 });
  }
  if (!sub.cohort.launchedAt) {
    return NextResponse.json({
      error: 'Cohort ще не запущений. Звичайний запуск через 🚀 Запустити програму.',
    }, { status: 400 });
  }
  if (sub.sendpulseAccessOpenedAt) {
    return NextResponse.json({
      error: 'Доступ у SendPulse вже відкрито',
    }, { status: 409 });
  }

  const paidPayments = sub.payments.filter((p) => p.status === 'PAID');
  if (paidPayments.length === 0) {
    return NextResponse.json({
      error: 'У підписки ще немає оплачених платежів — лінк ще не використано або callback не прийшов',
    }, { status: 400 });
  }

  // 1. Відкриваємо доступ у SendPulse через event-trigger.
  let openErr: string | null = null;
  let studentId: number | null = sub.sendpulseStudentId;
  try {
    await openAccessViaEvent(
      sub.user.email,
      YEARLY_PROGRAM_CONFIG.sendpulseEventSlug,
      paidPayments[0]!.amount,
    );
    if (!studentId && YEARLY_PROGRAM_CONFIG.sendpulseCourseId) {
      try {
        studentId = await lookupStudentIdByEmail(
          YEARLY_PROGRAM_CONFIG.sendpulseCourseId,
          sub.user.email,
        );
      } catch {
        // ignore lookup err — буде досипано пізнішим cron-ом / ручним запуском
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
    return NextResponse.json({
      error: `SendPulse: ${openErr}`,
    }, { status: 502 });
  }

  // 2. Перерахунок expiresAt по cohort-aware логіці.
  const newExpiresAt = calculateAccessUntil({
    plan: sub.plan,
    autoRenew: sub.autoRenew,
    cohort: { startDate: sub.cohort.startDate, endDate: sub.cohort.endDate },
    payments: sub.payments,
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

  // 3. Welcome email — той самий шаблон що й при груповому запуску cohort-у.
  // Якщо студент вже отримував лист цього cohort-у (наприклад, після перенесення між cohort-ами) — пропускаємо.
  const alreadySent = sub.events.some((ev) => {
    const m = ev.metadata as { cohortId?: string } | null;
    return m?.cohortId === sub.cohort?.id;
  });

  let emailResult: { sent: boolean; skipped?: string; error?: string } = { sent: false };
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
      const res = await sendEmail({ to: sub.user.email, subject, html: body });
      if (!res.ok) throw new Error(res.error ?? 'send failed');
      await prisma.yearlyProgramSubscriptionEvent.create({
        data: {
          subscriptionId: sub.id,
          type: 'launch_email_sent',
          message: `Welcome email (extra-launch) sent by ${actorLabel}`,
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

  return NextResponse.json({
    ok: true,
    expiresAt: newExpiresAt?.toISOString() ?? null,
    sendpulseAccessOpened: true,
    studentId,
    email: emailResult,
  });
}
