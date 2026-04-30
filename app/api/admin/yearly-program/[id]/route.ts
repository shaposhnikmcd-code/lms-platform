import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAdmin, getAdminActor } from '@/lib/adminAuth';
import { closeAccessInCourse, lookupStudentIdByEmail, openAccessViaEvent } from '@/lib/sendpulse';
import { removeRegularSchedule, chargeByRecToken, getWayforpayCreds, getRegularStatus } from '@/lib/wayforpay';
import { YEARLY_PROGRAM_CONFIG } from '@/lib/yearlyProgramConfig';
import { getYearlyProgramSettings } from '@/lib/yearlyProgramSettings';

/// Admin actions над конкретною підпискою Річної програми.
/// Body: { action: "cancel" | "close_access" | "reopen_access" | "extend" | "delete",
///         daysToAdd?: number, reason?: string }
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
  const body = (await req.json()) as {
    action?: string;
    daysToAdd?: number;
    reason?: string;
  };

  const sub = await prisma.yearlyProgramSubscription.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!sub) {
    return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
  }

  switch (body.action) {
    case 'cancel':
      return handleCancel(sub, actorLabel, body.reason);
    case 'close_access':
      return handleCloseAccess(sub, actorLabel);
    case 'reopen_access':
      return handleReopenAccess(sub, actorLabel);
    case 'extend':
      return handleExtend(sub, body.daysToAdd ?? 30, actorLabel);
    case 'delete':
      return handleDelete(sub, actorLabel);
    case 'test_charge':
      return handleTestCharge(sub, actorLabel);
    case 'wfp_status':
      return handleWfpStatus(sub);
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}

/// Запитує у WFP статус регулярного платежу для діагностики.
/// Перевіряє по всіх PAID платежах підписки — будь-який міг бути prime для regularApi schedule.
async function handleWfpStatus(sub: NonNullable<SubWithUser>) {
  const creds = getWayforpayCreds();
  const merchantPassword = process.env.WAYFORPAY_MERCHANT_PASSWORD;
  if (!merchantPassword) {
    return NextResponse.json({ error: 'WAYFORPAY_MERCHANT_PASSWORD не налаштовано' }, { status: 500 });
  }
  const paidPayments = await prisma.payment.findMany({
    where: { yearlyProgramSubscriptionId: sub.id, status: 'PAID' },
    orderBy: { paidAt: 'asc' },
    select: { orderReference: true, amount: true, paidAt: true },
  });
  const checks = await Promise.all(paidPayments.map(async (p) => {
    const r = await getRegularStatus({
      merchantAccount: creds.merchantAccount,
      merchantPassword,
      orderReference: p.orderReference,
    });
    return {
      orderReference: p.orderReference,
      paidAt: p.paidAt,
      reasonCode: r.raw.reasonCode,
      status: r.raw.status,
      mode: r.raw.mode,
      amount: r.raw.amount,
      nextPayment: r.raw.nextPayment,
      raw: r.raw,
    };
  }));
  return NextResponse.json({
    subId: sub.id,
    recToken: sub.recToken ? sub.recToken.slice(0, 6) + '…' + sub.recToken.slice(-4) : null,
    paidPaymentsCount: paidPayments.length,
    checks,
  });
}

