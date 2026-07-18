import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { isAdmin, getAdminActor } from '@/lib/adminAuth';
import { closeAccessInCourse, lookupStudentIdByEmail, openAccessViaEvent } from '@/lib/sendpulse';
import {
  kickSubscriptionFromChannel,
  generateInviteForSubscription,
  getYearlyProgramTelegramSettings,
} from '@/lib/yearlyProgramTelegram';
import { removeSubscriptionAutopay } from '@/lib/yearlyProgramAutopay';
import { sendYearlyProgramAdminEndedEmail, type AdminEndKind } from '@/lib/yearlyProgramAdminEndedEmail';
import { YEARLY_PROGRAM_CONFIG, getYearlySendpulseCourseId } from '@/lib/yearlyProgramConfig';
import { getYearlyProgramSettings } from '@/lib/yearlyProgramSettings';
import { parseTelegramUsername } from '@/lib/telegramUsername';
import { applyPaymentActivation } from '@/lib/yearlyProgramActivation';
import { runManualPreLaunchWelcome, type ManualPreLaunchWelcomeResult } from '@/lib/yearlyProgramManualWelcome';
import { runExtraLaunchForSubscription } from '@/lib/yearlyProgramLaunch';
import { syncAutopaySchedule } from '@/lib/yearlyProgramScheduleSync';

/// Admin actions над конкретною підпискою Річної програми.
/// Body: { action: "cancel" | "close_access" | "reopen_access" | "extend" | "carryover" | "delete",
///         daysToAdd?: number, reason?: string, note?: string, sendWelcome?: boolean }
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
    fields?: Record<string, unknown>;
    paymentId?: string;
    amount?: number;
    method?: string;
    note?: string;
    paidAt?: string;
    sendWelcome?: boolean;
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
    case 'edit':
      return handleEdit(sub, body.fields ?? {}, actorLabel);
    case 'manual_payment':
      return handleManualPayment(sub, {
        amount: body.amount,
        method: body.method,
        note: body.note,
        paidAt: body.paidAt,
      }, actorLabel);
    case 'carryover':
      return handleCarryover(sub, { note: body.note, sendWelcome: body.sendWelcome }, actorLabel);
    case 'edit_payment':
      return handleEditPayment(sub, {
        paymentId: body.paymentId,
        amount: body.amount,
        method: body.method,
        note: body.note,
        paidAt: body.paidAt,
      }, actorLabel);
    case 'delete':
      return handleDelete(sub, actorLabel);
    case 'tg_kick':
      return handleTelegramKick(sub, actorLabel, 'returnable');
    case 'tg_kick_revoke':
      return handleTelegramKick(sub, actorLabel, 'permanent');
    case 'sync_wfp_schedule':
      return handleSyncWfpSchedule(sub, actorLabel);
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}

type SubWithUser = Awaited<ReturnType<typeof prisma.yearlyProgramSubscription.findUnique>> & {
  user: { email: string; name: string | null } | null;
};

/// Шлемо лист користувачу про admin-action термінацію + логуємо в subscription event
/// (success/error). Email-помилка не валить сам admin action — фактичний flip уже
/// застосований у БД, лист — це best-effort повідомлення.
async function notifyUserSubscriptionEnded(
  sub: NonNullable<SubWithUser>,
  kind: AdminEndKind,
  hadAutoRenew: boolean,
  expiresAt: Date | null,
): Promise<void> {
  if (!sub.user?.email) return;
  try {
    const result = await sendYearlyProgramAdminEndedEmail({
      to: sub.user.email,
      name: sub.user.name ?? null,
      kind,
      expiresAt,
      hadAutoRenew,
    });
    await prisma.yearlyProgramSubscriptionEvent.create({
      data: {
        subscriptionId: sub.id,
        type: 'admin_action',
        message: result.ok
          ? `User notified: ${kind}`
          : `User notify failed (${kind}): ${(result.error ?? 'unknown').slice(0, 80)}`,
        metadata: { emailKind: kind, ok: result.ok, error: result.error ?? null },
      },
    });
  } catch (e) {
    await prisma.yearlyProgramSubscriptionEvent.create({
      data: {
        subscriptionId: sub.id,
        type: 'admin_action',
        message: `User notify error (${kind}): ${(e as Error).message.slice(0, 80)}`,
        metadata: { emailKind: kind, ok: false, error: (e as Error).message },
      },
    });
  }
}

