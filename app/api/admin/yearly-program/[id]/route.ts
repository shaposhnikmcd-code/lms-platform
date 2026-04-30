import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAdmin, getAdminActor } from '@/lib/adminAuth';
import { closeAccessInCourse, lookupStudentIdByEmail, openAccessViaEvent } from '@/lib/sendpulse';
import { removeRegularSchedule, chargeByRecToken, getWayforpayCreds, getRegularStatus, changeRegularSchedule } from '@/lib/wayforpay';
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
    case 'wfp_advance_next':
      return handleWfpAdvanceNext(sub, actorLabel);
    case 'test_send_email':
      return handleTestSendEmail(sub, body as { template?: string });
    case 'simulate_cyclical_failure':
      return handleSimulateCyclicalFailure(sub, actorLabel);
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}

/// Симулює сценарій "WFP не зміг автоматично списати": тимчасово ставить sub у
/// GRACE + failedChargeCount=1 + reminderSentGraceStart=false + минулий expiresAt +
/// gracePeriodEndsAt=now+5d. Потім викликає cron internally — той має побачити цю sub
/// у sendGraceStartReminders і реально надіслати cyclicalChargeFailed1 лист через Resend.
/// Після — повертає sub у попередній стан, щоб не зламати інші тести.
async function handleSimulateCyclicalFailure(sub: NonNullable<SubWithUser>, actor: string) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET не налаштовано' }, { status: 500 });
  }
  const snapshot = {
    status: sub.status,
    failedChargeCount: sub.failedChargeCount,
    recToken: sub.recToken,
    reminderSentGraceStart: sub.reminderSentGraceStart,
    reminderSentGraceMid: sub.reminderSentGraceMid,
    expiresAt: sub.expiresAt,
    gracePeriodEndsAt: sub.gracePeriodEndsAt,
  };
  const now = new Date();
  await prisma.yearlyProgramSubscription.update({
    where: { id: sub.id },
    data: {
      status: 'GRACE',
      failedChargeCount: 1,
      recToken: sub.recToken ?? `SIM_TOKEN_${Date.now()}`,
      reminderSentGraceStart: false,
      expiresAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      gracePeriodEndsAt: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
    },
  });

  const host = process.env.NEXTAUTH_URL || 'https://pre.uimp.com.ua';
  const cronRes = await fetch(`${host.replace(/\/+$/, '')}/api/cron/yearly-subscriptions`, {
    headers: { Authorization: `Bearer ${cronSecret}` },
  });
  const cronResult = await cronRes.json().catch(() => ({}));

  // Revert
  await prisma.yearlyProgramSubscription.update({
    where: { id: sub.id },
    data: snapshot,
  });

  await prisma.yearlyProgramSubscriptionEvent.create({
    data: {
      subscriptionId: sub.id,
      type: 'admin_action',
      message: `Simulate cyclical failure by ${actor} · cron returned ${cronRes.status}`,
      metadata: { cronStatus: cronRes.status, cronResults: JSON.stringify(cronResult).slice(0, 800) },
    },
  });

  return NextResponse.json({
    ok: cronRes.status === 200,
    cronStatus: cronRes.status,
    cronResult,
    snapshot,
  });
}

/// Шле email з обраного шаблону yearly-program напряму через Resend.
/// Корисно для перевірки що тексти/розмітка/посилання виглядають як треба у клієнтській пошті.
async function handleTestSendEmail(sub: NonNullable<SubWithUser>, body: { template?: string }) {
  if (!sub.user?.email) {
    return NextResponse.json({ error: 'User email відсутній' }, { status: 400 });
  }
  const tmpl = body.template ?? 'cyclicalChargeFailed1';
  const allTemplates = [
    'manualBeforeExpiry',
    'manualOnExpiry',
    'manualGraceStart',
    'cyclicalChargeFailed1',
    'cyclicalChargeFailed3',
    'accessClosed',
  ];
  if (!allTemplates.includes(tmpl)) {
    return NextResponse.json({ error: `template must be one of: ${allTemplates.join(', ')}` }, { status: 400 });
  }
  const { Resend } = await import('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);
  const tmplModule = await import('@/lib/emailTemplates/yearlyProgram');
  const fakeExpiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const fakeGraceEnd = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000);
  const args = { name: sub.user.name, expiresAt: fakeExpiresAt, gracePeriodEndsAt: fakeGraceEnd };
  const fn = (tmplModule as Record<string, unknown>)[tmpl] as (a: typeof args) => { subject: string; html: string };
  const { subject, html } = fn(args);
  const result = await resend.emails.send({
    from: 'UIMP <onboarding@resend.dev>',
    to: sub.user.email,
    subject,
    html,
  });
  return NextResponse.json({
    ok: !result.error,
    template: tmpl,
    sentTo: sub.user.email,
    subject,
    error: result.error?.message ?? null,
    resendId: result.data?.id ?? null,
  });
}

