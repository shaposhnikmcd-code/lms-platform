'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  HiOutlineExclamationTriangle,
  HiOutlineXMark,
  HiOutlineArrowPath,
  HiOutlineCheckCircle,
  HiOutlineEyeSlash,
  HiOutlineEye,
  HiOutlineArrowTopRightOnSquare,
  HiOutlineChevronDown,
  HiOutlineChevronUp,
} from 'react-icons/hi2';
import type { Theme } from '../../_components/adminTheme';
import { useUIFeedback } from './UIFeedback';

/// IssueKind та лейбли — синхронізуються з lib/yearlyProgramIssues.ts.
/// Зберігаємо їх дубльовано тут (а не імпортуємо з server-only модуля), бо
/// клієнтський бандл не повинен тягнути prisma. Тип лишається стабільним.
type IssueKind =
  | 'LAUNCH_ACCESS_FAILED'
  | 'LAUNCH_EMAIL_FAILED'
  | 'TG_INVITE_FAILED'
  | 'TG_KICK_FAILED'
  | 'SP_CLOSE_FAILED'
  | 'SP_REOPEN_FAILED';

const ALL_KINDS: IssueKind[] = [
  'LAUNCH_ACCESS_FAILED',
  'LAUNCH_EMAIL_FAILED',
  'TG_INVITE_FAILED',
  'TG_KICK_FAILED',
  'SP_CLOSE_FAILED',
  'SP_REOPEN_FAILED',
];

type Severity = 'critical' | 'warning' | 'info';

interface CatalogEntry {
  severity: Severity;
  icon: string;
  /// Коротка назва для filter-pill і селектів.
  shortTitle: string;
  /// Повний людський заголовок для рядка issue.
  title: string;
  /// Одне-два речення «що сталось» простою мовою менеджера.
  whatHappened: string;
  /// Опційно: важливий side-effect (гроші/доступ/state), на якому варто зробити акцент.
  sideEffects?: string;
  /// Можливі першопричини, від найімовірнішої.
  causes: string[];
  /// Рекомендовані дії в порядку пріоритету.
  actions: string[];
  /// Чи є кнопка «Спробувати ще» (in-app retry, без участі студента).
  hasRetry: boolean;
}

