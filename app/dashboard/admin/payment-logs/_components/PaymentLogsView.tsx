'use client';

import Link from 'next/link';
import {
  HiOutlineClipboardDocumentList,
  HiOutlineCheckCircle,
  HiOutlineArrowUturnLeft,
  HiOutlineShieldExclamation,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
} from 'react-icons/hi2';
import { useAdminTheme, type Theme } from '../../_components/adminTheme';
import { AdminShell, AdminPanel } from '../../_components/AdminShell';

export interface LogRow {
  id: string;
  createdAt: string; // ISO
  kind: string;
  /// Для kind === 'monthly': true — підписка з автосписанням, false — разова на 1 міс.,
  /// null — не знайшли відповідний Payment (легасі/orphan запис).
  autoRenew: boolean | null;
  transactionStatus: string | null;
  signatureValid: boolean | null;
  skipped: boolean;
  amount: number | null;
  currency: string | null;
  clientName: string | null;
  clientEmail: string | null;
  ip: string | null;
  actionsTaken: string | null;
  skipReason: string | null;
  sendpulseSlugs: string | null;
  orderReference: string | null;
}

export interface PaymentLogsData {
  logs: LogRow[];
  total: number;
  approvedCount: number;
  skippedCount: number;
  invalidSigCount: number;
  kind: 'all' | 'course' | 'bundle' | 'yearly' | 'monthly' | 'connector' | 'unknown';
  page: number;
  totalPages: number;
  pageSize: number;
}

const KIND_TABS: { value: PaymentLogsData['kind']; label: string }[] = [
  { value: 'all',       label: 'Всі' },
  { value: 'course',    label: 'Курси' },
  { value: 'bundle',    label: 'Пакети' },
  { value: 'yearly',    label: 'Річна' },
  { value: 'monthly',   label: 'Місячна' },
  { value: 'connector', label: 'Коннектор' },
  { value: 'unknown',   label: 'Невідомо' },
];

