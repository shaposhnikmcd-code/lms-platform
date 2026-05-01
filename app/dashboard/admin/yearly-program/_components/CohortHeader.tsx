'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { HiOutlineSparkles, HiOutlinePlus, HiOutlineChevronDown, HiOutlineCheck } from 'react-icons/hi2';
import type { Theme } from '../../_components/adminTheme';
import type { CohortListItem } from './types';

/// Шапка зі списком cohort-ів — селектор + "+ Новий запуск".
/// Назва обраного cohort-у показується великим заголовком.
export default function CohortHeader({
  cohorts,
  activeCohortId,
  onSelect,
  onCreate,
  theme,
}: {
  cohorts: CohortListItem[];
  activeCohortId: string | null;
  onSelect: (id: string | null) => void;
  onCreate: () => void;
  theme: Theme;
}) {
  const dark = theme === 'dark';
  const [open, setOpen] = useState(false);
  const active = cohorts.find((c) => c.id === activeCohortId) ?? null;

  return (
    <div className={`mb-6 rounded-2xl border overflow-hidden ${
      dark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white/55 border-stone-300/50 shadow-[0_1px_2px_rgba(68,64,60,0.04)]'
    }`}>
      <div className="flex items-stretch flex-wrap">
        <div className="flex-1 px-5 py-4 min-w-[280px]">
          <div className={`text-[10px] uppercase tracking-[0.18em] font-medium mb-1 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
            Запуск програми
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className={`inline-flex items-center gap-2 text-[18px] font-semibold leading-tight rounded-lg px-2 py-1 -ml-2 transition-colors ${
                dark ? 'text-white hover:bg-white/[0.06]' : 'text-stone-900 hover:bg-stone-100/80'
              }`}
            >
              <span className="truncate max-w-[420px]">{active?.name ?? (activeCohortId === null ? 'Усі підписки' : '— оберіть запуск —')}</span>
              <HiOutlineChevronDown className={`text-base transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {active && (
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                active.isCurrent
                  ? dark ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/20' : 'bg-emerald-100 text-emerald-800 border border-emerald-300/50'
                  : active.launchedAt
                    ? dark ? 'bg-amber-500/15 text-amber-300 border border-amber-400/20' : 'bg-amber-100 text-amber-800 border border-amber-300/50'
                    : dark ? 'bg-slate-500/15 text-slate-400 border border-slate-400/20' : 'bg-stone-200 text-stone-600 border border-stone-300/50'
              }`}>
                {active.isCurrent ? 'Поточний' : active.launchedAt ? 'Запущено' : 'Заплановано'}
              </span>
            )}
            {active && (
              <span className={`text-[12px] tabular-nums ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
                {fmtDate(active.startDate)} — {fmtDate(active.endDate)} · підписок: {active.subscriptionsCount}
              </span>
            )}
          </div>

          {open && (
            <div
              className={`absolute z-30 mt-2 max-h-[420px] overflow-y-auto rounded-lg border min-w-[400px] shadow-2xl ${
                dark ? 'bg-zinc-900 border-white/10' : 'bg-white border-stone-200'
              }`}
              onMouseLeave={() => setOpen(false)}
            >
              <button
                type="button"
                onClick={() => {
                  onSelect(null);
                  setOpen(false);
                }}
                className={`w-full px-3 py-2 text-left flex items-center justify-between gap-3 text-[13px] transition-colors ${
                  activeCohortId === null
                    ? dark ? 'bg-amber-400/10 text-amber-200' : 'bg-amber-50 text-amber-900'
                    : dark ? 'hover:bg-white/[0.06] text-slate-200' : 'hover:bg-stone-100 text-stone-800'
                }`}
              >
                <span>Усі підписки</span>
                {activeCohortId === null && <HiOutlineCheck />}
              </button>
              <div className={`h-px ${dark ? 'bg-white/[0.05]' : 'bg-stone-200'}`} />
              {cohorts.length === 0 ? (
                <div className={`px-3 py-3 text-[12px] ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                  Запусків ще немає. Натисни "+ Новий запуск" щоб створити перший.
                </div>
              ) : (
                cohorts.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      onSelect(c.id);
                      setOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left flex items-start justify-between gap-3 text-[13px] transition-colors ${
                      c.id === activeCohortId
                        ? dark ? 'bg-amber-400/10 text-amber-200' : 'bg-amber-50 text-amber-900'
                        : dark ? 'hover:bg-white/[0.06] text-slate-200' : 'hover:bg-stone-100 text-stone-800'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{c.name}</div>
                      <div className={`text-[11px] mt-0.5 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                        {fmtDate(c.startDate)} — {fmtDate(c.endDate)} · {c.subscriptionsCount} підписок
                        {c.isCurrent && <span className={`ml-2 ${dark ? 'text-emerald-300' : 'text-emerald-700'}`}>· поточний</span>}
                        {c.launchedAt && !c.isCurrent && <span className={`ml-2 ${dark ? 'text-amber-300' : 'text-amber-700'}`}>· запущено</span>}
                      </div>
                    </div>
                    {c.id === activeCohortId && <HiOutlineCheck className="mt-1" />}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 px-5 py-4">
          <button
            type="button"
            onClick={onCreate}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-colors ${
              dark
                ? 'bg-amber-400/15 text-amber-200 border border-amber-400/30 hover:bg-amber-400/20'
                : 'bg-amber-100 text-amber-900 border border-amber-300/60 hover:bg-amber-200'
            }`}
          >
            <HiOutlinePlus />
            Новий запуск
          </button>
        </div>
      </div>
    </div>
  );
}

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));
}

export { fmtDate as fmtCohortDate };
