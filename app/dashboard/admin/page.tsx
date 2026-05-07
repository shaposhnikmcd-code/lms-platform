import prisma from "@/lib/prisma";
import AdminDashboardView from "./_components/AdminDashboardView";
import { getSalesAnalytics, type SalesPeriod } from "@/lib/admin-sales-analytics";
import { getSalesByProduct } from "@/lib/admin-sales-by-product";

const CONNECTOR_STANDARD_PRICE = 1099;
const CONNECTOR_ADMIN_TEST_PRICE = 1;

const PERIOD_OPTIONS: { value: SalesPeriod; label: string }[] = [
  { value: '1m', label: '1 міс.' },
  { value: '3m', label: '3 міс.' },
  { value: '6m', label: '6 міс.' },
  { value: '1y', label: '1 рік' },
  { value: 'all', label: 'Весь період' },
];

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; productPeriod?: string }>;
}) {
  const { period, productPeriod } = await searchParams;
  const activePeriod = PERIOD_OPTIONS.find(p => p.value === period) ?? PERIOD_OPTIONS[0];
  /// Окремий фільтр для блоку «Продажі по продуктах». Default = 'all' (вимога користувача).
  const activeProductPeriod = PERIOD_OPTIONS.find(p => p.value === productPeriod)
    ?? PERIOD_OPTIONS.find(p => p.value === 'all')!;

  const [
    series,
    productSales,
    connectorOrders,
    connectorPendingPayment,
    bundleSuspended,
    bundleDraft,
    bundleActive,
    coursePublishedCount,
    newsPublishedCount,
    userCount,
    yearlyActiveCount,
    paymentPendingCount,
  ] = await Promise.all([
    getSalesAnalytics(activePeriod.value),
    getSalesByProduct(activeProductPeriod.value),
    prisma.connectorOrder.findMany({
      select: {
        gamePrice: true,
        paymentStatus: true,
        orderStatus: true,
        createdAt: true,
        updatedAt: true,
        paidAt: true,
      },
    }),
    prisma.connectorOrder.count({ where: { paymentStatus: 'PENDING' } }),
    prisma.bundle.count({ where: { suspendedAt: { not: null } } }),
    prisma.bundle.count({ where: { published: false } }),
    prisma.bundle.count({ where: { published: true, suspendedAt: null } }),
    prisma.course.count({ where: { published: true } }),
    prisma.news.count({ where: { published: true } }),
    prisma.user.count({ where: { deletedAt: null, role: { in: ['ADMIN', 'MANAGER'] } } }),
    prisma.yearlyProgramSubscription.count({
      where: { status: { in: ['ACTIVE', 'GRACE'] } },
    }),
    prisma.payment.count({ where: { status: 'PENDING' } }),
  ]);

  const connectorAwaitingManager = connectorOrders.filter(
    o => o.orderStatus === 'NEW' && o.paymentStatus === 'PAID',
  ).length;
  const now = Date.now();
  const STUCK_NEW_MS = 12 * 60 * 60 * 1000;
  const STUCK_PROCESSING_MS = 24 * 60 * 60 * 1000;
  const connectorStuckNew = connectorOrders.filter(o => {
    if (o.orderStatus !== 'NEW' || o.paymentStatus !== 'PAID') return false;
    const since = (o.paidAt ?? o.createdAt).getTime();
    return now - since > STUCK_NEW_MS;
  }).length;
  const connectorStuckProcessing = connectorOrders.filter(o => {
    if (o.orderStatus !== 'PROCESSING') return false;
    return now - o.updatedAt.getTime() > STUCK_PROCESSING_MS;
  }).length;
  const connectorNonStandard = connectorOrders.filter(o => {
    if (o.paymentStatus !== 'PAID') return false;
    if (o.createdAt < series.rangeStart || o.createdAt > series.rangeEnd) return false;
    const price = o.gamePrice ?? CONNECTOR_STANDARD_PRICE;
    return price !== CONNECTOR_STANDARD_PRICE && price !== CONNECTOR_ADMIN_TEST_PRICE;
  }).length;

  /// Бейджі на картках у «Швидкі дії». Показуємо лише той, що варто уваги
  /// (`warning` — залипли замовлення/платежі; інакше нейтральна загальна цифра).
  type BadgeTone = 'neutral' | 'warning' | 'success';
  type Badge = { value: string; tone: BadgeTone } | null;
  const bundlesBadge: Badge = bundleSuspended > 0
    ? { value: `${bundleSuspended} призупинено`, tone: 'warning' }
    : bundleDraft > 0
      ? { value: `${bundleDraft} чернет.`, tone: 'neutral' }
      : bundleActive > 0
        ? { value: `${bundleActive}`, tone: 'neutral' }
        : null;
  const connectorBadgeTotal = connectorAwaitingManager + connectorPendingPayment;
  const connectorBadge: Badge = connectorBadgeTotal > 0
    ? { value: `${connectorBadgeTotal} чекає`, tone: 'warning' }
    : null;
  const paymentsBadge: Badge = paymentPendingCount > 0
    ? { value: `${paymentPendingCount} pending`, tone: 'warning' }
    : null;
  const yearlyBadge: Badge = yearlyActiveCount > 0
    ? { value: `${yearlyActiveCount}`, tone: 'success' }
    : null;

  const sectionBadges = {
    courses: coursePublishedCount > 0 ? { value: `${coursePublishedCount}`, tone: 'neutral' as const } : null,
    bundles: bundlesBadge,
    yearlyProgram: yearlyBadge,
    connector: connectorBadge,
    news: newsPublishedCount > 0 ? { value: `${newsPublishedCount}`, tone: 'neutral' as const } : null,
    payments: paymentsBadge,
    users: userCount > 0 ? { value: `${userCount}`, tone: 'neutral' as const } : null,
  };

  return (
    <AdminDashboardView
      data={{
        series,
        productSales,
        activeProductPeriodValue: activeProductPeriod.value,
        salesBuckets: series.kpi,
        activePeriodValue: activePeriod.value,
        activePeriodLabel: activePeriod.label,
        connectorAwaitingManager,
        connectorPendingPayment,
        connectorNonStandard,
        connectorStuckNew,
        connectorStuckProcessing,
        bundleSuspended,
        connectorStandardPrice: CONNECTOR_STANDARD_PRICE,
        periodOptions: PERIOD_OPTIONS,
        sectionBadges,
      }}
    />
  );
}