/// Ручна синхронізація WFP-графіка автосписань з датами cohort-у (кнопка в панелі Дії).
/// Уся логіка і запобіжники — у syncAutopaySchedule; тут тільки виклик + людська відповідь.
async function handleSyncWfpSchedule(sub: NonNullable<SubWithUser>, actor: string) {
  if (sub.plan !== 'MONTHLY' || !sub.autoRenew) {
    return NextResponse.json({
      error: 'Синхронізація графіка доступна тільки для місячних підписок з автоплатежем.',
    }, { status: 400 });
  }
  const r = await syncAutopaySchedule(sub.id, { apply: true, source: `admin:${actor}` });
  const fmtD = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '—');
  const message = {
    synced: `Графік оновлено: наступне списання ${fmtD(r.nextChargeAt)}`,
    checked: `Графік уже коректний: наступне списання ${fmtD(r.nextChargeAt)}`,
    no_rule: 'У WFP немає живої регулярки для цієї підписки (разова оплата або правило знято)',
    skipped: `Пропущено: ${r.reason ?? ''}`,
    error: `Помилка: ${r.reason ?? 'невідома'}`,
  }[r.outcome];
  return NextResponse.json({
    ok: r.outcome !== 'error',
    outcome: r.outcome,
    message,
    nextChargeAt: r.nextChargeAt?.toISOString() ?? null,
  }, { status: r.outcome === 'error' ? 500 : 200 });
}

