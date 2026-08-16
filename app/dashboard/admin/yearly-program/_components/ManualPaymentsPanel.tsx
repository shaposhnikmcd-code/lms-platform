'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  HiOutlineArrowPath,
  HiOutlineBanknotes,
  HiOutlineChevronDown,
  HiOutlineChevronUp,
  HiOutlineExclamationTriangle,
  HiOutlineMagnifyingGlass,
} from 'react-icons/hi2';
import type { Theme } from '../../_components/adminTheme';
import { AdminPanel } from '../../_components/AdminShell';
import {
  describeSplitParts,
  groupManualPayments,
  pluralParts,
  type ManualPaymentGroup,
} from '@/lib/yearlyProgramManualGroups';
import type { Row } from './types';

const ManualPaymentModal = dynamic(() => import('./ManualPaymentModal'), { ssr: false });

/// Один рядок реєстру (дзеркало відповіді GET /api/admin/yearly-program/manual-payments).
interface ManualPaymentRow {
  id: string;
  orderReference: string;
  amount: number;
  status: string;
  /// Коли менеджер вніс платіж у систему.
  createdAt: string;
  /// Коли клієнт фактично заплатив (вказує менеджер у формі).
  paidAt: string | null;
  method: string | null;
  note: string | null;
  enteredBy: string | null;
  /// true — платіж лишається в історії й «Доході», але місяця доступу не дає.
  excludedFromAccess: boolean;
  subscriptionId: string | null;
  plan: 'YEARLY' | 'MONTHLY' | null;
  autoRenew: boolean | null;
  cohortName: string | null;
  userName: string | null;
  userEmail: string;
}

/// Лейбли способів — мають збігатись з METHODS у ManualPaymentModal і MANUAL_METHOD_LABELS
/// у [id]/route.ts. Незнайомий спосіб показуємо «як є».
const METHOD_LABELS: Record<string, { label: string; icon: string }> = {
  cash: { label: 'Готівка', icon: '💵' },
  transfer: { label: 'Переказ', icon: '🏦' },
  direct: { label: 'Напряму (ФОП)', icon: '👤' },
  carryover: { label: 'Перенесення', icon: '🔄' },
};

const METHOD_FILTER_OPTIONS = [
  { value: 'ALL', label: 'Усі способи' },
  { value: 'cash', label: '💵 Готівка' },
  { value: 'transfer', label: '🏦 Переказ' },
  { value: 'direct', label: '👤 Напряму (ФОП)' },
  { value: 'carryover', label: '🔄 Перенесення' },
];

/// Київський час — як і решта дат в адмінці Річної (щоб «внесено 16:52» у реєстрі
/// збігалось із записом у журналі підписки незалежно від таймзони браузера).
const KYIV_DATETIME = new Intl.DateTimeFormat('uk-UA', {
  timeZone: 'Europe/Kyiv',
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});
const KYIV_DATE = new Intl.DateTimeFormat('uk-UA', {
  timeZone: 'Europe/Kyiv',
  day: '2-digit', month: '2-digit', year: 'numeric',
});

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  return KYIV_DATETIME.format(new Date(iso)).replace(',', '');
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return KYIV_DATE.format(new Date(iso));
}

/// 1 внесення / 2-4 внесення / 5+ внесень.
function pluralEntries(n: number): string {
  const mod100 = Math.abs(n) % 100;
  const mod10 = Math.abs(n) % 10;
  if (mod100 >= 11 && mod100 <= 14) return 'внесень';
  if (mod10 >= 1 && mod10 <= 4) return 'внесення';
  return 'внесень';
}

