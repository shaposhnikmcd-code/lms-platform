/// Спільна логіка «активація підписки після зарахування платежу» — використовується
/// і при ручному підтвердженні оплати (handleManualPayment у [id]/route.ts), і при
/// перенесенні студента з минулого набору (carryover у manual-add/route.ts), і при
/// редагуванні ручного платежу (edit_payment).
///
/// Тягне свіжий стан підписки (cohort + усі payments, включно з щойно створеним),
/// перераховує expiresAt через calculateAccessUntil (single source of truth) і оновлює
/// статус за еталоном WFP-callback-а (уніфікація ручного флоу зі стандартною покупкою):
///   — prevStatus ∈ PENDING/ACTIVE/GRACE → ACTIVE завжди (незалежно від запуску cohort-а);
///   — prevStatus ∈ EXPIRED/CANCELLED/ARCHIVED → `allowRevive:true` піднімає в ACTIVE,
///     `allowRevive:false` (edit_payment) — статус не чіпає.
/// startDate виставляється в lastPaymentAt, якщо ще не заданий (як `sub.startDate ?? now`
/// у callback-у).

import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { calculateAccessUntil } from '@/lib/yearlyProgramAccess';
import { getYearlyPostAccessMonths } from '@/lib/yearlyProgramConfig';

export interface PaymentActivationResult {
  newStatus: string;
  newExpiresAt: Date | null;
  cohortLaunched: boolean;
  hasCohort: boolean;
}

/// Статуси «живої» підписки, які завжди активуються після оплати.
const REVIVABLE_STATUSES = new Set(['PENDING', 'ACTIVE', 'GRACE']);

export async function applyPaymentActivation(args: {
  subscriptionId: string;
  plan: 'YEARLY' | 'MONTHLY';
  autoRenew: boolean;
  /// Поточний статус підписки ДО активації.
  prevStatus: string;
  /// lastPaymentAt для оновлення підписки (у ручній оплаті = paidAt, у carryover = now).
  lastPaymentAt: Date;
  /// Дозволити «оживити» мертву підписку (EXPIRED/CANCELLED/ARCHIVED) у ACTIVE.
  /// manual_payment / carryover → true (реальна оплата відновлює доступ);
  /// edit_payment → false (правка платежу не має воскрешати закриту підписку). Default false.
  allowRevive?: boolean;
}): Promise<PaymentActivationResult> {
  const fresh = await prisma.yearlyProgramSubscription.findUnique({
    where: { id: args.subscriptionId },
    include: {
      cohort: true,
      payments: { select: { amount: true, status: true, paidAt: true, createdAt: true } },
    },
  });

  const postAccessMonths = await getYearlyPostAccessMonths(prisma);
  const newExpiresAt = calculateAccessUntil({
    plan: args.plan,
    autoRenew: args.autoRenew,
    cohort: fresh?.cohort ? { startDate: fresh.cohort.startDate, endDate: fresh.cohort.endDate } : null,
    payments: fresh?.payments ?? [],
    postAccessMonths,
  });

  const cohortLaunched = !!fresh?.cohort?.launchedAt;
  const hasCohort = !!fresh?.cohort;

  // Уніфіковано з callback-ом: жива підписка (PENDING/ACTIVE/GRACE) після оплати завжди
  // стає ACTIVE — незалежно від того, запущений cohort чи ні (доступ до платформи=креди
  // все одно відкриваються централізовано на запуску, але сама підписка вже активна).
  // Мертву (EXPIRED/CANCELLED/ARCHIVED) піднімаємо тільки якщо allowRevive.
  const newStatus = REVIVABLE_STATUSES.has(args.prevStatus)
    ? 'ACTIVE'
    : (args.allowRevive ? 'ACTIVE' : args.prevStatus);

  await prisma.yearlyProgramSubscription.update({
    where: { id: args.subscriptionId },
    data: {
      status: newStatus as Prisma.YearlyProgramSubscriptionUpdateInput['status'],
      expiresAt: newExpiresAt,
      lastPaymentAt: args.lastPaymentAt,
      // startDate — «початок доступу»: якщо ще не заданий, ставимо дату платежу
      // (дзеркало `startDate: sub.startDate ?? now` у callback-у).
      ...(fresh?.startDate ? {} : { startDate: args.lastPaymentAt }),
    },
  });

  return { newStatus, newExpiresAt, cohortLaunched, hasCohort };
}