async function handleCancel(sub: NonNullable<SubWithUser>, actor: string, reason?: string) {
  if (sub.plan !== 'MONTHLY' || !sub.autoRenew) {
    return NextResponse.json({
      error: 'Скасування доступне тільки для місячних підписок з активним автоплатежем. Для дострокового закриття доступу використай "Закрити доступ у SendPulse" або "Деактивувати та Вилучити студента з програми".',
    }, { status: 400 });
  }
  const hadAutoRenew = sub.autoRenew;
  const { removed: wfpRemovedCount, attempted: wfpAttemptedCount, error: wfpError } =
    await removeSubscriptionAutopay(sub.id);

  await prisma.yearlyProgramSubscription.update({
    where: { id: sub.id },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelledBy: actor,
      cancelledReason: reason ?? null,
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

  await notifyUserSubscriptionEnded(sub, 'cancelled', hadAutoRenew, sub.expiresAt ?? null);

  return NextResponse.json({
    ok: true,
    wfpRemovedCount,
    wfpAttemptedCount,
    wfpError,
  });
}

async function handleCloseAccess(sub: NonNullable<SubWithUser>, actor: string) {
  if (!sub.sendpulseAccessOpenedAt) {
    return NextResponse.json({
      error: 'Доступ у SendPulse ще не відкривався — нема що закривати. Використай "Деактивувати та Вилучити студента з програми".',
    }, { status: 400 });
  }
  const courseId = await getYearlySendpulseCourseId(prisma);
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

  // Закриття доступу = підписка більше не активна. Знімаємо WFP-регулярки, щоб
  // автосписання не йшло до архівованих/закритих студентів (orphan-charges).
  const hadAutoRenew = sub.autoRenew;
  const autopay = await removeSubscriptionAutopay(sub.id);

  const now = new Date();
  await prisma.yearlyProgramSubscription.update({
    where: { id: sub.id },
    data: {
      status: 'EXPIRED',
      sendpulseAccessClosedAt: now,
    },
  });
  const wfpSummary = sub.plan === 'MONTHLY'
    ? ` · WFP REMOVE: ${autopay.removed}/${autopay.attempted}${autopay.error ? ` (errors: ${autopay.error.slice(0, 200)})` : ''}`
    : '';
  await prisma.yearlyProgramSubscriptionEvent.create({
    data: {
      subscriptionId: sub.id,
      type: 'access_closed',
      message: `Closed by ${actor} · DELETE /students/${studentId}/${courseId}${wfpSummary}`,
      metadata: {
        wfpRemovedCount: autopay.removed,
        wfpAttemptedCount: autopay.attempted,
        wfpError: autopay.error,
      },
    },
  });

  // Best-effort: вилучаємо з ТГ-каналу у returnable-режимі (invite залишається,
  // щоб менеджер міг повернути студента через "Відкрити доступ до SendPulse").
  // Помилка TG не блокує сам close_access — підписка вже закрита у SP/БД.
  const tg = await kickSubscriptionFromChannel({
    subscriptionId: sub.id,
    mode: 'returnable',
    triggeredBy: `admin:${actor} · close_access`,
  }).catch((e) => ({ ok: false, kicked: false, inviteRevoked: false, skipped: null, error: (e as Error).message }));

  await notifyUserSubscriptionEnded(sub, 'access_closed', hadAutoRenew, null);

  return NextResponse.json({ ok: true, autopay, telegram: tg });
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
  if (!sub.sendpulseAccessOpenedAt) {
    return NextResponse.json({
      error: 'Доступ у SendPulse ще не відкривався — "відкрити знову" неможливо. Запусти cohort.',
    }, { status: 400 });
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
  // Plan-aware buffer: YEARLY → +365д, MONTHLY → +30д.
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

/// Способи ручної оплати, відомі UI. Backend приймає будь-який непустий рядок (forward-compat),
/// але валідуємо довжину. Лейбли для логів — best-effort, незнайомий method іде «як є».
const MANUAL_METHOD_LABELS: Record<string, string> = {
  cash: 'Готівка',
  transfer: 'Переказ',
  direct: 'Напряму (ФОП)',
};

/// Ручне підтвердження оплати, яка пройшла поза WayForPay (готівка / переказ / ФОП).
/// Створює Payment(PAID) прив'язаний до підписки → перераховує expiresAt по cohort-логіці →
/// активує підписку. Якщо cohort уже launched — відкриває доступ у SendPulse + welcome-лист
/// (через runExtraLaunchForSubscription, idempotent). Якщо ще ні — лишає PENDING (чекає запуску).
/// Сума автоматично потрапляє в «Дохід» (агрегація PAID-платежів з yearlyProgramSubscriptionId).
async function handleManualPayment(
  sub: NonNullable<SubWithUser>,
  input: { amount?: number; method?: string; note?: string; paidAt?: string },
  actor: string,
) {
  if (sub.status === 'ARCHIVED') {
    return NextResponse.json({ error: 'Підписка заархівована — оплату фіксувати не можна. Створіть нову.' }, { status: 400 });
  }

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000 || !Number.isInteger(amount)) {
    return NextResponse.json({ error: 'Сума має бути цілим числом 1..1000000 (₴)' }, { status: 400 });
  }

  const method = (input.method ?? '').trim();
  if (!method || method.length > 40) {
    return NextResponse.json({ error: 'Не вказано спосіб оплати' }, { status: 400 });
  }
  const note = (input.note ?? '').trim().slice(0, 500) || null;

  let paidAt = new Date();
  if (input.paidAt) {
    const parsed = new Date(input.paidAt);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: 'Невалідна дата оплати' }, { status: 400 });
    }
    if (parsed.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
      return NextResponse.json({ error: 'Дата оплати не може бути в майбутньому' }, { status: 400 });
    }
    paidAt = parsed;
  }

  // orderReference має бути унікальним — додаємо timestamp + короткий рандом на випадок
  // двох ручних оплат в одну мілісекунду.
  const orderReference = `manual-${method}_${Date.now()}_${sub.id.slice(-6)}`;

  await prisma.payment.create({
    data: {
      userId: sub.userId,
      orderReference,
      amount,
      currency: 'UAH',
      status: 'PAID',
      paidAt,
      yearlyProgramSubscriptionId: sub.id,
      manualMethod: method,
      manualNote: note,
    },
  });

  // Це перший PAID-платіж підписки? (визначає, чи слати pre-launch welcome). Платіж уже
  // створений вище, тож перший = рівно 1 PAID у підписки.
  const paidCount = await prisma.payment.count({
    where: { yearlyProgramSubscriptionId: sub.id, status: 'PAID' },
  });
  const wasFirstPayment = paidCount === 1;

  // Перерахунок expiresAt по cohort-логіці + активація статусу (single source of truth,
  // спільний helper з carryover-флоу manual-add). Реальна оплата воскрешає мертву підписку.
  const { newStatus, newExpiresAt, cohortLaunched } = await applyPaymentActivation({
    subscriptionId: sub.id,
    plan: sub.plan,
    autoRenew: sub.autoRenew,
    prevStatus: sub.status,
    lastPaymentAt: paidAt,
    allowRevive: true,
  });

  const methodLabel = MANUAL_METHOD_LABELS[method] ?? method;
  await prisma.yearlyProgramSubscriptionEvent.create({
    data: {
      subscriptionId: sub.id,
      type: 'admin_action',
      message: `Ручна оплата ${amount}₴ (${methodLabel}) by ${actor}${note ? ` — ${note}` : ''} · expiresAt=${newExpiresAt?.toISOString().slice(0, 10) ?? 'null'}`,
      metadata: { manualPayment: true, amount, method, note, paidAt: paidAt.toISOString(), orderReference, actor },
    },
  });

  // Якщо cohort уже запущений — відкриваємо доступ у SendPulse + welcome-лист (idempotent:
  // якщо доступ уже відкрито/лист уже надсилався — пропускає). Помилка SP не валить оплату:
  // Payment уже створений і дохід зафіксований.
  // Якщо cohort ще НЕ запущений і це перший платіж — шлемо pre-launch welcome + TG-invite
  // (як реальний покупець у callback-у, гілка «не launched»). Креди — на запуску.
  let extraLaunch: Awaited<ReturnType<typeof runExtraLaunchForSubscription>> | null = null;
  let welcome: ManualPreLaunchWelcomeResult | null = null;
  if (cohortLaunched) {
    extraLaunch = await runExtraLaunchForSubscription(sub.id, `${actor} · manual_payment`).catch((e) => ({
      ok: false,
      reason: (e as Error).message,
      expiresAt: null,
      sendpulseAccessOpened: false,
      studentId: null,
      email: { sent: false },
    }));
  } else if (wasFirstPayment) {
    welcome = await runManualPreLaunchWelcome(sub.id, `${actor} · manual_payment`)
      .catch((e) => ({
        inviteGenerated: false, inviteLink: null, inviteError: null,
        welcomeSent: false, welcomeSkipped: false, welcomeError: (e as Error).message,
      }));
  }

  return NextResponse.json({
    ok: true,
    paymentId: orderReference,
    newStatus,
    newExpiresAt: newExpiresAt?.toISOString() ?? null,
    cohortLaunched,
    extraLaunch,
    welcome,
  });
}