/// Змінює дату наступного списання WFP-регулярки на завтра — щоб не чекати 30 днів
/// для перевірки cyclical callback потоку. Шукає orderReference, для якого WFP має активний schedule.
async function handleWfpAdvanceNext(sub: NonNullable<SubWithUser>, actor: string) {
  const creds = getWayforpayCreds();
  const merchantPassword = process.env.WAYFORPAY_MERCHANT_PASSWORD;
  if (!merchantPassword) {
    return NextResponse.json({ error: 'WAYFORPAY_MERCHANT_PASSWORD не налаштовано' }, { status: 500 });
  }
  const paidPayments = await prisma.payment.findMany({
    where: { yearlyProgramSubscriptionId: sub.id, status: 'PAID' },
    orderBy: { paidAt: 'desc' },
    select: { orderReference: true, amount: true },
  });

  // Шукаємо першу регулярку зі статусом Active по нашим orderRef
  let foundRegular: { orderReference: string; amount: number; status?: unknown } | null = null;
  for (const p of paidPayments) {
    const status = await getRegularStatus({
      merchantAccount: creds.merchantAccount,
      merchantPassword,
      orderReference: p.orderReference,
    });
    if (status.ok && (status.raw.status === 'Active' || status.raw.status === 'Created')) {
      foundRegular = { orderReference: p.orderReference, amount: p.amount, status: status.raw };
      break;
    }
  }

  if (!foundRegular) {
    return NextResponse.json({
      error: 'Активної WFP-регулярки не знайдено. Спочатку оформи AUTOPAY-платіж на pre.uimp.com.ua.',
      checkedPayments: paidPayments.length,
    }, { status: 404 });
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dd = String(tomorrow.getDate()).padStart(2, '0');
  const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const dateNext = `${dd}.${mm}.${tomorrow.getFullYear()}`;
  const dateEnd = `${dd}.${mm}.${tomorrow.getFullYear() + 10}`;

  const result = await changeRegularSchedule({
    merchantAccount: creds.merchantAccount,
    merchantPassword,
    orderReference: foundRegular.orderReference,
    amount: foundRegular.amount,
    regularMode: 'monthly',
    dateNext,
    dateEnd,
  });

  await prisma.yearlyProgramSubscriptionEvent.create({
    data: {
      subscriptionId: sub.id,
      type: 'admin_action',
      message: `WFP regularApi CHANGE by ${actor} · dateNext=${dateNext} · ${result.ok ? 'OK' : 'FAILED'} · ${JSON.stringify(result.raw).slice(0, 200)}`,
      metadata: { orderReference: foundRegular.orderReference, dateNext, ok: result.ok, raw: JSON.stringify(result.raw) },
    },
  });

  return NextResponse.json({
    ok: result.ok,
    orderReference: foundRegular.orderReference,
    dateNext,
    raw: result.raw,
  });
}

/// Запитує у WFP статус регулярного платежу для діагностики.
/// Перевіряє по всіх PAID платежах підписки — будь-який міг бути prime для regularApi schedule.
async function handleWfpStatus(sub: NonNullable<SubWithUser>) {
  const creds = getWayforpayCreds();
  const rawPassword = process.env.WAYFORPAY_MERCHANT_PASSWORD;
  if (!rawPassword) {
    return NextResponse.json({ error: 'WAYFORPAY_MERCHANT_PASSWORD не налаштовано' }, { status: 500 });
  }
  const paidPayments = await prisma.payment.findMany({
    where: { yearlyProgramSubscriptionId: sub.id, status: 'PAID' },
    orderBy: { paidAt: 'asc' },
    select: { orderReference: true, amount: true, paidAt: true },
  });

  // Probe with multiple password formats to find which auth WFP accepts
  const md5Password = (await import('crypto')).createHash('md5').update(rawPassword).digest('hex');
  const variants = [
    { label: 'as_is', password: rawPassword },
    { label: 'md5_of_raw', password: md5Password },
  ];

  // Спробуємо комбінації: password format × apiVersion × content-type
  const requestVariants = [
    { label: 'json_v1_int', body: { requestType: 'STATUS', merchantAccount: creds.merchantAccount, merchantPassword: variants[0].password, orderReference: paidPayments[0]?.orderReference, apiVersion: 1 }, ct: 'application/json' },
    { label: 'json_v1_str', body: { requestType: 'STATUS', merchantAccount: creds.merchantAccount, merchantPassword: variants[0].password, orderReference: paidPayments[0]?.orderReference, apiVersion: '1' }, ct: 'application/json' },
    { label: 'json_no_ver', body: { requestType: 'STATUS', merchantAccount: creds.merchantAccount, merchantPassword: variants[0].password, orderReference: paidPayments[0]?.orderReference }, ct: 'application/json' },
    { label: 'json_v2', body: { requestType: 'STATUS', merchantAccount: creds.merchantAccount, merchantPassword: variants[0].password, orderReference: paidPayments[0]?.orderReference, apiVersion: 2 }, ct: 'application/json' },
    { label: 'md5_v1_int', body: { requestType: 'STATUS', merchantAccount: creds.merchantAccount, merchantPassword: variants[1].password, orderReference: paidPayments[0]?.orderReference, apiVersion: 1 }, ct: 'application/json' },
    { label: 'md5_md5_v1', body: { requestType: 'STATUS', merchantAccount: creds.merchantAccount, merchantPassword: (await import('crypto')).createHash('md5').update(variants[1].password).digest('hex'), orderReference: paidPayments[0]?.orderReference, apiVersion: 1 }, ct: 'application/json' },
  ];

  const probes = await Promise.all(requestVariants.map(async (v) => {
    const res = await fetch('https://api.wayforpay.com/regularApi', {
      method: 'POST',
      headers: { 'Content-Type': v.ct },
      body: JSON.stringify(v.body),
    });
    const raw = await res.json().catch(() => ({}));
    return {
      label: v.label,
      orderReference: paidPayments[0]?.orderReference,
      reasonCode: raw.reasonCode,
      reason: raw.reason,
      status: raw.status,
    };
  }));

  return NextResponse.json({
    subId: sub.id,
    rawPasswordLen: rawPassword.length,
    rawIsHex32: /^[a-f0-9]{32}$/i.test(rawPassword),
    paidPaymentsCount: paidPayments.length,
    probes,
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
        // WFP може створити регулярку на будь-якому з autopay-платежів, не тільки на першому.
        // Пробуємо REMOVE на кожному PAID orderRef поки не отримаємо 1100/Accept (success).
        const paidPayments = await prisma.payment.findMany({
          where: { yearlyProgramSubscriptionId: sub.id, status: 'PAID' },
          orderBy: { paidAt: 'desc' },
        });
        const errors: string[] = [];
        for (const p of paidPayments) {
          const result = await removeRegularSchedule({
            merchantAccount,
            merchantPassword,
            orderReference: p.orderReference,
          });
          if (result.ok) {
            wfpRemoved = true;
            break;
          } else {
            errors.push(`${p.orderReference}: ${JSON.stringify(result.raw).slice(0, 150)}`);
          }
        }
        if (!wfpRemoved && paidPayments.length === 0) {
          wfpError = 'PAID-платежів цієї підписки не знайдено';
        } else if (!wfpRemoved) {
          wfpError = errors.join(' | ').slice(0, 600);
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
