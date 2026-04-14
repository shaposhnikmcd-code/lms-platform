import { FaUsers, FaChartLine } from "react-icons/fa";
import { HiOutlineCurrencyDollar, HiOutlineUserGroup, HiOutlineBookOpen, HiOutlineNewspaper, HiOutlineChartBar, HiOutlineCreditCard, HiOutlinePuzzlePiece, HiOutlineExclamationTriangle, HiOutlineClock, HiOutlinePause } from "react-icons/hi2";
import Link from "next/link";
import prisma from "@/lib/prisma";
import SyncDivisionsButton from "./_components/SyncDivisionsButton";

const CONNECTOR_STANDARD_PRICE = 1099;
const CONNECTOR_ADMIN_TEST_PRICE = 1;

const PERIOD_OPTIONS: { value: string; label: string; days: number }[] = [
  { value: '7d', label: '7 днів', days: 7 },
  { value: '30d', label: '30 днів', days: 30 },
  { value: '3m', label: '3 місяці', days: 90 },
  { value: '6m', label: '6 місяців', days: 180 },
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

  // ---------- Connector metrics (filtered by selected period) ----------
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

  // Order-status breakdown for selected period
  const connectorStatusCounts: Record<'NEW' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED', number> = {
    NEW: 0, PROCESSING: 0, SHIPPED: 0, DELIVERED: 0, CANCELLED: 0,
  };
  for (const o of connectorInPeriod) connectorStatusCounts[o.orderStatus]++;

  // ---------- Bundle metrics ----------
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

  const stats = [
    {
      icon: FaUsers,
      label: 'Користувачів',
      value: totalUsers.toLocaleString(),
      accent: 'from-indigo-500/15 to-indigo-500/5',
      iconColor: 'text-indigo-600',
      iconBg: 'bg-indigo-50',
      ring: 'ring-indigo-100',
    },
    {
      icon: HiOutlineNewspaper,
      label: 'Новин',
      value: totalNews.toLocaleString(),
      accent: 'from-rose-500/15 to-rose-500/5',
      iconColor: 'text-rose-600',
      iconBg: 'bg-rose-50',
      ring: 'ring-rose-100',
    },
    {
      icon: HiOutlineCurrencyDollar,
      label: 'Дохід (місяць)',
      value: `${(monthRevenue._sum.amount || 0).toLocaleString()} ₴`,
      accent: 'from-amber-500/15 to-amber-500/5',
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-50',
      ring: 'ring-amber-100',
    },
    {
      icon: FaChartLine,
      label: 'Продажів за місяць',
      value: recentPayments.toLocaleString(),
      accent: 'from-sky-500/15 to-sky-500/5',
      iconColor: 'text-sky-600',
      iconBg: 'bg-sky-50',
      ring: 'ring-sky-100',
    },
  ];

  const quickActions = [
    { href: '/dashboard/admin/bundles', label: 'Пакети', desc: 'Пакети курсів зі знижкою', icon: HiOutlineBookOpen, color: 'text-violet-600', bg: 'bg-violet-50' },
    { href: '/dashboard/admin/news', label: 'Новини', desc: 'Публікації та чернетки', icon: HiOutlineNewspaper, color: 'text-rose-600', bg: 'bg-rose-50' },
    { href: '/dashboard/admin/analytics', label: 'Аналітика', desc: 'Метрики та звіти', icon: HiOutlineChartBar, color: 'text-sky-600', bg: 'bg-sky-50' },
    { href: '/dashboard/admin/payments', label: 'Платежі', desc: 'Транзакції та статуси', icon: HiOutlineCreditCard, color: 'text-amber-600', bg: 'bg-amber-50' },
    { href: '/dashboard/admin/payment-logs', label: 'Логи платежів', desc: 'Всі WayForPay callback-и', icon: HiOutlineClock, color: 'text-slate-600', bg: 'bg-slate-50' },
    { href: '/dashboard/admin/users', label: 'Користувачі', desc: 'Керування акаунтами та ролями', icon: HiOutlineUserGroup, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Адмін-панель</h1>
          <p className="text-sm text-slate-500 mt-0.5">Огляд стану платформи та швидкий доступ до розділів</p>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 ring-1 ring-emerald-100 text-[11px] font-medium text-emerald-700">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Система працює
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {stats.map((stat, i) => (
          <div
            key={i}
            className="relative overflow-hidden bg-white rounded-xl border border-slate-200/70 px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:shadow-[0_6px_18px_-12px_rgba(15,23,42,0.15)] hover:-translate-y-0.5 transition-all duration-300"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.accent} pointer-events-none`} />
            <div className="relative flex items-center gap-3">
              <div className={`w-10 h-10 ${stat.iconBg} ring-1 ${stat.ring} rounded-xl flex items-center justify-center flex-shrink-0`}>
                <stat.icon className={`text-base ${stat.iconColor}`} />
              </div>
              <div className="min-w-0">
                <div className="text-xl font-bold text-slate-800 tracking-tight tabular-nums leading-none mb-1">{stat.value}</div>
                <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wider truncate">{stat.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Connector + Bundles stacked */}
        <div className="lg:col-span-2 space-y-6">
          {/* Connector block */}
          <div className="bg-white rounded-2xl border border-slate-200/70 p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-orange-50 ring-1 ring-orange-100 rounded-lg flex items-center justify-center">
                  <HiOutlinePuzzlePiece className="text-orange-600 text-base" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-800">Коннектор</h2>
                  <p className="text-[11px] text-slate-500">Гра — замовлення та ризики</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="inline-flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5">
                  {PERIOD_OPTIONS.map(opt => {
                    const active = opt.value === connectorPeriod.value;
                    return (
                      <Link
                        key={opt.value}
                        href={`/dashboard/admin?period=${opt.value}`}
                        scroll={false}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                          active
                            ? 'bg-white text-slate-800 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {opt.label}
                      </Link>
                    );
                  })}
                </div>
                <Link
                  href="/dashboard/manager"
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                >
                  Замовлення →
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricTile
                label="Очікують менеджера"
                value={connectorAwaitingManager}
                Icon={HiOutlineExclamationTriangle}
                tone={connectorAwaitingManager > 0 ? 'warning' : 'neutral'}
              />
              <MetricTile
                label={`За ${connectorPeriod.label.toLowerCase()}`}
                value={`${connectorInPeriod.length} / ${connectorRevenueInPeriod.toLocaleString()} ₴`}
                Icon={HiOutlineCurrencyDollar}
                tone="neutral"
                compact
              />
              <MetricTile
                label="Не за стандартом"
                value={connectorNonStandard}
                hint={connectorNonStandard > 0 ? `≠ ${CONNECTOR_STANDARD_PRICE}₴` : undefined}
                Icon={HiOutlineExclamationTriangle}
                tone={connectorNonStandard > 0 ? 'danger' : 'neutral'}
              />
              <MetricTile
                label="Очікують оплати"
                value={connectorPendingPayment}
                Icon={HiOutlineClock}
                tone={connectorPendingPayment > 0 ? 'warning' : 'neutral'}
              />
            </div>

            <div className="mt-3 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mr-1">Статуси:</span>
                <StatusPill label="Нові" value={connectorStatusCounts.NEW} dot="bg-sky-500" />
                <StatusPill label="В обробці" value={connectorStatusCounts.PROCESSING} dot="bg-amber-500" />
                <StatusPill label="Відправлено" value={connectorStatusCounts.SHIPPED} dot="bg-indigo-500" />
                <StatusPill label="Доставлено" value={connectorStatusCounts.DELIVERED} dot="bg-emerald-500" />
                <StatusPill label="Скасовано" value={connectorStatusCounts.CANCELLED} dot="bg-rose-500" />
              </div>
            </div>
          </div>

          {/* Bundles block */}
          <div className="bg-white rounded-2xl border border-slate-200/70 p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-violet-50 ring-1 ring-violet-100 rounded-lg flex items-center justify-center">
                  <HiOutlineBookOpen className="text-violet-600 text-base" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-800">Пакети курсів</h2>
                  <p className="text-[11px] text-slate-500">Стан і продажі</p>
                </div>
              </div>
              <Link
                href="/dashboard/admin/bundles"
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                Всі пакети →
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <MetricTile label="Активні" value={bundleActive} tone="success" />
              <MetricTile
                label="Призупинено"
                value={bundleSuspended}
                Icon={HiOutlinePause}
                tone={bundleSuspended > 0 ? 'warning' : 'neutral'}
              />
              <MetricTile label="Чернетки" value={bundleDraft} tone="neutral" />
              <MetricTile
                label="За 30 днів"
                value={`${bundleSalesCount} / ${bundleRevenue30d.toLocaleString()} ₴`}
                tone="neutral"
                compact
              />
            </div>

            {topBundle ? (
              <div className="relative overflow-hidden flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-violet-50 via-violet-50/70 to-white ring-1 ring-violet-100">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-violet-600 text-white text-sm shadow-sm shadow-violet-500/30">
                  ★
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-violet-700">Топ пакет за 30 днів</div>
                  <div className="text-sm font-semibold text-slate-800 truncate">{topBundle.title}</div>
                </div>
                <span className="inline-flex items-baseline gap-1 text-violet-700 tabular-nums flex-shrink-0">
                  <span className="text-lg font-bold">{topBundle.count}</span>
                  <span className="text-[11px] font-medium">прод.</span>
                </span>
              </div>
            ) : (
              <div className="px-4 py-3 rounded-xl bg-slate-50/60 ring-1 ring-slate-100 text-xs text-slate-400">
                Немає продажів пакетів за 30 днів
              </div>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="bg-white rounded-2xl border border-slate-200/70 p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] self-start">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-semibold text-slate-800">Швидкі дії</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">Перехід до розділів</p>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 tabular-nums">{quickActions.length}</span>
          </div>

          <div className="space-y-1">
            {quickActions.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="group flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-slate-50 transition-colors"
              >
                <div className={`w-9 h-9 ${a.bg} rounded-lg flex items-center justify-center flex-shrink-0 ring-1 ring-inset ring-white/60 group-hover:scale-[1.03] transition-transform`}>
                  <a.icon className={`text-lg ${a.color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-700 group-hover:text-slate-900 leading-tight">{a.label}</div>
                  <div className="text-[11px] text-slate-400 truncate mt-0.5">{a.desc}</div>
                </div>
                <span className="text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all text-sm">→</span>
              </Link>
            ))}
          </div>

          <div className="mt-5 pt-5 border-t border-slate-100">
            <SyncDivisionsButton />
          </div>
        </div>
      </div>
    </div>
  );
}