export default function PaymentLogsView({ data }: { data: PaymentLogsData }) {
  const { theme, setTheme } = useAdminTheme();
  const dark = theme === 'dark';

  const buildUrl = (overrides: { page?: number; pageSize?: number }) => {
    const qs = new URLSearchParams();
    if (data.kind !== 'all') qs.set('kind', data.kind);
    const targetPage = overrides.page ?? data.page;
    const targetSize = overrides.pageSize ?? data.pageSize;
    if (targetPage > 1) qs.set('page', String(targetPage));
    if (targetSize !== 25) qs.set('pageSize', String(targetSize));
    const s = qs.toString();
    return s ? `/dashboard/admin/payment-logs?${s}` : '/dashboard/admin/payment-logs';
  };

  return (
    <AdminShell
      theme={theme}
      setTheme={setTheme}
      eyebrow="Admin · Логи платежів"
      title="Логи платежів"
      subtitle={
        <>
          Всі виклики{' '}
          <code className={`text-[11px] px-1.5 py-0.5 rounded ${dark ? 'bg-white/[0.06] text-slate-300' : 'bg-stone-200/70 text-stone-700'}`}>
            /api/wayforpay/callback
          </code>
          {' '}— хто стукав, з яким статусом, і що система зробила.
        </>
      }
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
        <Kpi theme={theme} icon={HiOutlineClipboardDocumentList} label="Всього викликів" value={data.total.toLocaleString()} />
        <Kpi theme={theme} icon={HiOutlineCheckCircle} label="Approved · оброблено" value={data.approvedCount.toLocaleString()} tone="success" />
        <Kpi theme={theme} icon={HiOutlineArrowUturnLeft} label="Skipped · дублі" value={data.skippedCount.toLocaleString()} />
        <Kpi
          theme={theme}
          icon={HiOutlineShieldExclamation}
          label="Invalid signature"
          value={data.invalidSigCount.toLocaleString()}
          tone={data.invalidSigCount > 0 ? 'danger' : 'neutral'}
        />
      </div>

      {/* Kind tabs */}
      <div
        className={`mb-5 inline-flex rounded-xl p-0.5 border ${
          dark ? 'bg-black/30 border-white/[0.06]' : 'bg-stone-100/80 border-stone-300/50'
        }`}
      >
        {KIND_TABS.map(t => {
          const active = t.value === data.kind;
          return (
            <Link
              key={t.value}
              href={`/dashboard/admin/payment-logs${t.value === 'all' ? '' : `?kind=${t.value}`}`}
              scroll={false}
              className={`px-3 py-1.5 text-[12px] font-medium rounded-lg transition-all ${
                active
                  ? dark
                    ? 'bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                    : 'bg-stone-900 text-white shadow-sm'
                  : dark
                    ? 'text-slate-500 hover:text-slate-200'
                    : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {/* Table panel */}
      <AdminPanel theme={theme} padding="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className={`border-b ${dark ? 'border-white/[0.06] bg-black/10' : 'border-stone-300/40 bg-stone-50/40'}`}>
              <tr>
                <Th theme={theme}>Час</Th>
                <Th theme={theme}>Клієнт</Th>
                <Th theme={theme}>Тип</Th>
                <Th theme={theme}>Статус</Th>
                <Th theme={theme}>Сума</Th>
                <Th theme={theme}>IP</Th>
                <Th theme={theme}>Дії</Th>
                <Th theme={theme}>SendPulse</Th>
                <Th theme={theme}>Order ref</Th>
              </tr>
            </thead>
            <tbody className={dark ? 'divide-y divide-white/[0.04]' : 'divide-y divide-stone-200/60'}>
              {data.logs.length === 0 ? (
                <tr>
                  <td colSpan={9} className={`px-4 py-14 text-center text-sm ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                    Логів немає
                  </td>
                </tr>
              ) : (
                data.logs.map(log => {
                  const dt = new Date(log.createdAt);
                  return (
                    <tr key={log.id} className={dark ? 'hover:bg-white/[0.02]' : 'hover:bg-stone-50/60'}>
                      <td className={`px-4 py-2.5 whitespace-nowrap text-[11px] tabular-nums ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                        {fmtKyivDateTime(dt)}
                      </td>
                      <td
                        className="px-4 py-2.5 max-w-[200px]"
                        title={[log.clientName, log.clientEmail].filter(Boolean).join(' · ')}
                      >
                        {log.clientName || log.clientEmail ? (
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span className={`text-[12px] font-medium truncate ${dark ? 'text-slate-200' : 'text-stone-800'}`}>
                              {log.clientName ?? '—'}
                            </span>
                            <span className={`text-[10px] truncate ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                              {log.clientEmail ?? ''}
                            </span>
                          </div>
                        ) : (
                          <span className={`text-[11px] ${dark ? 'text-slate-600' : 'text-stone-400'}`}>—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <KindBadge theme={theme} kind={log.kind} autoRenew={log.autoRenew} />
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge
                          theme={theme}
                          transactionStatus={log.transactionStatus}
                          signatureValid={log.signatureValid}
                          skipped={log.skipped}
                        />
                      </td>
                      <td className={`px-4 py-2.5 text-[12px] tabular-nums whitespace-nowrap ${dark ? 'text-slate-300' : 'text-stone-700'}`}>
                        {log.amount != null ? `${log.amount} ${log.currency ?? 'UAH'}` : '—'}
                      </td>
                      <td className={`px-4 py-2.5 text-[11px] tabular-nums ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                        {log.ip ?? '—'}
                      </td>
                      <td className={`px-4 py-2.5 text-[11px] max-w-[280px] ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
                        {log.actionsTaken || log.skipReason ? (
                          <div className="flex flex-col gap-1">
                            {log.skipReason && (
                              <span className={`font-mono text-[10px] font-semibold ${dark ? 'text-amber-300' : 'text-amber-700'}`}>
                                skip:{log.skipReason}
                              </span>
                            )}
                            {log.actionsTaken && (
                              <span className="font-mono text-[10px] break-all">{log.actionsTaken}</span>
                            )}
                          </div>
                        ) : (
                          <span className={dark ? 'text-slate-600' : 'text-stone-400'}>—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-[11px] max-w-[200px]">
                        {log.sendpulseSlugs ? (
                          <span className={`font-mono text-[10px] break-all ${dark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                            {log.sendpulseSlugs}
                          </span>
                        ) : (
                          <span className={dark ? 'text-slate-600' : 'text-stone-400'}>—</span>
                        )}
                      </td>
                      <td className={`px-4 py-2.5 text-[10px] font-mono break-all max-w-[220px] ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                        {log.orderReference ?? '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {data.total > 0 && (
          <ServerPaginationBar
            theme={theme}
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            pageSize={data.pageSize}
            buildUrl={buildUrl}
          />
        )}
      </AdminPanel>
    </AdminShell>
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
    danger:  dark ? 'text-rose-300 drop-shadow-[0_0_10px_rgba(251,113,133,0.35)]' : 'text-rose-700 drop-shadow-[0_0_8px_rgba(190,18,60,0.2)]',
  }[tone];
  return (
    <div className="px-5 py-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`text-sm ${dark ? 'text-slate-500' : 'text-stone-500'}`} />
        <div className={`text-[10px] uppercase tracking-[0.18em] font-medium ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
          {label}
        </div>
      </div>
      <div className={`text-[24px] font-semibold tabular-nums leading-none ${toneColor}`}>
        {value}
      </div>
    </div>
  );
}

function Th({ children, theme, title }: { children: React.ReactNode; theme: Theme; title?: string }) {
  const dark = theme === 'dark';
  return (
    <th
      title={title}
      className={`text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] whitespace-nowrap ${dark ? 'text-slate-500' : 'text-stone-500'} ${title ? 'cursor-help' : ''}`}
    >
      {children}
    </th>
  );
}

function KindBadge({ kind, autoRenew, theme }: { kind: string; autoRenew?: boolean | null; theme: Theme }) {
  const dark = theme === 'dark';
  const effectiveKind =
    kind === 'monthly'
      ? autoRenew === true
        ? 'monthly_auto'
        : autoRenew === false
          ? 'monthly_once'
          : 'monthly'
      : kind;
  const map: Record<string, { label: string; dark: string; light: string }> = {
    course:        { label: 'Курс',                  dark: 'bg-sky-500/15 text-sky-300 border-sky-500/20',              light: 'bg-sky-500/10 text-sky-800 border-sky-500/25' },
    bundle:        { label: 'Пакет',                 dark: 'bg-violet-500/15 text-violet-300 border-violet-500/20',    light: 'bg-violet-500/10 text-violet-800 border-violet-500/25' },
    yearly:        { label: 'Річна',                 dark: 'bg-amber-500/15 text-amber-300 border-amber-500/20',        light: 'bg-amber-500/10 text-amber-800 border-amber-500/25' },
    monthly_auto:  { label: 'Місячна Автоплатіж',    dark: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/20',    light: 'bg-indigo-500/10 text-indigo-800 border-indigo-500/25' },
    monthly_once:  { label: 'Місячна на 1 міс.',     dark: 'bg-sky-500/15 text-sky-300 border-sky-500/20',              light: 'bg-sky-500/10 text-sky-800 border-sky-500/25' },
    monthly:       { label: 'Місячна',               dark: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/20',    light: 'bg-indigo-500/10 text-indigo-800 border-indigo-500/25' },
    connector: { label: 'Коннектор', dark: 'bg-orange-500/15 text-orange-300 border-orange-500/20',    light: 'bg-orange-500/10 text-orange-800 border-orange-500/25' },
    unknown:   { label: '?',         dark: 'bg-slate-500/20 text-slate-400 border-slate-500/20',       light: 'bg-stone-200/70 text-stone-600 border-stone-300/70' },
  };
  const m = map[kind] ?? map.unknown;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-md border ${dark ? m.dark : m.light}`}>
      {m.label}
    </span>
  );
}

function StatusBadge({
  transactionStatus,
  signatureValid,
  skipped,
  theme,
}: {
  transactionStatus: string | null;
  signatureValid: boolean | null;
  skipped: boolean;
  theme: Theme;
}) {
  const dark = theme === 'dark';
  let label = transactionStatus ?? '—';
  let darkCls = 'bg-slate-500/20 text-slate-400 border-slate-500/20';
  let lightCls = 'bg-stone-200/70 text-stone-600 border-stone-300/70';

  if (signatureValid === false) {
    label = 'Invalid sig';
    darkCls = 'bg-rose-500/15 text-rose-300 border-rose-500/20';
    lightCls = 'bg-rose-500/10 text-rose-700 border-rose-500/25';
  } else if (skipped) {
    label = 'Skipped';
    // neutral — уже встановлено вище
  } else if (transactionStatus === 'Approved') {
    label = 'Approved';
    darkCls = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20';
    lightCls = 'bg-emerald-500/10 text-emerald-800 border-emerald-500/25';
  } else if (transactionStatus === 'Declined' || transactionStatus === 'Expired') {
    darkCls = 'bg-rose-500/15 text-rose-300 border-rose-500/20';
    lightCls = 'bg-rose-500/10 text-rose-700 border-rose-500/25';
  }

  return (
    <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-md border ${dark ? darkCls : lightCls}`}>
      {label}
    </span>
  );
}

function ServerPaginationBar({
  theme,
  page,
  totalPages,
  total,
  pageSize,
  buildUrl,
}: {
  theme: Theme;
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  buildUrl: (overrides: { page?: number; pageSize?: number }) => string;
}) {
  const dark = theme === 'dark';
  const pageStart = (page - 1) * pageSize;
  const pageEnd = Math.min(pageStart + pageSize, total);
  const pages = computePageList(page, totalPages);
  const btnBase = 'inline-flex items-center justify-center h-7 min-w-7 px-2 rounded-md text-[12px] tabular-nums transition-colors';
  const btnIdle = dark
    ? 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.06] border border-white/[0.06]'
    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100 border border-stone-300/50';
  const btnActive = dark
    ? 'bg-amber-400/15 text-amber-200 border border-amber-400/30'
    : 'bg-amber-100 text-amber-800 border border-amber-300/60';
  const btnDisabled = dark
    ? 'text-slate-600 border border-white/[0.04] cursor-not-allowed pointer-events-none'
    : 'text-stone-300 border border-stone-200/60 cursor-not-allowed pointer-events-none';

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
          {/* page-size — server-side, тому через нативний <select> з window.location */}
          <select
            value={pageSize}
            onChange={(e) => {
              const next = Number(e.target.value);
              window.location.href = buildUrl({ pageSize: next, page: 1 });
            }}
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
          {page > 1 ? (
            <Link href={buildUrl({ page: page - 1 })} className={`${btnBase} ${btnIdle}`} aria-label="Попередня сторінка">
              <HiOutlineChevronLeft className="text-sm" />
            </Link>
          ) : (
            <span className={`${btnBase} ${btnDisabled}`}><HiOutlineChevronLeft className="text-sm" /></span>
          )}
          {pages.map((p, i) =>
            p === '…' ? (
              <span key={`dots-${i}`} className={`${btnBase} ${dark ? 'text-slate-600' : 'text-stone-400'}`}>…</span>
            ) : p === page ? (
              <span key={p} className={`${btnBase} ${btnActive}`} aria-current="page">{p}</span>
            ) : (
              <Link key={p} href={buildUrl({ page: p })} className={`${btnBase} ${btnIdle}`}>{p}</Link>
            ),
          )}
          {page < totalPages ? (
            <Link href={buildUrl({ page: page + 1 })} className={`${btnBase} ${btnIdle}`} aria-label="Наступна сторінка">
              <HiOutlineChevronRight className="text-sm" />
            </Link>
          ) : (
            <span className={`${btnBase} ${btnDisabled}`}><HiOutlineChevronRight className="text-sm" /></span>
          )}
        </div>
      </div>
    </div>
  );
}

const KYIV_DATETIME_SEC_FMT = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Kyiv',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

function fmtKyivDateTime(d: Date): string {
  return KYIV_DATETIME_SEC_FMT.format(d).replace(',', '');
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
