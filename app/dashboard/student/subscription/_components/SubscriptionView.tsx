'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Plan = 'YEARLY' | 'MONTHLY';
type SubStatus = 'PENDING' | 'ACTIVE' | 'GRACE' | 'EXPIRED' | 'CANCELLED' | 'ARCHIVED';

interface Data {
  id: string;
  plan: Plan;
  status: SubStatus;
  startDate: string | null;
  expiresAt: string | null;
  lastPaymentAt: string | null;
  cancelledAt: string | null;
  totalPaid: number;
  paidCount: number;
  canCancel: boolean;
  payments: Array<{
    id: string;
    amount: number;
    status: string;
    createdAt: string;
    paidAt: string | null;
    orderReference: string;
  }>;
}

const STATUS_LABELS: Record<SubStatus, { label: string; className: string }> = {
  ACTIVE:    { label: 'Активна',     className: 'bg-emerald-100 text-emerald-800 border-emerald-300/60' },
  GRACE:     { label: 'Grace',       className: 'bg-amber-100 text-amber-800 border-amber-300/60' },
  EXPIRED:   { label: 'Завершилась', className: 'bg-rose-100 text-rose-800 border-rose-300/60' },
  CANCELLED: { label: 'Скасована',   className: 'bg-stone-200 text-stone-700 border-stone-300/60' },
  PENDING:   { label: 'Очікує',      className: 'bg-stone-100 text-stone-600 border-stone-300/60' },
  ARCHIVED:  { label: 'Архів',       className: 'bg-zinc-200 text-zinc-700 border-zinc-300/60' },
};

export default function SubscriptionView({ data }: { data: Data }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const planLabel = data.plan === 'YEARLY' ? 'Річна (одноразова)' : 'Місячна (розсрочка)';
  const statusInfo = STATUS_LABELS[data.status];

  async function handleCancel() {
    const ok = window.confirm(
      'Впевнені, що хочете скасувати підписку?\n\n' +
      '• Наступні автосписання припиняться\n' +
      '• Доступ до курсу залишиться до кінця вже оплаченого періоду\n' +
      '• Скасувати можна тільки до наступного списання\n\n' +
      'Продовжити?',
    );
    if (!ok) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/student/yearly-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? 'Не вдалося скасувати підписку');
      } else {
        if (body.warning) {
          window.alert(
            `Підписку скасовано локально, але відповідь від платіжної системи:\n${body.warning}\n\n` +
            'Напишіть нам, якщо будуть додаткові списання — ми повернемо кошти.',
          );
        }
        router.refresh();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-[#1C3A2E] mb-8">Моя підписка</h1>

      {/* Status card */}
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-6 border border-stone-200/60">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-stone-500 mb-1">План</div>
            <div className="text-xl font-semibold text-[#1C3A2E]">{planLabel}</div>
          </div>
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border ${statusInfo.className}`}>
            {statusInfo.label}
          </span>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <Field label="Старт" value={data.startDate ? fmtDate(data.startDate) : '—'} />
          <Field
            label="Доступ до"
            value={data.expiresAt ? fmtDate(data.expiresAt) : '—'}
            highlight={data.status === 'GRACE' || data.status === 'EXPIRED'}
          />
          <Field label="Останній платіж" value={data.lastPaymentAt ? fmtDate(data.lastPaymentAt) : '—'} />
          <Field
            label="Сплачено всього"
            value={`${data.totalPaid.toLocaleString('uk-UA')} ₴ · ${data.paidCount} ${pluralPayments(data.paidCount)}`}
          />
          {data.cancelledAt && (
            <Field label="Скасовано" value={fmtDate(data.cancelledAt)} className="sm:col-span-2 text-rose-700" />
          )}
        </div>

        {/* Action bar */}
        {data.canCancel && (
          <div className="mt-6 pt-5 border-t border-stone-200/60">
            <div className="bg-amber-50 border border-amber-300/50 rounded-lg px-4 py-3 mb-3 text-[13px] text-amber-900">
              <strong>Скасування підписки:</strong> припиняться наступні автосписання. Доступ до курсу буде активний до <strong>{data.expiresAt ? fmtDate(data.expiresAt) : '—'}</strong>.
            </div>
            <button
              type="button"
              onClick={handleCancel}
              disabled={busy}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-rose-50 border border-rose-300/50 text-rose-800 font-medium hover:bg-rose-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? 'Скасовую…' : '🚫 Скасувати підписку'}
            </button>
            {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
          </div>
        )}

        {data.status === 'CANCELLED' && (
          <div className="mt-6 pt-5 border-t border-stone-200/60 bg-stone-50 -mx-6 -mb-6 px-6 pb-6 rounded-b-2xl text-[13px] text-stone-600">
            Підписку скасовано. Якщо захочете повернутись — напишіть нам або оформіть нову підписку на сторінці програми.
          </div>
        )}
      </div>

      {/* Payments */}
      {data.payments.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200/60">
          <div className="px-6 py-4 border-b border-stone-200/60">
            <h2 className="text-lg font-semibold text-[#1C3A2E]">Історія платежів</h2>
          </div>
          <div className="divide-y divide-stone-200/60">
            {data.payments.map((p) => (
              <div key={p.id} className="px-6 py-3 flex items-center justify-between gap-4">
                <div>
                  <div className="font-mono text-[11px] text-stone-500">{p.orderReference}</div>
                  <div className="text-xs text-stone-500 mt-0.5">
                    {p.paidAt ? `Оплачено ${fmtDate(p.paidAt)}` : `Створено ${fmtDate(p.createdAt)}`}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusPill status={p.status} />
                  <span className="font-semibold text-[#1C3A2E] tabular-nums min-w-[80px] text-right">
                    {p.amount.toLocaleString('uk-UA')} ₴
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, highlight, className = '' }: {
  label: string;
  value: string;
  highlight?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-[11px] uppercase tracking-[0.18em] text-stone-500 mb-0.5">{label}</div>
      <div className={`text-sm ${highlight ? 'text-amber-800 font-semibold' : 'text-stone-800'}`}>{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    PAID:    'bg-emerald-100 text-emerald-800',
    PENDING: 'bg-stone-100 text-stone-700',
    FAILED:  'bg-rose-100 text-rose-800',
    REFUNDED:'bg-stone-200 text-stone-700',
  };
  const cls = map[status] ?? 'bg-stone-100 text-stone-700';
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${cls}`}>
      {status === 'PAID' ? 'Оплачено' : status === 'PENDING' ? 'Очікує' : status === 'FAILED' ? 'Помилка' : status}
    </span>
  );
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function pluralPayments(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'платіж';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'платежі';
  return 'платежів';
}