/// Вкладка «Ручні платежі» — реєстр УСІХ оплат поза WayForPay по всіх підписках Річної
/// (готівка / переказ / ФОП / перенесення). Дані тягне окремий admin-endpoint; фільтри
/// по періоду й пошук виконуються на сервері, фільтр способу — локально (набір малий).
export default function ManualPaymentsPanel({
  theme,
  rows,
  monthlyPrice,
  yearlyPrice,
  onChanged,
}: {
  theme: Theme;
  /// Підписки з основної таблиці — джерело для пошуку клієнта у «+ Ручний платіж».
  rows: Row[];
  monthlyPrice: number;
  yearlyPrice: number;
  /// Викликається після успішного внесення платежу (щоб оновити таблицю підписок і KPI).
  onChanged: () => void;
}) {
  const dark = theme === 'dark';
  const [data, setData] = useState<ManualPaymentRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [payRow, setPayRow] = useState<Row | null>(null);

  // Пошук застосовуємо з невеликою затримкою — щоб кожна буква не била в БД.
  useEffect(() => {
    const t = setTimeout(() => setAppliedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (appliedSearch) qs.set('q', appliedSearch);
      if (from) qs.set('from', from);
      if (to) qs.set('to', to);
      const res = await fetch(`/api/admin/yearly-program/manual-payments?${qs.toString()}`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `Помилка ${res.status}`);
      setData(json.rows as ManualPaymentRow[]);
      setTotal(json.total as number);
      setTruncated(!!json.truncated);
    } catch (e) {
      setError((e as Error).message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, from, to]);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(
    () => (data ?? []).filter((r) => methodFilter === 'ALL' || r.method === methodFilter),
    [data, methodFilter],
  );

  // Частки авто-розбивки одного внесення (12 800 ₴ = 5 рядків у БД) склеюємо назад в
  // ОДИН запис реєстру. Без цього менеджер бачив 5 рядків з однаковими датою/сумою/
  // нотаткою і читав їх як дубль. Гроші від групування не змінюються.
  const rawGroups = useMemo(() => groupManualPayments(visible), [visible]);

  // Реєстр обрізається лімітом (перші 1000 рядків) і фільтрами — внесення може розрізатись
  // посередині. Показати такий обрубок як «2 200 ₴, розбито на 1 частину» = збрехати про
  // суму внесення, тому неповні групи розкладаємо назад на окремі рядки-частки з поміткою
  // «частина внесення» і без total/заголовка розбивки.
  const groups = useMemo<(ManualPaymentGroup<ManualPaymentRow> & { partial?: boolean })[]>(
    () => rawGroups.flatMap((g) => (
      g.isComplete
        ? [g]
        : g.parts.map((part) => ({
            key: `partial:${part.id}`,
            base: g.base,
            parts: [part],
            head: part,
            total: part.amount,
            amounts: [part.amount],
            isSplit: false,
            maxIndex: g.maxIndex,
            isComplete: false,
            partial: true,
          }))
    )),
    [rawGroups],
  );
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const toggleGroup = useCallback((key: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  // Сума показаних платежів — швидка перевірка «скільки прийняли готівкою за період».
  // Рахується по РЯДКАХ, тому групування її не змінює.
  const shownSum = visible.reduce((s, r) => (r.status === 'PAID' ? s + r.amount : s), 0);

  const inputCls = `px-3 py-1.5 rounded-lg border text-[12px] outline-none transition-colors ${
    dark
      ? 'bg-white/[0.04] border-white/[0.08] text-slate-200 placeholder:text-slate-600 focus:border-amber-400/40'
      : 'bg-white/80 border-stone-300/60 text-stone-800 placeholder:text-stone-400 focus:border-amber-600/50'
  }`;

  return (
    <>
      <AdminPanel theme={theme} padding="p-3" className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[12px] font-semibold transition-colors ${
              dark
                ? 'bg-emerald-500/12 border-emerald-400/35 text-emerald-200 hover:bg-emerald-500/20'
                : 'bg-emerald-50 border-emerald-300/60 text-emerald-900 hover:bg-emerald-100'
            }`}
            title="Знайти студента і зафіксувати оплату поза WayForPay"
          >
            <HiOutlineBanknotes className="text-base" />
            + Ручний платіж
          </button>

          <div className="relative">
            <HiOutlineMagnifyingGlass className={`absolute left-2.5 top-1/2 -translate-y-1/2 text-sm ${dark ? 'text-slate-500' : 'text-stone-400'}`} />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Пошук за email або імʼям"
              className={`${inputCls} pl-8 w-full sm:w-[240px]`}
            />
          </div>

          <label className={`flex items-center gap-1.5 text-[11px] ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
            Внесено з
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
          </label>
          <label className={`flex items-center gap-1.5 text-[11px] ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
            по
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
          </label>

          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className={inputCls}
          >
            {METHOD_FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {(from || to || methodFilter !== 'ALL' || search) && (
            <button
              type="button"
              onClick={() => { setFrom(''); setTo(''); setMethodFilter('ALL'); setSearch(''); }}
              className={`px-2.5 py-1.5 rounded-lg border text-[11px] ${
                dark ? 'border-white/10 text-slate-400 hover:bg-white/[0.06]' : 'border-stone-300 text-stone-600 hover:bg-stone-100'
              }`}
            >
              Скинути
            </button>
          )}

          <button
            type="button"
            onClick={load}
            disabled={loading}
            aria-label="Оновити"
            title="Оновити"
            className={`ml-auto inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] disabled:opacity-50 ${
              dark ? 'border-white/10 text-slate-300 hover:bg-white/[0.06]' : 'border-stone-300 text-stone-700 hover:bg-stone-100'
            }`}
          >
            <HiOutlineArrowPath className={loading ? 'animate-spin' : ''} />
            Оновити
          </button>
        </div>
      </AdminPanel>

      <AdminPanel theme={theme} padding="p-0">
        <div className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b text-[12px] ${
          dark ? 'border-white/[0.06] text-slate-400' : 'border-stone-300/40 text-stone-600'
        }`}>
          {/* Лічильник — ВНЕСЕННЯ (те, що менеджер реально прийняв), а не рядки в БД.
              Кількість рядків показуємо довідково, коли розбивки є. */}
          <span>
            Показано <b className="tabular-nums">{groups.length.toLocaleString()}</b> {pluralEntries(groups.length)}
            {visible.length !== groups.length && <> ({visible.length.toLocaleString()} платіжних рядків)</>}
            {visible.length !== total && <> з <b className="tabular-nums">{total.toLocaleString()}</b> у вибірці</>}
            {' '}· сума показаних: <b className="tabular-nums">{shownSum.toLocaleString()} ₴</b>
          </span>
          {truncated && (
            <span className={`inline-flex items-center gap-1.5 ${dark ? 'text-amber-300' : 'text-amber-700'}`}>
              <HiOutlineExclamationTriangle /> показано перші 1000 — звузьте період
            </span>
          )}
        </div>

        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full text-[13px]">
            <thead className={`border-b ${dark ? 'border-white/[0.06] bg-black/10' : 'border-stone-300/40 bg-stone-50/40'}`}>
              <tr className={`text-left text-[11px] uppercase tracking-wider ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                <th className="px-3 py-2 font-medium">Внесено</th>
                <th className="px-3 py-2 font-medium">Дата платежу</th>
                <th className="px-3 py-2 font-medium">Клієнт</th>
                <th className="px-3 py-2 font-medium text-center">План</th>
                <th className="px-3 py-2 font-medium text-right">Сума</th>
                <th className="px-3 py-2 font-medium">Спосіб</th>
                <th className="px-3 py-2 font-medium">Хто вніс</th>
                <th className="px-3 py-2 font-medium">Нотатка</th>
              </tr>
            </thead>
            <tbody className={dark ? 'divide-y divide-white/[0.04]' : 'divide-y divide-stone-200/60'}>
              {loading && data === null ? (
                <tr><td colSpan={8} className={`px-4 py-14 text-center text-sm ${dark ? 'text-slate-500' : 'text-stone-500'}`}>Завантаження…</td></tr>
              ) : error ? (
                <tr><td colSpan={8} className={`px-4 py-14 text-center text-sm ${dark ? 'text-rose-300' : 'text-rose-700'}`}>{error}</td></tr>
              ) : visible.length === 0 ? (
                <tr><td colSpan={8} className={`px-4 py-14 text-center text-sm ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                  Ручних платежів за цими фільтрами немає.
                </td></tr>
              ) : (
                groups.map((g) => {
                  const p = g.head;
                  const m = p.method ? METHOD_LABELS[p.method] : null;
                  const open = openGroups.has(g.key);
                  const allExcluded = g.parts.every((x) => x.excludedFromAccess);
                  return (
                    <Fragment key={g.key}>
                    <tr data-manual-group={g.key} className={dark ? 'hover:bg-white/[0.02]' : 'hover:bg-stone-50/60'}>
                      <td className={`px-3 py-2.5 whitespace-nowrap tabular-nums text-[12px] ${dark ? 'text-slate-300' : 'text-stone-700'}`}>
                        {fmtDateTime(p.createdAt)}
                      </td>
                      <td className={`px-3 py-2.5 whitespace-nowrap tabular-nums text-[12px] ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
                        {fmtDate(p.paidAt)}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className={`font-medium ${dark ? 'text-slate-200' : 'text-stone-800'}`}>{p.userName ?? '—'}</div>
                        <div className={`text-[11px] ${dark ? 'text-slate-500' : 'text-stone-500'}`}>{p.userEmail}</div>
                      </td>
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          p.plan === 'YEARLY'
                            ? dark ? 'bg-amber-400/15 text-amber-200' : 'bg-amber-100 text-amber-900'
                            : dark ? 'bg-sky-400/15 text-sky-200' : 'bg-sky-100 text-sky-900'
                        }`}>
                          {p.plan === 'YEARLY' ? 'Річний' : p.plan === 'MONTHLY' ? (p.autoRenew ? 'Місячний авто' : 'Місячний') : '—'}
                        </span>
                      </td>
                      {/* Сума ВСЬОГО внесення. Розбивка розкривається кліком — так одне
                          внесення на 12 800 ₴ більше не виглядає як 5 однакових дублів. */}
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <div className={`tabular-nums font-semibold ${
                          p.status === 'PAID' && !allExcluded
                            ? (dark ? 'text-slate-100' : 'text-stone-900')
                            : (dark ? 'text-slate-500 line-through' : 'text-stone-400 line-through')
                        }`}>
                          {g.total.toLocaleString()} ₴
                        </div>
                        {g.isSplit && (
                          <button
                            type="button"
                            onClick={() => toggleGroup(g.key)}
                            aria-expanded={open}
                            className={`mt-0.5 inline-flex items-center gap-1 text-[10.5px] transition-colors ${
                              dark ? 'text-slate-400 hover:text-slate-200' : 'text-stone-500 hover:text-stone-800'
                            }`}
                          >
                            {open ? <HiOutlineChevronUp className="text-[11px]" /> : <HiOutlineChevronDown className="text-[11px]" />}
                            розбито на {g.parts.length} {pluralParts(g.parts.length)} ({describeSplitParts(g.amounts)})
                          </button>
                        )}
                        {/* Обрубок внесення: показуємо саме частку, а не «повну» суму. */}
                        {g.partial && (
                          <div className={`mt-0.5 text-[10.5px] ${dark ? 'text-amber-300/80' : 'text-amber-700'}`}>
                            частина внесення — повний список у картці підписки
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          dark ? 'bg-white/[0.06] text-slate-300' : 'bg-stone-100 text-stone-700'
                        }`}>
                          {m ? `${m.icon} ${m.label}` : p.method}
                        </span>
                      </td>
                      <td className={`px-3 py-2.5 text-[11px] ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
                        {p.enteredBy ?? <span className={dark ? 'text-slate-600' : 'text-stone-400'}>—</span>}
                      </td>
                      <td className={`px-3 py-2.5 text-[11px] max-w-[280px] ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
                        {p.note ? <span className="italic">«{p.note}»</span> : <span className={dark ? 'text-slate-600' : 'text-stone-400'}>—</span>}
                        {allExcluded && (
                          <span className={`block mt-0.5 text-[10px] ${dark ? 'text-amber-300' : 'text-amber-700'}`}>🚫 поза доступом</span>
                        )}
                      </td>
                    </tr>
                    {g.isSplit && open && (
                      <tr data-manual-group-parts={g.key} className={dark ? 'bg-white/[0.02]' : 'bg-stone-50/70'}>
                        <td colSpan={8} className="px-3 pb-3 pt-0">
                          <div className={`rounded-lg border text-[11px] max-w-[560px] ${dark ? 'border-white/[0.07]' : 'border-stone-300/50'}`}>
                            <div className={`px-3 py-1.5 border-b text-[10.5px] ${
                              dark ? 'border-white/[0.06] text-slate-500' : 'border-stone-300/40 text-stone-500'
                            }`}>
                              Одне внесення {g.total.toLocaleString()} ₴, розкладене на місячні слоти — кожна частка зараховується як 1 місяць доступу.
                            </div>
                            <div className={dark ? 'divide-y divide-white/[0.05]' : 'divide-y divide-stone-200/60'}>
                              {g.parts.map((part, i) => (
                                <div key={part.id} className="px-3 py-1.5 flex items-center justify-between gap-3">
                                  <span className={dark ? 'text-slate-400' : 'text-stone-600'}>
                                    Частка {i + 1} з {g.parts.length}
                                    {part.excludedFromAccess && (
                                      <span className={dark ? ' text-amber-300' : ' text-amber-700'}> · 🚫 поза доступом</span>
                                    )}
                                  </span>
                                  <span className={`tabular-nums font-semibold ${
                                    part.excludedFromAccess
                                      ? (dark ? 'text-slate-600 line-through' : 'text-stone-400 line-through')
                                      : (dark ? 'text-slate-200' : 'text-stone-800')
                                  }`}>{part.amount.toLocaleString()} ₴</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </AdminPanel>

      {pickerOpen && (
        <SubscriptionPicker
          theme={theme}
          rows={rows}
          onClose={() => setPickerOpen(false)}
          onPick={(r) => { setPickerOpen(false); setPayRow(r); }}
        />
      )}
      {payRow && (
        <ManualPaymentModal
          row={payRow}
          theme={theme}
          monthlyPrice={monthlyPrice}
          yearlyPrice={yearlyPrice}
          onClose={() => setPayRow(null)}
          onDone={() => { setPayRow(null); load(); onChanged(); }}
        />
      )}
    </>
  );
}

/// Пошук підписки перед внесенням ручного платежу. Працює з уже завантаженим списком
/// підписок (той самий, що й у таблиці) — окремий endpoint не потрібен. Архівні не
/// показуємо: сервер усе одно відхиляє для них оплату.
function SubscriptionPicker({
  theme,
  rows,
  onClose,
  onPick,
}: {
  theme: Theme;
  rows: Row[];
  onClose: () => void;
  onPick: (row: Row) => void;
}) {
  const dark = theme === 'dark';
  const [q, setQ] = useState('');

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const pool = rows.filter((r) => r.status !== 'ARCHIVED');
    if (!needle) return pool.slice(0, 20);
    return pool
      .filter((r) => r.userEmail.toLowerCase().includes(needle) || (r.userName ?? '').toLowerCase().includes(needle))
      .slice(0, 20);
  }, [rows, q]);

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center p-3 pt-[10vh]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={`relative w-full max-h-[70vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden ${
          dark ? 'bg-zinc-950 border border-white/10 text-slate-200' : 'bg-stone-100 border border-stone-200 text-stone-800'
        }`}
        style={{ maxWidth: 'min(560px, 96vw)' }}
      >
        <header className={`shrink-0 px-5 py-4 border-b ${dark ? 'bg-zinc-900/95 border-white/10' : 'bg-white/95 border-stone-200'}`}>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[15px] font-bold">Кому зараховуємо оплату?</h3>
            <button onClick={onClose} aria-label="Закрити" className={`w-8 h-8 rounded-full ${dark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-stone-100 text-stone-500'}`}>✕</button>
          </div>
          <input
            autoFocus
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Пошук за email або імʼям"
            className={`mt-3 w-full px-3 py-2 rounded-lg border text-[13px] outline-none ${
              dark ? 'bg-zinc-800 border-white/10 text-slate-100 focus:border-emerald-400/40' : 'bg-white border-stone-300 text-stone-900 focus:border-emerald-400'
            }`}
          />
        </header>
        <div className="flex-1 overflow-y-auto">
          {matches.length === 0 ? (
            <div className={`px-5 py-10 text-center text-[12px] ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
              Нікого не знайдено. Студента можна завести кнопкою «Додати студента вручну» на вкладці «Підписки».
            </div>
          ) : (
            <ul className={dark ? 'divide-y divide-white/[0.05]' : 'divide-y divide-stone-200/70'}>
              {matches.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => onPick(r)}
                    className={`w-full text-left px-5 py-3 flex items-center justify-between gap-3 transition-colors ${
                      dark ? 'hover:bg-white/[0.05]' : 'hover:bg-stone-200/60'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium truncate">{r.userName ?? r.userEmail}</span>
                      <span className={`block text-[11px] truncate ${dark ? 'text-slate-500' : 'text-stone-500'}`}>{r.userEmail}</span>
                    </span>
                    <span className={`shrink-0 text-[11px] ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
                      {r.plan === 'YEARLY' ? 'Річний' : r.autoRenew ? 'Місячний авто' : 'Місячний'}
                      {' · '}
                      {r.totalPaid.toLocaleString()} ₴
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
