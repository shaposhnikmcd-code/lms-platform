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
    case 'simulate_access_closed':
      return handleSimulateAccessClosed(sub, actorLabel);
    case 'simulate_failed_cyclical_callback':
      return handleSimulateFailedCyclicalCallback(sub, actorLabel);
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

/// Симулює failed cyclical callback від WFP — POST у наш callback endpoint
/// з валідним merchantSignature, transactionStatus='Declined', НОВИМ orderRef
/// (якого нема в БД), email підписника. Це повторює реальний сценарій коли
/// WFP пробує cyclical-списання і карта повертає decline.
///
/// Перевіряє нашу гілку handleYearlyProgramFailedCallback Path 2:
///   - знаходить sub за email
///   - створює Payment FAILED лінкований до sub
///   - інкрементує failedChargeCount
///   - додає event 'charge_failed'
///
/// Після simulate ВЛАСНЕ revert НЕ робимо: failedChargeCount/event/Payment FAILED
/// лишаються — це реальний слід симульованого failed cyclical, корисний для перевірки
/// що cron потім надішле cyclicalChargeFailed1 лист (який сам собою idempotent).
/// Якщо потрібно повернути sub до чистого стану — `cleanup_failed_cyclical_test` дія
/// (TODO коли знадобиться) або вручну видалити в адмінці.
async function handleSimulateFailedCyclicalCallback(sub: NonNullable<SubWithUser>, actor: string) {
  if (!sub.user?.email) {
    return NextResponse.json({ error: 'User email відсутній' }, { status: 400 });
  }
  if (sub.plan !== 'MONTHLY') {
    return NextResponse.json({ error: 'Доступно лише для MONTHLY-підписки (cyclical-flow)' }, { status: 400 });
  }
  if (sub.status !== 'ACTIVE' && sub.status !== 'GRACE') {
    return NextResponse.json({ error: `Sub status має бути ACTIVE або GRACE (поточний: ${sub.status})` }, { status: 400 });
  }

  const creds = getWayforpayCreds();
  const orderReference = `${YEARLY_PROGRAM_CONFIG.monthlyOrderPrefix}_simfailed_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const amount = 1;
  const currency = 'UAH';
  const authCode = '000000';
  const cardPan = '44****0125';
  const transactionStatus = 'Declined';
  const reasonCode = 1107; // 1107 — типовий WFP refusal код "Insufficient funds" / generic decline
  const reason = 'SIMULATED: Insufficient funds';

  const signatureString = [
    creds.merchantAccount,
    orderReference,
    amount,
    currency,
    authCode,
    cardPan,
    transactionStatus,
    reasonCode,
  ].join(';');
  const merchantSignature = (await import('crypto'))
    .createHmac('md5', creds.secretKey)
    .update(signatureString)
    .digest('hex');

  const payload = {
    merchantAccount: creds.merchantAccount,
    orderReference,
    merchantSignature,
    amount,
    currency,
    authCode,
    cardPan,
    transactionStatus,
    reasonCode,
    reason,
    email: sub.user.email,
    recToken: '',
    paymentSystem: 'card',
    cardType: 'Visa',
  };

  const host = process.env.NEXTAUTH_URL || 'https://pre.uimp.com.ua';
  const callbackRes = await fetch(`${host.replace(/\/+$/, '')}/api/wayforpay/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const callbackJson = await callbackRes.json().catch(() => ({}));

  // Зчитати стан після callback — перевірити що: failedChargeCount інкремент,
  // Payment FAILED створений, event charge_failed додано.
  const after = await prisma.yearlyProgramSubscription.findUnique({
    where: { id: sub.id },
    select: {
      failedChargeCount: true,
      lastChargeAttemptAt: true,
      lastChargeError: true,
      status: true,
    },
  });
  const createdPayment = await prisma.payment.findUnique({
    where: { orderReference },
    select: { id: true, status: true, amount: true, yearlyProgramSubscriptionId: true },
  });
  const lastEvent = await prisma.yearlyProgramSubscriptionEvent.findFirst({
    where: { subscriptionId: sub.id, type: 'charge_failed' },
    orderBy: { createdAt: 'desc' },
    select: { type: true, message: true, createdAt: true, metadata: true },
  });

  await prisma.yearlyProgramSubscriptionEvent.create({
    data: {
      subscriptionId: sub.id,
      type: 'admin_action',
      message: `Simulate failed cyclical callback by ${actor} · orderRef=${orderReference} · callbackStatus=${callbackRes.status} · failedCount=${sub.failedChargeCount}→${after?.failedChargeCount} · paymentCreated=${!!createdPayment}`,
      metadata: {
        orderReference,
        callbackStatus: callbackRes.status,
        callbackResponse: JSON.stringify(callbackJson).slice(0, 400),
        failedChargeCountBefore: sub.failedChargeCount,
        failedChargeCountAfter: after?.failedChargeCount,
        paymentCreated: createdPayment ? { id: createdPayment.id, status: createdPayment.status, linkedToSub: createdPayment.yearlyProgramSubscriptionId === sub.id } : null,
      },
    },
  });

  const expectedFailedIncrement = (after?.failedChargeCount ?? 0) === (sub.failedChargeCount ?? 0) + 1;
  const expectedPaymentFailed = createdPayment?.status === 'FAILED' && createdPayment.yearlyProgramSubscriptionId === sub.id;
  const expectedEventCreated = lastEvent && (Date.now() - lastEvent.createdAt.getTime()) < 5000;

  return NextResponse.json({
    ok: callbackRes.status === 200 && expectedFailedIncrement && expectedPaymentFailed && expectedEventCreated,
    callbackStatus: callbackRes.status,
    callbackResponse: callbackJson,
    assertions: {
      callback_returned_200: callbackRes.status === 200,
      failed_charge_count_incremented: expectedFailedIncrement,
      payment_created_FAILED_linked_to_sub: expectedPaymentFailed,
      charge_failed_event_added: expectedEventCreated,
    },
    state: {
      orderReference,
      failedChargeCountBefore: sub.failedChargeCount,
      failedChargeCountAfter: after?.failedChargeCount,
      lastChargeError: after?.lastChargeError,
      payment: createdPayment,
      lastEvent: lastEvent ? { message: lastEvent.message, at: lastEvent.createdAt.toISOString() } : null,
    },
  });
}

