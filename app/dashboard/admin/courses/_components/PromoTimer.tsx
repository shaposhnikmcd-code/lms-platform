'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HiOutlineClock } from 'react-icons/hi2';
import { FaCheck } from 'react-icons/fa6';
import type { Theme } from '../../_components/adminTheme';

/// Стан вікна дії промокоду:
/// - 'off'     — таймер не виставлений (як було завжди раніше);
/// - 'pending' — таймер виставлений, ще не настав час `startsAt`;
/// - 'active'  — у вікні дії;
/// - 'expired' — `expiresAt` минув.
export type PromoWindowState = 'off' | 'pending' | 'active' | 'expired';

export function getPromoWindowState(
  startsAt: string | null,
  expiresAt: string | null,
  now: Date = new Date(),
): PromoWindowState {
  if (!startsAt && !expiresAt) return 'off';
  if (startsAt) {
    const s = new Date(startsAt);
    if (!Number.isNaN(s.getTime()) && now.getTime() < s.getTime()) return 'pending';
  }
  if (expiresAt) {
    const e = new Date(expiresAt);
    if (!Number.isNaN(e.getTime()) && now.getTime() >= e.getTime()) return 'expired';
  }
  return 'active';
}

/// Конвертує ISO-string у формат `<input type="datetime-local">` (`YYYY-MM-DDTHH:mm`).
/// Враховує локальну TZ браузера (адмін у Києві → бачить київський час).
function isoToLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/// Поточний локальний час у форматі `<input type="datetime-local">`. Для `min`-атрибута,
/// щоб системний date-picker не показував минулі дні.
function nowLocalInput(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/// Перетворює значення з `<input type="datetime-local">` назад в ISO-string (UTC).
/// Конструктор `new Date('YYYY-MM-DDTHH:mm')` інтерпретує рядок у локальній TZ —
/// саме те, що нам треба.
function localInputToIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function formatHumanDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface Props {
  theme: Theme;
  startsAt: string | null;
  expiresAt: string | null;
  /// Чи є вже введений код у відповідному рядку — без коду таймер не має сенсу,
  /// тому іконку показуємо disabled.
  hasCode: boolean;
  onChange: (next: { startsAt: string | null; expiresAt: string | null }) => void;
  /// Підпис у заголовку popover-а: "Промокод 1" / "Промокод 2" / назва категорії.
  label: string;
}

export default function PromoTimer({ theme, startsAt, expiresAt, hasCode, onChange, label }: Props) {
  const dark = theme === 'dark';
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const fmtId = useId();

  const state = getPromoWindowState(startsAt, expiresAt);

  // Локальний draft — застосовується по "Готово", скасовується по "X" / outside click.
  const [draftStart, setDraftStart] = useState<string>(isoToLocalInput(startsAt));
  const [draftEnd, setDraftEnd] = useState<string>(isoToLocalInput(expiresAt));
  // Зафіксований "min" на момент відкриття popover-а — щоб date-picker не «дрейфував»
  // поки користувач вибирає (інакше min рахувався б на кожному рендері).
  const [nowMin, setNowMin] = useState<string>(() => nowLocalInput());
  useEffect(() => {
    if (open) setNowMin(nowLocalInput());
  }, [open]);

  // Початкові значення (на момент відкриття) — щоб не флагати як "минулу дату" поля,
  // які користувач не змінював (наприклад, прострочений промо, який залишають як є).
  const initialStart = isoToLocalInput(startsAt);
  const initialEnd = isoToLocalInput(expiresAt);

  useEffect(() => {
    setDraftStart(isoToLocalInput(startsAt));
    setDraftEnd(isoToLocalInput(expiresAt));
  }, [startsAt, expiresAt]);

  // Live-валідація. Показуємо inline помилку в popover-і замість alert().
  const startInPast =
    draftStart !== '' &&
    draftStart !== initialStart &&
    new Date(draftStart).getTime() < new Date(nowMin).getTime();
  const endInPast =
    draftEnd !== '' &&
    draftEnd !== initialEnd &&
    new Date(draftEnd).getTime() < new Date(nowMin).getTime();
  const startEndInverted =
    draftStart !== '' &&
    draftEnd !== '' &&
    !Number.isNaN(new Date(draftStart).getTime()) &&
    !Number.isNaN(new Date(draftEnd).getTime()) &&
    new Date(draftStart).getTime() >= new Date(draftEnd).getTime();

  const draftError: string | null = startInPast
    ? 'Дата «Активний з» не може бути в минулому'
    : endInPast
    ? 'Дата «Активний до» не може бути в минулому'
    : startEndInverted
    ? 'Дата «Активний з» має бути раніше за «Активний до»'
    : null;

  // Позиціонування popover'а під іконкою.
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const POP_W = 320;
    let left = rect.left + rect.width / 2 - POP_W / 2;
    if (typeof window !== 'undefined') {
      left = Math.max(8, Math.min(left, window.innerWidth - POP_W - 8));
    }
    setPos({ top: rect.bottom + 8, left });
  }, [open]);

  // Outside click + Esc.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (popRef.current?.contains(e.target as Node)) return;
      if (btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Стилі іконки за станом.
  const iconTone = (() => {
    if (!hasCode) {
      return dark
        ? 'text-slate-700 border-white/[0.04] bg-white/[0.02]'
        : 'text-stone-300 border-stone-200/60 bg-white/40';
    }
    if (state === 'active') {
      return dark
        ? 'text-amber-300 border-amber-400/40 bg-amber-400/[0.08] hover:bg-amber-400/[0.14]'
        : 'text-amber-700 border-amber-500/40 bg-amber-100/70 hover:bg-amber-100';
    }
    if (state === 'pending') {
      return dark
        ? 'text-sky-300 border-sky-400/40 bg-sky-400/[0.08] hover:bg-sky-400/[0.14]'
        : 'text-sky-700 border-sky-500/40 bg-sky-100/60 hover:bg-sky-100';
    }
    if (state === 'expired') {
      return dark
        ? 'text-rose-300 border-rose-400/40 bg-rose-400/[0.08] hover:bg-rose-400/[0.14]'
        : 'text-rose-700 border-rose-500/40 bg-rose-100/60 hover:bg-rose-100';
    }
    return dark
      ? 'text-slate-400 border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] hover:text-slate-200'
      : 'text-stone-500 border-stone-300/60 bg-white/70 hover:bg-white hover:text-stone-700';
  })();

  const tooltip = (() => {
    if (!hasCode) return 'Введіть код, щоб налаштувати таймер';
    if (state === 'off') return 'Таймер не задано — промокод діє завжди';
    if (state === 'active')
      return `Активний${expiresAt ? ` до ${formatHumanDate(expiresAt)}` : ''}`;
    if (state === 'pending') return `Активується ${formatHumanDate(startsAt)}`;
    return `Прострочений з ${formatHumanDate(expiresAt)}`;
  })();

  function applyDraft() {
    if (draftError) return; // Кнопка «Готово» disabled — це додатковий guard.
    const newStart = localInputToIso(draftStart);
    const newEnd = localInputToIso(draftEnd);
    onChange({ startsAt: newStart, expiresAt: newEnd });
    setOpen(false);
  }

  function clearTimer() {
    setDraftStart('');
    setDraftEnd('');
    onChange({ startsAt: null, expiresAt: null });
    setOpen(false);
  }

  // Маркер-крапка над іконкою, коли стан != off.
  const dotColor = state === 'expired' ? 'bg-rose-400' : state === 'pending' ? 'bg-sky-400' : 'bg-amber-400';

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => hasCode && setOpen(o => !o)}
        disabled={!hasCode}
        title={tooltip}
        className={`relative inline-flex items-center justify-center w-7 h-7 rounded-lg border transition-colors flex-shrink-0 disabled:cursor-not-allowed ${iconTone}`}
      >
        <HiOutlineClock className="text-[14px]" />
        {hasCode && state !== 'off' && (
          <span
            className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ring-2 ${dotColor} ${
              dark ? 'ring-[#14161d]' : 'ring-[#fbf7ec]'
            }`}
          />
        )}
      </button>

      {open && pos && createPortal(
        <div
          ref={popRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: 320, zIndex: 200 }}
          className={`rounded-xl border shadow-2xl p-4 ${
            dark
              ? 'bg-[#14161d] border-white/[0.1] text-slate-100'
              : 'bg-[#fbf7ec] border-stone-300/60 text-stone-900'
          }`}
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className={`text-[11px] uppercase tracking-[0.18em] font-semibold ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                Таймер дії
              </p>
              <p className="text-[13px] font-medium mt-0.5">{label}</p>
            </div>
            <StateBadge state={state} dark={dark} />
          </div>

          <div className="space-y-3">
            <DateField
              id={`${fmtId}-start`}
              label="Активний з"
              value={draftStart}
              onChange={setDraftStart}
              dark={dark}
              placeholder="одразу"
              min={nowMin}
              invalid={startInPast || startEndInverted}
            />
            <DateField
              id={`${fmtId}-end`}
              label="Активний до"
              value={draftEnd}
              onChange={setDraftEnd}
              dark={dark}
              placeholder="без обмеження"
              min={nowMin}
              invalid={endInPast || startEndInverted}
            />
          </div>

          {draftError ? (
            <div
              role="alert"
              className={`mt-3 flex items-start gap-2 rounded-lg border px-2.5 py-2 text-[11px] leading-snug ${
                dark
                  ? 'bg-rose-500/[0.08] border-rose-400/30 text-rose-200'
                  : 'bg-rose-100/70 border-rose-400/50 text-rose-900'
              }`}
            >
              <span aria-hidden className="mt-[1px] inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[9px] font-bold leading-none flex-shrink-0 bg-rose-500/90 text-white">!</span>
              <span>{draftError}</span>
            </div>
          ) : (
            <p className={`text-[10.5px] leading-relaxed mt-3 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
              Залиште поле порожнім, щоб не обмежувати з відповідної сторони. Час — у вашому
              часовому поясі (Київ).
            </p>
          )}

          <div className="flex items-center gap-2 mt-4">
            <button
              type="button"
              onClick={clearTimer}
              className={`text-[11px] font-medium px-2 py-1.5 rounded-lg border transition-colors ${
                dark
                  ? 'bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.08] hover:text-white'
                  : 'bg-white/70 border-stone-300/60 text-stone-700 hover:bg-white hover:text-stone-900'
              }`}
            >
              Стерти таймер
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={`text-[12px] font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                dark
                  ? 'bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.08]'
                  : 'bg-white/70 border-stone-300/60 text-stone-700 hover:bg-white'
              }`}
            >
              Скасувати
            </button>
            <button
              type="button"
              onClick={applyDraft}
              disabled={!!draftError}
              title={draftError ?? undefined}
              className={`inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none ${
                dark
                  ? 'bg-amber-400/90 text-stone-900 hover:bg-amber-300 shadow-[0_0_18px_-4px_rgba(251,191,36,0.5)] disabled:bg-white/[0.06] disabled:text-slate-500'
                  : 'bg-stone-900 text-amber-100 hover:bg-stone-800 shadow-sm disabled:bg-stone-200 disabled:text-stone-400'
              }`}
            >
              <FaCheck className="text-[10px]" />
              Готово
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function DateField({
  id,
  label,
  value,
  onChange,
  dark,
  placeholder,
  invalid = false,
  min,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  dark: boolean;
  placeholder: string;
  invalid?: boolean;
  min?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <label
          htmlFor={id}
          className={`text-[10px] uppercase tracking-[0.18em] font-semibold ${
            dark ? 'text-slate-500' : 'text-stone-500'
          }`}
        >
          {label}
        </label>
        {!value && (
          <span className={`text-[10px] ${dark ? 'text-slate-600' : 'text-stone-400'}`}>
            {placeholder}
          </span>
        )}
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className={`text-[10px] underline decoration-dotted underline-offset-2 ${
              dark ? 'text-slate-500 hover:text-slate-300' : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            Стерти
          </button>
        )}
      </div>
      <input
        id={id}
        type="datetime-local"
        value={value}
        onChange={e => onChange(e.target.value)}
        min={min}
        aria-invalid={invalid || undefined}
        className={`w-full px-2 py-1.5 text-[13px] rounded-lg border focus:outline-none focus:ring-2 transition-colors ${
          invalid
            ? dark
              ? 'bg-rose-500/[0.08] border-rose-400/50 text-rose-100 focus:ring-rose-400/40 focus:border-rose-400/60'
              : 'bg-rose-100/60 border-rose-400/60 text-rose-900 focus:ring-rose-500/40 focus:border-rose-500/60'
            : dark
            ? 'bg-white/[0.04] border-white/[0.08] text-slate-100 focus:ring-amber-400/40 focus:border-amber-400/40'
            : 'bg-white/80 border-stone-300/60 text-stone-900 focus:ring-amber-500/40 focus:border-amber-500/50'
        }`}
      />
    </div>
  );
}

function StateBadge({ state, dark }: { state: PromoWindowState; dark: boolean }) {
  if (state === 'off') return null;
  const map = {
    active: {
      label: 'Активний',
      tone: dark
        ? 'bg-amber-400/15 text-amber-200 border-amber-400/30'
        : 'bg-amber-100 text-amber-900 border-amber-500/40',
    },
    pending: {
      label: 'Очікує',
      tone: dark
        ? 'bg-sky-400/15 text-sky-200 border-sky-400/30'
        : 'bg-sky-100 text-sky-900 border-sky-500/40',
    },
    expired: {
      label: 'Прострочено',
      tone: dark
        ? 'bg-rose-400/15 text-rose-200 border-rose-400/30'
        : 'bg-rose-100 text-rose-900 border-rose-500/40',
    },
  } as const;
  const m = map[state];
  return (
    <span className={`text-[10px] uppercase tracking-[0.14em] font-semibold px-2 py-0.5 rounded-full border ${m.tone}`}>
      {m.label}
    </span>
  );
}