/// «🔄 Перенесення з минулого року» для ІСНУЮЧОЇ підписки (дзеркало carryover-гілки
/// manual-add/route.ts, але для студента, якого вже завели вручну в режимі «Очікує оплату»).
/// Кейс: студентів заводили вручну ДО появи перенесення — тепер їх треба зарахувати як
/// перенесених, без нової картки в адмінці.
///
/// Умова: у підписки НЕМАЄ жодного PAID-платежу (інакше правити треба олівцем у «Платежах»,
/// щоб не було двох джерел правди про оплату).
/// Кроки: план→YEARLY + autoRenew=false → Payment(0₴, PAID, manualMethod='carryover') →
/// applyPaymentActivation(allowRevive) → подія → side-effects (запущений cohort: TG-invite +
/// extra-launch; не запущений: pre-launch welcome, якщо менеджер не зняв галочку).
/// Сума 0 → дохід/KPI не змінюються. SendPulse-помилки не валять запит (повертаємо у відповіді).
async function handleCarryover(
  sub: NonNullable<SubWithUser>,
  input: { note?: string; sendWelcome?: boolean },
  actor: string,
) {
  if (sub.status === 'ARCHIVED') {
    return NextResponse.json(
      { error: 'Підписка заархівована — перенесення зафіксувати не можна. Створіть нову.' },
      { status: 400 },
    );
  }

  const paidCount = await prisma.payment.count({
    where: { yearlyProgramSubscriptionId: sub.id, status: 'PAID' },
  });
  if (paidCount > 0) {
    return NextResponse.json(
      { error: 'У підписки вже є оплати — відредагуйте платіж олівцем у панелі "Платежі"' },
      { status: 400 },
    );
  }

  const note = (input.note ?? '').trim().slice(0, 500) || null;
  // Дефолт — слати welcome. Менеджер знімає галочку, якщо студент уже отримав запрошення.
  const sendWelcome = input.sendWelcome !== false;
  const now = new Date();

  // Перенесення = завжди річний доступ без автосписання.
  await prisma.yearlyProgramSubscription.update({
    where: { id: sub.id },
    data: { plan: 'YEARLY', autoRenew: false },
  });

  const orderReference = `carryover_${Date.now()}_${sub.id.slice(-6)}`;
  await prisma.payment.create({
    data: {
      userId: sub.userId,
      orderReference,
      amount: 0,
      currency: 'UAH',
      status: 'PAID',
      paidAt: now,
      yearlyProgramSubscriptionId: sub.id,
      manualMethod: 'carryover',
      manualNote: note,
    },
  });

  const activation = await applyPaymentActivation({
    subscriptionId: sub.id,
    plan: 'YEARLY',
    autoRenew: false,
    prevStatus: sub.status,
    lastPaymentAt: now,
    allowRevive: true,
  });

  await prisma.yearlyProgramSubscriptionEvent.create({
    data: {
      subscriptionId: sub.id,
      type: 'admin_action',
      message: `Перенесено з минулого набору (існуюча підписка) by ${actor}${note ? ` — ${note}` : ''} · expiresAt=${activation.newExpiresAt?.toISOString().slice(0, 10) ?? 'null'}`,
      metadata: { carryover: true, note, orderReference, actor },
    },
  });

  // Side-effects — дзеркало manual-add. Помилки не валять запит: платіж і доступ уже в БД.
  let extraLaunch: Awaited<ReturnType<typeof runExtraLaunchForSubscription>> | null = null;
  let welcome: ManualPreLaunchWelcomeResult | null = null;
  if (activation.cohortLaunched) {
    // Спершу TG-invite (щоб вкласти посилання в лист extra-launch-у), як у WFP callback-у.
    let tgInviteLink: string | null = null;
    try {
      const tgSettings = await getYearlyProgramTelegramSettings();
      if (tgSettings.autoAdd && tgSettings.chatId && sub.telegramUsername) {
        const tgRes = await generateInviteForSubscription({
          subscriptionId: sub.id,
          triggeredBy: `${actor}:carryover`,
        });
        if (tgRes.ok) tgInviteLink = tgRes.inviteLink;
      }
    } catch {
      // помилка invite не блокує carryover — доступ важливіший за link у листі
    }
    extraLaunch = await runExtraLaunchForSubscription(
      sub.id,
      `${actor} · carryover`,
      { telegramInviteLink: tgInviteLink },
    ).catch((e) => ({
      ok: false,
      reason: (e as Error).message,
      expiresAt: null,
      sendpulseAccessOpened: false,
      studentId: null,
      email: { sent: false },
    }));
  } else if (sendWelcome) {
    // Carryover тут — завжди перший PAID-платіж підписки (перевірено вище).
    welcome = await runManualPreLaunchWelcome(sub.id, `${actor} · carryover`)
      .catch((e) => ({
        inviteGenerated: false, inviteLink: null, inviteError: null,
        welcomeSent: false, welcomeSkipped: false, welcomeError: (e as Error).message,
      }));
  }

  return NextResponse.json({
    ok: true,
    orderReference,
    newStatus: activation.newStatus,
    newExpiresAt: activation.newExpiresAt?.toISOString() ?? null,
    cohortLaunched: activation.cohortLaunched,
    extraLaunch,
    welcome,
  });
}

