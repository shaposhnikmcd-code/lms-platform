import { NextRequest, NextResponse } from 'next/server';
import { Prisma, type Payment, type VisionCertStatus } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { getToken } from 'next-auth/jwt';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { isAdmin, getAdminActor, type AdminActor } from '@/lib/adminAuth';
import { isSuperAdmin } from '@/lib/superAdmin';
import { groupManualPayments, describeSplitParts } from '@/lib/yearlyProgramManualGroups';
import { closeAccessInCourse, lookupStudentIdByEmail, openAccessViaEvent } from '@/lib/sendpulse';
import {
  kickSubscriptionFromChannel,
  generateInviteForSubscription,
  getYearlyProgramTelegramSettings,
} from '@/lib/yearlyProgramTelegram';
import { removeSubscriptionAutopay, recordAutopayRemoveOutcome } from '@/lib/yearlyProgramAutopay';
import { sendYearlyProgramAdminEndedEmail, type AdminEndKind } from '@/lib/yearlyProgramAdminEndedEmail';
import {
  YEARLY_PROGRAM_CONFIG,
  getYearlySendpulseCourseId,
  getYearlyPostAccessMonths,
  RESET_REMINDER_AND_GRACE_FIELDS,
} from '@/lib/yearlyProgramConfig';
import { calculateAccessUntil } from '@/lib/yearlyProgramAccess';
import { getYearlyProgramSettings } from '@/lib/yearlyProgramSettings';
import { parseTelegramUsername } from '@/lib/telegramUsername';
import { applyPaymentActivation } from '@/lib/yearlyProgramActivation';
import { runManualPreLaunchWelcome, type ManualPreLaunchWelcomeResult } from '@/lib/yearlyProgramManualWelcome';
import { runExtraLaunchForSubscription } from '@/lib/yearlyProgramLaunch';
import { syncAutopaySchedule } from '@/lib/yearlyProgramScheduleSync';
import { sumRealPaid } from '@/lib/yearlyProgramPaidTotals';
import { sendYearlyProgramManualPaymentEmail } from '@/lib/yearlyProgramManualPaymentEmail';
import { sendYearlyProgramConvertedToYearlyEmail } from '@/lib/yearlyProgramConvertedToYearlyEmail';

/// Ідентичність MANAGER-а (дзеркало `getAdminActor`, але для ролі MANAGER).
/// Потрібна лише для manager-дозволених дій — зараз це `set_vision_status`.
async function getManagerActor(req: NextRequest): Promise<AdminActor | null> {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as { id?: string; role?: string; name?: string | null; email?: string | null } | undefined;
  if (sessionUser?.role === 'MANAGER') {
    return { id: sessionUser.id, name: sessionUser.name ?? null, email: sessionUser.email ?? null };
  }
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (token?.role === 'MANAGER') {
    return {
      id: token.id as string | undefined,
      name: (token.name as string | null | undefined) ?? null,
      email: (token.email as string | null | undefined) ?? null,
    };
  }
  return null;
}

/// Людські підписи станів Vision — використовуються і в тексті події, і у відповіді UI.
const VISION_STATUS_LABELS: Record<VisionCertStatus, string> = {
  NOT_PAID: 'не оплачено',
  PAID: 'оплачено',
  ISSUED: 'видано',
};

/// Admin actions над конкретною підпискою Річної програми.
/// Body: { action: "cancel" | "close_access" | "reopen_access" | "extend" | "carryover" | "delete",
///         daysToAdd?: number, reason?: string, note?: string, sendWelcome?: boolean }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await isAdmin(req);
  // `getAdminActor` розпізнає лише ADMIN. Vision-статус має право міняти й менеджер,
  // тож для нього ідентичність беремо окремим хелпером (сесія або JWT, роль MANAGER).
  const actor = admin ? await getAdminActor(req) : await getManagerActor(req);
  if (!actor) {
    return NextResponse.json({ error: 'Немає доступу' }, { status: 403 });
  }
  const actorLabel = actor.email ?? actor.name ?? (admin ? 'admin' : 'manager');
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
    visionStatus?: string;
    split?: boolean;
    /// Пропустити анти-дубль-перевірку ручної оплати (менеджер підтвердив «Внести все одно»).
    force?: boolean;
    /// Пакетні дії над платежами (виключення з доступу / видалення). Для розбитого
    /// внесення сюди йдуть id усіх часток одразу.
    paymentIds?: string[];
    excluded?: boolean;
  };

  // Менеджеру відкриті дві дії: Vision-статус (він веде видачу цих сертифікатів) і нотатка
  // про студента (менеджер веде повсякденне спілкування, нотатка — його робочий інструмент).
  // Решта дій над підпискою (скасування, доступ, платежі, видалення) лишається admin-only.
  if (!admin && body.action !== 'set_vision_status' && body.action !== 'set_note') {
    return NextResponse.json({ error: 'Немає доступу' }, { status: 403 });
  }

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
        split: body.split,
        force: body.force,
      }, actorLabel);
    case 'convert_to_yearly':
      return handleConvertToYearly(sub, actorLabel);
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
    case 'set_payment_access':
      return handleSetPaymentAccess(sub, {
        paymentIds: body.paymentIds,
        excluded: body.excluded,
        note: body.note,
      }, actorLabel);
    case 'delete_payment':
      // Видалення платежу необоротне і зсуває доступ — тільки super-admin (env-allowlist),
      // повсякденна дія для менеджера — «Виключити з доступу».
      if (!(await isSuperAdmin(req))) {
        return NextResponse.json(
          { error: 'Видаляти платежі може лише super-admin. Скористайтесь «Виключити з доступу».' },
          { status: 403 },
        );
      }
      return handleDeletePayments(sub, { paymentIds: body.paymentIds }, actorLabel);
    case 'delete':
      return handleDelete(sub, actorLabel);
    case 'tg_kick':
      return handleTelegramKick(sub, actorLabel, 'returnable');
    case 'tg_kick_revoke':
      return handleTelegramKick(sub, actorLabel, 'permanent');
    case 'sync_wfp_schedule':
      return handleSyncWfpSchedule(sub, actorLabel);
    case 'set_vision_status':
      return handleSetVisionStatus(sub, body.visionStatus, actorLabel);
    case 'set_note':
      return handleSetNote(sub, body.note, actorLabel);
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

/// Ручний статус платного сертифіката «Vision» (крапка біля студента в таблиці).
/// Дозволено ADMIN і MANAGER. Ніякої побічної автоматики: тільки поле + подія в журналі,
/// щоб потім було видно, хто і коли перевів у «оплачено»/«видано».
async function handleSetVisionStatus(
  sub: NonNullable<SubWithUser>,
  status: unknown,
  actor: string,
) {
  if (status !== 'NOT_PAID' && status !== 'PAID' && status !== 'ISSUED') {
    return NextResponse.json({ error: 'Невідомий статус Vision' }, { status: 400 });
  }
  const previous = sub.visionCertStatus;
  if (previous === status) {
    return NextResponse.json({ ok: true, visionCertStatus: status, unchanged: true });
  }

  await prisma.yearlyProgramSubscription.update({
    where: { id: sub.id },
    data: { visionCertStatus: status },
  });
  await prisma.yearlyProgramSubscriptionEvent.create({
    data: {
      subscriptionId: sub.id,
      type: 'admin_action',
      message: `Vision: ${VISION_STATUS_LABELS[status]} by ${actor}`,
      metadata: { action: 'set_vision_status', from: previous, to: status, actor },
    },
  });

  return NextResponse.json({
    ok: true,
    visionCertStatus: status,
    message: `Сертифікат Vision: ${VISION_STATUS_LABELS[status]}`,
  });
}

