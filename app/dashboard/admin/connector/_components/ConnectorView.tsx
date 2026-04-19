'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  HiOutlineCubeTransparent,
  HiOutlineCheckCircle,
  HiOutlineClock,
  HiOutlineExclamationTriangle,
  HiOutlineBanknotes,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineArrowTopRightOnSquare,
  HiOutlinePhone,
} from 'react-icons/hi2';
import { useAdminTheme, type Theme, type Tone } from '../../_components/adminTheme';
import { AdminShell, AdminPanel } from '../../_components/AdminShell';

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
export type OrderStatus = 'NEW' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export interface Row {
  id: string;
  createdAt: string;
  fullName: string;
  email: string;
  phone: string;
  city: string;
  postOffice: string;
  amount: number;
  gamePrice: number | null;
  shippingCost: number | null;
  actualShippingCost: number | null;
  paymentStatus: PaymentStatus;
  paidAt: string | null;
  orderStatus: OrderStatus;
  trackingNumber: string | null;
  managerNote: string | null;
  callMe: boolean;
  orderReference: string;
  isNonStandard: boolean;
}

export interface SummaryData {
  total: number;
  paidCount: number;
  pendingPayment: number;
  awaitingManager: number;
  revenueTotal: number;
  statusCounts: Record<OrderStatus, number>;
  standardPrice: number;
}

const ORDER_STATUS_OPTIONS: { value: 'ALL' | OrderStatus; label: string }[] = [
  { value: 'ALL', label: 'Усі' },
  { value: 'NEW', label: 'Нові' },
  { value: 'PROCESSING', label: 'В обробці' },
  { value: 'SHIPPED', label: 'Відправлено' },
  { value: 'DELIVERED', label: 'Доставлено' },
  { value: 'CANCELLED', label: 'Скасовано' },
];

const PAYMENT_STATUS_OPTIONS: { value: 'ALL' | PaymentStatus; label: string }[] = [
  { value: 'ALL', label: 'Усі' },
  { value: 'PAID', label: 'Оплачено' },
  { value: 'PENDING', label: 'Очікує' },
  { value: 'FAILED', label: 'Невдало' },
  { value: 'REFUNDED', label: 'Повернено' },
];

