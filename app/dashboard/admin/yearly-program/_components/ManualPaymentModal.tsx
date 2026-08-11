'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { HiOutlineBanknotes, HiOutlineCheck, HiOutlineExclamationTriangle } from 'react-icons/hi2';
import type { Theme } from '../../_components/adminTheme';
import type { Row } from './types';
import { useUIFeedback } from './UIFeedback';

/// Способи ручної оплати (поза WayForPay). value йде на бекенд, label показуємо менеджеру.
const METHODS: { value: string; label: string; icon: string }[] = [
  { value: 'cash', label: 'Готівка', icon: '💵' },
  { value: 'transfer', label: 'Переказ', icon: '🏦' },
  { value: 'direct', label: 'Напряму (ФОП)', icon: '👤' },
];

/// Локальний datetime-local рядок (YYYY-MM-DDTHH:mm) для значення за замовчуванням = зараз.
function localNowValue(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/// Модалка «Підтвердити оплату вручну» — менеджер фіксує оплату, яка пройшла поза WayForPay
/// (готівка / переказ / напряму на ФОП). Створює Payment(PAID), активує підписку, сума лягає
/// в «Дохід». Якщо cohort запущений — відкриває доступ у SendPulse + welcome-лист.
export default function ManualPaymentModal({
  row,
  theme,
  monthlyPrice,
  yearlyPrice,
  onClose,
  onDone,
}: {
  row: Row;
  theme: Theme;
  /// Ціни з налаштувань програми (НЕ хардкод): плейсхолдер суми + поріг авто-розбивки.
  monthlyPrice: number;
  yearlyPrice: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const dark = theme === 'dark';
  const { toast } = useUIFeedback();
  const [mounted, setMounted] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<string>('cash');
  const [note, setNote] = useState('');
  const [paidAt, setPaidAt] = useState(localNowValue());
  /// Авто-розбивка великої суми на місячні платежі. Дефолт ON — бо графік доступу рахує
  /// КІЛЬКІСТЬ платежів, і без розбивки 6600 ₴ закрили б лише один місяць.
  const [split, setSplit] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /// Не помилка сервера, а інформація для менеджера: анти-дубль (HTTP 409) — оплата з такою
  /// самою сумою й способом уже зафіксована хвилину тому. Показуємо амбером, а не червоним,
  /// бо це очікуваний захист від подвійного сабміту, а не збій.
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  const amountNum = Number(amount);
  const validAmount = Number.isInteger(amountNum) && amountNum > 0 && amountNum <= 1_000_000;
  const canSubmit = validAmount && !!method && !submitting;

  const placeholderAmount = String(row.plan === 'YEARLY' ? yearlyPrice : monthlyPrice);

  // Розбивка пропонується тільки місячним підпискам і тільки коли сума тягне ≥ 2 місяці.
  // Розрахунок дзеркалить сервер (splitManualAmount): N повних місяців, залишок доливається
  // в ОСТАННІЙ рядок (окремого рядка-залишку немає — він давав би зайвий місяць доступу).
  const canSplit = row.plan === 'MONTHLY' && monthlyPrice > 0 && validAmount && amountNum >= 2 * monthlyPrice;
  const fullMonths = canSplit ? Math.floor(amountNum / monthlyPrice) : 0;
  const splitRest = canSplit ? amountNum - fullMonths * monthlyPrice : 0;
  const lastPart = canSplit ? monthlyPrice + splitRest : 0;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/yearly-program/${row.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'manual_payment',
          amount: amountNum,
          method,
          note: note.trim() || undefined,
          // datetime-local → ISO (трактуємо як локальний час менеджера).
          paidAt: paidAt ? new Date(paidAt).toISOString() : undefined,
          // Прапорець розбивки має сенс лише коли вона взагалі можлива; остаточне рішення
          // (і розрахунок часток) — на сервері, він єдине джерело правди про ціни.
          split: canSplit ? split : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // 409 — спрацював анти-дубль. Це не збій сервера: показуємо як інформацію
        // («Схоже на дубль…»), модалку не закриваємо, введені дані лишаються.
        if (res.status === 409) {
          setNotice(`Схоже на дубль: ${data.error ?? 'таку саму оплату вже зафіксовано щойно.'}`);
        } else {
          setError(data.error ?? res.statusText);
        }
        return;
      }
      const el = data.extraLaunch;
      let note2 = '';
      if (data.cohortLaunched) {
        if (el?.ok && el?.sendpulseAccessOpened) {
          note2 = el?.email?.sent
            ? ' · доступ відкрито + welcome-лист надіслано'
            : el?.email?.skipped
              ? ' · доступ відкрито (лист уже надсилався)'
              : ' · доступ відкрито';
        } else if (el && !el.ok) {
          note2 = ` · ⚠ доступ НЕ відкрито: ${el.reason ?? 'помилка'}`;
        }
      } else {
        // Cohort ще не запущений: підписка одразу ACTIVE + generic welcome-лист (креди на запуску).
        const w = data.welcome;
        if (w?.welcomeSent) note2 = ' · активовано + welcome-лист надіслано';
        else if (w?.welcomeSkipped) note2 = ' · активовано (лист не надіслано — мейлер off)';
        else note2 = ' · активовано (креди прийдуть на запуску)';
      }
      // Сервер міг зафіксувати оплату і водночас повернути `warning` (напр. сума схожа на
      // кілька місяців, але зарахується як один) — тоді замість зеленого «зафіксовано»
      // показуємо попередження, інакше менеджер його ніколи не побачить.
      const splitNote = Array.isArray(data.splitParts)
        ? ` · розбито на ${data.splitParts.length} платежів (${data.splitParts.join(' + ')})`
        : '';
      const receiptNote = data.receiptEmail && !data.receiptEmail.sent
        ? ' · ⚠ квитанцію студенту НЕ надіслано'
        : '';
      if (data.warning) {
        toast('warning', `Оплату ${amountNum}₴ зафіксовано${splitNote}${note2}${receiptNote} — ${data.warning}`);
      } else if (receiptNote) {
        toast('warning', `Оплату ${amountNum}₴ зафіксовано${splitNote}${note2}${receiptNote}`);
      } else {
        toast('success', `Оплату ${amountNum}₴ зафіксовано${splitNote}${note2}`);
      }
      onDone();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3" role="dialog" aria-modal="true">
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
              dark ? 'bg-emerald-400/15 text-emerald-300 border border-emerald-400/30' : 'bg-emerald-100 text-emerald-800 border border-emerald-300/60'
            }`}>
              <HiOutlineBanknotes />
            </div>
            <div className="min-w-0">
              <h3 className="text-[16px] font-bold leading-tight">Підтвердити оплату вручну</h3>
              <p className={`text-[11.5px] leading-tight mt-0.5 truncate ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
                {row.userEmail} · {row.plan === 'YEARLY' ? 'Річний' : 'Місячний'}
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
          <div className={`flex items-start gap-2.5 px-4 py-3 rounded-xl border text-[12px] leading-relaxed ${
            dark ? 'bg-amber-500/[0.05] border-amber-400/20 text-amber-100/90' : 'bg-amber-50/60 border-amber-200/70 text-amber-900'
          }`}>
            <span className="shrink-0">ℹ️</span>
            <span>
              Для оплат поза WayForPay (готівка, переказ на ФОП, напряму Тетяні). Сума потрапить у «Дохід» та історію платежів,
              підписка стане активною{row.cohortLaunched ? '. Програма вже запущена → доступ у SendPulse відкриється автоматично + піде welcome-лист.' : '. Програму ще не запущено → доступ відкриється на загальному запуску.'}
            </span>
          </div>

          <Field theme={theme} label="Сума, ₴" required>
            <input
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={placeholderAmount}
              className={inputCls(dark)}
              autoFocus
            />
          </Field>

          {canSplit && (
            <label
              className={`flex items-start gap-2.5 px-4 py-3 rounded-xl border cursor-pointer transition-colors ${
                split
                  ? dark ? 'bg-emerald-500/[0.07] border-emerald-400/30' : 'bg-emerald-50/70 border-emerald-300/60'
                  : dark ? 'bg-white/[0.03] border-white/10' : 'bg-white border-stone-300'
              }`}
            >
              <input
                type="checkbox"
                checked={split}
                onChange={(e) => setSplit(e.target.checked)}
                className="mt-0.5 w-4 h-4 shrink-0 accent-emerald-600"
              />
              <span className="text-[12px] leading-relaxed">
                <b>
                  Розбити на {fullMonths} платежів по {monthlyPrice.toLocaleString('uk-UA')} ₴
                  {splitRest > 0 ? ` (останній — ${lastPart.toLocaleString('uk-UA')} ₴ із залишком)` : ''}
                </b>
                <span className={`block mt-1 ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
                  {split
                    ? `Закриє ${fullMonths} місяців графіка. Студент отримає ОДНУ квитанцію на всю суму.`
                    : 'Без розбивки вся сума зарахується як ОДИН місяць графіка.'}
                </span>
              </span>
            </label>
          )}

          <Field theme={theme} label="Спосіб оплати" required>
            <div className="grid grid-cols-3 gap-2">
              {METHODS.map((m) => {
                const active = method === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMethod(m.value)}
                    className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg border text-[12px] font-semibold transition-colors ${
                      active
                        ? dark
                          ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                          : 'bg-emerald-50 border-emerald-400/70 text-emerald-900'
                        : dark
                          ? 'bg-zinc-800 border-white/10 text-slate-300 hover:bg-white/[0.06]'
                          : 'bg-white border-stone-300 text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    <span className="text-[18px]">{m.icon}</span>
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
              placeholder="Напр.: переказ на картку ФОП 02.06, квитанція №123"
              className={`${inputCls(dark)} resize-none`}
            />
          </Field>

          {notice && (
            <div className={`text-[12.5px] px-4 py-3 rounded-xl flex items-start gap-2.5 ${
              dark ? 'bg-amber-500/10 border border-amber-400/25 text-amber-100/90' : 'bg-amber-50 border border-amber-300/70 text-amber-900'
            }`}>
              <HiOutlineExclamationTriangle className="text-base shrink-0 mt-0.5" />
              <span>{notice}</span>
            </div>
          )}

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
                ? 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30 hover:bg-emerald-500/25'
                : 'bg-emerald-50 text-emerald-900 border-emerald-300/60 hover:bg-emerald-100'
            }`}
          >
            <HiOutlineCheck className="text-[14px]" />
            {submitting ? 'Фіксую…' : 'Підтвердити оплату'}
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
      ? 'bg-zinc-800 border-white/10 text-slate-100 focus:border-emerald-400/40'
      : 'bg-white border-stone-300 text-stone-900 focus:border-emerald-400'
  }`;
}