/// Дозволені способи для РУЧНИХ платежів (WFP-платежі сюди не входять — їх редагувати не можна).
/// 'carryover' = перенесення з минулого набору (сума 0, дохід не рахується).
const EDIT_PAYMENT_METHODS = new Set(['cash', 'transfer', 'direct', 'carryover']);

/// Редагування РУЧНОГО платежу (готівка / переказ / ФОП / перенесення). WFP-платежі
/// (manualMethod=null) редагувати ЗАБОРОНЕНО. Дозволяє, зокрема, перетворити старий ручний
/// платіж з минулорічною сумою на «Перенесення» (0 ₴) — тоді сума виходить з «Доходу».
/// Після зміни перераховує підписку через applyPaymentActivation (expiresAt/статус/дохід
/// підтягуються самі). НЕ чіпає SendPulse / Telegram / WFP.
async function handleEditPayment(
  sub: NonNullable<SubWithUser>,
  input: { paymentId?: string; amount?: number; method?: string; note?: string; paidAt?: string },
  actor: string,
) {
  const paymentId = typeof input.paymentId === 'string' ? input.paymentId.trim() : '';
  if (!paymentId) {
    return NextResponse.json({ error: 'Не вказано платіж' }, { status: 400 });
  }

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.yearlyProgramSubscriptionId !== sub.id) {
    return NextResponse.json({ error: 'Платіж не знайдено для цієї підписки' }, { status: 404 });
  }
  if (!payment.manualMethod) {
    return NextResponse.json({ error: 'Платежі WayForPay редагувати не можна — тільки ручні' }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  const changes: string[] = [];

  // Сума — ціле 0..1_000_000. На відміну від manual_payment, 0 ДОЗВОЛЕНИЙ (перенесення).
  if (input.amount !== undefined) {
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000 || !Number.isInteger(amount)) {
      return NextResponse.json({ error: 'Сума має бути цілим числом 0..1000000 (₴)' }, { status: 400 });
    }
    if (amount !== payment.amount) {
      data.amount = amount;
      changes.push(`сума: ${payment.amount}₴ → ${amount}₴`);
    }
  }

  // Спосіб — один з дозволених ручних (включно з carryover).
  if (input.method !== undefined) {
    const method = String(input.method).trim();
    if (!EDIT_PAYMENT_METHODS.has(method)) {
      return NextResponse.json({ error: 'Спосіб: cash | transfer | direct | carryover' }, { status: 400 });
    }
    if (method !== payment.manualMethod) {
      data.manualMethod = method;
      changes.push(`спосіб: ${payment.manualMethod} → ${method}`);
    }
  }

  // Дата оплати — не в майбутньому (+24 год толеранс, як у manual_payment).
  let effectivePaidAt = payment.paidAt ?? payment.createdAt;
  if (input.paidAt !== undefined) {
    const parsed = new Date(input.paidAt);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: 'Невалідна дата оплати' }, { status: 400 });
    }
    if (parsed.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
      return NextResponse.json({ error: 'Дата оплати не може бути в майбутньому' }, { status: 400 });
    }
    if ((payment.paidAt?.getTime() ?? null) !== parsed.getTime()) {
      data.paidAt = parsed;
      changes.push(`дата: ${fmtLogValue(payment.paidAt)} → ${fmtLogValue(parsed)}`);
    }
    effectivePaidAt = parsed;
  }

  // Коментар — ≤500.
  if (input.note !== undefined) {
    const note = (input.note ?? '').trim().slice(0, 500) || null;
    if (note !== (payment.manualNote ?? null)) {
      data.manualNote = note;
      changes.push(`коментар: ${fmtLogValue(payment.manualNote)} → ${fmtLogValue(note)}`);
    }
  }

  if (changes.length === 0) {
    return NextResponse.json({ ok: true, noChanges: true });
  }

  await prisma.payment.update({ where: { id: paymentId }, data });

  // Перерахунок підписки по актуальних платежах (expiresAt/статус; дохід — агрегат amount).
  // allowRevive:false — правка платежу НЕ воскрешає закриту (EXPIRED/CANCELLED/ARCHIVED) підписку.
  const { newStatus, newExpiresAt } = await applyPaymentActivation({
    subscriptionId: sub.id,
    plan: sub.plan,
    autoRenew: sub.autoRenew,
    prevStatus: sub.status,
    lastPaymentAt: effectivePaidAt,
    allowRevive: false,
  });

  await prisma.yearlyProgramSubscriptionEvent.create({
    data: {
      subscriptionId: sub.id,
      type: 'admin_action',
      message: `Редагування платежу (${actor}): ${changes.join('; ')}`,
      metadata: { editPayment: true, paymentId, actor, changes },
    },
  });

  return NextResponse.json({
    ok: true,
    changes,
    newStatus,
    newExpiresAt: newExpiresAt?.toISOString() ?? null,
  });
}