export default function ConnectorView({
  rows,
  summary,
}: {
  rows: Row[];
  summary: SummaryData;
}) {
  const { theme, setTheme } = useAdminTheme();
  const dark = theme === 'dark';

  const [orderStatus, setOrderStatus] = useState<'ALL' | OrderStatus>('ALL');
  const [paymentStatus, setPaymentStatus] = useState<'ALL' | PaymentStatus>('ALL');
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (orderStatus !== 'ALL' && r.orderStatus !== orderStatus) return false;
      if (paymentStatus !== 'ALL' && r.paymentStatus !== paymentStatus) return false;
      if (q) {
        const hay = `${r.fullName} ${r.email} ${r.phone} ${r.city} ${r.orderReference}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, orderStatus, paymentStatus, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => {
    setPage(1);
  }, [orderStatus, paymentStatus, search, pageSize]);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageStart = (page - 1) * pageSize;
  const paged = filtered.slice(pageStart, pageStart + pageSize);

  return (
    <AdminShell
      theme={theme}
      setTheme={setTheme}
      eyebrow="Admin · Connector"
      title="Конектор"
      subtitle="Замовлення гри «Конектор» — статистика, історія, фільтри"
      backHref="/dashboard/admin"
      maxWidth="max-w-7xl"
      rightSlot={
        <Link
          href="/dashboard/manager"
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] font-medium transition-colors ${
            dark
              ? 'bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.08] hover:text-white hover:border-amber-400/40'
              : 'bg-white/80 border-stone-300/60 text-stone-700 hover:bg-stone-100 hover:border-amber-600/50'
          }`}
        >
          <HiOutlineArrowTopRightOnSquare className="text-base" />
          Управління (Manager)
        </Link>
      }
    >
      {/* KPI strip */}
      <div
        className={`mb-5 rounded-2xl grid grid-cols-2 lg:grid-cols-5 overflow-hidden backdrop-blur-sm border divide-y lg:divide-y-0 lg:divide-x ${
          dark
            ? 'bg-white/[0.03] border-white/[0.06] divide-white/[0.06]'
            : 'bg-white/55 border-stone-300/50 divide-stone-300/40 shadow-[0_1px_2px_rgba(68,64,60,0.04)]'
        }`}
      >
        <Kpi theme={theme} icon={HiOutlineCubeTransparent} label="Всього замовлень" value={summary.total.toLocaleString()} />
        <Kpi theme={theme} icon={HiOutlineCheckCircle} label="Оплачено" value={summary.paidCount.toLocaleString()} tone="success" />
        <Kpi
          theme={theme}
          icon={HiOutlineClock}
          label="Очікують оплати"
          value={summary.pendingPayment.toLocaleString()}
          tone={summary.pendingPayment > 0 ? 'warning' : 'neutral'}
        />
        <Kpi
          theme={theme}
          icon={HiOutlineExclamationTriangle}
          label="Очікують менеджера"
          value={summary.awaitingManager.toLocaleString()}
          tone={summary.awaitingManager > 0 ? 'warning' : 'neutral'}
        />
        <Kpi theme={theme} icon={HiOutlineBanknotes} label="Загальний дохід" value={`${summary.revenueTotal.toLocaleString()} ₴`} tone="success" />
      </div>

      {/* Status row */}
      <AdminPanel theme={theme} padding="px-4 py-3" className="mb-5">
        <div className="flex items-center gap-x-4 gap-y-2 flex-wrap">
          <span className={`text-[10px] uppercase tracking-[0.18em] font-medium ${dark ? 'text-slate-600' : 'text-stone-500'}`}>
            Статуси
          </span>
          <StatusLabel theme={theme} label="Нові" value={summary.statusCounts.NEW} dot="sky" />
          <StatusLabel theme={theme} label="В обробці" value={summary.statusCounts.PROCESSING} dot="amber" />
          <StatusLabel theme={theme} label="Відправлено" value={summary.statusCounts.SHIPPED} dot="indigo" />
          <StatusLabel theme={theme} label="Доставлено" value={summary.statusCounts.DELIVERED} dot="emerald" />
          <StatusLabel theme={theme} label="Скасовано" value={summary.statusCounts.CANCELLED} dot="rose" muted />
        </div>
      </AdminPanel>

      {/* Filters */}
      <AdminPanel theme={theme} padding="p-4" className="mb-5">
        <div className="flex items-center gap-3 flex-wrap">
          <FilterGroup
            theme={theme}
            label="Статус"
            options={ORDER_STATUS_OPTIONS}
            value={orderStatus}
            onChange={(v) => setOrderStatus(v as 'ALL' | OrderStatus)}
          />
          <FilterGroup
            theme={theme}
            label="Оплата"
            options={PAYMENT_STATUS_OPTIONS}
            value={paymentStatus}
            onChange={(v) => setPaymentStatus(v as 'ALL' | PaymentStatus)}
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Пошук: ім'я, email, телефон, місто, № замовлення"
            className={`ml-auto flex-1 min-w-[260px] max-w-[420px] px-3 py-1.5 rounded-lg border text-[12px] outline-none transition-colors ${
              dark
                ? 'bg-white/[0.04] border-white/[0.08] text-slate-200 placeholder:text-slate-600 focus:border-amber-400/40'
                : 'bg-white/80 border-stone-300/60 text-stone-800 placeholder:text-stone-400 focus:border-amber-600/50'
            }`}
          />
        </div>
      </AdminPanel>

      {/* Table */}
      <AdminPanel theme={theme} padding="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className={`border-b ${dark ? 'border-white/[0.06] bg-black/10' : 'border-stone-300/40 bg-stone-50/40'}`}>
              <tr>
                <Th theme={theme}>Дата</Th>
                <Th theme={theme}>Клієнт</Th>
                <Th theme={theme}>Телефон</Th>
                <Th theme={theme}>Доставка</Th>
                <Th theme={theme} align="right">Сума</Th>
                <Th theme={theme} align="center">Оплата</Th>
                <Th theme={theme} align="center">Статус</Th>
                <Th theme={theme}>TTN</Th>
              </tr>
            </thead>
            <tbody className={dark ? 'divide-y divide-white/[0.04]' : 'divide-y divide-stone-200/60'}>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className={`px-4 py-14 text-center text-sm ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                    {rows.length === 0 ? 'Поки замовлень немає.' : 'Нічого не знайдено за фільтрами.'}
                  </td>
                </tr>
              ) : (
                paged.map((r) => <RowBlock key={r.id} r={r} theme={theme} />)
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <PaginationBar
            theme={theme}
            page={page}
            totalPages={totalPages}
            total={filtered.length}
            pageStart={pageStart}
            pageEnd={Math.min(pageStart + pageSize, filtered.length)}
            pageSize={pageSize}
            onPage={setPage}
            onPageSize={setPageSize}
          />
        )}
      </AdminPanel>
    </AdminShell>
  );
}

function RowBlock({ r, theme }: { r: Row; theme: Theme }) {
  const dark = theme === 'dark';
  const dt = new Date(r.createdAt);
  const dateStr = dt.toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' });

  return (
    <tr className={dark ? 'hover:bg-white/[0.02]' : 'hover:bg-stone-50/60'}>
      <Td theme={theme}>
        <span className="tabular-nums whitespace-nowrap">{dateStr}</span>
      </Td>
      <Td theme={theme}>
        <div className="flex flex-col leading-tight">
          <span className={`font-medium ${dark ? 'text-slate-100' : 'text-stone-900'}`}>{r.fullName}</span>
          <span className={`text-[11px] ${dark ? 'text-slate-500' : 'text-stone-500'}`}>{r.email}</span>
        </div>
      </Td>
      <Td theme={theme}>
        <span className="inline-flex items-center gap-1.5 tabular-nums">
          {r.callMe && (
            <HiOutlinePhone
              title="Передзвонити"
              className={`text-xs flex-shrink-0 ${dark ? 'text-amber-400' : 'text-amber-700'}`}
            />
          )}
          {r.phone}
        </span>
      </Td>
      <Td theme={theme}>
        <div className="flex flex-col leading-tight max-w-[260px]">
          <span className="truncate">{r.city}</span>
          <span className={`text-[11px] truncate ${dark ? 'text-slate-500' : 'text-stone-500'}`}>{r.postOffice}</span>
        </div>
      </Td>
      <Td theme={theme} align="right">
        <span className={`tabular-nums font-medium ${r.isNonStandard ? (dark ? 'text-rose-300' : 'text-rose-700') : ''}`}>
          {r.amount.toLocaleString()} ₴
        </span>
        {r.isNonStandard && (
          <div className={`text-[10px] mt-0.5 ${dark ? 'text-rose-400/70' : 'text-rose-600/80'}`}>
            не стандарт
          </div>
        )}
      </Td>
      <Td theme={theme} align="center">
        <PaymentBadge status={r.paymentStatus} theme={theme} />
      </Td>
      <Td theme={theme} align="center">
        <OrderBadge status={r.orderStatus} theme={theme} />
      </Td>
      <Td theme={theme}>
        {r.trackingNumber ? (
          <span className={`tabular-nums text-[12px] font-mono ${dark ? 'text-slate-300' : 'text-stone-700'}`}>
            {r.trackingNumber}
          </span>
        ) : (
          <span className={dark ? 'text-slate-600' : 'text-stone-400'}>—</span>
        )}
      </Td>
    </tr>
  );
}

function PaymentBadge({ status, theme }: { status: PaymentStatus; theme: Theme }) {
  const dark = theme === 'dark';
  const map: Record<PaymentStatus, { label: string; cls: string }> = {
    PAID: {
      label: 'Оплачено',
      cls: dark ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25' : 'bg-emerald-100 text-emerald-800 border-emerald-300',
    },
    PENDING: {
      label: 'Очікує',
      cls: dark ? 'bg-amber-500/15 text-amber-300 border-amber-500/25' : 'bg-amber-100 text-amber-800 border-amber-300',
    },
    FAILED: {
      label: 'Невдало',
      cls: dark ? 'bg-rose-500/15 text-rose-300 border-rose-500/25' : 'bg-rose-100 text-rose-700 border-rose-300',
    },
    REFUNDED: {
      label: 'Повернено',
      cls: dark ? 'bg-slate-500/15 text-slate-300 border-slate-500/25' : 'bg-stone-200 text-stone-700 border-stone-300',
    },
  };
  const cfg = map[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function OrderBadge({ status, theme }: { status: OrderStatus; theme: Theme }) {
  const dark = theme === 'dark';
  const map: Record<OrderStatus, { label: string; cls: string }> = {
    NEW: { label: 'Нове', cls: dark ? 'bg-sky-500/15 text-sky-300 border-sky-500/25' : 'bg-sky-100 text-sky-800 border-sky-300' },
    PROCESSING: { label: 'В обробці', cls: dark ? 'bg-amber-500/15 text-amber-300 border-amber-500/25' : 'bg-amber-100 text-amber-800 border-amber-300' },
    SHIPPED: { label: 'Відправлено', cls: dark ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/25' : 'bg-indigo-100 text-indigo-800 border-indigo-300' },
    DELIVERED: { label: 'Доставлено', cls: dark ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25' : 'bg-emerald-100 text-emerald-800 border-emerald-300' },
    CANCELLED: { label: 'Скасовано', cls: dark ? 'bg-rose-500/15 text-rose-300 border-rose-500/25' : 'bg-rose-100 text-rose-700 border-rose-300' },
  };
  const cfg = map[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function Th({ children, theme, align = 'left' }: { children: React.ReactNode; theme: Theme; align?: 'left' | 'right' | 'center' }) {
  const dark = theme === 'dark';
  return (
    <th
      className={`px-4 py-3 text-[10px] uppercase tracking-[0.18em] font-medium ${
        dark ? 'text-slate-500' : 'text-stone-500'
      } text-${align}`}
    >
      {children}
    </th>
  );
}

function Td({ children, theme, align = 'left' }: { children: React.ReactNode; theme: Theme; align?: 'left' | 'right' | 'center' }) {
  const dark = theme === 'dark';
  return <td className={`px-4 py-3 align-middle ${dark ? 'text-slate-300' : 'text-stone-700'} text-${align}`}>{children}</td>;
}

function FilterGroup({
  theme,
  label,
  options,
  value,
  onChange,
}: {
  theme: Theme;
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const dark = theme === 'dark';
  return (
    <div className="flex items-center gap-2">
      <span className={`text-[10px] uppercase tracking-[0.18em] font-medium ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
        {label}
      </span>
      <div className={`inline-flex rounded-lg p-0.5 border ${dark ? 'bg-black/30 border-white/[0.06]' : 'bg-stone-100/80 border-stone-300/50'}`}>
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
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
            </button>
          );
        })}
      </div>
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

