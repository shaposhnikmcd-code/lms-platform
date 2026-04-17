'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { HiOutlineFunnel, HiOutlineBanknotes, HiOutlineCheckCircle, HiOutlineClock, HiOutlineCreditCard } from 'react-icons/hi2';
import { useAdminTheme, type Theme } from '../../_components/adminTheme';
import { AdminShell, AdminPanel } from '../../_components/AdminShell';

export type Row = {
  id: string;
  source: 'course' | 'bundle' | 'connector';
  createdAt: string;
  clientName: string;
  clientEmail: string;
  productLabel: string;
  amount: number;
  status: string;
  orderReference: string;
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Очікує',
  PAID: 'Оплачено',
  FAILED: 'Помилка',
  REFUNDED: 'Повернено',
};

const TYPE_OPTIONS = [
  { value: 'ALL', label: 'Усі' },
  { value: 'course', label: 'Курс' },
  { value: 'bundle', label: 'Пакет' },
  { value: 'connector', label: 'Коннектор' },
];

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'Усі' },
  { value: 'PAID', label: 'Оплачено' },
  { value: 'PENDING', label: 'Очікує' },
  { value: 'FAILED', label: 'Помилка' },
  { value: 'REFUNDED', label: 'Повернено' },
];

export default function PaymentsView({ rows }: { rows: Row[] }) {
  const { theme, setTheme } = useAdminTheme();
  const dark = theme === 'dark';
  const router = useRouter();

  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [productFilter, setProductFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('PAID');

  const productOptions = useMemo(() => {
    const PRODUCT_PREFIX: Record<Row['source'], string> = {
      course: 'Курс',
      bundle: 'Пакет',
      connector: 'Гра',
    };
    const base = typeFilter === 'ALL' ? rows : rows.filter(r => r.source === typeFilter);
    const seen = new Map<string, Row['source']>();
    for (const r of base) {
      if (!seen.has(r.productLabel)) seen.set(r.productLabel, r.source);
    }
    const items = Array.from(seen.entries())
      .map(([label, source]) => ({ value: label, label: `${PRODUCT_PREFIX[source]} — ${label}` }))
      .sort((a, b) => a.label.localeCompare(b.label, 'uk'));
    return [{ value: 'ALL', label: 'Усі' }, ...items];
  }, [rows, typeFilter]);

  useEffect(() => {
    if (productFilter !== 'ALL' && !productOptions.find(o => o.value === productFilter)) {
      setProductFilter('ALL');
    }
  }, [productOptions, productFilter]);

  const filtered = useMemo(() => rows.filter(r => {
    if (typeFilter !== 'ALL' && r.source !== typeFilter) return false;
    if (productFilter !== 'ALL' && r.productLabel !== productFilter) return false;
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
    return true;
  }), [rows, typeFilter, productFilter, statusFilter]);

  // Summary KPIs — рахуємо по ВСІХ рядках, не по фільтру, щоб була загальна картина.
  const totals = useMemo(() => {
    let total = 0, paid = 0, pending = 0, paidCount = 0;
    for (const r of rows) {
      total += 1;
      if (r.status === 'PAID') { paid += r.amount; paidCount += 1; }
      else if (r.status === 'PENDING') pending += 1;
    }
    return { total, paid, pending, paidCount };
  }, [rows]);

  const isFilterActive = typeFilter !== 'ALL' || productFilter !== 'ALL' || statusFilter !== 'PAID';

  return (
    <AdminShell
      theme={theme}
      setTheme={setTheme}
      eyebrow="Admin · Платежі"
      title="Платежі"
      subtitle="Транзакції за курси, пакети та замовлення Коннектора."
      maxWidth="max-w-7xl"
    >
      {/* KPI strip */}
      <div
        className={`mb-6 rounded-2xl grid grid-cols-2 lg:grid-cols-4 overflow-hidden backdrop-blur-sm border divide-y lg:divide-y-0 lg:divide-x ${
          dark
            ? 'bg-white/[0.03] border-white/[0.06] divide-white/[0.06]'
            : 'bg-white/55 border-stone-300/50 divide-stone-300/40 shadow-[0_1px_2px_rgba(68,64,60,0.04)]'
        }`}
      >
        <Kpi theme={theme} icon={HiOutlineCreditCard} label="Всього платежів" value={totals.total.toLocaleString()} />
        <Kpi theme={theme} icon={HiOutlineCheckCircle} label="Успішних" value={totals.paidCount.toLocaleString()} tone="success" />
        <Kpi theme={theme} icon={HiOutlineClock} label="Очікують" value={totals.pending.toLocaleString()} tone={totals.pending > 0 ? 'warning' : 'neutral'} />
        <Kpi theme={theme} icon={HiOutlineBanknotes} label="Загальний дохід" value={`${totals.paid.toLocaleString()} ₴`} glow />
      </div>

      {/* Table panel */}
      <AdminPanel theme={theme} padding="p-0">
        {rows.length === 0 ? (
          <div className="p-16 text-center">
            <HiOutlineCreditCard className={`text-5xl mx-auto mb-4 ${dark ? 'text-slate-600' : 'text-stone-400'}`} />
            <p className={`text-sm ${dark ? 'text-slate-400' : 'text-stone-500'}`}>Платежів ще немає</p>
          </div>
        ) : (
          <>
            {/* Sub-header */}
            <div
              className={`flex items-center justify-between px-5 py-3 border-b ${
                dark ? 'border-white/[0.06] bg-black/20' : 'border-stone-300/40 bg-stone-50/60'
              }`}
            >
              <p className={`text-[11px] uppercase tracking-[0.18em] font-medium ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                Показано <span className={`font-semibold tabular-nums ${dark ? 'text-slate-200' : 'text-stone-800'}`}>{filtered.length}</span>
                <span className="opacity-60"> з {rows.length}</span>
              </p>
              {isFilterActive && (
                <button
                  onClick={() => { setTypeFilter('ALL'); setProductFilter('ALL'); setStatusFilter('PAID'); }}
                  className={`text-[11px] font-medium transition-colors ${
                    dark ? 'text-amber-300 hover:text-amber-200' : 'text-amber-800 hover:text-amber-900'
                  }`}
                >
                  Скинути фільтри
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={`border-b ${dark ? 'border-white/[0.06] bg-black/10' : 'border-stone-300/40 bg-stone-50/40'}`}>
                  <tr>
                    <Th theme={theme}>Дата</Th>
                    <Th theme={theme}>Клієнт</Th>
                    <Th theme={theme}>
                      <FilterHeader theme={theme} label="Тип" value={typeFilter} options={TYPE_OPTIONS} onChange={setTypeFilter} />
                    </Th>
                    <Th theme={theme}>
                      <FilterHeader theme={theme} label="Продукт" value={productFilter} options={productOptions} onChange={setProductFilter} />
                    </Th>
                    <Th theme={theme}>Сума</Th>
                    <Th theme={theme}>
                      <FilterHeader theme={theme} label="Статус" value={statusFilter} options={STATUS_OPTIONS} onChange={setStatusFilter} />
                    </Th>
                    <Th theme={theme}>Референс</Th>
                  </tr>
                </thead>
                <tbody className={dark ? 'divide-y divide-white/[0.04]' : 'divide-y divide-stone-200/60'}>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className={`px-5 py-12 text-center text-sm ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                        За обраними фільтрами платежів не знайдено
                      </td>
                    </tr>
                  ) : (
                    filtered.map(row => {
                      const date = new Date(row.createdAt);
                      const isClickable = row.source === 'connector';
                      return (
                        <tr
                          key={row.id}
                          onClick={isClickable ? () => router.push(`/dashboard/manager?order=${encodeURIComponent(row.orderReference)}`) : undefined}
                          className={`transition-colors ${
                            isClickable
                              ? dark ? 'cursor-pointer hover:bg-white/[0.04]' : 'cursor-pointer hover:bg-stone-100/70'
                              : dark ? 'hover:bg-white/[0.02]' : 'hover:bg-stone-50/60'
                          }`}
                        >
                          <td className="px-5 py-3 whitespace-nowrap">
                            <p className={`text-[13px] ${dark ? 'text-slate-200' : 'text-stone-800'}`}>
                              {date.toLocaleDateString('uk-UA')}
                            </p>
                            <p className={`text-[11px] ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                              {date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </td>
                          <td className="px-5 py-3">
                            <p className={`text-[13px] font-medium ${dark ? 'text-slate-100' : 'text-stone-900'}`}>{row.clientName}</p>
                            <p className={`text-[11px] ${dark ? 'text-slate-500' : 'text-stone-500'}`}>{row.clientEmail}</p>
                          </td>
                          <td className="px-5 py-3">
                            <TypePill theme={theme} source={row.source} />
                          </td>
                          <td className="px-5 py-3">
                            <ProductCell theme={theme} row={row} />
                          </td>
                          <td className={`px-5 py-3 text-[13px] font-semibold tabular-nums ${dark ? 'text-slate-100' : 'text-stone-900'}`}>
                            {row.amount.toLocaleString()} ₴
                          </td>
                          <td className="px-5 py-3">
                            <StatusPill theme={theme} status={row.status} />
                          </td>
                          <td className={`px-5 py-3 text-[11px] font-mono ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                            {row.orderReference}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </AdminPanel>
    </AdminShell>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  glow = false,
  tone = 'neutral',
  theme,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  glow?: boolean;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
  theme: Theme;
}) {
  const dark = theme === 'dark';
  const toneColor = {
    neutral: dark ? 'text-white' : 'text-stone-900',
    success: dark ? 'text-emerald-300' : 'text-emerald-800',
    warning: dark ? 'text-amber-300' : 'text-amber-800',
    danger:  dark ? 'text-rose-300'    : 'text-rose-700',
  }[tone];
  return (
    <div className="px-5 py-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`text-sm ${dark ? 'text-slate-500' : 'text-stone-500'}`} />
        <div className={`text-[10px] uppercase tracking-[0.18em] font-medium ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
          {label}
        </div>
      </div>
      <div
        className={`text-[24px] font-semibold tabular-nums leading-none ${
          glow
            ? dark
              ? 'text-amber-200 drop-shadow-[0_0_16px_rgba(251,191,36,0.25)]'
              : 'text-amber-800 drop-shadow-[0_0_14px_rgba(180,83,9,0.2)]'
            : toneColor
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Th({ children, theme }: { children: React.ReactNode; theme: Theme }) {
  const dark = theme === 'dark';
  return (
    <th className={`text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
      {children}
    </th>
  );
}

function TypePill({ source, theme }: { source: Row['source']; theme: Theme }) {
  const dark = theme === 'dark';
  const map = {
    bundle:    { label: 'Пакет',     dark: 'bg-violet-500/15 text-violet-300 border-violet-500/20',   light: 'bg-violet-500/10 text-violet-800 border-violet-500/25' },
    connector: { label: 'Коннектор', dark: 'bg-orange-500/15 text-orange-300 border-orange-500/20',   light: 'bg-orange-500/10 text-orange-800 border-orange-500/25' },
    course:    { label: 'Курс',      dark: 'bg-sky-500/15 text-sky-300 border-sky-500/20',             light: 'bg-sky-500/10 text-sky-800 border-sky-500/25' },
  }[source];
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold border ${dark ? map.dark : map.light}`}>
      {map.label}
    </span>
  );
}

function ProductCell({ row, theme }: { row: Row; theme: Theme }) {
  const dark = theme === 'dark';
  if (row.source === 'bundle') {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${
        dark ? 'bg-violet-500/10 text-violet-300 border-violet-500/20' : 'bg-violet-500/10 text-violet-800 border-violet-500/25'
      }`}>
        📦 <span className="truncate max-w-[260px]">{row.productLabel}</span>
      </span>
    );
  }
  if (row.source === 'connector') {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${
        dark ? 'bg-orange-500/10 text-orange-300 border-orange-500/20' : 'bg-orange-500/10 text-orange-800 border-orange-500/25'
      }`}>
        🧩 <span className="truncate max-w-[260px]">{row.productLabel}</span>
      </span>
    );
  }
  return <span className={`text-[13px] ${dark ? 'text-slate-300' : 'text-stone-700'}`}>{row.productLabel}</span>;
}

function StatusPill({ status, theme }: { status: string; theme: Theme }) {
  const dark = theme === 'dark';
  const map: Record<string, { dark: string; light: string }> = {
    PAID:     { dark: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20', light: 'bg-emerald-500/10 text-emerald-800 border-emerald-500/25' },
    PENDING:  { dark: 'bg-slate-500/20 text-slate-300 border-slate-500/20',       light: 'bg-stone-200/70 text-stone-700 border-stone-300/70' },
    FAILED:   { dark: 'bg-rose-500/15 text-rose-300 border-rose-500/20',          light: 'bg-rose-500/10 text-rose-700 border-rose-500/25' },
    REFUNDED: { dark: 'bg-amber-500/15 text-amber-300 border-amber-500/20',       light: 'bg-amber-500/10 text-amber-800 border-amber-500/25' },
  };
  const m = map[status] ?? map.PENDING;
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold border ${dark ? m.dark : m.light}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function FilterHeader({
  label,
  value,
  options,
  onChange,
  theme,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  theme: Theme;
}) {
  const dark = theme === 'dark';
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = value !== 'ALL' && !(label === 'Статус' && value === 'PAID');

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const selectedLabel = options.find(o => o.value === value)?.label;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors ${
          active
            ? dark ? 'text-amber-300' : 'text-amber-800'
            : dark ? 'text-slate-500 hover:text-slate-300' : 'text-stone-500 hover:text-stone-700'
        }`}
      >
        <span>{label}</span>
        <span
          className={`inline-flex items-center justify-center w-4.5 h-4.5 p-0.5 rounded-md border ${
            active
              ? dark ? 'bg-amber-500/15 text-amber-300 border-amber-500/25' : 'bg-amber-500/15 text-amber-800 border-amber-500/30'
              : dark ? 'bg-white/[0.04] text-slate-400 border-white/[0.08] hover:bg-white/[0.08]' : 'bg-white/70 text-stone-500 border-stone-300/60 hover:bg-white'
          }`}
        >
          <HiOutlineFunnel className="text-[11px]" />
        </span>
        {active && (
          <span className={dark ? 'text-amber-300' : 'text-amber-800'}>· {selectedLabel}</span>
        )}
      </button>
      {open && (
        <div
          className={`absolute left-0 top-full mt-1 min-w-[200px] max-h-72 overflow-auto rounded-xl py-1 z-30 backdrop-blur-md border ${
            dark
              ? 'bg-[#161821]/95 border-white/[0.08] shadow-[0_12px_32px_rgba(0,0,0,0.5)]'
              : 'bg-white/95 border-stone-300/60 shadow-[0_12px_32px_rgba(68,64,60,0.15)]'
          }`}
        >
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-[12px] normal-case tracking-normal transition-colors ${
                opt.value === value
                  ? dark ? 'bg-amber-500/15 text-amber-200 font-medium' : 'bg-amber-500/15 text-amber-900 font-medium'
                  : dark ? 'text-slate-300 hover:bg-white/[0.04]' : 'text-stone-700 hover:bg-stone-100/70'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
