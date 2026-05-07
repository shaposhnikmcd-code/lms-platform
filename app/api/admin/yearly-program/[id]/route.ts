import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAdmin, getAdminActor } from '@/lib/adminAuth';
import { closeAccessInCourse, lookupStudentIdByEmail, openAccessViaEvent } from '@/lib/sendpulse';
import { kickSubscriptionFromChannel } from '@/lib/yearlyProgramTelegram';
import { removeSubscriptionAutopay } from '@/lib/yearlyProgramAutopay';
import { sendYearlyProgramAdminEndedEmail, type AdminEndKind } from '@/lib/yearlyProgramAdminEndedEmail';
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
    case 'tg_kick':
      return handleTelegramKick(sub, actorLabel, 'returnable');
    case 'tg_kick_revoke':
      return handleTelegramKick(sub, actorLabel, 'permanent');
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

async function handleDelete(sub: NonNullable<SubWithUser>, actor: string) {
  // Soft-archive: знімаємо WFP-регулярки (інакше autopay-списання продовжаться навіть
  // після архіву = orphan charges), закриваємо доступ у SendPulse, чистимо technical
  // sendpulseStudentId, ставимо статус ARCHIVED. Картка лишається в адмінці як архівний
  // запис; reopen заборонений. Payment-и лишаються нерушеними з лінком на цю підписку.
  const hadAutoRenew = sub.autoRenew;
  const autopay = await removeSubscriptionAutopay(sub.id);

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
