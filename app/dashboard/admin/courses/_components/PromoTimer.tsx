'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HiOutlineClock } from 'react-icons/hi2';
import { FaCheck, FaXmark } from 'react-icons/fa6';
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

/// Внутрішній формат draft-у — `YYYY-MM-DDTHH:mm` у локальному часі (Київ).
type Parts = { y: number; mo: number; d: number; h: number; mi: number };

const pad = (n: number) => String(n).padStart(2, '0');

function isoToLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function nowLocalInput(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function parseDraft(s: string): Parts | null {
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  return { y: +m[1], mo: +m[2] - 1, d: +m[3], h: +m[4], mi: +m[5] };
}

function combineDraft(p: Parts): string {
  return `${p.y}-${pad(p.mo + 1)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}`;
}

function formatChip(s: string): string {
  const p = parseDraft(s);
  if (!p) return '';
  return `${pad(p.d)}.${pad(p.mo + 1)}.${p.y} ${pad(p.h)}:${pad(p.mi)}`;
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
  hasCode: boolean;
  onChange: (next: { startsAt: string | null; expiresAt: string | null }) => void;
  label: string;
}

const POP_W = 340;

export default function PromoTimer({ theme, startsAt, expiresAt, hasCode, onChange, label }: Props) {
  const dark = theme === 'dark';
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const fmtId = useId();

  const state = getPromoWindowState(startsAt, expiresAt);

  const [draftStart, setDraftStart] = useState<string>(isoToLocalInput(startsAt));
  const [draftEnd, setDraftEnd] = useState<string>(isoToLocalInput(expiresAt));
  const [activeField, setActiveField] = useState<'start' | 'end'>('start');
  const [nowMin, setNowMin] = useState<string>(() => nowLocalInput());
  useEffect(() => {
    if (open) setNowMin(nowLocalInput());
  }, [open]);

  const initialStart = isoToLocalInput(startsAt);
  const initialEnd = isoToLocalInput(expiresAt);

  useEffect(() => {
    setDraftStart(isoToLocalInput(startsAt));
    setDraftEnd(isoToLocalInput(expiresAt));
  }, [startsAt, expiresAt]);

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

  // Позиціонування popover-а: під іконкою, із flip над нею якщо знизу немає місця.
  useLayoutEffect(() => {
    if (!open) return;
    function compute() {
      if (!btnRef.current) return;
      const rect = btnRef.current.getBoundingClientRect();
      const popH = popRef.current?.offsetHeight ?? 480;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let left = rect.left + rect.width / 2 - POP_W / 2;
      left = Math.max(8, Math.min(left, vw - POP_W - 8));
      let top = rect.bottom + 8;
      if (top + popH > vh - 8) {
        const flipped = rect.top - popH - 8;
        top = flipped >= 8 ? flipped : Math.max(8, vh - popH - 8);
      }
      setPos({ top, left });
    }
    compute();
    const raf = requestAnimationFrame(compute);
    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', compute);
      window.removeEventListener('scroll', compute, true);
    };
  }, [open, draftStart, draftEnd, activeField]);

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
    if (draftError) return;
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

  const dotColor = state === 'expired' ? 'bg-rose-400' : state === 'pending' ? 'bg-sky-400' : 'bg-amber-400';

  const activeValue = activeField === 'start' ? draftStart : draftEnd;
  const setActiveValue = (v: string) => (activeField === 'start' ? setDraftStart(v) : setDraftEnd(v));
  const activeMin = activeField === 'start' ? nowMin : (draftStart || nowMin);

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
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: POP_W, zIndex: 200 }}
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

          <div className="grid grid-cols-2 gap-2">
            <FieldChip
              id={`${fmtId}-start`}
              label="Активний з"
              value={draftStart}
              placeholder="одразу"
              dark={dark}
              active={activeField === 'start'}
              invalid={startInPast || startEndInverted}
              onSelect={() => setActiveField('start')}
              onClear={() => setDraftStart('')}
            />
            <FieldChip
              id={`${fmtId}-end`}
              label="Активний до"
              value={draftEnd}
              placeholder="без обмеження"
              dark={dark}
              active={activeField === 'end'}
              invalid={endInPast || startEndInverted}
              onSelect={() => setActiveField('end')}
              onClear={() => setDraftEnd('')}
            />
          </div>

          <InlineCalendar
            value={activeValue}
            onChange={setActiveValue}
            min={activeMin}
            disableMinDay={activeField === 'start'}
            dark={dark}
          />

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

          <div
            className={`mt-3 rounded-lg border px-3 py-2 ${
              dark
                ? 'bg-amber-400/[0.05] border-amber-400/20'
                : 'bg-amber-100/40 border-amber-500/30'
            }`}
          >
            <p
              className={`text-[9px] uppercase tracking-[0.2em] font-semibold mb-1 ${
                dark ? 'text-amber-200/70' : 'text-amber-900/70'
              }`}
            >
              Буде збережено
            </p>
            <div className="flex items-center gap-2 text-[11.5px]">
              <SummaryPart
                tag="з"
                value={draftStart ? formatChip(draftStart) : null}
                empty="одразу"
                dark={dark}
                onClear={() => setDraftStart('')}
              />
              <span className={`text-[12px] ${dark ? 'text-slate-500' : 'text-stone-400'}`}>→</span>
              <SummaryPart
                tag="до"
                value={draftEnd ? formatChip(draftEnd) : null}
                empty="без обмеження"
                dark={dark}
                onClear={() => setDraftEnd('')}
              />
            </div>
          </div>

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

