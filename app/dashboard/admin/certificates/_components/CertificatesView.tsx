'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  HiOutlineDocumentText,
  HiOutlineAcademicCap,
  HiOutlineClock,
  HiOutlineArrowPath,
  HiOutlinePaperAirplane,
  HiOutlineXCircle,
  HiOutlineEye,
  HiOutlineArrowsPointingOut,
  HiOutlineArrowsPointingIn,
  HiOutlinePlus,
  HiOutlineExclamationTriangle,
  HiOutlineCheckCircle,
  HiOutlineTrash,
  HiOutlineInformationCircle,
  HiOutlineCircleStack,
  HiOutlineCloudArrowDown,
  HiOutlineUsers,
} from 'react-icons/hi2';
import { useAdminTheme, type Theme } from '../../_components/adminTheme';
import { AdminShell, AdminPanel } from '../../_components/AdminShell';
import YearlyInfoModal from './YearlyInfoModal';
import CoursesInfoModal from './CoursesInfoModal';

type TabKey = 'courses' | 'yearly' | 'supervision' | 'history' | 'issues';

type CertificateType = 'COURSE' | 'YEARLY_PROGRAM' | 'SUPERVISION';
type CertCategory = 'LISTENER' | 'PRACTICAL';
type EmailStatus = 'PENDING' | 'SENT' | 'FAILED' | 'BOUNCED';

interface CourseCandidate {
  userId: string;
  userName: string | null;
  userEmail: string;
  courseId: string;
  courseTitle: string;
  sendpulseCourseId: number | null;
  enrolledAt: string;
  spProgressPercent: number | null;
  spProgressCheckedAt: string | null;
  certificate: {
    id: string;
    certNumber: string;
    emailStatus: EmailStatus;
    emailFromAddress: string | null;
    issuedAt: string;
    issuedManually: boolean;
    revoked: boolean;
  } | null;
}

interface YearlyCandidate {
  subscriptionId: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  plan: 'YEARLY' | 'MONTHLY';
  status: string;
  startDate: string | null;
  expiresAt: string | null;
  paidCount: number;
  expectedPayments: number;
  paymentHealth: 'FULL' | 'PARTIAL' | 'NONE';
  spProgressPercent: number | null;
  spProgressCheckedAt: string | null;
  certificate: {
    id: string;
    certNumber: string;
    category: CertCategory | null;
    emailStatus: EmailStatus;
    emailFromAddress: string | null;
    issuedAt: string;
  } | null;
}

interface HistoryEvent {
  id: string;
  certificateId: string;
  actorName: string | null;
  actorEmail: string | null;
  action: string;
  message: string | null;
  createdAt: string;
  certificate: {
    id: string;
    certNumber: string;
    type: CertificateType;
    category: CertCategory | null;
    recipientName: string;
    recipientEmail: string;
    courseName: string | null;
    revoked: boolean;
  };
}

interface SupervisionCertificate {
  id: string;
  certNumber: string;
  recipientName: string;
  recipientEmail: string;
  /// Тема супервізії (друкується як subject на серті); зберігається у courseName-полі.
  courseName: string | null;
  supervisionDate: string | null;
  supervisionHours: number | null;
  issueYear: number;
  issuedAt: string;
  issuedByName: string | null;
  issuedByEmail: string | null;
  emailStatus: EmailStatus;
  emailSentAt: string | null;
  emailFromAddress: string | null;
  revoked: boolean;
}

const TABS: Array<{ key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'courses', label: 'Курси', icon: HiOutlineDocumentText },
  { key: 'yearly', label: 'Річна програма', icon: HiOutlineAcademicCap },
  { key: 'supervision', label: 'Супервізія', icon: HiOutlineUsers },
  { key: 'history', label: 'Історія', icon: HiOutlineClock },
  { key: 'issues', label: 'Помилки', icon: HiOutlineExclamationTriangle },
];

export default function CertificatesView() {
  const { theme, setTheme } = useAdminTheme();
  /// Активна вкладка персиститься у URL `?tab=...`, щоб refresh не скидав на courses.
  /// Початковий стейт — courses (SSR-safe); URL читаємо у useEffect після маунту.
  const [activeTab, setActiveTabState] = useState<TabKey>('courses');
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    if (
      t === 'courses' || t === 'yearly' || t === 'supervision' ||
      t === 'history' || t === 'issues'
    ) {
      setActiveTabState(t);
    }
  }, []);
  const setActiveTab = useCallback((tab: TabKey) => {
    setActiveTabState(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.replaceState(null, '', url.toString());
    }
  }, []);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <AdminShell
      theme={theme}
      setTheme={setTheme}
      title="Сертифікати"
      eyebrow="Admin · Сертифікати"
      maxWidth="max-w-[1400px]"
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Tabs theme={theme} active={activeTab} onChange={setActiveTab} />
      </div>

      <div className="mt-6">
        {activeTab === 'courses' && <CoursesTab theme={theme} pushToast={setToast} />}
        {activeTab === 'yearly' && <YearlyTab theme={theme} graceDays={graceDays} pushToast={setToast} />}
        {activeTab === 'supervision' && <SupervisionTab theme={theme} pushToast={setToast} />}
        {activeTab === 'history' && <HistoryTab theme={theme} />}
        {activeTab === 'issues' && <IssuesTab theme={theme} pushToast={setToast} />}
      </div>

      {toast && <Toast theme={theme} toast={toast} />}
    </AdminShell>
  );
}

/* ------------------------------- UI primitives ----------------------------- */

function Tabs({
  theme,
  active,
  onChange,
}: {
  theme: Theme;
  active: TabKey;
  onChange: (k: TabKey) => void;
}) {
  const dark = theme === 'dark';
  return (
    <div
      className={`inline-flex rounded-xl border p-1 ${dark ? 'bg-white/[0.03] border-white/[0.08]' : 'bg-white/70 border-stone-200/70'}`}
    >
      {TABS.map(({ key, label, icon: Icon }) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${
              isActive
                ? dark
                  ? 'bg-amber-500/20 text-amber-100 shadow-inner'
                  : 'bg-amber-500 text-white shadow-md'
                : dark
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Icon className="text-[16px]" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

function Toast({ theme, toast }: { theme: Theme; toast: { type: 'success' | 'error'; msg: string } }) {
  const dark = theme === 'dark';
  const palette =
    toast.type === 'success'
      ? dark
        ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-100'
        : 'bg-emerald-50 border-emerald-300 text-emerald-900'
      : dark
        ? 'bg-red-500/20 border-red-400/40 text-red-100'
        : 'bg-red-50 border-red-300 text-red-900';
  return (
    <div
      className={`fixed top-24 right-5 z-50 px-4 py-3 rounded-xl border shadow-xl max-w-sm ${palette}`}
    >
      {toast.msg}
    </div>
  );
}

function StatusBadge({ theme, status, revoked }: { theme: Theme; status: EmailStatus; revoked: boolean }) {
  const dark = theme === 'dark';
  if (revoked) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider ${
          dark ? 'bg-red-500/20 text-red-200' : 'bg-red-100 text-red-800'
        }`}
      >
        Відкликано
      </span>
    );
  }
  const map: Record<EmailStatus, { light: string; dark: string; label: string }> = {
    SENT: { light: 'bg-emerald-100 text-emerald-800', dark: 'bg-emerald-500/20 text-emerald-200', label: 'Відправлено' },
    PENDING: { light: 'bg-amber-100 text-amber-800', dark: 'bg-amber-500/20 text-amber-200', label: 'Очікує' },
    FAILED: { light: 'bg-red-100 text-red-800', dark: 'bg-red-500/20 text-red-200', label: 'Помилка' },
    BOUNCED: { light: 'bg-orange-100 text-orange-800', dark: 'bg-orange-500/20 text-orange-200', label: 'Bounce' },
  };
  const s = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider ${dark ? s.dark : s.light}`}
    >
      {s.label}
    </span>
  );
}

/// Хук-кеш для списків кандидатів. На першу загрузку (немає кешу) робить fetch автоматично;
/// після того дані живуть у localStorage до явного refresh() АБО до закінчення TTL (24 год).
/// TTL стандартизує "раз на день" — синхронно з добовим SP cron (04:30 UTC). Дає миттєвий
/// рендер при поверненні протягом дня, але не дозволяє кешу гнити тижнями.
///
/// Окрім списку `items`, fetcher може повертати `meta` — довільні системні поля, які не
/// є частиною елементів списку (наприклад, `latestSpCheckedAt` — глобальний таймстемп
/// останнього SP-sync, який не залежить від того, які кандидати в даний момент видимі).
/// Версія кешу 2: shape змінився з `T[]` на `{ items, meta }`.
const CACHE_VERSION = 2;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 години

type CachedPayload<T, M> = { items: T[]; meta: M | null };

function readCache<T, M>(key: string): { payload: CachedPayload<T, M>; lastUpdated: number } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      v?: number;
      items?: T[];
      meta?: M | null;
      lastUpdated?: number;
    };
    if (parsed.v !== CACHE_VERSION || !Array.isArray(parsed.items) || typeof parsed.lastUpdated !== 'number') {
      return null;
    }
    return {
      payload: { items: parsed.items, meta: (parsed.meta ?? null) as M | null },
      lastUpdated: parsed.lastUpdated,
    };
  } catch {
    return null;
  }
}

function writeCache<T, M>(key: string, payload: CachedPayload<T, M>, lastUpdated: number) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      key,
      JSON.stringify({ v: CACHE_VERSION, items: payload.items, meta: payload.meta, lastUpdated }),
    );
  } catch {
    // ignore (quota / private mode)
  }
}

function useCachedList<T, M = null>(
  cacheKey: string,
  fetcher: () => Promise<CachedPayload<T, M>>,
) {
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  /// ВАЖЛИВО: початковий стан мусить збігатися на сервері й клієнті, інакше — hydration mismatch.
  /// Тому НЕ читаємо localStorage в useState init. Спочатку null/[]; потім у useEffect (тільки клієнт)
  /// підвантажуємо кеш або стартуємо перший fetch.
  const [items, setItems] = useState<T[]>([]);
  const [meta, setMeta] = useState<M | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const fresh = await fetcherRef.current();
      const ts = Date.now();
      setItems(fresh.items);
      setMeta(fresh.meta);
      setLastUpdated(ts);
      writeCache(cacheKey, fresh, ts);
    } finally {
      setLoading(false);
    }
  }, [cacheKey]);

  useEffect(() => {
    const cached = readCache<T, M>(cacheKey);
    if (cached) {
      setItems(cached.payload.items);
      setMeta(cached.payload.meta);
      setLastUpdated(cached.lastUpdated);
      /// Якщо кешу > 24 год — фоново оновлюємо. Користувач при цьому одразу бачить кеш,
      /// а свіжі дані прилітають через секунду без скролу loading-екрану.
      if (Date.now() - cached.lastUpdated > CACHE_TTL_MS) {
        void refresh();
      }
    } else {
      void refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /// Локальне мутування кешу — без походу в мережу. Використовується після Issue/Revoke/Resend
  /// щоб моментально оновити рядок без повного refetch.
  const patchItem = useCallback((predicate: (item: T) => boolean, patch: (item: T) => T) => {
    setItems((prev) => {
      const next = prev.map((item) => (predicate(item) ? patch(item) : item));
      writeCache(cacheKey, { items: next, meta }, lastUpdated ?? Date.now());
      return next;
    });
  }, [cacheKey, lastUpdated, meta]);

  return { items, meta, loading, lastUpdated, refresh, patchItem, setItems };
}

function formatAgo(ts: number | null): string {
  if (ts === null) return '—';
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'щойно';
  if (min < 60) return `${min} хв тому`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} год тому`;
  const d = Math.floor(hr / 24);
  return `${d} дн тому`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

/// Уніфікована "карточка синхронізації" — використовується для обох потоків даних
/// (наша БД + SendPulse). Структура: іконка, лейбл, таймстемп "X тому", кнопка
/// ручного запуску. Колір (`tone`) кодує джерело: slate = наша БД, emerald = SP.
function SyncCard({
  theme,
  tone,
  icon,
  label,
  description,
  lastUpdated,
  onRun,
  running,
  runLabel,
  runTitle,
}: {
  theme: Theme;
  tone: 'slate' | 'emerald';
  icon: React.ReactNode;
  label: string;
  description?: string;
  lastUpdated: number | null;
  onRun: () => void;
  running: boolean;
  runLabel: string;
  runTitle?: string;
}) {
  const dark = theme === 'dark';

  // Tick-стейт для перерахунку relative-таймстемпу "X хв тому".
  // formatAgo(lastUpdated) обчислюється на render-time через Date.now() — без
  // тригера re-render текст застрягне на початковому значенні. Локально HMR
  // частіше ре-рендерить, тому виглядає нормально; на проді — статика.
  // Інтервал 30с — достатньо для секунда/хвилина-зернистості.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (lastUpdated === null) return;
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  const palette =
    tone === 'emerald'
      ? {
          ringDark: 'border-emerald-500/30 bg-emerald-500/[0.07]',
          ringLight: 'border-emerald-300/70 bg-emerald-50/60',
          chipDark: 'bg-emerald-500/15 text-emerald-300',
          chipLight: 'bg-emerald-100 text-emerald-700',
          btnDark: 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 border-emerald-500/30',
          btnLight: 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border-emerald-300',
        }
      : {
          ringDark: 'border-white/[0.08] bg-white/[0.03]',
          ringLight: 'border-stone-300/60 bg-white/70',
          chipDark: 'bg-white/[0.07] text-slate-300',
          chipLight: 'bg-stone-100 text-stone-700',
          btnDark: 'bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 border-white/[0.1]',
          btnLight: 'bg-white hover:bg-stone-50 text-stone-800 border-stone-300',
        };

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 rounded-xl border ${dark ? palette.ringDark : palette.ringLight}`}
      title={
        lastUpdated
          ? `Останнє оновлення: ${formatDate(new Date(lastUpdated).toISOString())}`
          : 'Ще не запускалось'
      }
    >
      <span
        className={`flex-shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg ${dark ? palette.chipDark : palette.chipLight}`}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <div className={`text-[11.5px] font-semibold uppercase tracking-wider leading-none ${dark ? 'text-slate-200' : 'text-stone-700'}`}>
          {label}
        </div>
        <div className={`text-[12px] mt-1 ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
          {lastUpdated ? `оновлено ${formatAgo(lastUpdated)}` : 'не синхронізовано'}
          {description && (
            <span className={dark ? 'text-slate-500' : 'text-stone-400'}> · {description}</span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onRun}
        disabled={running}
        title={runTitle ?? runLabel}
        className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[12.5px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${dark ? palette.btnDark : palette.btnLight}`}
      >
        <HiOutlineArrowPath className={`w-4 h-4 ${running ? 'animate-spin' : ''}`} />
        {running ? 'Виконую…' : runLabel}
      </button>
    </div>
  );
}

