'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  HiOutlineUserGroup,
  HiOutlineBookOpen,
  HiOutlineNewspaper,
  HiOutlineCreditCard,
  HiOutlineExclamationTriangle,
  HiOutlineClock,
  HiOutlineUsers,
  HiOutlineArrowRight,
  HiOutlineSparkles,
  HiOutlineCalendarDays,
  HiOutlineCubeTransparent,
  HiOutlineDocumentText,
  HiOutlineEnvelope,
  HiOutlineXMark,
} from 'react-icons/hi2';
import SyncDivisionsButton from './SyncDivisionsButton';
import { useAdminTheme, type Theme } from './adminTheme';
import { AdminShell, AdminPanel } from './AdminShell';
import SalesChart from './SalesChart';
import SalesByProductBlock from './SalesByProductBlock';
import type { SalesSeries, SalesKpiBuckets, SalesPeriod } from '@/lib/admin-sales-analytics';
import type { ProductSalesData } from '@/lib/admin-sales-by-product';

type BadgeTone = 'neutral' | 'warning' | 'success';
type SectionBadge = { value: string; tone: BadgeTone } | null;

export type AdminDashboardData = {
  series: SalesSeries;
  productSales: ProductSalesData;
  activeProductPeriodValue: SalesPeriod;
  salesBuckets: SalesKpiBuckets;
  activePeriodValue: SalesPeriod;
  activePeriodLabel: string;
  connectorAwaitingManager: number;
  connectorPendingPayment: number;
  connectorNonStandard: number;
  connectorStuckNew: number;
  connectorStuckProcessing: number;
  bundleSuspended: number;
  discountedPayments: number;
  connectorStandardPrice: number;
  periodOptions: { value: SalesPeriod; label: string }[];
  sectionBadges: {
    courses: SectionBadge;
    bundles: SectionBadge;
    yearlyProgram: SectionBadge;
    connector: SectionBadge;
    news: SectionBadge;
    payments: SectionBadge;
    users: SectionBadge;
  };
};