const ADMIN_NOTE_MAX_LENGTH = 2000;

/// Нотатка про студента (User.adminNote). Дозволено ADMIN і MANAGER — менеджер веде
/// повсякденне спілкування зі студентами. Живе на User, а не на підписці: перенесені
/// студенти щороку отримують нову підписку в новому наборі, нотатка має пережити
/// перенесення. Порожній рядок = очистити (null). Подія в журналі зберігає previous/next
/// (обрізані до 300 символів) — коротка історія змін без окремої таблиці.
async function handleSetNote(
  sub: NonNullable<SubWithUser>,
  note: unknown,
  actor: string,
) {
  if (typeof note !== 'string') {
    return NextResponse.json({ error: 'Некоректна нотатка' }, { status: 400 });
  }
  const trimmed = note.trim();
  if (trimmed.length > ADMIN_NOTE_MAX_LENGTH) {
    return NextResponse.json(
      { error: `Нотатка занадто довга (макс. ${ADMIN_NOTE_MAX_LENGTH} символів)` },
      { status: 400 },
    );
  }
  const nextNote = trimmed.length > 0 ? trimmed : null;

  const currentUser = await prisma.user.findUnique({
    where: { id: sub.userId },
    select: { adminNote: true },
  });
  const previousNote = currentUser?.adminNote ?? null;
  const now = new Date();

  await prisma.user.update({
    where: { id: sub.userId },
    data: {
      adminNote: nextNote,
      adminNoteUpdatedAt: nextNote ? now : null,
      adminNoteUpdatedBy: nextNote ? actor : null,
    },
  });
  await prisma.yearlyProgramSubscriptionEvent.create({
    data: {
      subscriptionId: sub.id,
      type: 'admin_action',
      message: `Note updated by ${actor}`,
      metadata: {
        previous: previousNote ? previousNote.slice(0, 300) : null,
        next: nextNote ? nextNote.slice(0, 300) : null,
      },
    },
  });

  return NextResponse.json({
    ok: true,
    adminNote: nextNote,
    adminNoteUpdatedAt: nextNote ? now.toISOString() : null,
    adminNoteUpdatedBy: nextNote ? actor : null,
  });
}

/// Ручна синхронізація WFP-графіка автосписань з датами cohort-у (кнопка в панелі Дії).
/// Уся логіка і запобіжники — у syncAutopaySchedule; тут тільки виклик + людська відповідь.
async function handleSyncWfpSchedule(sub: NonNullable<SubWithUser>, actor: string) {
  if (sub.plan !== 'MONTHLY') {
    return NextResponse.json({
      error: 'Синхронізація графіка доступна тільки для місячних підписок.',
    }, { status: 400 });
  }
  // Прапорець `autoRenew` може брехати (inconclusive-probe у callback-у, ручна правка,
  // недокручений REMOVE), а саме тоді звірка потрібна найбільше — щоб побачити живе
  // правило у WFP. Тому для autoRenew=false пускаємо, але тільки в READ-ONLY режимі:
  // STATUS-probe без CHANGE. Міняти графік підписці, яка формально без автоплатежу,
  // ми не маємо права.
  const r = await syncAutopaySchedule(sub.id, { apply: sub.autoRenew, source: `admin:${actor}` });
  const fmtD = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '—');
  const message = {
    synced: `Графік оновлено: наступне списання ${fmtD(r.nextChargeAt)}`,
    checked: `Графік уже коректний: наступне списання ${fmtD(r.nextChargeAt)}`,
    no_rule: 'У WFP немає живої регулярки для цієї підписки (разова оплата або правило знято)',
    rule_inactive: `Правило у WFP є, але воно не активне (${r.reason ?? 'статус невідомий'}) — списань не буде. Відновіть або зніміть його в кабінеті WayForPay.`,
    skipped: `Пропущено: ${r.reason ?? ''}`,
    error: `Помилка: ${r.reason ?? 'невідома'}`,
  }[r.outcome];
  return NextResponse.json({
    ok: r.outcome !== 'error',
    outcome: r.outcome,
    message,
    // Призупинене правило — не «все добре»: дублюємо у `warning`, бо тост показує саме
    // його, а зелене «Дію виконано» приховало б те, що списань не буде.
    ...(r.outcome === 'rule_inactive' ? { warning: message } : {}),
    nextChargeAt: r.nextChargeAt?.toISOString() ?? null,
  }, { status: r.outcome === 'error' ? 500 : 200 });
}

