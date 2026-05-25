'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import { HiOutlineFunnel, HiOutlineBanknotes, HiOutlineCheckCircle, HiOutlineClock, HiOutlineCreditCard, HiOutlineChevronLeft, HiOutlineChevronRight, HiOutlineClipboard, HiCheck, HiOutlineInformationCircle } from 'react-icons/hi2';
import { useAdminTheme, type Theme } from '../../_components/adminTheme';
import { AdminShell, AdminPanel } from '../../_components/AdminShell';
import SourceBadge, { type SaleSource } from '../../_components/SourceBadge';

export type Row = {
  id: string;
  source: 'course' | 'bundle' | 'connector' | 'yearly';
  /// Джерело продажу (UIMP | TETYANA). UIMP — не показується в UI, TETYANA — маркер-печатка біля імені.
  saleSource: SaleSource;
  createdAt: string;
  clientName: string;
  clientEmail: string;
  /// Telegram username (тільки для Yearly Program; null для course/bundle/connector). Префікс "@" вже є.
  clientTelegram?: string | null;
  /// Для course/bundle/connector — назва продукту. Для yearly — "Річна підписка" або "Місячна на 1 міс." / "Місячна Автоплатіж".
  productLabel: string;
  amount: number;
  /// Очікувана базова ціна продукту на момент рендеру (Course.price/override чи Bundle.price чи
  /// стандартний цінник Конектора). null для yearly (різні плани) і для тестових 1-2₴.
  /// Якщо amount < basePrice → платіж пройшов з акцією/промокодом — рядок маркується амбером.
  basePrice: number | null;
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
  { value: 'yearly', label: 'Річна програма' },
  { value: 'connector', label: 'Конектор' },
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
  const searchParams = useSearchParams();
  const refFromUrl = searchParams.get('ref');

  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [productFilter, setProductFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('PAID');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [pageSize, setPageSize] = useState<number>(25);
  const [page, setPage] = useState<number>(1);
  /// Локальний state-копія `ref` URL-параметра щоб можна було вимкнути підсвітку
  /// після скролу/таймера, не чіпаючи самого URL (інакше React Router scroll-restoration
  /// може смикнути сторінку при перерендері).
  const [highlightRef, setHighlightRef] = useState<string | null>(null);
  useEffect(() => {
    setHighlightRef(refFromUrl);
  }, [refFromUrl]);
  // Через 4 сек ховаємо підсвітку — щоб довго не дратувала, але встигла привернути увагу.
  useEffect(() => {
    if (!highlightRef) return;
    const t = setTimeout(() => setHighlightRef(null), 4000);
    return () => clearTimeout(t);
  }, [highlightRef]);

  // Стандартне відкриття (без ref) — скролимо до верху, перекриваючи browser scroll-restoration.
  // Інакше при поверненні з іншої сторінки/деплою браузер може показати сторінку посередині.
  useEffect(() => {
    if (refFromUrl) return;
    window.scrollTo({ top: 0, left: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Якщо прийшли по ref-у — скидаємо фільтри, щоб не приховати цільовий рядок.
  useEffect(() => {
    if (!refFromUrl) return;
    setTypeFilter('ALL');
    setProductFilter('ALL');
    setStatusFilter('ALL');
    setSearchQuery('');
  }, [refFromUrl]);

  const productOptions = useMemo(() => {
    const PRODUCT_PREFIX: Record<Row['source'], string> = {
      course: 'Курс',
      bundle: 'Пакет',
      yearly: 'Річна програма',
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

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filtered = useMemo(() => rows.filter(r => {
    if (typeFilter !== 'ALL' && r.source !== typeFilter) return false;
    if (productFilter !== 'ALL' && r.productLabel !== productFilter) return false;
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
    if (normalizedQuery) {
      const haystack = `${r.clientName} ${r.clientEmail}`.toLowerCase();
      if (!haystack.includes(normalizedQuery)) return false;
    }
    return true;
  }), [rows, typeFilter, productFilter, statusFilter, normalizedQuery]);

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

  const isFilterActive = typeFilter !== 'ALL' || productFilter !== 'ALL' || statusFilter !== 'PAID' || normalizedQuery.length > 0;

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => { setPage(1); }, [typeFilter, productFilter, statusFilter, normalizedQuery, pageSize]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  const pageStart = (page - 1) * pageSize;
  const pageEnd = Math.min(pageStart + pageSize, filtered.length);
  const paged = filtered.slice(pageStart, pageEnd);

  // Якщо є ref у URL — знаходимо рядок у filtered і виставляємо сторінку.
  useEffect(() => {
    if (!refFromUrl) return;
    const idx = filtered.findIndex(r => r.orderReference === refFromUrl);
    if (idx === -1) return;
    const targetPage = Math.floor(idx / pageSize) + 1;
    if (targetPage !== page) setPage(targetPage);
  }, [refFromUrl, filtered, pageSize, page]);

  // Після того як цільовий рядок зрендерився на поточній сторінці — скролимо до нього.
  useEffect(() => {
    if (!highlightRef) return;
    const el = document.querySelector<HTMLTableRowElement>(
      `tr[data-order-ref="${CSS.escape(highlightRef)}"]`,
    );
    if (el) {
      // Дрібний відступ зверху — щоб рядок не прилипав до хедера таблиці.
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightRef, page, paged]);

  return (
    <AdminShell
      theme={theme}
      setTheme={setTheme}
      eyebrow="Admin · Платежі"
      title="Платежі"
      subtitle="Транзакції за курси, пакети та замовлення Конектора."
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
        <Kpi theme={theme} icon={HiOutlineCreditCard} label="Всього записів" value={totals.total.toLocaleString()} />
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
              className={`flex items-center justify-between gap-3 px-5 py-3 border-b ${
                dark ? 'border-white/[0.06] bg-black/20' : 'border-stone-300/40 bg-stone-50/60'
              }`}
            >
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Пошук за іменем або email…"
                  aria-label="Пошук за іменем або email"
                  className={`w-64 sm:w-72 text-[12px] rounded-lg px-3 py-1.5 outline-none transition-colors border ${
                    dark
                      ? 'bg-black/30 border-white/[0.08] text-slate-100 placeholder:text-slate-500 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20'
                      : 'bg-white border-stone-300/70 text-stone-800 placeholder:text-stone-400 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20'
                  }`}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Очистити пошук"
                    className={`absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 inline-flex items-center justify-center rounded-full text-[11px] leading-none transition-colors ${
                      dark
                        ? 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.08]'
                        : 'text-stone-500 hover:text-stone-900 hover:bg-stone-200/70'
                    }`}
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="flex items-center gap-4 ml-auto">
                {isFilterActive && (
                  <button
                    onClick={() => { setTypeFilter('ALL'); setProductFilter('ALL'); setStatusFilter('PAID'); setSearchQuery(''); }}
                    className={`text-[11px] font-medium transition-colors shrink-0 ${
                      dark ? 'text-amber-300 hover:text-amber-200' : 'text-amber-800 hover:text-amber-900'
                    }`}
                  >
                    Скинути фільтри
                  </button>
                )}
                <p className={`text-[11px] uppercase tracking-[0.18em] font-medium shrink-0 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                  Показано <span className={`font-semibold tabular-nums ${dark ? 'text-slate-200' : 'text-stone-800'}`}>{filtered.length}</span>
                  <span className="opacity-60"> з {rows.length}</span>
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full table-fixed">
                <colgroup>
                  <col style={{ width: '110px' }} />
                  <col style={{ width: '230px' }} />
                  <col style={{ width: '130px' }} />
                  <col style={{ width: '240px' }} />
                  <col style={{ width: '120px' }} />
                  <col style={{ width: '120px' }} />
                  <col style={{ width: '240px' }} />
                </colgroup>
                <thead className={`border-b ${dark ? 'border-white/[0.06] bg-black/10' : 'border-stone-300/40 bg-stone-50/40'}`}>
                  <tr>
                    <Th theme={theme}>Дата</Th>
                    <Th theme={theme}>Клієнт</Th>
                    <Th theme={theme} align="center">
                      <FilterHeader theme={theme} label="Тип" value={typeFilter} options={TYPE_OPTIONS} onChange={setTypeFilter} />
                    </Th>
                    <Th theme={theme} align="center">
                      <FilterHeader theme={theme} label="Вид" value={productFilter} options={productOptions} onChange={setProductFilter} />
                    </Th>
                    <Th theme={theme}>Сума</Th>
                    <Th theme={theme}>
                      <span className="inline-flex items-center gap-1.5">
                        <FilterHeader theme={theme} label="Статус" value={statusFilter} options={STATUS_OPTIONS} onChange={setStatusFilter} />
                        <StatusInfoButton theme={theme} />
                      </span>
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
                    paged.map(row => {
                      const date = new Date(row.createdAt);
                      const isClickable = row.source === 'connector';
                      const isHighlighted = highlightRef === row.orderReference;
                      const isDiscounted =
                        row.status === 'PAID' &&
                        row.basePrice !== null &&
                        row.amount < row.basePrice;
                      return (
                        <tr
                          key={row.id}
                          data-order-ref={row.orderReference}
                          onClick={isClickable ? () => router.push(`/dashboard/manager?order=${encodeURIComponent(row.orderReference)}`) : undefined}
                          className={`transition-colors ${
                            isHighlighted
                              ? dark
                                ? 'bg-amber-500/15 ring-2 ring-inset ring-amber-400/60'
                                : 'bg-amber-200/40 ring-2 ring-inset ring-amber-500/60'
                              : isDiscounted
                                ? dark
                                  ? 'bg-amber-500/[0.04]'
                                  : 'bg-amber-100/30'
                                : ''
                          } ${
                            isClickable
                              ? dark ? 'cursor-pointer hover:bg-white/[0.04]' : 'cursor-pointer hover:bg-stone-100/70'
                              : dark ? 'hover:bg-white/[0.02]' : 'hover:bg-stone-50/60'
                          }`}
                        >
                          <td className="px-5 py-3 whitespace-nowrap">
                            <p className={`text-[13px] ${dark ? 'text-slate-200' : 'text-stone-800'}`}>
                              {date.toLocaleDateString('uk-UA', { timeZone: 'Europe/Kyiv' })}
                            </p>
                            <p className={`text-[11px] ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                              {date.toLocaleTimeString('uk-UA', { timeZone: 'Europe/Kyiv', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <SourceBadge source={row.saleSource} />
                              <div>
                                <p className={`text-[13px] font-medium ${dark ? 'text-slate-100' : 'text-stone-900'}`}>{row.clientName}</p>
                                <p className={`text-[11px] ${dark ? 'text-slate-500' : 'text-stone-500'}`}>{row.clientEmail}</p>
                                {row.clientTelegram && (
                                  <p className={`text-[11px] inline-flex items-center gap-1 ${dark ? 'text-sky-300/85' : 'text-sky-700'}`}>
                                    <span aria-hidden>✈</span>
                                    <span>{row.clientTelegram}</span>
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-center">
                            <TypePill theme={theme} source={row.source} />
                          </td>
                          <td className="px-5 py-3 text-center">
                            <ProductCell theme={theme} row={row} />
                          </td>
                          <td className={`px-5 py-3 text-[13px] font-semibold tabular-nums whitespace-nowrap ${dark ? 'text-slate-100' : 'text-stone-900'}`}>
                            <div className="flex flex-col gap-0.5">
                              <span>{row.amount.toLocaleString()} ₴</span>
                              {isDiscounted && row.basePrice !== null && (
                                <span
                                  title={`Базова ціна: ${row.basePrice.toLocaleString()} ₴ · знижка ${(row.basePrice - row.amount).toLocaleString()} ₴`}
                                  className={`inline-flex items-center gap-1 text-[10px] font-medium tabular-nums ${
                                    dark ? 'text-amber-300' : 'text-amber-800'
                                  }`}
                                >
                                  <span className={dark ? 'text-slate-500 line-through' : 'text-stone-400 line-through'}>
                                    {row.basePrice.toLocaleString()}
                                  </span>
                                  <span>−{(row.basePrice - row.amount).toLocaleString()} ₴</span>
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <StatusPill theme={theme} status={row.status} />
                          </td>
                          <td className="px-5 py-3">
                            <CopyableRef theme={theme} value={row.orderReference} />
                          </td>
                        </tr>
                      );
                    })
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
                pageEnd={pageEnd}
                pageSize={pageSize}
                onPage={setPage}
                onPageSize={setPageSize}
              />
            )}
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

function Th({
  children,
  theme,
  align = 'left',
}: {
  children: React.ReactNode;
  theme: Theme;
  align?: 'left' | 'center' | 'right';
}) {
  const dark = theme === 'dark';
  const alignCls = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';
  return (
    <th className={`${alignCls} px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
      {children}
    </th>
  );
}

function TypePill({ source, theme }: { source: Row['source']; theme: Theme }) {
  const dark = theme === 'dark';
  const map = {
    bundle:    { label: 'Пакет',          dark: 'bg-violet-500/15 text-violet-300 border-violet-500/20',   light: 'bg-violet-500/10 text-violet-800 border-violet-500/25' },
    connector: { label: 'Гра',            dark: 'bg-orange-500/15 text-orange-300 border-orange-500/20',   light: 'bg-orange-500/10 text-orange-800 border-orange-500/25' },
    course:    { label: 'Курс',           dark: 'bg-sky-500/15 text-sky-300 border-sky-500/20',             light: 'bg-sky-500/10 text-sky-800 border-sky-500/25' },
    yearly:    { label: 'Річна програма', dark: 'bg-amber-500/15 text-amber-300 border-amber-500/20',       light: 'bg-amber-500/10 text-amber-800 border-amber-500/25' },
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
      <TruncatedPill
        theme={theme}
        label={row.productLabel}
        icon="📦"
        tone={{
          dark: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
          light: 'bg-violet-500/10 text-violet-800 border-violet-500/25',
        }}
      />
    );
  }
  if (row.source === 'connector') {
    return (
      <TruncatedPill
        theme={theme}
        label={row.productLabel}
        icon="🧩"
        tone={{
          dark: 'bg-orange-500/10 text-orange-300 border-orange-500/20',
          light: 'bg-orange-500/10 text-orange-800 border-orange-500/25',
        }}
      />
    );
  }
  if (row.source === 'yearly') {
    // Уніфіковані кольори з /admin/yearly-program PlanBadge і /admin/payment-logs KindBadge:
    // Річна = amber, Місячна Автоплатіж = indigo, Місячна на 1 міс. = sky.
    const yearlyTone =
      row.productLabel === 'Місячна Автоплатіж'
        ? { dark: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20', light: 'bg-emerald-500/10 text-emerald-800 border-emerald-500/25' }
        : row.productLabel === 'Місячна на 1 міс.'
          ? { dark: 'bg-sky-500/10 text-sky-300 border-sky-500/20', light: 'bg-sky-500/10 text-sky-800 border-sky-500/25' }
          : { dark: 'bg-amber-500/10 text-amber-300 border-amber-500/20', light: 'bg-amber-500/10 text-amber-800 border-amber-500/25' };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${
        dark ? yearlyTone.dark : yearlyTone.light
      }`}>
        🎓 <span>{row.productLabel}</span>
      </span>
    );
  }
  return (
    <TruncatedPill
      theme={theme}
      label={row.productLabel}
      tone={{
        dark: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
        light: 'bg-sky-500/10 text-sky-800 border-sky-500/25',
      }}
    />
  );
}

function useTruncationTooltip<T extends HTMLElement>() {
  const textRef = useRef<T>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tipPos, setTipPos] = useState<{ top: number; left: number } | null>(null);

  const show = (e: React.MouseEvent<HTMLElement>) => {
    const textEl = textRef.current;
    if (!textEl) return;
    // Показуємо тільки якщо текст реально обрізаний
    if (textEl.scrollWidth <= textEl.clientWidth + 1) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = { top: rect.top, left: rect.left + rect.width / 2 };
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setTipPos(pos), 500);
  };
  const hide = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setTipPos(null);
  };

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    if (!tipPos) return;
    const onScroll = () => setTipPos(null);
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [tipPos]);

  return { textRef, tipPos, show, hide };
}

function TooltipBubble({
  theme,
  label,
  pos,
  mono = false,
}: {
  theme: Theme;
  label: string;
  pos: { top: number; left: number };
  mono?: boolean;
}) {
  const dark = theme === 'dark';
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      role="tooltip"
      style={{ top: pos.top - 10, left: pos.left, transform: 'translate(-50%, -100%)' }}
      className={`pointer-events-none fixed z-[80] px-3 py-2 rounded-lg text-[12px] leading-snug text-left whitespace-normal break-words max-w-[420px] backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 ${
        mono ? 'font-mono text-[11px]' : 'font-medium'
      } ${
        dark
          ? 'bg-[#111317]/95 text-slate-100 border border-white/[0.08] shadow-[0_12px_32px_rgba(0,0,0,0.5)]'
          : 'bg-stone-900/95 text-stone-50 shadow-[0_12px_32px_rgba(68,64,60,0.28)]'
      }`}
    >
      {label}
      <span
        aria-hidden
        style={{ transform: 'translateX(-50%) rotate(45deg)' }}
        className={`absolute left-1/2 bottom-0 -mb-1 w-2.5 h-2.5 ${
          dark
            ? 'bg-[#111317]/95 border-r border-b border-white/[0.08]'
            : 'bg-stone-900/95'
        }`}
      />
    </div>,
    document.body,
  );
}

function TruncatedPill({
  theme,
  label,
  icon,
  tone,
}: {
  theme: Theme;
  label: string;
  icon?: string;
  tone: { dark: string; light: string };
}) {
  const dark = theme === 'dark';
  const { textRef, tipPos, show, hide } = useTruncationTooltip<HTMLSpanElement>();

  return (
    <>
      <span
        onMouseEnter={show}
        onMouseLeave={hide}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border align-middle max-w-full ${
          dark ? tone.dark : tone.light
        }`}
      >
        {icon && <span className="shrink-0">{icon}</span>}
        <span ref={textRef} className="truncate max-w-[200px]">{label}</span>
      </span>
      {tipPos && <TooltipBubble theme={theme} label={label} pos={tipPos} />}
    </>
  );
}

function CopyableRef({ theme, value }: { theme: Theme; value: string }) {
  const dark = theme === 'dark';
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!expanded) return;
    const onDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [expanded]);

  const handleToggleExpand = () => {
    const sel = window.getSelection?.();
    if (sel && sel.toString().length > 0) return;
    setExpanded(prev => !prev);
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard недоступний — користувач виділить руками
    }
  };

  const containerBg = expanded
    ? dark ? 'bg-white/[0.05] ring-1 ring-white/10' : 'bg-stone-900/[0.04] ring-1 ring-stone-900/10'
    : dark ? 'hover:bg-white/[0.05]' : 'hover:bg-stone-900/[0.04]';
  const focusRing = dark ? 'focus-visible:ring-amber-400/40' : 'focus-visible:ring-amber-600/40';

  return (
    <span ref={wrapperRef} className="group/copy relative inline-flex w-full max-w-full">
      <span className={`inline-flex items-start gap-1.5 w-full max-w-full rounded-md px-1.5 py-0.5 -mx-1.5 -my-0.5 transition-colors ${containerBg}`}>
        <button
          type="button"
          onClick={handleToggleExpand}
          aria-label={expanded ? 'Згорнути референс' : 'Розгорнути референс'}
          aria-expanded={expanded}
          className={`text-left min-w-0 flex-1 cursor-pointer select-text outline-none focus-visible:ring-2 ${focusRing} rounded-sm`}
        >
          <span className={`block text-[11px] font-mono ${dark ? 'text-slate-500' : 'text-stone-500'} ${expanded ? 'whitespace-normal break-all' : 'truncate'}`}>
            {value}
          </span>
        </button>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? 'Скопійовано' : 'Скопіювати в буфер'}
          className={`flex-shrink-0 inline-flex items-center justify-center w-4 h-4 mt-[1px] rounded transition-all outline-none focus-visible:ring-2 cursor-pointer ${focusRing} ${
            copied
              ? dark ? 'text-emerald-300' : 'text-emerald-600'
              : dark
                ? 'text-slate-500 opacity-40 group-hover/copy:opacity-100 hover:text-slate-200'
                : 'text-stone-500 opacity-40 group-hover/copy:opacity-100 hover:text-stone-900'
          }`}
        >
          {copied ? <HiCheck className="w-3.5 h-3.5" /> : <HiOutlineClipboard className="w-3.5 h-3.5" />}
        </button>
      </span>

      {copied && (
        <span
          role="status"
          aria-live="polite"
          className={`pointer-events-none absolute bottom-full left-0 mb-1.5 z-20 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold shadow-lg border whitespace-nowrap ${
            dark
              ? 'bg-slate-900 border-emerald-500/30 text-emerald-300 shadow-black/40'
              : 'bg-stone-900 border-emerald-400/40 text-emerald-300 shadow-stone-900/30'
          }`}
        >
          <HiCheck className="w-3 h-3" /> Скопійовано
          <span
            className={`absolute top-full left-3 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent ${
              dark ? 'border-t-slate-900' : 'border-t-stone-900'
            }`}
          />
        </span>
      )}
    </span>
  );
}

function StatusInfoButton({ theme }: { theme: Theme }) {
  const dark = theme === 'dark';
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const items: { tone: 'PAID' | 'PENDING' | 'FAILED' | 'REFUNDED'; summary: string; causes?: string[] }[] = [
    {
      tone: 'PAID',
      summary: 'WayForPay підтвердив успішну оплату. Сума зарахована, доступ відкрито, листи з курсом надіслані.',
    },
    {
      tone: 'PENDING',
      summary: 'Платіж створено в нашій системі, але фінального підтвердження від WayForPay ще немає. Можливі причини:',
      causes: [
        'клієнт перейшов на форму оплати, але не завершив платіж (закрив вкладку, передумав)',
        'оплата у банка в обробці (перевірка 3DS / SCA)',
        'Місячна підписка з автосписанням — рекурентний платіж ще не настав',
        'callback від WFP не дійшов або затримався',
      ],
    },
    {
      tone: 'FAILED',
      summary: 'Банк або WayForPay відхилив транзакцію. Доступ не відкрито. Можливі причини:',
      causes: [
        'недостатньо коштів на картці',
        'картка заблокована, прострочена або не для онлайн-платежів',
        'не пройшла перевірка 3DS / SCA (невірний код, тайм-аут)',
        'клієнт натиснув "Скасувати" на формі WFP',
        'перевищено ліміт банку (денний/місячний)',
      ],
    },
    {
      tone: 'REFUNDED',
      summary: 'Адмін повернув кошти через WayForPay (повний або частковий refund). Доступ до продукту зазвичай закривається окремою дією вручну.',
    },
  ];

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label="Що означають статуси"
        className={`inline-flex items-center justify-center w-5 h-5 rounded-full border transition-colors ${
          dark
            ? 'text-amber-300 border-amber-400/40 bg-amber-500/15 hover:bg-amber-500/25'
            : 'text-amber-800 border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25'
        }`}
      >
        <HiOutlineInformationCircle className="text-[14px]" />
      </button>
      {open && (
        <div
          className={`absolute right-0 top-full mt-1.5 w-[440px] rounded-xl py-2 z-30 backdrop-blur-md border normal-case tracking-normal ${
            dark
              ? 'bg-[#161821]/95 border-white/[0.08] shadow-[0_12px_32px_rgba(0,0,0,0.5)]'
              : 'bg-white/95 border-stone-300/60 shadow-[0_12px_32px_rgba(68,64,60,0.15)]'
          }`}
        >
          <div className={`px-3 pb-2 mb-1 border-b text-[11px] font-semibold uppercase tracking-[0.18em] ${
            dark ? 'border-white/[0.06] text-slate-400' : 'border-stone-200 text-stone-500'
          }`}>
            Статуси платежів
          </div>
          {items.map(it => (
            <div key={it.tone} className="px-3 py-2 flex items-start gap-3">
              <span className="shrink-0 w-[100px] flex justify-start mt-0.5">
                <StatusPill theme={theme} status={it.tone} />
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-[12px] leading-snug ${dark ? 'text-slate-300' : 'text-stone-700'}`}>
                  {it.summary}
                </p>
                {it.causes && (
                  <ul className={`mt-1 space-y-0.5 text-[11.5px] leading-snug list-disc pl-4 ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
                    {it.causes.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
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
    <div className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t text-[12px] ${
      dark ? 'border-white/[0.06] text-slate-400' : 'border-stone-300/40 text-stone-600'
    }`}>
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
            className={`h-7 px-2 rounded-md text-[12px] outline-none ${
              dark
                ? 'bg-white/[0.04] border border-white/[0.08] text-slate-200'
                : 'bg-white/80 border border-stone-300/60 text-stone-800'
            }`}
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
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  if (left > 2) pages.push('…');
  for (let p = left; p <= right; p++) pages.push(p);
  if (right < total - 1) pages.push('…');
  pages.push(total);
  return pages;
}
