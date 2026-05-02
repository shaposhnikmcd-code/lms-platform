'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  HiOutlineRocketLaunch,
  HiOutlineBolt,
  HiOutlineCalendarDays,
  HiOutlineCheck,
  HiOutlineExclamationTriangle,
  HiOutlineXMark,
} from 'react-icons/hi2';
import type { Theme } from '../../_components/adminTheme';
import type { CohortListItem } from './types';
import { useUIFeedback } from './UIFeedback';
import InlineDateTimePicker from '../../_components/InlineDateTimePicker';

/// Модалка "🚀 Запустити програму" — два режими: миттєвий запуск або запланований
/// (cron yearly-subscriptions виконає в призначений день).
///
/// Якщо вже виставлено `cohort.launchScheduledFor` — показуємо стан "Заплановано на DATE"
/// з кнопками "Запустити одразу" та "Скасувати запланований".
export default function LaunchProgramModal({
  cohort,
  paidPendingCount,
  theme,
  onClose,
}: {
  cohort: CohortListItem;
  /// К-ть підписок які реально отримають доступ при запуску (paid + access не відкрито).
  paidPendingCount: number;
  theme: Theme;
  onClose: () => void;
}) {
  const dark = theme === 'dark';
  const router = useRouter();
  const { toast, confirm } = useUIFeedback();
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<'now' | 'schedule'>(cohort.launchScheduledFor ? 'schedule' : 'now');
  const [scheduledFor, setScheduledFor] = useState(() => {
    if (cohort.launchScheduledFor) return formatDateTimeInput(new Date(cohort.launchScheduledFor));
    const t = new Date();
    t.setDate(t.getDate() + 1);
    t.setHours(9, 0, 0, 0);
    return formatDateTimeInput(t);
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  const cohortEnd = useMemo(() => new Date(cohort.endDate), [cohort.endDate]);
  const scheduledDate = useMemo(() => new Date(scheduledFor), [scheduledFor]);
  const scheduleInvalid = scheduledDate.getTime() <= Date.now() || scheduledDate.getTime() > cohortEnd.getTime();

  async function submit() {
    const willSchedule = mode === 'schedule';
    if (willSchedule && scheduleInvalid) {
      toast('error', 'Дата запуску має бути у майбутньому і до завершення cohort-у');
      return;
    }

    if (!willSchedule) {
      // Підтвердження тільки для миттєвого запуску — це необоротна дія.
      const ok = await confirm({
        title: `Запустити "${cohort.name}" просто зараз?`,
        description: 'Перевір що всі очікувані оплати вже надійшли. Після запуску додавання студентів — тільки через invite-link.',
        bullets: [
          { icon: '🔓', text: `Відкриє доступ у SendPulse для ${paidPendingCount} оплачених підписок` },
          { icon: '📅', text: 'Перерахує "Доступ до" по cohort-логіці' },
          { icon: '🚀', text: 'Зафіксує дату фактичного запуску' },
        ],
        confirmLabel: 'Запустити зараз',
      });
      if (!ok) return;
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/admin/yearly-program/cohorts/${cohort.id}/launch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: willSchedule
          ? JSON.stringify({ scheduledAt: scheduledDate.toISOString() })
          : '{}',
      });
      const data = await res.json();
      if (!res.ok) {
        toast('error', data.error ?? res.statusText);
        return;
      }
      if (willSchedule) {
        toast('success', `📅 Запуск заплановано на ${humanizeWhen(scheduledFor)}`);
      } else {
        const s = data.summary;
        toast(
          s.failed > 0 ? 'info' : 'success',
          `✅ Програму "${cohort.name}" запущено\nДоступ відкрито: ${s.opened}/${s.total}${s.failed > 0 ? ` · Помилок: ${s.failed}` : ''}`,
        );
      }
      router.refresh();
      onClose();
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function cancelScheduled() {
    const ok = await confirm({
      title: 'Скасувати запланований запуск?',
      description: 'Cohort залишиться у стані "не запущений" — оплати будуть надходити, доступ не відкриється.',
      confirmLabel: 'Скасувати запланований',
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/yearly-program/cohorts/${cohort.id}/launch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancelScheduled: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast('error', data.error ?? res.statusText);
        return;
      }
      toast('success', 'Запланований запуск скасовано');
      router.refresh();
      onClose();
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className={`relative max-w-2xl w-full rounded-2xl shadow-2xl ${
        dark ? 'bg-zinc-900 border border-white/10 text-slate-200' : 'bg-white border border-stone-200 text-stone-800'
      }`}>
        <div className={`flex items-center justify-between px-6 py-3.5 border-b ${dark ? 'border-white/10' : 'border-stone-200'}`}>
          <h3 className="text-base font-bold flex items-center gap-2">
            <HiOutlineRocketLaunch className="text-lg" />
            Запустити програму · {cohort.name}
          </h3>
          <button onClick={onClose} aria-label="Закрити" className={`w-7 h-7 rounded-full flex items-center justify-center ${dark ? 'hover:bg-white/10' : 'hover:bg-stone-100'}`}>✕</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Інфо-смужка для cohort-у */}
          <div className={`rounded-lg px-3.5 py-2.5 flex items-center gap-3 text-[12px] ${
            dark ? 'bg-amber-500/[0.07] border border-amber-400/20 text-amber-100/90' : 'bg-amber-50 border border-amber-200/70 text-amber-900'
          }`}>
            <HiOutlineExclamationTriangle className="text-base shrink-0" />
            <div className="flex-1">
              Підписок з оплатою, готових до відкриття доступу: <b className="tabular-nums">{paidPendingCount}</b>.
              Дати cohort-у: <b>{fmtDate(cohort.startDate)} — {fmtDate(cohort.endDate)}</b>.
            </div>
          </div>

          {/* Поточний стан запланованого запуску */}
          {cohort.launchScheduledFor && (
            <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${
              dark ? 'bg-indigo-500/[0.08] border-indigo-400/30' : 'bg-indigo-50 border-indigo-200/80'
            }`}>
              <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                dark ? 'bg-indigo-400/15 text-indigo-300 border border-indigo-400/30' : 'bg-indigo-100 text-indigo-700 border border-indigo-300/60'
              }`}>
                <HiOutlineCalendarDays className="text-lg" />
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-[12px] font-semibold ${dark ? 'text-indigo-200' : 'text-indigo-900'}`}>
                  Запуск заплановано
                </div>
                <div className={`text-[13px] ${dark ? 'text-slate-200' : 'text-stone-800'}`}>
                  {humanizeWhen(formatDateTimeInput(new Date(cohort.launchScheduledFor)))}
                  <span className={`ml-2 text-[11px] ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
                    ({new Date(cohort.launchScheduledFor).toLocaleString('uk-UA')})
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={cancelScheduled}
                disabled={busy}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors disabled:opacity-50 ${
                  dark ? 'bg-rose-500/10 border-rose-400/30 text-rose-200 hover:bg-rose-500/20' : 'bg-white border-rose-300/60 text-rose-700 hover:bg-rose-50'
                }`}
              >
                <HiOutlineXMark /> Скасувати
              </button>
            </div>
          )}

          {/* Mode picker — дві картки */}
          <div className="grid sm:grid-cols-2 gap-3">
            <ModeCard
              theme={theme}
              active={mode === 'now'}
              onClick={() => setMode('now')}
              icon={<HiOutlineBolt className="text-2xl" />}
              accent="amber"
              title="Запустити зараз"
              subtitle={`Відкрити доступ ${paidPendingCount} підпискам негайно`}
            >
              {mode === 'now' && (
                <div className={`mt-2 text-[11px] leading-snug ${dark ? 'text-amber-200/70' : 'text-amber-900/80'}`}>
                  ⚡ Послідовне відкриття SendPulse. Welcome-листи — окремою кнопкою «✉ Запустити розсилку».
                </div>
              )}
            </ModeCard>

            <ModeCard
              theme={theme}
              active={mode === 'schedule'}
              onClick={() => setMode('schedule')}
              icon={<HiOutlineCalendarDays className="text-2xl" />}
              accent="indigo"
              title="Запланувати запуск"
              subtitle={mode === 'schedule' ? humanizeWhen(scheduledFor) : 'Cron виконає у вибраний день'}
            >
              {mode === 'schedule' && (
                <div className="mt-3 space-y-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {LAUNCH_PRESETS.map((p) => {
                      const presetVal = formatDateTimeInput(new Date(p.compute()));
                      const selected = scheduledFor === presetVal;
                      return (
                        <button
                          key={p.label}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setScheduledFor(presetVal);
                          }}
                          className={`px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors ${
                            selected
                              ? dark
                                ? 'bg-indigo-400/20 border-indigo-400/40 text-indigo-200'
                                : 'bg-indigo-100 border-indigo-300/70 text-indigo-900'
                              : dark
                                ? 'bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.08]'
                                : 'bg-white border-stone-300/60 text-stone-700 hover:bg-stone-50'
                          }`}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                  <InlineDateTimePicker
                    value={scheduledFor}
                    onChange={setScheduledFor}
                    theme={theme}
                    min={formatDateTimeInput(new Date())}
                    defaultHour={9}
                    defaultMinute={0}
                    showNowButton={false}
                  />
                  {scheduleInvalid && (
                    <div className={`text-[11px] flex items-center gap-1 ${dark ? 'text-rose-300' : 'text-rose-700'}`}>
                      <HiOutlineExclamationTriangle /> Має бути у майбутньому, до {fmtDate(cohort.endDate)}.
                    </div>
                  )}
                  <div className={`text-[10px] leading-snug ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                    ℹ️ Cron перевіряє щодоби о 04:00 UTC. Фактичний запуск може зсунутись на ≤24 години після запланованої дати.
                  </div>
                </div>
              )}
            </ModeCard>
          </div>
        </div>

        <div className={`flex items-center justify-end gap-2 px-6 py-4 border-t ${dark ? 'border-white/10 bg-white/[0.02]' : 'border-stone-200 bg-stone-50/50'}`}>
          <button
            onClick={onClose}
            disabled={busy}
            className={`px-3.5 py-2 rounded-lg text-[12px] font-medium ${dark ? 'text-slate-300 hover:bg-white/[0.06]' : 'text-stone-700 hover:bg-stone-100'}`}
          >
            Закрити
          </button>
          <button
            onClick={submit}
            disabled={busy || (mode === 'schedule' && scheduleInvalid)}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-[14px] font-bold border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              dark
                ? 'bg-gradient-to-br from-amber-400/20 to-amber-500/30 border-amber-400/40 text-amber-100 hover:from-amber-400/30 hover:to-amber-500/40 shadow-[0_0_20px_rgba(212,168,67,0.15)]'
                : 'bg-gradient-to-br from-amber-300 to-amber-400 border-amber-400/60 text-amber-950 hover:from-amber-400 hover:to-amber-500 shadow-[0_4px_14px_rgba(212,168,67,0.30)]'
            }`}
          >
            {busy
              ? 'Виконую…'
              : mode === 'now'
                ? <><HiOutlineBolt className="text-base" /> Запустити зараз ({paidPendingCount})</>
                : <><HiOutlineCalendarDays className="text-base" /> {cohort.launchScheduledFor ? 'Перепланувати на' : 'Запланувати на'} {humanizeWhen(scheduledFor, { compact: true })}</>}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ModeCard({
  theme,
  active,
  onClick,
  icon,
  title,
  subtitle,
  accent,
  children,
}: {
  theme: Theme;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  accent: 'amber' | 'indigo';
  children?: React.ReactNode;
}) {
  const dark = theme === 'dark';
  const activeRing =
    accent === 'amber'
      ? dark
        ? 'border-amber-400/40 bg-amber-400/[0.07] shadow-[0_0_20px_rgba(212,168,67,0.10)]'
        : 'border-amber-400/60 bg-amber-50/70 shadow-[0_4px_14px_rgba(212,168,67,0.15)]'
      : dark
        ? 'border-indigo-400/40 bg-indigo-400/[0.06] shadow-[0_0_20px_rgba(129,140,248,0.10)]'
        : 'border-indigo-400/60 bg-indigo-50/70 shadow-[0_4px_14px_rgba(129,140,248,0.18)]';
  const idle = dark
    ? 'border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]'
    : 'border-stone-300/60 bg-white hover:bg-stone-50';
  const iconBox = active
    ? accent === 'amber'
      ? dark
        ? 'bg-amber-400/15 text-amber-300 border-amber-400/30'
        : 'bg-amber-100 text-amber-700 border-amber-300/60'
      : dark
        ? 'bg-indigo-400/15 text-indigo-300 border-indigo-400/30'
        : 'bg-indigo-100 text-indigo-700 border-indigo-300/60'
    : dark
      ? 'bg-white/[0.04] text-slate-400 border-white/[0.08]'
      : 'bg-stone-100 text-stone-500 border-stone-300/60';
  // <div role="button"> бо вкладені діти містять <button> (presets) — HTML забороняє nested-<button>.
  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKey}
      aria-pressed={active}
      className={`text-left w-full rounded-xl border p-3.5 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 ${
        dark ? 'focus:ring-amber-400/40 focus:ring-offset-zinc-900' : 'focus:ring-amber-400/60 focus:ring-offset-white'
      } ${active ? activeRing : idle}`}
    >
      <div className="flex items-start gap-3">
        <div className={`shrink-0 w-11 h-11 rounded-lg border flex items-center justify-center transition-colors ${iconBox}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`font-semibold text-[14px] ${dark ? 'text-slate-100' : 'text-stone-900'}`}>{title}</div>
          <div className={`text-[12px] mt-0.5 ${dark ? 'text-slate-400' : 'text-stone-600'}`}>{subtitle}</div>
        </div>
        <div
          className={`shrink-0 w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
            active
              ? accent === 'amber'
                ? dark ? 'bg-amber-400 border-amber-400 text-amber-950' : 'bg-amber-500 border-amber-500 text-white'
                : dark ? 'bg-indigo-400 border-indigo-400 text-indigo-950' : 'bg-indigo-500 border-indigo-500 text-white'
              : dark ? 'border-white/20' : 'border-stone-300'
          }`}
        >
          {active && <HiOutlineCheck className="text-[12px]" strokeWidth={3} />}
        </div>
      </div>
      {children && <div onClick={(e) => e.stopPropagation()}>{children}</div>}
    </div>
  );
}

