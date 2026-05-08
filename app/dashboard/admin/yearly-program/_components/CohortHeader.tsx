'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { HiOutlineSparkles, HiOutlinePlus, HiOutlineChevronDown, HiOutlineCheck, HiOutlineRocketLaunch, HiOutlineStar, HiOutlinePencilSquare, HiOutlineXMark } from 'react-icons/hi2';
import type { Theme } from '../../_components/adminTheme';
import type { CohortListItem } from './types';
import { useUIFeedback } from './UIFeedback';

/// Шапка зі списком cohort-ів — селектор + "+ Новий запуск".
/// Назва обраного cohort-у показується великим заголовком.
export default function CohortHeader({
  cohorts,
  activeCohortId,
  onSelect,
  onCreate,
  theme,
  rightSlot,
}: {
  cohorts: CohortListItem[];
  activeCohortId: string | null;
  onSelect: (id: string | null) => void;
  onCreate: () => void;
  theme: Theme;
  /// Додаткові кнопки/контроли праворуч від "+ Новий запуск" (program-level налаштування).
  rightSlot?: React.ReactNode;
}) {
  const dark = theme === 'dark';
  const router = useRouter();
  const { confirm, toast } = useUIFeedback();
  const [open, setOpen] = useState(false);
  const [makingCurrentId, setMakingCurrentId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Закрити дропдаун при кліку поза ним або по Escape — стандартний патерн.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent | TouchEvent) {
      const target = e.target as Node | null;
      if (dropdownRef.current && target && !dropdownRef.current.contains(target)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);
  const active = cohorts.find((c) => c.id === activeCohortId) ?? null;
  const currentCohort = cohorts.find((c) => c.isCurrent) ?? null;
  const canRenameActive = !!active && !active.launchedAt;

  useEffect(() => {
    if (editingName) {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }
  }, [editingName]);

  // Якщо обраний cohort змінився чи був запущений — виходимо з режиму редагування.
  useEffect(() => {
    if (!canRenameActive && editingName) setEditingName(false);
  }, [canRenameActive, editingName]);

  async function handleSaveName() {
    if (!active) return;
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      toast('error', 'Назва не може бути порожньою');
      return;
    }
    if (trimmed === active.name) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    try {
      const res = await fetch(`/api/admin/yearly-program/cohorts/${active.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast('error', data.error ?? `Помилка ${res.status}`);
        return;
      }
      toast('success', 'Назву оновлено');
      setEditingName(false);
      router.refresh();
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setSavingName(false);
    }
  }

  async function handleMakeCurrent(cohort: CohortListItem) {
    const ok = await confirm({
      title: `Зробити "${cohort.name}" поточним запуском?`,
      description: 'Усі нові оплати з цього моменту потраплятимуть саме в цей запуск.',
      bullets: currentCohort
        ? [
            { icon: '➡️', text: `Поточним стане: ${cohort.name}` },
            { icon: '⏸', text: `Перестане бути поточним: ${currentCohort.name}` },
            { icon: 'ℹ️', text: 'Існуючі підписки залишаться в своїх запусках — переноситься лише прапорець isCurrent.' },
          ]
        : [
            { icon: '➡️', text: `Поточним стане: ${cohort.name}` },
            { icon: 'ℹ️', text: 'Існуючі підписки залишаться в своїх запусках — переноситься лише прапорець isCurrent.' },
          ],
      confirmLabel: 'Зробити поточним',
    });
    if (!ok) return;
    setMakingCurrentId(cohort.id);
    try {
      const res = await fetch(`/api/admin/yearly-program/cohorts/${cohort.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ makeCurrent: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast('error', data.error ?? `Помилка ${res.status}`);
        return;
      }
      toast('success', `"${cohort.name}" — поточний запуск`);
      // Переключаємо view на свіжий поточний — інакше менеджер бачив би попередній
      // обраний cohort, що плутає («зробив поточним, а на екрані старий»).
      onSelect(cohort.id);
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setMakingCurrentId(null);
    }
  }

  if (cohorts.length === 0) {
    return (
      <div className={`mb-6 rounded-2xl border px-6 py-10 text-center ${
        dark
          ? 'bg-gradient-to-br from-amber-400/[0.04] to-white/[0.02] border-amber-400/20'
          : 'bg-gradient-to-br from-amber-50/60 to-white border-amber-200/60 shadow-[0_1px_2px_rgba(68,64,60,0.04)]'
      }`}>
        <div className={`inline-flex items-center justify-center w-14 h-14 rounded-full mb-3 ${
          dark ? 'bg-amber-400/15 text-amber-300 border border-amber-400/30' : 'bg-amber-100 text-amber-700 border border-amber-300/60'
        }`}>
          <HiOutlineRocketLaunch className="text-2xl" />
        </div>
        <h2 className={`text-[18px] font-bold mb-1.5 ${dark ? 'text-white' : 'text-stone-900'}`}>
          Створи перший запуск Річної програми
        </h2>
        <p className={`text-[13px] max-w-md mx-auto mb-5 leading-relaxed ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
          Запуск (cohort) — це навчальна когорта з фіксованими датами старту й завершення.
          Усі нові оплати потраплятимуть у поточний запуск.
        </p>
        <button
          type="button"
          onClick={onCreate}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-[14px] font-semibold border transition-colors ${
            dark
              ? 'bg-gradient-to-br from-amber-400/20 to-amber-500/30 border-amber-400/40 text-amber-100 hover:from-amber-400/30 hover:to-amber-500/40 shadow-[0_0_20px_rgba(212,168,67,0.15)]'
              : 'bg-gradient-to-br from-amber-300 to-amber-400 border-amber-400/60 text-amber-950 hover:from-amber-400 hover:to-amber-500 shadow-[0_4px_14px_rgba(212,168,67,0.30)]'
          }`}
        >
          <HiOutlinePlus />
          Створити перший запуск
        </button>
      </div>
    );
  }

  return (
    <div className="overflow-visible">
      <div className="flex items-stretch flex-wrap">
        <div className="flex-1 px-5 py-4 min-w-[280px]">
          <div className={`text-[10px] uppercase tracking-[0.18em] font-medium mb-1 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
            Запуск програми
          </div>
          <div ref={dropdownRef} className="flex items-center gap-3 flex-wrap relative">
            {editingName && active ? (
              <div className="flex items-center gap-2">
                <input
                  ref={nameInputRef}
                  type="text"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSaveName();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      setEditingName(false);
                    }
                  }}
                  disabled={savingName}
                  maxLength={120}
                  className={`text-[18px] font-semibold leading-tight rounded-lg px-2 py-1 -ml-2 border outline-none transition-colors min-w-[280px] max-w-[460px] ${
                    dark
                      ? 'bg-zinc-900 border-amber-400/40 text-white focus:border-amber-300'
                      : 'bg-white border-amber-300 text-stone-900 focus:border-amber-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={handleSaveName}
                  disabled={savingName}
                  title="Зберегти назву (Enter)"
                  className={`inline-flex items-center justify-center w-8 h-8 rounded-md border transition-colors disabled:opacity-50 ${
                    dark
                      ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-200 hover:bg-emerald-500/25'
                      : 'bg-emerald-50 border-emerald-300/60 text-emerald-800 hover:bg-emerald-100'
                  }`}
                >
                  <HiOutlineCheck />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingName(false)}
                  disabled={savingName}
                  title="Скасувати (Esc)"
                  className={`inline-flex items-center justify-center w-8 h-8 rounded-md border transition-colors disabled:opacity-50 ${
                    dark
                      ? 'bg-white/[0.04] border-white/10 text-slate-300 hover:bg-white/[0.08]'
                      : 'bg-stone-100 border-stone-300 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  <HiOutlineXMark />
                </button>
              </div>
            ) : (
              <>
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
                {canRenameActive && active && (
                  <button
                    type="button"
                    onClick={() => {
                      setNameDraft(active.name);
                      setEditingName(true);
                    }}
                    title="Перейменувати запуск"
                    className={`inline-flex items-center justify-center w-7 h-7 rounded-md border transition-colors ${
                      dark
                        ? 'bg-white/[0.04] border-white/10 text-slate-300 hover:bg-white/[0.08] hover:text-amber-200'
                        : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100 hover:text-amber-700'
                    }`}
                  >
                    <HiOutlinePencilSquare className="text-[14px]" />
                  </button>
                )}
              </>
            )}
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
              className={`absolute left-0 top-full z-30 mt-2 max-h-[420px] overflow-y-auto rounded-lg border min-w-[400px] shadow-2xl ${
                dark ? 'bg-zinc-900 border-white/10' : 'bg-white border-stone-200'
              }`}
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
                  <div
                    key={c.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      onSelect(c.id);
                      setOpen(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelect(c.id);
                        setOpen(false);
                      }
                    }}
                    className={`w-full px-3 py-2 text-left flex items-start justify-between gap-3 text-[13px] transition-colors cursor-pointer ${
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
                    <div className="shrink-0 flex items-center gap-2 mt-0.5">
                      {!c.isCurrent && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMakeCurrent(c);
                          }}
                          disabled={makingCurrentId === c.id}
                          title="Зробити цей запуск поточним — нові оплати потраплятимуть сюди"
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10.5px] font-semibold border transition-colors disabled:opacity-50 ${
                            dark
                              ? 'bg-emerald-500/10 border-emerald-400/30 text-emerald-200 hover:bg-emerald-500/20'
                              : 'bg-emerald-50 border-emerald-300/60 text-emerald-800 hover:bg-emerald-100'
                          }`}
                        >
                          <HiOutlineStar className="text-[12px]" />
                          {makingCurrentId === c.id ? 'Роблю…' : 'Зробити поточним'}
                        </button>
                      )}
                      {c.id === activeCohortId && <HiOutlineCheck className="mt-0.5" />}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 px-5 py-4 flex-wrap">
          {rightSlot}
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