/// Симулює end-to-end сценарій day+7 закриття доступу (GRACE → EXPIRED):
/// тимчасово ставить sub у GRACE з минулим gracePeriodEndsAt, викликає cron
/// internally — той реально закриває доступ у SendPulse через DELETE /students,
/// ставить status=EXPIRED + reminderSentExpired=true, шле accessClosed лист.
/// Після — повертає sub у попередній стан і відкриває доступ у SendPulse заново
/// через openAccessViaEvent (як у handleReopenAccess).
///
/// ВИМОГИ ДО ПОТОЧНОЇ SUB: status=ACTIVE, expiresAt у майбутньому — інакше revert
/// не буде чистим. Між cron-close і нашим reopen клієнт на ~1-2с має закритий
/// доступ у SendPulse — це прийнятна ціна за реальну перевірку повного flow.
async function handleSimulateAccessClosed(sub: NonNullable<SubWithUser>, actor: string) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET не налаштовано' }, { status: 500 });
  }
  if (!sub.user?.email) {
    return NextResponse.json({ error: 'User email відсутній' }, { status: 400 });
  }
  if (sub.status !== 'ACTIVE') {
    return NextResponse.json(
      { error: `Sub status має бути ACTIVE для симуляції (поточний: ${sub.status})` },
      { status: 400 },
    );
  }
  if (!sub.expiresAt || sub.expiresAt <= new Date()) {
    return NextResponse.json(
      { error: 'Sub.expiresAt має бути в майбутньому для коректного revert' },
      { status: 400 },
    );
  }

  const snapshot = {
    status: sub.status,
    expiresAt: sub.expiresAt,
    graceStartedAt: sub.graceStartedAt,
    gracePeriodEndsAt: sub.gracePeriodEndsAt,
    reminderSentExpired: sub.reminderSentExpired,
    sendpulseAccessClosedAt: sub.sendpulseAccessClosedAt,
    sendpulseAccessOpenedAt: sub.sendpulseAccessOpenedAt,
  };

  const now = new Date();
  // Set GRACE з gracePeriodEndsAt у минулому → cron-step expireGraceSubscriptions
  // підхопить sub-у і прожене реальний flow (SendPulse close + EXPIRED + email).
  await prisma.yearlyProgramSubscription.update({
    where: { id: sub.id },
    data: {
      status: 'GRACE',
      graceStartedAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
      gracePeriodEndsAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      reminderSentExpired: false,
    },
  });

  const host = process.env.NEXTAUTH_URL || 'https://pre.uimp.com.ua';
  const cronRes = await fetch(`${host.replace(/\/+$/, '')}/api/cron/yearly-subscriptions`, {
    headers: { Authorization: `Bearer ${cronSecret}` },
  });
  const cronResult = await cronRes.json().catch(() => ({}));

  // Зчитати стан після cron, щоб повернути в респонс і записати в event metadata.
  const afterCron = await prisma.yearlyProgramSubscription.findUnique({
    where: { id: sub.id },
    select: {
      status: true,
      reminderSentExpired: true,
      sendpulseAccessClosedAt: true,
    },
  });

  // Reopen access у SendPulse — використовуємо ту ж логіку, що й handleReopenAccess.
  const programSettings = await getYearlyProgramSettings(prisma);
  const planPrice = sub.plan === 'YEARLY'
    ? programSettings.yearlyPrice
    : programSettings.monthlyPrice;
  let reopenError: string | null = null;
  try {
    await openAccessViaEvent(
      sub.user.email,
      YEARLY_PROGRAM_CONFIG.sendpulseEventSlug,
      planPrice,
    );
  } catch (e) {
    reopenError = (e as Error).message;
  }

  // Restore snapshot — повертаємо sub точно у стан до симуляції.
  await prisma.yearlyProgramSubscription.update({
    where: { id: sub.id },
    data: {
      status: snapshot.status,
      expiresAt: snapshot.expiresAt,
      graceStartedAt: snapshot.graceStartedAt,
      gracePeriodEndsAt: snapshot.gracePeriodEndsAt,
      reminderSentExpired: snapshot.reminderSentExpired,
      sendpulseAccessClosedAt: snapshot.sendpulseAccessClosedAt,
      sendpulseAccessOpenedAt: reopenError ? snapshot.sendpulseAccessOpenedAt : new Date(),
    },
  });

  await prisma.yearlyProgramSubscriptionEvent.create({
    data: {
      subscriptionId: sub.id,
      type: 'admin_action',
      message: `Simulate access_closed by ${actor} · cron=${cronRes.status} · sub→${afterCron?.status ?? '?'} · letter=${afterCron?.reminderSentExpired ? 'sent' : 'NOT sent'}${reopenError ? ` · REOPEN FAILED: ${reopenError}` : ' · reopened'}`,
      metadata: {
        cronStatus: cronRes.status,
        afterCronStatus: afterCron?.status,
        emailFlagSet: afterCron?.reminderSentExpired,
        sendpulseClosedAtAfterCron: afterCron?.sendpulseAccessClosedAt?.toISOString() ?? null,
        reopenError,
        cronResult: JSON.stringify(cronResult).slice(0, 800),
      },
    },
  });

  const expectedExpired = afterCron?.status === 'EXPIRED';
  const expectedEmail = afterCron?.reminderSentExpired === true;
  const expectedSendpulseClosed = afterCron?.sendpulseAccessClosedAt != null;

  return NextResponse.json({
    ok: cronRes.status === 200 && expectedExpired && expectedEmail && expectedSendpulseClosed && !reopenError,
    cronStatus: cronRes.status,
    assertions: {
      cron_returned_200: cronRes.status === 200,
      sub_marked_expired: expectedExpired,
      reminder_expired_flag_set: expectedEmail,
      sendpulse_closed_at_recorded: expectedSendpulseClosed,
      reopen_succeeded: !reopenError,
    },
    afterCronState: afterCron,
    reopenError,
    cronResult,
    snapshot: {
      status: snapshot.status,
      expiresAt: snapshot.expiresAt?.toISOString(),
      reminderSentExpired: snapshot.reminderSentExpired,
    },
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
  // 1) Якщо план MONTHLY — пробуємо зняти ВСІ активні WFP-регулярки.
  // НЕ гейтимо по sub.recToken: WFP не повертає recToken у callback (відоме обмеження
  // нашого мерчант-акаунта, чекаємо відповідь WFP support), але регулярки реально
  // створюються і списують. Тому єдиний надійний спосіб — пробувати REMOVE по orderRef.
  // У клієнта може бути одночасно >1 активна регулярка (наприклад, картка + Apple Pay):
  // кожна прив'язана до свого orderRef першого autopay-платежу. Тому ітеруємо ВСІ
  // PAID платежі підписки і не break-имо після першого успіху.
  let wfpRemovedCount = 0;
  let wfpAttemptedCount = 0;
  let wfpError: string | null = null;

  if (sub.plan === 'MONTHLY') {
    try {
      const merchantAccount = process.env.WAYFORPAY_MERCHANT_LOGIN!;
      const merchantPassword = process.env.WAYFORPAY_MERCHANT_PASSWORD;
      if (!merchantPassword) {
        wfpError = 'WAYFORPAY_MERCHANT_PASSWORD не налаштовано';
      } else {
        const paidPayments = await prisma.payment.findMany({
          where: { yearlyProgramSubscriptionId: sub.id, status: 'PAID' },
          orderBy: { paidAt: 'desc' },
        });
        wfpAttemptedCount = paidPayments.length;
        const realErrors: string[] = [];
        for (const p of paidPayments) {
          const result = await removeRegularSchedule({
            merchantAccount,
            merchantPassword,
            orderReference: p.orderReference,
          });
          if (result.ok) {
            wfpRemovedCount++;
          } else if (result.raw.reasonCode !== 4102) {
            // 4102 "Rule is not found" — означає що для цього orderRef регулярки НЕ було
            // (нормально, якщо це cyclical-Payment або РАЗОВА у цій підписці).
            // Все інше — справжня помилка від WFP, варто залогувати.
            realErrors.push(`${p.orderReference}: code=${result.raw.reasonCode} reason=${String(result.raw.reason ?? '').slice(0, 80)}`);
          }
        }
        if (realErrors.length > 0) {
          wfpError = realErrors.join(' | ').slice(0, 600);
        }
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

  const wfpSummary = sub.plan === 'MONTHLY'
    ? ` · WFP REMOVE: ${wfpRemovedCount}/${wfpAttemptedCount}${wfpError ? ` (errors: ${wfpError.slice(0, 200)})` : ''}`
    : '';
  await prisma.yearlyProgramSubscriptionEvent.create({
    data: {
      subscriptionId: sub.id,
      type: 'cancelled',
      message: `Cancelled by ${actor}${reason ? ` — ${reason}` : ''}${wfpSummary}`,
      metadata: { wfpRemovedCount, wfpAttemptedCount, wfpError, reason },
    },
  });

  return NextResponse.json({
    ok: true,
    wfpRemovedCount,
    wfpAttemptedCount,
    wfpError,
  });
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