function Kpi({
  label,
  value,
  icon: Icon,
  tone = 'neutral',
  theme,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: Tone;
  theme: Theme;
}) {
  const dark = theme === 'dark';
  const toneColor: Record<Tone, { dark: string; light: string }> = {
    neutral: { dark: 'text-white', light: 'text-stone-900' },
    success: { dark: 'text-emerald-300', light: 'text-emerald-800' },
    warning: { dark: 'text-amber-300', light: 'text-amber-800' },
    danger: { dark: 'text-rose-300', light: 'text-rose-700' },
  };
  return (
    <div className="px-5 py-5">
      <div className={`flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-medium mb-2 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
        <Icon className="text-sm" />
        {label}
      </div>
      <div className={`text-[22px] font-semibold tabular-nums leading-none ${dark ? toneColor[tone].dark : toneColor[tone].light}`}>
        {value}
      </div>
    </div>
  );
}

function PaginationBar({
  theme,
  page,
  totalPages,
  total,
  pageStart,
  pageEnd,
  pageSize,
  onPage,
  onPageSize,
}: {
  theme: Theme;
  page: number;
  totalPages: number;
  total: number;
  pageStart: number;
  pageEnd: number;
  pageSize: number;
  onPage: (p: number) => void;
  onPageSize: (n: number) => void;
}) {
  const dark = theme === 'dark';
  const pages = computePageList(page, totalPages);
  const btnBase = 'inline-flex items-center justify-center h-7 min-w-7 px-2 rounded-md text-[12px] tabular-nums transition-colors';
  const btnIdle = dark
    ? 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.06] border border-white/[0.06]'
    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100 border border-stone-300/50';
  const btnActive = dark
    ? 'bg-amber-400/15 text-amber-200 border border-amber-400/30'
    : 'bg-amber-100 text-amber-800 border border-amber-300/60';
  const btnDisabled = dark
    ? 'text-slate-600 border border-white/[0.04] cursor-not-allowed'
    : 'text-stone-300 border border-stone-200/60 cursor-not-allowed';

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t text-[12px] ${dark ? 'border-white/[0.06] text-slate-400' : 'border-stone-300/40 text-stone-600'}`}>
      <div className="tabular-nums">
        Показано <span className={dark ? 'text-slate-200' : 'text-stone-800'}>{pageStart + 1}–{pageEnd}</span> з{' '}
        <span className={dark ? 'text-slate-200' : 'text-stone-800'}>{total}</span>
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2">
          <span>На сторінці:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}
            className={`h-7 px-2 rounded-md text-[12px] outline-none ${dark ? 'bg-white/[0.04] border border-white/[0.08] text-slate-200' : 'bg-white/80 border border-stone-300/60 text-stone-800'}`}
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className={`${btnBase} ${page <= 1 ? btnDisabled : btnIdle}`}
            aria-label="Попередня сторінка"
          >
            <HiOutlineChevronLeft className="text-sm" />
          </button>
          {pages.map((p, i) =>
            p === '…' ? (
              <span key={`dots-${i}`} className={`${btnBase} ${dark ? 'text-slate-600' : 'text-stone-400'}`}>…</span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPage(p)}
                className={`${btnBase} ${p === page ? btnActive : btnIdle}`}
                aria-current={p === page ? 'page' : undefined}
              >
                {p}
              </button>
            ),
          )}
          <button
            type="button"
            onClick={() => onPage(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className={`${btnBase} ${page >= totalPages ? btnDisabled : btnIdle}`}
            aria-label="Наступна сторінка"
          >
            <HiOutlineChevronRight className="text-sm" />
          </button>
        </div>
      </div>
    </div>
  );
}

function computePageList(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '…')[] = [1];
  if (current > 3) pages.push('…');
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p);
  if (current < total - 2) pages.push('…');
  pages.push(total);
  return pages;
}
