import prisma from '@/lib/prisma';
import Link from 'next/link';
import { HiOutlineArrowLeft } from 'react-icons/hi2';

const KIND_FILTERS = ['all', 'course', 'bundle', 'connector', 'unknown'] as const;
type KindFilter = (typeof KIND_FILTERS)[number];

const PAGE_SIZE = 50;

function KindBadge({ kind }: { kind: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    course: { bg: 'bg-blue-50 ring-blue-200', text: 'text-blue-700', label: 'Курс' },
    bundle: { bg: 'bg-violet-50 ring-violet-200', text: 'text-violet-700', label: 'Пакет' },
    connector: { bg: 'bg-amber-50 ring-amber-200', text: 'text-amber-700', label: 'Конектор' },
    unknown: { bg: 'bg-slate-100 ring-slate-200', text: 'text-slate-600', label: '?' },
  };
  const s = map[kind] || map.unknown;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full ring-1 ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

function StatusBadge({ transactionStatus, signatureValid, skipped }: { transactionStatus: string | null; signatureValid: boolean | null; skipped: boolean }) {
  if (signatureValid === false) {
    return <span className="inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full bg-red-50 text-red-700 ring-1 ring-red-200">Invalid sig</span>;
  }
  if (skipped) {
    return <span className="inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full bg-slate-100 text-slate-600 ring-1 ring-slate-200">Skipped</span>;
  }
  if (transactionStatus === 'Approved') {
    return <span className="inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">Approved</span>;
  }
  if (transactionStatus === 'Declined' || transactionStatus === 'Expired') {
    return <span className="inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full bg-rose-50 text-rose-700 ring-1 ring-rose-200">{transactionStatus}</span>;
  }
  return <span className="inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full bg-slate-100 text-slate-600 ring-1 ring-slate-200">{transactionStatus ?? '—'}</span>;
}

export default async function PaymentLogsPage({ searchParams }: { searchParams: Promise<{ kind?: string; page?: string }> }) {
  const sp = await searchParams;
  const kind = (KIND_FILTERS as readonly string[]).includes(sp.kind ?? '') ? (sp.kind as KindFilter) : 'all';
  const page = Math.max(1, parseInt(sp.page ?? '1') || 1);
  const skip = (page - 1) * PAGE_SIZE;

  const where = kind === 'all' ? {} : { kind };

  const [total, logs, approvedCount, skippedCount, invalidSigCount] = await Promise.all([
    prisma.paymentCallbackLog.count({ where }),
    prisma.paymentCallbackLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      skip,
    }),
    prisma.paymentCallbackLog.count({ where: { ...where, transactionStatus: 'Approved', skipped: false, signatureValid: true } }),
    prisma.paymentCallbackLog.count({ where: { ...where, skipped: true } }),
    prisma.paymentCallbackLog.count({ where: { ...where, signatureValid: false } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/dashboard/admin"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
        >
          <HiOutlineArrowLeft /> Назад
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Логи платежів</h1>
        <p className="text-sm text-slate-500 mt-1">
          Всі виклики <code className="text-xs bg-slate-100 px-1 rounded">/api/wayforpay/callback</code> — показує хто стукав, з яким статусом, і що система зробила. Ідемпотентність фіксується в колонці «Пропуск».
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-slate-200/70 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Всього</p>
          <p className="text-2xl font-bold text-slate-800 tabular-nums mt-1">{total}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/70 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600">Approved (реально оброблено)</p>
          <p className="text-2xl font-bold text-emerald-700 tabular-nums mt-1">{approvedCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/70 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Skipped (дублі)</p>
          <p className="text-2xl font-bold text-slate-700 tabular-nums mt-1">{skippedCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/70 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-600">Invalid signature</p>
          <p className="text-2xl font-bold text-rose-700 tabular-nums mt-1">{invalidSigCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        {KIND_FILTERS.map((k) => (
          <Link
            key={k}
            href={`/dashboard/admin/payment-logs${k === 'all' ? '' : `?kind=${k}`}`}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              kind === k
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {k === 'all' ? 'Всі' : k === 'course' ? 'Курси' : k === 'bundle' ? 'Пакети' : k === 'connector' ? 'Конектор' : 'Невідомо'}
          </Link>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/70 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/70 border-b border-slate-200">
              <tr className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-3">Час</th>
                <th className="px-4 py-3">Тип</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Попередній</th>
                <th className="px-4 py-3">Сума</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">IP</th>
                <th className="px-4 py-3">Дії</th>
                <th className="px-4 py-3">SendPulse</th>
                <th className="px-4 py-3">Order reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center text-sm text-slate-400">
                    Логів немає
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500 tabular-nums">
                      {log.createdAt.toISOString().replace('T', ' ').slice(0, 19)}
                    </td>
                    <td className="px-4 py-3">
                      <KindBadge kind={log.kind} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        transactionStatus={log.transactionStatus}
                        signatureValid={log.signatureValid}
                        skipped={log.skipped}
                      />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{log.prevStatus ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-700 tabular-nums whitespace-nowrap">
                      {log.amount != null ? `${log.amount} ${log.currency ?? 'UAH'}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 max-w-[180px] truncate" title={log.clientEmail ?? ''}>
                      {log.clientEmail ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 tabular-nums">{log.ip ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 max-w-[280px]">
                      {log.actionsTaken ? (
                        <span className="font-mono text-[10px] break-all">{log.actionsTaken}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 max-w-[200px]">
                      {log.sendpulseSlugs ? (
                        <span className="font-mono text-[10px] break-all text-emerald-700">{log.sendpulseSlugs}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 font-mono break-all max-w-[220px]">
                      {log.orderReference ?? '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50/40">
            <p className="text-xs text-slate-500">
              Сторінка {page} з {totalPages} · Всього {total}
            </p>
            <div className="flex items-center gap-2">
              {page > 1 && (
                <Link
                  href={`/dashboard/admin/payment-logs?${new URLSearchParams({ ...(kind !== 'all' && { kind }), page: String(page - 1) }).toString()}`}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
                >
                  ← Попередня
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`/dashboard/admin/payment-logs?${new URLSearchParams({ ...(kind !== 'all' && { kind }), page: String(page + 1) }).toString()}`}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
                >
                  Наступна →
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
