import prisma from '@/lib/prisma';
import { getYearlyGraceDays } from '@/lib/yearlyProgramConfig';
import {
  getYearlyProgramSettings,
  YEARLY_PROGRAM_DEFAULTS,
} from '@/lib/yearlyProgramSettings';
import YearlyProgramView, { type SummaryData } from './_components/YearlyProgramView';
import type { Row, CohortListItem } from './_components/types';

const MAX_ROWS = 500;

export default async function AdminYearlyProgramPage() {
  const [subs, cohorts] = await Promise.all([
    prisma.yearlyProgramSubscription.findMany({
      orderBy: { createdAt: 'desc' },
      take: MAX_ROWS,
      include: {
        user: { select: { id: true, name: true, email: true } },
        payments: { select: { id: true, amount: true, status: true, createdAt: true, paidAt: true } },
        cohort: { select: { id: true, name: true, startDate: true, launchedAt: true } },
      },
    }),
    prisma.yearlyProgramCohort.findMany({
      orderBy: { startDate: 'desc' },
    }),
  ]);

  const cohortSubsCount = await prisma.yearlyProgramSubscription.groupBy({
    by: ['cohortId'],
    _count: { _all: true },
  });
  const countByCohort = new Map<string | null, number>();
  for (const c of cohortSubsCount) countByCohort.set(c.cohortId, c._count._all);

  const cohortList: CohortListItem[] = cohorts.map((c) => ({
    id: c.id,
    name: c.name,
    startDate: c.startDate.toISOString(),
    endDate: c.endDate.toISOString(),
    launchedAt: c.launchedAt?.toISOString() ?? null,
    launchScheduledFor: c.launchScheduledFor?.toISOString() ?? null,
    emailScheduledFor: c.emailScheduledFor?.toISOString() ?? null,
    emailSentAt: c.emailSentAt?.toISOString() ?? null,
    launchEmailSubject: c.launchEmailSubject,
    launchEmailBody: c.launchEmailBody,
    isCurrent: c.isCurrent,
    subscriptionsCount: countByCohort.get(c.id) ?? 0,
  }));

  const now = Date.now();

  const rows: Row[] = subs.map((s) => {
    const paidPayments = s.payments.filter((p) => p.status === 'PAID');
    const totalPaid = paidPayments.reduce((sum, p) => sum + p.amount, 0);
    const msLeft = s.expiresAt ? s.expiresAt.getTime() - now : null;
    const daysLeft = msLeft !== null ? Math.ceil(msLeft / (24 * 60 * 60 * 1000)) : null;

    const firstPaid = paidPayments
      .map((p) => p.paidAt ?? p.createdAt)
      .sort((a, b) => a.getTime() - b.getTime())[0];

    return {
      id: s.id,
      createdAt: s.createdAt.toISOString(),
      userName: s.user?.name ?? null,
      userEmail: s.user?.email ?? '',
      plan: s.plan,
      autoRenew: s.autoRenew,
      status: s.status,
      startDate: s.startDate?.toISOString() ?? null,
      expiresAt: s.expiresAt?.toISOString() ?? null,
      daysLeft,
      firstPaymentAt: firstPaid?.toISOString() ?? null,
      cohortStartDate: s.cohort?.startDate.toISOString() ?? null,
      cohortName: s.cohort?.name ?? null,
      cohortId: s.cohort?.id ?? null,
      cohortLaunched: s.cohort?.launchedAt != null,
      cancelledAt: s.cancelledAt?.toISOString() ?? null,
      cancelledBy: s.cancelledBy,
      lastPaymentAt: s.lastPaymentAt?.toISOString() ?? null,
      failedChargeCount: s.failedChargeCount,
      lastChargeError: s.lastChargeError,
      sendpulseStudentId: s.sendpulseStudentId,
      sendpulseAccessOpenedAt: s.sendpulseAccessOpenedAt?.toISOString() ?? null,
      sendpulseAccessClosedAt: s.sendpulseAccessClosedAt?.toISOString() ?? null,
      paymentsCount: paidPayments.length,
      totalPaid,
      manuallyAddedAt: s.manuallyAddedAt?.toISOString() ?? null,
      manuallyAddedBy: s.manuallyAddedBy ?? null,
    };
  });

  const [statusCounts, totalAggr, revenueAggr, graceDays, programSettings] = await Promise.all([
    prisma.yearlyProgramSubscription.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
    prisma.yearlyProgramSubscription.count(),
    prisma.payment.aggregate({
      where: { status: 'PAID', yearlyProgramSubscriptionId: { not: null } },
      _sum: { amount: true },
    }),
    getYearlyGraceDays(prisma),
    getYearlyProgramSettings(prisma),
  ]);
  const countByStatus = (st: string) =>
    statusCounts.find((s) => s.status === st)?._count._all ?? 0;

  const summary: SummaryData = {
    total: totalAggr,
    active: countByStatus('ACTIVE'),
    grace: countByStatus('GRACE'),
    expired: countByStatus('EXPIRED'),
    cancelled: countByStatus('CANCELLED'),
    revenueTotal: revenueAggr._sum.amount ?? 0,
  };

  return (
    <YearlyProgramView
      rows={rows}
      summary={summary}
      cohorts={cohortList}
      graceDays={graceDays}
      programSettings={programSettings}
      programDefaults={YEARLY_PROGRAM_DEFAULTS}
    />
  );
}
