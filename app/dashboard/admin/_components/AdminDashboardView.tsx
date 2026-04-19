'use client';

import Link from 'next/link';
import {
  HiOutlineUserGroup,
  HiOutlineBookOpen,
  HiOutlineNewspaper,
  HiOutlineChartBar,
  HiOutlineCreditCard,
  HiOutlineExclamationTriangle,
  HiOutlineClock,
  HiOutlineUsers,
  HiOutlineArrowRight,
  HiOutlineSparkles,
  HiOutlineCalendarDays,
  HiOutlineCubeTransparent,
} from 'react-icons/hi2';
import SyncDivisionsButton from './SyncDivisionsButton';
import { useAdminTheme, type Theme, type Tone } from './adminTheme';
import { AdminShell, AdminPanel } from './AdminShell';

type OrderStatus = 'NEW' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export type AdminDashboardData = {
  totalUsers: number;
  totalNews: number;
  recentPayments: number;
  monthRevenueValue: number;
  connectorPeriodValue: string;
  connectorPeriodLabel: string;
  connectorAwaitingManager: number;
  connectorPendingPayment: number;
  connectorNonStandard: number;
  connectorInPeriodCount: number;
  connectorRevenueInPeriod: number;
  connectorStatusCounts: Record<OrderStatus, number>;
  bundleActive: number;
  bundleSuspended: number;
  bundleDraft: number;
  bundleSalesCount: number;
  bundleRevenue30d: number;
  topBundle: { title: string; count: number } | null;
  connectorStandardPrice: number;
  periodOptions: { value: string; label: string }[];
};

