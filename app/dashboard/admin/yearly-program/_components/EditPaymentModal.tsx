'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { HiOutlinePencilSquare, HiOutlineCheck, HiOutlineExclamationTriangle } from 'react-icons/hi2';
import type { Theme } from '../../_components/adminTheme';
import { pluralParts } from '@/lib/yearlyProgramManualGroups';
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
  /// true — платіж лишається у «Доході», але НЕ дає місяця доступу
  /// (calculateAccessUntil такі рядки відсіює).
  excludedFromAccess?: boolean;
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
///
/// Тут же — виправлення ПОМИЛКОВОГО платежу, бо кожен зайвий PAID-рядок = зайвий місяць
/// доступу назавжди: «Виключити з доступу» (оборотна повсякденна дія) і «Видалити платіж»
/// (необоротна, лише super-admin). Для розбитого внесення дію можна застосувати до всіх
/// часток одразу — інакше довелось би клікати по кожній з п'яти.
export default function EditPaymentModal({
  subscriptionId,
  payment,
  groupPayments,
  isSuperAdmin = false,
  theme,
  onClose,
  onSaved,
}: {
  subscriptionId: string;
  payment: EditablePayment;
  /// Усі частки внесення, до якого належить цей платіж (включно з ним). undefined або
  /// масив з одного елемента = це не розбивка.
  groupPayments?: EditablePayment[];
  /// Розблоковує «Видалити платіж» (env-allowlist SUPER_ADMIN_EMAILS). Сервер перевіряє
  /// це ще раз — кнопка лише ховає дію від звичайного адміна.
  isSuperAdmin?: boolean;
  theme: Theme;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dark = theme === 'dark';
  const { toast, confirm } = useUIFeedback();
  const [mounted, setMounted] = useState(false);
  const [amount, setAmount] = useState(String(payment.amount));
  const [method, setMethod] = useState<string>(payment.manualMethod ?? 'cash');
  const [note, setNote] = useState(payment.manualNote ?? '');
  const [paidAt, setPaidAt] = useState(isoToLocalInput(payment.paidAt ?? payment.createdAt));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /// Дія над платежем (виключення/видалення) — окремий індикатор, щоб «Зберегти» не мигало.
  const [fixing, setFixing] = useState(false);
  const groupParts = groupPayments && groupPayments.length > 1 ? groupPayments : null;
  const [applyToGroup, setApplyToGroup] = useState(true);

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
  const canSubmit = validAmount && !!method && !submitting && !fixing;
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
      // Правка платежу може мовчки скинути підписку в PENDING (напр. спосіб змінили на
      // «Перенесення») — і тоді відкритий доступ у SendPulse лишається за неоплаченим.
      const pendingNote = data.revertedToPending ? ' · підписка повернулась у «Очікує оплату»' : '';
      toast('success', data.noChanges ? 'Без змін' : `Платіж оновлено${pendingNote}`);
      if (data.spWarning) toast('warning', data.spWarning);
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  /// Цілі пакетної дії: або вся розбивка, або тільки цей рядок.
  function targetIds(): string[] {
    return groupParts && applyToGroup ? groupParts.map((p) => p.id) : [payment.id];
  }
  function targetLabel(): string {
    const targets = groupParts && applyToGroup ? groupParts : [payment];
    const sum = targets.reduce((s, p) => s + p.amount, 0);
    return targets.length > 1
      ? `Внесення на ${sum.toLocaleString('uk-UA')} ₴ (${targets.length} ${pluralParts(targets.length)})`
      : `Платіж ${payment.amount.toLocaleString('uk-UA')} ₴`;
  }

  async function post(
    action: string,
    extra: Record<string, unknown>,
    successMsg: (data: { newExpiresAt?: string | null; revertedToPending?: boolean; spWarning?: string }) => string,
  ) {
    setFixing(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/yearly-program/${subscriptionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action, paymentIds: targetIds(), ...extra }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? res.statusText);
        return;
      }
      // Зарахованих платежів не лишилось → підписка знову «ще не оплачено». Кажемо це
      // менеджеру одразу, інакше зміна статусу в таблиці виглядає як збій.
      const pendingNote = data.revertedToPending ? ' · підписка повернулась у «Очікує оплату»' : '';
      toast('success', data.noChanges ? 'Без змін' : successMsg(data) + pendingNote);
      // Підписка «ще не оплачена», а курс у SendPulse лишився відкритим — окремий
      // warning-тост, бо автоматично доступ ми не закриваємо (це рішення менеджера).
      if (data.spWarning) toast('warning', data.spWarning);
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setFixing(false);
    }
  }

  /// Виключити з доступу / повернути в доступ. Гроші лишаються в «Доході» — змінюється
  /// лише кількість місяців, які цей платіж дає студенту.
  async function toggleAccess() {
    const excluded = !payment.excludedFromAccess;
    const ok = await confirm({
      title: excluded ? 'Виключити з доступу?' : 'Повернути в доступ?',
      description: excluded
        ? `${targetLabel()} — місяці доступу за цим платежем більше не рахуються. Сума лишиться в історії платежів і в «Доході» Річної; у глобальній аналітиці продажів виключені платежі не враховуються. Це не видалення — дію можна відкотити.`
        : `${targetLabel()} — місяці доступу за цим платежем знову рахуються.`,
      bullets: excluded
        ? [{ icon: '📉', text: 'Дата «Доступ до» перерахується одразу — вона зменшиться' }]
        : [{ icon: '📈', text: 'Дата «Доступ до» перерахується одразу — вона збільшиться' }],
      confirmLabel: excluded ? 'Виключити' : 'Повернути',
      destructive: excluded,
    });
    if (!ok) return;
    await post(
      'set_payment_access',
      { excluded },
      (data) => `${excluded ? 'Виключено з доступу' : 'Повернуто в доступ'} · Доступ до: ${data.newExpiresAt ? new Date(data.newExpiresAt).toLocaleDateString('uk-UA') : '—'}`,
    );
  }

  /// Видалення — необоротне, тому два кроки підтвердження. Слід лишається у подіях
  /// підписки (повний знімок видалених рядків пише сервер).
  async function deletePayment() {
    const first = await confirm({
      title: 'Видалити платіж назавжди?',
      description: `${targetLabel()} буде видалено з бази назавжди. Гроші зникнуть із «Доходу», доступ перерахується.`,
      bullets: [
        { icon: '↩️', text: 'Оборотна альтернатива — «Виключити з доступу» (платіж лишається в історії)' },
        { icon: '🧾', text: 'У подіях підписки лишиться повний знімок видаленого' },
      ],
      confirmLabel: 'Далі',
      destructive: true,
    });
    if (!first) return;
    const second = await confirm({
      title: 'Точно видалити?',
      description: 'Відновити видалений платіж з адмінки неможливо — тільки внести його заново вручну.',
      confirmLabel: 'Так, видалити',
      destructive: true,
    });
    if (!second) return;
    await post('delete_payment', {}, (data) => `Видалено · Доступ до: ${data.newExpiresAt ? new Date(data.newExpiresAt).toLocaleDateString('uk-UA') : '—'}`);
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

          {/* ── Виправлення помилкового платежу ─────────────────────────────────── */}
          <div className={`pt-4 border-t ${dark ? 'border-white/[0.07]' : 'border-stone-300/60'}`}>
            <div className={`text-[11px] uppercase tracking-wider font-medium mb-2 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
              Помилковий платіж
            </div>

            {payment.excludedFromAccess && (
              <div className={`mb-2.5 px-3 py-2 rounded-lg border text-[11.5px] leading-relaxed ${
                dark ? 'bg-amber-500/[0.07] border-amber-400/25 text-amber-100/90' : 'bg-amber-50/80 border-amber-300/60 text-amber-900'
              }`}>
                🚫 Цей платіж <b>не дає місяця доступу</b> — він виключений. Сума лишається в історії
                й у «Доході» Річної; у глобальній аналітиці продажів виключені платежі не враховуються.
              </div>
            )}

            {groupParts && (
              <label className={`flex items-start gap-2 mb-2.5 px-3 py-2 rounded-lg border cursor-pointer text-[11.5px] leading-relaxed ${
                dark ? 'bg-white/[0.03] border-white/10' : 'bg-white border-stone-300'
              }`}>
                <input
                  type="checkbox"
                  checked={applyToGroup}
                  onChange={(e) => setApplyToGroup(e.target.checked)}
                  className="mt-0.5 w-4 h-4 shrink-0 accent-indigo-600"
                />
                <span>
                  Застосувати до всього внесення — <b>{groupParts.length} {pluralParts(groupParts.length)}</b> на{' '}
                  <b>{groupParts.reduce((s, p) => s + p.amount, 0).toLocaleString('uk-UA')} ₴</b>
                  <span className={`block ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                    Зніміть галочку, щоб дія торкнулась лише цієї частки (1 місяць доступу).
                  </span>
                </span>
              </label>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={toggleAccess}
                disabled={fixing || submitting}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12px] font-semibold border transition-colors disabled:opacity-50 ${
                  payment.excludedFromAccess
                    ? dark ? 'bg-emerald-500/12 border-emerald-400/35 text-emerald-200 hover:bg-emerald-500/20' : 'bg-emerald-50 border-emerald-300/70 text-emerald-900 hover:bg-emerald-100'
                    : dark ? 'bg-amber-500/12 border-amber-400/35 text-amber-200 hover:bg-amber-500/20' : 'bg-amber-50 border-amber-300/70 text-amber-900 hover:bg-amber-100'
                }`}
              >
                {payment.excludedFromAccess ? '↩️ Повернути в доступ' : '🚫 Виключити з доступу'}
              </button>

              {/* Видалення — лише super-admin (env SUPER_ADMIN_EMAILS). Повсякденна дія
                  для менеджера — «Виключити з доступу», вона оборотна. */}
              {isSuperAdmin && (
                <button
                  type="button"
                  onClick={deletePayment}
                  disabled={fixing || submitting}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12px] font-semibold border transition-colors disabled:opacity-50 ${
                    dark ? 'bg-rose-500/12 border-rose-400/35 text-rose-200 hover:bg-rose-500/20' : 'bg-rose-50 border-rose-300/70 text-rose-900 hover:bg-rose-100'
                  }`}
                >
                  🗑 Видалити платіж
                </button>
              )}
            </div>
            <p className={`mt-2 text-[11px] leading-relaxed ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
              Кожен зайвий платіж = зайвий місяць доступу. «Виключити з доступу» прибирає цей вплив,
              не чіпаючи історію{isSuperAdmin ? '; видалення прибирає запис назовсім.' : '.'}
            </p>
          </div>

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
