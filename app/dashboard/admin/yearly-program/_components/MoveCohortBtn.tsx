'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { HiOutlineArrowRightCircle } from 'react-icons/hi2';
import type { Theme } from '../../_components/adminTheme';
import type { Row, CohortListItem } from './types';
import { HoverInfo } from './UIFeedback';

/// Кнопка "Перенести в інший запуск" для рядка підписки. Доступно тільки якщо поточний
/// cohort підписки ще НЕ запущений. При натисненні відкривається select зі списком
/// доступних cohort-ів (теж не-запущених).
export default function MoveCohortBtn({
  theme,
  row,
  disabled,
}: {
  theme: Theme;
  row: Row;
  disabled?: boolean;
}) {
  const dark = theme === 'dark';
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cohorts, setCohorts] = useState<CohortListItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  async function loadCohorts() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch('/api/admin/yearly-program/cohorts');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Помилка');
      setCohorts(data.cohorts);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function move(cohortId: string) {
    if (cohortId === row.cohortId) {
      setOpen(false);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/yearly-program/${row.id}/move-cohort`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cohortId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? 'Помилка');
        return;
      }
      setOpen(false);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function openModal() {
    setOpen(true);
    if (!cohorts) void loadCohorts();
  }

  return (
    <>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={openModal}
          disabled={disabled}
          className={`px-3 py-1.5 text-[11px] font-medium rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-left flex items-center gap-2 ${
            dark
              ? 'bg-white/[0.04] border-white/[0.1] text-slate-300 hover:bg-white/[0.08]'
              : 'bg-white/70 border-stone-300/60 text-stone-700 hover:bg-white'
          }`}
        >
          <HiOutlineArrowRightCircle className="text-base" />
          Перенести в інший запуск
        </button>
        <HoverInfo
          theme={theme}
          title="Коли можна переносити"
          body={'Тільки до натискання 🚀 Запустити програму на cohort-і.\n\nПісля запуску підписка прив\'язується до доступу в SendPulse — перенос вже не безпечний.\n\nПри переносі "Доступ до" автоматично перерахується для нового запуску.'}
          side="top"
          align="start"
        />
      </div>
      {mounted && open && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className={`relative max-w-md w-full rounded-2xl shadow-2xl ${
            dark ? 'bg-zinc-900 border border-white/10 text-slate-200' : 'bg-white border border-stone-200 text-stone-800'
          }`}>
            <div className={`flex items-center justify-between px-5 py-3 border-b ${dark ? 'border-white/10' : 'border-stone-200'}`}>
              <h3 className="text-base font-bold">Перенести підписку в інший запуск</h3>
              <button onClick={() => setOpen(false)} className={`w-7 h-7 rounded-full flex items-center justify-center ${dark ? 'hover:bg-white/10' : 'hover:bg-stone-100'}`}>✕</button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className={`text-[12px] ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
                Поточний запуск: <span className="font-semibold">{row.cohortName ?? '— без запуску —'}</span>
              </div>
              {loading && <div className={`text-[12px] ${dark ? 'text-slate-500' : 'text-stone-500'}`}>Завантажую…</div>}
              {cohorts && (
                <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                  {cohorts
                    .filter((c) => !c.launchedAt)
                    .map((c) => {
                      const isCurrent = c.id === row.cohortId;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          disabled={busy || isCurrent}
                          onClick={() => move(c.id)}
                          className={`w-full text-left px-3 py-2 rounded-lg border text-[13px] transition-colors disabled:opacity-50 ${
                            isCurrent
                              ? dark ? 'bg-amber-400/10 border-amber-400/30 text-amber-200 cursor-default' : 'bg-amber-50 border-amber-300/60 text-amber-900 cursor-default'
                              : dark ? 'bg-white/[0.04] border-white/[0.08] text-slate-200 hover:bg-white/[0.08]' : 'bg-white border-stone-300/60 text-stone-800 hover:bg-stone-50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-medium">{c.name}</div>
                            {isCurrent && <span className="text-[10px] uppercase tracking-wider">Поточний</span>}
                          </div>
                          <div className={`text-[11px] mt-0.5 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                            {fmtShort(c.startDate)} — {fmtShort(c.endDate)}
                          </div>
                        </button>
                      );
                    })}
                  {cohorts.filter((c) => !c.launchedAt).length === 0 && (
                    <div className={`px-3 py-3 text-[12px] text-center ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                      Немає не-запущених запусків. Створіть новий.
                    </div>
                  )}
                </div>
              )}
              {err && (
                <div className={`px-3 py-2 rounded-lg text-[12px] ${dark ? 'bg-rose-500/10 text-rose-300 border border-rose-400/20' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
                  {err}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function fmtShort(iso: string): string {
  return new Intl.DateTimeFormat('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));
}