export default function AdminDashboardView({ data }: { data: AdminDashboardData }) {
  const { theme, setTheme } = useAdminTheme();
  const dark = theme === 'dark';

  type AttentionTone = 'warning' | 'danger';
  const attentionItems: Array<{ label: string; count: number; href: string; tone: AttentionTone }> = [];
  if (data.connectorAwaitingManager > 0) {
    attentionItems.push({
      label: 'Конектор очікує менеджера',
      count: data.connectorAwaitingManager,
      href: '/dashboard/manager',
      tone: 'warning',
    });
  }
  if (data.connectorStuckNew > 0) {
    attentionItems.push({
      label: 'Конектор «Нове» > 12 год',
      count: data.connectorStuckNew,
      href: '/dashboard/manager',
      tone: 'danger',
    });
  }
  if (data.connectorStuckProcessing > 0) {
    attentionItems.push({
      label: 'Конектор «В обробці» > 24 год',
      count: data.connectorStuckProcessing,
      href: '/dashboard/manager',
      tone: 'danger',
    });
  }
  if (data.connectorPendingPayment > 0) {
    attentionItems.push({
      label: 'Конектор — очікують оплати',
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
  if (data.discountedPayments > 0) {
    attentionItems.push({
      label: 'Оплати нижче базової ціни',
      count: data.discountedPayments,
      href: '/dashboard/admin/payments',
      tone: 'warning',
    });
  }

  // Dismissals: localStorage `{label: countAtDismissal}`. Якщо count змінився
  // (нова кількість «зависань», наприклад) — попередній dismiss не діє і
  // елемент знову показується.
  const DISMISS_KEY = 'admin-attention-dismissed';
  const [dismissed, setDismissed] = useState<Record<string, number>>({});
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DISMISS_KEY);
      if (raw) setDismissed(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);
  function dismiss(label: string, count: number) {
    const next = { ...dismissed, [label]: count };
    setDismissed(next);
    try {
      window.localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  const visibleAttention = attentionItems.filter(
    item => dismissed[item.label] !== item.count,
  );

  const b = data.sectionBadges;
  const quickActions = [
    { href: '/dashboard/admin/courses', label: 'Курси', desc: 'Ціни курсів', icon: HiOutlineBookOpen, badge: b.courses },
    { href: '/dashboard/admin/bundles', label: 'Пакети', desc: 'Курси зі знижкою', icon: HiOutlineSparkles, badge: b.bundles },
    { href: '/dashboard/admin/yearly-program', label: 'Річна програма', desc: 'Підписки та доступ', icon: HiOutlineCalendarDays, badge: b.yearlyProgram },
    { href: '/dashboard/admin/certificates', label: 'Сертифікати', desc: 'Видача та облік', icon: HiOutlineDocumentText, badge: null as SectionBadge },
    { href: '/dashboard/admin/emails', label: 'Листи', desc: 'Email-шаблони', icon: HiOutlineEnvelope, badge: null as SectionBadge },
    { href: '/dashboard/admin/news', label: 'Новини', desc: 'Публікації', icon: HiOutlineNewspaper, badge: b.news },
    { href: '/dashboard/admin/specialists', label: 'Спеціалісти', desc: 'Ціни та запис', icon: HiOutlineUsers, badge: null as SectionBadge },
    { href: '/dashboard/admin/users', label: 'Користувачі', desc: 'Акаунти та ролі', icon: HiOutlineUserGroup, badge: b.users },
    { href: '/dashboard/admin/connector', label: 'Конектор', desc: 'Замовлення гри', icon: HiOutlineCubeTransparent, badge: b.connector },
    { href: '/dashboard/admin/payments', label: 'Платежі', desc: 'Транзакції', icon: HiOutlineCreditCard, badge: b.payments },
    { href: '/dashboard/admin/payment-logs', label: 'Логи', desc: 'WayForPay callback-и', icon: HiOutlineClock, badge: null as SectionBadge },
  ];

  return (
    <AdminShell
      theme={theme}
      setTheme={setTheme}
      eyebrow="Admin · Overview"
      title="Адмін-панель"
      subtitle="Все, що потрібно — на одному екрані. Зайшов, подивився, зробив, пішов."
      maxWidth="max-w-[1480px]"
      rightSlot={
        <>
          {visibleAttention.length === 0 && (
            <div
              className={`hidden sm:inline-flex items-center px-2.5 py-1 rounded-full border text-[11px] font-medium ${
                dark
                  ? 'bg-emerald-500/[0.06] border-emerald-500/15 text-emerald-300/75'
                  : 'bg-emerald-500/[0.08] border-emerald-500/20 text-emerald-800/80'
              }`}
              title="Жодних активних попереджень"
            >
              Все чисто
            </div>
          )}
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
        </>
      }
    >
      {visibleAttention.length > 0 && (
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
              {visibleAttention.length}
            </span>
          </div>
          <div className="grid sm:grid-cols-2 gap-1">
            {visibleAttention.map(item => (
              <div
                key={item.label}
                className={`group flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  dark ? 'hover:bg-white/5' : 'hover:bg-white/60'
                }`}
              >
                <Link href={item.href} className="flex items-center gap-2.5 min-w-0 flex-1">
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
                </Link>
                <span className="flex items-center gap-2 flex-shrink-0">
                  <Link
                    href={item.href}
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
                  </Link>
                  <Link href={item.href} aria-label="Перейти">
                    <HiOutlineArrowRight
                      className={`text-sm group-hover:translate-x-0.5 transition-all ${
                        dark ? 'text-slate-500 group-hover:text-slate-200' : 'text-stone-400 group-hover:text-stone-700'
                      }`}
                    />
                  </Link>
                  <button
                    type="button"
                    onClick={() => dismiss(item.label, item.count)}
                    aria-label="Прибрати з переліку"
                    title="Прибрати з переліку (зʼявиться знову коли кількість зміниться)"
                    className={`inline-flex items-center justify-center w-5 h-5 rounded-md transition-colors ${
                      dark
                        ? 'text-slate-500 hover:bg-white/10 hover:text-slate-200'
                        : 'text-stone-400 hover:bg-stone-200/60 hover:text-stone-700'
                    }`}
                  >
                    <HiOutlineXMark className="text-[13px]" />
                  </button>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Analytics — chart + KPI strip */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <AdminPanel theme={theme} padding="p-5">
            <div className="flex items-center gap-4 flex-wrap mb-4">
              <div className="min-w-0">
                <h2 className={`text-[15px] font-semibold tracking-tight ${dark ? 'text-white' : 'text-stone-900'}`}>
                  Продажі
                </h2>
                <p className={`text-[12px] mt-0.5 tabular-nums ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                  {data.series.rangeLabel}
                </p>
              </div>
              <div
                className={`inline-flex flex-wrap rounded-lg p-0.5 border ${
                  dark ? 'bg-black/30 border-white/[0.06]' : 'bg-stone-100/80 border-stone-300/50'
                }`}
              >
                {data.periodOptions.map(opt => {
                  const active = opt.value === data.activePeriodValue;
                  return (
                    <Link
                      key={opt.value}
                      href={`/dashboard/admin?period=${opt.value}&productPeriod=${data.activeProductPeriodValue}`}
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
            </div>

            <SalesChart series={data.series} theme={theme} />

            <div className={`mt-6 pt-6 border-t ${dark ? 'border-white/[0.06]' : 'border-stone-300/50'}`}>
              <SalesByProductBlock
                data={data.productSales}
                theme={theme}
                activePeriod={data.activeProductPeriodValue}
                periodOptions={data.periodOptions}
                baseQuery={`period=${data.activePeriodValue}`}
              />
            </div>
          </AdminPanel>
        </div>

        {/* Quick actions — вертикальна колонка справа */}
        <aside className="lg:col-span-4">
          <AdminPanel theme={theme} padding="p-5" className="lg:sticky lg:top-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className={`text-[15px] font-semibold tracking-tight ${dark ? 'text-white' : 'text-stone-900'}`}>
                  Швидкі дії
                </h2>
                <p className={`text-[11px] mt-0.5 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
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

            <nav className="grid grid-cols-2 gap-1.5">
              {quickActions.map(a => (
                <Link
                  key={a.href}
                  href={a.href}
                  className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-lg border transition-colors ${
                    dark
                      ? 'border-white/[0.05] hover:bg-white/[0.04] hover:border-white/[0.1]'
                      : 'border-stone-300/40 hover:bg-stone-100/70 hover:border-stone-400/50'
                  }`}
                >
                  <a.icon
                    className={`text-base flex-shrink-0 transition-colors ${
                      dark
                        ? 'text-slate-500 group-hover:text-amber-300'
                        : 'text-stone-500 group-hover:text-amber-700'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`text-[12.5px] font-medium leading-tight ${
                          dark ? 'text-slate-100' : 'text-stone-900'
                        }`}
                      >
                        {a.label}
                      </span>
                      {a.badge && <SectionBadgePill theme={theme} badge={a.badge} />}
                    </div>
                    <div className={`text-[10.5px] truncate mt-0.5 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                      {a.desc}
                    </div>
                  </div>
                  <HiOutlineArrowRight
                    className={`text-xs flex-shrink-0 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all ${
                      dark ? 'text-slate-400' : 'text-stone-500'
                    }`}
                  />
                </Link>
              ))}
            </nav>

            <div className={`mt-4 pt-4 border-t ${dark ? 'border-white/[0.06]' : 'border-stone-300/50'}`}>
              <SyncDivisionsButton theme={theme} />
            </div>
          </AdminPanel>
        </aside>
      </div>
    </AdminShell>
  );
}

function SalesKpi({
  label,
  bucket,
  glow = false,
  theme,
}: {
  label: string;
  bucket: { count: number; sum: number; avg: number };
  glow?: boolean;
  theme: Theme;
}) {
  const dark = theme === 'dark';
  const muted = dark ? 'text-slate-500' : 'text-stone-500';
  const rowValue = dark ? 'text-slate-200' : 'text-stone-800';
  return (
    <div className="px-4 py-3">
      <div
        className={`text-[10px] uppercase tracking-[0.18em] font-medium mb-1.5 truncate ${muted}`}
        title={label}
      >
        {label}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span
          className={`text-[20px] font-semibold tabular-nums leading-none ${
            glow
              ? dark
                ? 'text-amber-200 drop-shadow-[0_0_14px_rgba(251,191,36,0.22)]'
                : 'text-amber-800 drop-shadow-[0_0_12px_rgba(180,83,9,0.18)]'
              : dark
                ? 'text-white'
                : 'text-stone-900'
          }`}
        >
          {bucket.count.toLocaleString()}
        </span>
        <span className={`text-[10px] ${muted}`}>
          {pluralize(bucket.count, ['замовл.', 'замовл.', 'замовл.'])}
        </span>
      </div>
      <div className={`mt-2 space-y-0.5 text-[11px] tabular-nums`}>
        <div className="flex items-center justify-between gap-2">
          <span className={muted}>Сума</span>
          <span className={rowValue}>{bucket.sum.toLocaleString()} ₴</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className={muted}>Чек</span>
          <span className={rowValue}>{bucket.avg.toLocaleString()} ₴</span>
        </div>
      </div>
    </div>
  );
}

function SectionBadgePill({
  theme,
  badge,
}: {
  theme: Theme;
  badge: { value: string; tone: BadgeTone };
}) {
  const dark = theme === 'dark';
  const palette: Record<BadgeTone, { dark: string; light: string }> = {
    neutral: {
      dark: 'bg-white/[0.06] border-white/[0.08] text-slate-400',
      light: 'bg-stone-200/70 border-stone-300/60 text-stone-700',
    },
    warning: {
      dark: 'bg-amber-500/15 border-amber-500/25 text-amber-300',
      light: 'bg-amber-500/15 border-amber-500/30 text-amber-800',
    },
    success: {
      dark: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-300',
      light: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-800',
    },
  };
  const cls = dark ? palette[badge.tone].dark : palette[badge.tone].light;
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9.5px] font-medium tabular-nums border flex-shrink-0 ${cls}`}
    >
      {badge.value}
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