function FieldChip({
  id,
  label,
  value,
  placeholder,
  dark,
  active,
  invalid,
  onSelect,
  onClear,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  dark: boolean;
  active: boolean;
  invalid: boolean;
  onSelect: () => void;
  onClear: () => void;
}) {
  const ringActive = active
    ? dark
      ? 'border-amber-400/60 bg-amber-400/[0.08]'
      : 'border-amber-500/60 bg-amber-100/60'
    : invalid
    ? dark
      ? 'border-rose-400/50 bg-rose-500/[0.06]'
      : 'border-rose-400/60 bg-rose-100/50'
    : dark
    ? 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]'
    : 'border-stone-300/60 bg-white/70 hover:bg-white';

  return (
    <div
      className={`relative rounded-lg border transition-colors ${ringActive}`}
    >
      <button
        id={id}
        type="button"
        onClick={onSelect}
        className="w-full text-left px-2.5 py-1.5"
      >
        <div className="flex items-baseline mb-0.5">
          <span
            className={`text-[10px] uppercase tracking-[0.18em] font-semibold ${
              dark ? 'text-slate-500' : 'text-stone-500'
            }`}
          >
            {label}
          </span>
        </div>
        <div
          className={`text-[12px] ${value ? 'pr-7' : ''} ${
            value
              ? dark ? 'text-slate-100' : 'text-stone-900'
              : dark ? 'text-slate-600 italic' : 'text-stone-400 italic'
          }`}
        >
          {value ? formatChip(value) : placeholder}
        </div>
      </button>
      {value && (
        <button
          type="button"
          aria-label={`Стерти «${label}»`}
          title="Стерти"
          onClick={e => {
            e.stopPropagation();
            onClear();
          }}
          className={`absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-6 h-6 rounded-full border transition-colors cursor-pointer ${
            dark
              ? 'bg-white/[0.06] border-white/[0.1] text-slate-300 hover:bg-rose-500/20 hover:border-rose-400/40 hover:text-rose-200'
              : 'bg-white/80 border-stone-300/60 text-stone-600 hover:bg-rose-100 hover:border-rose-400/60 hover:text-rose-700'
          }`}
        >
          <FaXmark className="text-[11px]" />
        </button>
      )}
    </div>
  );
}