export default function AdminDashboardView({ data }: { data: AdminDashboardData }) {
  const { theme, setTheme } = useAdminTheme();
  const dark = theme === 'dark';

  type AttentionTone = 'warning' | 'danger';
  const attentionItems: Array<{ label: string; count: number; href: string; tone: AttentionTone }> = [];
  if (data.connectorAwaitingManager > 0) {
    attentionItems.push({
      label: 'Коннектор очікує менеджера',
      count: data.connectorAwaitingManager,
      href: '/dashboard/manager',
      tone: 'warning',
    });
  }
  if (data.connectorPendingPayment > 0) {
    attentionItems.push({
      label: 'Коннектор — очікують оплати',
      count: data.connectorPendingPayment,
      href: '/dashboard/manager',
      tone: 'warning',
    });
  }
  if (data.connectorNonStandard > 0) {
    attentionItems.push({
      label: `Замовлення не за стандартом (≠ ${data.connectorStandardPrice}₴)`,
      count: data.connectorNonStandard,
      href: '/dashboard/manager',
      tone: 'danger',
    });
  }
  if (data.bundleSuspended > 0) {
    attentionItems.push({
      label: 'Пакети призупинено',
      count: data.bundleSuspended,
      href: '/dashboard/admin/bundles',
      tone: 'warning',
    });
  }

  const quickActions = [
    { href: '/dashboard/admin/courses', label: 'Курси', desc: 'Ціни курсів', icon: HiOutlineBookOpen },
    { href: '/dashboard/admin/bundles', label: 'Пакети', desc: 'Курси зі знижкою', icon: HiOutlineSparkles },
    { href: '/dashboard/admin/yearly-program', label: 'Річна програма', desc: 'Підписки та доступ', icon: HiOutlineCalendarDays },
    { href: '/dashboard/admin/connector', label: 'Конектор', desc: 'Замовлення гри', icon: HiOutlineCubeTransparent },
    { href: '/dashboard/admin/specialists', label: 'Спеціалісти', desc: 'Ціни та запис', icon: HiOutlineUsers },
    { href: '/dashboard/admin/news', label: 'Новини', desc: 'Публікації', icon: HiOutlineNewspaper },
    { href: '/dashboard/admin/analytics', label: 'Аналітика', desc: 'Метрики та звіти', icon: HiOutlineChartBar },
    { href: '/dashboard/admin/payments', label: 'Платежі', desc: 'Транзакції', icon: HiOutlineCreditCard },
    { href: '/dashboard/admin/payment-logs', label: 'Логи', desc: 'WayForPay callback-и', icon: HiOutlineClock },
    { href: '/dashboard/admin/users', label: 'Користувачі', desc: 'Акаунти та ролі', icon: HiOutlineUserGroup },
  ];

  return (
    <AdminShell
      theme={theme}
      setTheme={setTheme}
      eyebrow="Admin · Overview"
      title="Адмін-панель"
      subtitle="Все, що потрібно — на одному екрані. Зайшов, подивився, зробив, пішов."
      rightSlot={
        <div
          className={`hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] font-medium ${
            dark
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              : 'bg-emerald-600/10 border-emerald-600/25 text-emerald-800'
          }`}
        >
          <span className="relative flex w-1.5 h-1.5">
            <span
              className={`absolute inset-0 rounded-full animate-ping ${
                dark ? 'bg-emerald-400/60' : 'bg-emerald-500/70'
              }`}
            />
            <span
              className={`relative w-1.5 h-1.5 rounded-full ${
                dark ? 'bg-emerald-400' : 'bg-emerald-600'
              }`}
            />
          </span>
          Система працює
        </div>
      }
    >
      {/* Attention */}
      {attentionItems.length > 0 ? (
        <section
          className={`mb-6 rounded-2xl p-5 backdrop-blur-sm border ${
            dark
              ? 'bg-gradient-to-b from-amber-500/[0.08] to-transparent border-amber-500/20'
              : 'bg-gradient-to-b from-amber-300/25 to-amber-100/10 border-amber-500/30'
          }`}
        >
          <div className="flex items-center gap-2 mb-3.5">
            <HiOutlineExclamationTriangle className={`text-sm ${dark ? 'text-amber-400' : 'text-amber-700'}`} />
            <span
              className={`text-[10px] uppercase tracking-[0.2em] font-semibold ${
                dark ? 'text-amber-200/80' : 'text-amber-900'
              }`}
            >
              Потребує уваги
            </span>
            <span
              className={`ml-auto text-[10px] tabular-nums ${
                dark ? 'text-amber-200/50' : 'text-amber-800/70'
              }`}
            >
              {attentionItems.length}
            </span>
          </div>
          <div className="grid sm:grid-cols-2 gap-1">
            {attentionItems.map(item => (
              <Link
                key={item.label}
                href={item.href}
                className={`group flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  dark ? 'hover:bg-white/5' : 'hover:bg-white/60'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      item.tone === 'danger'
                        ? dark
                          ? 'bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.6)]'
                          : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]'
                        : dark
                          ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                          : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                    }`}
                  />
                  <span className={`text-[13px] truncate ${dark ? 'text-slate-200' : 'text-stone-800'}`}>
                    {item.label}
                  </span>
                </span>
                <span className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className={`text-[13px] font-semibold tabular-nums ${
                      item.tone === 'danger'
                        ? dark
                          ? 'text-rose-300'
                          : 'text-rose-700'
                        : dark
                          ? 'text-amber-300'
                          : 'text-amber-800'
                    }`}
                  >
                    {item.count}
                  </span>
                  <HiOutlineArrowRight
                    className={`text-sm group-hover:translate-x-0.5 transition-all ${
                      dark ? 'text-slate-500 group-hover:text-slate-200' : 'text-stone-400 group-hover:text-stone-700'
                    }`}
                  />
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <section
          className={`mb-6 rounded-2xl px-5 py-4 flex items-center gap-3 border ${
            dark
              ? 'bg-gradient-to-b from-emerald-500/[0.06] to-transparent border-emerald-500/15'
              : 'bg-gradient-to-b from-emerald-300/20 to-transparent border-emerald-500/25'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              dark
                ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)]'
                : 'bg-emerald-600 shadow-[0_0_10px_rgba(5,150,105,0.4)]'
            }`}
          />
          <span className={`text-[13px] ${dark ? 'text-slate-300' : 'text-stone-700'}`}>
            Все чисто — жодних активних попереджень.
          </span>
        </section>
      )}

      {/* KPI strip */}
      <div
        className={`mb-6 rounded-2xl grid grid-cols-2 lg:grid-cols-4 overflow-hidden backdrop-blur-sm border divide-y lg:divide-y-0 lg:divide-x ${
          dark
            ? 'bg-white/[0.03] border-white/[0.06] divide-white/[0.06]'
            : 'bg-white/55 border-stone-300/50 divide-stone-300/40 shadow-[0_1px_2px_rgba(68,64,60,0.04)]'
        }`}
      >
        <Kpi theme={theme} label="Користувачів" value={data.totalUsers.toLocaleString()} />
        <Kpi
          theme={theme}
          label="Дохід · 30д"
          value={`${data.monthRevenueValue.toLocaleString()} ₴`}
          hint={`${data.recentPayments} ${pluralize(data.recentPayments, ['продаж', 'продажі', 'продажів'])}`}
          glow
        />
        <Kpi
          theme={theme}
          label="Пакетів активно"
          value={data.bundleActive.toLocaleString()}
          hint={
            data.bundleDraft > 0
              ? `${data.bundleDraft} ${pluralize(data.bundleDraft, ['чернетка', 'чернетки', 'чернеток'])}`
              : undefined
          }
        />
        <Kpi theme={theme} label="Новин" value={data.totalNews.toLocaleString()} />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* Коннектор */}
          <AdminPanel theme={theme}>
            <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
              <div>
                <h2 className={`text-[15px] font-semibold tracking-tight ${dark ? 'text-white' : 'text-stone-900'}`}>
                  Коннектор
                </h2>
                <p className={`text-[12px] mt-0.5 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                  Гра — замовлення та ризики
                </p>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div
                  className={`inline-flex rounded-lg p-0.5 border ${
                    dark ? 'bg-black/30 border-white/[0.06]' : 'bg-stone-100/80 border-stone-300/50'
                  }`}
                >
                  {data.periodOptions.map(opt => {
                    const active = opt.value === data.connectorPeriodValue;
                    return (
                      <Link
                        key={opt.value}
                        href={`/dashboard/admin?period=${opt.value}`}
                        scroll={false}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all ${
                          active
                            ? dark
                              ? 'bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                              : 'bg-stone-900 text-white shadow-sm'
                            : dark
                              ? 'text-slate-500 hover:text-slate-200'
                              : 'text-stone-500 hover:text-stone-900'
                        }`}
                      >
                        {opt.label}
                      </Link>
                    );
                  })}
                </div>
                <Link
                  href="/dashboard/manager"
                  className={`inline-flex items-center gap-1 text-[12px] font-medium transition-colors ${
                    dark ? 'text-slate-400 hover:text-white' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Замовлення <HiOutlineArrowRight className="text-xs" />
                </Link>
              </div>
            </div>

            <div
              className={`grid grid-cols-2 md:grid-cols-4 rounded-xl overflow-hidden border divide-x divide-y md:divide-y-0 ${
                dark
                  ? 'bg-black/20 border-white/[0.04] divide-white/[0.04]'
                  : 'bg-stone-50/60 border-stone-200/70 divide-stone-200/70'
              }`}
            >
              <MiniStat
                theme={theme}
                label="Очікують менеджера"
                value={data.connectorAwaitingManager}
                tone={data.connectorAwaitingManager > 0 ? 'warning' : 'neutral'}
              />
              <MiniStat
                theme={theme}
                label={`За ${data.connectorPeriodLabel}`}
                value={`${data.connectorInPeriodCount} · ${data.connectorRevenueInPeriod.toLocaleString()} ₴`}
                small
              />
              <MiniStat
                theme={theme}
                label="Не за стандартом"
                value={data.connectorNonStandard}
                hint={data.connectorNonStandard > 0 ? `≠ ${data.connectorStandardPrice}₴` : undefined}
                tone={data.connectorNonStandard > 0 ? 'danger' : 'neutral'}
              />
              <MiniStat
                theme={theme}
                label="Очікують оплати"
                value={data.connectorPendingPayment}
                tone={data.connectorPendingPayment > 0 ? 'warning' : 'neutral'}
              />
            </div>

            <div className="mt-4 flex items-center gap-x-3 gap-y-1.5 flex-wrap">
              <span
                className={`text-[10px] uppercase tracking-[0.18em] font-medium ${
                  dark ? 'text-slate-600' : 'text-stone-500'
                }`}
              >
                Статуси
              </span>
              <StatusLabel theme={theme} label="Нові" value={data.connectorStatusCounts.NEW} dot="sky" />
              <StatusLabel theme={theme} label="В обробці" value={data.connectorStatusCounts.PROCESSING} dot="amber" />
              <StatusLabel theme={theme} label="Відправлено" value={data.connectorStatusCounts.SHIPPED} dot="indigo" />
              <StatusLabel theme={theme} label="Доставлено" value={data.connectorStatusCounts.DELIVERED} dot="emerald" />
              <StatusLabel theme={theme} label="Скасовано" value={data.connectorStatusCounts.CANCELLED} dot="rose" muted />
            </div>
          </AdminPanel>

          {/* Пакети */}
          <AdminPanel theme={theme}>
            <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
              <div>
                <h2 className={`text-[15px] font-semibold tracking-tight ${dark ? 'text-white' : 'text-stone-900'}`}>
                  Пакети курсів
                </h2>
                <p className={`text-[12px] mt-0.5 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                  Стан і продажі за 30 днів
                </p>
              </div>
              <Link
                href="/dashboard/admin/bundles"
                className={`inline-flex items-center gap-1 text-[12px] font-medium transition-colors ${
                  dark ? 'text-slate-400 hover:text-white' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Всі пакети <HiOutlineArrowRight className="text-xs" />
              </Link>
            </div>

            <div
              className={`grid grid-cols-2 md:grid-cols-4 rounded-xl overflow-hidden mb-4 border divide-x divide-y md:divide-y-0 ${
                dark
                  ? 'bg-black/20 border-white/[0.04] divide-white/[0.04]'
                  : 'bg-stone-50/60 border-stone-200/70 divide-stone-200/70'
              }`}
            >
              <MiniStat
                theme={theme}
                label="Активні"
                value={data.bundleActive}
                tone={data.bundleActive > 0 ? 'success' : 'neutral'}
              />
              <MiniStat
                theme={theme}
                label="Призупинено"
                value={data.bundleSuspended}
                tone={data.bundleSuspended > 0 ? 'warning' : 'neutral'}
              />
              <MiniStat theme={theme} label="Чернетки" value={data.bundleDraft} />
              <MiniStat
                theme={theme}
                label="За 30 днів"
                value={`${data.bundleSalesCount} · ${data.bundleRevenue30d.toLocaleString()} ₴`}
                small
              />
            </div>

            {data.topBundle ? (
              <div
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
                  dark
                    ? 'bg-gradient-to-r from-amber-500/[0.08] via-amber-500/[0.03] to-transparent border-amber-500/15'
                    : 'bg-gradient-to-r from-amber-300/30 via-amber-200/20 to-transparent border-amber-500/30'
                }`}
              >
                <span
                  className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] font-medium flex-shrink-0 ${
                    dark ? 'text-amber-300/80' : 'text-amber-800'
                  }`}
                >
                  <HiOutlineSparkles className="text-xs" />
                  Топ · 30д
                </span>
                <span
                  className={`text-[13px] font-medium truncate flex-1 ${
                    dark ? 'text-slate-100' : 'text-stone-900'
                  }`}
                >
                  {data.topBundle.title}
                </span>
                <span
                  className={`text-[13px] font-semibold tabular-nums flex-shrink-0 ${
                    dark ? 'text-amber-300' : 'text-amber-800'
                  }`}
                >
                  {data.topBundle.count} прод.
                </span>
              </div>
            ) : (
              <div
                className={`px-4 py-3 rounded-xl text-[12px] border ${
                  dark
                    ? 'bg-black/20 border-white/[0.04] text-slate-500'
                    : 'bg-stone-50/60 border-stone-200/70 text-stone-500'
                }`}
              >
                Немає продажів пакетів за 30 днів
              </div>
            )}
          </AdminPanel>
        </div>

        {/* Quick actions */}
        <AdminPanel theme={theme} className="self-start">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className={`text-[15px] font-semibold tracking-tight ${dark ? 'text-white' : 'text-stone-900'}`}>
                Швидкі дії
              </h2>
              <p className={`text-[12px] mt-0.5 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                Перехід до розділів
              </p>
            </div>
            <span
              className={`text-[10px] uppercase tracking-[0.18em] font-medium tabular-nums ${
                dark ? 'text-slate-600' : 'text-stone-500'
              }`}
            >
              {quickActions.length}
            </span>
          </div>

          <nav className="-mx-2">
            {quickActions.map(a => (
              <Link
                key={a.href}
                href={a.href}
                className={`group flex items-center gap-3 px-2 py-2.5 rounded-lg transition-colors ${
                  dark ? 'hover:bg-white/[0.04]' : 'hover:bg-stone-100/70'
                }`}
              >
                <a.icon
                  className={`text-lg flex-shrink-0 transition-colors ${
                    dark
                      ? 'text-slate-500 group-hover:text-amber-300'
                      : 'text-stone-500 group-hover:text-amber-700'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div
                    className={`text-[13px] font-medium leading-tight ${
                      dark ? 'text-slate-100' : 'text-stone-900'
                    }`}
                  >
                    {a.label}
                  </div>
                  <div className={`text-[11px] truncate mt-0.5 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                    {a.desc}
                  </div>
                </div>
                <HiOutlineArrowRight
                  className={`text-sm flex-shrink-0 group-hover:translate-x-0.5 transition-all ${
                    dark ? 'text-slate-600 group-hover:text-slate-200' : 'text-stone-400 group-hover:text-stone-700'
                  }`}
                />
              </Link>
            ))}
          </nav>

          <div className={`mt-5 pt-5 border-t ${dark ? 'border-white/[0.06]' : 'border-stone-300/50'}`}>
            <SyncDivisionsButton theme={theme} />
          </div>
        </AdminPanel>
      </div>
    </AdminShell>
  );
}