const CATALOG: Record<IssueKind, CatalogEntry> = {
  LAUNCH_ACCESS_FAILED: {
    severity: 'critical',
    icon: '🚀',
    shortTitle: 'Запуск SP-доступу',
    title: 'SendPulse-доступ не відкрито',
    whatHappened:
      'Під час запуску cohort-у система не змогла відкрити студенту доступ до курсу в SendPulse. Студент не зможе зайти на навчання, поки доступ не відкритий.',
    sideEffects:
      'Гроші студента не зачеплено — це збій на стороні SP, а не оплати. Підписка ACTIVE, але без фактичного доступу до матеріалів.',
    causes: [
      'SendPulse API тимчасово недоступний або відповів помилкою.',
      'У змінних оточення невалідний SENDPULSE_YEARLY_COURSE_ID.',
      'Email студента ще не зареєстрований у SendPulse, а автоматична реєстрація провалилась.',
      'Email невалідний або заблокований SendPulse.',
    ],
    actions: [
      'Натисніть «Спробувати ще» у експандері cohort-у або підписки.',
      'У вкладці «Події» підписки знайдіть точний текст відмови SP API.',
      'Якщо повторюється — додайте студента в SendPulse вручну і відкрийте доступ через інтерфейс SP, потім заглушіть issue.',
    ],
    hasRetry: false,
  },
  LAUNCH_EMAIL_FAILED: {
    severity: 'warning',
    icon: '✉️',
    shortTitle: 'Welcome-лист',
    title: 'Welcome-лист не доставлений',
    whatHappened:
      'Доступ до навчання відкритий, але welcome-лист із посиланнями студенту не надіслався. Він може не знати, що навчання вже почалось.',
    causes: [
      'Email студента невалідний або в bounce-листі Resend.',
      'Resend API тимчасово недоступний або вичерпана квота акаунту.',
      'Помилка в HTML-шаблоні листа.',
    ],
    actions: [
      'Використайте «Дослати лист» у модалці запуску (per-recipient resend).',
      'Перевірте написання email у профілі студента.',
      'Подивіться статус доставки у дашборді Resend (deliverability tab).',
      'Якщо адреса неробоча — звʼяжіться зі студентом іншим каналом і попросіть оновити email.',
    ],
    hasRetry: false,
  },
  TG_INVITE_FAILED: {
    severity: 'warning',
    icon: '📨',
    shortTitle: 'TG-запрошення',
    title: 'Telegram-запрошення не згенероване',
    whatHappened:
      'Telegram API відмовив у створенні invite-посилання для цієї підписки — студент не отримав посилання на приватний канал програми.',
    causes: [
      'Бот UIMP не доданий у канал як адмін або не має права «Invite Users».',
      'Telegram API rate-limit (забагато запитів за короткий час).',
      'У налаштуваннях канал-id невалідний або канал видалений.',
    ],
    actions: [
      'Перевірте, що бот UIMP є в каналі як адмін з правом «Запрошувати користувачів».',
      'Натисніть «Спробувати ще» — система перегенерує invite.',
      'Якщо й далі помилка — запросіть студента вручну через Telegram і заглушіть issue.',
    ],
    hasRetry: true,
  },
  TG_KICK_FAILED: {
    severity: 'info',
    icon: '🚪',
    shortTitle: 'TG-видалення',
    title: 'Не вдалося вилучити з Telegram-каналу',
    whatHappened:
      'При спробі видалити студента з каналу (після завершення підписки) Telegram API повернув помилку.',
    causes: [
      'Студент уже сам залишив канал.',
      'Бот втратив права адміна або був видалений з каналу.',
      'Telegram API тимчасово недоступний.',
    ],
    actions: [
      'Подивіться вручну в Telegram, чи студент справді ще в каналі.',
      'Якщо ще там — видаліть через інтерфейс Telegram.',
      'Якщо вже немає — натисніть «Заглушити».',
    ],
    hasRetry: false,
  },
  SP_CLOSE_FAILED: {
    severity: 'info',
    icon: '✕',
    shortTitle: 'SP закриття',
    title: 'Не вдалося закрити SendPulse-доступ',
    whatHappened:
      'Підписка завершилась (EXPIRED), але система не змогла закрити доступ до курсу в SendPulse. Студент потенційно ще бачить матеріали.',
    causes: [
      'SendPulse API недоступний.',
      'Невалідний SENDPULSE_YEARLY_COURSE_ID.',
      'Студент уже видалений з курсу вручну адміністратором SP.',
    ],
    actions: [
      'Перевірте у SP-кабінеті, чи студент ще зареєстрований на курс.',
      'Якщо так — натисніть «Закрити доступ» повторно в експандері підписки.',
      'Якщо вже закрито вручну — натисніть «Заглушити».',
    ],
    hasRetry: false,
  },
  SP_REOPEN_FAILED: {
    severity: 'warning',
    icon: '↻',
    shortTitle: 'SP відкриття',
    title: 'Не вдалося повернути SendPulse-доступ',
    whatHappened:
      'При поверненні студенту доступу (після GRACE або ручної дії «Відкрити доступ») SendPulse API відмовив. Студент чекає доступу.',
    causes: [
      'SendPulse API недоступний.',
      'Невалідний courseId у налаштуваннях.',
      'Студент видалений з SP повністю — треба зареєструвати знову.',
    ],
    actions: [
      'Зачекайте 1–2 хвилини і натисніть «Відкрити доступ» повторно.',
      'Перегляньте стан акаунту студента в SP-кабінеті.',
      'У крайньому разі — додайте студента до курсу вручну в SP.',
    ],
    hasRetry: false,
  },
};

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };

const SEVERITY_META: Record<Severity, { label: string; chipLight: string; chipDark: string; railLight: string; railDark: string }> = {
  critical: {
    label: 'Критична',
    chipLight: 'bg-rose-100 border-rose-300/70 text-rose-900',
    chipDark: 'bg-rose-500/15 border-rose-400/30 text-rose-200',
    railLight: 'before:bg-rose-500',
    railDark: 'before:bg-rose-400/70',
  },
  warning: {
    label: 'Попередження',
    chipLight: 'bg-amber-100 border-amber-300/70 text-amber-900',
    chipDark: 'bg-amber-500/15 border-amber-400/30 text-amber-200',
    railLight: 'before:bg-amber-500',
    railDark: 'before:bg-amber-400/70',
  },
  info: {
    label: 'Інфо',
    chipLight: 'bg-stone-200/70 border-stone-300/60 text-stone-700',
    chipDark: 'bg-white/[0.06] border-white/[0.1] text-slate-300',
    railLight: 'before:bg-stone-400',
    railDark: 'before:bg-slate-500/60',
  },
};

