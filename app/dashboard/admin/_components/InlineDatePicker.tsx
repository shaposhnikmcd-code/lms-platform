'use client';

import { useEffect, useState } from 'react';
import type { Theme } from './adminTheme';

/**
 * Date-only календар. Працює з рядком формату `YYYY-MM-DD` (UA-нейтральний,
 * без TZ — означає календарну дату в Київ-зоні з боку backend-а).
 *
 * Чому окремий від `InlineDateTimePicker`: для публікації сторінки /news
 * менеджеру потрібна тільки дата, час фіксований (06:00 Київ).
 * Окремий компонент = простіший UI без шуму time-інпутів.
 */

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const pad = (n: number) => String(n).padStart(2, '0');

export function isoDateToDateStr(iso: string | null): string {
  if (!iso) return '';
  const m = iso.match(DATE_RE);
  return m ? iso : '';
}

export function formatDateChip(s: string): string {
  const m = s.match(DATE_RE);
  if (!m) return '';
  return `${m[3]}.${m[2]}.${m[1]}`;
}

interface Parts {
  y: number;
  mo: number; // 0-based
  d: number;
}

function parseDate(s: string): Parts | null {
  const m = s.match(DATE_RE);
  if (!m) return null;
  return { y: +m[1], mo: +m[2] - 1, d: +m[3] };
}

function combine(p: Parts): string {
  return `${p.y}-${pad(p.mo + 1)}-${pad(p.d)}`;
}

interface Props {
  /** "YYYY-MM-DD" або порожній рядок */
  value: string;
  onChange: (v: string) => void;
  theme: Theme;
  /** Мінімальна дозволена дата (включно), формат "YYYY-MM-DD" */
  min?: string;
  /** Компактний варіант — менші клітинки/шрифти (для попапів). */
  dense?: boolean;
}

export default function InlineDatePicker({ value, onChange, theme, min, dense }: Props) {
  const dark = theme === 'dark';
  const cellH = dense ? 'h-6' : 'h-7';
  const cellText = dense ? 'text-[10px]' : 'text-[11px]';
  const parsed = parseDate(value);
  const minParts = min ? parseDate(min) : null;

  const today = new Date();
  const [view, setView] = useState<{ y: number; mo: number }>(() =>
    parsed
      ? { y: parsed.y, mo: parsed.mo }
      : minParts
        ? { y: minParts.y, mo: minParts.mo }
        : { y: today.getFullYear(), mo: today.getMonth() },
  );

  useEffect(() => {
    const p = parseDate(value);
    if (p) setView({ y: p.y, mo: p.mo });
  }, [value]);

  function pickDate(y: number, mo: number, d: number) {
    onChange(combine({ y, mo, d }));
  }

  const monthName = new Date(view.y, view.mo, 1).toLocaleString('uk-UA', {
    month: 'long',
    year: 'numeric',
  });
  const firstWeekday = (new Date(view.y, view.mo, 1).getDay() + 6) % 7;
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
    return d < minParts.d;
  }
  const isSelected = (y: number, mo: number, d: number) =>
    !!parsed && parsed.y === y && parsed.mo === mo && parsed.d === d;
  const isToday = (y: number, mo: number, d: number) =>
    today.getFullYear() === y && today.getMonth() === mo && today.getDate() === d;

  return (
    <div
      className={`rounded-lg border ${dense ? 'p-2' : 'p-2.5'} ${
        dark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-white/40 border-stone-300/40'
      }`}
    >
      <div className={`flex items-center justify-between ${dense ? 'mb-1.5' : 'mb-2'}`}>
        <button
          type="button"
          aria-label="Попередній місяць"
          onClick={() =>
            setView(v => (v.mo === 0 ? { y: v.y - 1, mo: 11 } : { y: v.y, mo: v.mo - 1 }))
          }
          className={`${dense ? 'w-6 h-6 text-[13px]' : 'w-7 h-7 text-[14px]'} inline-flex items-center justify-center rounded leading-none ${
            dark ? 'text-slate-300 hover:bg-white/[0.06]' : 'text-stone-600 hover:bg-stone-200/60'
          }`}
        >
          ‹
        </button>
        <span className={`${dense ? 'text-[11px]' : 'text-[12px]'} font-medium capitalize ${dark ? 'text-slate-200' : 'text-stone-800'}`}>
          {monthName}
        </span>
        <button
          type="button"
          aria-label="Наступний місяць"
          onClick={() =>
            setView(v => (v.mo === 11 ? { y: v.y + 1, mo: 0 } : { y: v.y, mo: v.mo + 1 }))
          }
          className={`${dense ? 'w-6 h-6 text-[13px]' : 'w-7 h-7 text-[14px]'} inline-flex items-center justify-center rounded leading-none ${
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
          const tod = isToday(c.y, c.mo, c.d);
          const cls = sel
            ? dark
              ? 'bg-amber-400/90 text-stone-900 font-semibold shadow-[0_0_10px_-2px_rgba(251,191,36,0.5)]'
              : 'bg-amber-500 text-white font-semibold shadow-[0_0_10px_-2px_rgba(180,83,9,0.4)]'
            : disabled
              ? dark
                ? 'text-slate-700 cursor-not-allowed'
                : 'text-stone-300 cursor-not-allowed'
              : c.outside
                ? dark
                  ? 'text-slate-600 hover:bg-white/[0.04]'
                  : 'text-stone-400 hover:bg-stone-200/40'
                : tod
                  ? dark
                    ? 'text-amber-300 ring-1 ring-amber-400/40 hover:bg-white/[0.06]'
                    : 'text-amber-700 ring-1 ring-amber-500/40 hover:bg-amber-50'
                  : dark
                    ? 'text-slate-200 hover:bg-white/[0.06]'
                    : 'text-stone-800 hover:bg-stone-200/50';
          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => pickDate(c.y, c.mo, c.d)}
              className={`${cellH} ${cellText} rounded transition-colors ${cls}`}
            >
              {c.d}
            </button>
          );
        })}
      </div>
    </div>
  );
}