/// Ручне редагування полів підписки прямо в адмінці. Змінює ТІЛЬКИ дані в нашій БД —
/// НЕ чіпає SendPulse / Telegram / WFP. Приймає лише передані поля, валідує їх, оновлює
/// запис і логує подію admin_action з переліком before→after по кожному зміненому полю.
const EDIT_PLANS = new Set(['YEARLY', 'MONTHLY']);
const EDIT_STATUSES = new Set(['PENDING', 'ACTIVE', 'GRACE', 'EXPIRED', 'CANCELLED']);

function fmtLogValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '∅';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

async function handleEdit(
  sub: NonNullable<SubWithUser>,
  fields: Record<string, unknown>,
  actor: string,
) {
  const data: Record<string, unknown> = {};
  const changes: string[] = [];

  // План
  if ('plan' in fields) {
    const v = fields.plan;
    if (typeof v !== 'string' || !EDIT_PLANS.has(v)) {
      return NextResponse.json({ error: 'Невалідний план (YEARLY|MONTHLY)' }, { status: 400 });
    }
    if (v !== sub.plan) {
      data.plan = v;
      changes.push(`план: ${sub.plan} → ${v}`);
    }
  }

  // autoRenew
  if ('autoRenew' in fields) {
    const v = fields.autoRenew;
    if (typeof v !== 'boolean') {
      return NextResponse.json({ error: 'autoRenew має бути true/false' }, { status: 400 });
    }
    if (v !== sub.autoRenew) {
      data.autoRenew = v;
      changes.push(`autoRenew: ${sub.autoRenew} → ${v}`);
    }
  }

  // Статус
  if ('status' in fields) {
    const v = fields.status;
    if (typeof v !== 'string' || !EDIT_STATUSES.has(v)) {
      return NextResponse.json({ error: 'Невалідний статус' }, { status: 400 });
    }
    if (v !== sub.status) {
      data.status = v;
      changes.push(`статус: ${sub.status} → ${v}`);
    }
  }

  // Дати (ISO або null)
  for (const key of ['startDate', 'expiresAt'] as const) {
    if (!(key in fields)) continue;
    const v = fields[key];
    let next: Date | null;
    if (v === null || v === '') {
      next = null;
    } else if (typeof v === 'string') {
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: `Невалідна дата (${key})` }, { status: 400 });
      }
      next = d;
    } else {
      return NextResponse.json({ error: `Невалідна дата (${key})` }, { status: 400 });
    }
    const cur = sub[key] ?? null;
    if ((cur?.getTime() ?? null) !== (next?.getTime() ?? null)) {
      data[key] = next;
      changes.push(`${key}: ${fmtLogValue(cur)} → ${fmtLogValue(next)}`);
    }
  }

  // Telegram-нік — нормалізуємо до @username
  if ('telegramUsername' in fields) {
    const v = fields.telegramUsername;
    let next: string | null;
    if (v === null || (typeof v === 'string' && v.trim() === '')) {
      next = null;
    } else {
      const parsed = parseTelegramUsername(v);
      if (!parsed.ok) {
        return NextResponse.json({ error: parsed.error ?? 'Невалідний Telegram username' }, { status: 400 });
      }
      next = parsed.normalized;
    }
    if (next !== (sub.telegramUsername ?? null)) {
      data.telegramUsername = next;
      changes.push(`Telegram: ${fmtLogValue(sub.telegramUsername)} → ${fmtLogValue(next)}`);
    }
  }

  // Телефон / Країна — вільний текст
  for (const key of ['phone', 'country'] as const) {
    if (!(key in fields)) continue;
    const v = fields[key];
    let next: string | null;
    if (v === null) {
      next = null;
    } else if (typeof v === 'string') {
      next = v.trim() || null;
    } else {
      return NextResponse.json({ error: `Невалідне значення (${key})` }, { status: 400 });
    }
    if (next !== (sub[key] ?? null)) {
      data[key] = next;
      changes.push(`${key}: ${fmtLogValue(sub[key])} → ${fmtLogValue(next)}`);
    }
  }

  // Поля користувача (User) — ім'я та email. Оновлюємо повʼязаний User-запис, НЕ підписку.
  const userData: Record<string, unknown> = {};

  if ('userName' in fields) {
    const v = fields.userName;
    let next: string | null;
    if (v === null) {
      next = null;
    } else if (typeof v === 'string') {
      next = v.trim() || null;
    } else {
      return NextResponse.json({ error: 'Невалідне ім\'я' }, { status: 400 });
    }
    if (next !== (sub.user?.name ?? null)) {
      userData.name = next;
      changes.push(`ім'я: ${fmtLogValue(sub.user?.name)} → ${fmtLogValue(next)}`);
    }
  }

  if ('userEmail' in fields) {
    const v = fields.userEmail;
    if (typeof v !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) {
      return NextResponse.json({ error: 'Невалідний email' }, { status: 400 });
    }
    const next = v.trim();
    if (next !== (sub.user?.email ?? null)) {
      userData.email = next;
      changes.push(`email: ${fmtLogValue(sub.user?.email)} → ${fmtLogValue(next)}`);
    }
  }

  if (changes.length === 0) {
    return NextResponse.json({ ok: true, noChanges: true });
  }

  // Email унікальний — ловимо колізію окремо, щоб віддати зрозумілу помилку.
  if (Object.keys(userData).length > 0) {
    try {
      await prisma.user.update({ where: { id: sub.userId }, data: userData as Prisma.UserUpdateInput });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return NextResponse.json({ error: 'Користувач з таким email уже існує' }, { status: 409 });
      }
      throw e;
    }
  }

  await prisma.yearlyProgramSubscription.update({
    where: { id: sub.id },
    data: data as Prisma.YearlyProgramSubscriptionUpdateInput,
  });
  await prisma.yearlyProgramSubscriptionEvent.create({
    data: {
      subscriptionId: sub.id,
      type: 'admin_action',
      message: `Ручне редагування (${actor}): ${changes.join('; ')}`,
      metadata: { editedFields: Object.keys(data), changes },
    },
  });

  return NextResponse.json({ ok: true, changes });
}

