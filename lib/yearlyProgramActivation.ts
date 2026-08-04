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
///
/// При РЕАЛЬНОМУ оживленні (див. `revived` нижче) додатково повторює те, що робить
/// callback: прибирає сліди скасування і скидає SendPulse-маркери, якщо доступ закривали.

import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { calculateAccessUntil } from '@/lib/yearlyProgramAccess';
import { getYearlyPostAccessMonths } from '@/lib/yearlyProgramConfig';

export interface PaymentActivationResult {
  newStatus: string;
  newExpiresAt: Date | null;
  cohortLaunched: boolean;
  hasCohort: boolean;
  /// true — оплата підняла мертву/скасовану підписку назад у ACTIVE.
  revived: boolean;
  /// true — SendPulse-маркери скинуто, щоб наступний extra-launch реально відкрив доступ.
  spMarkersReset: boolean;
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

  // Реальне оживлення = підписку підняли в ACTIVE з мертвого статусу АБО вона несла
  // слід скасування. Друга умова важлива, бо мертву підписку могли вже перевести в
  // PENDING (так робить `/api/wayforpay` перед повторною покупкою) — за статусом
  // revive тоді не видно, а `cancelledAt` лишається.
  const wasDead = !REVIVABLE_STATUSES.has(args.prevStatus);
  const revived = newStatus === 'ACTIVE' && (wasDead || !!fresh?.cancelledAt);

  // Дзеркало WFP-callback-а (`handleYearlyProgramCallback`): при оживленні прибираємо
  // сліди скасування і, якщо доступ у SendPulse РЕАЛЬНО закривали, скидаємо обидва
  // маркери. Без цього `runExtraLaunchForSubscription` виходить по `already_opened`,
  // і після «Внести оплату» студент лишається ACTIVE у нас, але видаленим у SendPulse.
  // Живих підписок без скасування це не торкається — маркери лишаються як були.
  const clearCancelTrace = revived && !!fresh?.cancelledAt;
  const spMarkersReset = revived && !!fresh?.sendpulseAccessClosedAt;

  await prisma.yearlyProgramSubscription.update({
    where: { id: args.subscriptionId },
    data: {
      status: newStatus as Prisma.YearlyProgramSubscriptionUpdateInput['status'],
      expiresAt: newExpiresAt,
      lastPaymentAt: args.lastPaymentAt,
      // startDate — «початок доступу»: якщо ще не заданий, ставимо дату платежу
      // (дзеркало `startDate: sub.startDate ?? now` у callback-у).
      ...(fresh?.startDate ? {} : { startDate: args.lastPaymentAt }),
      ...(clearCancelTrace ? { cancelledAt: null, cancelledBy: null, cancelledReason: null } : {}),
      ...(spMarkersReset ? { sendpulseAccessOpenedAt: null, sendpulseAccessClosedAt: null } : {}),
    },
  });

  return { newStatus, newExpiresAt, cohortLaunched, hasCohort, revived, spMarkersReset };
}
