import prisma from '@/lib/prisma';
import YearlyProgramView, { type Row, type SummaryData } from './_components/YearlyProgramView';

export default async function AdminYearlyProgramPage() {
  const subs = await prisma.yearlyProgramSubscription.findMany({
    orderBy: { createdAt: 'desc' },
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

  const summary: SummaryData = {
    total: subs.length,
    active: subs.filter((s) => s.status === 'ACTIVE').length,
    grace: subs.filter((s) => s.status === 'GRACE').length,
    expired: subs.filter((s) => s.status === 'EXPIRED').length,
    cancelled: subs.filter((s) => s.status === 'CANCELLED').length,
    revenueTotal: rows.reduce((sum, r) => sum + r.totalPaid, 0),
  };

  return <YearlyProgramView rows={rows} summary={summary} />;
}
