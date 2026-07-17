'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { HiOutlinePencilSquare, HiOutlineCheck, HiOutlineExclamationTriangle } from 'react-icons/hi2';
import type { Theme } from '../../_components/adminTheme';
import { useUIFeedback } from './UIFeedback';

/// Способи РУЧНОГО платежу. carryover = перенесення з минулого набору (сума 0, дохід не рахується).
const METHODS: { value: string; label: string; icon: string }[] = [
  { value: 'cash', label: 'Готівка', icon: '💵' },
  { value: 'transfer', label: 'Переказ', icon: '🏦' },
  { value: 'direct', label: 'Напряму (ФОП)', icon: '👤' },
  { value: 'carryover', label: 'Перенесення', icon: '🔄' },
];

export interface EditablePayment {
  id: string;
  amount: number;
  manualMethod: string | null;
  manualNote: string | null;
  paidAt: string | null;
  createdAt: string;
}

/// ISO → рядок для <input type="datetime-local"> (локальний час менеджера).
function isoToLocalInput(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/// Модалка «Редагувати платіж» — правка РУЧНОГО платежу (готівка / переказ / ФОП / перенесення).
/// Передзаповнена поточними значеннями. Вибір «Перенесення» ставить суму 0 і дописує «(було N ₴)».
/// Після збереження перераховується підписка + «Дохід» (POST action:'edit_payment').
export default function EditPaymentModal({
  subscriptionId,
  payment,
  theme,
  onClose,
  onSaved,
}: {
  subscriptionId: string;
  payment: EditablePayment;
  theme: Theme;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dark = theme === 'dark';
  const { toast } = useUIFeedback();
  const [mounted, setMounted] = useState(false);
  const [amount, setAmount] = useState(String(payment.amount));
  const [method, setMethod] = useState<string>(payment.manualMethod ?? 'cash');
  const [note, setNote] = useState(payment.manualNote ?? '');
  const [paidAt, setPaidAt] = useState(isoToLocalInput(payment.paidAt ?? payment.createdAt));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  const amountNum = Number(amount);
  // 0 дозволений (перенесення), на відміну від фіксації нової оплати.
  const validAmount = Number.isInteger(amountNum) && amountNum >= 0 && amountNum <= 1_000_000;
  const canSubmit = validAmount && !!method && !submitting;
  const isCarryover = method === 'carryover';

  /// Вибір способу. При «Перенесення» → сума 0 + дописуємо «(було N ₴)» від ОРИГІНАЛЬНОЇ суми.
  function pickMethod(v: string) {
    setMethod(v);
    if (v === 'carryover') {
      setAmount('0');
      if (payment.amount > 0) {
        const tag = `(було ${payment.amount} ₴)`;
        setNote((n) => (n.includes(tag) ? n : (n.trim() ? `${n.trim()} ${tag}` : tag)));
      }
    }
  }

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/yearly-program/${subscriptionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'edit_payment',
          paymentId: payment.id,
          amount: amountNum,
          method,
          note: note.trim(),
          paidAt: paidAt ? new Date(paidAt).toISOString() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? res.statusText);
        return;
      }
      toast('success', data.noChanges ? 'Без змін' : 'Платіж оновлено');
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-3" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={`relative w-full max-h-[94vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden ${
          dark ? 'bg-zinc-950 border border-white/10 text-slate-200' : 'bg-stone-100 border border-stone-200 text-stone-800'
        }`}
        style={{ maxWidth: 'min(520px, 96vw)' }}
      >
        {/* HEADER */}
        <header className={`shrink-0 flex items-center justify-between px-6 py-4 border-b ${
          dark ? 'bg-zinc-900/95 border-white/10' : 'bg-white/95 border-stone-200'
        }`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-[18px] ${
              dark ? 'bg-indigo-400/15 text-indigo-300 border border-indigo-400/30' : 'bg-indigo-100 text-indigo-800 border border-indigo-300/60'
            }`}>
              <HiOutlinePencilSquare />
            </div>
            <div className="min-w-0">
              <h3 className="text-[16px] font-bold leading-tight">Редагувати платіж</h3>
              <p className={`text-[11.5px] leading-tight mt-0.5 ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
                Ручний платіж — правка суми / способу / дати
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Закрити"
            className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[14px] transition-colors ${
              dark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-stone-100 text-stone-500'
            }`}
          >✕</button>
        </header>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {isCarryover && (
            <div className={`flex items-start gap-2.5 px-4 py-3 rounded-xl border text-[12px] leading-relaxed ${
              dark ? 'bg-violet-500/[0.06] border-violet-400/20 text-violet-100/90' : 'bg-violet-50/70 border-violet-200/70 text-violet-900'
            }`}>
              <span className="shrink-0">🔄</span>
              <span>Перенесення з минулого набору. <b>Сума 0 — дохід не рахується</b>, доступ лишається як у Річного.</span>
            </div>
          )}

          <Field theme={theme} label="Сума, ₴" required>
            <input
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isCarryover}
              className={`${inputCls(dark)} ${isCarryover ? 'opacity-60 cursor-not-allowed' : ''}`}
              autoFocus
            />
          </Field>

          <Field theme={theme} label="Спосіб" required>
            <div className="grid grid-cols-2 gap-2">
              {METHODS.map((m) => {
                const active = method === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => pickMethod(m.value)}
                    className={`flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-lg border text-[12px] font-semibold transition-colors ${
                      active
                        ? m.value === 'carryover'
                          ? dark ? 'bg-violet-500/15 border-violet-400/40 text-violet-200' : 'bg-violet-50 border-violet-400/70 text-violet-900'
                          : dark ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200' : 'bg-emerald-50 border-emerald-400/70 text-emerald-900'
                        : dark ? 'bg-zinc-800 border-white/10 text-slate-300 hover:bg-white/[0.06]' : 'bg-white border-stone-300 text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    <span className="text-[16px]">{m.icon}</span>
                    {m.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field theme={theme} label="Дата оплати">
            <input
              type="datetime-local"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              className={inputCls(dark)}
            />
          </Field>

          <Field theme={theme} label="Коментар (опціонально)">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Напр.: сплачувала 3.0 у 2025"
              className={`${inputCls(dark)} resize-none`}
            />
          </Field>

          {error && (
            <div className={`text-[12.5px] px-4 py-3 rounded-xl flex items-start gap-2.5 ${
              dark ? 'bg-rose-500/10 border border-rose-400/25 text-rose-200/90' : 'bg-rose-50 border border-rose-200 text-rose-900'
            }`}>
              <HiOutlineExclamationTriangle className="text-base shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <footer className={`shrink-0 flex items-center justify-end gap-2 px-6 py-4 border-t ${
          dark ? 'bg-zinc-900/95 border-white/10' : 'bg-white/95 border-stone-200'
        }`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-lg text-[13px] font-medium border ${
              dark ? 'border-white/10 text-slate-300 hover:bg-white/[0.06]' : 'border-stone-300 text-stone-700 hover:bg-stone-50'
            }`}
          >
            Скасувати
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className={`inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-[13px] font-bold border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              dark
                ? 'bg-indigo-500/15 text-indigo-200 border-indigo-400/30 hover:bg-indigo-500/25'
                : 'bg-indigo-50 text-indigo-900 border-indigo-300/60 hover:bg-indigo-100'
            }`}
          >
            <HiOutlineCheck className="text-[14px]" />
            {submitting ? 'Зберігаю…' : 'Зберегти'}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

function Field({ theme, label, required, children }: { theme: Theme; label: string; required?: boolean; children: React.ReactNode }) {
  const dark = theme === 'dark';
  return (
    <div>
      <label className={`block text-[11px] uppercase tracking-wider font-medium mb-1.5 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
        {label} {required && <span className={dark ? 'text-rose-300' : 'text-rose-500'}>*</span>}
      </label>
      {children}
    </div>
  );
}

function inputCls(dark: boolean): string {
  return `w-full px-3 py-2 rounded-lg border text-[13px] outline-none transition-colors ${
    dark
      ? 'bg-zinc-800 border-white/10 text-slate-100 focus:border-indigo-400/40'
      : 'bg-white border-stone-300 text-stone-900 focus:border-indigo-400'
  }`;
}