interface IssueRecord {
  subscriptionId: string;
  kind: IssueKind;
  lastOccurredAt: string;
  occurrenceCount: number;
  errorExcerpt: string | null;
  user: { id: string; name: string | null; email: string };
  plan: 'YEARLY' | 'MONTHLY';
  cohortName: string | null;
  dismissedAt: string | null;
  dismissedBy: string | null;
  dismissedReason: string | null;
}

interface IssuesPayload {
  active: IssueRecord[];
  dismissed: IssueRecord[];
  activeCounts: Record<IssueKind, number>;
  activeTotal: number;
}

type Tab = 'active' | 'dismissed';
type PlanFilter = 'ALL' | 'YEARLY' | 'MONTHLY';

export default function IssuesModal({
  theme,
  onClose,
  onOpenSubscription,
}: {
  theme: Theme;
  onClose: () => void;
  /// Колбек у parent — відкрити expanded-row підписки в основній таблиці.
  /// Implementation у YearlyProgramView: scrollIntoView + setExpandedId.
  onOpenSubscription: (subscriptionId: string) => void;
}) {
  const dark = theme === 'dark';
  const router = useRouter();
  const { toast, prompt } = useUIFeedback();
  const [mounted, setMounted] = useState(false);
  const [payload, setPayload] = useState<IssuesPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('active');
  const [kindFilter, setKindFilter] = useState<'ALL' | IssueKind>('ALL');
  const [planFilter, setPlanFilter] = useState<PlanFilter>('ALL');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
    lastFocusRef.current = document.activeElement as HTMLElement | null;
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      lastFocusRef.current?.focus?.();
    };
  }, [onClose]);

  const fetchIssues = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/yearly-program/issues', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) {
        toast('error', data.error ?? res.statusText);
        return;
      }
      setPayload(data as IssuesPayload);
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchIssues(); }, [fetchIssues]);

  const list = useMemo(() => {
    if (!payload) return [];
    const src = tab === 'active' ? payload.active : payload.dismissed;
    const filtered = src.filter((i) => {
      if (kindFilter !== 'ALL' && i.kind !== kindFilter) return false;
      if (planFilter !== 'ALL' && i.plan !== planFilter) return false;
      return true;
    });
    /// Для активних — severity-priority (критичні зверху), для заглушених
    /// зберігаємо сервер-сторонній порядок (за dismissedAt desc).
    if (tab !== 'active') return filtered;
    return [...filtered].sort((a, b) => {
      const sa = SEVERITY_ORDER[CATALOG[a.kind].severity];
      const sb = SEVERITY_ORDER[CATALOG[b.kind].severity];
      if (sa !== sb) return sa - sb;
      return new Date(b.lastOccurredAt).getTime() - new Date(a.lastOccurredAt).getTime();
    });
  }, [payload, tab, kindFilter, planFilter]);

  /// Розбивка активних по severity для заголовку.
  const severityBreakdown = useMemo(() => {
    const acc: Record<Severity, number> = { critical: 0, warning: 0, info: 0 };
    if (!payload) return acc;
    for (const r of payload.active) acc[CATALOG[r.kind].severity] += 1;
    return acc;
  }, [payload]);

  async function handleDismiss(rec: IssueRecord) {
    const reason = await prompt({
      title: `Заглушити issue: ${CATALOG[rec.kind].title}?`,
      description: `Студент: ${rec.user.email}. Issue знову зʼявиться, якщо для цієї підписки виникне нова помилка цього типу після заглушення.`,
      inputLabel: 'Причина (опційно)',
      placeholder: 'Напр.: студент передзвонив, проблему вирішено вручну',
      multiline: true,
      confirmLabel: 'Заглушити',
      cancelLabel: 'Не заглушувати',
    });
    if (reason === null) return;
    const key = `${rec.subscriptionId}::${rec.kind}::dismiss`;
    setBusyKey(key);
    try {
      const res = await fetch('/api/admin/yearly-program/issues/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId: rec.subscriptionId, kind: rec.kind, reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast('error', data.error ?? res.statusText);
        return;
      }
      toast('success', 'Issue заглушено');
      await fetchIssues();
      router.refresh();
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setBusyKey(null);
    }
  }

  async function handleUndismiss(rec: IssueRecord) {
    const key = `${rec.subscriptionId}::${rec.kind}::undismiss`;
    setBusyKey(key);
    try {
      const res = await fetch('/api/admin/yearly-program/issues/undismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId: rec.subscriptionId, kind: rec.kind }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast('error', data.error ?? res.statusText);
        return;
      }
      toast('success', 'Issue повернуто в активні');
      await fetchIssues();
      router.refresh();
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setBusyKey(null);
    }
  }

  async function handleRetry(rec: IssueRecord) {
    if (!CATALOG[rec.kind].hasRetry) return;
    const key = `${rec.subscriptionId}::${rec.kind}::retry`;
    setBusyKey(key);
    try {
      if (rec.kind === 'TG_INVITE_FAILED') {
        const res = await fetch(`/api/admin/yearly-program/${rec.subscriptionId}/telegram-invite`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ force: true, sendEmail: true }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast('error', data.error ?? res.statusText);
          return;
        }
        toast('success', 'Invite перегенеровано і надіслано');
        await fetchIssues();
        router.refresh();
      }
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setBusyKey(null);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="issues-modal-title">
      <div className="absolute inset-0 bg-black/60 animate-[fadeIn_0.15s_ease-out]" onClick={onClose} />
      <div
        className={`relative max-w-5xl w-full max-h-[90vh] flex flex-col rounded-2xl shadow-2xl animate-[dlgIn_0.2s_ease-out] ${
          dark ? 'bg-zinc-900 border border-white/10 text-slate-200' : 'bg-white border border-stone-200 text-stone-800'
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-3 border-b ${dark ? 'border-white/10' : 'border-stone-200'}`}>
          <div className="flex items-center gap-3">
            <HiOutlineExclamationTriangle className={`text-xl ${dark ? 'text-rose-300' : 'text-rose-600'}`} />
            <div className="flex items-baseline gap-2 flex-wrap">
              <h3 id="issues-modal-title" className="text-base font-bold">
                Помилки Річної програми
              </h3>
              {payload && (
                <span className={`text-[12px] font-medium ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
                  · активних: {payload.activeTotal}
                  {payload.activeTotal > 0 && (
                    <>
                      {' '}(
                      {severityBreakdown.critical > 0 && (
                        <span className={dark ? 'text-rose-300' : 'text-rose-700'}>
                          критичних: {severityBreakdown.critical}
                        </span>
                      )}
                      {severityBreakdown.critical > 0 && (severityBreakdown.warning > 0 || severityBreakdown.info > 0) && ', '}
                      {severityBreakdown.warning > 0 && (
                        <span className={dark ? 'text-amber-300' : 'text-amber-700'}>
                          попереджень: {severityBreakdown.warning}
                        </span>
                      )}
                      {severityBreakdown.warning > 0 && severityBreakdown.info > 0 && ', '}
                      {severityBreakdown.info > 0 && (
                        <span>інфо: {severityBreakdown.info}</span>
                      )}
                      )
                    </>
                  )}
                  {' · заглушених: '}{payload.dismissed.length}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={fetchIssues}
              disabled={loading}
              aria-label="Оновити"
              title="Оновити список"
              className={`w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-50 ${
                dark ? 'hover:bg-white/[0.08] text-slate-300' : 'hover:bg-stone-100 text-stone-600'
              }`}
            >
              <HiOutlineArrowPath className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрити"
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                dark ? 'hover:bg-white/[0.08] text-slate-300' : 'hover:bg-stone-100 text-stone-600'
              }`}
            >
              <HiOutlineXMark />
            </button>
          </div>
        </div>

        {/* Tabs + filters */}
        <div className={`px-5 py-3 border-b flex items-center gap-3 flex-wrap ${dark ? 'border-white/10' : 'border-stone-200'}`}>
          <div className={`inline-flex rounded-lg border ${dark ? 'border-white/[0.08] bg-white/[0.02]' : 'border-stone-300/60 bg-stone-50/80'} p-0.5`}>
            <TabBtn label={`Активні ${payload ? `(${payload.activeTotal})` : ''}`} active={tab === 'active'} onClick={() => setTab('active')} dark={dark} />
            <TabBtn label={`Заглушені ${payload ? `(${payload.dismissed.length})` : ''}`} active={tab === 'dismissed'} onClick={() => setTab('dismissed')} dark={dark} />
          </div>

          <div className="h-5 w-px bg-current opacity-10" />

          <div className="flex items-center gap-1.5 flex-wrap">
            <KindPill label="Всі типи" active={kindFilter === 'ALL'} onClick={() => setKindFilter('ALL')} dark={dark} />
            {ALL_KINDS.map((k) => {
              const count = payload && tab === 'active' ? payload.activeCounts[k] : null;
              if (tab === 'active' && count === 0) return null;
              return (
                <KindPill
                  key={k}
                  label={`${CATALOG[k].icon} ${CATALOG[k].shortTitle}${count !== null ? ` · ${count}` : ''}`}
                  active={kindFilter === k}
                  onClick={() => setKindFilter(k)}
                  dark={dark}
                />
              );
            })}
          </div>

          <div className="h-5 w-px bg-current opacity-10" />

          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value as PlanFilter)}
            className={`px-2 py-1 rounded-md border text-[11px] outline-none ${
              dark ? 'bg-white/[0.04] border-white/[0.08] text-slate-200' : 'bg-white/80 border-stone-300/60 text-stone-800'
            }`}
          >
            <option value="ALL">Всі плани</option>
            <option value="YEARLY">Річний</option>
            <option value="MONTHLY">Місячний</option>
          </select>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className={`text-center py-10 text-[13px] ${dark ? 'text-slate-400' : 'text-stone-500'}`}>Завантажуємо…</div>
          ) : list.length === 0 ? (
            <EmptyState dark={dark} tab={tab} hasFilters={kindFilter !== 'ALL' || planFilter !== 'ALL'} />
          ) : (
            <div className="space-y-2.5">
              {list.map((rec) => (
                <IssueRow
                  key={`${rec.subscriptionId}::${rec.kind}`}
                  rec={rec}
                  tab={tab}
                  dark={dark}
                  busyKey={busyKey}
                  onOpenSubscription={() => { onOpenSubscription(rec.subscriptionId); onClose(); }}
                  onDismiss={() => handleDismiss(rec)}
                  onUndismiss={() => handleUndismiss(rec)}
                  onRetry={() => handleRetry(rec)}
                />
              ))}
            </div>
          )}
        </div>

        <style>{`
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes dlgIn { from { opacity: 0; transform: translateY(8px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        `}</style>
      </div>
    </div>,
    document.body,
  );
}

