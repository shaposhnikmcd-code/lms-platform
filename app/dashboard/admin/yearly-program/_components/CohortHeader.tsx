'use client';

import { forwardRef, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { HiOutlineSparkles, HiOutlinePlus, HiOutlineChevronDown, HiOutlineCheck, HiOutlineRocketLaunch, HiOutlineStar, HiOutlinePencilSquare, HiOutlineXMark, HiOutlineCalendarDays, HiOutlineExclamationTriangle } from 'react-icons/hi2';
import type { Theme } from '../../_components/adminTheme';
import type { CohortListItem } from './types';
import { useUIFeedback, HoverInfo } from './UIFeedback';
import InlineDatePicker, { formatDateChip } from '../../_components/InlineDatePicker';
import { addCalendarMonths } from '@/lib/yearlyProgramAccess';

/// Межі поля «Надати доступ до» — дзеркалять YEARLY_POST_ACCESS_MIN/MAX_MONTHS на сервері
/// (валідація там же, у PATCH /api/admin/yearly-program/settings).
const ACCESS_MIN_MONTHS = 0;
const ACCESS_MAX_MONTHS = 24;

/// Шапка зі списком cohort-ів — селектор + "+ Новий запуск".
/// Назва обраного cohort-у показується великим заголовком.
export default function CohortHeader({
  cohorts,
  activeCohortId,
  onSelect,
  onCreate,
  theme,
  postAccessMonths,
  accessEditing,
  onAccessEditingChange,
  rightSlot,
}: {
  cohorts: CohortListItem[];
  activeCohortId: string | null;
  onSelect: (id: string | null) => void;
  onCreate: () => void;
  theme: Theme;
  /// Скільки місяців доступу до матеріалів надається ПІСЛЯ завершення програми
  /// (AppSetting `yearlyPostAccessMonths`, спільне для всіх наборів).
  postAccessMonths: number;
  /// Редактор «Надати доступ до» — керується ззовні, щоб плашка в панелі налаштувань
  /// відкривала рівно цей самий інлайн-редактор, а не другий паралельний UI.
  accessEditing: boolean;
  onAccessEditingChange: (v: boolean) => void;
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
  const [editingPeriod, setEditingPeriod] = useState(false);
  const [startDraft, setStartDraft] = useState('');
  const [endDraft, setEndDraft] = useState('');
  const [openCal, setOpenCal] = useState<'start' | 'end' | null>(null);
  // Координати попапа у viewport-і (portal до body, fixed) + напрямок (вгору/вниз).
  const [calPos, setCalPos] = useState<{ left: number; top: number; up: boolean } | null>(null);
  const [savingPeriod, setSavingPeriod] = useState(false);
  /// Звіт про перерахунок «Доступ до» після зміни дат набору. Сервер зберігає дати завжди,
  /// а підписки перераховує батчами — частина батчів може впасти. Тримаємо звіт на екрані
  /// (а не тільки в тості), щоб менеджер побачив, що частина підписок лишилась зі старими
  /// датами, і міг повторити збереження.
  const [recalcReport, setRecalcReport] = useState<
    { scanned: number; recalculated: number; failed: number; warning: string | null; wfpFailed: number } | null
  >(null);
  /// Драфт поля «Надати доступ до» (місяці після завершення програми) + звіт про перерахунок.
  const [accessDraft, setAccessDraft] = useState<string>(String(postAccessMonths));
  const [savingAccess, setSavingAccess] = useState(false);
  const [accessReport, setAccessReport] = useState<
    { months: number; updated: number; total: number; failed: number; warning: string | null } | null
  >(null);
  const periodRef = useRef<HTMLDivElement | null>(null);
  const calRef = useRef<HTMLDivElement | null>(null);
  const startChipRef = useRef<HTMLButtonElement | null>(null);
  const endChipRef = useRef<HTMLButtonElement | null>(null);

  const CAL_HEIGHT = 250; // приблизна висота dense-календаря

  // Відкриваємо календар уверх, якщо знизу бракує місця, а зверху воно є.
  function openCalendar(which: 'start' | 'end') {
    if (openCal === which) {
      setOpenCal(null);
      return;
    }
    const chip = (which === 'start' ? startChipRef : endChipRef).current;
    const rect = chip?.getBoundingClientRect();
    if (rect) {
      const below = window.innerHeight - rect.bottom;
      const up = below < CAL_HEIGHT && rect.top > CAL_HEIGHT;
      setCalPos({
        left: rect.left,
        top: up ? rect.top - 8 - CAL_HEIGHT : rect.bottom + 8,
        up,
      });
    }
    setOpenCal(which);
  }
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

  // При зміні обраного cohort-у виходимо з режиму редагування періоду.
  useEffect(() => {
    setEditingPeriod(false);
    setOpenCal(null);
  }, [activeCohortId]);

  // Закрити календар-попап при кліку поза областю редагування періоду або по Escape.
  useEffect(() => {
    if (!openCal) return;
    function onPointerDown(e: MouseEvent | TouchEvent) {
      const target = e.target as Node | null;
      if (!target) return;
      const insideRow = periodRef.current?.contains(target);
      const insideCal = calRef.current?.contains(target);
      if (!insideRow && !insideCal) setOpenCal(null);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenCal(null);
    }
    // Закриваємо при скролі/ресайзі — позиція fixed інакше «відʼїде» від чипа.
    const onReflow = () => setOpenCal(null);
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onReflow, true);
    window.addEventListener('resize', onReflow);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onReflow, true);
      window.removeEventListener('resize', onReflow);
    };
  }, [openCal]);

  async function handleSavePeriod() {
    if (!active) return;
    if (!startDraft || !endDraft) {
      toast('error', 'Заповніть обидві дати');
      return;
    }
    if (new Date(endDraft) <= new Date(startDraft)) {
      toast('error', 'Дата завершення має бути пізніше дати старту');
      return;
    }
    setSavingPeriod(true);
    setRecalcReport(null);
    try {
      const res = await fetch(`/api/admin/yearly-program/cohorts/${active.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: new Date(startDraft).toISOString(),
          endDate: new Date(endDraft).toISOString(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast('error', data.error ?? `Помилка ${res.status}`);
        return;
      }

      // Дати збережено в будь-якому разі. Далі — чесний звіт по перерахунку підписок:
      // якщо частина батчів впала, редактор лишаємо відкритим з амбер-блоком, щоб
      // менеджер міг одразу повторити збереження.
      const failed: number = data.failed ?? 0;
      const recalculated: number = data.recalculated ?? 0;
      const scanned: number = data.scanned ?? 0;
      const wfpFailed: number = data.wfpSync?.failed ?? 0;

      if (failed > 0 || wfpFailed > 0) {
        setRecalcReport({ scanned, recalculated, failed, warning: data.warning ?? null, wfpFailed });
        // Два різні збої — і поради різні. Дати не перерахувались → має сенс зберегти
        // ще раз. А от коли дати вже правильні й впав лише синк графіка у WayForPay,
        // повторне «Зберегти» нічого не дасть: без зміни дат сервер синк не запускає.
        toast('warning', failed > 0
          ? (data.warning ?? `Дати збережено, але ${failed} підписок не перерахувались — деталі під датами.`)
          : `Дати збережено, але графік автосписань не оновився у ${wfpFailed} підписок — деталі під датами.`);
        router.refresh();
        return;
      }

      // Формулювання навмисне без «X із Y»: решта підписок не «не вдалась», а просто
      // не потребувала зміни (їхній «Доступ до» і так збігається з новим графіком).
      toast('success', recalculated > 0
        ? `Період оновлено — дати змінено у ${recalculated} підписок (решта без змін)`
        : active.launchedAt
          ? 'Період оновлено — жодну дату доступу міняти не довелось'
          : 'Період навчання оновлено');
      setEditingPeriod(false);
      router.refresh();
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setSavingPeriod(false);
    }
  }

  // Драфт «Надати доступ до» синхронізуємо рівно в момент ВІДКРИТТЯ редактора. Робити це
  // на кожну зміну postAccessMonths не можна: після збереження прилітає router.refresh(),
  // і такий сброс стирав би щойно показаний звіт про перерахунок.
  const accessEditingRef = useRef(accessEditing);
  useEffect(() => {
    if (accessEditing && !accessEditingRef.current) {
      setAccessDraft(String(postAccessMonths));
      setAccessReport(null);
    }
    accessEditingRef.current = accessEditing;
  }, [accessEditing, postAccessMonths]);

  // Escape закриває редактор із будь-якого місця, а не лише з поля вводу: після кліку по
  // «+»/«−» фокус лишається на кнопці, і локальний onKeyDown інпута вже не спрацював би.
  useEffect(() => {
    if (!accessEditing) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onAccessEditingChange(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [accessEditing, onAccessEditingChange]);

  const accessParsed = Number(accessDraft);
  const accessValid =
    accessDraft.trim() !== '' &&
    Number.isInteger(accessParsed) &&
    accessParsed >= ACCESS_MIN_MONTHS &&
    accessParsed <= ACCESS_MAX_MONTHS;
  const accessPreviewMonths = accessValid ? accessParsed : postAccessMonths;
  /// Результуюча дата доступу = дата завершення набору + N місяців. Формула — з
  /// lib/yearlyProgramAccess (та сама, що рахує expiresAt на сервері), тому прев'ю в UI
  /// і реальна дата у підписці не можуть розійтись.
  ///
  /// ДВА різні значення, і плутати їх не можна:
  ///   • `accessUntilSaved` — від збереженого `postAccessMonths`. Тільки воно показується
  ///     у режимі перегляду. Раніше рядок брав драфт: після «+ + + Esc» (незбережена зміна)
  ///     шапка показувала дату неіснуючого значення поруч із плашкою «+N міс» реального.
  ///   • `accessUntilDraft` — від драфту, живе ЛИШЕ всередині відкритого редактора.
  const accessUntilSaved = active ? addCalendarMonths(new Date(active.endDate), postAccessMonths) : null;
  const accessUntilDraft = active ? addCalendarMonths(new Date(active.endDate), accessPreviewMonths) : null;

  function bumpAccess(delta: number) {
    const base = accessValid ? accessParsed : postAccessMonths;
    const next = Math.min(ACCESS_MAX_MONTHS, Math.max(ACCESS_MIN_MONTHS, base + delta));
    setAccessDraft(String(next));
  }

  async function handleSaveAccess() {
    if (!accessValid) {
      toast('error', `Ціле число від ${ACCESS_MIN_MONTHS} до ${ACCESS_MAX_MONTHS}`);
      return;
    }
    if (accessParsed === postAccessMonths) {
      onAccessEditingChange(false);
      return;
    }
    setSavingAccess(true);
    setAccessReport(null);
    try {
      const res = await fetch('/api/admin/yearly-program/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ postAccessMonths: accessParsed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast('error', data.error ?? `Помилка ${res.status}`);
        return;
      }
      // Сервер перерахував «Доступ до» живим підпискам (ACTIVE/GRACE з набором) — показуємо
      // підсумок окремим блоком, а не лише тостом: менеджер має бачити, скільки студентів
      // реально отримали нову дату.
      const updated: number = data.recomputed?.updated ?? 0;
      const total: number = data.recomputed?.scanned ?? data.recomputed?.total ?? 0;
      const failed: number = data.recomputed?.failed ?? 0;
      setAccessReport({ months: accessParsed, updated, total, failed, warning: data.warning ?? null });
      // Частковий провал — це НЕ помилка збереження: значення записане, частина підписок
      // лишилась зі старою датою. Тому і тост попереджувальний, і екран однаково
      // оновлюється: без router.refresh() менеджер бачив би геть старі дані.
      toast(failed > 0 ? 'error' : 'success', failed > 0
        ? `Збережено, але ${failed} із ${total} підписок не перерахувались — повторіть збереження`
        : updated > 0
          ? `Доступ до матеріалів: +${accessParsed} міс — нову дату отримали ${updated} підписок`
          : 'Збережено — жодну дату доступу міняти не довелось');
      onAccessEditingChange(false);
      router.refresh();
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setSavingAccess(false);
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
    <div className="overflow-visible" data-cohort-header>
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
            {active && !editingPeriod && (
              <span className={`inline-flex items-center gap-1.5 text-[12px] tabular-nums ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
                {fmtDate(active.startDate)} — {fmtDate(active.endDate)} · підписок: {active.subscriptionsCount}
                <button
                  type="button"
                  onClick={() => {
                    setStartDraft(toDateInput(active.startDate));
                    setEndDraft(toDateInput(active.endDate));
                    setEditingPeriod(true);
                  }}
                  title="Змінити період навчання"
                  className={`inline-flex items-center justify-center w-6 h-6 rounded-md border transition-colors ${
                    dark
                      ? 'bg-white/[0.04] border-white/10 text-slate-300 hover:bg-white/[0.08] hover:text-amber-200'
                      : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100 hover:text-amber-700'
                  }`}
                >
                  <HiOutlineCalendarDays className="text-[13px]" />
                </button>
              </span>
            )}
            {/* «Надати доступ до» — третій елемент періоду. Значення глобальне (AppSetting),
                але показуємо його як дату: кінець набору + N місяців. */}
            {active && !editingPeriod && !accessEditing && (
              <span
                data-access-until
                className={`inline-flex items-center gap-1.5 text-[12px] tabular-nums ${dark ? 'text-slate-400' : 'text-stone-600'}`}
              >
                <span className={dark ? 'text-slate-500' : 'text-stone-400'}>·</span>
                Надати доступ до:
                <b className={dark ? 'text-amber-200' : 'text-amber-800'}>{accessUntilSaved ? fmtUtcDate(accessUntilSaved) : '—'}</b>
                <span className={`px-1.5 py-0.5 rounded text-[10.5px] font-semibold ${
                  dark ? 'bg-amber-400/12 text-amber-200 border border-amber-400/25' : 'bg-amber-50 text-amber-800 border border-amber-300/50'
                }`}>
                  +{postAccessMonths} міс
                </span>
                <HoverInfo
                  theme={theme}
                  side="bottom"
                  align="start"
                  title="Надати доступ до"
                  body={
                    <p>
                      Скільки місяців після завершення програми зберігається доступ до матеріалів.
                      Зміна перераховує дату доступу всім активним підпискам.
                    </p>
                  }
                />
                <button
                  type="button"
                  onClick={() => { setEditingPeriod(false); setOpenCal(null); onAccessEditingChange(true); }}
                  title="Змінити, до якої дати надається доступ"
                  className={`inline-flex items-center justify-center w-6 h-6 rounded-md border transition-colors ${
                    dark
                      ? 'bg-white/[0.04] border-white/10 text-slate-300 hover:bg-white/[0.08] hover:text-amber-200'
                      : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100 hover:text-amber-700'
                  }`}
                >
                  <HiOutlinePencilSquare className="text-[13px]" />
                </button>
              </span>
            )}
            {active && accessEditing && (
              <div data-access-editor className="flex items-center gap-2 flex-wrap">
                <span className={`text-[12px] ${dark ? 'text-slate-400' : 'text-stone-600'}`}>Надати доступ до:</span>
                <div className="inline-flex items-stretch gap-1">
                  <button
                    type="button"
                    onClick={() => bumpAccess(-1)}
                    disabled={savingAccess || accessPreviewMonths <= ACCESS_MIN_MONTHS}
                    aria-label="Менше на місяць"
                    className={`w-7 h-7 rounded-md border text-[15px] font-semibold flex items-center justify-center transition-colors disabled:opacity-30 ${
                      dark ? 'bg-zinc-900 border-white/15 text-slate-200 hover:border-amber-400/40' : 'bg-white border-stone-300 text-stone-700 hover:border-amber-400'
                    }`}
                  >−</button>
                  <div className="relative">
                    <input
                      type="number"
                      min={ACCESS_MIN_MONTHS}
                      max={ACCESS_MAX_MONTHS}
                      value={accessDraft}
                      onChange={(e) => setAccessDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); handleSaveAccess(); }
                        else if (e.key === 'Escape') { e.preventDefault(); onAccessEditingChange(false); }
                      }}
                      disabled={savingAccess}
                      aria-label="Місяців доступу після завершення програми"
                      className={`w-[92px] h-7 pl-2.5 pr-9 rounded-md border text-[12px] font-semibold tabular-nums outline-none transition-colors disabled:opacity-50 ${
                        accessValid
                          ? dark
                            ? 'bg-zinc-900 border-white/15 text-slate-100 focus:border-amber-400/60'
                            : 'bg-white border-stone-300 text-stone-900 focus:border-amber-500'
                          : dark
                            ? 'bg-zinc-900 border-rose-400/50 text-rose-200'
                            : 'bg-white border-rose-400 text-rose-800'
                      }`}
                    />
                    <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-[11px] pointer-events-none ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                      міс
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => bumpAccess(1)}
                    disabled={savingAccess || accessPreviewMonths >= ACCESS_MAX_MONTHS}
                    aria-label="Більше на місяць"
                    className={`w-7 h-7 rounded-md border text-[15px] font-semibold flex items-center justify-center transition-colors disabled:opacity-30 ${
                      dark ? 'bg-zinc-900 border-white/15 text-slate-200 hover:border-amber-400/40' : 'bg-white border-stone-300 text-stone-700 hover:border-amber-400'
                    }`}
                  >+</button>
                </div>
                <span className={dark ? 'text-slate-500' : 'text-stone-400'}>→</span>
                <span
                  data-access-preview
                  className={`inline-flex items-center gap-1.5 text-[12px] tabular-nums rounded-md px-2.5 py-1 border ${
                    dark ? 'bg-amber-400/10 border-amber-400/30 text-amber-100' : 'bg-amber-50 border-amber-300/70 text-amber-900'
                  }`}
                >
                  <HiOutlineCalendarDays className="text-[13px] opacity-70" />
                  {accessUntilDraft && accessValid ? fmtUtcDate(accessUntilDraft) : '—'}
                </span>
                <button
                  type="button"
                  onClick={handleSaveAccess}
                  disabled={savingAccess || !accessValid}
                  title="Зберегти (Enter)"
                  className={`inline-flex items-center justify-center w-8 h-8 rounded-md border transition-colors disabled:opacity-50 ${
                    dark ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-200 hover:bg-emerald-500/25' : 'bg-emerald-50 border-emerald-300/60 text-emerald-800 hover:bg-emerald-100'
                  }`}
                >
                  <HiOutlineCheck />
                </button>
                <button
                  type="button"
                  onClick={() => onAccessEditingChange(false)}
                  disabled={savingAccess}
                  title="Скасувати (Esc)"
                  className={`inline-flex items-center justify-center w-8 h-8 rounded-md border transition-colors disabled:opacity-50 ${
                    dark ? 'bg-white/[0.04] border-white/10 text-slate-300 hover:bg-white/[0.08]' : 'bg-stone-100 border-stone-300 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  <HiOutlineXMark />
                </button>
                {!accessValid && (
                  <span className={`text-[10.5px] ${dark ? 'text-rose-300' : 'text-rose-700'}`}>
                    Ціле число від {ACCESS_MIN_MONTHS} до {ACCESS_MAX_MONTHS}
                  </span>
                )}
                <span className={`inline-flex items-center gap-1 text-[10.5px] ${dark ? 'text-amber-300/80' : 'text-amber-700'}`}>
                  Доступ перерахується
                  <HoverInfo
                    theme={theme}
                    side="bottom"
                    align="start"
                    title="Надати доступ до"
                    body={
                      <div className="space-y-1.5">
                        <p>Скільки місяців після завершення програми зберігається доступ до матеріалів. Зміна перераховує дату доступу всім активним підпискам.</p>
                        <p>Стосується <b>всіх студентів Річної</b>: хто платив одразу за рік — отримує ці місяці відразу; хто платить помісячно — після сплати всіх платежів.</p>
                        <p><b>Гроші й оплати не чіпаються.</b> Змінюється лише дата, до якої відкриті матеріали на платформі.</p>
                      </div>
                    }
                  />
                </span>
              </div>
            )}
            {active && editingPeriod && (
              <div ref={periodRef} className="flex items-center gap-2 flex-wrap relative">
                <DateChip
                  ref={startChipRef}
                  dark={dark}
                  label={startDraft ? formatDateChip(startDraft) : 'Дата старту'}
                  active={openCal === 'start'}
                  disabled={savingPeriod}
                  onClick={() => openCalendar('start')}
                />
                <span className={dark ? 'text-slate-500' : 'text-stone-400'}>—</span>
                <DateChip
                  ref={endChipRef}
                  dark={dark}
                  label={endDraft ? formatDateChip(endDraft) : 'Дата завершення'}
                  active={openCal === 'end'}
                  disabled={savingPeriod}
                  onClick={() => openCalendar('end')}
                />
                <button
                  type="button"
                  onClick={handleSavePeriod}
                  disabled={savingPeriod}
                  title="Зберегти період"
                  className={`inline-flex items-center justify-center w-8 h-8 rounded-md border transition-colors disabled:opacity-50 ${
                    dark ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-200 hover:bg-emerald-500/25' : 'bg-emerald-50 border-emerald-300/60 text-emerald-800 hover:bg-emerald-100'
                  }`}
                >
                  <HiOutlineCheck />
                </button>
                <button
                  type="button"
                  onClick={() => { setEditingPeriod(false); setOpenCal(null); }}
                  disabled={savingPeriod}
                  title="Скасувати"
                  className={`inline-flex items-center justify-center w-8 h-8 rounded-md border transition-colors disabled:opacity-50 ${
                    dark ? 'bg-white/[0.04] border-white/10 text-slate-300 hover:bg-white/[0.08]' : 'bg-stone-100 border-stone-300 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  <HiOutlineXMark />
                </button>
                {active.launchedAt && (
                  <span className={`inline-flex items-center gap-1 text-[10.5px] ${dark ? 'text-amber-300/80' : 'text-amber-700'}`}>
                    Доступ перерахується
                    <HoverInfo
                      theme={theme}
                      side="bottom"
                      align="start"
                      title="Що зміниться, якщо змінити дати"
                      body={
                        <div className="space-y-1.5">
                          <p>Нічого критичного не зламається. Зміниться лише <b>до якої дати студенти мають доступ</b> — система сама підлаштує її під нову дату завершення.</p>
                          <p><b>Гроші й оплати не чіпаються взагалі.</b> Усі платежі, суми та дати лишаються такими, як були. Студентам нічого не досписується і не повертається.</p>
                          <p><b>Якщо подовжити дату завершення</b> — доступ студентів подовжиться до неї. <b>Якщо скоротити</b> — доступ скоротиться.</p>
                          <p>Для студентів з <b>річною оплатою</b> доступ = просто нова дата завершення. Для <b>помісячної оплати</b> доступ рахується від їхніх оплат (кожна оплата ≈ +місяць), але не довше нової дати завершення.</p>
                          <p><b>Доступ до курсів на платформі (SendPulse) прямо зараз не закриється.</b> Він уже відкритий і просто триватиме до нової дати. Сам доступ закриється тільки тоді, коли ця дата реально мине.</p>
                        </div>
                      }
                    />
                  </span>
                )}

                {/* Попап-календар у портал до body — поверх усіх блоків, вгору/вниз залежно від місця */}
                {openCal && calPos && createPortal(
                  <div
                    ref={calRef}
                    style={{ position: 'fixed', left: calPos.left, top: calPos.top, width: 230 }}
                    className={`z-[300] rounded-xl border shadow-2xl ${
                      dark ? 'bg-zinc-900 border-white/10' : 'bg-white border-stone-200'
                    }`}
                  >
                    {openCal === 'start' ? (
                      <InlineDatePicker
                        theme={theme}
                        dense
                        value={startDraft}
                        onChange={(v) => {
                          setStartDraft(v);
                          // Завершення авто-виставляється на +9 місяців від старту (−1 день).
                          setEndDraft(addNineMonths(v));
                          setOpenCal(null);
                        }}
                      />
                    ) : (
                      <InlineDatePicker
                        theme={theme}
                        dense
                        value={endDraft}
                        min={startDraft || undefined}
                        onChange={(v) => {
                          setEndDraft(v);
                          setOpenCal(null);
                        }}
                      />
                    )}
                  </div>,
                  document.body,
                )}
              </div>
            )}
          </div>

          {/* Частковий перерахунок після зміни дат: дати збережені, але не всі підписки
              отримали новий «Доступ до». Без цього блоку менеджер бачив би просто
              «збережено» і не знав би, що частина студентів лишилась зі старими датами. */}
          {recalcReport && (
            <div
              data-recalc-report
              className={`mt-2.5 rounded-lg border px-3.5 py-2.5 text-[12px] leading-snug flex items-start gap-2 ${
                dark
                  ? 'bg-amber-500/10 border-amber-400/25 text-amber-100/90'
                  : 'bg-amber-50 border-amber-300/70 text-amber-900'
              }`}
            >
              <HiOutlineExclamationTriangle className="text-base shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1 space-y-1">
                <div>
                  {recalcReport.failed > 0
                    ? (recalcReport.warning ?? 'Дати збережено, але не всі підписки вдалось перерахувати.')
                    : `Дати збережено і перераховано, але графік автосписань у WayForPay не оновився у ${recalcReport.wfpFailed} підписок.`}
                </div>
                <div className={dark ? 'text-amber-200/70' : 'text-amber-800/80'}>
                  Дати змінено: <b className="tabular-nums">{recalcReport.recalculated}</b> ·
                  {' '}не вдалось: <b className="tabular-nums">{recalcReport.failed}</b> ·
                  {' '}усього в наборі: <b className="tabular-nums">{recalcReport.scanned}</b>
                  {recalcReport.wfpFailed > 0 && (
                    <> · графік автосписань не оновився у <b className="tabular-nums">{recalcReport.wfpFailed}</b></>
                  )}
                </div>
                <div className={dark ? 'text-amber-200/70' : 'text-amber-800/80'}>
                  {recalcReport.failed > 0
                    ? 'Ці підписки лишились зі старими датами — натисніть «Зберегти» ще раз.'
                    // Повторне збереження тут — no-op: сервер запускає WFP-синк лише коли
                    // дати реально змінились. Тому підказка веде в підписку, де є ручна дія.
                    : 'Повторне збереження не допоможе — відкрийте підписки з позначкою помилки і натисніть «🔄 Синхронізувати графік WFP».'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRecalcReport(null)}
                aria-label="Сховати"
                className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                  dark ? 'hover:bg-white/10 text-amber-200/70' : 'hover:bg-amber-100 text-amber-800/70'
                }`}
              >
                <HiOutlineXMark className="text-[13px]" />
              </button>
            </div>
          )}

          {/* Підсумок перерахунку після зміни «Надати доступ до». Сервер міняє expiresAt
              лише тим підпискам, у яких дата реально інша, тому показуємо і скільки живих
              підписок узагалі проглянуто — інакше «оновлено: 0» читалось би як збій. */}
          {accessReport && (
            <div
              data-access-report
              className={`mt-2.5 rounded-lg border px-3.5 py-2.5 text-[12px] leading-snug flex items-start gap-2 ${
                dark
                  ? 'bg-amber-500/10 border-amber-400/25 text-amber-100/90'
                  : 'bg-amber-50 border-amber-300/70 text-amber-900'
              }`}
            >
              <HiOutlineCalendarDays className="text-base shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1 space-y-1">
                <div>
                  Доступ до матеріалів після завершення програми: <b className="tabular-nums">+{accessReport.months} міс</b>
                  {active && <> — до <b className="tabular-nums">{fmtUtcDate(addCalendarMonths(new Date(active.endDate), accessReport.months))}</b></>}.
                </div>
                <div className={dark ? 'text-amber-200/70' : 'text-amber-800/80'}>
                  Дату доступу змінено: <b className="tabular-nums">{accessReport.updated}</b> ·
                  {' '}переглянуто активних підписок: <b className="tabular-nums">{accessReport.total}</b>
                  {accessReport.updated === 0 && accessReport.failed === 0 && ' — у решти дата вже збігалась'}
                </div>
                {accessReport.failed > 0 && (
                  <div className={`font-semibold ${dark ? 'text-rose-300' : 'text-rose-700'}`}>
                    ⚠️ Не перерахувалось: <b className="tabular-nums">{accessReport.failed}</b>
                    {' '}— {accessReport.warning ?? 'повторіть збереження або перевірте лог.'}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setAccessReport(null)}
                aria-label="Сховати"
                className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                  dark ? 'hover:bg-white/10 text-amber-200/70' : 'hover:bg-amber-100 text-amber-800/70'
                }`}
              >
                <HiOutlineXMark className="text-[13px]" />
              </button>
            </div>
          )}

          {open && (
            <div
              className={`absolute left-0 top-full z-30 mt-2 max-h-[420px] overflow-y-auto rounded-lg border w-[calc(100vw-32px)] sm:w-auto sm:min-w-[400px] shadow-2xl ${
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

/// Чип-кнопка з обраною датою, яка відкриває InlineDatePicker-попап.
const DateChip = forwardRef<HTMLButtonElement, {
  dark: boolean;
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}>(function DateChip({ dark, label, active, disabled, onClick }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 text-[12px] tabular-nums rounded-md px-2.5 py-1 border transition-colors disabled:opacity-50 ${
        active
          ? dark
            ? 'bg-amber-400/15 border-amber-400/50 text-amber-100'
            : 'bg-amber-50 border-amber-400 text-amber-900'
          : dark
            ? 'bg-zinc-900 border-white/15 text-slate-200 hover:border-amber-400/40'
            : 'bg-white border-stone-300 text-stone-800 hover:border-amber-400'
      }`}
    >
      <HiOutlineCalendarDays className="text-[13px] opacity-70" />
      {label}
    </button>
  );
});