function Kpi({
  label,
  value,
  hint,
  glow = false,
  theme,
}: {
  label: string;
  value: string;
  hint?: string;
  glow?: boolean;
  theme: Theme;
}) {
  const dark = theme === 'dark';
  return (
    <div className="px-5 py-5">
      <div
        className={`text-[10px] uppercase tracking-[0.18em] font-medium mb-2 ${
          dark ? 'text-slate-500' : 'text-stone-500'
        }`}
      >
        {label}
      </div>
      <div
        className={`text-[24px] font-semibold tabular-nums leading-none ${
          glow
            ? dark
              ? 'text-amber-200 drop-shadow-[0_0_16px_rgba(251,191,36,0.25)]'
              : 'text-amber-800 drop-shadow-[0_0_14px_rgba(180,83,9,0.2)]'
            : dark
              ? 'text-white'
              : 'text-stone-900'
        }`}
      >
        {value}
      </div>
      {hint && (
        <div className={`text-[11px] mt-2 tabular-nums ${dark ? 'text-slate-500' : 'text-stone-500'}`}>{hint}</div>
      )}
    </div>
  );
}

function MiniStat({
  label,
  value,
  hint,
  tone = 'neutral',
  small = false,
  theme,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: Tone;
  small?: boolean;
  theme: Theme;
}) {
  const dark = theme === 'dark';
  const toneColor: Record<Tone, { dark: string; light: string }> = {
    neutral: { dark: 'text-slate-100', light: 'text-stone-900' },
    success: { dark: 'text-emerald-300', light: 'text-emerald-800' },
    warning: { dark: 'text-amber-300', light: 'text-amber-800' },
    danger: { dark: 'text-rose-300', light: 'text-rose-700' },
  };
  const toneGlow: Record<Tone, { dark: string; light: string }> = {
    neutral: { dark: '', light: '' },
    success: {
      dark: 'drop-shadow-[0_0_10px_rgba(52,211,153,0.25)]',
      light: 'drop-shadow-[0_0_8px_rgba(5,150,105,0.18)]',
    },
    warning: {
      dark: 'drop-shadow-[0_0_10px_rgba(251,191,36,0.3)]',
      light: 'drop-shadow-[0_0_8px_rgba(180,83,9,0.2)]',
    },
    danger: {
      dark: 'drop-shadow-[0_0_10px_rgba(251,113,133,0.35)]',
      light: 'drop-shadow-[0_0_8px_rgba(190,18,60,0.2)]',
    },
  };
  return (
    <div className="px-4 py-3.5">
      <div
        className={`text-[10px] uppercase tracking-[0.18em] font-medium mb-1.5 truncate ${
          dark ? 'text-slate-500' : 'text-stone-500'
        }`}
      >
        {label}
      </div>
      <div
        className={`${small ? 'text-[13px]' : 'text-[18px]'} font-semibold tabular-nums leading-tight ${
          dark ? toneColor[tone].dark : toneColor[tone].light
        } ${dark ? toneGlow[tone].dark : toneGlow[tone].light}`}
      >
        {value}
      </div>
      {hint && (
        <div className={`text-[10px] mt-1 tabular-nums ${dark ? 'text-slate-500' : 'text-stone-500'}`}>{hint}</div>
      )}
    </div>
  );
}

