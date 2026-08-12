import prisma from "@/lib/prisma";
import AdminDashboardView from "./_components/AdminDashboardView";
import { getSalesAnalytics, type SalesPeriod } from "@/lib/admin-sales-analytics";
import { getSalesByProduct } from "@/lib/admin-sales-by-product";
import { getDiscountedPayments } from "@/lib/admin-discounted-payments";

const CONNECTOR_STANDARD_PRICE = 1099;
const CONNECTOR_ADMIN_TEST_PRICE = 1;

const PERIOD_OPTIONS: { value: SalesPeriod; label: string }[] = [
  { value: '30d', label: 'Останні 30 днів' },
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
  /// Окремий фільтр для блоку «Продажі по продуктах». Default = '30d' (останні 30 днів).
  const activeProductPeriod = PERIOD_OPTIONS.find(p => p.value === productPeriod)
    ?? PERIOD_OPTIONS.find(p => p.value === '30d')!;

  /// Пороги «залипання» замовлень конектора (від оплати / від останньої зміни статусу).
  const now = Date.now();
  const STUCK_NEW_MS = 12 * 60 * 60 * 1000;
  const STUCK_PROCESSING_MS = 24 * 60 * 60 * 1000;
  const stuckNewCutoff = new Date(now - STUCK_NEW_MS);
  const stuckProcessingCutoff = new Date(now - STUCK_PROCESSING_MS);

  const [
    series,
    productSales,
    connectorAwaitingManager,
    connectorStuckNew,
    connectorStuckProcessing,
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
    // Раніше тут тягнулась УСЯ таблиця connectorOrder, щоб порахувати 4 числа
    // в памʼяті — з ростом замовлень це лінійно важчало на кожному відкритті
    // дашборду. Тепер рахує БД (кожен count лягає на існуючі індекси
    // orderStatus/paymentStatus).
    prisma.connectorOrder.count({
      where: { orderStatus: 'NEW', paymentStatus: 'PAID' },
    }),
    prisma.connectorOrder.count({
      where: {
        orderStatus: 'NEW',
        paymentStatus: 'PAID',
        // «Вік» замовлення рахується від оплати, а якщо paidAt порожній — від створення.
        OR: [
          { paidAt: { lt: stuckNewCutoff } },
          { paidAt: null, createdAt: { lt: stuckNewCutoff } },
        ],
      },
    }),
    prisma.connectorOrder.count({
      where: { orderStatus: 'PROCESSING', updatedAt: { lt: stuckProcessingCutoff } },
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

  // Залежить від періоду (series.rangeStart/End), тому рахується після Promise.all.
  // `gamePrice: null` трактується як стандартна ціна → notIn відкидає NULL так само,
  // як це робив старий in-memory фільтр (`o.gamePrice ?? STANDARD`).
  const [connectorNonStandard, discountedPayments] = await Promise.all([
    prisma.connectorOrder.count({
      where: {
        paymentStatus: 'PAID',
        createdAt: { gte: series.rangeStart, lte: series.rangeEnd },
        gamePrice: { notIn: [CONNECTOR_STANDARD_PRICE, CONNECTOR_ADMIN_TEST_PRICE] },
      },
    }),
    getDiscountedPayments(series.rangeStart, series.rangeEnd),
  ]);

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
        discountedPayments,
        connectorStandardPrice: CONNECTOR_STANDARD_PRICE,
        periodOptions: PERIOD_OPTIONS,
        sectionBadges,
      }}
    />
  );
}