/// Дати набору — календарні, а не моменти часу: сервер зберігає початок як 00:00:00.000Z,
/// а кінець нормалізує в 23:59:59.999Z того ж дня (`normalizeCohortEndDate` → `endOfUtcDay`).
/// Тому форматуємо ЗАВЖДИ в UTC: у київському браузері (UTC+2/+3) локальні геттери
/// показували б кінець набору 31.05 як «01.06» — і збереження без змін тихо зсувало б
/// дату на +1 день щоразу. Плюс SSR (UTC) і клієнт дали б різний текст → hydration mismatch.
function fmtDate(iso: string): string {
  return fmtUtcDate(new Date(iso));
}

/// Та сама UTC-нормалізація для вже готового Date (результат addCalendarMonths).
function fmtUtcDate(d: Date): string {
  return new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC',
  }).format(d);
}

/// 'YYYY-MM-DD' старту → 'YYYY-MM-DD' завершення = +9 місяців −1 день
/// (як дефолт у CreateCohortModal: 01.09 → 31.05).
function addNineMonths(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const end = new Date(y, m - 1 + 9, d);
  end.setDate(end.getDate() - 1);
  const yyyy = end.getFullYear();
  const mm = String(end.getMonth() + 1).padStart(2, '0');
  const dd = String(end.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/// ISO → 'YYYY-MM-DD' для календаря-редактора. Читаємо UTC-геттерами, бо саме в UTC
/// зберігаються межі набору (див. коментар до fmtDate). Назад драфт іде як
/// `new Date('YYYY-MM-DD')` — це UTC-північ, тож round-trip не зсуває день.
function toDateInput(iso: string): string {
  const d = new Date(iso);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export { fmtDate as fmtCohortDate };
