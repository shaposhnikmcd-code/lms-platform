import prisma from "@/lib/prisma";
import AdminDashboardView from "./_components/AdminDashboardView";

const CONNECTOR_STANDARD_PRICE = 1099;
const CONNECTOR_ADMIN_TEST_PRICE = 1;

const PERIOD_OPTIONS: { value: string; label: string; days: number }[] = [
  { value: '7d', label: '7д', days: 7 },
  { value: '30d', label: '1 міс.', days: 30 },
  { value: '3m', label: '3 міс.', days: 90 },
  { value: '6m', label: '6 міс.', days: 180 },
  { value: '1y', label: '1 Рік', days: 365 },
];

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period } = await searchParams;
  const activePeriod = PERIOD_OPTIONS.find(p => p.value === period) ?? PERIOD_OPTIONS[1];
  const periodCutoff = new Date(Date.now() - activePeriod.days * 24 * 60 * 60 * 1000);

  const [
    connectorOrders,
    connectorPendingPayment,
    bundleSuspended,
    bundleDraft,
    bundleActive,
    bundlePaymentsInPeriod,
    coursePaymentsInPeriod,
    yearlyPaymentsInPeriod,
    coursePublishedCount,
    newsPublishedCount,
    userCount,
    yearlyActiveCount,
    paymentPendingCount,
  ] = await Promise.all([
    prisma.connectorOrder.findMany({
      select: {
        amount: true,
        gamePrice: true,
        paymentStatus: true,
        orderStatus: true,
        createdAt: true,
        updatedAt: true,
        paidAt: true,
      },
    }),
    prisma.connectorOrder.count({
      where: { paymentStatus: 'PENDING' },
    }),
    prisma.bundle.count({ where: { suspendedAt: { not: null } } }),
    prisma.bundle.count({ where: { published: false } }),
    prisma.bundle.count({ where: { published: true, suspendedAt: null } }),
    prisma.payment.findMany({
      where: {
        status: 'PAID',
        bundleId: { not: null },
        createdAt: { gte: periodCutoff },
      },
      select: { amount: true },
    }),
    prisma.payment.findMany({
      where: {
        status: 'PAID',
        courseId: { not: null },
        createdAt: { gte: periodCutoff },
      },
      select: { amount: true },
    }),
    prisma.payment.findMany({
      where: {
        status: 'PAID',
        yearlyProgramSubscriptionId: { not: null },
        createdAt: { gte: periodCutoff },
      },
      select: {
        amount: true,
        yearlyProgramSubscription: {
          select: { plan: true, autoRenew: true },
        },
      },
    }),
    prisma.course.count({ where: { published: true } }),
    prisma.news.count({ where: { published: true } }),
    prisma.user.count(),
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
    if (o.createdAt < periodCutoff) return false;
    const price = o.gamePrice ?? CONNECTOR_STANDARD_PRICE;
    return price !== CONNECTOR_STANDARD_PRICE && price !== CONNECTOR_ADMIN_TEST_PRICE;
  }).length;

  const summarize = (items: { amount: number }[]) => {
    const count = items.length;
    const sum = items.reduce((s, p) => s + p.amount, 0);
    const avg = count ? Math.round(sum / count) : 0;
    return { count, sum, avg };
  };

  const connectorPaidInPeriod = connectorOrders.filter(
    o => o.paymentStatus === 'PAID' && o.createdAt >= periodCutoff,
  );
  const yearlyYearlyItems = yearlyPaymentsInPeriod.filter(
    p => p.yearlyProgramSubscription?.plan === 'YEARLY',
  );
  const yearlyMonthlyOnceItems = yearlyPaymentsInPeriod.filter(
    p =>
      p.yearlyProgramSubscription?.plan === 'MONTHLY' &&
      p.yearlyProgramSubscription?.autoRenew === false,
  );
  const yearlyMonthlyAutoItems = yearlyPaymentsInPeriod.filter(
    p =>
      p.yearlyProgramSubscription?.plan === 'MONTHLY' &&
      p.yearlyProgramSubscription?.autoRenew === true,
  );

  const salesBuckets = {
    courses: summarize(coursePaymentsInPeriod),
    bundles: summarize(bundlePaymentsInPeriod),
    yearlyYearly: summarize(yearlyYearlyItems),
    yearlyMonthlyOnce: summarize(yearlyMonthlyOnceItems),
    yearlyMonthlyAuto: summarize(yearlyMonthlyAutoItems),
    connector: summarize(connectorPaidInPeriod.map(o => ({ amount: o.amount }))),
  };

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
        salesBuckets,
        activePeriodValue: activePeriod.value,
        activePeriodLabel: activePeriod.label,
        connectorAwaitingManager,
        connectorPendingPayment,
        connectorNonStandard,
        connectorStuckNew,
        connectorStuckProcessing,
        bundleSuspended,
        connectorStandardPrice: CONNECTOR_STANDARD_PRICE,
        periodOptions: PERIOD_OPTIONS.map(({ value, label }) => ({ value, label })),
        sectionBadges,
      }}
    />
  );
}