type Tone = 'neutral' | 'success' | 'warning' | 'danger';

function MetricTile({
  label,
  value,
  hint,
  Icon,
  tone = 'neutral',
  compact = false,
}: {
  label: string;
  value: string | number;
  hint?: string;
  Icon?: React.ComponentType<{ className?: string }>;
  tone?: Tone;
  compact?: boolean;
}) {
  const toneStyles: Record<Tone, { bg: string; ring: string; valueColor: string }> = {
    neutral: { bg: 'bg-slate-50/60', ring: 'ring-slate-100', valueColor: 'text-slate-800' },
    success: { bg: 'bg-emerald-50/60', ring: 'ring-emerald-100', valueColor: 'text-emerald-700' },
    warning: { bg: 'bg-amber-50', ring: 'ring-amber-200', valueColor: 'text-amber-700' },
    danger: { bg: 'bg-rose-50', ring: 'ring-rose-200', valueColor: 'text-rose-700' },
  };
  const t = toneStyles[tone];
  return (
    <div className={`${t.bg} ring-1 ${t.ring} rounded-xl px-3 py-2.5`}>
      <div className="flex items-center gap-1.5 mb-1">
        {Icon && <Icon className="text-xs text-slate-500" />}
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 truncate">{label}</span>
      </div>
      <div className={`${compact ? 'text-xs' : 'text-lg'} font-bold ${t.valueColor} tabular-nums leading-tight`}>
        {value}
      </div>
      {hint && <p className="text-[10px] text-slate-500 mt-0.5 tabular-nums">{hint}</p>}
    </div>
  );
}

function StatusPill({ label, value, dot }: { label: string; value: number; dot: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-50/80 ring-1 ring-slate-200 text-[11px]">
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold text-slate-800 tabular-nums">{value}</span>
    </span>
  );
}