function InlineCalendar({
  value,
  onChange,
  dark,
  min,
  disableMinDay = false,
}: {
  value: string;
  onChange: (v: string) => void;
  dark: boolean;
  min?: string;
  /// Для «Активний з» сьогодні забороняємо вибирати — користувач має вибрати
  /// наступну дату після поточної. Для «Активний до» залишаємо як було
  /// (можна закінчувати того ж дня, коли стартує).
  disableMinDay?: boolean;
}) {
  const parsed = parseDraft(value);
  const minParts = min ? parseDraft(min) : null;

  const today = new Date();
  const [view, setView] = useState<{ y: number; mo: number }>(() =>
    parsed ? { y: parsed.y, mo: parsed.mo } : { y: today.getFullYear(), mo: today.getMonth() },
  );

  // Sync view to value when value змінюється ззовні (зміна activeField).
  useEffect(() => {
    const p = parseDraft(value);
    if (p) setView({ y: p.y, mo: p.mo });
  }, [value]);

  // Дефолт часу — 07:00 (ранок), коли поле ще порожнє.
  const DEFAULT_H = 7;
  const DEFAULT_MI = 0;
  const h = parsed?.h ?? DEFAULT_H;
  const mi = parsed?.mi ?? DEFAULT_MI;

  function pickDate(y: number, mo: number, d: number) {
    if (parsed) {
      onChange(combineDraft({ y, mo, d, h: parsed.h, mi: parsed.mi }));
    } else {
      onChange(combineDraft({ y, mo, d, h: DEFAULT_H, mi: DEFAULT_MI }));
    }
  }
  function pickTime(newH: number, newMi: number) {
    if (parsed) {
      onChange(combineDraft({ ...parsed, h: newH, mi: newMi }));
    } else {
      const t = new Date();
      onChange(combineDraft({ y: t.getFullYear(), mo: t.getMonth(), d: t.getDate(), h: newH, mi: newMi }));
    }
  }

  function pickNow() {
    const t = new Date();
    onChange(combineDraft({ y: t.getFullYear(), mo: t.getMonth(), d: t.getDate(), h: t.getHours(), mi: t.getMinutes() }));
    setView({ y: t.getFullYear(), mo: t.getMonth() });
  }

  const monthName = new Date(view.y, view.mo, 1).toLocaleString('uk-UA', { month: 'long', year: 'numeric' });
  const firstWeekday = (new Date(view.y, view.mo, 1).getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(view.y, view.mo + 1, 0).getDate();
  const prevDays = new Date(view.y, view.mo, 0).getDate();

  type Cell = { y: number; mo: number; d: number; outside: boolean };
  const cells: Cell[] = [];
  for (let i = firstWeekday - 1; i >= 0; i--) {
    const d = prevDays - i;
    const mo = view.mo === 0 ? 11 : view.mo - 1;
    const y = view.mo === 0 ? view.y - 1 : view.y;
    cells.push({ y, mo, d, outside: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ y: view.y, mo: view.mo, d, outside: false });
  }
  while (cells.length < 42) {
    const last = cells[cells.length - 1];
    const next = new Date(last.y, last.mo, last.d + 1);
    cells.push({
      y: next.getFullYear(),
      mo: next.getMonth(),
      d: next.getDate(),
      outside: next.getMonth() !== view.mo,
    });
  }

  function isBeforeMin(y: number, mo: number, d: number): boolean {
    if (!minParts) return false;
    if (y !== minParts.y) return y < minParts.y;
    if (mo !== minParts.mo) return mo < minParts.mo;
    return disableMinDay ? d <= minParts.d : d < minParts.d;
  }
  const isSelected = (y: number, mo: number, d: number) =>
    !!parsed && parsed.y === y && parsed.mo === mo && parsed.d === d;

  return (
    <div
      className={`mt-3 rounded-lg border p-2.5 ${
        dark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-white/40 border-stone-300/40'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          aria-label="Попередній місяць"
          onClick={() =>
            setView(v => (v.mo === 0 ? { y: v.y - 1, mo: 11 } : { y: v.y, mo: v.mo - 1 }))
          }
          className={`w-7 h-7 inline-flex items-center justify-center rounded text-[14px] leading-none ${
            dark ? 'text-slate-300 hover:bg-white/[0.06]' : 'text-stone-600 hover:bg-stone-200/60'
          }`}
        >
          ‹
        </button>
        <span
          className={`text-[12px] font-medium capitalize ${dark ? 'text-slate-200' : 'text-stone-800'}`}
        >
          {monthName}
        </span>
        <button
          type="button"
          aria-label="Наступний місяць"
          onClick={() =>
            setView(v => (v.mo === 11 ? { y: v.y + 1, mo: 0 } : { y: v.y, mo: v.mo + 1 }))
          }
          className={`w-7 h-7 inline-flex items-center justify-center rounded text-[14px] leading-none ${
            dark ? 'text-slate-300 hover:bg-white/[0.06]' : 'text-stone-600 hover:bg-stone-200/60'
          }`}
        >
          ›
        </button>
      </div>

      <div
        className={`grid grid-cols-7 gap-0.5 mb-1 text-[9px] uppercase tracking-wider text-center ${
          dark ? 'text-slate-600' : 'text-stone-400'
        }`}
      >
        {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map(d => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((c, i) => {
          const disabled = isBeforeMin(c.y, c.mo, c.d);
          const sel = isSelected(c.y, c.mo, c.d);
          const cls = sel
            ? dark
              ? 'bg-emerald-500/90 text-white font-semibold shadow-[0_0_10px_-2px_rgba(16,185,129,0.5)]'
              : 'bg-emerald-600 text-white font-semibold shadow-[0_0_10px_-2px_rgba(5,150,105,0.4)]'
            : disabled
            ? dark
              ? 'text-slate-700 cursor-not-allowed'
              : 'text-stone-300 cursor-not-allowed'
            : c.outside
            ? dark
              ? 'text-slate-600 hover:bg-white/[0.04]'
              : 'text-stone-400 hover:bg-stone-200/40'
            : dark
            ? 'text-slate-200 hover:bg-white/[0.06]'
            : 'text-stone-800 hover:bg-stone-200/50';
          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => pickDate(c.y, c.mo, c.d)}
              className={`h-7 text-[11px] rounded transition-colors ${cls}`}
            >
              {c.d}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 mt-3">
        <span
          className={`text-[10px] uppercase tracking-[0.18em] font-semibold ${
            dark ? 'text-slate-500' : 'text-stone-500'
          }`}
        >
          Час
        </span>
        <input
          type="number"
          min={0}
          max={23}
          value={pad(h)}
          onChange={e => {
            const v = Math.max(0, Math.min(23, Number(e.target.value) || 0));
            pickTime(v, mi);
          }}
          className={`w-12 px-2 py-1 text-[12px] text-center rounded border focus:outline-none focus:ring-2 ${
            dark
              ? 'bg-white/[0.04] border-white/[0.08] text-slate-100 focus:ring-amber-400/40'
              : 'bg-white/80 border-stone-300/60 text-stone-900 focus:ring-amber-500/40'
          }`}
        />
        <span className={dark ? 'text-slate-500' : 'text-stone-500'}>:</span>
        <input
          type="number"
          min={0}
          max={59}
          value={pad(mi)}
          onChange={e => {
            const v = Math.max(0, Math.min(59, Number(e.target.value) || 0));
            pickTime(h, v);
          }}
          className={`w-12 px-2 py-1 text-[12px] text-center rounded border focus:outline-none focus:ring-2 ${
            dark
              ? 'bg-white/[0.04] border-white/[0.08] text-slate-100 focus:ring-amber-400/40'
              : 'bg-white/80 border-stone-300/60 text-stone-900 focus:ring-amber-500/40'
          }`}
        />
        <div className="flex-1" />
        {!disableMinDay && (
          <button
            type="button"
            onClick={pickNow}
            className={`text-[10.5px] font-medium px-2 py-1 rounded border transition-colors ${
              dark
                ? 'bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.08]'
                : 'bg-white/70 border-stone-300/60 text-stone-700 hover:bg-white'
            }`}
          >
            Зараз
          </button>
        )}
      </div>
    </div>
  );
}

function SummaryPart({
  tag,
  value,
  empty,
  dark,
  onClear,
}: {
  tag: string;
  value: string | null;
  empty: string;
  dark: boolean;
  onClear: () => void;
}) {
  const filled = !!value;
  // Хover-стилі з'являються тільки коли є що стирати; для empty стану — кнопка disabled-вигляду.
  return (
    <div className="flex items-center gap-1.5 flex-1 min-w-0">
      <button
        type="button"
        onClick={filled ? onClear : undefined}
        disabled={!filled}
        title={filled ? 'Стерти' : undefined}
        aria-label={filled ? `Стерти «${tag}»` : undefined}
        className={`group inline-flex items-center justify-center w-4 h-4 rounded-full flex-shrink-0 text-[9px] font-bold leading-none transition-colors ${
          filled
            ? dark
              ? 'bg-emerald-500/90 text-white hover:bg-rose-500/90'
              : 'bg-emerald-600 text-white hover:bg-rose-600'
            : dark
            ? 'bg-white/[0.06] text-slate-600 border border-white/[0.08] cursor-default'
            : 'bg-white/60 text-stone-400 border border-stone-300/60 cursor-default'
        }`}
      >
        {filled ? (
          <>
            <span className="group-hover:hidden">✓</span>
            <span className="hidden group-hover:inline">✕</span>
          </>
        ) : (
          '○'
        )}
      </button>
      <span
        className={`text-[9px] uppercase tracking-wider font-semibold flex-shrink-0 ${
          dark ? 'text-amber-200/70' : 'text-amber-900/70'
        }`}
      >
        {tag}
      </span>
      <span
        className={`truncate ${
          filled
            ? dark
              ? 'text-slate-100 font-medium'
              : 'text-stone-900 font-medium'
            : dark
            ? 'text-slate-500 italic'
            : 'text-stone-500 italic'
        }`}
      >
        {value ?? empty}
      </span>
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
