import prisma from '@/lib/prisma';
import YearlyProgramView, { type Row, type SummaryData } from './_components/YearlyProgramView';

const MAX_ROWS = 500;

export default async function AdminYearlyProgramPage() {
  const subs = await prisma.yearlyProgramSubscription.findMany({
    orderBy: { createdAt: 'desc' },
    take: MAX_ROWS,
    include: {
      user: { select: { id: true, name: true, email: true } },
      payments: { select: { id: true, amount: true, status: true, createdAt: true, paidAt: true } },
    },
  });

  const now = Date.now();

  const rows: Row[] = subs.map((s) => {
    const paidPayments = s.payments.filter((p) => p.status === 'PAID');
    const totalPaid = paidPayments.reduce((sum, p) => sum + p.amount, 0);
    const msLeft = s.expiresAt ? s.expiresAt.getTime() - now : null;
    const daysLeft = msLeft !== null ? Math.ceil(msLeft / (24 * 60 * 60 * 1000)) : null;

    return {
      id: s.id,
      createdAt: s.createdAt.toISOString(),
      userName: s.user?.name ?? null,
      userEmail: s.user?.email ?? '',
      plan: s.plan,
      status: s.status,
      startDate: s.startDate?.toISOString() ?? null,
      expiresAt: s.expiresAt?.toISOString() ?? null,
      daysLeft,
      cancelledAt: s.cancelledAt?.toISOString() ?? null,
      cancelledBy: s.cancelledBy,
      lastPaymentAt: s.lastPaymentAt?.toISOString() ?? null,
      failedChargeCount: s.failedChargeCount,
      lastChargeError: s.lastChargeError,
      hasRecToken: !!s.recToken,
      sendpulseStudentId: s.sendpulseStudentId,
      sendpulseAccessOpenedAt: s.sendpulseAccessOpenedAt?.toISOString() ?? null,
      sendpulseAccessClosedAt: s.sendpulseAccessClosedAt?.toISOString() ?? null,
      paymentsCount: paidPayments.length,
      totalPaid,
    };
  });

  // Summary рахуємо через groupBy у БД — щоб KPI були точні навіть якщо subs > MAX_ROWS.
  const [statusCounts, totalAggr, revenueAggr] = await Promise.all([
    prisma.yearlyProgramSubscription.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
    prisma.yearlyProgramSubscription.count(),
    prisma.payment.aggregate({
      where: { status: 'PAID', yearlyProgramSubscriptionId: { not: null } },
      _sum: { amount: true },
    }),
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

  return <YearlyProgramView rows={rows} summary={summary} />;
}
