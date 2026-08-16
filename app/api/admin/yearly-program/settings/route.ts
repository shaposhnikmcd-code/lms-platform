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
  RESET_REMINDER_AND_GRACE_FIELDS,
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
    // Саме налаштування збережено завжди; нижче — чесний звіт по перерахунку підписок,
    // щоб клієнт міг показати «частина лишилась зі старою датою», а не мовчазний успіх.
    return NextResponse.json({
      postAccessMonths: value,
      recomputed,
      ...(recomputed.failed > 0
        ? { warning: `Значення збережено, але ${recomputed.failed} із ${recomputed.scanned} підписок не перерахувались — повторіть збереження або перевірте лог.` }
        : {}),
    });
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

/// Скільки підписок оновлюємо однією транзакцією. Той самий розмір, що й у перерахунку
/// дат набору (`cohorts/[id]/route.ts`): менші батчі не впираються у 5-секундний timeout
/// Prisma навіть на сотні підписок, а фейл одного батчу не забирає з собою решту.
const RECALC_BATCH_SIZE = 25;

interface RecomputeReport {
  /// Скільки живих підписок узагалі переглянули.
  scanned: number;
  /// Скільки реально отримали нову дату.
  updated: number;
  /// Скільки не вдалось оновити (впав батч) — вони лишились зі старою датою.
  failed: number;
  /// Дубль `scanned` для сумісності зі старим клієнтом, який читав `recomputed.total`.
  total: number;
}

/// Перерахунок expiresAt усіх живих (ACTIVE/GRACE) підписок з cohort-ом під нове значення
/// пост-доступу. Підписка, чия нова дата завершення опинилась у майбутньому, отримує
/// «свіжий цикл життя»: скидаються спожиті прапори нагадувань і grace-дати
/// (`RESET_REMINDER_AND_GRACE_FIELDS`) — інакше подовженому доступу не прийшло б жодного
/// попередження, бо всі листи цього циклу вже вважались надісланими. GRACE при цьому
/// повертається в ACTIVE. Семантика `backToLife`/`revive` — та сама, що при зміні дат
/// набору (`cohorts/[id]/route.ts`), щоб два шляхи до однієї дати не розходились.
async function recomputeLiveAccess(postAccessMonths: number, actor: string): Promise<RecomputeReport> {
  const subs = await prisma.yearlyProgramSubscription.findMany({
    where: {
      status: { in: ['ACTIVE', 'GRACE'] },
      cohortId: { not: null },
    },
    include: {
      cohort: { select: { startDate: true, endDate: true } },
      payments: { select: { amount: true, status: true, paidAt: true, createdAt: true, excludedFromAccess: true } },
    },
  });

  const now = new Date();
  // Готуємо зміни в пам'яті (без запитів), щоб батч тримав БД мінімальний час.
  const pending = subs.flatMap((s) => {
    if (!s.cohort) return [];
    const newExpires = calculateAccessUntil({
      plan: s.plan,
      autoRenew: s.autoRenew,
      cohort: { startDate: s.cohort.startDate, endDate: s.cohort.endDate },
      payments: s.payments,
      postAccessMonths,
    });
    if (!newExpires) return [];
    if (s.expiresAt && newExpires.getTime() === s.expiresAt.getTime()) return [];
    const backToLife = newExpires > now;
    const revive = backToLife && s.status === 'GRACE';
    return [{ id: s.id, newExpires, backToLife, revive }];
  });

  const report: RecomputeReport = { scanned: subs.length, updated: 0, failed: 0, total: subs.length };
  for (let i = 0; i < pending.length; i += RECALC_BATCH_SIZE) {
    const batch = pending.slice(i, i + RECALC_BATCH_SIZE);
    const writes = batch.map((p) => prisma.yearlyProgramSubscription.update({
      where: { id: p.id },
      data: {
        expiresAt: p.newExpires,
        // Revive = прострочення знято разом зі старою датою: скидаємо і лічильник невдалих
        // списань, інакше наступний цикл одразу відправить «charge failed»-шаблон.
        ...(p.revive ? { status: 'ACTIVE' as const, failedChargeCount: 0, lastChargeError: null } : {}),
        ...(p.backToLife ? RESET_REMINDER_AND_GRACE_FIELDS : {}),
      },
    }));
    try {
      await prisma.$transaction([
        ...writes,
        prisma.yearlyProgramSubscriptionEvent.createMany({
          data: batch.map((p) => ({
            subscriptionId: p.id,
            type: 'admin_action',
            message: `Пост-доступ → ${postAccessMonths} міс. by ${actor} · expiresAt=${p.newExpires.toISOString().slice(0, 10)}${p.revive ? ' · GRACE→ACTIVE' : ''}`,
            metadata: { reason: 'post_access_months_changed', postAccessMonths },
          })),
        }),
      ]);
      report.updated += batch.length;
    } catch (e) {
      report.failed += batch.length;
      console.error(
        `[yearly-settings] postAccess recalc batch ${i / RECALC_BATCH_SIZE + 1} failed (${batch.length} підписок): ${(e as Error).message}`,
        batch.map((p) => p.id),
      );
    }
  }
  return report;
}
