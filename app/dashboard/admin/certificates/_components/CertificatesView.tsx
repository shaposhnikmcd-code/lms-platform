'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  HiOutlineDocumentText,
  HiOutlineAcademicCap,
  HiOutlineClock,
  HiOutlineArrowPath,
  HiOutlinePaperAirplane,
  HiOutlineXCircle,
  HiOutlineEye,
  HiOutlineArrowsPointingOut,
  HiOutlinePlus,
  HiOutlineExclamationTriangle,
  HiOutlineCheckCircle,
  HiOutlineTrash,
  HiOutlineInformationCircle,
  HiOutlineCircleStack,
  HiOutlineCloudArrowDown,
} from 'react-icons/hi2';
import { useAdminTheme, type Theme } from '../../_components/adminTheme';
import { AdminShell, AdminPanel } from '../../_components/AdminShell';
import YearlyInfoModal from './YearlyInfoModal';
import CoursesInfoModal from './CoursesInfoModal';

type TabKey = 'courses' | 'yearly' | 'history' | 'issues';

type CertificateType = 'COURSE' | 'YEARLY_PROGRAM';
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

const TABS: Array<{ key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'courses', label: 'Курси', icon: HiOutlineDocumentText },
  { key: 'yearly', label: 'Річна програма', icon: HiOutlineAcademicCap },
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
    if (t === 'courses' || t === 'yearly' || t === 'history' || t === 'issues') {
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
      <Tabs theme={theme} active={activeTab} onChange={setActiveTab} />

      <div className="mt-6">
        {activeTab === 'courses' && <CoursesTab theme={theme} pushToast={setToast} />}
        {activeTab === 'yearly' && <YearlyTab theme={theme} pushToast={setToast} />}
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
const CACHE_VERSION = 1;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 години

function readCache<T>(key: string): { items: T[]; lastUpdated: number } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { v?: number; items?: T[]; lastUpdated?: number };
    if (parsed.v !== CACHE_VERSION || !Array.isArray(parsed.items) || typeof parsed.lastUpdated !== 'number') {
      return null;
    }
    return { items: parsed.items, lastUpdated: parsed.lastUpdated };
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, items: T[], lastUpdated: number) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify({ v: CACHE_VERSION, items, lastUpdated }));
  } catch {
    // ignore (quota / private mode)
  }
}