function TabBtn({ label, active, onClick, dark }: { label: string; active: boolean; onClick: () => void; dark: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 text-[12px] font-semibold rounded-md transition-colors ${
        active
          ? dark ? 'bg-white/10 text-white' : 'bg-white text-stone-900 shadow-sm'
          : dark ? 'text-slate-400 hover:text-slate-200' : 'text-stone-500 hover:text-stone-800'
      }`}
    >
      {label}
    </button>
  );
}

function KindPill({ label, active, onClick, dark }: { label: string; active: boolean; onClick: () => void; dark: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
        active
          ? dark ? 'bg-rose-500/15 border-rose-400/40 text-rose-200' : 'bg-rose-100 border-rose-300/70 text-rose-900'
          : dark ? 'bg-white/[0.03] border-white/[0.06] text-slate-400 hover:bg-white/[0.06] hover:text-slate-200' : 'bg-white/70 border-stone-300/40 text-stone-600 hover:bg-stone-50 hover:text-stone-900'
      }`}
    >
      {label}
    </button>
  );
}

function EmptyState({ dark, tab, hasFilters }: { dark: boolean; tab: Tab; hasFilters: boolean }) {
  return (
    <div className={`text-center py-14 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
      <HiOutlineCheckCircle className={`mx-auto text-3xl mb-2 ${dark ? 'text-emerald-400/60' : 'text-emerald-600/70'}`} />
      <div className="text-[13px] font-medium">
        {hasFilters
          ? 'Нічого не знайдено за фільтрами'
          : tab === 'active' ? 'Помилок немає — все працює коректно' : 'Немає заглушених issue-ів'}
      </div>
    </div>
  );
}

function IssueRow({
  rec,
  tab,
  dark,
  busyKey,
  onOpenSubscription,
  onDismiss,
  onUndismiss,
  onRetry,
}: {
  rec: IssueRecord;
  tab: Tab;
  dark: boolean;
  busyKey: string | null;
  onOpenSubscription: () => void;
  onDismiss: () => void;
  onUndismiss: () => void;
  onRetry: () => void;
}) {
  const dismissBusy = busyKey === `${rec.subscriptionId}::${rec.kind}::dismiss`;
  const undismissBusy = busyKey === `${rec.subscriptionId}::${rec.kind}::undismiss`;
  const retryBusy = busyKey === `${rec.subscriptionId}::${rec.kind}::retry`;
  const anyBusy = !!busyKey && busyKey.startsWith(`${rec.subscriptionId}::${rec.kind}::`);

  const entry = CATALOG[rec.kind];
  const sev = SEVERITY_META[entry.severity];
  /// Активні розкриваємо за замовчуванням (менеджер прийшов сюди діяти),
  /// заглушені — згорнутими (це довідник).
  const [expanded, setExpanded] = useState(tab === 'active');
  const [techOpen, setTechOpen] = useState(false);

  return (
    <div
      className={`relative rounded-lg border overflow-hidden pl-3.5 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 ${
        dark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-stone-300/40 bg-white/80'
      } ${dark ? sev.railDark : sev.railLight}`}
    >
      <div className="p-3 pl-2 flex items-start gap-3">
        <div className="text-[18px] leading-none mt-0.5">{entry.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[13px] font-semibold ${dark ? 'text-slate-100' : 'text-stone-900'}`}>
              {entry.title}
            </span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded border font-medium uppercase tracking-wider ${
                dark ? sev.chipDark : sev.chipLight
              }`}
            >
              {sev.label}
            </span>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className={`inline-flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded transition-colors ${
                dark ? 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]' : 'text-stone-500 hover:text-stone-800 hover:bg-stone-100'
              }`}
              aria-expanded={expanded}
            >
              {expanded ? <HiOutlineChevronUp /> : <HiOutlineChevronDown />}
              {expanded ? 'Сховати деталі' : 'Деталі'}
            </button>
          </div>
          <div className={`mt-1 text-[11px] flex flex-wrap items-center gap-x-2 gap-y-0.5 ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
            <span className={dark ? 'text-slate-300' : 'text-stone-700'}>
              {rec.user.name ?? rec.user.email}
            </span>
            <span className={dark ? 'text-slate-500' : 'text-stone-500'}>{rec.user.email}</span>
            {rec.cohortName && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${dark ? 'bg-white/[0.04] text-slate-400' : 'bg-stone-100 text-stone-600'}`}>
                {rec.cohortName}
              </span>
            )}
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${dark ? 'bg-white/[0.04] text-slate-400' : 'bg-stone-100 text-stone-600'}`}>
              {rec.plan}
            </span>
          </div>
          <div className={`mt-1 text-[11px] ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
            {tab === 'active' ? (
              <>
                Останній прояв: <span className="tabular-nums">{fmtDateTime(rec.lastOccurredAt)}</span>
                {rec.occurrenceCount > 1 && <> · повторень: {rec.occurrenceCount}</>}
              </>
            ) : (
              <>
                Заглушено: <span className="tabular-nums">{fmtDateTime(rec.dismissedAt!)}</span>
                {rec.dismissedBy && <> · ким: {rec.dismissedBy}</>}
                {rec.dismissedReason && <> · причина: «{rec.dismissedReason}»</>}
              </>
            )}
          </div>
        </div>
      <div className="flex flex-col items-stretch gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onOpenSubscription}
          disabled={anyBusy}
          className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-md border transition-colors disabled:opacity-50 ${
            dark ? 'bg-white/[0.04] border-white/[0.08] text-slate-200 hover:bg-white/[0.08]' : 'bg-white border-stone-300/60 text-stone-700 hover:bg-stone-50'
          }`}
          title="Відкрити підписку у таблиці"
        >
          <HiOutlineArrowTopRightOnSquare /> Відкрити
        </button>
        {tab === 'active' && CATALOG[rec.kind].hasRetry && (
          <button
            type="button"
            onClick={onRetry}
            disabled={anyBusy}
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-md border transition-colors disabled:opacity-50 ${
              dark ? 'bg-sky-500/10 border-sky-400/30 text-sky-200 hover:bg-sky-500/20' : 'bg-sky-50 border-sky-300/60 text-sky-900 hover:bg-sky-100'
            }`}
          >
            <HiOutlineArrowPath className={retryBusy ? 'animate-spin' : ''} /> Спробувати ще
          </button>
        )}
        {tab === 'active' ? (
          <button
            type="button"
            onClick={onDismiss}
            disabled={anyBusy}
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-md border transition-colors disabled:opacity-50 ${
              dark ? 'bg-amber-400/10 border-amber-400/30 text-amber-200 hover:bg-amber-400/20' : 'bg-amber-50 border-amber-300/60 text-amber-900 hover:bg-amber-100'
            }`}
          >
            <HiOutlineEyeSlash />
            {dismissBusy ? '…' : 'Заглушити'}
          </button>
        ) : (
          <button
            type="button"
            onClick={onUndismiss}
            disabled={anyBusy}
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-md border transition-colors disabled:opacity-50 ${
              dark ? 'bg-white/[0.04] border-white/[0.08] text-slate-200 hover:bg-white/[0.08]' : 'bg-white border-stone-300/60 text-stone-700 hover:bg-stone-50'
            }`}
          >
            <HiOutlineEye />
            {undismissBusy ? '…' : 'Повернути в активні'}
          </button>
        )}
      </div>
      </div>

      {expanded && (
        <div
          className={`px-3 pb-3 pt-0 border-t text-[12px] leading-snug space-y-3 ${
            dark ? 'border-white/[0.06] bg-black/10' : 'border-stone-300/40 bg-stone-50/40'
          }`}
        >
          <Section label="Що сталось" dark={dark}>
            <p className={dark ? 'text-slate-300' : 'text-stone-700'}>{entry.whatHappened}</p>
            {entry.sideEffects && (
              <p
                className={`mt-1.5 italic ${dark ? 'text-slate-400' : 'text-stone-600'}`}
              >
                {entry.sideEffects}
              </p>
            )}
          </Section>

          <Section label="Можливі причини" dark={dark}>
            <ul className={`list-disc pl-4 space-y-1 ${dark ? 'text-slate-300' : 'text-stone-700'}`}>
              {entry.causes.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </Section>

          <Section label="Що зробити" dark={dark}>
            <ol className={`list-decimal pl-4 space-y-1 ${dark ? 'text-slate-200' : 'text-stone-800'}`}>
              {entry.actions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ol>
          </Section>

          {rec.errorExcerpt && (
            <div>
              <button
                type="button"
                onClick={() => setTechOpen((v) => !v)}
                className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold ${
                  dark ? 'text-slate-400 hover:text-slate-200' : 'text-stone-500 hover:text-stone-700'
                }`}
                aria-expanded={techOpen}
              >
                {techOpen ? <HiOutlineChevronUp /> : <HiOutlineChevronDown />}
                Технічна деталь
              </button>
              {techOpen && (
                <pre
                  className={`mt-1.5 text-[11px] font-mono break-words whitespace-pre-wrap rounded-md p-2.5 ${
                    dark ? 'bg-black/30 text-rose-200/90 border border-white/[0.05]' : 'bg-stone-100 text-rose-800/90 border border-stone-200'
                  }`}
                >
                  {rec.errorExcerpt}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ label, children, dark }: { label: string; children: React.ReactNode; dark: boolean }) {
  return (
    <div>
      <div
        className={`text-[10px] uppercase tracking-[0.14em] font-semibold mb-1 ${
          dark ? 'text-slate-500' : 'text-stone-500'
        }`}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('uk-UA', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