const DOT_COLORS: Record<string, { dark: string; light: string }> = {
  sky: { dark: 'bg-sky-400', light: 'bg-sky-600' },
  amber: { dark: 'bg-amber-400', light: 'bg-amber-600' },
  indigo: { dark: 'bg-indigo-400', light: 'bg-indigo-600' },
  emerald: { dark: 'bg-emerald-400', light: 'bg-emerald-600' },
  rose: { dark: 'bg-rose-400', light: 'bg-rose-600' },
};

function StatusLabel({
  label,
  value,
  dot,
  muted = false,
  theme,
}: {
  label: string;
  value: number;
  dot: keyof typeof DOT_COLORS;
  muted?: boolean;
  theme: Theme;
}) {
  const dark = theme === 'dark';
  const dotClass = dark ? DOT_COLORS[dot].dark : DOT_COLORS[dot].light;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] tabular-nums ${muted ? 'opacity-60' : ''}`}>
      <span className={`w-1 h-1 rounded-full ${dotClass}`} />
      <span className={dark ? 'text-slate-500' : 'text-stone-500'}>{label}</span>
      <span className={`font-semibold ${dark ? 'text-slate-200' : 'text-stone-800'}`}>{value}</span>
    </span>
  );
}

function pluralize(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const n1 = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (n1 > 1 && n1 < 5) return forms[1];
  if (n1 === 1) return forms[0];
  return forms[2];
}
