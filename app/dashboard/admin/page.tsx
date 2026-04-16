import prisma from "@/lib/prisma";
import AdminDashboardView from "./_components/AdminDashboardView";

const CONNECTOR_STANDARD_PRICE = 1099;
const CONNECTOR_ADMIN_TEST_PRICE = 1;

const PERIOD_OPTIONS: { value: string; label: string; days: number }[] = [
  { value: '7d', label: '7д', days: 7 },
  { value: '30d', label: '30д', days: 30 },
  { value: '3m', label: '3м', days: 90 },
  { value: '6m', label: '6м', days: 180 },
  { value: '1y', label: 'Рік', days: 365 },
];

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period } = await searchParams;
  const connectorPeriod = PERIOD_OPTIONS.find(p => p.value === period) ?? PERIOD_OPTIONS[1];
  const connectorCutoff = new Date(Date.now() - connectorPeriod.days * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    totalNews,
    recentPayments,
    monthRevenue,
    connectorOrders,
    connectorPendingPayment,
    bundles,
    bundlePaymentsMonth,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.news.count(),
    prisma.payment.count({
      where: { status: 'PAID', createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.payment.aggregate({
      where: { status: 'PAID', createdAt: { gte: thirtyDaysAgo } },
      _sum: { amount: true },
    }),
    prisma.connectorOrder.findMany({
      select: {
        id: true,
        amount: true,
        gamePrice: true,
        paymentStatus: true,
        orderStatus: true,
        createdAt: true,
      },
    }),
    prisma.connectorOrder.count({
      where: { paymentStatus: 'PENDING' },
    }),
    prisma.bundle.findMany({
      select: {
        id: true,
        title: true,
        published: true,
        suspendedAt: true,
      },
    }),
    prisma.payment.findMany({
      where: {
        status: 'PAID',
        bundleId: { not: null },
        createdAt: { gte: thirtyDaysAgo },
      },
      select: { amount: true, bundleId: true },
    }),
  ]);

  const connectorInPeriod = connectorOrders.filter(o => o.createdAt >= connectorCutoff);
  const connectorAwaitingManager = connectorOrders.filter(
    o => o.orderStatus === 'NEW' && o.paymentStatus === 'PAID'
  ).length;
  const connectorRevenueInPeriod = connectorInPeriod
    .filter(o => o.paymentStatus === 'PAID')
    .reduce((sum, o) => sum + o.amount, 0);
  const connectorNonStandard = connectorInPeriod.filter(o => {
    if (o.paymentStatus !== 'PAID') return false;
    const price = o.gamePrice ?? CONNECTOR_STANDARD_PRICE;
    return price !== CONNECTOR_STANDARD_PRICE && price !== CONNECTOR_ADMIN_TEST_PRICE;
  }).length;

  const connectorStatusCounts: Record<'NEW' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED', number> = {
    NEW: 0, PROCESSING: 0, SHIPPED: 0, DELIVERED: 0, CANCELLED: 0,
  };
  for (const o of connectorInPeriod) connectorStatusCounts[o.orderStatus]++;

  const bundleActive = bundles.filter(b => b.published && !b.suspendedAt).length;
  const bundleSuspended = bundles.filter(b => !!b.suspendedAt).length;
  const bundleDraft = bundles.filter(b => !b.published).length;
  const bundleSalesCount = bundlePaymentsMonth.length;
  const bundleRevenue30d = bundlePaymentsMonth.reduce((sum, p) => sum + p.amount, 0);

  const bundleSalesByBundle = new Map<string, number>();
  for (const p of bundlePaymentsMonth) {
    if (!p.bundleId) continue;
    bundleSalesByBundle.set(p.bundleId, (bundleSalesByBundle.get(p.bundleId) || 0) + 1);
  }
  let topBundle: { title: string; count: number } | null = null;
  for (const [id, count] of bundleSalesByBundle) {
    if (!topBundle || count > topBundle.count) {
      const b = bundles.find(x => x.id === id);
      if (b) topBundle = { title: b.title, count };
    }
  }

  return (
    <AdminDashboardView
      data={{
        totalUsers,
        totalNews,
        recentPayments,
        monthRevenueValue: monthRevenue._sum.amount ?? 0,
        connectorPeriodValue: connectorPeriod.value,
        connectorPeriodLabel: connectorPeriod.label,
        connectorAwaitingManager,
        connectorPendingPayment,
        connectorNonStandard,
        connectorInPeriodCount: connectorInPeriod.length,
        connectorRevenueInPeriod,
        connectorStatusCounts,
        bundleActive,
        bundleSuspended,
        bundleDraft,
        bundleSalesCount,
        bundleRevenue30d,
        topBundle,
        connectorStandardPrice: CONNECTOR_STANDARD_PRICE,
        periodOptions: PERIOD_OPTIONS.map(({ value, label }) => ({ value, label })),
      }}
    />
  );
}