async function handleDelete(sub: NonNullable<SubWithUser>, actor: string) {
  // Soft-archive: знімаємо WFP-регулярки (інакше autopay-списання продовжаться навіть
  // після архіву = orphan charges), закриваємо доступ у SendPulse, чистимо technical
  // sendpulseStudentId, ставимо статус ARCHIVED. Картка лишається в адмінці як архівний
  // запис; reopen заборонений. Payment-и лишаються нерушеними з лінком на цю підписку.
  const hadAutoRenew = sub.autoRenew;
  const autopay = await removeSubscriptionAutopay(sub.id);

  let sendpulseClosed = false;
  let sendpulseError: string | null = null;

  const courseId = await getYearlySendpulseCourseId(prisma);
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
      sendpulseStudentId: null,
    },
  });

  const wfpSummary = sub.plan === 'MONTHLY'
    ? ` · WFP REMOVE: ${autopay.removed}/${autopay.attempted}${autopay.error ? ` (errors: ${autopay.error.slice(0, 200)})` : ''}`
    : '';
  await prisma.yearlyProgramSubscriptionEvent.create({
    data: {
      subscriptionId: sub.id,
      type: 'admin_action',
      message: `Archived by ${actor}${sendpulseClosed ? ' · SendPulse access closed' : (sendpulseError ? ` · SendPulse: ${sendpulseError}` : '')}${wfpSummary}`,
      metadata: {
        sendpulseClosed,
        sendpulseError,
        wfpRemovedCount: autopay.removed,
        wfpAttemptedCount: autopay.attempted,
        wfpError: autopay.error,
      },
    },
  });

  // Best-effort: вилучаємо з ТГ-каналу у permanent-режимі (ban + revoke invite).
  // Студент не зможе повернутись навіть якщо десь зберіг старий invite-link.
  const tg = await kickSubscriptionFromChannel({
    subscriptionId: sub.id,
    mode: 'permanent',
    triggeredBy: `admin:${actor} · delete`,
  }).catch((e) => ({ ok: false, kicked: false, inviteRevoked: false, skipped: null, error: (e as Error).message }));

  await notifyUserSubscriptionEnded(sub, 'archived', hadAutoRenew, null);

  return NextResponse.json({ ok: true, sendpulseClosed, sendpulseError, autopay, telegram: tg });
}

/// Manual TG-kick без зміни статусу підписки і без змін у SendPulse/WFP.
/// `mode='returnable'`: ban+unban (студент видалений, але може повернутись по invite).
/// `mode='permanent'`: ban+revoke (бан без зняття + invite-link знечинено).
async function handleTelegramKick(
  sub: NonNullable<SubWithUser>,
  actor: string,
  mode: 'returnable' | 'permanent',
) {
  const result = await kickSubscriptionFromChannel({
    subscriptionId: sub.id,
    mode,
    triggeredBy: `admin:${actor} · ${mode === 'permanent' ? 'tg_kick_revoke' : 'tg_kick'}`,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? 'Telegram API error', telegram: result },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true, telegram: result });
}
