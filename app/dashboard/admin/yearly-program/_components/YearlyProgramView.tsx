'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  HiOutlineUserGroup,
  HiOutlineCheckCircle,
  HiOutlineClock,
  HiOutlineXCircle,
  HiOutlineBanknotes,
  HiOutlineChevronDown,
  HiOutlineChevronUp,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
} from 'react-icons/hi2';
import { useAdminTheme, type Theme } from '../../_components/adminTheme';
import { AdminShell, AdminPanel } from '../../_components/AdminShell';

export type Plan = 'YEARLY' | 'MONTHLY';
export type SubStatus = 'PENDING' | 'ACTIVE' | 'GRACE' | 'EXPIRED' | 'CANCELLED' | 'ARCHIVED';

export interface Row {
  id: string;
  createdAt: string;
  userName: string | null;
  userEmail: string;
  plan: Plan;
  status: SubStatus;
  startDate: string | null;
  expiresAt: string | null;
  daysLeft: number | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  lastPaymentAt: string | null;
  failedChargeCount: number;
  lastChargeError: string | null;
  hasRecToken: boolean;
  sendpulseStudentId: number | null;
  sendpulseAccessOpenedAt: string | null;
  sendpulseAccessClosedAt: string | null;
  paymentsCount: number;
  totalPaid: number;
}

export interface SummaryData {
  total: number;
  active: number;
  grace: number;
  expired: number;
  cancelled: number;
  revenueTotal: number;
}

interface SubscriptionDetails {
  id: string;
  user: { id: string; name: string | null; email: string } | null;
  plan: Plan;
  status: SubStatus;
  startDate: string | null;
  expiresAt: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancelledReason: string | null;
  recTokenMasked: string | null;
  lastPaymentAt: string | null;
  lastChargeError: string | null;
  failedChargeCount: number;
  sendpulseStudentId: number | null;
  sendpulseAccessOpenedAt: string | null;
  sendpulseAccessClosedAt: string | null;
  reminderSent3d: boolean;
  reminderSent1d: boolean;
  reminderSentExpired: boolean;
  payments: Array<{
    id: string;
    orderReference: string;
    amount: number;
    status: string;
    createdAt: string;
    paidAt: string | null;
  }>;
  events: Array<{
    id: string;
    type: string;
    message: string | null;
    metadata: unknown;
    createdAt: string;
  }>;
}

const PLAN_OPTIONS: { value: 'ALL' | Plan; label: string }[] = [
  { value: 'ALL', label: 'Всі' },
  { value: 'YEARLY', label: 'Річний' },
  { value: 'MONTHLY', label: 'Місячний' },
];

const STATUS_OPTIONS: { value: 'ALL' | SubStatus; label: string }[] = [
  { value: 'ALL', label: 'Усі' },
  { value: 'ACTIVE', label: 'Активний' },
  { value: 'GRACE', label: 'Grace (7 днів)' },
  { value: 'EXPIRED', label: 'Прострочено' },
  { value: 'CANCELLED', label: 'Скасовано' },
  { value: 'PENDING', label: 'Очікує' },
  { value: 'ARCHIVED', label: 'Архів' },
];