const LAUNCH_PRESETS: { label: string; compute: () => string }[] = [
  {
    label: 'Завтра 09:00',
    compute: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d.toISOString();
    },
  },
  {
    label: 'Понеділок 09:00',
    compute: () => {
      const d = new Date();
      const day = d.getDay();
      const daysToMonday = day === 1 ? 7 : (8 - day) % 7 || 7;
      d.setDate(d.getDate() + daysToMonday);
      d.setHours(9, 0, 0, 0);
      return d.toISOString();
    },
  },
  {
    label: 'Через тиждень',
    compute: () => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      d.setHours(9, 0, 0, 0);
      return d.toISOString();
    },
  },
  {
    label: 'Через 2 тижні',
    compute: () => {
      const d = new Date();
      d.setDate(d.getDate() + 14);
      d.setHours(9, 0, 0, 0);
      return d.toISOString();
    },
  },
];

function formatDateTimeInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));
}

function humanizeWhen(dtLocal: string, opts?: { compact?: boolean }): string {
  if (!dtLocal) return '—';
  const d = new Date(dtLocal);
  if (Number.isNaN(d.getTime())) return '—';
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  if (diffMs < 0) return 'у минулому ⚠';
  const diffMin = Math.round(diffMs / 60_000);
  const diffHr = Math.round(diffMs / 3_600_000);
  const time = d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
  const today = startOfDay(now);
  const target = startOfDay(d);
  const dayDelta = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (dayDelta === 0) {
    if (diffMin < 60) return opts?.compact ? `через ${diffMin} хв` : `Сьогодні через ${diffMin} хв (${time})`;
    return opts?.compact ? `сьогодні ${time}` : `Сьогодні о ${time} (через ~${diffHr} год)`;
  }
  if (dayDelta === 1) return opts?.compact ? `завтра ${time}` : `Завтра о ${time}`;
  if (dayDelta < 7) {
    const wd = d.toLocaleDateString('uk-UA', { weekday: 'long' });
    return opts?.compact ? `${wd} ${time}` : `У ${wd} о ${time}`;
  }
  const date = d.toLocaleDateString('uk-UA', { day: '2-digit', month: 'long' });
  return opts?.compact ? `${date}, ${time}` : `${date} о ${time}`;
}

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

