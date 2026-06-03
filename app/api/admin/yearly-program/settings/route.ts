import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAdmin, getAdminActor } from '@/lib/adminAuth';
import {
  YEARLY_GRACE_SETTING_KEY,
  YEARLY_GRACE_MIN_DAYS,
  YEARLY_GRACE_MAX_DAYS,
  YEARLY_POST_ACCESS_SETTING_KEY,
  YEARLY_POST_ACCESS_MIN_MONTHS,
  YEARLY_POST_ACCESS_MAX_MONTHS,
  YEARLY_PROGRAM_CONFIG,
  getYearlyGraceDays,
  getYearlyPostAccessMonths,
} from '@/lib/yearlyProgramConfig';
import { calculateAccessUntil } from '@/lib/yearlyProgramAccess';

/// GET — повертає поточні налаштування Річної програми (grace-період + пост-доступ).
/// PATCH — оновлює graceDays АБО postAccessMonths.
///   { graceDays }       — впливає тільки на нові переходи ACTIVE→GRACE у cron.
///   { postAccessMonths } — перераховує expiresAt усіх живих (ACTIVE/GRACE) підписок з cohort-ом.

export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const [graceDays, postAccessMonths] = await Promise.all([
    getYearlyGraceDays(prisma),
    getYearlyPostAccessMonths(prisma),
  ]);
  return NextResponse.json({
    graceDays,
    defaultGraceDays: YEARLY_PROGRAM_CONFIG.graceDays,
    minGraceDays: YEARLY_GRACE_MIN_DAYS,
    maxGraceDays: YEARLY_GRACE_MAX_DAYS,
    postAccessMonths,
    defaultPostAccessMonths: YEARLY_PROGRAM_CONFIG.postAccessMonths,
    minPostAccessMonths: YEARLY_POST_ACCESS_MIN_MONTHS,
    maxPostAccessMonths: YEARLY_POST_ACCESS_MAX_MONTHS,
  });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    graceDays?: unknown;
    postAccessMonths?: unknown;
  };

  // Пост-доступ (місяці) — перераховує живі підписки.
  if (body.postAccessMonths !== undefined) {
    const raw = body.postAccessMonths;
    const value = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isInteger(value) || value < YEARLY_POST_ACCESS_MIN_MONTHS || value > YEARLY_POST_ACCESS_MAX_MONTHS) {
      return NextResponse.json(
        { error: `postAccessMonths має бути цілим числом від ${YEARLY_POST_ACCESS_MIN_MONTHS} до ${YEARLY_POST_ACCESS_MAX_MONTHS}` },
        { status: 400 },
      );
    }
    await prisma.appSetting.upsert({
      where: { key: YEARLY_POST_ACCESS_SETTING_KEY },
      create: { key: YEARLY_POST_ACCESS_SETTING_KEY, value },
      update: { value },
    });
    const actor = await getAdminActor(req);
    const actorLabel = actor?.email ?? actor?.name ?? 'admin';
    const recomputed = await recomputeLiveAccess(value, actorLabel);
    return NextResponse.json({ postAccessMonths: value, recomputed });
  }

  // Grace-період (дні) — впливає лише на нові переходи у cron.
  const raw = body.graceDays;
  const value = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isInteger(value) || value < YEARLY_GRACE_MIN_DAYS || value > YEARLY_GRACE_MAX_DAYS) {
    return NextResponse.json(
      { error: `graceDays має бути цілим числом від ${YEARLY_GRACE_MIN_DAYS} до ${YEARLY_GRACE_MAX_DAYS}` },
      { status: 400 },
    );
  }
  await prisma.appSetting.upsert({
    where: { key: YEARLY_GRACE_SETTING_KEY },
    create: { key: YEARLY_GRACE_SETTING_KEY, value },
    update: { value },
  });
  return NextResponse.json({ graceDays: value });
}

/// Перерахунок expiresAt усіх живих (ACTIVE/GRACE) підписок з cohort-ом під нове значення
/// пост-доступу. GRACE, у якій нова дата завершення вже в майбутньому, повертаємо в ACTIVE
/// (доступ продовжено) і скидаємо grace-стан + grace-нагадування.
async function recomputeLiveAccess(postAccessMonths: number, actor: string): Promise<{ updated: number; total: number }> {
  const subs = await prisma.yearlyProgramSubscription.findMany({
    where: {
      status: { in: ['ACTIVE', 'GRACE'] },
      cohortId: { not: null },
    },
    include: {
      cohort: { select: { startDate: true, endDate: true } },
      payments: { select: { amount: true, status: true, paidAt: true, createdAt: true } },
    },
  });

  const now = new Date();
  let updated = 0;
  for (const s of subs) {
    if (!s.cohort) continue;
    const newExpires = calculateAccessUntil({
      plan: s.plan,
      autoRenew: s.autoRenew,
      cohort: { startDate: s.cohort.startDate, endDate: s.cohort.endDate },
      payments: s.payments,
      postAccessMonths,
    });
    if (!newExpires) continue;
    if (s.expiresAt && newExpires.getTime() === s.expiresAt.getTime()) continue;

    const revivingFromGrace = s.status === 'GRACE' && newExpires > now;
    await prisma.yearlyProgramSubscription.update({
      where: { id: s.id },
      data: {
        expiresAt: newExpires,
        ...(revivingFromGrace
          ? {
              status: 'ACTIVE',
              graceStartedAt: null,
              gracePeriodEndsAt: null,
              reminderSent3d: false,
              reminderSentExpired: false,
              reminderSentOnExpiry: false,
              reminderSentGraceStart: false,
              reminderSentGraceMid: false,
              reminderSentGraceLast: false,
            }
          : {}),
      },
    });
    await prisma.yearlyProgramSubscriptionEvent.create({
      data: {
        subscriptionId: s.id,
        type: 'admin_action',
        message: `Пост-доступ → ${postAccessMonths} міс. by ${actor} · expiresAt=${newExpires.toISOString().slice(0, 10)}${revivingFromGrace ? ' · GRACE→ACTIVE' : ''}`,
        metadata: { reason: 'post_access_months_changed', postAccessMonths },
      },
    });
    updated++;
  }
  return { updated, total: subs.length };
}