async function handleCancel(sub: NonNullable<SubWithUser>, actor: string, reason?: string) {
  // Вимогу `autoRenew=true` свідомо прибрано: саме коли прапорець збитий (inconclusive
  // probe у callback-у, ручна правка, недокручений REMOVE), у WFP і може лишатись жива
  // регулярка — а стара перевірка не давала її зняти. REMOVE по всіх WFP-ref-ах
  // безпечний: якщо правила немає, WFP віддає 4102, і ми його ігноруємо.
  if (sub.plan !== 'MONTHLY') {
    return NextResponse.json({
      error: 'Скасування автосписання доступне тільки для місячних підписок. Для дострокового закриття доступу використай "Закрити доступ у SendPulse" або "Деактивувати та Вилучити студента з програми".',
    }, { status: 400 });
  }
  const hadAutoRenew = sub.autoRenew;
  const autopay = await removeSubscriptionAutopay(sub.id);
  const { removed: wfpRemovedCount, attempted: wfpAttemptedCount, error: wfpError } = autopay;
  await recordAutopayRemoveOutcome({ subscriptionId: sub.id, result: autopay, source: `admin:${actor} · cancel` });

  await prisma.yearlyProgramSubscription.update({
    where: { id: sub.id },
    data: {
      status: 'CANCELLED',
      // Регулярку у WFP уже знято — гасимо і прапор у себе, інакше підписка виглядає
      // як «з автоплатежем» і UI/крон-звірки продовжують чекати списань.
      autoRenew: false,
      // Кеш графіка більше не має сенсу — списань не буде. `wfpRegularRef` чистимо
      // ТІЛЬКИ при успішному REMOVE: якщо він провалився, ref лишається маркером
      // «правило ще живе» — по ньому ретрай-крок нічного cron-а знайде цю підписку.
      wfpNextChargeAt: null,
      ...(wfpError ? {} : { wfpRegularRef: null }),
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

  // Best-effort вилучення з ТГ-каналу у permanent-режимі (ban + revoke invite) — як у
  // «Деактивувати та Вилучити». Скасована підписка не має лишати людину в каналі, а її
  // invite-link — робочим. Помилка TG не блокує скасування: статус уже CANCELLED у БД.
  const tg = await kickSubscriptionFromChannel({
    subscriptionId: sub.id,
    mode: 'permanent',
    triggeredBy: `admin:${actor} · cancel`,
  }).catch((e) => ({ ok: false, kicked: false, inviteRevoked: false, skipped: null, error: (e as Error).message }));
  if (!tg.ok) {
    // Сам kick пише подію лише коли дійшов до Telegram API; ранні виходи й throw — ні.
    await prisma.yearlyProgramSubscriptionEvent.create({
      data: {
        subscriptionId: sub.id,
        type: 'admin_action',
        message: `TG kick (cancel) не виконано: ${(tg.error ?? tg.skipped ?? 'unknown').slice(0, 200)}`,
        metadata: { cancelKick: true, ...tg },
      },
    });
  }

  await notifyUserSubscriptionEnded(sub, 'cancelled', hadAutoRenew, sub.expiresAt ?? null);

  return NextResponse.json({
    ok: true,
    wfpRemovedCount,
    wfpAttemptedCount,
    wfpError,
    telegram: tg,
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
  await recordAutopayRemoveOutcome({ subscriptionId: sub.id, result: autopay, source: `admin:${actor} · close_access` });

  const now = new Date();
  await prisma.yearlyProgramSubscription.update({
    where: { id: sub.id },
    data: {
      status: 'EXPIRED',
      sendpulseAccessClosedAt: now,
      // Доступ закритий → списань більше бути не має. `wfpRegularRef` лишаємо, якщо
      // REMOVE провалився: це маркер для нічного ретраю.
      autoRenew: false,
      wfpNextChargeAt: null,
      ...(autopay.error ? {} : { wfpRegularRef: null }),
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

  const now = new Date();

  // Дати рахуємо ДО виклику SendPulse — якщо доступ уже вичерпаний за графіком,
  // дію не виконуємо взагалі (жодного event-у в SendPulse і жодних змін у БД).
  //
  // expiresAt рахуємо ТИМ САМИМ правилом, що й активація платежу (cohort + PAID-платежі),
  // а не «now + буфер» — інакше reopen видавав доступ поза межами програми
  // (напр. YEARLY отримував now+365д замість cohort.endDate + пост-доступ).
  const fresh = await prisma.yearlyProgramSubscription.findUnique({
    where: { id: sub.id },
    include: {
      cohort: { select: { startDate: true, endDate: true } },
      payments: { select: { amount: true, status: true, paidAt: true, createdAt: true, excludedFromAccess: true } },
    },
  });
  const postAccessMonths = await getYearlyPostAccessMonths(prisma);
  const cohortExpiresAt = fresh?.cohort
    ? calculateAccessUntil({
      plan: sub.plan,
      autoRenew: sub.autoRenew,
      cohort: { startDate: fresh.cohort.startDate, endDate: fresh.cohort.endDate },
      payments: fresh.payments,
      postAccessMonths,
    })
    : null;

  // Ніколи не вкорочуємо доступ: беремо ПІЗНІШУ з двох дат — поточної (може містити
  // ручне продовження) і розрахованої за графіком набору.
  const currentExpiresAt = sub.expiresAt ?? null;
  let newExpiresAt: Date | null = null;
  let source: 'cohort' | 'current' | 'fallback' = 'fallback';
  if (cohortExpiresAt && currentExpiresAt) {
    newExpiresAt = cohortExpiresAt > currentExpiresAt ? cohortExpiresAt : currentExpiresAt;
    source = cohortExpiresAt > currentExpiresAt ? 'cohort' : 'current';
  } else if (cohortExpiresAt) {
    newExpiresAt = cohortExpiresAt;
    source = 'cohort';
  } else if (currentExpiresAt) {
    newExpiresAt = currentExpiresAt;
    source = 'current';
  }

  // Legacy-підписки (без cohort-у або без жодного PAID-платежу) — стара поведінка:
  // майбутній expiresAt лишаємо, інакше даємо буфер за планом.
  if (!cohortExpiresAt && (!newExpiresAt || newExpiresAt <= now)) {
    const bufferDays = sub.plan === 'YEARLY'
      ? YEARLY_PROGRAM_CONFIG.yearlyDurationDays
      : YEARLY_PROGRAM_CONFIG.monthlyDurationDays;
    newExpiresAt = new Date(now.getTime() + bufferDays * 24 * 60 * 60 * 1000);
    source = 'fallback';
  }

  // Доступ уже вичерпаний за графіком набору. Відкрити його зараз = поставити дату в
  // минулому: підписка стала б ACTIVE, а нічний cron за добу загнав би її в GRACE і
  // надіслав «оплатіть». Тому дію не виконуємо і пояснюємо, що робити.
  if (!newExpiresAt || newExpiresAt <= now) {
    const paidCount = (fresh?.payments ?? []).filter((p) => p.status === 'PAID').length;
    const totalMonths = YEARLY_PROGRAM_CONFIG.totalMonthlyPayments;
    const detail = sub.plan === 'MONTHLY'
      ? `сплачено ${paidCount} з ${totalMonths} місяців`
      : `набір завершився ${newExpiresAt?.toISOString().slice(0, 10) ?? '—'}`;
    return NextResponse.json({
      error: `За графіком набору доступ уже вичерпано (${detail}). `
        + 'Зафіксуйте наступний платіж («Внести оплату») або продовжте доступ вручну («Продовжити доступ») — і тоді відкривайте знову.',
      computedExpiresAt: newExpiresAt?.toISOString() ?? null,
      paidCount,
      totalMonths,
    }, { status: 409 });
  }

  // Правило cohort-у може дати дату раніше за поточну (часткова оплата при ручному
  // продовженні) — доступ ми не вкоротили, але менеджер має розуміти, що за графіком
  // місяці ще не викуплені.
  const warnings: string[] = [];
  if (cohortExpiresAt && currentExpiresAt && cohortExpiresAt < currentExpiresAt) {
    warnings.push('За графіком набору доступ коротший за поточний — залишили довшу (поточну) дату. Перевірте, чи всі місяці оплачені.');
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

  await prisma.yearlyProgramSubscription.update({
    where: { id: sub.id },
    data: {
      status: 'ACTIVE',
      sendpulseAccessOpenedAt: now,
      sendpulseAccessClosedAt: null,
      expiresAt: newExpiresAt,
    },
  });
  await prisma.yearlyProgramSubscriptionEvent.create({
    data: {
      subscriptionId: sub.id,
      type: 'reactivated',
      message: `Reopened by ${actor} · expiresAt=${newExpiresAt.toISOString().slice(0, 10)} (${source})`,
      metadata: { expiresAtSource: source, expiresAt: newExpiresAt.toISOString() },
    },
  });

  // Повернення в Telegram. «Скасувати» робить permanent-кік (ban + revoke invite), тож
  // без цього кроку студент лишався б забаненим у каналі й без робочого посилання.
  // `generateInviteForSubscription` сам знімає бан (unban з only_if_banned для
  // telegramTgUserId ЦІЄЇ підписки) перед створенням нового лінка. Best-effort:
  // помилка Telegram не валить reopen — доступ у SendPulse і статус уже виставлені.
  let telegram: { inviteRegenerated: boolean; error?: string } | null = null;
  const tgSettings = await getYearlyProgramTelegramSettings().catch(() => null);
  if (tgSettings?.autoAdd && tgSettings.chatId && sub.telegramUsername) {
    const tgRes = await generateInviteForSubscription({
      subscriptionId: sub.id,
      force: true,
      triggeredBy: `admin:${actor} · reopen_access`,
    }).catch((e) => ({ ok: false, inviteLink: null, error: (e as Error).message, subscriptionId: sub.id }));
    telegram = { inviteRegenerated: tgRes.ok, ...(tgRes.error ? { error: tgRes.error } : {}) };
    if (tgRes.ok) {
      // Лінк лежить у підписці, але сам до студента не потрапить — його треба надіслати.
      warnings.push('новий invite створено — надішліть студенту welcome-лист кнопкою 📨');
    } else {
      // Успішну генерацію лог пише сам helper; провал — фіксуємо тут, щоб менеджер
      // бачив у стрічці підписки, що людину треба повернути в канал руками.
      await prisma.yearlyProgramSubscriptionEvent.create({
        data: {
          subscriptionId: sub.id,
          type: 'admin_action',
          message: `TG invite при reopen не згенеровано: ${(tgRes.error ?? 'unknown').slice(0, 200)}`,
          metadata: { reopenTelegram: true, error: tgRes.error ?? null, actor },
        },
      });
      warnings.push('Не вдалось повернути студента в Telegram-канал — перевірте вручну.');
    }
  } else if (tgSettings?.chatId) {
    // Канал у роботі, але автоматично повернути не можемо (немає @username або
    // вимкнено autoAdd). Якщо каналу немає взагалі — мовчимо, це не про цей проєкт.
    warnings.push('студент міг бути вилучений з Telegram-каналу — перевірте вручну');
  }

  return NextResponse.json({
    ok: true,
    newExpiresAt: newExpiresAt.toISOString(),
    expiresAtSource: source,
    telegram,
    ...(warnings.length > 0 ? { warning: warnings.join(' · ') } : {}),
  });
}

async function handleExtend(sub: NonNullable<SubWithUser>, daysToAdd: number, actor: string) {
  if (!Number.isFinite(daysToAdd) || daysToAdd <= 0 || daysToAdd > 3650) {
    return NextResponse.json({ error: 'Invalid daysToAdd (1..3650)' }, { status: 400 });
  }
  // Guard як у решти дій: архівна підписка не воскресає продовженням доступу.
  if (sub.status === 'ARCHIVED') {
    return NextResponse.json(
      { error: 'Підписка заархівована — продовжити доступ не можна. Створіть нову.' },
      { status: 400 },
    );
  }
  // PENDING без жодної оплати — «продовження» зробило б з неоплаченої підписки ACTIVE.
  // Спершу треба зафіксувати оплату («Внести оплату» / «Перенесення з минулого року»).
  if (sub.status === 'PENDING') {
    const paidCount = await prisma.payment.count({
      where: { yearlyProgramSubscriptionId: sub.id, status: 'PAID' },
    });
    if (paidCount === 0) {
      return NextResponse.json(
        {
          error: 'Підписка ще не оплачена — продовження доступу зробило б її активною без оплати. '
            + 'Спершу зафіксуйте оплату («Внести оплату») або перенесення з минулого року.',
        },
        { status: 400 },
      );
    }
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
      // Продовження = новий цикл життя. Без скидання прапорців підписка, що вже
      // пройшла grace, поверталась в ACTIVE зі «спожитими» reminderSent*: наступне
      // закінчення доступу проходило мовчки (жодного листа) і гасло без попередження.
      // Заразом чистимо graceStartedAt/gracePeriodEndsAt — інакше mid/last рахувались би
      // від старого, уже неактуального grace-вікна. Симетрично до конверсії на Річну.
      ...RESET_REMINDER_AND_GRACE_FIELDS,
    },
  });
  await prisma.yearlyProgramSubscriptionEvent.create({
    data: {
      subscriptionId: sub.id,
      type: 'admin_action',
      message: `Extended +${daysToAdd}d by ${actor} → ${newExpires.toISOString().slice(0, 10)}`,
    },
  });

  // Дати в нашій БД продовжені, але доступ у SendPulse лишається ЗАКРИТИМ: «Продовжити»
  // не викликає SP API (це лише зсув expiresAt). Для підписки, якій доступ уже закривали
  // (cron після grace або менеджер вручну), мовчазне «Дію виконано» читалось як «студент
  // знову вчиться» — а він і далі не міг зайти в курс. Тому повертаємо застереження.
  const warnings: string[] = [];
  if (sub.sendpulseAccessClosedAt) {
    warnings.push(
      `доступ у SendPulse закритий ${sub.sendpulseAccessClosedAt.toISOString().slice(0, 10)} — `
      + 'натисніть «Відкрити знову», інакше студент у курс не потрапить',
    );
  }

  return NextResponse.json({
    ok: true,
    newExpiresAt: newExpires.toISOString(),
    ...(warnings.length > 0 ? { warning: warnings.join(' · ') } : {}),
  });
}

/// Допустимий формат method для РУЧНОГО платежу. Без підкреслень — вони службовий
/// роздільник у orderReference часток розбивки (див. SPLIT_REF_RE у lib/yearlyProgramManualGroups.ts).
/// Наявні способи (cash / transfer / direct / fop / card / carryover) проходять.
const MANUAL_METHOD_RE = /^[a-z0-9-]{1,40}$/;

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
/// Скільки рядків максимум може дати авто-розбивка. 24 з запасом перекриває будь-який
/// реальний випадок (програма — 9 місячних платежів), але не дає одним запитом залити
/// сотні Payment-ів, якщо у налаштуваннях опиниться мізерна місячна ціна.
const MAX_SPLIT_PARTS = 24;

/// Розбиває внесену суму на місячні платежі: N рядків по `monthlyPrice`, а залишок
/// ДОЛИВАЄТЬСЯ в останній рядок (5000 при ціні 2200 → [2200, 2800], а не [2200,2200,600]).
/// Потрібно тому, що графік доступу рахує КІЛЬКІСТЬ PAID-платежів, а не суму
/// (calculateAccessUntil) — одна «жирна» оплата закрила б лише один місяць.
///
/// Чому без окремого рядка-залишку:
///   • рядок на 600 ₴ давав ПОВНИЙ місяць доступу нарівні з повноцінним внеском;
///   • залишок у 1-2 ₴ ще й губився порогом відсіювання тестових платежів.
/// Долитий останній рядок зберігає і суму (дохід), і чесну кількість місяців.
function splitManualAmount(amount: number, monthlyPrice: number): number[] {
  const full = Math.floor(amount / monthlyPrice);
  // Сума менша за місячну ціну — ділити нема чого, це один платіж «як є».
  if (full < 1) return [amount];
  const rest = amount - full * monthlyPrice;
  const parts = Array.from({ length: full }, () => monthlyPrice);
  if (rest > 0) parts[parts.length - 1] = monthlyPrice + rest;
  return parts;
}

async function handleManualPayment(
  sub: NonNullable<SubWithUser>,
  input: { amount?: number; method?: string; note?: string; paidAt?: string; split?: boolean; force?: boolean },
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
  // Підкреслення заборонені НЕ з естетики: `manual-{method}_{ts}_{subId}_{N}` — це ключ,
  // за яким частки авто-розбивки збираються назад в одне внесення (parseSplitRef у
  // lib/yearlyProgramManualGroups.ts). Method із `_` розриває розбір і внесення
  // розсипається в списках на непов'язані рядки-«дублі».
  if (!MANUAL_METHOD_RE.test(method)) {
    return NextResponse.json({
      error: 'Спосіб оплати може містити лише малі латинські літери, цифри та дефіс '
        + '(напр. cash, transfer, bank-transfer). Підкреслення ламає групування часток внесення.',
      // 400, а не 409: модалка «Внести оплату» трактує 409 як «схоже на дубль платежу» і
      // пропонує підтвердити повторне внесення — для невалідного формату це безглуздо.
    }, { status: 400 });
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

  // Авто-розбивка великої суми на місячні платежі. Ціни — з налаштувань (не хардкод):
  // сервер тут єдине джерело правди, клієнт лише вмикає/вимикає прапорець `split`.
  const { monthlyPrice, yearlyPrice } = await getYearlyProgramSettings(prisma);
  const canSplit = sub.plan === 'MONTHLY' && monthlyPrice > 0 && amount >= 2 * monthlyPrice;
  const doSplit = canSplit && input.split === true;
  const parts = doSplit ? splitManualAmount(amount, monthlyPrice) : [amount];
  if (parts.length > MAX_SPLIT_PARTS) {
    return NextResponse.json({
      error: `Розбивка дала б ${parts.length} платежів (максимум ${MAX_SPLIT_PARTS}). `
        + 'Перевірте суму та місячну ціну в налаштуваннях програми.',
    }, { status: 400 });
  }

  // Сума на кілька місяців БЕЗ розбивки все одно зараховується як ОДИН місячний слот
  // (calculateAccessUntil рахує кількість PAID-платежів, не суму). Не блокуємо —
  // менеджер міг свідомо зняти галочку, — але віддаємо попередження для UI.
  const warning = canSplit && !doSplit
    ? 'сума схожа на оплату кількох місяців — буде зараховано як 1 місяць'
    : undefined;

  // Анти-дубль. Дублем вважаємо ВНЕСЕННЯ з тим самим ключем: підписка + спосіб + КИЇВСЬКИЙ
  // ДЕНЬ ОПЛАТИ + повна сума внесення. Порівнюємо саме повну суму внесення, а не суму рядка:
  // розбите внесення 12 800 ₴ лежить у БД як 5 часток, і порівняння по частці ловило б хибні
  // збіги (2 200 ₴ = звичайний місячний платіж). День рахуємо в київському календарі
  // (менеджер вводить свій час): оплата о 01:30 за Києвом — це ще UTC-«вчора», і в
  // UTC-порівнянні дубль проскакував.
  //
  // Ключ — ТІЛЬКИ день оплати, без вікна по `createdAt`: задекларований кейс — «внесла
  // вчора о 18:00, повторила сьогодні о 19:05» (25 год) — колишнє 24-годинне вікно по
  // моменту внесення його не ловило. `createdAt >= now - 30 днів` лишається лише як межа
  // вибірки, щоб не сканувати всю історію підписки.
  //
  // Це не заборона, а підтвердження: легітимний повтор у той самий день з тією самою сумою
  // теж буває — менеджер повторює запит із `force: true` («Внести все одно»), і факт
  // свідомого підтвердження лягає в подію.
  const DUPLICATE_SCAN_MS = 30 * 24 * 60 * 60 * 1000;
  const kyivDay = (d: Date) => d.toLocaleDateString('uk-UA', { timeZone: 'Europe/Kyiv' });
  const paidAtKyivDay = kyivDay(paidAt);
  const forced = input.force === true;
  if (!forced) {
    // ±1 доба навколо paidAt покриває будь-який зсув київського дня відносно UTC;
    // точний збіг дня перевіряємо в JS.
    const recent = await prisma.payment.findMany({
      where: {
        yearlyProgramSubscriptionId: sub.id,
        status: 'PAID',
        manualMethod: method,
        paidAt: {
          gte: new Date(paidAt.getTime() - 24 * 60 * 60 * 1000),
          lte: new Date(paidAt.getTime() + 24 * 60 * 60 * 1000),
        },
        createdAt: { gte: new Date(Date.now() - DUPLICATE_SCAN_MS) },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, orderReference: true, amount: true, createdAt: true, paidAt: true },
    });
    const sameDay = recent.filter((p) => p.paidAt && kyivDay(p.paidAt) === paidAtKyivDay);
    // Частки однієї розбивки збираємо назад у внесення — і порівнюємо суму внесення.
    const duplicateGroup = groupManualPayments(sameDay).find((g) => g.total === amount);
    if (duplicateGroup) {
      const enteredAt = duplicateGroup.head.createdAt.toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' });
      const composition = duplicateGroup.isSplit
        ? ` (розбито на ${duplicateGroup.parts.length}: ${describeSplitParts(duplicateGroup.amounts)})`
        : '';
      return NextResponse.json({
        error: `Схоже на дубль: внесення ${amount}₴ (${MANUAL_METHOD_LABELS[method] ?? method}, `
          + `дата оплати ${paidAtKyivDay}) вже зафіксовано ${enteredAt}${composition}, `
          + `посилання ${duplicateGroup.head.orderReference}. `
          + 'Якщо це справді ще одна оплата — натисніть «Внести все одно».',
        duplicateOf: duplicateGroup.head.orderReference,
        duplicate: {
          orderReference: duplicateGroup.head.orderReference,
          amount: duplicateGroup.total,
          parts: duplicateGroup.amounts,
          createdAt: duplicateGroup.head.createdAt.toISOString(),
          paidAt: duplicateGroup.head.paidAt?.toISOString() ?? null,
        },
        canForce: true,
      }, { status: 409 });
    }
  }

  // orderReference має бути унікальним — timestamp + хвіст id підписки; при розбивці
  // кожен рядок отримує ще й свій індекс.
  const orderBase = `manual-${method}_${Date.now()}_${sub.id.slice(-6)}`;
  const orderReferences = parts.map((_, i) => (parts.length > 1 ? `${orderBase}_${i + 1}` : orderBase));

  // Розбивка має бути атомарною: половина записаних рядків = зіпсований графік доступу.
  await prisma.$transaction(
    parts.map((partAmount, i) =>
      prisma.payment.create({
        data: {
          userId: sub.userId,
          orderReference: orderReferences[i]!,
          amount: partAmount,
          currency: 'UAH',
          status: 'PAID',
          paidAt,
          yearlyProgramSubscriptionId: sub.id,
          manualMethod: method,
          manualNote: note,
          manualEnteredBy: actor,
        },
      }),
    ),
  );

  // Це перша оплата підписки? (визначає, чи слати pre-launch welcome). Рядки вже створені,
  // тож перша оплата = у підписці рівно стільки PAID, скільки ми щойно записали.
  const paidCount = await prisma.payment.count({
    where: { yearlyProgramSubscriptionId: sub.id, status: 'PAID' },
  });
  const wasFirstPayment = paidCount === parts.length;

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

  // Готівка закрила місяці, за які WFP ще збирається списати з картки. Без негайного
  // зсуву графіка людину списують за вже оплачений період, а звірка виправить це лише
  // нічним проходом — вікно у ~добу. Best-effort: помилка WFP не валить зафіксовану оплату
  // (сам syncAutopaySchedule пише подію в журнал підписки).
  let scheduleSync: Awaited<ReturnType<typeof syncAutopaySchedule>> | null = null;
  if (sub.plan === 'MONTHLY' && sub.autoRenew) {
    scheduleSync = await syncAutopaySchedule(sub.id, {
      apply: true,
      source: `admin:${actor} · manual_payment`,
    }).catch((e) => ({
      outcome: 'error' as const,
      reason: (e as Error).message.slice(0, 200),
      ruleRef: null,
      nextChargeAt: null,
      desiredNextAt: null,
      changed: false,
    }));
  }

  const methodLabel = MANUAL_METHOD_LABELS[method] ?? method;
  const splitSummary = parts.length > 1
    ? ` · розбито на ${parts.length} платежів (${parts.join('+')})`
    : '';
  await prisma.yearlyProgramSubscriptionEvent.create({
    data: {
      subscriptionId: sub.id,
      type: 'admin_action',
      message: `Ручна оплата ${amount}₴ (${methodLabel}) by ${actor}${note ? ` — ${note}` : ''}${splitSummary}${forced ? ' · ⚠️ внесено попри попередження про дубль' : ''} · expiresAt=${newExpiresAt?.toISOString().slice(0, 10) ?? 'null'}`,
      metadata: {
        manualPayment: true, amount, method, note, paidAt: paidAt.toISOString(),
        orderReference: orderReferences[0], orderReferences, parts, actor,
        ...(forced ? { forcedDuplicate: true } : {}),
        ...(warning ? { warning } : {}),
      },
    },
  });

  // Квитанція студенту: ОДИН лист на всю внесену суму, навіть якщо її розбито на N рядків.
  // Помилка листа не валить оплату — платіж уже в БД; факт фіксуємо подією.
  let receiptEmail: { sent: boolean; error?: string } | null = null;
  if (sub.user?.email) {
    const allPayments = await prisma.payment.findMany({
      where: { yearlyProgramSubscriptionId: sub.id },
      select: { amount: true, status: true },
    });
    const totalPaid = sumRealPaid(allPayments);
    const remaining = sub.plan === 'YEARLY' ? 0 : Math.max(0, yearlyPrice - totalPaid);
    const res = await sendYearlyProgramManualPaymentEmail({
      to: sub.user.email,
      name: sub.user.name ?? null,
      amount,
      methodLabel,
      totalPaid,
      remaining,
      expiresAt: newExpiresAt,
    }).catch((e) => ({ ok: false, error: (e as Error).message }));
    receiptEmail = { sent: res.ok, ...(res.error ? { error: res.error } : {}) };
    await prisma.yearlyProgramSubscriptionEvent.create({
      data: {
        subscriptionId: sub.id,
        type: 'admin_action',
        message: res.ok
          ? `Квитанція про ручну оплату ${amount}₴ надіслана на ${sub.user.email}`
          : `Квитанція про ручну оплату НЕ надіслана: ${(res.error ?? 'unknown').slice(0, 120)}`,
        metadata: { emailKind: 'manual-payment-received', ok: res.ok, error: res.error ?? null, amount },
      },
    });
  }

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
    paymentId: orderReferences[0],
    orderReferences,
    splitParts: parts.length > 1 ? parts : null,
    newStatus,
    newExpiresAt: newExpiresAt?.toISOString() ?? null,
    cohortLaunched,
    extraLaunch,
    welcome,
    receiptEmail,
    scheduleSync,
    ...(warning ? { warning } : {}),
  });
}

/// «⬆️ Перевести на Річну» — клієнт доплатив повну вартість частинами (готівка/переказ),
/// і місячна підписка стає річною. Що робимо:
///   а) знімаємо WFP-регулярку БЕЗУМОВНО; якщо жодну не зняли і WFP віддав помилку —
///      конверсію перериваємо 409 (жива регулярка на YEARLY-плані = списання в нікуди);
///   б) plan=YEARLY, autoRenew=false, чистимо кеш графіка і `wfpRegularRef`;
///   в) статус → ACTIVE + скидання прапорців нагадувань/grace (конверсія з GRACE інакше
///      лишала GRACE, і нічний cron закривав доступ щойно оплаченому клієнту);
///   г) перераховуємо expiresAt за правилом YEARLY (cohort.endDate + пост-доступ);
///   д) подія `plan_converted` з сумами;
///   е) лист студенту (помилка листа дію не валить — повертаємо warning).
/// Зміна плану — атомарний `updateMany where plan='MONTHLY'` (guard від подвійного кліку).
/// Недоплату НЕ блокуємо: рішення за менеджером, UI показує залишок у конфірмі.
async function handleConvertToYearly(sub: NonNullable<SubWithUser>, actor: string) {
  if (sub.plan !== 'MONTHLY') {
    return NextResponse.json({ error: 'Підписка вже на Річному плані.' }, { status: 400 });
  }
  if (sub.status === 'ARCHIVED') {
    return NextResponse.json(
      { error: 'Підписка заархівована — переведення на Річну неможливе. Створіть нову.' },
      { status: 400 },
    );
  }

  // Регулярку знімаємо ДО зміни плану: removeSubscriptionAutopay працює тільки для MONTHLY.
  //
  // БЕЗУМОВНО, без гейта `sub.autoRenew`: прапорець може брехати. Якщо STATUS-probe у
  // callback-у/звірці був inconclusive або REMOVE колись не докрутився, autoRenew уже
  // false, а правило у WFP живе. Для підписки без регулярки виклик і так no-op —
  // усі orderRef повернуть 4102, які ми ігноруємо.
  const autopay = await removeSubscriptionAutopay(sub.id);
  await recordAutopayRemoveOutcome({ subscriptionId: sub.id, result: autopay, source: `admin:${actor} · convert_to_yearly` });

  // Спроби були, жодної регулярки не знято І WFP повернув помилку — ми НЕ знаємо, чи
  // правило живе. Переводити на Річну в такому стані не можна: на YEARLY-плані рекурентне
  // списання не має куди зарахуватись (піде в orphan), тобто клієнта списують за доступ,
  // який він уже викупив. Краще заблокувати дію і дати менеджеру повторити.
  if (autopay.attempted > 0 && autopay.removed === 0 && autopay.error) {
    return NextResponse.json({
      error: 'Не вдалося зняти автосписання у WayForPay — спробуйте ще раз',
      autopay,
    }, { status: 409 });
  }

  const fresh = await prisma.yearlyProgramSubscription.findUnique({
    where: { id: sub.id },
    include: {
      cohort: { select: { startDate: true, endDate: true } },
      payments: { select: { amount: true, status: true, paidAt: true, createdAt: true, excludedFromAccess: true } },
    },
  });
  const postAccessMonths = await getYearlyPostAccessMonths(prisma);
  const computedExpiresAt = calculateAccessUntil({
    plan: 'YEARLY',
    autoRenew: false,
    cohort: fresh?.cohort ? { startDate: fresh.cohort.startDate, endDate: fresh.cohort.endDate } : null,
    payments: fresh?.payments ?? [],
    postAccessMonths,
  });

  // Ніколи не вкорочуємо доступ: якщо менеджер раніше продовжив вручну далі за розрахунок —
  // лишаємо його дату. Якщо розрахунку немає (немає оплат/набору) — лишаємо як було.
  const currentExpiresAt = sub.expiresAt ?? null;
  const newExpiresAt = computedExpiresAt && currentExpiresAt
    ? (computedExpiresAt > currentExpiresAt ? computedExpiresAt : currentExpiresAt)
    : (computedExpiresAt ?? currentExpiresAt);

  const { yearlyPrice } = await getYearlyProgramSettings(prisma);
  const totalPaid = sumRealPaid(fresh?.payments ?? []);
  const remaining = Math.max(0, yearlyPrice - totalPaid);

  // Підписка вже оплачена (інакше переводити нема за що) — після конверсії вона має бути
  // живою. Без цього конверсія з GRACE лишала status=GRACE, і найближчий нічний cron
  // закривав доступ щойно розрахованому клієнту, а прапорці нагадувань з попереднього
  // циклу давали листи «оплатіть» уже на Річному плані.
  const hasPaidPayment = (fresh?.payments ?? []).some((p) => p.status === 'PAID');

  // Атомарний guard від подвійного кліку: план міняємо лише якщо він ЩЕ MONTHLY.
  // Другий (паралельний) запит отримає count=0 і 409 — без нього два кліки писали б
  // дві події `plan_converted` і два листи студенту.
  const claim = await prisma.yearlyProgramSubscription.updateMany({
    where: { id: sub.id, plan: 'MONTHLY' },
    data: {
      plan: 'YEARLY',
      autoRenew: false,
      // Кеш графіка WFP більше не має сенсу — інакше колонка «Наступний платіж»
      // показувала б дату списання, якого вже не буде.
      wfpNextChargeAt: null,
      wfpScheduleCheckedAt: null,
      wfpRegularRef: null,
      ...(hasPaidPayment ? { status: 'ACTIVE', ...RESET_REMINDER_AND_GRACE_FIELDS } : {}),
      ...(newExpiresAt ? { expiresAt: newExpiresAt } : {}),
    },
  });
  if (claim.count === 0) {
    return NextResponse.json(
      { error: 'Підписку вже переведено на Річний план (можливо, іншим кліком або в паралельній вкладці).' },
      { status: 409 },
    );
  }

  const wfpSummary = autopay.attempted > 0
    ? ` · WFP REMOVE: ${autopay.removed}/${autopay.attempted}${autopay.error ? ` (errors: ${autopay.error.slice(0, 200)})` : ''}`
    : '';
  await prisma.yearlyProgramSubscriptionEvent.create({
    data: {
      subscriptionId: sub.id,
      type: 'plan_converted',
      message: `Переведено на Річний план by ${actor} · сплачено ${totalPaid}₴ з ${yearlyPrice}₴`
        + `${remaining > 0 ? ` (недоплата ${remaining}₴)` : ''}`
        + ` · expiresAt=${newExpiresAt?.toISOString().slice(0, 10) ?? 'null'}${wfpSummary}`,
      metadata: {
        planConverted: true,
        from: 'MONTHLY',
        to: 'YEARLY',
        totalPaid,
        yearlyPrice,
        remaining,
        hadAutoRenew: sub.autoRenew,
        expiresAt: newExpiresAt?.toISOString() ?? null,
        wfpRemovedCount: autopay.removed,
        wfpAttemptedCount: autopay.attempted,
        wfpError: autopay.error,
        actor,
      },
    },
  });

  // Лист — best-effort: план уже змінено в БД, помилка пошти цього не скасовує.
  let emailWarning: string | null = null;
  if (sub.user?.email) {
    const res = await sendYearlyProgramConvertedToYearlyEmail({
      to: sub.user.email,
      name: sub.user.name ?? null,
      totalPaid,
      expiresAt: newExpiresAt,
    }).catch((e) => ({ ok: false, error: (e as Error).message }));
    if (!res.ok) emailWarning = `лист студенту не надіслано: ${(res.error ?? 'unknown').slice(0, 160)}`;
    await prisma.yearlyProgramSubscriptionEvent.create({
      data: {
        subscriptionId: sub.id,
        type: 'admin_action',
        message: res.ok
          ? `Лист про переведення на Річну надіслано на ${sub.user.email}`
          : `Лист про переведення на Річну НЕ надіслано: ${(res.error ?? 'unknown').slice(0, 120)}`,
        metadata: { emailKind: 'plan-converted-yearly', ok: res.ok, error: res.error ?? null },
      },
    });
  }

  const warnings = [
    autopay.error ? `WFP: ${autopay.error.slice(0, 200)}` : null,
    emailWarning,
  ].filter(Boolean) as string[];

  return NextResponse.json({
    ok: true,
    plan: 'YEARLY',
    totalPaid,
    yearlyPrice,
    remaining,
    newExpiresAt: newExpiresAt?.toISOString() ?? null,
    autopay,
    ...(warnings.length > 0 ? { warning: warnings.join(' · ') } : {}),
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
      manualEnteredBy: actor,
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
  // context:'correction' — правка платежу нічого не оплачує: закрита підписка не воскресає,
  // SendPulse-маркери не скидаються. Єдиний дозволений апгрейд статусу — коли перерахований
  // доступ знову чинний (PENDING/GRACE → ACTIVE, `liftedByCorrection`).
  const { newStatus, newExpiresAt, revertedToPending, debt, liftedByCorrection } = await applyPaymentActivation({
    subscriptionId: sub.id,
    plan: sub.plan,
    autoRenew: sub.autoRenew,
    prevStatus: sub.status,
    lastPaymentAt: effectivePaidAt,
    context: 'correction',
  });

  // Правка платежу може мовчки скинути підписку в PENDING (напр. суму зробили carryover-ом
  // або платіж перестав рахуватись) — це помітна зміна стану, тож вона йде і в подію,
  // і у відповідь для тоста.
  const pendingNote = revertedToPending
    ? ' · зарахованих платежів не лишилось — підписка повернулась у PENDING (ще не оплачено)'
    : '';
  const spWarning = buildOpenAccessWarning(sub, revertedToPending);
  const debtNote = debtNoteFor(debt, newExpiresAt);
  const liftNote = liftNoteFor(liftedByCorrection, sub.status);
  await prisma.yearlyProgramSubscriptionEvent.create({
    data: {
      subscriptionId: sub.id,
      type: 'admin_action',
      message: `Редагування платежу (${actor}): ${changes.join('; ')}${pendingNote}${liftNote}${debtNote}`,
      metadata: {
        editPayment: true, paymentId, actor, changes, newStatus,
        ...(revertedToPending ? { revertedToPending: true } : {}),
      },
    },
  });

  return NextResponse.json({
    ok: true,
    changes,
    newStatus,
    revertedToPending,
    ...(spWarning ? { spWarning } : {}),
    newExpiresAt: newExpiresAt?.toISOString() ?? null,
  });
}

/// Корекція повернула доступ у майбутнє — жива підписка (PENDING/GRACE) знову ACTIVE,
/// а при підйомі з GRACE скинуті grace-поля. Помітна зміна стану → в текст події.
function liftNoteFor(lifted: boolean, prevStatus: string): string {
  return lifted ? ` · ${prevStatus} → ACTIVE (доступ знову чинний)` : '';
}

/// Після корекції підписка лишилась ACTIVE, але розрахована дата вже в минулому.
/// Нейтральна нотатка в подію (без critical-issue): це штатно підбере нічний cron.
function debtNoteFor(debt: boolean, newExpiresAt: Date | null): string {
  if (!debt || !newExpiresAt) return '';
  return ` · ⚠️ розрахована дата доступу (${newExpiresAt.toISOString().slice(0, 10)}) вже в минулому`
    + ' — нічний прохід переведе підписку в GRACE';
}

/// Корекція повернула підписку в PENDING, а доступ у SendPulse лишився відкритим.
/// Автоматично НЕ закриваємо (це рішення менеджера) — але мовчати теж не можна:
/// «ще не оплачено» з відкритим курсом = безкоштовний доступ.
function buildOpenAccessWarning(sub: NonNullable<SubWithUser>, revertedToPending: boolean): string | null {
  if (!revertedToPending) return null;
  const opened = sub.sendpulseAccessOpenedAt;
  if (!opened) return null;
  // Доступ уже закривали ПІСЛЯ відкриття — попереджати нема про що.
  const closed = sub.sendpulseAccessClosedAt;
  if (closed && closed.getTime() >= opened.getTime()) return null;
  return 'Доступ у SendPulse лишається відкритим — закрий кнопкою «Закрити доступ», якщо потрібно.';
}

/// Скільки платежів максимум приймає пакетна дія за раз. Реально це кількість часток
/// одного внесення (≤ MAX_SPLIT_PARTS), запас — щоб не дати одним запитом перебрати
/// всю історію підписки.
const MAX_PAYMENT_BATCH = 50;

/// Спільна вибірка платежів для пакетних дій: перевіряє, що всі id належать ЦІЙ підписці
/// і що це РУЧНІ платежі (WFP чіпати не можна — їх стан веде callback).
type BatchLoad =
  | { error: NextResponse; payments: null }
  | { error: null; payments: Payment[] };

async function loadManualPaymentsForBatch(subId: string, rawIds: unknown): Promise<BatchLoad> {
  const fail = (message: string, status: number): BatchLoad =>
    ({ error: NextResponse.json({ error: message }, { status }), payments: null });

  const ids = Array.isArray(rawIds)
    ? Array.from(new Set(rawIds.filter((v): v is string => typeof v === 'string' && v.trim() !== '')))
    : [];
  if (ids.length === 0) return fail('Не вказано платіж', 400);
  if (ids.length > MAX_PAYMENT_BATCH) return fail(`Забагато платежів за раз (максимум ${MAX_PAYMENT_BATCH})`, 400);

  const payments = await prisma.payment.findMany({
    where: { id: { in: ids }, yearlyProgramSubscriptionId: subId },
    orderBy: { orderReference: 'asc' },
  });
  if (payments.length !== ids.length) return fail('Платіж не знайдено для цієї підписки', 404);
  if (payments.some((p) => !p.manualMethod)) {
    return fail('Платежі WayForPay змінювати не можна — тільки ручні', 400);
  }
  return { error: null, payments };
}

/// «Виключити з доступу» / «Повернути в доступ» — оборотне виправлення помилкового
/// ручного платежу. Ставить `Payment.excludedFromAccess` (calculateAccessUntil такі рядки
/// не рахує як місяць) і перераховує підписку тим самим helper-ом, що й оплата.
/// Гроші НЕ зникають: платіж лишається в історії й у «Доході» Річної (там агрегуються всі
/// PAID-рядки підписки), змінюється лише його вплив на доступ. УВАГА: у глобальній аналітиці
/// продажів (/dashboard/admin, lib/admin-sales-*.ts) виключені платежі відфільтровані
/// (`excludedFromAccess: false`) — саме тому тексти в UI формулюють це окремо.
/// Для розбитого внесення приходять id усіх часток одразу.
async function handleSetPaymentAccess(
  sub: NonNullable<SubWithUser>,
  input: { paymentIds?: string[]; excluded?: boolean; note?: string },
  actor: string,
) {
  if (typeof input.excluded !== 'boolean') {
    return NextResponse.json({ error: 'excluded має бути true/false' }, { status: 400 });
  }
  const loaded = await loadManualPaymentsForBatch(sub.id, input.paymentIds);
  if (loaded.error) return loaded.error;
  const payments = loaded.payments;

  const changing = payments.filter((p) => p.excludedFromAccess !== input.excluded);
  if (changing.length === 0) {
    return NextResponse.json({ ok: true, noChanges: true });
  }

  await prisma.payment.updateMany({
    where: { id: { in: changing.map((p) => p.id) } },
    data: { excludedFromAccess: input.excluded },
  });

  // Перерахунок доступу по актуальних платежах. context:'correction' — виправлення платежу
  // не воскрешає закриту підписку, а GRACE лишається GRACE, поки дата доступу в минулому.
  // «Повернути в доступ» з датою в майбутньому піднімає живу підписку в ACTIVE.
  const { newStatus, newExpiresAt, revertedToPending, debt, liftedByCorrection } = await applyPaymentActivation({
    subscriptionId: sub.id,
    plan: sub.plan,
    autoRenew: sub.autoRenew,
    prevStatus: sub.status,
    lastPaymentAt: sub.lastPaymentAt ?? changing[0]!.paidAt ?? changing[0]!.createdAt,
    context: 'correction',
  });

  const reason = (input.note ?? '').trim().slice(0, 300);
  const totalAmount = changing.reduce((s, p) => s + p.amount, 0);
  // Зарахованих платежів не лишилось — підписка повернулась у «ще не оплачено».
  // Це помітна для менеджера зміна стану, тож пишемо її прямо в текст події.
  const pendingNote = revertedToPending
    ? ' · зарахованих платежів не лишилось — підписка повернулась у PENDING (ще не оплачено)'
    : '';
  const spWarning = buildOpenAccessWarning(sub, revertedToPending);
  const spNote = spWarning ? ` · ⚠️ ${spWarning}` : '';
  const debtNote = debtNoteFor(debt, newExpiresAt);
  const liftNote = liftNoteFor(liftedByCorrection, sub.status);
  await prisma.yearlyProgramSubscriptionEvent.create({
    data: {
      subscriptionId: sub.id,
      type: 'admin_action',
      message: input.excluded
        ? `Виключено з доступу (${actor}): ${changing.length} шт. на ${totalAmount}₴ — місяці доступу за ними більше не рахуються${reason ? ` — ${reason}` : ''}${pendingNote}${spNote}${debtNote} · expiresAt=${newExpiresAt?.toISOString().slice(0, 10) ?? 'null'}`
        : `Повернено в доступ (${actor}): ${changing.length} шт. на ${totalAmount}₴ — місяці доступу за ними знову рахуються${reason ? ` — ${reason}` : ''}${liftNote}${debtNote} · expiresAt=${newExpiresAt?.toISOString().slice(0, 10) ?? 'null'}`,
      metadata: {
        paymentAccess: true,
        excluded: input.excluded,
        actor,
        reason: reason || null,
        paymentIds: changing.map((p) => p.id),
        orderReferences: changing.map((p) => p.orderReference),
        amounts: changing.map((p) => p.amount),
        newStatus,
        ...(revertedToPending ? { revertedToPending: true } : {}),
      },
    },
  });

  return NextResponse.json({
    ok: true,
    changed: changing.length,
    excluded: input.excluded,
    newStatus,
    revertedToPending,
    ...(spWarning ? { spWarning } : {}),
    newExpiresAt: newExpiresAt?.toISOString() ?? null,
  });
}

/// Видалення помилкового РУЧНОГО платежу (super-admin, перевірка ролі — у POST-диспетчері).
/// Крайній випадок: платежу взагалі не було (помилка менеджера при внесенні), тож у
/// «Доході» його теж бути не має. Слід лишається у події — повний знімок видалених рядків.
/// Повсякденна оборотна дія — `set_payment_access`.
async function handleDeletePayments(
  sub: NonNullable<SubWithUser>,
  input: { paymentIds?: string[] },
  actor: string,
) {
  const loaded = await loadManualPaymentsForBatch(sub.id, input.paymentIds);
  if (loaded.error) return loaded.error;
  const payments = loaded.payments;

  const snapshot = payments.map((p) => ({
    id: p.id,
    orderReference: p.orderReference,
    amount: p.amount,
    currency: p.currency,
    status: p.status,
    paidAt: p.paidAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    manualMethod: p.manualMethod,
    manualNote: p.manualNote,
    manualEnteredBy: p.manualEnteredBy,
    excludedFromAccess: p.excludedFromAccess,
  }));
  const totalAmount = payments.reduce((s, p) => s + p.amount, 0);

  await prisma.payment.deleteMany({ where: { id: { in: payments.map((p) => p.id) } } });

  const { newStatus, newExpiresAt, revertedToPending, debt } = await applyPaymentActivation({
    subscriptionId: sub.id,
    plan: sub.plan,
    autoRenew: sub.autoRenew,
    prevStatus: sub.status,
    lastPaymentAt: sub.lastPaymentAt ?? new Date(),
    context: 'correction',
  });

  const pendingNote = revertedToPending
    ? ' · зарахованих платежів не лишилось — підписка повернулась у PENDING (ще не оплачено)'
    : '';
  const spWarning = buildOpenAccessWarning(sub, revertedToPending);
  const spNote = spWarning ? ` · ⚠️ ${spWarning}` : '';
  const debtNote = debtNoteFor(debt, newExpiresAt);
  await prisma.yearlyProgramSubscriptionEvent.create({
    data: {
      subscriptionId: sub.id,
      type: 'admin_action',
      message: `🗑 Видалено ${payments.length} ручн. ${payments.length === 1 ? 'платіж' : 'платежів'} на ${totalAmount}₴ (${actor}): `
        + `${snapshot.map((s) => s.orderReference).join(', ')}${pendingNote}${spNote}${debtNote} · expiresAt=${newExpiresAt?.toISOString().slice(0, 10) ?? 'null'}`,
      metadata: {
        paymentDeleted: true, actor, totalAmount, payments: snapshot, newStatus,
        ...(revertedToPending ? { revertedToPending: true } : {}),
      },
    },
  });

  return NextResponse.json({
    ok: true,
    deleted: payments.length,
    totalAmount,
    newStatus,
    revertedToPending,
    ...(spWarning ? { spWarning } : {}),
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
  await recordAutopayRemoveOutcome({ subscriptionId: sub.id, result: autopay, source: `admin:${actor} · delete` });

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
      // Архів = списань більше не буде. Прапор гасимо завжди, кеш дати — теж;
      // `wfpRegularRef` лишаємо при провалі REMOVE як маркер для нічного ретраю.
      autoRenew: false,
      wfpNextChargeAt: null,
      ...(autopay.error ? {} : { wfpRegularRef: null }),
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
