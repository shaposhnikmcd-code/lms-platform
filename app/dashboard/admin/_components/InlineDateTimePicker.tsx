'use client';

import { useEffect, useState } from 'react';
import type { Theme } from './adminTheme';

/// Reusable inline calendar + HH:MM picker for admin modals.
/// Value формату `YYYY-MM-DDTHH:mm` у локальному часі (Київ).
/// Empty string означає «не задано» — у багатьох сценаріях це валідно (e.g. resume = miti).

type Parts = { y: number; mo: number; d: number; h: number; mi: number };

const pad = (n: number) => String(n).padStart(2, '0');

export function isoToLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function nowLocalInput(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function localInputToIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function formatLocalChip(s: string): string {
  const p = parseDraft(s);
  if (!p) return '';
  return `${pad(p.d)}.${pad(p.mo + 1)}.${p.y} ${pad(p.h)}:${pad(p.mi)}`;
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

interface Props {
  value: string;
  onChange: (v: string) => void;
  theme: Theme;
  /// Заборонити вибір дат раніше за `min` (формат YYYY-MM-DDTHH:mm).
  min?: string;
  /// Час, який ставиться при першому виборі дати, коли value було порожнім.
  defaultHour?: number;
  defaultMinute?: number;
  /// Показувати кнопку "Зараз" (default true).
  showNowButton?: boolean;
}

export default function InlineDateTimePicker({
  value,
  onChange,
  theme,
  min,
  defaultHour = 7,
  defaultMinute = 0,
  showNowButton = true,
}: Props) {
  const dark = theme === 'dark';
  const parsed = parseDraft(value);
  const minParts = min ? parseDraft(min) : null;

  const today = new Date();
  const [view, setView] = useState<{ y: number; mo: number }>(() =>
    parsed ? { y: parsed.y, mo: parsed.mo } : { y: today.getFullYear(), mo: today.getMonth() },
  );

  useEffect(() => {
    const p = parseDraft(value);
    if (p) setView({ y: p.y, mo: p.mo });
  }, [value]);

  const h = parsed?.h ?? defaultHour;
  const mi = parsed?.mi ?? defaultMinute;

  function pickDate(y: number, mo: number, d: number) {
    if (parsed) {
      onChange(combineDraft({ y, mo, d, h: parsed.h, mi: parsed.mi }));
    } else {
      onChange(combineDraft({ y, mo, d, h: defaultHour, mi: defaultMinute }));
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
      className={`rounded-lg border p-2.5 ${
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
          const tod = isToday(c.y, c.mo, c.d);
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
        {showNowButton && (
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