function useCachedList<T>(cacheKey: string, fetcher: () => Promise<T[]>) {
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  /// ВАЖЛИВО: початковий стан мусить збігатися на сервері й клієнті, інакше — hydration mismatch.
  /// Тому НЕ читаємо localStorage в useState init. Спочатку null/[]; потім у useEffect (тільки клієнт)
  /// підвантажуємо кеш або стартуємо перший fetch.
  const [items, setItems] = useState<T[]>([]);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const fresh = await fetcherRef.current();
      const ts = Date.now();
      setItems(fresh);
      setLastUpdated(ts);
      writeCache(cacheKey, fresh, ts);
    } finally {
      setLoading(false);
    }
  }, [cacheKey]);

  useEffect(() => {
    const cached = readCache<T>(cacheKey);
    if (cached) {
      setItems(cached.items);
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
      writeCache(cacheKey, next, lastUpdated ?? Date.now());
      return next;
    });
  }, [cacheKey, lastUpdated]);

  return { items, loading, lastUpdated, refresh, patchItem, setItems };
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
  const { items: candidates, loading, lastUpdated, refresh: fetchList } =
    useCachedList<CourseCandidate>('cert-courses-v1', async () => {
      const res = await fetch('/api/admin/certificates/course');
      const data = await res.json();
      return (data.candidates ?? []) as CourseCandidate[];
    });
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

  /// Останній раз коли тягнули прогрес з SendPulse — максимум `spProgressCheckedAt`
  /// серед усіх enrollments. null = жоден ще не торкався SP (немає курсів з SP ID).
  const latestSpCheck = useMemo<number | null>(() => {
    let max = 0;
    for (const c of candidates) {
      if (c.spProgressCheckedAt) {
        const t = new Date(c.spProgressCheckedAt).getTime();
        if (t > max) max = t;
      }
    }
    return max > 0 ? max : null;
  }, [candidates]);

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
              <Th>Дії</Th>
            </tr>
          </thead>
          <tbody className={dark ? 'divide-y divide-white/[0.04]' : 'divide-y divide-stone-200/60'}>
            {loading && candidates.length === 0 && (
              <tr><td colSpan={8} className="py-8 text-center text-stone-500">Завантаження…</td></tr>
            )}
            {!loading && lastUpdated !== null && filtered.length === 0 && (
              <tr><td colSpan={8} className="py-8 text-center text-stone-500">Немає даних</td></tr>
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
                  <td className="py-3">
                    {cert ? (
                      <div className="inline-flex items-center gap-1">
                        <a
                          href={`/api/admin/certificates/${cert.id}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                          title="Переглянути PDF"
                          className={`inline-flex items-center justify-center w-8 h-8 rounded-md ${dark ? 'bg-white/[0.05] text-slate-200 hover:bg-white/[0.1]' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}
                        >
                          <HiOutlineEye />
                        </a>
                        <button
                          type="button"
                          disabled={busy || cert.revoked}
                          onClick={() => handleResend(cert.id, key)}
                          title={cert.revoked ? 'Не можна перевідправити — відкликано' : 'Перевідправити'}
                          className={`inline-flex items-center justify-center w-8 h-8 rounded-md disabled:opacity-40 ${dark ? 'bg-white/[0.05] text-slate-200 hover:bg-white/[0.1]' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}
                        >
                          <HiOutlinePaperAirplane />
                        </button>
                        {!cert.revoked && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleRevoke(cert.id, key)}
                            title="Відкликати"
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-md disabled:opacity-40 ${dark ? 'bg-red-500/10 text-red-300 hover:bg-red-500/20' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}
                          >
                            <HiOutlineXCircle />
                          </button>
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
  const { items: candidates, loading, lastUpdated, refresh: fetchList } =
    useCachedList<YearlyCandidate>('cert-yearly-v1', async () => {
      const res = await fetch('/api/admin/certificates/yearly');
      const data = await res.json();
      return (data.candidates ?? []) as YearlyCandidate[];
    });
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<'all' | 'YEARLY' | 'MONTHLY'>('all');
  const [issuedFilter, setIssuedFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [dialogSub, setDialogSub] = useState<YearlyCandidate | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [runningSp, setRunningSp] = useState(false);

  /// Останнє SP-оновлення — максимум `spProgressCheckedAt` серед усіх підписок.
  const latestSpCheck = useMemo<number | null>(() => {
    let max = 0;
    for (const c of candidates) {
      if (c.spProgressCheckedAt) {
        const t = new Date(c.spProgressCheckedAt).getTime();
        if (t > max) max = t;
      }
    }
    return max > 0 ? max : null;
  }, [candidates]);

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
              <Th>Сертифікат</Th>
              <Th>Створити вручну</Th>
            </tr>
          </thead>
          <tbody className={dark ? 'divide-y divide-white/[0.04]' : 'divide-y divide-stone-200/60'}>
            {loading && (
              <tr>
                <td colSpan={11} className="py-8 text-center text-stone-500">
                  Завантаження…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={11} className="py-8 text-center text-stone-500">
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

      {showInfo && <YearlyInfoModal theme={theme} onClose={() => setShowInfo(false)} />}
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

type HistorySection = 'course' | 'yearly';

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
    qs.set('certType', section === 'course' ? 'COURSE' : 'YEARLY_PROGRAM');
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
              <tr><td colSpan={7} className="py-8 text-center text-stone-500">Завантаження…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center text-stone-500">Подій немає</td></tr>
            )}
            {rows.map((r) => {
              const status = statusFor(r);
              const actor = r.sender ?? r.issuer;
              return (
                <tr key={r.certId} className={dark ? 'hover:bg-white/[0.02]' : 'hover:bg-stone-50/70'}>
                  <td className="py-3 pr-3">
                    <div className="font-mono text-[11px]">{r.certNumber}</div>
                    <div className={`text-[10px] ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
                      {r.type === 'COURSE' ? 'Курс' : 'Річна'}
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
                <tr><td colSpan={8} className="py-8 text-center text-stone-500">Завантаження…</td></tr>
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

function ModalShell({
  theme,
  title,
  children,
  onClose,
  footer,
  wide,
}: {
  theme: Theme;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  const dark = theme === 'dark';
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className={`w-full ${wide ? 'max-w-[1100px]' : 'max-w-2xl'} max-h-[92vh] rounded-2xl border overflow-hidden flex flex-col ${dark ? 'bg-[#14171f] border-white/[0.1]' : 'bg-white border-stone-200'}`}
      >
        <div className={`px-5 py-4 border-b flex items-center justify-between ${dark ? 'border-white/[0.08]' : 'border-stone-200'}`}>
          <h3 className="text-[16px] font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className={`w-8 h-8 rounded-md flex items-center justify-center ${dark ? 'hover:bg-white/[0.08] text-slate-300' : 'hover:bg-stone-100 text-stone-600'}`}
          >
            ✕
          </button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <div className={`px-5 py-4 border-t flex items-center justify-end gap-2 ${dark ? 'border-white/[0.08] bg-white/[0.02]' : 'border-stone-200 bg-stone-50/60'}`}>
            {footer}
          </div>
        )}
      </div>
    </div>
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
}: {
  theme: Theme;
  params: {
    type: 'COURSE' | 'YEARLY_PROGRAM';
    category?: 'LISTENER' | 'PRACTICAL';
    recipientName: string;
    courseName?: string;
  };
  disabled?: boolean;
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
      setBaseSrc(`/api/admin/certificates/preview?${qs.toString()}`);
    }, 500);
    return () => clearTimeout(t);
  }, [disabled, params.type, params.category, params.recipientName, params.courseName]);

  const src = baseSrc ? `${baseSrc}#toolbar=0&navpanes=0&scrollbar=0&statusbar=0&messages=0&view=Fit&zoom=page-fit` : null;

  /// Реальні розміри PDF — мають співпадати з PAGE_SIZES у lib/certificates/generatePdf.ts.
  /// COURSE = 1280×760 (вужчий, ~1.68:1), YEARLY = 1280×960 (~1.33:1). Якщо тут будуть
  /// неправильні пропорції — превью буде обрізане або з полями, бо iframe має фіксований aspect.
  const pageAspect = params.type === 'COURSE' ? '1280 / 760' : '1280 / 960';

  return (
    <>
      <div className={`rounded-xl border overflow-hidden flex flex-col ${dark ? 'border-white/[0.08] bg-black/40' : 'border-stone-200 bg-stone-50'}`}>
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
        <button
          type="button"
          onClick={() => src && setExpanded(true)}
          disabled={!src}
          style={{ aspectRatio: pageAspect }}
          className="w-full flex items-center justify-center relative p-0 m-0 border-0 cursor-zoom-in disabled:cursor-default bg-transparent"
        >
          {!params.recipientName.trim() ? (
            <div className={`text-[13px] p-4 text-center ${dark ? 'text-slate-500' : 'text-stone-400'}`}>
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
                  <div className="flex flex-col items-center gap-2">
                    <div className={`w-8 h-8 border-2 rounded-full animate-spin ${dark ? 'border-white/20 border-t-amber-400' : 'border-stone-300 border-t-amber-600'}`} />
                    <div className={`text-[12px] uppercase tracking-wider ${dark ? 'text-slate-300' : 'text-stone-600'}`}>Генерую сертифікат…</div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className={`w-8 h-8 border-2 rounded-full animate-spin ${dark ? 'border-white/20 border-t-amber-400' : 'border-stone-300 border-t-amber-600'}`} />
              <div className={`text-[12px] uppercase tracking-wider ${dark ? 'text-slate-300' : 'text-stone-600'}`}>Генерую сертифікат…</div>
            </div>
          )}
        </button>
      </div>

      {expanded && src && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setExpanded(false)}
        >
          <div
            className="relative w-full max-w-[1400px] h-[92vh] bg-white rounded-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <iframe src={src} title="Certificate full" className="w-full h-full border-0" />
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="absolute top-3 right-3 w-10 h-10 rounded-full bg-black/70 text-white text-xl flex items-center justify-center hover:bg-black"
              aria-label="Закрити"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
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
  const [candidates, setCandidates] = useState<CourseCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<CourseCandidate | null>(preselected ?? null);
  const [recipientName, setRecipientName] = useState(preselected?.userName ?? '');
  const [busy, setBusy] = useState(false);
  const [showOnlyMissing, setShowOnlyMissing] = useState(true);
  const [confirmingIncomplete, setConfirmingIncomplete] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/certificates/course');
        const data = await res.json();
        setCandidates(data.candidates ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return candidates.filter((c) => {
      if (showOnlyMissing && c.certificate) return false;
      if (!s) return true;
      return `${c.userName ?? ''} ${c.userEmail} ${c.courseTitle}`.toLowerCase().includes(s);
    });
  }, [candidates, search, showOnlyMissing]);

  async function submit() {
    if (!selected) return;
    setConfirmingIncomplete(false);
    setBusy(true);
    try {
      const res = await fetch('/api/admin/certificates/course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selected.userId,
          courseId: selected.courseId,
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

  /// Якщо учасник не закінчив курс на 100% (або прогрес SP взагалі невідомий) —
  /// спочатку показуємо confirm-попап. Інакше одразу submit.
  function handleClickIssue() {
    if (!selected) return;
    const pct = selected.spProgressPercent;
    const completed = pct !== null && pct >= 100;
    if (!completed) {
      setConfirmingIncomplete(true);
    } else {
      void submit();
    }
  }

  return (
    <ModalShell
      theme={theme}
      title="Видати курсовий сертифікат"
      onClose={onClose}
      wide
      footer={
        <>
          <button onClick={onClose} className={`px-4 py-2 rounded-lg text-[13px] ${dark ? 'bg-white/[0.05] text-slate-200' : 'bg-stone-100 text-stone-700'}`}>
            Скасувати
          </button>
          <button
            onClick={handleClickIssue}
            disabled={!selected || busy || !recipientName.trim()}
            className="px-4 py-2 rounded-lg bg-amber-500 text-white text-[13px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? 'Видаю…' : 'Видати і відправити'}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-5">
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <input
              autoFocus
              placeholder="Пошук: ім'я, email, курс…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`flex-1 min-w-[200px] px-3 py-2 rounded-lg border text-[13px] ${dark ? 'bg-white/[0.04] border-white/[0.1] text-white' : 'bg-white border-stone-300 text-stone-900'}`}
            />
            <label className={`inline-flex items-center gap-2 text-[12px] ${dark ? 'text-slate-300' : 'text-stone-700'}`}>
              <input type="checkbox" checked={showOnlyMissing} onChange={(e) => setShowOnlyMissing(e.target.checked)} />
              Без серта
            </label>
          </div>

          <div className={`rounded-lg border max-h-[300px] overflow-y-auto ${dark ? 'border-white/[0.08]' : 'border-stone-200'}`}>
            {loading ? (
              <div className="p-4 text-center text-stone-500">Завантаження…</div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-center text-stone-500">Нічого не знайдено</div>
            ) : (
              filtered.slice(0, 100).map((c) => {
                const key = `${c.userId}_${c.courseId}`;
                const isSel = selected?.userId === c.userId && selected?.courseId === c.courseId;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setSelected(c);
                      setRecipientName(c.userName ?? '');
                    }}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between gap-3 border-b last:border-0 ${dark ? 'border-white/[0.04]' : 'border-stone-100'} ${isSel ? (dark ? 'bg-amber-500/15' : 'bg-amber-50') : (dark ? 'hover:bg-white/[0.02]' : 'hover:bg-stone-50')}`}
                  >
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium truncate">{c.userName ?? c.userEmail}</div>
                      <div className={`text-[11px] truncate ${dark ? 'text-slate-400' : 'text-stone-500'}`}>{c.userEmail} · {c.courseTitle}</div>
                    </div>
                    {c.certificate && (
                      <span className={`text-[10px] px-2 py-0.5 rounded ${dark ? 'bg-emerald-500/20 text-emerald-200' : 'bg-emerald-100 text-emerald-800'}`}>
                        ✓
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {selected && (
            <div className={`rounded-lg p-4 ${dark ? 'bg-white/[0.04]' : 'bg-stone-50'}`}>
              <label className={`block text-[11px] uppercase tracking-wider mb-1 ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
                Ім'я для друку
              </label>
              <input
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border text-[13px] ${dark ? 'bg-white/[0.04] border-white/[0.1] text-white' : 'bg-white border-stone-300 text-stone-900'}`}
              />
              <div className={`text-[11px] mt-2 ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
                {selected.courseTitle} · {selected.userEmail}
              </div>
            </div>
          )}
        </div>

        <PreviewPane
          theme={theme}
          disabled={!selected}
          params={{
            type: 'COURSE',
            recipientName: recipientName.trim(),
            courseName: selected?.courseTitle,
          }}
        />
      </div>

      {confirmingIncomplete && selected && (
        <IncompleteProgressConfirm
          theme={theme}
          candidate={selected}
          onCancel={() => setConfirmingIncomplete(false)}
          onConfirm={() => void submit()}
          busy={busy}
        />
      )}
    </ModalShell>
  );
}

function IncompleteProgressConfirm({
  theme,
  candidate,
  onCancel,
  onConfirm,
  busy,
}: {
  theme: Theme;
  candidate: CourseCandidate;
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  const dark = theme === 'dark';
  const pct = candidate.spProgressPercent;
  const progressLabel =
    pct === null
      ? 'невідомо (немає даних з SendPulse)'
      : `${pct}%`;
  const checkedLabel = candidate.spProgressCheckedAt
    ? formatDate(candidate.spProgressCheckedAt)
    : '—';

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
              Курс не завершено. Точно видавати сертифікат?
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
              <strong>Курс:</strong> {candidate.courseTitle}
            </li>
            <li>
              <strong>Прогрес у SendPulse:</strong>{' '}
              <span className="font-mono">{progressLabel}</span>
              {pct !== null && pct < 100 && (
                <> · <span className={dark ? 'text-red-300' : 'text-red-700'}>не закінчено</span></>
              )}
            </li>
            <li>
              <strong>Перевірено:</strong> {checkedLabel}
            </li>
          </ul>
          <p className={`mt-3 text-[12px] ${dark ? 'text-amber-200/80' : 'text-amber-900/80'}`}>
            Зазвичай сертифікат видається після 100% завершення курсу. Якщо це особлива
            домовленість з учнем — продовжуй. Якщо сумніваєшся — скасуй і уточни.
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
  const [busy, setBusy] = useState(false);
  const [confirmingPartial, setConfirmingPartial] = useState(false);

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
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-5">
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
            onChange={(e) => setRecipientName(e.target.value)}
            placeholder="Повне ім'я учасника"
            className={`w-full px-3 py-2 rounded-lg border text-[14px] ${dark ? 'bg-white/[0.04] border-white/[0.1] text-white' : 'bg-white border-stone-300 text-stone-900'}`}
          />
        </div>
        </div>

        <PreviewPane
          theme={theme}
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
