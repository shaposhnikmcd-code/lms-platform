'use client';

import Link from 'next/link';
import {
  HiOutlineClipboardDocumentList,
  HiOutlineCheckCircle,
  HiOutlineArrowUturnLeft,
  HiOutlineShieldExclamation,
} from 'react-icons/hi2';
import { useAdminTheme, type Theme } from '../../_components/adminTheme';
import { AdminShell, AdminPanel } from '../../_components/AdminShell';

export interface LogRow {
  id: string;
  createdAt: string; // ISO
  kind: string;
  transactionStatus: string | null;
  signatureValid: boolean | null;
  skipped: boolean;
  prevStatus: string | null;
  amount: number | null;
  currency: string | null;
  clientEmail: string | null;
  ip: string | null;
  actionsTaken: string | null;
  sendpulseSlugs: string | null;
  orderReference: string | null;
}

export interface PaymentLogsData {
  logs: LogRow[];
  total: number;
  approvedCount: number;
  skippedCount: number;
  invalidSigCount: number;
  kind: 'all' | 'course' | 'bundle' | 'connector' | 'unknown';
  page: number;
  totalPages: number;
}

const KIND_TABS: { value: PaymentLogsData['kind']; label: string }[] = [
  { value: 'all',       label: 'Всі' },
  { value: 'course',    label: 'Курси' },
  { value: 'bundle',    label: 'Пакети' },
  { value: 'connector', label: 'Коннектор' },
  { value: 'unknown',   label: 'Невідомо' },
];

export default function PaymentLogsView({ data }: { data: PaymentLogsData }) {
  const { theme, setTheme } = useAdminTheme();
  const dark = theme === 'dark';

  const prevQs = new URLSearchParams({ ...(data.kind !== 'all' && { kind: data.kind }), page: String(data.page - 1) }).toString();
  const nextQs = new URLSearchParams({ ...(data.kind !== 'all' && { kind: data.kind }), page: String(data.page + 1) }).toString();

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
                <Th theme={theme}>Тип</Th>
                <Th theme={theme}>Статус</Th>
                <Th theme={theme}>Поперед.</Th>
                <Th theme={theme}>Сума</Th>
                <Th theme={theme}>Email</Th>
                <Th theme={theme}>IP</Th>
                <Th theme={theme}>Дії</Th>
                <Th theme={theme}>SendPulse</Th>
                <Th theme={theme}>Order ref</Th>
              </tr>
            </thead>
            <tbody className={dark ? 'divide-y divide-white/[0.04]' : 'divide-y divide-stone-200/60'}>
              {data.logs.length === 0 ? (
                <tr>
                  <td colSpan={10} className={`px-4 py-14 text-center text-sm ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                    Логів немає
                  </td>
                </tr>
              ) : (
                data.logs.map(log => {
                  const dt = new Date(log.createdAt);
                  return (
                    <tr key={log.id} className={dark ? 'hover:bg-white/[0.02]' : 'hover:bg-stone-50/60'}>
                      <td className={`px-4 py-2.5 whitespace-nowrap text-[11px] tabular-nums ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                        {dt.toISOString().replace('T', ' ').slice(0, 19)}
                      </td>
                      <td className="px-4 py-2.5">
                        <KindBadge theme={theme} kind={log.kind} />
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge
                          theme={theme}
                          transactionStatus={log.transactionStatus}
                          signatureValid={log.signatureValid}
                          skipped={log.skipped}
                        />
                      </td>
                      <td className={`px-4 py-2.5 text-[11px] ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                        {log.prevStatus ?? '—'}
                      </td>
                      <td className={`px-4 py-2.5 text-[12px] tabular-nums whitespace-nowrap ${dark ? 'text-slate-300' : 'text-stone-700'}`}>
                        {log.amount != null ? `${log.amount} ${log.currency ?? 'UAH'}` : '—'}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-[11px] max-w-[180px] truncate ${dark ? 'text-slate-400' : 'text-stone-600'}`}
                        title={log.clientEmail ?? ''}
                      >
                        {log.clientEmail ?? '—'}
                      </td>
                      <td className={`px-4 py-2.5 text-[11px] tabular-nums ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                        {log.ip ?? '—'}
                      </td>
                      <td className={`px-4 py-2.5 text-[11px] max-w-[280px] ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
                        {log.actionsTaken ? (
                          <span className="font-mono text-[10px] break-all">{log.actionsTaken}</span>
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

        {/* Pagination */}
        {data.totalPages > 1 && (
          <div
            className={`flex items-center justify-between px-4 py-3 border-t ${
              dark ? 'border-white/[0.06] bg-black/20' : 'border-stone-300/40 bg-stone-50/60'
            }`}
          >
            <p className={`text-[11px] uppercase tracking-[0.18em] font-medium ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
              Сторінка <span className={`tabular-nums ${dark ? 'text-slate-200' : 'text-stone-800'}`}>{data.page}</span>
              <span className="opacity-60"> з {data.totalPages}</span>
              <span className="opacity-60"> · Всього {data.total.toLocaleString()}</span>
            </p>
            <div className="flex items-center gap-2">
              {data.page > 1 && (
                <Link
                  href={`/dashboard/admin/payment-logs?${prevQs}`}
                  className={`px-3 py-1.5 text-[12px] font-medium rounded-lg border transition-colors ${
                    dark
                      ? 'bg-white/[0.04] border-white/[0.1] text-slate-300 hover:bg-white/[0.08] hover:text-white'
                      : 'bg-white/70 border-stone-300/60 text-stone-700 hover:bg-white hover:border-stone-400/60'
                  }`}
                >
                  ← Попередня
                </Link>
              )}
              {data.page < data.totalPages && (
                <Link
                  href={`/dashboard/admin/payment-logs?${nextQs}`}
                  className={`px-3 py-1.5 text-[12px] font-medium rounded-lg border transition-colors ${
                    dark
                      ? 'bg-white/[0.04] border-white/[0.1] text-slate-300 hover:bg-white/[0.08] hover:text-white'
                      : 'bg-white/70 border-stone-300/60 text-stone-700 hover:bg-white hover:border-stone-400/60'
                  }`}
                >
                  Наступна →
                </Link>
              )}
            </div>
          </div>
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

function Th({ children, theme }: { children: React.ReactNode; theme: Theme }) {
  const dark = theme === 'dark';
  return (
    <th className={`text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] whitespace-nowrap ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
      {children}
    </th>
  );
}

function KindBadge({ kind, theme }: { kind: string; theme: Theme }) {
  const dark = theme === 'dark';
  const map: Record<string, { label: string; dark: string; light: string }> = {
    course:    { label: 'Курс',      dark: 'bg-sky-500/15 text-sky-300 border-sky-500/20',              light: 'bg-sky-500/10 text-sky-800 border-sky-500/25' },
    bundle:    { label: 'Пакет',     dark: 'bg-violet-500/15 text-violet-300 border-violet-500/20',    light: 'bg-violet-500/10 text-violet-800 border-violet-500/25' },
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