function formatDateOnly(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

/// Коротке відображення тривалості: «2 год» / «1.5 год».
function formatHoursShort(h: number): string {
  if (!Number.isFinite(h)) return '';
  const rounded = Math.round(h * 10) / 10;
  const display = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace('.', ',');
  return `${display} год`;
}

/// Дістає чистий email з "Display Name <email@domain>" формату (RESEND_FROM_EMAIL).
function extractEmail(addr: string | null): string {
  if (!addr) return '';
  const m = /^(.+?)\s*<([^>]+)>$/.exec(addr);
  return (m?.[2] ?? addr).trim();
}

/// Колонка "Курс завершено" — % прогресу з SendPulse, оновлюється щоденним cron-ом.
function ProgressCell({
  theme,
  percent,
  checkedAt,
  hasSp,
}: {
  theme: Theme;
  percent: number | null;
  checkedAt: string | null;
  hasSp: boolean;
}) {
  const dark = theme === 'dark';
  if (!hasSp) {
    return (
      <span
        className={`text-[11px] italic ${dark ? 'text-slate-500' : 'text-stone-400'}`}
        title="У курсу не вказано sendpulseCourseId — прогрес не відстежується"
      >
        без SP
      </span>
    );
  }
  if (percent == null) {
    return (
      <span
        className={`text-[12px] ${dark ? 'text-slate-500' : 'text-stone-400'}`}
        title="Cron ще не перевіряв цього учасника"
      >
        —
      </span>
    );
  }

  const isDone = percent >= 100;
  const barColor = isDone
    ? 'bg-emerald-500'
    : percent >= 50
      ? 'bg-amber-500'
      : 'bg-stone-400';
  const textColor = isDone
    ? dark
      ? 'text-emerald-300'
      : 'text-emerald-700'
    : dark
      ? 'text-slate-200'
      : 'text-stone-700';

  return (
    <div
      className="min-w-[78px]"
      title={
        checkedAt
          ? `Перевірено: ${formatDate(checkedAt)}`
          : 'Прогрес з SendPulse'
      }
    >
      <div className={`text-[12px] font-semibold ${textColor}`}>
        {isDone ? '100% ✓' : `${percent}%`}
      </div>
      <div
        className={`mt-1 h-1.5 rounded-full overflow-hidden ${dark ? 'bg-white/[0.06]' : 'bg-stone-200'}`}
      >
        <div
          className={`h-full ${barColor} transition-all`}
          style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
        />
      </div>
    </div>
  );
}

/* -------------------------------- Courses Tab ------------------------------ */

function CoursesTab({
  theme,
  pushToast,
}: {
  theme: Theme;
  pushToast: (t: { type: 'success' | 'error'; msg: string }) => void;
}) {
  const dark = theme === 'dark';
  const { items: candidates, meta, loading, lastUpdated, refresh: fetchList } =
    useCachedList<CourseCandidate, { latestSpCheckedAt: string | null }>(
      'cert-courses-v2',
      async () => {
        const res = await fetch('/api/admin/certificates/course');
        const data = await res.json();
        return {
          items: (data.candidates ?? []) as CourseCandidate[],
          meta: { latestSpCheckedAt: data.latestSpCheckedAt ?? null },
        };
      },
    );
  const [search, setSearch] = useState('');
  const [issuedFilter, setIssuedFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [showIssue, setShowIssue] = useState(false);
  const [issueFor, setIssueFor] = useState<CourseCandidate | null>(null);
  const [runningSp, setRunningSp] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const courses = useMemo(() => {
    const map = new Map<string, string>();
    candidates.forEach((c) => map.set(c.courseId, c.courseTitle));
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [candidates]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return candidates.filter((c) => {
      if (courseFilter !== 'all' && c.courseId !== courseFilter) return false;
      if (issuedFilter === 'yes' && !c.certificate) return false;
      if (issuedFilter === 'no' && c.certificate) return false;
      if (s) {
        const hay = `${c.userName ?? ''} ${c.userEmail} ${c.courseTitle}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [candidates, search, issuedFilter, courseFilter]);

  /// Останній SP-sync — системний таймстемп з API (max `spProgressCheckedAt` серед усіх
  /// живих enrollments із SP-курсами, не залежить від видимості рядків після фільтрів
  /// чи приховування ADMIN/MANAGER-тестових покупок).
  const latestSpCheck = useMemo<number | null>(() => {
    const iso = meta?.latestSpCheckedAt;
    return iso ? new Date(iso).getTime() : null;
  }, [meta]);

  async function handleResend(certId: string, key: string) {
    setBusyKey(key);
    try {
      const res = await fetch(`/api/admin/certificates/${certId}/resend`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Помилка');
      pushToast({ type: 'success', msg: 'Лист перевідправлено' });
      fetchList();
    } catch (err) {
      pushToast({ type: 'error', msg: err instanceof Error ? err.message : 'Помилка' });
    } finally {
      setBusyKey(null);
    }
  }

  async function runSpCheck() {
    setRunningSp(true);
    try {
      const res = await fetch('/api/admin/certificates/run-course-cron', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Помилка');
      type StepResult = {
        courseTitle: string;
        completedStudents: number;
        matchedUsers: number;
        newCertificates: number;
        skippedAlreadyIssued: number;
        errors: string[];
      };
      const results = (data.results ?? []) as StepResult[];
      const totalNew = results.reduce((s, r) => s + r.newCertificates, 0);
      const totalErr = results.reduce((s, r) => s + r.errors.length, 0);
      const summary = `Курсів: ${data.coursesProcessed}. Видано: ${totalNew}. Помилок: ${totalErr}.`;
      pushToast({ type: totalErr > 0 ? 'error' : 'success', msg: summary });
      fetchList();
    } catch (err) {
      pushToast({ type: 'error', msg: err instanceof Error ? err.message : 'Помилка' });
    } finally {
      setRunningSp(false);
    }
  }

  async function handleRevoke(certId: string, key: string) {
    const reason = window.prompt('Причина відклику (опційно):') ?? undefined;
    if (!window.confirm('Точно відкликати сертифікат? Дію видно публічно.')) return;
    setBusyKey(key);
    try {
      const res = await fetch(`/api/admin/certificates/${certId}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Помилка');
      pushToast({ type: 'success', msg: 'Сертифікат відкликано' });
      fetchList();
    } catch (err) {
      pushToast({ type: 'error', msg: err instanceof Error ? err.message : 'Помилка' });
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <AdminPanel theme={theme}>
      {/* Row 1 — Синхронізація даних (наша БД + SendPulse) + дії */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <SyncCard
            theme={theme}
            tone="slate"
            icon={<HiOutlineCircleStack className="w-5 h-5" />}
            label="Наша БД"
            description={`${candidates.length} покупців`}
            lastUpdated={lastUpdated}
            onRun={fetchList}
            running={loading}
            runLabel="Оновити"
            runTitle="Перезавантажити список покупців з нашої БД (підтягне нові покупки)"
          />
          <SyncCard
            theme={theme}
            tone="emerald"
            icon={<HiOutlineCloudArrowDown className="w-5 h-5" />}
            label="SendPulse"
            description="прогрес курсів"
            lastUpdated={latestSpCheck}
            onRun={runSpCheck}
            running={runningSp}
            runLabel="Синхронізувати"
            runTitle="Запитати у SendPulse прогрес усіх студентів і авто-видати сертифікати тим, хто на 100%"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setIssueFor(null); setShowIssue(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 text-white text-[13px] font-semibold shadow-md hover:shadow-lg transition-shadow"
          >
            <HiOutlinePlus className="text-[16px]" />
            Видати сертифікат
          </button>
          <button
            type="button"
            onClick={() => setShowInfo(true)}
            title="Як працюють Курси — довідник для менеджерів"
            aria-label="Довідник"
            className={`inline-flex items-center justify-center w-9 h-9 rounded-full border transition-colors ${dark ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20' : 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'}`}
          >
            <HiOutlineInformationCircle className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Row 2 — Фільтри + лічильник */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
        <div className="flex items-center gap-2 flex-wrap">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Пошук: ім'я, email, курс…"
            className={`px-3 py-2 rounded-lg border text-[13px] min-w-[280px] ${dark ? 'bg-white/[0.04] border-white/[0.1] text-white placeholder-slate-500' : 'bg-white border-stone-300 text-stone-900'}`}
          />
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className={`px-3 py-2 rounded-lg border text-[13px] max-w-[260px] ${dark ? 'bg-white/[0.04] border-white/[0.1] text-white' : 'bg-white border-stone-300 text-stone-900'}`}
          >
            <option value="all">Всі курси</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
          <select
            value={issuedFilter}
            onChange={(e) => setIssuedFilter(e.target.value as 'all' | 'yes' | 'no')}
            className={`px-3 py-2 rounded-lg border text-[13px] ${dark ? 'bg-white/[0.04] border-white/[0.1] text-white' : 'bg-white border-stone-300 text-stone-900'}`}
          >
            <option value="all">Усі</option>
            <option value="yes">Серт виданий</option>
            <option value="no">Серт не виданий</option>
          </select>
        </div>
        <span className={`text-[12px] ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
          показано <strong className={dark ? 'text-slate-200' : 'text-stone-700'}>{filtered.length}</strong> з {candidates.length}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl">
        <table className="w-full text-[13px]">
          <thead className={`text-left text-[11px] uppercase tracking-wider ${dark ? 'text-slate-400 border-b border-white/[0.06]' : 'text-stone-500 border-b border-stone-200'}`}>
            <tr>
              <Th>Покупець</Th>
              <Th>Курс</Th>
              <Th>SendPulse</Th>
              <Th>Куплено</Th>
              <Th>Курс завершено</Th>
              <Th>Сертифікат</Th>
              <Th>Статус</Th>
              <Th>Лист надійшов з</Th>
              <Th>Дії</Th>
            </tr>
          </thead>
          <tbody className={dark ? 'divide-y divide-white/[0.04]' : 'divide-y divide-stone-200/60'}>
            {loading && candidates.length === 0 && (
              <tr><td colSpan={9} className={`py-8 text-center ${dark ? 'text-slate-400' : 'text-stone-500'}`}>Завантаження…</td></tr>
            )}
            {!loading && lastUpdated !== null && filtered.length === 0 && (
              <tr><td colSpan={9} className={`py-8 text-center ${dark ? 'text-slate-400' : 'text-stone-500'}`}>Немає даних</td></tr>
            )}
            {filtered.map((c) => {
              const key = `${c.userId}_${c.courseId}`;
              const cert = c.certificate;
              const busy = busyKey === key;
              return (
                <tr key={key} className={dark ? 'hover:bg-white/[0.02]' : 'hover:bg-stone-50/70'}>
                  <td className="py-3 pr-3">
                    <div className="font-medium">{c.userName ?? '—'}</div>
                    <div className={`text-[11px] ${dark ? 'text-slate-400' : 'text-stone-500'}`}>{c.userEmail}</div>
                  </td>
                  <td className="py-3 pr-3 max-w-[280px]">
                    <div className="truncate" title={c.courseTitle}>{c.courseTitle}</div>
                  </td>
                  <td className="py-3 pr-3">
                    {c.sendpulseCourseId ? (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${dark ? 'bg-emerald-500/20 text-emerald-200' : 'bg-emerald-100 text-emerald-800'}`} title={`SP courseId: ${c.sendpulseCourseId}`}>
                        <HiOutlineCheckCircle className="w-3 h-3" /> Авто
                      </span>
                    ) : (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${dark ? 'bg-white/[0.06] text-slate-400' : 'bg-stone-100 text-stone-500'}`} title="Без SP — лише ручна видача">
                        Ручна
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-3 whitespace-nowrap">{formatDate(c.enrolledAt)}</td>
                  <td className="py-3 pr-3">
                    <ProgressCell
                      theme={theme}
                      percent={c.spProgressPercent}
                      checkedAt={c.spProgressCheckedAt}
                      hasSp={c.sendpulseCourseId != null}
                    />
                  </td>
                  <td className="py-3 pr-3">
                    {cert ? (
                      <div>
                        <div className="font-mono text-[11px]">{cert.certNumber}</div>
                        <div className={`text-[10px] mt-0.5 ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
                          {cert.issuedManually ? 'Вручну' : 'Авто (cron)'} · {formatDate(cert.issuedAt)}
                          {cert.revoked && ' · ВІДКЛИКАНО'}
                        </div>
                      </div>
                    ) : (
                      <span className={`text-[12px] ${dark ? 'text-slate-500' : 'text-stone-400'}`}>—</span>
                    )}
                  </td>
                  <td className="py-3 pr-3">
                    {cert ? (
                      <StatusBadge theme={theme} status={cert.emailStatus} revoked={cert.revoked} />
                    ) : (
                      <span className={`text-[11px] italic ${dark ? 'text-slate-500' : 'text-stone-400'}`}>—</span>
                    )}
                  </td>
                  <td className="py-3 pr-3">
                    {cert?.emailFromAddress ? (
                      <span className={`font-mono text-[11px] ${dark ? 'text-slate-300' : 'text-stone-700'}`} title={cert.emailFromAddress}>
                        {extractEmail(cert.emailFromAddress)}
                      </span>
                    ) : (
                      <span className={`text-[11px] italic ${dark ? 'text-slate-500' : 'text-stone-400'}`}>—</span>
                    )}
                  </td>
                  <td className="py-3">
                    {cert ? (
                      <div className="inline-flex items-center gap-1">
                        <a
                          href={`/api/admin/certificates/${cert.id}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                          title={cert.revoked ? 'PDF відкликаного' : 'Переглянути PDF'}
                          className={`inline-flex items-center justify-center w-8 h-8 rounded-md ${dark ? 'bg-white/[0.05] text-slate-200 hover:bg-white/[0.1]' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}
                        >
                          <HiOutlineEye />
                        </a>
                        {cert.revoked ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => { setIssueFor(c); setShowIssue(true); }}
                            title="Видати новий сертифікат замість відкликаного"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500 text-white text-[12px] font-semibold hover:bg-amber-600 disabled:opacity-40"
                          >
                            <HiOutlinePlus /> Видати знову
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleResend(cert.id, key)}
                              title="Перевідправити"
                              className={`inline-flex items-center justify-center w-8 h-8 rounded-md disabled:opacity-40 ${dark ? 'bg-white/[0.05] text-slate-200 hover:bg-white/[0.1]' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}
                            >
                              <HiOutlinePaperAirplane />
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleRevoke(cert.id, key)}
                              title="Відкликати"
                              className={`inline-flex items-center justify-center w-8 h-8 rounded-md disabled:opacity-40 ${dark ? 'bg-red-500/10 text-red-300 hover:bg-red-500/20' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}
                            >
                              <HiOutlineXCircle />
                            </button>
                          </>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setIssueFor(c); setShowIssue(true); }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500 text-white text-[12px] font-semibold hover:bg-amber-600"
                      >
                        <HiOutlinePlus /> Видати
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showIssue && (
        <IssueCourseDialog
          theme={theme}
          preselected={issueFor}
          onClose={() => { setShowIssue(false); setIssueFor(null); }}
          onIssued={() => {
            setShowIssue(false);
            setIssueFor(null);
            fetchList();
            pushToast({ type: 'success', msg: 'Сертифікат видано' });
          }}
          onError={(msg) => pushToast({ type: 'error', msg })}
        />
      )}

      {showInfo && <CoursesInfoModal theme={theme} onClose={() => setShowInfo(false)} />}
    </AdminPanel>
  );
}

/* -------------------------------- Yearly Tab ------------------------------- */

function YearlyTab({
  theme,
  pushToast,
}: {
  theme: Theme;
  pushToast: (t: { type: 'success' | 'error'; msg: string }) => void;
}) {
  const dark = theme === 'dark';
  const { items: candidates, meta, loading, lastUpdated, refresh: fetchList } =
    useCachedList<YearlyCandidate, { latestSpCheckedAt: string | null }>(
      'cert-yearly-v2',
      async () => {
        const res = await fetch('/api/admin/certificates/yearly');
        const data = await res.json();
        return {
          items: (data.candidates ?? []) as YearlyCandidate[],
          meta: { latestSpCheckedAt: data.latestSpCheckedAt ?? null },
        };
      },
    );
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<'all' | 'YEARLY' | 'MONTHLY'>('all');
  const [issuedFilter, setIssuedFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [dialogSub, setDialogSub] = useState<YearlyCandidate | null>(null);
  const [showIssueManual, setShowIssueManual] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [runningSp, setRunningSp] = useState(false);

  /// Останній SP-sync — системний таймстемп з API (max `spProgressCheckedAt` серед усіх
  /// живих non-CANCELLED підписок, не залежить від видимості рядків після фільтрів чи
  /// приховування ADMIN/MANAGER-тестових підписок).
  const latestSpCheck = useMemo<number | null>(() => {
    const iso = meta?.latestSpCheckedAt;
    return iso ? new Date(iso).getTime() : null;
  }, [meta]);

  async function runSpSync() {
    setRunningSp(true);
    try {
      const res = await fetch('/api/admin/certificates/run-yearly-sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Помилка');
      const summary = `Студентів у SP: ${data.spStudents}. Оновлено прогрес: ${data.processed}. Помилок: ${data.errors?.length ?? 0}.`;
      pushToast({ type: (data.errors?.length ?? 0) > 0 ? 'error' : 'success', msg: summary });
      fetchList();
    } catch (err) {
      pushToast({ type: 'error', msg: err instanceof Error ? err.message : 'Помилка' });
    } finally {
      setRunningSp(false);
    }
  }

  async function handleDelete(certId: string) {
    if (!window.confirm('Видалити сертифікат назавжди? (Тільки для тестування на dev)')) return;
    setDeleting(certId);
    try {
      const res = await fetch(`/api/admin/certificates/${certId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Помилка');
      pushToast({ type: 'success', msg: 'Сертифікат видалено' });
      fetchList();
    } catch (err) {
      pushToast({ type: 'error', msg: err instanceof Error ? err.message : 'Помилка' });
    } finally {
      setDeleting(null);
    }
  }

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return candidates.filter((c) => {
      if (planFilter !== 'all' && c.plan !== planFilter) return false;
      if (issuedFilter === 'yes' && !c.certificate) return false;
      if (issuedFilter === 'no' && c.certificate) return false;
      if (s) {
        const hay = `${c.userName ?? ''} ${c.userEmail}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [candidates, planFilter, issuedFilter, search]);

  return (
    <AdminPanel theme={theme}>
      {/* Row 1 — Синхронізація даних + дії */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <SyncCard
            theme={theme}
            tone="slate"
            icon={<HiOutlineCircleStack className="w-5 h-5" />}
            label="Наша БД"
            description={`${candidates.length} учасників`}
            lastUpdated={lastUpdated}
            onRun={fetchList}
            running={loading}
            runLabel="Оновити"
            runTitle="Перезавантажити список учасників Річної програми з нашої БД"
          />
          <SyncCard
            theme={theme}
            tone="emerald"
            icon={<HiOutlineCloudArrowDown className="w-5 h-5" />}
            label="SendPulse"
            description="прогрес програми"
            lastUpdated={latestSpCheck}
            onRun={runSpSync}
            running={runningSp}
            runLabel="Синхронізувати"
            runTitle="Запитати у SendPulse прогрес студентів Річної програми (для колонки 'Курс завершено')"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowIssueManual(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 text-white text-[13px] font-semibold shadow-md hover:shadow-lg transition-shadow"
          >
            <HiOutlinePlus className="text-[16px]" />
            Видати сертифікат
          </button>
          <button
            type="button"
            onClick={() => setShowInfo(true)}
            title="Як працює Річна програма — довідник для менеджерів"
            aria-label="Довідник"
            className={`inline-flex items-center justify-center w-9 h-9 rounded-full border transition-colors ${dark ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20' : 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'}`}
          >
            <HiOutlineInformationCircle className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Row 2 — Фільтри + лічильник */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
        <div className="flex items-center gap-2 flex-wrap">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Пошук учасника…"
            className={`px-3 py-2 rounded-lg border text-[13px] min-w-[260px] ${dark ? 'bg-white/[0.04] border-white/[0.1] text-white placeholder-slate-500' : 'bg-white border-stone-300 text-stone-900'}`}
          />
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value as 'all' | 'YEARLY' | 'MONTHLY')}
            className={`px-3 py-2 rounded-lg border text-[13px] ${dark ? 'bg-white/[0.04] border-white/[0.1] text-white' : 'bg-white border-stone-300 text-stone-900'}`}
          >
            <option value="all">Всі плани</option>
            <option value="YEARLY">Річний</option>
            <option value="MONTHLY">Місячний</option>
          </select>
          <select
            value={issuedFilter}
            onChange={(e) => setIssuedFilter(e.target.value as 'all' | 'yes' | 'no')}
            className={`px-3 py-2 rounded-lg border text-[13px] ${dark ? 'bg-white/[0.04] border-white/[0.1] text-white' : 'bg-white border-stone-300 text-stone-900'}`}
          >
            <option value="all">Усі</option>
            <option value="yes">Серт виданий</option>
            <option value="no">Серт не виданий</option>
          </select>
        </div>
        <span className={`text-[12px] ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
          показано <strong className={dark ? 'text-slate-200' : 'text-stone-700'}>{filtered.length}</strong> з {candidates.length}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl">
        <table className="w-full text-[13px]">
          <thead className={`text-left text-[11px] uppercase tracking-wider ${dark ? 'text-slate-400 border-b border-white/[0.06]' : 'text-stone-500 border-b border-stone-200'}`}>
            <tr>
              <Th>Учасник</Th>
              <Th>План</Th>
              <Th>Статус</Th>
              <Th>Оплата</Th>
              <Th>Дата початку</Th>
              <Th>Дата закінчення</Th>
              <Th>Курс завершено</Th>
              <Th>Сертифікат створено</Th>
              <Th>Сертифікат відправлено</Th>
              <Th>Лист надійшов з</Th>
              <Th>Сертифікат</Th>
              <Th>Створити вручну</Th>
            </tr>
          </thead>
          <tbody className={dark ? 'divide-y divide-white/[0.04]' : 'divide-y divide-stone-200/60'}>
            {loading && (
              <tr>
                <td colSpan={12} className={`py-8 text-center ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
                  Завантаження…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={12} className={`py-8 text-center ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
                  Немає даних
                </td>
              </tr>
            )}
            {filtered.map((c) => (
              <tr key={c.subscriptionId} className={dark ? 'hover:bg-white/[0.02]' : 'hover:bg-stone-50/70'}>
                <td className="py-3 pr-3">
                  <div className="font-medium">{c.userName ?? '—'}</div>
                  <div className={`text-[11px] ${dark ? 'text-slate-400' : 'text-stone-500'}`}>{c.userEmail}</div>
                </td>
                <td className="py-3 pr-3">{c.plan === 'YEARLY' ? 'Річний' : 'Місячний'}</td>
                <td className="py-3 pr-3">
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${statusColors(c.status, dark)}`}>
                    {statusUa(c.status)}
                  </span>
                </td>
                <td className="py-3 pr-3">
                  <HealthBadge theme={theme} candidate={c} />
                </td>
                <td className="py-3 pr-3">{c.startDate ? formatDateOnly(c.startDate) : '—'}</td>
                <td className="py-3 pr-3">{c.expiresAt ? formatDateOnly(c.expiresAt) : '—'}</td>
                <td className="py-3 pr-3">
                  <ProgressCell
                    theme={theme}
                    percent={c.spProgressPercent}
                    checkedAt={c.spProgressCheckedAt}
                    hasSp
                  />
                </td>
                <td className="py-3 pr-3">
                  {c.certificate ? (
                    <div>
                      <div className="font-mono text-[11px]">{c.certificate.certNumber}</div>
                      <div className={`text-[10px] mt-0.5 ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
                        {c.certificate.category === 'LISTENER' ? 'Слухач' : 'Практична'} · {formatDate(c.certificate.issuedAt)}
                      </div>
                    </div>
                  ) : (
                    <span className={`text-[12px] ${dark ? 'text-slate-500' : 'text-stone-400'}`}>—</span>
                  )}
                </td>
                <td className="py-3 pr-3">
                  {c.certificate ? (
                    <StatusBadge theme={theme} status={c.certificate.emailStatus} revoked={false} />
                  ) : (
                    <span className={`text-[12px] ${dark ? 'text-slate-500' : 'text-stone-400'}`}>—</span>
                  )}
                </td>
                <td className="py-3 pr-3">
                  {c.certificate?.emailFromAddress ? (
                    <span className={`font-mono text-[11px] ${dark ? 'text-slate-300' : 'text-stone-700'}`} title={c.certificate.emailFromAddress}>
                      {extractEmail(c.certificate.emailFromAddress)}
                    </span>
                  ) : (
                    <span className={`text-[11px] italic ${dark ? 'text-slate-500' : 'text-stone-400'}`}>—</span>
                  )}
                </td>
                <td className="py-3 pr-3">
                  {c.certificate ? (
                    <div className="inline-flex items-center gap-1">
                      <a
                        href={`/api/admin/certificates/${c.certificate.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-[12px] font-medium ${dark ? 'bg-white/[0.05] text-slate-200 hover:bg-white/[0.1]' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}
                      >
                        <HiOutlineEye /> PDF
                      </a>
                      <button
                        type="button"
                        disabled={deleting === c.certificate.id}
                        onClick={() => c.certificate && handleDelete(c.certificate.id)}
                        title="Видалити сертифікат (dev)"
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-md disabled:opacity-40 ${dark ? 'bg-red-500/10 text-red-300 hover:bg-red-500/20' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}
                      >
                        <HiOutlineTrash />
                      </button>
                    </div>
                  ) : (
                    <span className={`text-[12px] ${dark ? 'text-slate-500' : 'text-stone-400'}`}>—</span>
                  )}
                </td>
                <td className="py-3">
                  {c.certificate ? (
                    <span className={`text-[12px] ${dark ? 'text-slate-500' : 'text-stone-400'}`}>—</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDialogSub(c)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500 text-white text-[12px] font-semibold hover:bg-amber-600"
                    >
                      <HiOutlinePlus /> Видати
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dialogSub && (
        <IssueYearlyDialog
          theme={theme}
          candidate={dialogSub}
          onClose={() => setDialogSub(null)}
          onIssued={() => {
            setDialogSub(null);
            fetchList();
            pushToast({ type: 'success', msg: 'Сертифікат видано та відправлено' });
          }}
          onError={(msg) => pushToast({ type: 'error', msg })}
        />
      )}

      {showIssueManual && (
        <IssueYearlyManualDialog
          theme={theme}
          onClose={() => setShowIssueManual(false)}
          onIssued={() => {
            setShowIssueManual(false);
            fetchList();
            pushToast({ type: 'success', msg: 'Сертифікат видано та відправлено' });
          }}
          onError={(msg) => pushToast({ type: 'error', msg })}
        />
      )}

      {showInfo && <YearlyInfoModal theme={theme} graceDays={graceDays} onClose={() => setShowInfo(false)} />}
    </AdminPanel>
  );
}

/* ----------------------------- Supervision Tab --------------------------- */

/// Закладка для видачі сертифікатів супервізії — онлайн-занять, які менеджери
/// проводять без продажів через сайт. Логіка інтерфейсу симетрична Курси/Річна:
///   - Кнопка "Видати сертифікат" → IssueSupervisionDialog
///   - Таблиця всіх раніше виданих SUPERVISION-сертифікатів (хто, кому, тема,
///     дата супервізії, дата видачі, статус листа, дії)
///   - Пошук по імені/email/темі
///   - Фільтр статусу листа
///
/// SUPERVISION-сертифікати НЕ потрапляють у вкладку "Помилки" (фільтр на API),
/// але всі події (GENERATED/SENT/RESENT/REVOKED/EMAIL_FAILED) пишуться у
/// CertificateEvent → видно в Історії.
function SupervisionTab({
  theme,
  pushToast,
}: {
  theme: Theme;
  pushToast: (t: { type: 'success' | 'error'; msg: string }) => void;
}) {
  const dark = theme === 'dark';
  const { items: certs, loading, refresh: fetchList } =
    useCachedList<SupervisionCertificate>('cert-supervision-v3', async () => {
      const res = await fetch('/api/admin/certificates/supervision');
      const data = await res.json();
      return {
        items: (data.certificates ?? []) as SupervisionCertificate[],
        meta: null,
      };
    });

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | EmailStatus | 'REVOKED'>('all');
  const [showIssue, setShowIssue] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return certs.filter((c) => {
      if (statusFilter === 'REVOKED') {
        if (!c.revoked) return false;
      } else if (statusFilter !== 'all') {
        if (c.revoked) return false;
        if (c.emailStatus !== statusFilter) return false;
      }
      if (s) {
        const hay = `${c.recipientName} ${c.recipientEmail} ${c.courseName ?? ''} ${c.certNumber}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [certs, search, statusFilter]);

  async function handleResend(certId: string) {
    setBusyId(certId);
    try {
      const res = await fetch(`/api/admin/certificates/${certId}/resend`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Помилка');
      pushToast({ type: 'success', msg: 'Лист перевідправлено' });
      fetchList();
    } catch (err) {
      pushToast({ type: 'error', msg: err instanceof Error ? err.message : 'Помилка' });
    } finally {
      setBusyId(null);
    }
  }

  async function handleRevoke(certId: string) {
    const reason = window.prompt('Причина відклику (опційно):') ?? undefined;
    if (!window.confirm('Точно відкликати сертифікат? Дію видно публічно.')) return;
    setBusyId(certId);
    try {
      const res = await fetch(`/api/admin/certificates/${certId}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Помилка');
      pushToast({ type: 'success', msg: 'Сертифікат відкликано' });
      fetchList();
    } catch (err) {
      pushToast({ type: 'error', msg: err instanceof Error ? err.message : 'Помилка' });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminPanel theme={theme}>
      {/* Row 1 — Дії (без sync — супервізії видаються тільки вручну, ніяких кандидатів з БД немає) */}
      <div className="flex items-center justify-end gap-3 flex-wrap mb-4">
        <button
          type="button"
          onClick={() => setShowIssue(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 text-white text-[13px] font-semibold shadow-md hover:shadow-lg transition-shadow"
        >
          <HiOutlinePlus className="text-[16px]" />
          Видати сертифікат
        </button>
      </div>

      {/* Row 2 — Фільтри */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
        <div className="flex items-center gap-2 flex-wrap">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Пошук: ім'я, email, тема, номер…"
            className={`px-3 py-2 rounded-lg border text-[13px] min-w-[280px] ${dark ? 'bg-white/[0.04] border-white/[0.1] text-white placeholder-slate-500' : 'bg-white border-stone-300 text-stone-900'}`}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className={`px-3 py-2 rounded-lg border text-[13px] ${dark ? 'bg-white/[0.04] border-white/[0.1] text-white' : 'bg-white border-stone-300 text-stone-900'}`}
          >
            <option value="all">Усі статуси</option>
            <option value="SENT">Відправлено</option>
            <option value="PENDING">Очікує</option>
            <option value="FAILED">Помилка</option>
            <option value="BOUNCED">Bounce</option>
            <option value="REVOKED">Відкликано</option>
          </select>
        </div>
        <span className={`text-[12px] ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
          показано <strong className={dark ? 'text-slate-200' : 'text-stone-700'}>{filtered.length}</strong> з {certs.length}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl">
        <table className="w-full text-[13px]">
          <thead className={`text-left text-[11px] uppercase tracking-wider ${dark ? 'text-slate-400 border-b border-white/[0.06]' : 'text-stone-500 border-b border-stone-200'}`}>
            <tr>
              <Th>Отримувач</Th>
              <Th>Тема супервізії</Th>
              <Th>Дата супервізії</Th>
              <Th>Сертифікат</Th>
              <Th>Видав</Th>
              <Th>Статус</Th>
              <Th>Лист надійшов з</Th>
              <Th>Дії</Th>
            </tr>
          </thead>
          <tbody className={dark ? 'divide-y divide-white/[0.04]' : 'divide-y divide-stone-200/60'}>
            {loading && certs.length === 0 && (
              <tr><td colSpan={8} className={`py-8 text-center ${dark ? 'text-slate-400' : 'text-stone-500'}`}>Завантаження…</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={8} className={`py-8 text-center ${dark ? 'text-slate-400' : 'text-stone-500'}`}>Немає виданих сертифікатів</td></tr>
            )}
            {filtered.map((c) => {
              const busy = busyId === c.id;
              return (
                <tr key={c.id} className={dark ? 'hover:bg-white/[0.02]' : 'hover:bg-stone-50/70'}>
                  <td className="py-3 pr-3">
                    <div className="font-medium">{c.recipientName}</div>
                    <div className={`text-[11px] ${dark ? 'text-slate-400' : 'text-stone-500'}`}>{c.recipientEmail}</div>
                  </td>
                  <td className="py-3 pr-3 max-w-[280px]">
                    <div className="truncate" title={c.courseName ?? ''}>{c.courseName ?? '—'}</div>
                  </td>
                  <td className="py-3 pr-3 whitespace-nowrap">
                    {c.supervisionDate ? formatDateOnly(c.supervisionDate) : (
                      <span className={`text-[11px] italic ${dark ? 'text-slate-500' : 'text-stone-400'}`}>не вказана</span>
                    )}
                    {c.supervisionHours != null && (
                      <div className={`text-[10px] mt-0.5 ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
                        ⏱ {formatHoursShort(c.supervisionHours)}
                      </div>
                    )}
                  </td>
                  <td className="py-3 pr-3">
                    <div className="font-mono text-[11px]">{c.certNumber}</div>
                    <div className={`text-[10px] mt-0.5 ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
                      {formatDate(c.issuedAt)}
                    </div>
                  </td>
                  <td className="py-3 pr-3">
                    {c.issuedByName || c.issuedByEmail ? (
                      <>
                        <div>{c.issuedByName ?? '—'}</div>
                        <div className={`text-[10px] ${dark ? 'text-slate-400' : 'text-stone-500'}`}>{c.issuedByEmail}</div>
                      </>
                    ) : (
                      <span className={`text-[11px] italic ${dark ? 'text-slate-500' : 'text-stone-400'}`}>—</span>
                    )}
                  </td>
                  <td className="py-3 pr-3">
                    <StatusBadge theme={theme} status={c.emailStatus} revoked={c.revoked} />
                  </td>
                  <td className="py-3 pr-3">
                    {c.emailFromAddress ? (
                      <span className={`font-mono text-[11px] ${dark ? 'text-slate-300' : 'text-stone-700'}`} title={c.emailFromAddress}>
                        {extractEmail(c.emailFromAddress)}
                      </span>
                    ) : (
                      <span className={`text-[11px] italic ${dark ? 'text-slate-500' : 'text-stone-400'}`}>—</span>
                    )}
                  </td>
                  <td className="py-3">
                    <div className="inline-flex items-center gap-1">
                      <a
                        href={`/api/admin/certificates/${c.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        title={c.revoked ? 'PDF відкликаного' : 'Переглянути PDF'}
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-md ${dark ? 'bg-white/[0.05] text-slate-200 hover:bg-white/[0.1]' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}
                      >
                        <HiOutlineEye />
                      </a>
                      {!c.revoked && (
                        <>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleResend(c.id)}
                            title="Перевідправити"
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-md disabled:opacity-40 ${dark ? 'bg-white/[0.05] text-slate-200 hover:bg-white/[0.1]' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}
                          >
                            <HiOutlinePaperAirplane />
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleRevoke(c.id)}
                            title="Відкликати"
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-md disabled:opacity-40 ${dark ? 'bg-red-500/10 text-red-300 hover:bg-red-500/20' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}
                          >
                            <HiOutlineXCircle />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showIssue && (
        <IssueSupervisionDialog
          theme={theme}
          onClose={() => setShowIssue(false)}
          onIssued={(count) => {
            setShowIssue(false);
            fetchList();
            pushToast({
              type: 'success',
              msg: count === 1
                ? 'Сертифікат видано та відправлено'
                : `Видано ${count} сертифікатів та відправлено`,
            });
          }}
          onError={(msg) => pushToast({ type: 'error', msg })}
        />
      )}
    </AdminPanel>
  );
}

function HealthBadge({ theme, candidate }: { theme: Theme; candidate: YearlyCandidate }) {
  const dark = theme === 'dark';
  const { paymentHealth, paidCount, expectedPayments } = candidate;
  const colors =
    paymentHealth === 'FULL'
      ? dark ? 'bg-emerald-500/20 text-emerald-200' : 'bg-emerald-100 text-emerald-800'
      : paymentHealth === 'PARTIAL'
        ? dark ? 'bg-amber-500/20 text-amber-200' : 'bg-amber-100 text-amber-800'
        : dark ? 'bg-red-500/20 text-red-200' : 'bg-red-100 text-red-800';
  const label =
    paymentHealth === 'FULL' ? '✓' : paymentHealth === 'PARTIAL' ? '⚠' : '✕';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${colors}`}>
      <span>{label}</span>
      <span className="font-mono">{paidCount}/{expectedPayments}</span>
    </span>
  );
}

function statusUa(s: string): string {
  return (
    {
      PENDING: 'Pending',
      ACTIVE: 'Активна',
      GRACE: 'Grace',
      EXPIRED: 'Завершена',
      CANCELLED: 'Скасована',
      ARCHIVED: 'Архів',
    }[s] ?? s
  );
}

function statusColors(s: string, dark: boolean): string {
  if (s === 'ACTIVE') return dark ? 'bg-emerald-500/20 text-emerald-200' : 'bg-emerald-100 text-emerald-800';
  if (s === 'GRACE') return dark ? 'bg-amber-500/20 text-amber-200' : 'bg-amber-100 text-amber-800';
  if (s === 'EXPIRED' || s === 'ARCHIVED') return dark ? 'bg-white/[0.06] text-slate-400' : 'bg-stone-100 text-stone-600';
  if (s === 'CANCELLED') return dark ? 'bg-red-500/20 text-red-200' : 'bg-red-100 text-red-800';
  return dark ? 'bg-white/[0.06] text-slate-300' : 'bg-stone-100 text-stone-700';
}

/* --------------------------------- History Tab ----------------------------- */

type HistorySection = 'course' | 'yearly' | 'supervision';

interface CertHistoryRow {
  certId: string;
  certNumber: string;
  type: CertificateType;
  recipientName: string;
  recipientEmail: string;
  revoked: boolean;
  generatedAt: string | null;
  sentAt: string | null;
  hasEmailFailed: boolean;
  issuer: { name: string | null; email: string | null } | null;
  sender: { name: string | null; email: string | null } | null;
  detailsMessage: string | null;
  /// Найсвіжіший event timestamp — для сортування рядків.
  lastEventAt: string;
}

function aggregateEvents(events: HistoryEvent[]): CertHistoryRow[] {
  const byCert = new Map<string, HistoryEvent[]>();
  for (const e of events) {
    const arr = byCert.get(e.certificate.id) ?? [];
    arr.push(e);
    byCert.set(e.certificate.id, arr);
  }

  const rows: CertHistoryRow[] = [];
  for (const [, group] of byCert) {
    const asc = [...group].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const certInfo = group[0].certificate;

    const generated = asc.find((e) => e.action === 'GENERATED') ?? null;
    const sentEvents = asc.filter((e) => e.action === 'SENT' || e.action === 'RESENT');
    const lastSent = sentEvents.length ? sentEvents[sentEvents.length - 1] : null;
    const lastFailed = asc.filter((e) => e.action === 'EMAIL_FAILED').slice(-1)[0] ?? null;
    const failedAfterSent =
      lastFailed != null && (!lastSent || lastFailed.createdAt > lastSent.createdAt);

    const lastEvent = asc[asc.length - 1];

    rows.push({
      certId: certInfo.id,
      certNumber: certInfo.certNumber,
      type: certInfo.type,
      recipientName: certInfo.recipientName,
      recipientEmail: certInfo.recipientEmail,
      revoked: certInfo.revoked,
      generatedAt: generated?.createdAt ?? null,
      sentAt: lastSent?.createdAt ?? null,
      hasEmailFailed: failedAfterSent,
      issuer: generated ? { name: generated.actorName, email: generated.actorEmail } : null,
      sender: lastSent ? { name: lastSent.actorName, email: lastSent.actorEmail } : null,
      detailsMessage: lastEvent.message ?? null,
      lastEventAt: lastEvent.createdAt,
    });
  }

  rows.sort((a, b) => b.lastEventAt.localeCompare(a.lastEventAt));
  return rows;
}

function statusFor(row: CertHistoryRow): { label: string; tone: 'ok' | 'warn' | 'danger' | 'neutral' } {
  if (row.revoked) return { label: 'Відкликано', tone: 'danger' };
  if (row.hasEmailFailed) return { label: 'Помилка email', tone: 'warn' };
  if (row.generatedAt && row.sentAt) return { label: 'Створено та відправлено', tone: 'ok' };
  if (row.generatedAt) return { label: 'Створено', tone: 'neutral' };
  return { label: '—', tone: 'neutral' };
}

function HistoryTab({ theme }: { theme: Theme }) {
  const dark = theme === 'dark';
  const [section, setSection] = useState<HistorySection>('course');
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    const certTypeMap: Record<HistorySection, string> = {
      course: 'COURSE',
      yearly: 'YEARLY_PROGRAM',
      supervision: 'SUPERVISION',
    };
    qs.set('certType', certTypeMap[section]);
    qs.set('limit', '1000');
    try {
      const res = await fetch(`/api/admin/certificates/history?${qs.toString()}`);
      const data = await res.json();
      setEvents((data.events ?? []) as HistoryEvent[]);
    } finally {
      setLoading(false);
    }
  }, [section]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const rows = useMemo(() => aggregateEvents(events), [events]);

  return (
    <AdminPanel theme={theme}>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div
          className={`inline-flex items-center rounded-lg border p-1 ${dark ? 'bg-white/[0.04] border-white/[0.1]' : 'bg-stone-100 border-stone-200'}`}
        >
          <SubTabButton
            active={section === 'course'}
            dark={dark}
            onClick={() => setSection('course')}
          >
            Курси
          </SubTabButton>
          <SubTabButton
            active={section === 'yearly'}
            dark={dark}
            onClick={() => setSection('yearly')}
          >
            Річна програма
          </SubTabButton>
          <SubTabButton
            active={section === 'supervision'}
            dark={dark}
            onClick={() => setSection('supervision')}
          >
            Супервізія
          </SubTabButton>
        </div>
        <button
          type="button"
          onClick={fetchEvents}
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[13px] ${dark ? 'bg-white/[0.04] border-white/[0.1] text-slate-200' : 'bg-white border-stone-300 text-stone-700'}`}
        >
          <HiOutlineArrowPath className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl">
        <table className="w-full text-[13px]">
          <thead className={`text-left text-[11px] uppercase tracking-wider ${dark ? 'text-slate-400 border-b border-white/[0.06]' : 'text-stone-500 border-b border-stone-200'}`}>
            <tr>
              <Th>Сертифікат</Th>
              <Th>Отримувач</Th>
              <Th>Статус</Th>
              <Th>Створено</Th>
              <Th>Відправлено</Th>
              <Th>Хто відправив</Th>
              <Th>Деталі</Th>
            </tr>
          </thead>
          <tbody className={dark ? 'divide-y divide-white/[0.04]' : 'divide-y divide-stone-200/60'}>
            {loading && (
              <tr><td colSpan={7} className={`py-8 text-center ${dark ? 'text-slate-400' : 'text-stone-500'}`}>Завантаження…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={7} className={`py-8 text-center ${dark ? 'text-slate-400' : 'text-stone-500'}`}>Подій немає</td></tr>
            )}
            {rows.map((r) => {
              const status = statusFor(r);
              const actor = r.sender ?? r.issuer;
              return (
                <tr key={r.certId} className={dark ? 'hover:bg-white/[0.02]' : 'hover:bg-stone-50/70'}>
                  <td className="py-3 pr-3">
                    <div className="font-mono text-[11px]">{r.certNumber}</div>
                    <div className={`text-[10px] ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
                      {r.type === 'COURSE' ? 'Курс' : r.type === 'SUPERVISION' ? 'Супервізія' : 'Річна'}
                    </div>
                  </td>
                  <td className="py-3 pr-3">
                    <div>{r.recipientName}</div>
                    <div className={`text-[10px] ${dark ? 'text-slate-400' : 'text-stone-500'}`}>{r.recipientEmail}</div>
                  </td>
                  <td className="py-3 pr-3">
                    <StatusPill tone={status.tone} dark={dark} label={status.label} />
                  </td>
                  <td className="py-3 pr-3 whitespace-nowrap">{formatDate(r.generatedAt)}</td>
                  <td className="py-3 pr-3 whitespace-nowrap">{formatDate(r.sentAt)}</td>
                  <td className="py-3 pr-3">
                    {actor && (actor.name || actor.email) ? (
                      <>
                        <div>{actor.name ?? '—'}</div>
                        <div className={`text-[10px] ${dark ? 'text-slate-400' : 'text-stone-500'}`}>{actor.email}</div>
                      </>
                    ) : (
                      <span className={`text-[11px] italic ${dark ? 'text-slate-500' : 'text-stone-400'}`}>System</span>
                    )}
                  </td>
                  <td className={`py-3 text-[12px] ${dark ? 'text-slate-400' : 'text-stone-600'}`}>{r.detailsMessage ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AdminPanel>
  );
}

function StatusPill({
  tone,
  dark,
  label,
}: {
  tone: 'ok' | 'warn' | 'danger' | 'neutral';
  dark: boolean;
  label: string;
}) {
  const cls =
    tone === 'ok'
      ? dark
        ? 'bg-emerald-500/20 text-emerald-200'
        : 'bg-emerald-100 text-emerald-800'
      : tone === 'warn'
        ? dark
          ? 'bg-amber-500/20 text-amber-200'
          : 'bg-amber-100 text-amber-800'
        : tone === 'danger'
          ? dark
            ? 'bg-red-500/20 text-red-200'
            : 'bg-red-100 text-red-800'
          : dark
            ? 'bg-white/[0.06] text-slate-300'
            : 'bg-stone-100 text-stone-700';
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase whitespace-nowrap ${cls}`}>
      {label}
    </span>
  );
}

function SubTabButton({
  active,
  dark,
  onClick,
  children,
}: {
  active: boolean;
  dark: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
        active
          ? dark
            ? 'bg-white/[0.1] text-white'
            : 'bg-white text-stone-900 shadow-sm'
          : dark
            ? 'text-slate-400 hover:text-slate-200'
            : 'text-stone-500 hover:text-stone-800'
      }`}
    >
      {children}
    </button>
  );
}

/* -------------------------------- Issues Tab ------------------------------ */

type IssueKind = 'UNPAID' | 'MANUAL_INCOMPLETE' | 'EMAIL_FAILED' | 'COMPLETED_NO_CERT';
type IssueCertType = 'COURSE' | 'YEARLY_PROGRAM' | null;

interface Issue {
  kind: IssueKind;
  certType: IssueCertType;
  certificate: {
    id: string;
    certNumber: string;
    issuedAt: string;
    issuedManually: boolean;
    emailStatus: string;
    revoked: boolean;
  } | null;
  user: { id: string; name: string | null; email: string };
  subjectTitle: string;
  subjectMeta: string | null;
  details: string;
  issuedBy: { name: string | null; email: string | null } | null;
}

const ISSUE_LABELS: Record<IssueKind, string> = {
  UNPAID: 'Не оплачено',
  MANUAL_INCOMPLETE: 'Не завершено',
  EMAIL_FAILED: 'Email не доставлено',
  COMPLETED_NO_CERT: 'Серт не видано',
};

function IssuesTab({
  theme,
  pushToast,
}: {
  theme: Theme;
  pushToast: (t: { type: 'success' | 'error'; msg: string }) => void;
}) {
  const dark = theme === 'dark';
  const [issues, setIssues] = useState<Issue[]>([]);
  const [totals, setTotals] = useState<Record<IssueKind, number>>({
    UNPAID: 0,
    MANUAL_INCOMPLETE: 0,
    EMAIL_FAILED: 0,
    COMPLETED_NO_CERT: 0,
  });
  const [loading, setLoading] = useState(true);
  const [kindFilter, setKindFilter] = useState<'all' | IssueKind>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'COURSE' | 'YEARLY_PROGRAM'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchIssues = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/certificates/issues');
      const data = await res.json();
      setIssues((data.issues ?? []) as Issue[]);
      setTotals(
        (data.totals ?? {
          UNPAID: 0,
          MANUAL_INCOMPLETE: 0,
          EMAIL_FAILED: 0,
          COMPLETED_NO_CERT: 0,
        }) as Record<IssueKind, number>,
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  const filtered = useMemo(() => {
    return issues.filter((i) => {
      if (kindFilter !== 'all' && i.kind !== kindFilter) return false;
      if (typeFilter !== 'all' && i.certType !== typeFilter) return false;
      return true;
    });
  }, [issues, kindFilter, typeFilter]);

  /// Групуємо помилки в один рядок: одна аномалія = один рядок, але кілька проблем
  /// одного й того ж сертифіката (або одного й того ж enrollment-а для COMPLETED_NO_CERT)
  /// — об'єднуються в один рядок з кількома "пігулками" в колонці "Тип помилки".
  const grouped = useMemo(() => {
    const map = new Map<string, { primary: Issue; problems: Issue[] }>();
    for (const i of filtered) {
      const key = i.certificate?.id ?? `nocert_${i.user.id}_${i.subjectTitle}`;
      const existing = map.get(key);
      if (existing) {
        existing.problems.push(i);
      } else {
        map.set(key, { primary: i, problems: [i] });
      }
    }
    return Array.from(map.values());
  }, [filtered]);

  async function handleResend(certId: string) {
    setBusyId(certId);
    try {
      const res = await fetch(`/api/admin/certificates/${certId}/resend`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Помилка');
      pushToast({ type: 'success', msg: 'Лист перевідправлено' });
      fetchIssues();
    } catch (err) {
      pushToast({ type: 'error', msg: err instanceof Error ? err.message : 'Помилка' });
    } finally {
      setBusyId(null);
    }
  }

  async function handleRevoke(certId: string) {
    const reason = window.prompt('Причина відклику (опційно):') ?? undefined;
    if (!window.confirm('Точно відкликати сертифікат? Дію видно публічно.')) return;
    setBusyId(certId);
    try {
      const res = await fetch(`/api/admin/certificates/${certId}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Помилка');
      pushToast({ type: 'success', msg: 'Сертифікат відкликано' });
      fetchIssues();
    } catch (err) {
      pushToast({ type: 'error', msg: err instanceof Error ? err.message : 'Помилка' });
    } finally {
      setBusyId(null);
    }
  }

  const totalAll =
    totals.UNPAID + totals.MANUAL_INCOMPLETE + totals.EMAIL_FAILED + totals.COMPLETED_NO_CERT;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <IssueKpi theme={theme} label="Не оплачено" value={totals.UNPAID} tone="danger" />
        <IssueKpi theme={theme} label="Не завершено" value={totals.MANUAL_INCOMPLETE} tone="warn" />
        <IssueKpi theme={theme} label="Email не доставлено" value={totals.EMAIL_FAILED} tone="warn" />
        <IssueKpi theme={theme} label="Серт не видано" value={totals.COMPLETED_NO_CERT} tone="neutral" />
      </div>

      <AdminPanel theme={theme}>
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as typeof kindFilter)}
            className={`px-3 py-2 rounded-lg border text-[13px] ${dark ? 'bg-white/[0.04] border-white/[0.1] text-white' : 'bg-white border-stone-300 text-stone-900'}`}
          >
            <option value="all">Усі типи помилок</option>
            <option value="UNPAID">Не оплачено</option>
            <option value="MANUAL_INCOMPLETE">Не завершено</option>
            <option value="EMAIL_FAILED">Email не доставлено</option>
            <option value="COMPLETED_NO_CERT">Серт не видано</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
            className={`px-3 py-2 rounded-lg border text-[13px] ${dark ? 'bg-white/[0.04] border-white/[0.1] text-white' : 'bg-white border-stone-300 text-stone-900'}`}
          >
            <option value="all">Курси + Річна</option>
            <option value="COURSE">Тільки курси</option>
            <option value="YEARLY_PROGRAM">Тільки річна</option>
          </select>
          <button
            type="button"
            onClick={fetchIssues}
            disabled={loading}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[13px] ${dark ? 'bg-white/[0.04] border-white/[0.1] text-slate-200' : 'bg-white border-stone-300 text-stone-700'}`}
          >
            <HiOutlineArrowPath className={loading ? 'animate-spin' : ''} />
          </button>
          <span className={`text-[12px] ml-1 ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
            {grouped.length} {grouped.length === 1 ? 'кейс' : 'кейсів'} ({filtered.length} {filtered.length === 1 ? 'помилка' : 'помилок'})
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl">
          <table className="w-full text-[13px]">
            <thead className={`text-left text-[11px] uppercase tracking-wider ${dark ? 'text-slate-400 border-b border-white/[0.06]' : 'text-stone-500 border-b border-stone-200'}`}>
              <tr>
                <Th>Тип помилки</Th>
                <Th>Тип</Th>
                <Th>Сертифікат</Th>
                <Th>Отримувач</Th>
                <Th>Курс / Програма</Th>
                <Th>Хто видав</Th>
                <Th>Деталі</Th>
                <Th>Дії</Th>
              </tr>
            </thead>
            <tbody className={dark ? 'divide-y divide-white/[0.04]' : 'divide-y divide-stone-200/60'}>
              {loading && (
                <tr><td colSpan={8} className={`py-8 text-center ${dark ? 'text-slate-400' : 'text-stone-500'}`}>Завантаження…</td></tr>
              )}
              {!loading && grouped.length === 0 && (
                <tr>
                  <td colSpan={8} className={`py-8 text-center text-[13px] ${dark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                    <span className="inline-flex items-center gap-2">
                      <HiOutlineCheckCircle /> Помилок немає — все ОК
                    </span>
                  </td>
                </tr>
              )}
              {grouped.map((g, idx) => {
                const i = g.primary;
                const certId = i.certificate?.id ?? null;
                const busy = certId === busyId;
                const hasMultiple = g.problems.length > 1;
                const hasEmailFailed = g.problems.some((p) => p.kind === 'EMAIL_FAILED');
                return (
                  <tr
                    key={`${certId ?? `${i.user.id}_${i.subjectTitle}`}_${idx}`}
                    className={`${dark ? 'hover:bg-white/[0.02]' : 'hover:bg-stone-50/70'} ${hasMultiple ? (dark ? 'bg-red-500/[0.04]' : 'bg-red-50/40') : ''}`}
                    title={hasMultiple ? `Один кейс — ${g.problems.length} проблеми` : undefined}
                  >
                    <td className="py-3 pr-3">
                      <div className="flex flex-col gap-1 items-start">
                        {g.problems.map((p) => (
                          <IssueKindPill key={p.kind} kind={p.kind} dark={dark} />
                        ))}
                        {hasMultiple && (
                          <span
                            className={`mt-0.5 text-[10px] font-semibold ${dark ? 'text-red-300' : 'text-red-700'}`}
                          >
                            ⚠ {g.problems.length} проблеми
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-[12px]">
                      {i.certType === 'COURSE' ? 'Курс' : i.certType === 'YEARLY_PROGRAM' ? 'Річна' : '—'}
                    </td>
                    <td className="py-3 pr-3">
                      {i.certificate ? (
                        <>
                          <div className="font-mono text-[11px]">{i.certificate.certNumber}</div>
                          <div className={`text-[10px] ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
                            {formatDate(i.certificate.issuedAt)} · {i.certificate.issuedManually ? 'Вручну' : 'Авто'}
                          </div>
                        </>
                      ) : (
                        <span className={`text-[12px] italic ${dark ? 'text-slate-500' : 'text-stone-400'}`}>не виданий</span>
                      )}
                    </td>
                    <td className="py-3 pr-3">
                      <div>{i.user.name ?? '—'}</div>
                      <div className={`text-[10px] ${dark ? 'text-slate-400' : 'text-stone-500'}`}>{i.user.email}</div>
                    </td>
                    <td className="py-3 pr-3 max-w-[240px]">
                      <div className="truncate" title={i.subjectTitle}>{i.subjectTitle}</div>
                      {i.subjectMeta && (
                        <div className={`text-[10px] ${dark ? 'text-slate-400' : 'text-stone-500'}`}>{i.subjectMeta}</div>
                      )}
                    </td>
                    <td className="py-3 pr-3">
                      {i.issuedBy && (i.issuedBy.name || i.issuedBy.email) ? (
                        <>
                          <div>{i.issuedBy.name ?? '—'}</div>
                          <div className={`text-[10px] ${dark ? 'text-slate-400' : 'text-stone-500'}`}>{i.issuedBy.email}</div>
                        </>
                      ) : (
                        <span className={`text-[11px] italic ${dark ? 'text-slate-500' : 'text-stone-400'}`}>System</span>
                      )}
                    </td>
                    <td className={`py-3 pr-3 text-[12px] max-w-[320px] ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
                      {hasMultiple ? (
                        <ul className="list-disc list-inside space-y-0.5">
                          {g.problems.map((p) => (
                            <li key={p.kind}>
                              <span className={`text-[10px] uppercase font-semibold ${dark ? 'text-slate-300' : 'text-stone-700'}`}>
                                {ISSUE_LABELS[p.kind]}:
                              </span>{' '}
                              {p.details}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        i.details
                      )}
                    </td>
                    <td className="py-3">
                      {certId ? (
                        <div className="inline-flex items-center gap-1">
                          <a
                            href={`/api/admin/certificates/${certId}/pdf`}
                            target="_blank"
                            rel="noreferrer"
                            title="PDF"
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-md ${dark ? 'bg-white/[0.05] text-slate-200 hover:bg-white/[0.1]' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}
                          >
                            <HiOutlineEye />
                          </a>
                          {hasEmailFailed && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleResend(certId)}
                              title="Перевідправити"
                              className={`inline-flex items-center justify-center w-8 h-8 rounded-md disabled:opacity-40 ${dark ? 'bg-white/[0.05] text-slate-200 hover:bg-white/[0.1]' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}
                            >
                              <HiOutlinePaperAirplane />
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleRevoke(certId)}
                            title="Відкликати"
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-md disabled:opacity-40 ${dark ? 'bg-red-500/10 text-red-300 hover:bg-red-500/20' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}
                          >
                            <HiOutlineXCircle />
                          </button>
                        </div>
                      ) : (
                        <span className={`text-[11px] italic ${dark ? 'text-slate-500' : 'text-stone-400'}`}>
                          У вкладці "Курси"
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </AdminPanel>
    </div>
  );
}

function IssueKindPill({ kind, dark }: { kind: IssueKind; dark: boolean }) {
  const cls =
    kind === 'UNPAID'
      ? dark
        ? 'bg-red-500/20 text-red-200'
        : 'bg-red-100 text-red-800'
      : kind === 'MANUAL_INCOMPLETE'
        ? dark
          ? 'bg-amber-500/20 text-amber-200'
          : 'bg-amber-100 text-amber-800'
        : kind === 'EMAIL_FAILED'
          ? dark
            ? 'bg-orange-500/20 text-orange-200'
            : 'bg-orange-100 text-orange-800'
          : dark
            ? 'bg-blue-500/20 text-blue-200'
            : 'bg-blue-100 text-blue-800';
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase whitespace-nowrap ${cls}`}>
      {ISSUE_LABELS[kind]}
    </span>
  );
}

function IssueKpi({
  theme,
  label,
  value,
  tone,
}: {
  theme: Theme;
  label: string;
  value: number;
  tone: 'danger' | 'warn' | 'neutral';
}) {
  const dark = theme === 'dark';
  const valueClr =
    tone === 'danger'
      ? dark
        ? 'text-red-300'
        : 'text-red-700'
      : tone === 'warn'
        ? dark
          ? 'text-amber-300'
          : 'text-amber-700'
        : dark
          ? 'text-white'
          : 'text-stone-900';
  return (
    <AdminPanel theme={theme} padding="p-4">
      <div className={`text-[10px] uppercase tracking-wider font-semibold ${dark ? 'text-slate-400' : 'text-stone-500'}`}>{label}</div>
      <div className={`text-[26px] font-semibold tracking-tight mt-1 ${valueClr}`}>{value}</div>
    </AdminPanel>
  );
}

/* --------------------------------- Helpers -------------------------------- */

function Th({ children }: { children: React.ReactNode }) {
  return <th className="py-2 pr-3 font-semibold">{children}</th>;
}

/* --------------------------------- Modals --------------------------------- */

/// Тип `children` дозволяє function-render: дитина може взяти стан модалки
/// (зокрема `expanded`), щоб адаптувати layout до full-screen режиму
/// (наприклад, перерозподілити пропорції grid-колонок).
type ModalShellChildren =
  | React.ReactNode
  | ((state: { expanded: boolean }) => React.ReactNode);

function ModalShell({
  theme,
  title,
  children,
  onClose,
  footer,
  wide,
  expandable,
}: {
  theme: Theme;
  title: string;
  children: ModalShellChildren;
  onClose: () => void;
  footer?: React.ReactNode;
  wide?: boolean;
  /// Якщо true — у header-і з'являється кнопка «Розгорнути на весь екран».
  /// Дефолт false — використовується тільки на формах, де preview потребує більшого простору.
  expandable?: boolean;
}) {
  const dark = theme === 'dark';
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);

  const sizeClasses = expanded
    ? 'max-w-none w-screen max-h-none h-full rounded-none border-0'
    : `${wide ? 'max-w-[1100px]' : 'max-w-2xl'} max-h-[92vh] rounded-2xl border`;
  const wrapperPadding = expanded ? 'p-0' : 'p-4';
  /// У розгорнутому режимі зсуваємо контейнер на висоту dashboard-хедеру (h-16 = 4rem),
  /// щоб title-bar модалки вплотну приклеювався до header bottom, а не ховався за ним.
  const wrapperPosition = expanded ? 'fixed left-0 right-0 bottom-0 top-16' : 'fixed inset-0';

  if (typeof document === 'undefined') return null;
  /// Portal у document.body — щоб escape-нути backdrop-filter containing block, який
  /// AdminPanel (`backdrop-blur-sm`) створює: без портала `position: fixed` ловиться
  /// панеллю, і expanded-режим з `top-16` рахує 16 від верху панелі, а не viewport-у.
  return createPortal(
    <div
      className={`${wrapperPosition} z-50 flex items-center justify-center bg-black/50 ${wrapperPadding}`}
      style={{ colorScheme: dark ? 'dark' : 'light' }}
    >
      <div
        className={`w-full ${sizeClasses} overflow-hidden flex flex-col ${dark ? 'bg-[#14171f] border-white/[0.1] text-slate-100' : 'bg-white border-stone-200 text-stone-900'}`}
      >
        <div className={`px-5 py-4 border-b flex items-center justify-between ${dark ? 'border-white/[0.08]' : 'border-stone-200'}`}>
          <h3 className="text-[16px] font-semibold">{title}</h3>
          <div className="flex items-center gap-1">
            {expandable && (
              <button
                type="button"
                onClick={() => setExpanded(v => !v)}
                aria-label={expanded ? 'Згорнути' : 'Розгорнути на весь екран'}
                title={expanded ? 'Згорнути' : 'Розгорнути на весь екран'}
                className={`w-8 h-8 rounded-md flex items-center justify-center ${dark ? 'hover:bg-white/[0.08] text-slate-300' : 'hover:bg-stone-100 text-stone-600'}`}
              >
                {expanded
                  ? <HiOutlineArrowsPointingIn className="w-4 h-4" />
                  : <HiOutlineArrowsPointingOut className="w-4 h-4" />}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрити"
              className={`w-8 h-8 rounded-md flex items-center justify-center ${dark ? 'hover:bg-white/[0.08] text-slate-300' : 'hover:bg-stone-100 text-stone-600'}`}
            >
              ✕
            </button>
          </div>
        </div>
        <div className="p-5 overflow-y-auto flex-1">
          {typeof children === 'function' ? children({ expanded }) : children}
        </div>
        {footer && (
          <div className={`px-5 py-4 border-t flex items-center justify-end gap-2 ${dark ? 'border-white/[0.08] bg-white/[0.02]' : 'border-stone-200 bg-stone-50/60'}`}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/// Live PDF-preview — iframe src вказує на GET /api/admin/certificates/preview.
/// Hash `#toolbar=0&navpanes=0&scrollbar=0&view=FitH` приховує Chrome PDF viewer chrome
/// (toolbar і sidebar з thumbnails) — лишається тільки сертифікат.
/// Клік на превью → fullscreen modal з більшою версією.
/// Debounced 500мс на зміни форми.
function PreviewPane({
  theme,
  params,
  disabled,
  compact,
}: {
  theme: Theme;
  params: {
    type: 'COURSE' | 'YEARLY_PROGRAM' | 'SUPERVISION';
    category?: 'LISTENER' | 'PRACTICAL';
    recipientName: string;
    courseName?: string;
    /// Тільки для SUPERVISION — yyyy-mm-dd або порожній. Опційне.
    supervisionDate?: string;
    /// Тільки для SUPERVISION — Float у вигляді рядка ("2", "1.5"). Опційне.
    supervisionHours?: string;
  };
  disabled?: boolean;
  /// Compact-режим — панель само-збирається до природної висоти сертифіката
  /// (через aspect-ratio на cert-area), без `flex-1` стретчингу. Використовується
  /// у не-розгорнутій модалці, де ліва колонка вища: інакше cert-button малий і
  /// центрується серед пустого тла, що візуально читається як "обрізаний".
  /// Default false — стара поведінка (стретч на повну висоту колонки) лишається
  /// для fullscreen-режиму, де cert має фактично заповнювати весь viewport.
  compact?: boolean;
}) {
  const dark = theme === 'dark';
  const [baseSrc, setBaseSrc] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  /// Escape всередині fullscreen-preview має закривати ТІЛЬКИ fullscreen, а не парентовий
  /// Modal видачі сертифіката. Слухаємо в capture-фазі і stopPropagation, щоб
  /// глобальний Escape-handler модалки не вистрелив.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setExpanded(false);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [expanded]);

  useEffect(() => {
    if (disabled || !params.recipientName.trim()) {
      setBaseSrc(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      const qs = new URLSearchParams({
        type: params.type,
        name: params.recipientName.trim(),
      });
      if (params.category) qs.set('category', params.category);
      if (params.courseName) qs.set('courseName', params.courseName);
      if (params.supervisionDate) qs.set('supervisionDate', params.supervisionDate);
      if (params.supervisionHours) qs.set('supervisionHours', params.supervisionHours);
      setBaseSrc(`/api/admin/certificates/preview?${qs.toString()}`);
    }, 500);
    return () => clearTimeout(t);
  }, [disabled, params.type, params.category, params.recipientName, params.courseName, params.supervisionDate, params.supervisionHours]);

  const src = baseSrc ? `${baseSrc}#toolbar=0&navpanes=0&scrollbar=0&statusbar=0&messages=0&view=Fit&zoom=page-fit` : null;

  /// Реальні розміри PDF — мають співпадати з PAGE_SIZES у lib/certificates/templateConfig.ts.
  /// COURSE = 1280×760 (sidebar layout), YEARLY = 1280×960, SUPERVISION = 1280×900 (унікальна).
  const pageAspect =
    params.type === 'COURSE' ? '1280 / 760'
      : params.type === 'SUPERVISION' ? '1280 / 900'
        : '1280 / 960';

  /// Спінер «Генерую сертифікат…» — спільний для empty-state і loading-overlay.
  const spinner = (
    <div className="flex flex-col items-center gap-2">
      <div className={`w-8 h-8 border-2 rounded-full animate-spin ${dark ? 'border-white/20 border-t-amber-400' : 'border-stone-300 border-t-amber-600'}`} />
      <div className={`text-[12px] uppercase tracking-wider ${dark ? 'text-slate-300' : 'text-stone-600'}`}>Генерую сертифікат…</div>
    </div>
  );

  /// Внутрішній вміст cert-area — однаковий і в compact, і в стретч-режимі.
  const certInner = !params.recipientName.trim() ? (
    <div className={`absolute inset-0 flex items-center justify-center text-[13px] p-4 text-center ${dark ? 'text-slate-500' : 'text-stone-400'}`}>
      Введіть ім'я — з'явиться прев'ю PDF
    </div>
  ) : src ? (
    <>
      <div className="absolute inset-0 overflow-hidden">
        <iframe
          src={src}
          title="Certificate preview"
          onLoad={() => setLoading(false)}
          className={`block border-0 pointer-events-none transition-opacity duration-200 ${loading ? 'opacity-30' : 'opacity-100'}`}
          style={{
            width: 'calc(100% + 18px)',
            height: 'calc(100% + 18px)',
            marginLeft: '-9px',
            marginTop: '-9px',
          }}
        />
      </div>
      {loading && (
        <div className={`absolute inset-0 flex items-center justify-center pointer-events-none ${dark ? 'bg-black/30' : 'bg-stone-50/60'}`}>
          {spinner}
        </div>
      )}
    </>
  ) : (
    <div className="absolute inset-0 flex items-center justify-center">{spinner}</div>
  );

  return (
    <>
      <div className={`rounded-xl border overflow-hidden flex flex-col ${compact ? 'self-start' : 'min-h-[380px]'} ${dark ? 'border-white/[0.08] bg-black/40' : 'border-stone-200 bg-stone-50'}`}>
        <div className={`px-4 py-2.5 flex items-center justify-between border-b ${dark ? 'border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-transparent' : 'border-stone-200/70 bg-gradient-to-b from-white to-stone-50/40'}`}>
          <div className="flex items-center gap-2">
            <HiOutlineEye className={`w-4 h-4 ${dark ? 'text-amber-400/80' : 'text-amber-600/90'}`} />
            <span className={`text-[12px] font-medium tracking-wide ${dark ? 'text-slate-200' : 'text-stone-700'}`}>Попередній перегляд</span>
          </div>
          {src && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${dark ? 'text-slate-400 hover:text-amber-300 hover:bg-white/[0.05]' : 'text-stone-500 hover:text-amber-700 hover:bg-stone-100'}`}
            >
              <HiOutlineArrowsPointingOut className="w-3.5 h-3.5" />
              <span>На весь екран</span>
            </button>
          )}
        </div>
        {compact ? (
          /// Self-fit: cert-area має фіксований aspect = розмір PDF, тож висота
          /// панелі = ширина-колонки / aspect + header. Самозбирання без пустого тла.
          <div className="p-3" data-cert-preview-area>
            <button
              type="button"
              onClick={() => src && setExpanded(true)}
              disabled={!src}
              style={{ aspectRatio: pageAspect }}
              className="block w-full relative p-0 m-0 border-0 cursor-zoom-in disabled:cursor-default bg-transparent"
            >
              {certInner}
            </button>
          </div>
        ) : (
          /// Стретч-режим: cert-area розтягується flex-1 на повну висоту колонки,
          /// аспект-ratio + max-w/h-full дають object-fit:contain поведінку
          /// (cert центрується в усьому доступному просторі). Використовується
          /// у fullscreen-модалці, де колонка займає весь viewport-у.
          <div className="flex-1 min-h-0 relative" data-cert-preview-area>
            <div className="absolute inset-0 flex items-center justify-center p-3">
              <button
                type="button"
                onClick={() => src && setExpanded(true)}
                disabled={!src}
                style={{ aspectRatio: pageAspect }}
                className="block w-full max-w-full max-h-full relative p-0 m-0 border-0 cursor-zoom-in disabled:cursor-default bg-transparent"
              >
                {certInner}
              </button>
            </div>
          </div>
        )}
      </div>

      {expanded && src && (
        <CertPreviewFullscreen src={src} onClose={() => setExpanded(false)} />
      )}
    </>
  );
}

/// Fullscreen-overlay з PDF-сертифікатом — впритул до dashboard-хедеру (top-16),
/// повна ширина viewport-у. Portal у document.body, щоб уникнути containing-block
/// проблем з backdrop-filter / transform у батьківських елементах. Escape закриває
/// тільки overlay (capture-фаза + stopPropagation), не зачіпаючи парентову модалку.
function CertPreviewFullscreen({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      className="fixed inset-x-0 bottom-0 top-16 z-[100] bg-black/85 flex flex-col cursor-zoom-out"
      onClick={onClose}
    >
      <div
        className="relative flex-1 min-h-0 bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <iframe src={src} title="Certificate full" className="w-full h-full border-0" />
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 w-10 h-10 rounded-full bg-black/70 text-white text-xl flex items-center justify-center hover:bg-black"
          aria-label="Закрити"
        >
          ✕
        </button>
      </div>
    </div>,
    document.body,
  );
}

type CourseOption = { id: string; title: string };

type ExistingCertSummary = {
  id: string;
  certNumber: string;
  recipientName: string;
  recipientEmail: string;
  emailStatus: 'PENDING' | 'SENT' | 'FAILED';
  emailSentAt: string | null;
  issuedAt: string;
  issuedManually: boolean;
};

/* ----------------------- Draft helpers (issue dialogs) ---------------------- */

/// Тонкий localStorage-обгортник для чернеток модалок видачі сертифікатів.
/// Кожна модалка має свій key + parse-функцію, що валідує форму даних і повертає
/// типізований об'єкт або null. Усі помилки (quota, private mode, JSON parse)
/// гасяться — неможливість зберегти/прочитати чернетку не повинна ламати UX.
function readDraft<T>(key: string, parse: (raw: unknown) => T | null): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeDraft(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore (quota / private mode)
  }
}

function clearDraft(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/* --------------------- Course manual draft ---------------------- */

const COURSE_MANUAL_DRAFT_KEY = 'cert-course-manual-draft-v1';
type CourseManualDraft = {
  recipientName: string;
  recipientEmail: string;
  courseId: string;
};

function loadCourseManualDraft(): CourseManualDraft | null {
  return readDraft(COURSE_MANUAL_DRAFT_KEY, (raw) => {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    if (
      typeof r.recipientName !== 'string' ||
      typeof r.recipientEmail !== 'string' ||
      typeof r.courseId !== 'string'
    ) return null;
    return { recipientName: r.recipientName, recipientEmail: r.recipientEmail, courseId: r.courseId };
  });
}

/* --------------------- Yearly manual draft ---------------------- */

const YEARLY_MANUAL_DRAFT_KEY = 'cert-yearly-manual-draft-v1';
type YearlyManualDraft = {
  recipientName: string;
  recipientEmail: string;
  category: CertCategory;
};

function loadYearlyManualDraft(): YearlyManualDraft | null {
  return readDraft(YEARLY_MANUAL_DRAFT_KEY, (raw) => {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    if (
      typeof r.recipientName !== 'string' ||
      typeof r.recipientEmail !== 'string' ||
      (r.category !== 'PRACTICAL' && r.category !== 'LISTENER')
    ) return null;
    return {
      recipientName: r.recipientName,
      recipientEmail: r.recipientEmail,
      category: r.category as CertCategory,
    };
  });
}

function IssueCourseDialog({
  theme,
  preselected,
  onClose,
  onIssued,
  onError,
}: {
  theme: Theme;
  preselected?: CourseCandidate | null;
  onClose: () => void;
  onIssued: () => void;
  onError: (msg: string) => void;
}) {
  const dark = theme === 'dark';
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [fromEmail, setFromEmail] = useState<string | null>(null);
  /// Чернетка діє ТІЛЬКИ у manual-режимі (без `preselected`). Коли admin кликає
  /// «Видати сертифікат» з рядка кандидата, preselected стає source-of-truth, а
  /// чернетку ігноруємо — інакше попередньо введені дані «перекриють» вибраного юзера.
  const initialDraft = useMemo(
    () => (preselected ? null : loadCourseManualDraft()),
    [preselected],
  );
  const [draftRestored, setDraftRestored] = useState<boolean>(() => initialDraft !== null);
  const [recipientName, setRecipientName] = useState(
    preselected?.userName ?? initialDraft?.recipientName ?? '',
  );
  const [recipientEmail, setRecipientEmail] = useState(
    preselected?.userEmail ?? initialDraft?.recipientEmail ?? '',
  );
  const [courseId, setCourseId] = useState<string>(
    preselected?.courseId ?? initialDraft?.courseId ?? '',
  );
  const [busy, setBusy] = useState(false);
  const [existing, setExisting] = useState<ExistingCertSummary | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/courses');
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setCourses(
          list
            .map((c: { id: string; title: string }) => ({ id: c.id, title: c.title }))
            .sort((a: CourseOption, b: CourseOption) => a.title.localeCompare(b.title, 'uk')),
        );
      } finally {
        setLoadingCourses(false);
      }
    })();
  }, []);

  /// Persist чернетки тільки у manual-режимі.
  useEffect(() => {
    if (preselected) return;
    const isEmpty = !recipientName.trim() && !recipientEmail.trim() && !courseId;
    if (isEmpty) {
      clearDraft(COURSE_MANUAL_DRAFT_KEY);
    } else {
      writeDraft(COURSE_MANUAL_DRAFT_KEY, { recipientName, recipientEmail, courseId });
    }
  }, [preselected, recipientName, recipientEmail, courseId]);

  useEffect(() => {
    fetch('/api/admin/mailer-config')
      .then((r) => r.json())
      .then((data: { fromEmail?: string }) => {
        if (data?.fromEmail) setFromEmail(data.fromEmail);
      })
      .catch(() => {});
  }, []);

  const selectedCourse = useMemo(
    () => courses.find((c) => c.id === courseId) ?? null,
    [courses, courseId],
  );

  const canSubmit =
    !busy &&
    recipientName.trim().length > 0 &&
    recipientEmail.trim().length > 0 &&
    courseId.length > 0;

  async function submit(force: boolean) {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/certificates/course/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientName: recipientName.trim(),
          recipientEmail: recipientEmail.trim(),
          courseId,
          force,
        }),
      });
      const data = await res.json();
      if (res.status === 409 && data?.error === 'EXISTS' && data?.existing) {
        setExisting(data.existing as ExistingCertSummary);
        return;
      }
      if (!res.ok) throw new Error(data?.error ?? 'Помилка');
      setExisting(null);
      /// Чернетку чистимо лише у manual-режимі (preselected не пишеться у чернетку взагалі)
      if (!preselected) clearDraft(COURSE_MANUAL_DRAFT_KEY);
      onIssued();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Помилка');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell
      theme={theme}
      title="Видати курсовий сертифікат персонально"
      onClose={onClose}
      wide
      expandable
      footer={
        <>
          <button onClick={onClose} className={`px-4 py-2 rounded-lg text-[13px] ${dark ? 'bg-white/[0.05] text-slate-200' : 'bg-stone-100 text-stone-700'}`}>
            Скасувати
          </button>
          <button
            onClick={() => void submit(false)}
            disabled={!canSubmit}
            className="px-4 py-2 rounded-lg bg-amber-500 text-white text-[13px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? 'Видаю…' : 'Видати і відправити'}
          </button>
        </>
      }
    >
      {({ expanded }) => (
      <>
      <div className={`grid grid-cols-1 ${expanded ? 'lg:grid-cols-[0.5fr_1.5fr] lg:h-full' : 'lg:grid-cols-[1fr_1fr]'} gap-5`}>
        <div className="space-y-4">
          {draftRestored && !preselected && (
            <div className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-[11.5px] ${dark ? 'border-amber-500/25 bg-amber-500/10 text-amber-200' : 'border-amber-300/60 bg-amber-50 text-amber-900'}`}>
              <span className="inline-flex items-center gap-1.5">
                <HiOutlineInformationCircle className="w-3.5 h-3.5" />
                Відновлено чернетку — продовжуйте з того місця, де зупинилися
              </span>
              <button
                type="button"
                onClick={() => setDraftRestored(false)}
                className={`text-[11px] px-1.5 py-0.5 rounded ${dark ? 'hover:bg-white/[0.05] text-amber-300/80' : 'hover:bg-amber-100 text-amber-800/80'}`}
              >
                Зрозуміло
              </button>
            </div>
          )}
          <div>
            <label className={`block text-[11px] uppercase tracking-wider mb-1 ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
              Ім&apos;я (як надрукувати)
            </label>
            <input
              autoFocus
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value.replace(/(^|[\s\-'’])(\p{L})/gu, (_m, sep, ch) => sep + ch.toUpperCase()))}
              placeholder="Ім'я та Прізвище"
              className={`w-full px-3 py-2 rounded-lg border text-[13px] ${dark ? 'bg-white/[0.04] border-white/[0.1] text-white placeholder-slate-500' : 'bg-white border-stone-300 text-stone-900'}`}
            />
          </div>

          <div>
            <label className={`block text-[11px] uppercase tracking-wider mb-1 ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
              Email
            </label>
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="name@example.com"
              className={`w-full px-3 py-2 rounded-lg border text-[13px] ${dark ? 'bg-white/[0.04] border-white/[0.1] text-white placeholder-slate-500' : 'bg-white border-stone-300 text-stone-900'}`}
            />
            <p className={`text-[11px] mt-1 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
              Якщо такого юзера ще немає — буде створено новий запис.
            </p>
          </div>

          <div>
            <label className={`block text-[11px] uppercase tracking-wider mb-1 ${dark ? 'text-slate-500' : 'text-stone-400'}`}>
              Лист надійде з
            </label>
            <input
              type="text"
              readOnly
              disabled
              value={fromEmail ?? 'Завантаження…'}
              title="Адреса відправника листа. Змінити можна тільки через RESEND_FROM_EMAIL у env."
              className={`w-full px-3 py-2 rounded-lg border text-[13px] cursor-not-allowed ${
                dark
                  ? 'bg-white/[0.02] border-white/[0.06] text-slate-500'
                  : 'bg-stone-100 border-stone-200 text-stone-500'
              }`}
            />
          </div>

          <div>
            <label className={`block text-[11px] uppercase tracking-wider mb-1 ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
              Курс
            </label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              disabled={loadingCourses}
              className={`w-full px-3 py-2 rounded-lg border text-[13px] ${dark ? 'bg-white/[0.04] border-white/[0.1] text-white' : 'bg-white border-stone-300 text-stone-900'}`}
            >
              <option value="">{loadingCourses ? 'Завантаження…' : '— оберіть курс —'}</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>
        </div>

        <PreviewPane
          theme={theme}
          disabled={!recipientName.trim() || !selectedCourse}
          compact={!expanded}
          params={{
            type: 'COURSE',
            recipientName: recipientName.trim(),
            courseName: selectedCourse?.title,
          }}
        />
      </div>

      {existing && (
        <ExistingCertConfirm
          theme={theme}
          existing={existing}
          courseTitle={selectedCourse?.title ?? ''}
          recipientEmail={recipientEmail.trim()}
          onCancel={() => setExisting(null)}
          onConfirm={() => void submit(true)}
          busy={busy}
        />
      )}
      </>
      )}
    </ModalShell>
  );
}

function ExistingCertConfirm({
  theme,
  existing,
  courseTitle,
  recipientEmail,
  onCancel,
  onConfirm,
  busy,
}: {
  theme: Theme;
  existing: ExistingCertSummary;
  courseTitle: string;
  recipientEmail: string;
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  const dark = theme === 'dark';
  const sentLabel =
    existing.emailStatus === 'SENT'
      ? `Виданий і відправлений${existing.emailSentAt ? ` (${formatDate(existing.emailSentAt)})` : ''}`
      : existing.emailStatus === 'FAILED'
        ? 'Виданий, але лист не відправлено'
        : 'Виданий, лист ще не відправлений';

  return (
    <div
      className={`fixed inset-0 z-[90] flex items-center justify-center p-4 ${dark ? 'bg-black/80' : 'bg-stone-900/60'}`}
      onClick={onCancel}
    >
      <div
        className={`relative w-full max-w-[560px] rounded-2xl shadow-2xl border ${dark ? 'bg-[#14161d] border-amber-500/40 text-slate-100' : 'bg-[#fbf7ec] border-amber-500/50 text-stone-900'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-2 flex items-start gap-3">
          <span
            className={`flex-shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-full ${dark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700'}`}
          >
            <HiOutlineExclamationTriangle className="w-6 h-6" />
          </span>
          <div className="min-w-0">
            <h3 className="text-[18px] font-semibold leading-tight">
              Сертифікат для цього юзера й курсу вже існує
            </h3>
            <p className={`text-[12.5px] mt-1 ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
              Якщо натиснути «Все одно видати», попередній буде відкликано, а замість
              нього створено новий і відправлено лист.
            </p>
          </div>
        </div>

        <div className={`mx-6 my-4 rounded-xl p-4 text-[13px] leading-[1.65] ${dark ? 'bg-amber-500/10 border border-amber-500/25 text-amber-100' : 'bg-amber-50 border border-amber-300/60 text-amber-950'}`}>
          <ul className="space-y-1.5">
            <li><strong>Email:</strong> {recipientEmail}</li>
            <li><strong>Курс:</strong> {courseTitle}</li>
            <li><strong>Номер:</strong> <span className="font-mono">{existing.certNumber}</span></li>
            <li><strong>Ім&apos;я в серті:</strong> {existing.recipientName}</li>
            <li><strong>Видано:</strong> {formatDate(existing.issuedAt)} · {existing.issuedManually ? 'вручну' : 'авто'}</li>
            <li><strong>Статус:</strong> {sentLabel}</li>
          </ul>
        </div>

        <div className="px-6 pb-6 pt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className={`px-4 py-2.5 rounded-lg text-[13px] font-medium transition-colors disabled:opacity-50 ${dark ? 'bg-white/[0.05] text-slate-200 hover:bg-white/[0.1]' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}
          >
            Скасувати
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[13px] font-semibold shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? 'Видаю…' : 'Все одно видати'}
          </button>
        </div>
      </div>
    </div>
  );
}

function IssueYearlyDialog({
  theme,
  candidate,
  onClose,
  onIssued,
  onError,
}: {
  theme: Theme;
  candidate: YearlyCandidate;
  onClose: () => void;
  onIssued: () => void;
  onError: (msg: string) => void;
}) {
  const dark = theme === 'dark';
  const [category, setCategory] = useState<CertCategory>('PRACTICAL');
  const [recipientName, setRecipientName] = useState(candidate.userName ?? '');
  const [fromEmail, setFromEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingPartial, setConfirmingPartial] = useState(false);

  useEffect(() => {
    fetch('/api/admin/mailer-config')
      .then((r) => r.json())
      .then((data: { fromEmail?: string }) => {
        if (data?.fromEmail) setFromEmail(data.fromEmail);
      })
      .catch(() => {});
  }, []);

  async function submit() {
    setConfirmingPartial(false);
    setBusy(true);
    try {
      const res = await fetch('/api/admin/certificates/yearly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: candidate.userId,
          subscriptionId: candidate.subscriptionId,
          category,
          recipientName: recipientName.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Помилка');
      onIssued();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Помилка');
    } finally {
      setBusy(false);
    }
  }

  /// Якщо оплата неповна — спочатку показуємо confirm-попап. Інакше — одразу submit.
  function handleClickIssue() {
    if (candidate.paymentHealth !== 'FULL') {
      setConfirmingPartial(true);
    } else {
      void submit();
    }
  }

  return (
    <ModalShell
      theme={theme}
      title="Видати сертифікат Річної програми"
      onClose={onClose}
      wide
      expandable
      footer={
        <>
          <button onClick={onClose} className={`px-4 py-2 rounded-lg text-[13px] ${dark ? 'bg-white/[0.05] text-slate-200' : 'bg-stone-100 text-stone-700'}`}>
            Скасувати
          </button>
          <button
            onClick={handleClickIssue}
            disabled={busy || !recipientName.trim()}
            className="px-4 py-2 rounded-lg bg-amber-500 text-white text-[13px] font-semibold disabled:opacity-50"
          >
            {busy ? 'Видаю…' : 'Видати і відправити'}
          </button>
        </>
      }
    >
      {({ expanded }) => (
      <>
      <div className={`grid grid-cols-1 ${expanded ? 'lg:grid-cols-[0.5fr_1.5fr] lg:h-full' : 'lg:grid-cols-[1fr_1fr]'} gap-5`}>
        <div className="space-y-4">
        <div className={`rounded-lg p-4 ${dark ? 'bg-white/[0.04]' : 'bg-stone-50'}`}>
          <div className="font-medium">{candidate.userName ?? '—'}</div>
          <div className={`text-[12px] mt-0.5 ${dark ? 'text-slate-400' : 'text-stone-500'}`}>{candidate.userEmail}</div>
          <div className="mt-2 flex items-center gap-3">
            <HealthBadge theme={theme} candidate={candidate} />
            <span className={`text-[11px] ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
              {candidate.plan === 'YEARLY' ? 'Річний' : 'Місячний'} · {statusUa(candidate.status)}
            </span>
          </div>
          {candidate.paymentHealth !== 'FULL' && (
            <div className={`mt-3 flex items-start gap-2 p-2.5 rounded text-[12px] ${dark ? 'bg-amber-500/10 text-amber-200' : 'bg-amber-50 text-amber-900'}`}>
              <HiOutlineExclamationTriangle className="flex-shrink-0 mt-0.5" />
              <span>
                Неповна оплата: <strong>{candidate.paidCount}/{candidate.expectedPayments}</strong>. Переконайтесь, що дійсно треба видавати сертифікат.
              </span>
            </div>
          )}
        </div>

        <div>
          <label className={`block text-[11px] uppercase tracking-wider mb-2 ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
            Категорія
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(['PRACTICAL', 'LISTENER'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setCategory(k)}
                className={`text-left px-4 py-3 rounded-xl border transition-all ${
                  category === k
                    ? 'bg-amber-500 border-amber-500 text-white shadow-md'
                    : dark
                      ? 'bg-white/[0.04] border-white/[0.1] text-slate-200 hover:bg-white/[0.08]'
                      : 'bg-white border-stone-300 text-stone-800 hover:bg-stone-50'
                }`}
              >
                <div className="font-semibold text-[14px]">
                  {k === 'PRACTICAL' ? 'Практична участь' : 'Слухач'}
                </div>
                <div className={`text-[11px] mt-0.5 ${category === k ? 'text-white/80' : dark ? 'text-slate-400' : 'text-stone-500'}`}>
                  {k === 'PRACTICAL' ? 'Вища категорія — активна практика' : 'Слухав лекції, без активної практики'}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={`block text-[11px] uppercase tracking-wider mb-1 ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
            Ім'я для друку на сертифікаті
          </label>
          <input
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value.replace(/(^|[\s\-'’])(\p{L})/gu, (_m, sep, ch) => sep + ch.toUpperCase()))}
            placeholder="Повне ім'я учасника"
            className={`w-full px-3 py-2 rounded-lg border text-[14px] ${dark ? 'bg-white/[0.04] border-white/[0.1] text-white' : 'bg-white border-stone-300 text-stone-900'}`}
          />
        </div>

        <div>
          <label className={`block text-[11px] uppercase tracking-wider mb-1 ${dark ? 'text-slate-500' : 'text-stone-400'}`}>
            Лист надійде з
          </label>
          <input
            type="text"
            readOnly
            disabled
            value={fromEmail ?? 'Завантаження…'}
            title="Адреса відправника листа. Змінити можна тільки через RESEND_FROM_EMAIL у env."
            className={`w-full px-3 py-2 rounded-lg border text-[13px] cursor-not-allowed ${
              dark
                ? 'bg-white/[0.02] border-white/[0.06] text-slate-500'
                : 'bg-stone-100 border-stone-200 text-stone-500'
            }`}
          />
        </div>
        </div>

        <PreviewPane
          theme={theme}
          compact={!expanded}
          params={{
            type: 'YEARLY_PROGRAM',
            category,
            recipientName: recipientName.trim(),
          }}
        />
      </div>

      {confirmingPartial && (
        <PartialPaymentConfirm
          theme={theme}
          candidate={candidate}
          category={category}
          onCancel={() => setConfirmingPartial(false)}
          onConfirm={() => void submit()}
          busy={busy}
        />
      )}
      </>
      )}
    </ModalShell>
  );
}

function PartialPaymentConfirm({
  theme,
  candidate,
  category,
  onCancel,
  onConfirm,
  busy,
}: {
  theme: Theme;
  candidate: YearlyCandidate;
  category: CertCategory;
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  const dark = theme === 'dark';
  const expected = candidate.expectedPayments;
  const paid = candidate.paidCount;
  const missing = Math.max(expected - paid, 0);
  const planLabel = candidate.plan === 'YEARLY' ? 'річну' : 'місячну';
  const categoryLabel = category === 'PRACTICAL' ? 'Практична участь' : 'Слухач';

  return (
    <div
      className={`fixed inset-0 z-[90] flex items-center justify-center p-4 ${dark ? 'bg-black/80' : 'bg-stone-900/60'}`}
      onClick={onCancel}
    >
      <div
        className={`relative w-full max-w-[520px] rounded-2xl shadow-2xl border ${dark ? 'bg-[#14161d] border-amber-500/40 text-slate-100' : 'bg-[#fbf7ec] border-amber-500/50 text-stone-900'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-2 flex items-start gap-3">
          <span
            className={`flex-shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-full ${dark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700'}`}
          >
            <HiOutlineExclamationTriangle className="w-6 h-6" />
          </span>
          <div className="min-w-0">
            <h3 className="text-[18px] font-semibold leading-tight">
              Оплата неповна. Точно видавати сертифікат?
            </h3>
            <p className={`text-[12.5px] mt-1 ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
              Ця дія створить сертифікат, відправить його на email учаснику й зафіксується у журналі. Відмінити можна лише через відклик.
            </p>
          </div>
        </div>

        <div className={`mx-6 my-4 rounded-xl p-4 text-[13px] leading-[1.65] ${dark ? 'bg-amber-500/10 border border-amber-500/25 text-amber-100' : 'bg-amber-50 border border-amber-300/60 text-amber-950'}`}>
          <ul className="space-y-1.5">
            <li>
              <strong>Учасник:</strong> {candidate.userName ?? candidate.userEmail}
            </li>
            <li>
              <strong>Підписка:</strong> {planLabel} ({statusUa(candidate.status)})
            </li>
            <li>
              <strong>Платежі:</strong>{' '}
              <span className="font-mono">{paid} з {expected}</span>
              {missing > 0 && (
                <> · <span className={dark ? 'text-red-300' : 'text-red-700'}>не вистачає {missing}</span></>
              )}
            </li>
            <li>
              <strong>Категорія сертифіката:</strong> {categoryLabel}
            </li>
          </ul>
          <p className={`mt-3 text-[12px] ${dark ? 'text-amber-200/80' : 'text-amber-900/80'}`}>
            Зазвичай сертифікат видається після ПОВНОЇ оплати. Якщо це особлива домовленість з учнем —
            продовжуй. Якщо сумніваєшся — скасуй і уточни.
          </p>
        </div>

        <div className="px-6 pb-6 pt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className={`px-4 py-2.5 rounded-lg text-[13px] font-medium transition-colors disabled:opacity-50 ${dark ? 'bg-white/[0.05] text-slate-200 hover:bg-white/[0.1]' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}
          >
            Скасувати
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[13px] font-semibold shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? 'Видаю…' : 'Так, видати і відправити'}
          </button>
        </div>
      </div>
    </div>
  );
}

function IssueYearlyManualDialog({
  theme,
  onClose,
  onIssued,
  onError,
}: {
  theme: Theme;
  onClose: () => void;
  onIssued: () => void;
  onError: (msg: string) => void;
}) {
  const dark = theme === 'dark';
  const [fromEmail, setFromEmail] = useState<string | null>(null);
  /// Чернетка форми зберігається у localStorage — щоб ненавмисне закриття
  /// не з'їдало введене.
  const initialDraft = useMemo(() => loadYearlyManualDraft(), []);
  const [draftRestored, setDraftRestored] = useState<boolean>(() => initialDraft !== null);
  const [recipientName, setRecipientName] = useState(initialDraft?.recipientName ?? '');
  const [recipientEmail, setRecipientEmail] = useState(initialDraft?.recipientEmail ?? '');
  const [category, setCategory] = useState<CertCategory>(initialDraft?.category ?? 'PRACTICAL');
  const [busy, setBusy] = useState(false);
  const [existing, setExisting] = useState<ExistingCertSummary | null>(null);

  useEffect(() => {
    fetch('/api/admin/mailer-config')
      .then((r) => r.json())
      .then((data: { fromEmail?: string }) => {
        if (data?.fromEmail) setFromEmail(data.fromEmail);
      })
      .catch(() => {});
  }, []);

  /// Persist чернетки на КОЖНУ зміну. Пуста форма (без імені/email і дефолтна
  /// категорія) → чистимо запис, щоб localStorage не накопичував мусор.
  useEffect(() => {
    const isEmpty =
      !recipientName.trim() &&
      !recipientEmail.trim() &&
      category === 'PRACTICAL';
    if (isEmpty) {
      clearDraft(YEARLY_MANUAL_DRAFT_KEY);
    } else {
      writeDraft(YEARLY_MANUAL_DRAFT_KEY, { recipientName, recipientEmail, category });
    }
  }, [recipientName, recipientEmail, category]);

  const canSubmit =
    !busy &&
    recipientName.trim().length > 0 &&
    recipientEmail.trim().length > 0;

  async function submit(force: boolean) {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/certificates/yearly/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientName: recipientName.trim(),
          recipientEmail: recipientEmail.trim(),
          category,
          force,
        }),
      });
      const data = await res.json();
      if (res.status === 409 && data?.error === 'EXISTS' && data?.existing) {
        setExisting(data.existing as ExistingCertSummary);
        return;
      }
      if (!res.ok) throw new Error(data?.error ?? 'Помилка');
      setExisting(null);
      clearDraft(YEARLY_MANUAL_DRAFT_KEY);
      onIssued();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Помилка');
    } finally {
      setBusy(false);
    }
  }

  const categoryLabel = category === 'PRACTICAL' ? 'Практична участь' : 'Слухач';

  return (
    <ModalShell
      theme={theme}
      title="Видати сертифікат Річної програми персонально"
      onClose={onClose}
      wide
      expandable
      footer={
        <>
          <button onClick={onClose} className={`px-4 py-2 rounded-lg text-[13px] ${dark ? 'bg-white/[0.05] text-slate-200' : 'bg-stone-100 text-stone-700'}`}>
            Скасувати
          </button>
          <button
            onClick={() => void submit(false)}
            disabled={!canSubmit}
            className="px-4 py-2 rounded-lg bg-amber-500 text-white text-[13px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? 'Видаю…' : 'Видати і відправити'}
          </button>
        </>
      }
    >
      {({ expanded }) => (
      <>
      <div className={`grid grid-cols-1 ${expanded ? 'lg:grid-cols-[0.5fr_1.5fr] lg:h-full' : 'lg:grid-cols-[1fr_1fr]'} gap-5`}>
        <div className="space-y-4">
          {draftRestored && (
            <div className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-[11.5px] ${dark ? 'border-amber-500/25 bg-amber-500/10 text-amber-200' : 'border-amber-300/60 bg-amber-50 text-amber-900'}`}>
              <span className="inline-flex items-center gap-1.5">
                <HiOutlineInformationCircle className="w-3.5 h-3.5" />
                Відновлено чернетку — продовжуйте з того місця, де зупинилися
              </span>
              <button
                type="button"
                onClick={() => setDraftRestored(false)}
                className={`text-[11px] px-1.5 py-0.5 rounded ${dark ? 'hover:bg-white/[0.05] text-amber-300/80' : 'hover:bg-amber-100 text-amber-800/80'}`}
              >
                Зрозуміло
              </button>
            </div>
          )}
          <div>
            <label className={`block text-[11px] uppercase tracking-wider mb-1 ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
              Ім&apos;я (як надрукувати)
            </label>
            <input
              autoFocus
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value.replace(/(^|[\s\-'’])(\p{L})/gu, (_m, sep, ch) => sep + ch.toUpperCase()))}
              placeholder="Ім'я та Прізвище"
              className={`w-full px-3 py-2 rounded-lg border text-[13px] ${dark ? 'bg-white/[0.04] border-white/[0.1] text-white placeholder-slate-500' : 'bg-white border-stone-300 text-stone-900'}`}
            />
          </div>

          <div>
            <label className={`block text-[11px] uppercase tracking-wider mb-1 ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
              Email
            </label>
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="name@example.com"
              className={`w-full px-3 py-2 rounded-lg border text-[13px] ${dark ? 'bg-white/[0.04] border-white/[0.1] text-white placeholder-slate-500' : 'bg-white border-stone-300 text-stone-900'}`}
            />
            <p className={`text-[11px] mt-1 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
              Якщо такого юзера ще немає — буде створено новий запис.
            </p>
          </div>

          <div>
            <label className={`block text-[11px] uppercase tracking-wider mb-1 ${dark ? 'text-slate-500' : 'text-stone-400'}`}>
              Лист надійде з
            </label>
            <input
              type="text"
              readOnly
              disabled
              value={fromEmail ?? 'Завантаження…'}
              title="Адреса відправника листа. Змінити можна тільки через RESEND_FROM_EMAIL у env."
              className={`w-full px-3 py-2 rounded-lg border text-[13px] cursor-not-allowed ${
                dark
                  ? 'bg-white/[0.02] border-white/[0.06] text-slate-500'
                  : 'bg-stone-100 border-stone-200 text-stone-500'
              }`}
            />
          </div>

          <div>
            <label className={`block text-[11px] uppercase tracking-wider mb-2 ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
              Категорія
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['PRACTICAL', 'LISTENER'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setCategory(k)}
                  className={`text-left px-4 py-3 rounded-xl border transition-all ${
                    category === k
                      ? 'bg-amber-500 border-amber-500 text-white shadow-md'
                      : dark
                        ? 'bg-white/[0.04] border-white/[0.1] text-slate-200 hover:bg-white/[0.08]'
                        : 'bg-white border-stone-300 text-stone-800 hover:bg-stone-50'
                  }`}
                >
                  <div className="font-semibold text-[14px]">
                    {k === 'PRACTICAL' ? 'Практична участь' : 'Слухач'}
                  </div>
                  <div className={`text-[11px] mt-0.5 ${category === k ? 'text-white/80' : dark ? 'text-slate-400' : 'text-stone-500'}`}>
                    {k === 'PRACTICAL' ? 'Вища категорія — активна практика' : 'Слухав лекції, без активної практики'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <PreviewPane
          theme={theme}
          disabled={!recipientName.trim()}
          compact={!expanded}
          params={{
            type: 'YEARLY_PROGRAM',
            category,
            recipientName: recipientName.trim(),
          }}
        />
      </div>

      {existing && (
        <ExistingCertConfirm
          theme={theme}
          existing={existing}
          courseTitle={`Річна програма · ${categoryLabel}`}
          recipientEmail={recipientEmail.trim()}
          onCancel={() => setExisting(null)}
          onConfirm={() => void submit(true)}
          busy={busy}
        />
      )}
      </>
      )}
    </ModalShell>
  );
}

/* --------------------------- IssueSupervisionDialog --------------------------- */

/// Модалка пакетної видачі сертифікатів супервізії. Один POST = одне заняття,
/// спільна тема + дата, список учасників (1-100). API обробляє їх паралельно через
/// Promise.allSettled. Часткові помилки тримають модалку відкритою — невдалі
/// рядки лишаються у формі для виправлення і повторної відправки.
type SupervisionRecipient = { id: string; name: string; email: string };
type SupervisionFailed = { name: string; email: string; error: string };

const SUPERVISION_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/// Витяг email-у з довільного рядка bulk-paste — для парсингу строк виду
/// "Іван Петренко <ivan@x.com>" або "Іван Петренко, ivan@x.com" або просто "Ivan ivan@x.com"
const SUPERVISION_EMAIL_EXTRACT_RE = /[^\s,;<>"'()]+@[^\s,;<>"'()]+\.[^\s,;<>"'()]+/;

function newSupervisionRecipient(): SupervisionRecipient {
  return {
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 11),
    name: '',
    email: '',
  };
}

/// Авто-капіталізація: перша буква кожного слова (після пробілу/дефіса/апострофа).
function autoCapName(value: string): string {
  return value.replace(/(^|[\s\-'’])(\p{L})/gu, (_m, sep, ch) => sep + ch.toUpperCase());
}

/// Persist-чернетка форми супервізії: тема, дата, список учасників. Зберігається
/// у localStorage на кожну зміну, щоб ненавмисне закриття модалки не з'їдало
/// введене. Очищується після успішної відправки (всі сертифікати видані).
const SUPERVISION_DRAFT_KEY = 'cert-supervision-draft-v1';

type SupervisionDraft = {
  topic: string;
  supervisionDate: string;
  supervisionHours: string;
  recipients: SupervisionRecipient[];
};

function loadSupervisionDraft(): SupervisionDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SUPERVISION_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SupervisionDraft>;
    if (
      typeof parsed?.topic !== 'string' ||
      typeof parsed?.supervisionDate !== 'string' ||
      !Array.isArray(parsed?.recipients)
    ) {
      return null;
    }
    const recipients: SupervisionRecipient[] = (parsed.recipients as unknown[])
      .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
      .map((r) => ({
        id: typeof r.id === 'string' && r.id.length > 0 ? r.id : newSupervisionRecipient().id,
        name: typeof r.name === 'string' ? r.name : '',
        email: typeof r.email === 'string' ? r.email : '',
      }));
    return {
      topic: parsed.topic,
      supervisionDate: parsed.supervisionDate,
      supervisionHours: typeof parsed.supervisionHours === 'string' ? parsed.supervisionHours : '',
      recipients: recipients.length > 0 ? recipients : [newSupervisionRecipient()],
    };
  } catch {
    return null;
  }
}

function saveSupervisionDraft(draft: SupervisionDraft) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SUPERVISION_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // ignore quota / private mode
  }
}

function clearSupervisionDraft() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(SUPERVISION_DRAFT_KEY);
  } catch {
    // ignore
  }
}

/// Збираємо URL для PDF-превʼю SUPERVISION-сертифіката для конкретного учасника.
/// Виносимо в helper, бо викликається і з PreviewPane, і з per-row кнопок «👁».
function buildSupervisionPreviewSrc({
  name,
  topic,
  supervisionDate,
  supervisionHours,
}: {
  name: string;
  topic: string;
  supervisionDate: string;
  supervisionHours: string;
}): string {
  const qs = new URLSearchParams({
    type: 'SUPERVISION',
    name: name.trim(),
  });
  if (topic.trim()) qs.set('courseName', topic.trim());
  if (supervisionDate) qs.set('supervisionDate', supervisionDate);
  if (supervisionHours.trim()) qs.set('supervisionHours', supervisionHours.trim());
  return `/api/admin/certificates/preview?${qs.toString()}#toolbar=0&navpanes=0&scrollbar=0&statusbar=0&messages=0&view=Fit&zoom=page-fit`;
}

/// Парсинг bulk-textarea: підтримує два формати — інлайн (імʼя+email на одному рядку)
/// та парний (імʼя на одному рядку, email на наступному). Пусті рядки ігноруються.
/// Якщо парний-режим знаходить імʼя без наступного email — створює рядок з пустим email.
function parseSupervisionBulk(text: string): SupervisionRecipient[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const out: SupervisionRecipient[] = [];
  let pendingName: string | null = null;

  for (const line of lines) {
    const emailMatch = line.match(SUPERVISION_EMAIL_EXTRACT_RE);
    const email = emailMatch ? emailMatch[0] : '';
    const inlineName = email
      ? line.replace(email, '').replace(/[<>,;"']/g, '').trim()
      : line;

    if (email && inlineName) {
      /// Імʼя й email на одному рядку → флашимо попереднє ім'я-сирітку, додаємо пару.
      if (pendingName) {
        out.push({ ...newSupervisionRecipient(), name: autoCapName(pendingName), email: '' });
        pendingName = null;
      }
      out.push({ ...newSupervisionRecipient(), name: autoCapName(inlineName), email });
    } else if (email) {
      /// Email-only → парується з попереднім pendingName, якщо є.
      out.push({
        ...newSupervisionRecipient(),
        name: pendingName ? autoCapName(pendingName) : '',
        email,
      });
      pendingName = null;
    } else {
      /// Name-only → якщо вже є pendingName, флашимо його як сироту й беремо новий.
      if (pendingName) {
        out.push({ ...newSupervisionRecipient(), name: autoCapName(pendingName), email: '' });
      }
      pendingName = inlineName;
    }
  }

  if (pendingName) {
    out.push({ ...newSupervisionRecipient(), name: autoCapName(pendingName), email: '' });
  }

  return out;
}

function IssueSupervisionDialog({
  theme,
  onClose,
  onIssued,
  onError,
}: {
  theme: Theme;
  onClose: () => void;
  onIssued: (count: number) => void;
  onError: (msg: string) => void;
}) {
  const dark = theme === 'dark';
  /// Завантажуємо чернетку один раз при mount (модалка рендериться тільки клієнтсько,
  /// тож SSR-mismatch неможливий) — користувач отримує те, що ввів минулого разу.
  const initialDraft = useMemo(() => loadSupervisionDraft(), []);
  const [draftRestored, setDraftRestored] = useState<boolean>(() => initialDraft !== null);
  const [fromEmail, setFromEmail] = useState<string | null>(null);
  const [topic, setTopic] = useState<string>(initialDraft?.topic ?? '');
  const [supervisionDate, setSupervisionDate] = useState<string>(initialDraft?.supervisionDate ?? '');
  const [supervisionHours, setSupervisionHours] = useState<string>(initialDraft?.supervisionHours ?? '');
  const [recipients, setRecipients] = useState<SupervisionRecipient[]>(
    () => initialDraft?.recipients ?? [newSupervisionRecipient()],
  );
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<SupervisionFailed[] | null>(null);
  /// Який учасник зараз відкритий у fullscreen-overlay (натиснули «👁» у його рядку).
  /// Використовуємо id, а не індекс — щоб видалення/перевпорядкування рядків не ламали посилання.
  const [previewRowId, setPreviewRowId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/mailer-config')
      .then((r) => r.json())
      .then((data: { fromEmail?: string }) => {
        if (data?.fromEmail) setFromEmail(data.fromEmail);
      })
      .catch(() => {});
  }, []);

  /// Persist чернетки на КОЖНУ зміну форми. Пуста форма → чистимо запис.
  useEffect(() => {
    const isEmpty =
      !topic.trim() &&
      !supervisionDate &&
      !supervisionHours.trim() &&
      recipients.every((r) => !r.name.trim() && !r.email.trim());
    if (isEmpty) {
      clearSupervisionDraft();
    } else {
      saveSupervisionDraft({ topic, supervisionDate, supervisionHours, recipients });
    }
  }, [topic, supervisionDate, supervisionHours, recipients]);

  /// Лічильник валідних учасників: і імʼя, і email мають пройти валідацію
  const validCount = useMemo(
    () =>
      recipients.filter(
        (r) => r.name.trim().length > 0 && SUPERVISION_EMAIL_RE.test(r.email.trim()),
      ).length,
    [recipients],
  );

  /// Дублі по email (case-insensitive) — підсвічуємо у формі, не блокуємо submit
  /// (бекенд видасть кілька сертифікатів з різними certNumber, це валідно за бізнес-логікою).
  const duplicateEmails = useMemo(() => {
    const seen = new Map<string, number>();
    for (const r of recipients) {
      const key = r.email.trim().toLowerCase();
      if (!key) continue;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    return new Set([...seen.entries()].filter(([, n]) => n > 1).map(([e]) => e));
  }, [recipients]);

  const canSubmit = !busy && topic.trim().length > 0 && validCount > 0;

  /// Превʼю тягнеться для ПЕРШОГО валідного учасника — щоб менеджер бачив, як
  /// виглядатиме сертифікат, без 50-рендерів одночасно.
  const previewRecipient = recipients.find(
    (r) => r.name.trim().length > 0 && SUPERVISION_EMAIL_RE.test(r.email.trim()),
  );

  function updateRecipient(id: string, patch: Partial<Pick<SupervisionRecipient, 'name' | 'email'>>) {
    setRecipients((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addRecipient() {
    setRecipients((prev) => [...prev, newSupervisionRecipient()]);
  }

  function removeRecipient(id: string) {
    setRecipients((prev) => {
      const next = prev.filter((r) => r.id !== id);
      /// Завжди лишаємо принаймні 1 пустий рядок — щоб форма не «зникала»
      return next.length === 0 ? [newSupervisionRecipient()] : next;
    });
  }

  function applyBulkPaste() {
    const parsed = parseSupervisionBulk(bulkText);
    if (parsed.length === 0) return;
    setRecipients((prev) => {
      /// Зберігаємо існуючі НЕ-порожні рядки + додаємо нові
      const keep = prev.filter((r) => r.name.trim() || r.email.trim());
      return [...keep, ...parsed];
    });
    setBulkText('');
    setBulkOpen(false);
  }

  function clearAll() {
    setTopic('');
    setSupervisionDate('');
    setSupervisionHours('');
    setRecipients([newSupervisionRecipient()]);
    setFailed(null);
    setDraftRestored(false);
    clearSupervisionDraft();
  }

  async function submit() {
    setBusy(true);
    setFailed(null);
    try {
      /// Передаємо лише валідних — невалідні (порожні рядки) ігноруємо при submit-і
      const payloadRecipients = recipients
        .filter((r) => r.name.trim().length > 0 && SUPERVISION_EMAIL_RE.test(r.email.trim()))
        .map((r) => ({ name: r.name.trim(), email: r.email.trim() }));

      const parsedHours = supervisionHours.trim()
        ? parseFloat(supervisionHours.trim().replace(',', '.'))
        : null;
      const res = await fetch('/api/admin/certificates/supervision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          supervisionDate: supervisionDate || null,
          supervisionHours: parsedHours !== null && Number.isFinite(parsedHours) ? parsedHours : null,
          recipients: payloadRecipients,
        }),
      });
      const data = (await res.json()) as {
        issued?: number;
        failed?: SupervisionFailed[];
        error?: string;
      };
      if (!res.ok) throw new Error(data?.error ?? 'Помилка');

      const failedList = Array.isArray(data.failed) ? data.failed : [];
      const issuedCount = typeof data.issued === 'number' ? data.issued : 0;

      if (failedList.length === 0) {
        /// Усе видано → закриваємо модалку, parent ховає toast.
        /// Чернетку чистимо, щоб наступне відкриття форми було порожнім.
        clearSupervisionDraft();
        onIssued(issuedCount);
        return;
      }

      /// Часткова невдача: лишаємо у формі ЛИШЕ ті рядки, що впали — щоб менеджер
      /// міг виправити (наприклад, юзер у архіві → інший email) і відправити ще раз
      /// без ризику задвоїти сертифікати тим, кому вже видано.
      const failedKeys = new Set(failedList.map((f) => f.email.trim().toLowerCase()));
      setRecipients((prev) => {
        const keptFailed = prev.filter((r) => failedKeys.has(r.email.trim().toLowerCase()));
        return keptFailed.length > 0 ? keptFailed : [newSupervisionRecipient()];
      });
      setFailed(failedList);
      onError(`${issuedCount} видано, ${failedList.length} з помилкою — залишились у списку`);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Помилка');
    } finally {
      setBusy(false);
    }
  }

  const submitLabel = busy
    ? 'Видаю…'
    : validCount === 0
      ? 'Видати і відправити'
      : validCount === 1
        ? 'Видати і відправити'
        : `Видати ${validCount} сертифікатів`;

  return (
    <ModalShell
      theme={theme}
      title="Видати сертифікати супервізії"
      onClose={onClose}
      wide
      expandable
      footer={
        <>
          <button onClick={onClose} className={`px-4 py-2 rounded-lg text-[13px] ${dark ? 'bg-white/[0.05] text-slate-200' : 'bg-stone-100 text-stone-700'}`}>
            Скасувати
          </button>
          <button
            onClick={() => void submit()}
            disabled={!canSubmit}
            className="px-4 py-2 rounded-lg bg-amber-500 text-white text-[13px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitLabel}
          </button>
        </>
      }
    >
      {({ expanded }) => (
      <>
      <div className={`grid grid-cols-1 ${expanded ? 'lg:grid-cols-[0.55fr_1.45fr] lg:h-full' : 'lg:grid-cols-[1.1fr_0.9fr]'} gap-5`}>
        <div className="flex flex-col">
          {draftRestored && (
            <div className={`mb-3 flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-[11.5px] ${dark ? 'border-amber-500/25 bg-amber-500/10 text-amber-200' : 'border-amber-300/60 bg-amber-50 text-amber-900'}`}>
              <span className="inline-flex items-center gap-1.5">
                <HiOutlineInformationCircle className="w-3.5 h-3.5" />
                Відновлено чернетку — продовжуйте з того місця, де зупинилися
              </span>
              <button
                type="button"
                onClick={() => setDraftRestored(false)}
                className={`text-[11px] px-1.5 py-0.5 rounded ${dark ? 'hover:bg-white/[0.05] text-amber-300/80' : 'hover:bg-amber-100 text-amber-800/80'}`}
              >
                Зрозуміло
              </button>
            </div>
          )}
          {/* Тема */}
          <div className="mb-3">
            <label className={`block text-[11px] uppercase tracking-wider mb-1 ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
              Тема супервізії
            </label>
            <input
              autoFocus
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Напр.: Робота з проєкціями у клієнтсько-терапевтичних відносинах"
              className={`w-full px-3 py-2 rounded-lg border text-[13px] ${dark ? 'bg-white/[0.04] border-white/[0.1] text-white placeholder-slate-500' : 'bg-white border-stone-300 text-stone-900'}`}
            />
          </div>

          {/* Дата + Тривалість + Лист надійде з: 3 cols */}
          <div className="grid grid-cols-[1fr_120px_1fr] gap-3 mb-3">
            <div>
              <label className={`block text-[11px] uppercase tracking-wider mb-1 ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
                Дата <span className={`normal-case ${dark ? 'text-slate-500' : 'text-stone-400'}`}>(опційно)</span>
              </label>
              <input
                type="date"
                value={supervisionDate}
                onChange={(e) => setSupervisionDate(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border text-[13px] ${dark ? 'bg-white/[0.04] border-white/[0.1] text-white' : 'bg-white border-stone-300 text-stone-900'}`}
              />
            </div>
            <div>
              <label className={`block text-[11px] uppercase tracking-wider mb-1 ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
                Години <span className={`normal-case ${dark ? 'text-slate-500' : 'text-stone-400'}`}>(опц.)</span>
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="24"
                value={supervisionHours}
                onChange={(e) => setSupervisionHours(e.target.value)}
                placeholder="напр. 2"
                className={`w-full px-3 py-2 rounded-lg border text-[13px] ${dark ? 'bg-white/[0.04] border-white/[0.1] text-white placeholder-slate-500' : 'bg-white border-stone-300 text-stone-900 placeholder-stone-400'}`}
              />
            </div>
            <div>
              <label className={`block text-[11px] uppercase tracking-wider mb-1 ${dark ? 'text-slate-500' : 'text-stone-400'}`}>
                Лист надійде з
              </label>
              <input
                type="text"
                readOnly
                disabled
                value={fromEmail ?? 'Завантаження…'}
                title="Адреса відправника листа. Змінити можна тільки через RESEND_FROM_EMAIL у env."
                className={`w-full px-3 py-2 rounded-lg border text-[13px] cursor-not-allowed ${
                  dark
                    ? 'bg-white/[0.02] border-white/[0.06] text-slate-500'
                    : 'bg-stone-100 border-stone-200 text-stone-500'
                }`}
              />
            </div>
          </div>

          {/* Учасники: header + scrollable list + add button */}
          <div className={`flex flex-col rounded-lg border ${dark ? 'border-white/[0.08] bg-white/[0.02]' : 'border-stone-200 bg-stone-50/40'}`}>
            <div className={`px-3 py-2 flex items-center justify-between border-b ${dark ? 'border-white/[0.06]' : 'border-stone-200'}`}>
              <div className="flex items-center gap-2">
                <span className={`text-[11px] uppercase tracking-wider font-medium ${dark ? 'text-slate-300' : 'text-stone-700'}`}>
                  Учасники
                </span>
                <span className={`text-[11px] px-1.5 py-0.5 rounded ${
                  validCount === 0
                    ? (dark ? 'bg-stone-500/15 text-stone-400' : 'bg-stone-200 text-stone-500')
                    : (dark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-100 text-amber-800')
                }`}>
                  {validCount} валідних{recipients.filter(r => r.name.trim() || r.email.trim()).length !== validCount && ` / ${recipients.filter(r => r.name.trim() || r.email.trim()).length}`}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setBulkOpen((v) => !v)}
                  className={`text-[11px] px-2 py-1 rounded-md transition-colors ${
                    bulkOpen
                      ? (dark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-800')
                      : (dark ? 'text-slate-300 hover:bg-white/[0.05]' : 'text-stone-600 hover:bg-stone-100')
                  }`}
                >
                  ⌬ Вставити список
                </button>
                {recipients.some((r) => r.name.trim() || r.email.trim()) && (
                  <button
                    type="button"
                    onClick={clearAll}
                    title="Очистити всіх"
                    className={`text-[11px] px-2 py-1 rounded-md transition-colors ${dark ? 'text-slate-400 hover:text-red-300 hover:bg-red-500/10' : 'text-stone-500 hover:text-red-600 hover:bg-red-50'}`}
                  >
                    Очистити
                  </button>
                )}
              </div>
            </div>

            {bulkOpen && (
              <div className={`px-3 py-2 border-b ${dark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-stone-200 bg-amber-50/30'}`}>
                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  rows={4}
                  placeholder={"Підтримуються формати:\nІван Петренко, ivan@example.com\nОлена Коваль <olena@example.com>\nабо парами (імʼя на одному рядку, email на наступному):\nМикола Іваненко\nmykola@example.com"}
                  className={`w-full px-2.5 py-2 rounded-md border text-[12px] font-mono leading-relaxed ${dark ? 'bg-black/30 border-white/[0.1] text-slate-200 placeholder-slate-500' : 'bg-white border-stone-300 text-stone-800 placeholder-stone-400'}`}
                />
                <div className="flex items-center justify-end gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => { setBulkText(''); setBulkOpen(false); }}
                    className={`text-[11px] px-2 py-1 rounded-md ${dark ? 'text-slate-400 hover:bg-white/[0.05]' : 'text-stone-500 hover:bg-stone-100'}`}
                  >
                    Скасувати
                  </button>
                  <button
                    type="button"
                    onClick={applyBulkPaste}
                    disabled={!bulkText.trim()}
                    className="text-[11px] px-3 py-1 rounded-md bg-amber-500 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Розпарсити
                  </button>
                </div>
              </div>
            )}

            <div className="max-h-[300px] overflow-y-auto p-2 space-y-1.5">
              {recipients.map((r, idx) => {
                const nameTrim = r.name.trim();
                const emailTrim = r.email.trim();
                const emailValid = emailTrim.length === 0 || SUPERVISION_EMAIL_RE.test(emailTrim);
                const isDup = emailTrim && duplicateEmails.has(emailTrim.toLowerCase());
                const baseInputCls = `px-2.5 py-1.5 rounded-md border text-[12.5px] ${dark ? 'bg-white/[0.04] text-white placeholder-slate-500' : 'bg-white text-stone-900 placeholder-stone-400'}`;
                const nameBorder = nameTrim
                  ? (dark ? 'border-white/[0.1]' : 'border-stone-300')
                  : (dark ? 'border-white/[0.06]' : 'border-stone-200');
                const emailBorder = !emailValid
                  ? 'border-red-500/60'
                  : isDup
                    ? 'border-amber-500/50'
                    : emailTrim
                      ? (dark ? 'border-white/[0.1]' : 'border-stone-300')
                      : (dark ? 'border-white/[0.06]' : 'border-stone-200');
                const canPreview = nameTrim.length > 0 && topic.trim().length > 0;
                const previewTitle = !topic.trim()
                  ? 'Спочатку введіть тему супервізії'
                  : !nameTrim
                    ? 'Спочатку введіть імʼя'
                    : 'Переглянути персональний сертифікат';
                return (
                  <div key={r.id} className="flex items-center gap-1.5">
                    <span className={`text-[10px] w-5 text-right tabular-nums shrink-0 ${dark ? 'text-slate-500' : 'text-stone-400'}`}>
                      {idx + 1}.
                    </span>
                    <input
                      type="text"
                      value={r.name}
                      onChange={(e) => updateRecipient(r.id, { name: autoCapName(e.target.value) })}
                      placeholder="Імʼя та Прізвище"
                      className={`flex-1 min-w-0 ${baseInputCls} ${nameBorder}`}
                    />
                    <input
                      type="email"
                      value={r.email}
                      onChange={(e) => updateRecipient(r.id, { email: e.target.value })}
                      placeholder="email@example.com"
                      title={!emailValid ? 'Невалідний email' : isDup ? 'Цей email повторюється у списку' : ''}
                      className={`flex-1 min-w-0 ${baseInputCls} ${emailBorder}`}
                    />
                    <button
                      type="button"
                      onClick={() => setPreviewRowId(r.id)}
                      disabled={!canPreview}
                      title={previewTitle}
                      aria-label={previewTitle}
                      className={`shrink-0 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-medium border transition-all ${
                        canPreview
                          ? dark
                            ? 'bg-amber-500/[0.12] border-amber-400/30 text-amber-200 hover:bg-amber-500/20 hover:border-amber-400/50 hover:text-amber-100 active:bg-amber-500/25'
                            : 'bg-amber-50 border-amber-300/70 text-amber-800 hover:bg-amber-100 hover:border-amber-400 hover:text-amber-900 active:bg-amber-200/70'
                          : dark
                            ? 'bg-transparent border-white/[0.06] text-slate-500 cursor-not-allowed'
                            : 'bg-transparent border-stone-200 text-stone-400 cursor-not-allowed'
                      }`}
                    >
                      <HiOutlineEye className="w-3.5 h-3.5" />
                      <span>Перегляд</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRecipient(r.id)}
                      title="Видалити"
                      className={`shrink-0 w-7 h-7 flex items-center justify-center rounded-md transition-colors ${dark ? 'text-slate-500 hover:text-red-300 hover:bg-red-500/10' : 'text-stone-400 hover:text-red-600 hover:bg-red-50'}`}
                    >
                      <HiOutlineTrash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className={`px-2 py-2 border-t ${dark ? 'border-white/[0.06]' : 'border-stone-200'}`}>
              <button
                type="button"
                onClick={addRecipient}
                className={`w-full text-[12px] py-1.5 rounded-md border-dashed border transition-colors ${dark ? 'border-white/[0.1] text-slate-300 hover:bg-white/[0.05] hover:border-white/[0.2]' : 'border-stone-300 text-stone-600 hover:bg-stone-100 hover:border-stone-400'}`}
              >
                + Додати учасника
              </button>
            </div>
          </div>

          {failed && failed.length > 0 && (
            <div className={`mt-3 rounded-lg border px-3 py-2 ${dark ? 'border-red-500/30 bg-red-500/10' : 'border-red-200 bg-red-50'}`}>
              <div className={`text-[11px] uppercase tracking-wider font-semibold mb-1.5 ${dark ? 'text-red-300' : 'text-red-700'}`}>
                Помилки ({failed.length})
              </div>
              <ul className={`text-[11.5px] space-y-0.5 max-h-24 overflow-y-auto ${dark ? 'text-red-200' : 'text-red-800'}`}>
                {failed.map((f, i) => (
                  <li key={i}>
                    <span className="font-mono">{f.email}</span>
                    <span className="opacity-70"> — {f.error}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <PreviewPane
          theme={theme}
          disabled={!previewRecipient || !topic.trim()}
          compact={!expanded}
          params={{
            type: 'SUPERVISION',
            recipientName: previewRecipient?.name?.trim() ?? '',
            courseName: topic.trim(),
            supervisionDate: supervisionDate || undefined,
            supervisionHours: supervisionHours.trim() || undefined,
          }}
        />
      </div>
      {(() => {
        const row = recipients.find((r) => r.id === previewRowId);
        if (!row || !row.name.trim() || !topic.trim()) return null;
        const src = buildSupervisionPreviewSrc({
          name: row.name,
          topic,
          supervisionDate,
          supervisionHours,
        });
        return <CertPreviewFullscreen src={src} onClose={() => setPreviewRowId(null)} />;
      })()}
      </>
      )}
    </ModalShell>
  );
}