/// Тригерить server-to-server CHARGE по збереженому recToken.
/// Симулює WFP автосписання (cyclical) — у проді через regularApi WFP робив би те саме раз на місяць.
/// Доступне тільки в test mode (`WAYFORPAY_TEST_MODE=1`) щоб не списати реальні гроші клієнта.
async function handleTestCharge(sub: NonNullable<SubWithUser>, actor: string) {
  const creds = getWayforpayCreds();
  if (sub.plan !== 'MONTHLY') {
    return NextResponse.json({ error: 'Test charge — лише для MONTHLY підписок' }, { status: 400 });
  }
  if (!sub.recToken) {
    return NextResponse.json({ error: 'Підписка не має recToken (потрібен реальний АВТОПЛАТІЖ платіж спочатку)' }, { status: 400 });
  }
  if (!sub.user?.email) {
    return NextResponse.json({ error: 'User email відсутній' }, { status: 400 });
  }

  const firstPaid = await prisma.payment.findFirst({
    where: { yearlyProgramSubscriptionId: sub.id, status: 'PAID' },
    orderBy: { paidAt: 'asc' },
    select: { amount: true },
  });
  const amount = firstPaid?.amount ?? 1;
  const orderReference = `${YEARLY_PROGRAM_CONFIG.monthlyOrderPrefix}_test_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const host = process.env.NEXTAUTH_URL || 'https://www.uimp.com.ua';
  const serviceUrl = `${host.replace(/\/+$/, '')}/api/wayforpay/callback`;

  const result = await chargeByRecToken({
    merchantAccount: creds.merchantAccount,
    merchantDomainName: creds.merchantDomainName,
    merchantSecretKey: creds.secretKey,
    orderReference,
    amount,
    productName: 'Річна програма UIMP — тестове автосписання',
    productPrice: amount,
    recToken: sub.recToken,
    email: sub.user.email,
    clientFirstName: sub.user.name?.split(' ')[0] ?? undefined,
    serviceUrl,
  });

  await prisma.yearlyProgramSubscriptionEvent.create({
    data: {
      subscriptionId: sub.id,
      type: 'admin_action',
      message: `Test charge by ${actor} · ${result.ok ? 'OK' : 'FAILED'} · ${result.transactionStatus ?? 'no_status'}${result.reason ? ` · ${result.reason}` : ''}`,
      metadata: { orderReference, amount, transactionStatus: result.transactionStatus, reason: result.reason, ok: result.ok },
    },
  });

  return NextResponse.json({
    ok: result.ok,
    orderReference,
    amount,
    transactionStatus: result.transactionStatus,
    reason: result.reason,
    raw: result.raw,
  });
}

type SubWithUser = Awaited<ReturnType<typeof prisma.yearlyProgramSubscription.findUnique>> & {
  user: { email: string; name: string | null } | null;
};

async function handleCancel(sub: NonNullable<SubWithUser>, actor: string, reason?: string) {
  // 1) Якщо плани MONTHLY і є recToken — спробувати зняти регулярку на стороні WFP
  let wfpRemoved = false;
  let wfpError: string | null = null;

  if (sub.plan === 'MONTHLY' && sub.recToken) {
    try {
      const merchantAccount = process.env.WAYFORPAY_MERCHANT_LOGIN!;
      const merchantPassword = process.env.WAYFORPAY_MERCHANT_PASSWORD;
      if (merchantPassword) {
        // orderReference для REMOVE — найперший Payment цієї підписки.
        const firstPayment = await prisma.payment.findFirst({
          where: { yearlyProgramSubscriptionId: sub.id, status: 'PAID' },
          orderBy: { paidAt: 'asc' },
        });
        if (firstPayment) {
          const result = await removeRegularSchedule({
            merchantAccount,
            merchantPassword,
            orderReference: firstPayment.orderReference,
          });
          wfpRemoved = result.ok;
          if (!result.ok) wfpError = JSON.stringify(result.raw).slice(0, 300);
        } else {
          wfpError = 'Перший Payment не знайдено';
        }
      } else {
        wfpError = 'WAYFORPAY_MERCHANT_PASSWORD не налаштовано';
      }
    } catch (e) {
      wfpError = (e as Error).message;
    }
  }

  await prisma.yearlyProgramSubscription.update({
    where: { id: sub.id },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelledBy: actor,
      cancelledReason: reason ?? null,
      // Очищуємо recToken незалежно від того, вдалось зняти WFP-регулярку чи ні.
      // Якщо WFP remove впав — наступний autocharge callback не зможе знайти sub через
      // recToken-binding (callback перевіряє where.recToken), тобто автосписання не продовжиться
      // навіть при reopen_access.
      recToken: null,
    },
  });

  await prisma.yearlyProgramSubscriptionEvent.create({
    data: {
      subscriptionId: sub.id,
      type: 'cancelled',
      message: `Cancelled by ${actor}${reason ? ` — ${reason}` : ''}${wfpRemoved ? ' · WFP regular removed' : (wfpError ? ` · WFP: ${wfpError}` : '')}`,
      metadata: { wfpRemoved, wfpError, reason },
    },
  });

  return NextResponse.json({ ok: true, wfpRemoved, wfpError });
}

async function handleCloseAccess(sub: NonNullable<SubWithUser>, actor: string) {
  const courseId = YEARLY_PROGRAM_CONFIG.sendpulseCourseId;
  if (!courseId) {
    return NextResponse.json({
      error: 'SENDPULSE_YEARLY_COURSE_ID не налаштовано — не можу закрити в SendPulse. Зроби EXPIRED без виклику API?',
    }, { status: 400 });
  }

  let studentId = sub.sendpulseStudentId;
  if (!studentId && sub.user?.email) {
    try {
      studentId = await lookupStudentIdByEmail(courseId, sub.user.email);
      if (studentId) {
        await prisma.yearlyProgramSubscription.update({
          where: { id: sub.id },
          data: { sendpulseStudentId: studentId },
        });
      }
    } catch (e) {
      return NextResponse.json({ error: `SendPulse lookup: ${(e as Error).message}` }, { status: 500 });
    }
  }

  if (!studentId) {
    return NextResponse.json({ error: 'studentId в SendPulse не знайдений за email' }, { status: 404 });
  }

  try {
    await closeAccessInCourse(studentId, courseId);
  } catch (e) {
    return NextResponse.json({ error: `SendPulse close: ${(e as Error).message}` }, { status: 500 });
  }

  const now = new Date();
  await prisma.yearlyProgramSubscription.update({
    where: { id: sub.id },
    data: {
      status: 'EXPIRED',
      sendpulseAccessClosedAt: now,
    },
  });
  await prisma.yearlyProgramSubscriptionEvent.create({
    data: {
      subscriptionId: sub.id,
      type: 'access_closed',
      message: `Closed by ${actor} · DELETE /students/${studentId}/${courseId}`,
    },
  });

  return NextResponse.json({ ok: true });
}

async function handleReopenAccess(sub: NonNullable<SubWithUser>, actor: string) {
  if (!sub.user?.email) {
    return NextResponse.json({ error: 'У користувача немає email' }, { status: 400 });
  }
  if (sub.status === 'ARCHIVED') {
    return NextResponse.json(
      { error: 'Підписка заархівована — відкрити доступ знову не можна. Створіть нову.' },
      { status: 400 },
    );
  }

  // Передаємо реальну суму плану — щоб у CRM SendPulse запис мав коректну ціну
  // (а не 0 ₴ після ручного reopen). Ціни редаговані з адмінки (YearlyProgramSetting).
  const programSettings = await getYearlyProgramSettings(prisma);
  const planPrice = sub.plan === 'YEARLY'
    ? programSettings.yearlyPrice
    : programSettings.monthlyPrice;

  try {
    await openAccessViaEvent(
      sub.user.email,
      YEARLY_PROGRAM_CONFIG.sendpulseEventSlug,
      planPrice,
    );
  } catch (e) {
    return NextResponse.json({ error: `SendPulse event: ${(e as Error).message}` }, { status: 500 });
  }

  const now = new Date();
  // Plan-aware buffer: YEARLY → +365д, MONTHLY → +30д. Раніше було хардкод +30 для всіх.
  const bufferDays = sub.plan === 'YEARLY'
    ? YEARLY_PROGRAM_CONFIG.yearlyDurationDays
    : YEARLY_PROGRAM_CONFIG.monthlyDurationDays;
  await prisma.yearlyProgramSubscription.update({
    where: { id: sub.id },
    data: {
      status: 'ACTIVE',
      sendpulseAccessOpenedAt: now,
      sendpulseAccessClosedAt: null,
      // Якщо expiresAt у майбутньому — лишаємо. Інакше даємо буфер згідно плану.
      expiresAt: sub.expiresAt && sub.expiresAt > now
        ? sub.expiresAt
        : new Date(now.getTime() + bufferDays * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.yearlyProgramSubscriptionEvent.create({
    data: {
      subscriptionId: sub.id,
      type: 'reactivated',
      message: `Reopened by ${actor}`,
    },
  });

  return NextResponse.json({ ok: true });
}

async function handleExtend(sub: NonNullable<SubWithUser>, daysToAdd: number, actor: string) {
  if (!Number.isFinite(daysToAdd) || daysToAdd <= 0 || daysToAdd > 3650) {
    return NextResponse.json({ error: 'Invalid daysToAdd (1..3650)' }, { status: 400 });
  }

  const now = new Date();
  const base = sub.expiresAt && sub.expiresAt > now ? sub.expiresAt : now;
  const newExpires = new Date(base.getTime() + daysToAdd * 24 * 60 * 60 * 1000);

  await prisma.yearlyProgramSubscription.update({
    where: { id: sub.id },
    data: {
      expiresAt: newExpires,
      // Якщо був EXPIRED/GRACE — знову активуємо
      status: sub.status === 'CANCELLED' ? 'CANCELLED' : 'ACTIVE',
    },
  });
  await prisma.yearlyProgramSubscriptionEvent.create({
    data: {
      subscriptionId: sub.id,
      type: 'admin_action',
      message: `Extended +${daysToAdd}d by ${actor} → ${newExpires.toISOString().slice(0, 10)}`,
    },
  });

  return NextResponse.json({ ok: true, newExpiresAt: newExpires.toISOString() });
}

async function handleDelete(sub: NonNullable<SubWithUser>, actor: string) {
  // Soft-archive: закриваємо доступ у SendPulse, чистимо технічні поля (recToken/studentId),
  // ставимо статус ARCHIVED. Картка лишається в адмінці як архівний запис; reopen заборонений.
  // Payment-и лишаються нерушеними з лінком на цю підписку.
  let sendpulseClosed = false;
  let sendpulseError: string | null = null;

  const courseId = YEARLY_PROGRAM_CONFIG.sendpulseCourseId;
  if (courseId && sub.user?.email) {
    try {
      let studentId = sub.sendpulseStudentId;
      if (!studentId) {
        studentId = await lookupStudentIdByEmail(courseId, sub.user.email);
      }
      if (studentId) {
        await closeAccessInCourse(studentId, courseId);
        sendpulseClosed = true;
      } else {
        sendpulseError = 'studentId не знайдено в SendPulse — закриття пропущено';
      }
    } catch (e) {
      sendpulseError = (e as Error).message;
    }
  } else if (!courseId) {
    sendpulseError = 'SENDPULSE_YEARLY_COURSE_ID не налаштовано';
  }

  const now = new Date();
  await prisma.yearlyProgramSubscription.update({
    where: { id: sub.id },
    data: {
      status: 'ARCHIVED',
      sendpulseAccessClosedAt: sendpulseClosed ? now : sub.sendpulseAccessClosedAt,
      // Чистимо технічні поля — підписку вже не можна реактивувати
      recToken: null,
      sendpulseStudentId: null,
    },
  });

  await prisma.yearlyProgramSubscriptionEvent.create({
    data: {
      subscriptionId: sub.id,
      type: 'admin_action',
      message: `Archived by ${actor}${sendpulseClosed ? ' · SendPulse access closed' : (sendpulseError ? ` · SendPulse: ${sendpulseError}` : '')}`,
      metadata: { sendpulseClosed, sendpulseError },
    },
  });

  return NextResponse.json({ ok: true, sendpulseClosed, sendpulseError });
}