export default function YearlyProgramView({
  rows,
  summary,
}: {
  rows: Row[];
  summary: SummaryData;
}) {
  const { theme, setTheme } = useAdminTheme();
  const dark = theme === 'dark';
  const router = useRouter();

  const [planFilter, setPlanFilter] = useState<'ALL' | Plan>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | SubStatus>('ALL');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, SubscriptionDetails | 'loading' | 'error'>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<number>(25);
  const [page, setPage] = useState<number>(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (planFilter !== 'ALL' && r.plan !== planFilter) return false;
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (q && !r.userEmail.toLowerCase().includes(q) && !(r.userName ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, planFilter, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => {
    setPage(1);
  }, [planFilter, statusFilter, search, pageSize]);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageStart = (page - 1) * pageSize;
  const paged = filtered.slice(pageStart, pageStart + pageSize);

  async function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (details[id] && details[id] !== 'error') return;
    setDetails((d) => ({ ...d, [id]: 'loading' }));
    try {
      const res = await fetch(`/api/admin/yearly-program/${id}/details`);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = (await res.json()) as SubscriptionDetails;
      setDetails((d) => ({ ...d, [id]: data }));
    } catch {
      setDetails((d) => ({ ...d, [id]: 'error' }));
    }
  }

  async function runAction(id: string, action: string, payload?: Record<string, unknown>, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/yearly-program/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`Помилка: ${data.error ?? res.statusText}`);
      } else {
        // Перезавантажуємо сторінку, щоб оновити серверну таблицю.
        router.refresh();
        // Та оновлюємо деталі якщо вони відкриті
        setDetails((d) => {
          const copy = { ...d };
          delete copy[id];
          return copy;
        });
        if (data.wfpError) alert(`Виконано, але: ${data.wfpError}`);
      }
    } catch (e) {
      alert(`Помилка: ${(e as Error).message}`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminShell
      theme={theme}
      setTheme={setTheme}
      eyebrow="Admin · Річна програма"
      title="Річна програма"
      subtitle="Платежі та доступ до Річної програми (SendPulse). Місячна підписка — з автосписанням, річна — одна оплата на рік."
      maxWidth="max-w-7xl"
    >
      <div
        className={`mb-6 rounded-2xl grid grid-cols-2 lg:grid-cols-5 overflow-hidden backdrop-blur-sm border divide-y lg:divide-y-0 lg:divide-x ${
          dark
            ? 'bg-white/[0.03] border-white/[0.06] divide-white/[0.06]'
            : 'bg-white/55 border-stone-300/50 divide-stone-300/40 shadow-[0_1px_2px_rgba(68,64,60,0.04)]'
        }`}
      >
        <Kpi theme={theme} icon={HiOutlineUserGroup} label="Всього підписок" value={summary.total.toLocaleString()} />
        <Kpi theme={theme} icon={HiOutlineCheckCircle} label="Активних" value={summary.active.toLocaleString()} tone="success" />
        <Kpi theme={theme} icon={HiOutlineClock} label="Grace (7 днів)" value={summary.grace.toLocaleString()} tone="warning" />
        <Kpi theme={theme} icon={HiOutlineXCircle} label="Прострочено / скасовано" value={(summary.expired + summary.cancelled).toLocaleString()} />
        <Kpi
          theme={theme}
          icon={HiOutlineBanknotes}
          label="Загальний дохід"
          value={`${summary.revenueTotal.toLocaleString()} ₴`}
          tone="success"
        />
      </div>

      <AdminPanel theme={theme} padding="p-4" className="mb-5">
        <div className="flex items-center gap-3 flex-wrap">
          <FilterGroup
            theme={theme}
            label="План"
            options={PLAN_OPTIONS}
            value={planFilter}
            onChange={(v) => setPlanFilter(v as 'ALL' | Plan)}
          />
          <FilterGroup
            theme={theme}
            label="Статус"
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as 'ALL' | SubStatus)}
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Пошук за email або імʼям"
            className={`ml-auto flex-1 min-w-[220px] max-w-[320px] px-3 py-1.5 rounded-lg border text-[12px] outline-none transition-colors ${
              dark
                ? 'bg-white/[0.04] border-white/[0.08] text-slate-200 placeholder:text-slate-600 focus:border-amber-400/40'
                : 'bg-white/80 border-stone-300/60 text-stone-800 placeholder:text-stone-400 focus:border-amber-600/50'
            }`}
          />
        </div>
      </AdminPanel>

      <AdminPanel theme={theme} padding="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className={`border-b ${dark ? 'border-white/[0.06] bg-black/10' : 'border-stone-300/40 bg-stone-50/40'}`}>
              <tr>
                <Th theme={theme}>{''}</Th>
                <Th theme={theme}>Створено</Th>
                <Th theme={theme}>Користувач</Th>
                <Th theme={theme}>План</Th>
                <Th theme={theme}>Статус</Th>
                <Th theme={theme}>Доступ до</Th>
                <Th theme={theme}>Платежів</Th>
                <Th theme={theme}>Сплачено</Th>
                <Th theme={theme}>Токен</Th>
                <Th theme={theme}>SendPulse</Th>
              </tr>
            </thead>
            <tbody className={dark ? 'divide-y divide-white/[0.04]' : 'divide-y divide-stone-200/60'}>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className={`px-4 py-14 text-center text-sm ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                    {rows.length === 0 ? 'Поки ніхто не підписався.' : 'Нічого не знайдено за фільтрами.'}
                  </td>
                </tr>
              ) : (
                paged.map((r) => (
                  <RowBlock
                    key={r.id}
                    r={r}
                    theme={theme}
                    expanded={expandedId === r.id}
                    details={details[r.id]}
                    busy={busyId === r.id}
                    onToggle={() => toggleExpand(r.id)}
                    onAction={(action, payload, confirm) => runAction(r.id, action, payload, confirm)}
                  />
                ))
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
    <div
      className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t text-[12px] ${
        dark ? 'border-white/[0.06] text-slate-400' : 'border-stone-300/40 text-stone-600'
      }`}
    >
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

