/// Спільна логіка «активація підписки після зарахування платежу» — використовується
/// і при ручному підтвердженні оплати (handleManualPayment у [id]/route.ts), і при
/// перенесенні студента з минулого набору (carryover у manual-add/route.ts).
///
/// Тягне свіжий стан підписки (cohort + усі payments, включно з щойно створеним),
/// перераховує expiresAt через calculateAccessUntil (single source of truth) і оновлює
/// статус: cohort launched або взагалі без cohort → ACTIVE; cohort є, але ще не запущений
/// → лишає PENDING (доступ відкриється на загальному запуску програми).

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

export async function applyPaymentActivation(args: {
  subscriptionId: string;
  plan: 'YEARLY' | 'MONTHLY';
  autoRenew: boolean;
  /// Поточний статус підписки ДО активації (щоб не «підняти» ARCHIVED/EXPIRED зі стану,
  /// який не має ставати PENDING). Логіка 1-в-1 як у handleManualPayment.
  prevStatus: string;
  /// lastPaymentAt для оновлення підписки (у ручній оплаті = paidAt, у carryover = now).
  lastPaymentAt: Date;
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
  // ACTIVE якщо cohort launched або взагалі без cohort (legacy). Якщо cohort є але ще не
  // запущений — лишаємо PENDING: доступ відкриється на загальному запуску програми.
  const newStatus = (cohortLaunched || !hasCohort)
    ? 'ACTIVE'
    : (args.prevStatus === 'PENDING' ? 'PENDING' : args.prevStatus);

  await prisma.yearlyProgramSubscription.update({
    where: { id: args.subscriptionId },
    data: {
      status: newStatus as Prisma.YearlyProgramSubscriptionUpdateInput['status'],
      expiresAt: newExpiresAt,
      lastPaymentAt: args.lastPaymentAt,
    },
  });

  return { newStatus, newExpiresAt, cohortLaunched, hasCohort };
}