function RowBlock({
  r,
  theme,
  expanded,
  details,
  busy,
  onToggle,
  onAction,
}: {
  r: Row;
  theme: Theme;
  expanded: boolean;
  details: SubscriptionDetails | 'loading' | 'error' | undefined;
  busy: boolean;
  onToggle: () => void;
  onAction: (action: string, payload?: Record<string, unknown>, confirm?: string) => void;
}) {
  const dark = theme === 'dark';
  return (
    <>
      <tr className={dark ? 'hover:bg-white/[0.02]' : 'hover:bg-stone-50/60'}>
        <td className="px-3 py-2.5">
          <button
            type="button"
            onClick={onToggle}
            className={`inline-flex items-center justify-center w-6 h-6 rounded transition-colors ${
              dark ? 'text-slate-500 hover:bg-white/[0.06] hover:text-slate-200' : 'text-stone-500 hover:bg-stone-200/50 hover:text-stone-800'
            }`}
            aria-label={expanded ? 'Сховати' : 'Показати деталі'}
          >
            {expanded ? <HiOutlineChevronUp className="text-base" /> : <HiOutlineChevronDown className="text-base" />}
          </button>
        </td>
        <td className={`px-4 py-2.5 whitespace-nowrap text-[11px] tabular-nums ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
          {fmtDate(r.createdAt)}
        </td>
        <td className="px-4 py-2.5">
          <div className={`text-[12px] font-medium ${dark ? 'text-slate-200' : 'text-stone-800'}`}>{r.userName ?? '—'}</div>
          <div className={`text-[10px] ${dark ? 'text-slate-500' : 'text-stone-500'}`}>{r.userEmail}</div>
        </td>
        <td className="px-4 py-2.5"><PlanBadge theme={theme} plan={r.plan} /></td>
        <td className="px-4 py-2.5"><StatusBadge theme={theme} status={r.status} /></td>
        <td className={`px-4 py-2.5 text-[11px] tabular-nums whitespace-nowrap ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
          {r.expiresAt ? (
            <>
              <div>{fmtDateShort(r.expiresAt)}</div>
              {r.daysLeft !== null && (
                <div className={`text-[10px] ${
                  r.daysLeft < 0 ? (dark ? 'text-rose-400' : 'text-rose-700')
                    : r.daysLeft <= 3 ? (dark ? 'text-amber-300' : 'text-amber-700')
                    : (dark ? 'text-slate-600' : 'text-stone-400')
                }`}>
                  {r.daysLeft < 0 ? `−${Math.abs(r.daysLeft)}д` : `${r.daysLeft}д залишилось`}
                </div>
              )}
            </>
          ) : (
            <span className={dark ? 'text-slate-600' : 'text-stone-400'}>—</span>
          )}
        </td>
        <td className={`px-4 py-2.5 text-[12px] tabular-nums text-center ${dark ? 'text-slate-300' : 'text-stone-700'}`}>{r.paymentsCount}</td>
        <td className={`px-4 py-2.5 text-[12px] tabular-nums whitespace-nowrap ${dark ? 'text-slate-200' : 'text-stone-800'}`}>
          {r.totalPaid.toLocaleString()} ₴
        </td>
        <td className="px-4 py-2.5">
          {r.hasRecToken ? (
            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
              dark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-100 text-emerald-800'
            }`}>є</span>
          ) : (
            <span className={`text-[10px] ${dark ? 'text-slate-600' : 'text-stone-400'}`}>—</span>
          )}
        </td>
        <td className="px-4 py-2.5">
          <SendpulseBadge theme={theme} openedAt={r.sendpulseAccessOpenedAt} closedAt={r.sendpulseAccessClosedAt} studentId={r.sendpulseStudentId} />
        </td>
      </tr>

      {expanded && (
        <tr className={dark ? 'bg-black/20' : 'bg-stone-50/80'}>
          <td colSpan={10} className="px-6 py-5">
            <ExpandedRowContent
              theme={theme}
              details={details}
              row={r}
              busy={busy}
              onAction={onAction}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function ExpandedRowContent({
  details,
  row,
  theme,
  busy,
  onAction,
}: {
  details: SubscriptionDetails | 'loading' | 'error' | undefined;
  row: Row;
  theme: Theme;
  busy: boolean;
  onAction: (action: string, payload?: Record<string, unknown>, confirm?: string) => void;
}) {
  const dark = theme === 'dark';
  if (details === 'loading' || !details) {
    return <div className={`text-[12px] ${dark ? 'text-slate-500' : 'text-stone-500'}`}>Завантаження деталей…</div>;
  }
  if (details === 'error') {
    return <div className={`text-[12px] ${dark ? 'text-rose-400' : 'text-rose-700'}`}>Не вдалося завантажити деталі.</div>;
  }

  return (
    <div className="grid md:grid-cols-3 gap-5">
      <div className="md:col-span-1">
        <SectionTitle theme={theme}>Дії</SectionTitle>
        <div className="flex flex-col gap-2">
          <ActionBtn theme={theme} disabled={busy || row.status === 'EXPIRED' || row.status === 'ARCHIVED'} onClick={() => {
            const days = window.prompt('На скільки днів продовжити?', '30');
            const n = Number(days);
            if (Number.isFinite(n) && n > 0) onAction('extend', { daysToAdd: n });
          }}>
            ⏱ Продовжити…
          </ActionBtn>
          <ActionBtn theme={theme} disabled={busy || row.status === 'CANCELLED' || row.status === 'ARCHIVED'} tone="warning" onClick={() => {
            const isMonthly = row.plan === 'MONTHLY';
            const confirmMsg = isMonthly
              ? 'Скасувати автосписання на WFP і позначити підписку як CANCELLED?'
              : 'Позначити підписку як CANCELLED? Доступ зберігається до кінця оплаченого року.';
            const reason = window.prompt('Причина (необовʼязково):') ?? undefined;
            onAction('cancel', { reason }, confirmMsg);
          }}>
            {row.plan === 'MONTHLY' ? '🚫 Скасувати автосписання' : '🚫 Позначити як скасовану'}
          </ActionBtn>
          <ActionBtn theme={theme} disabled={busy || row.status === 'EXPIRED' || row.status === 'ARCHIVED' || !!row.sendpulseAccessClosedAt} tone="danger" onClick={() =>
            onAction('close_access', undefined, 'Закрити доступ до SendPulse курсу?')
          }>
            ✕ Закрити доступ у SendPulse
          </ActionBtn>
          <ActionBtn theme={theme} disabled={busy || row.status === 'ARCHIVED'} tone="success" onClick={() =>
            onAction('reopen_access', undefined, 'Відкрити доступ знову (event у SendPulse)?')
          }>
            ✓ Відкрити доступ знову
          </ActionBtn>
          <ActionBtn theme={theme} disabled={busy || row.status === 'ARCHIVED'} tone="danger" onClick={() => {
            const expectedEmail = row.userEmail ?? '';
            const typed = window.prompt(
              `Архівація: закриваємо доступ у SendPulse, статус → ARCHIVED, очищаємо технічні поля. Картка лишається в адмінці, але ВІДКРИТИ ЗНОВУ вже не вийде.\n\nДля підтвердження введи email користувача (${expectedEmail}):`,
            );
            if (!typed) return;
            if (typed.trim().toLowerCase() !== expectedEmail.toLowerCase()) {
              alert('Email не співпадає — дію скасовано.');
              return;
            }
            onAction('delete');
          }}>
            🗑 Архівувати запис
          </ActionBtn>
        </div>

        <SectionTitle theme={theme} className="mt-5">Технічні поля</SectionTitle>
        <Dl theme={theme} items={[
          ['recToken', details.recTokenMasked ?? '—'],
          ['SP studentId', details.sendpulseStudentId?.toString() ?? '—'],
          ['fail count', details.failedChargeCount.toString()],
          ['last error', details.lastChargeError ?? '—'],
          ['reminders', `3д:${details.reminderSent3d ? '✓' : '–'} · 1д:${details.reminderSent1d ? '✓' : '–'} · exp:${details.reminderSentExpired ? '✓' : '–'}`],
        ]} />
      </div>

      <div className="md:col-span-1">
        <SectionTitle theme={theme}>Платежі ({details.payments.length})</SectionTitle>
        <div className={`rounded-lg border ${dark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-stone-300/50 bg-white/60'}`}>
          {details.payments.length === 0 ? (
            <div className={`px-3 py-4 text-center text-[11px] ${dark ? 'text-slate-600' : 'text-stone-400'}`}>Платежів ще нема</div>
          ) : (
            <div className="divide-y divide-stone-200/30 dark:divide-white/[0.04]">
              {details.payments.map((p) => (
                <div key={p.id} className="px-3 py-2 flex items-center justify-between gap-3 text-[11px]">
                  <div className="min-w-0">
                    <div className={`font-mono text-[10px] truncate ${dark ? 'text-slate-400' : 'text-stone-600'}`}>{p.orderReference}</div>
                    <div className={dark ? 'text-slate-600' : 'text-stone-500'}>{fmtDate(p.createdAt)}</div>
                  </div>
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider ${
                      p.status === 'PAID'
                        ? (dark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-800')
                        : p.status === 'PENDING'
                          ? (dark ? 'bg-slate-500/20 text-slate-300' : 'bg-stone-200 text-stone-700')
                          : (dark ? 'bg-rose-500/20 text-rose-300' : 'bg-rose-100 text-rose-800')
                    }`}>{p.status}</span>
                    <span className={`tabular-nums font-semibold ${dark ? 'text-slate-200' : 'text-stone-800'}`}>{p.amount.toLocaleString()}₴</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="md:col-span-1">
        <SectionTitle theme={theme}>Події ({details.events.length})</SectionTitle>
        <div className={`rounded-lg border max-h-[360px] overflow-y-auto ${dark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-stone-300/50 bg-white/60'}`}>
          {details.events.length === 0 ? (
            <div className={`px-3 py-4 text-center text-[11px] ${dark ? 'text-slate-600' : 'text-stone-400'}`}>Подій нема</div>
          ) : (
            <ul className="divide-y divide-stone-200/30 dark:divide-white/[0.04]">
              {details.events.map((ev) => (
                <li key={ev.id} className="px-3 py-2 text-[11px]">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`font-mono text-[10px] font-semibold ${eventTypeColor(ev.type, dark)}`}>{ev.type}</span>
                    <span className={`text-[9px] tabular-nums shrink-0 ${dark ? 'text-slate-600' : 'text-stone-400'}`}>
                      {new Date(ev.createdAt).toISOString().replace('T', ' ').slice(0, 16)}
                    </span>
                  </div>
                  {ev.message && (
                    <div className={`mt-1 text-[10px] ${dark ? 'text-slate-400' : 'text-stone-600'}`}>{ev.message}</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function eventTypeColor(type: string, dark: boolean): string {
  if (type.startsWith('charge_failed') || type === 'access_closed') return dark ? 'text-rose-300' : 'text-rose-700';
  if (type === 'created' || type === 'access_opened' || type === 'reactivated') return dark ? 'text-emerald-300' : 'text-emerald-700';
  if (type === 'renewed') return dark ? 'text-sky-300' : 'text-sky-700';
  if (type === 'cancelled') return dark ? 'text-slate-400' : 'text-stone-600';
  if (type.startsWith('reminder')) return dark ? 'text-amber-300' : 'text-amber-700';
  return dark ? 'text-slate-400' : 'text-stone-600';
}

function ActionBtn({
  children,
  onClick,
  disabled,
  tone = 'neutral',
  theme,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'neutral' | 'warning' | 'danger' | 'success';
  theme: Theme;
}) {
  const dark = theme === 'dark';
  const toneClasses = {
    neutral: dark ? 'bg-white/[0.04] border-white/[0.1] text-slate-300 hover:bg-white/[0.08]' : 'bg-white/70 border-stone-300/60 text-stone-700 hover:bg-white',
    warning: dark ? 'bg-amber-500/[0.08] border-amber-400/20 text-amber-200 hover:bg-amber-500/[0.15]' : 'bg-amber-50 border-amber-300/50 text-amber-800 hover:bg-amber-100',
    danger:  dark ? 'bg-rose-500/[0.08] border-rose-400/20 text-rose-200 hover:bg-rose-500/[0.15]' : 'bg-rose-50 border-rose-300/50 text-rose-800 hover:bg-rose-100',
    success: dark ? 'bg-emerald-500/[0.08] border-emerald-400/20 text-emerald-200 hover:bg-emerald-500/[0.15]' : 'bg-emerald-50 border-emerald-300/50 text-emerald-800 hover:bg-emerald-100',
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 text-[11px] font-medium rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-left ${toneClasses}`}
    >
      {children}
    </button>
  );
}

function SectionTitle({ theme, children, className = '' }: { theme: Theme; children: React.ReactNode; className?: string }) {
  const dark = theme === 'dark';
  return (
    <h3 className={`text-[10px] uppercase tracking-[0.18em] font-semibold mb-2 ${dark ? 'text-slate-500' : 'text-stone-500'} ${className}`}>
      {children}
    </h3>
  );
}

function Dl({ theme, items }: { theme: Theme; items: [string, string][] }) {
  const dark = theme === 'dark';
  return (
    <dl className="space-y-1 text-[11px]">
      {items.map(([k, v]) => (
        <div key={k} className="flex items-start justify-between gap-2">
          <dt className={dark ? 'text-slate-600' : 'text-stone-400'}>{k}</dt>
          <dd className={`font-mono text-[10px] text-right ${dark ? 'text-slate-300' : 'text-stone-700'}`}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function fmtDate(iso: string): string {
  return new Date(iso).toISOString().replace('T', ' ').slice(0, 16);
}

function fmtDateShort(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function Th({ children, theme }: { children: React.ReactNode; theme: Theme }) {
  const dark = theme === 'dark';
  return (
    <th className={`text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] whitespace-nowrap ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
      {children}
    </th>
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
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
  theme: Theme;
}) {
  const dark = theme === 'dark';
  const toneColor = {
    neutral: dark ? 'text-white' : 'text-stone-900',
    success: dark ? 'text-emerald-300' : 'text-emerald-800',
    warning: dark ? 'text-amber-300' : 'text-amber-800',
    danger: dark ? 'text-rose-300' : 'text-rose-700',
  }[tone];
  return (
    <div className="px-5 py-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`text-sm ${dark ? 'text-slate-500' : 'text-stone-500'}`} />
        <div className={`text-[10px] uppercase tracking-[0.18em] font-medium ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
          {label}
        </div>
      </div>
      <div className={`text-[24px] font-semibold tabular-nums leading-none ${toneColor}`}>{value}</div>
    </div>
  );
}

function FilterGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  theme,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  theme: Theme;
}) {
  const dark = theme === 'dark';
  return (
    <div className="flex items-center gap-2">
      <span className={`text-[10px] uppercase tracking-[0.18em] font-medium ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
        {label}
      </span>
      <div className={`inline-flex rounded-lg p-0.5 border ${dark ? 'bg-black/30 border-white/[0.06]' : 'bg-stone-100/80 border-stone-300/50'}`}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
                active
                  ? dark
                    ? 'bg-white/10 text-white'
                    : 'bg-stone-900 text-white'
                  : dark
                    ? 'text-slate-500 hover:text-slate-200'
                    : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PlanBadge({ plan, theme }: { plan: Plan; theme: Theme }) {
  const dark = theme === 'dark';
  if (plan === 'YEARLY') {
    return (
      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
        dark ? 'bg-amber-500/15 text-amber-300 border border-amber-400/20' : 'bg-amber-100 text-amber-800 border border-amber-300/50'
      }`}>Річний</span>
    );
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
      dark ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-400/20' : 'bg-indigo-100 text-indigo-800 border border-indigo-300/50'
    }`}>Місячний</span>
  );
}

function StatusBadge({ status, theme }: { status: SubStatus; theme: Theme }) {
  const dark = theme === 'dark';
  const map: Record<SubStatus, { label: string; dark: string; light: string }> = {
    ACTIVE:    { label: 'Активний',    dark: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/20', light: 'bg-emerald-100 text-emerald-800 border-emerald-300/50' },
    GRACE:     { label: 'Grace (7 днів)', dark: 'bg-amber-500/15 text-amber-300 border-amber-400/20',       light: 'bg-amber-100 text-amber-800 border-amber-300/50' },
    EXPIRED:   { label: 'Прострочено', dark: 'bg-rose-500/15 text-rose-300 border-rose-400/20',          light: 'bg-rose-100 text-rose-800 border-rose-300/50' },
    CANCELLED: { label: 'Скасовано',   dark: 'bg-slate-500/15 text-slate-300 border-slate-400/20',      light: 'bg-stone-200 text-stone-700 border-stone-300/60' },
    PENDING:   { label: 'Очікує',      dark: 'bg-slate-500/15 text-slate-400 border-slate-400/10',      light: 'bg-stone-100 text-stone-600 border-stone-300/50' },
    ARCHIVED:  { label: 'Архів',       dark: 'bg-zinc-700/30 text-zinc-400 border-zinc-500/20',         light: 'bg-zinc-200 text-zinc-600 border-zinc-300/60' },
  };
  const cls = map[status];
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${
      dark ? cls.dark : cls.light
    }`}>{cls.label}</span>
  );
}

function SendpulseBadge({
  openedAt,
  closedAt,
  studentId,
  theme,
}: {
  openedAt: string | null;
  closedAt: string | null;
  studentId: number | null;
  theme: Theme;
}) {
  const dark = theme === 'dark';
  if (closedAt) {
    return (
      <span className={`text-[10px] ${dark ? 'text-rose-400' : 'text-rose-700'}`} title={`Закрито: ${closedAt}${studentId ? ` · id=${studentId}` : ''}`}>
        ✕ закрито
      </span>
    );
  }
  if (openedAt) {
    return (
      <span className={`text-[10px] ${dark ? 'text-emerald-300' : 'text-emerald-700'}`} title={`Відкрито: ${openedAt}${studentId ? ` · id=${studentId}` : ''}`}>
        ✓ відкрито
      </span>
    );
  }
  return <span className={`text-[10px] ${dark ? 'text-slate-600' : 'text-stone-400'}`}>—</span>;
}
