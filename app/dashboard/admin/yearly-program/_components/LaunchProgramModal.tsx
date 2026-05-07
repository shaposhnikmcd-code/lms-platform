'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  HiOutlineRocketLaunch,
  HiOutlineBolt,
  HiOutlineCalendarDays,
  HiOutlineCheck,
  HiOutlineExclamationTriangle,
  HiOutlineXMark,
  HiOutlineEnvelope,
  HiOutlinePencilSquare,
  HiOutlinePaperAirplane,
  HiOutlineEye,
  HiOutlineInformationCircle,
  HiOutlineArrowUturnLeft,
} from 'react-icons/hi2';
import type { Theme } from '../../_components/adminTheme';
import type { CohortListItem } from './types';
import { useUIFeedback } from './UIFeedback';
import WysiwygEmailEditor from './WysiwygEmailEditor';
import {
  EmailPreviewFrame,
  PlaceholderLegend,
  RemovedPlaceholderAlert,
  SectionCard,
  extractUsedPlaceholders,
} from './EmailEditorParts';
import {
  DEFAULT_LAUNCH_EMAIL_BODY,
  DEFAULT_LAUNCH_EMAIL_SUBJECT,
} from '@/lib/yearlyProgramCohort';

/// Опис кожного поля cohort welcome-листа — для довідника й попереджень при видаленні.
/// Cohort використовує double-curly формат `{{name}}`, відмінний від payment/reminder (`{name}`).
const COHORT_PLACEHOLDER_DESCRIPTIONS: Record<string, { what: string; consequence: string }> = {
  name: {
    what: 'Імʼя отримувача (з форми оплати) — наприклад «Іван Петренко». Якщо порожнє — підставиться «учаснику».',
    consequence: 'БЕЗ цього поля привітання буде безособовим.',
  },
  email: {
    what: 'Email-адреса отримувача — наприклад «ivan@example.com».',
    consequence: 'БЕЗ цього поля у листі не буде email-у адресата (якщо потрібен для login-довідки).',
  },
  startDate: {
    what: 'Дата старту групи — наприклад «01.09.2026».',
    consequence: 'БЕЗ цього поля отримувач не побачить коли починається навчання.',
  },
  endDate: {
    what: 'Дата завершення групи — наприклад «31.05.2027».',
    consequence: 'БЕЗ цього поля отримувач не побачить коли закінчується навчальний рік.',
  },
  cohortName: {
    what: 'Назва групи запуску — наприклад «Річна 2026/27».',
    consequence: 'БЕЗ цього поля отримувач не побачить до якої саме групи він приєднується.',
  },
};

/// Sample-data для довідника прев\'ю — щоб менеджер бачив реальний приклад значення.
const COHORT_SAMPLE_DATA: Record<string, string> = {
  name: 'Іван Петренко',
  email: 'ivan@example.com',
  startDate: '01.09.2026',
  endDate: '31.05.2027',
  cohortName: 'Річна 2026/27',
};

const COHORT_PLACEHOLDERS = ['name', 'email', 'startDate', 'endDate', 'cohortName'];

/// Час запуску заздалегідь зафіксований на 03:50 UTC обраної дати — це за 10 хв до cron-у `0 4 * * *`.
/// Так гарантується, що запуск спрацьовує саме вранці обраного дня (~07:00 за Києвом, з урахуванням DST),
/// а не зсувається на наступну добу. Користувач обирає лише дату.
const LAUNCH_HOUR_UTC = 3;
const LAUNCH_MINUTE_UTC = 50;

/// Модалка "🚀 Запустити програму" — об'єднана дія "відкрити доступ + надіслати welcome-лист".
///
/// Дві осі вибору:
///   1. КОЛИ запускати: зараз / запланувати на дату.
///   2. ЧИ надсилати лист одночасно (default ON): редактор шаблону welcome-листа з тим
///      самим UX, що й Listі Платежів/Нагадування — sectioned card-и: Тема → Прев'ю → Редактор.
///
/// Якщо менеджер хоче передумати після запуску — окрема кнопка "✉️ Дослати лист" у CohortActions
/// відкриває SendEmailsModal для resend (per-recipient або bulk-override).
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
  const [busy, setBusy] = useState(false);

  // === Mode (now / schedule) ===
  const [mode, setMode] = useState<'now' | 'schedule'>(cohort.launchScheduledFor ? 'schedule' : 'now');
  // Зберігаємо ISO-час 03:50 UTC обраної дати. Користувач обирає лише дату — час фіксований.
  const [scheduledFor, setScheduledFor] = useState<string>(() => {
    if (cohort.launchScheduledFor) {
      // Нормалізуємо існуючий запис до 03:50 UTC того ж UTC-дня (на випадок старих записів з іншим часом).
      return buildScheduledISOFromDate(extractDateUTC(new Date(cohort.launchScheduledFor).toISOString()));
    }
    return buildScheduledISOFromOffsetDays(1);
  });

  // === Welcome email ===
  // Дефолт: ON. Якщо при попередньому збереженні scheduled launch менеджер зняв галочку
  // (emailScheduledFor=null при launchScheduledFor!=null) — стартуємо з OFF, щоб поточний
  // стан UI відповідав збереженому в БД.
  const [sendWelcomeEmails, setSendWelcomeEmails] = useState(() => {
    if (cohort.launchScheduledFor) return cohort.emailScheduledFor !== null;
    return true;
  });

  // Editor: працюємо з ефективними значеннями. cohort.launchEmailSubject/Body майже завжди
  // нон-null (при створенні cohort-у POST записує DEFAULT_*). Якщо все ж null — fallback на
  // канонічний шаблон з коду, щоб редактор ніколи не був порожнім.
  const initialSubject = cohort.launchEmailSubject ?? DEFAULT_LAUNCH_EMAIL_SUBJECT;
  const initialBody = cohort.launchEmailBody ?? DEFAULT_LAUNCH_EMAIL_BODY;
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  // Baseline для dirty-розрахунку. Оновлюється після успішного збереження/скидання.
  const [savedSubject, setSavedSubject] = useState(initialSubject);
  const [savedBody, setSavedBody] = useState(initialBody);

  const dirty = useMemo(
    () => subject !== savedSubject || body !== savedBody,
    [subject, body, savedSubject, savedBody],
  );
  // Шаблон вважається кастомізованим, якщо persisted значення відрізняється від канонічного дефолту.
  const isCustomized = useMemo(
    () => savedSubject !== DEFAULT_LAUNCH_EMAIL_SUBJECT || savedBody !== DEFAULT_LAUNCH_EMAIL_BODY,
    [savedSubject, savedBody],
  );

  const [preview, setPreview] = useState<{ subject: string; body: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewHeight, setPreviewHeight] = useState<number>(420);
  const previewIframeRef = useRef<HTMLIFrameElement | null>(null);

  const [savingTpl, setSavingTpl] = useState(false);
  const [resettingTpl, setResettingTpl] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ kind: 'ok' | 'error'; message: string } | null>(null);

  const [testInlineOpen, setTestInlineOpen] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testSending, setTestSending] = useState(false);

  // Детектор видалення `{{плейсхолдерів}}` у тексті — попередження з кнопкою «Повернути».
  const prevUsedRef = useRef<Set<string>>(extractUsedPlaceholders(initialBody));
  const [removedPlaceholder, setRemovedPlaceholder] = useState<string | null>(null);
  const [dismissedRemovals, setDismissedRemovals] = useState<Set<string>>(new Set());

  useEffect(() => {
    const current = extractUsedPlaceholders(body);
    const prev = prevUsedRef.current;
    for (const ph of prev) {
      if (!current.has(ph) && COHORT_PLACEHOLDERS.includes(ph) && !dismissedRemovals.has(ph)) {
        setRemovedPlaceholder(ph);
        break;
      }
    }
    if (removedPlaceholder && current.has(removedPlaceholder)) {
      setRemovedPlaceholder(null);
    }
    prevUsedRef.current = current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body]);

  const restorePlaceholder = (name: string) => {
    const token = `{{${name}}}`;
    if (!body.includes(token)) {
      setBody((b) => `${b}<p>${token}</p>`);
    }
    setRemovedPlaceholder(null);
  };

  const dismissPlaceholderRemoval = (name: string) => {
    setDismissedRemovals((s) => {
      const n = new Set(s);
      n.add(name);
      return n;
    });
    setRemovedPlaceholder(null);
  };

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  // Real-time preview при зміні тексту або теми (350ms debounce).
  // Шлемо поточний draft → API підставляє sample-data → setPreview({subject, body}) → iframe оновлюється.
  const previewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!sendWelcomeEmails) return;
    if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
    setPreviewLoading(true);
    previewDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/yearly-program/cohorts/${cohort.id}/preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subject: subject || undefined, body: body || undefined }),
        });
        if (res.ok) setPreview(await res.json());
      } catch {
        // ignore
      } finally {
        setPreviewLoading(false);
      }
    }, 350);
    return () => {
      if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
    };
  }, [sendWelcomeEmails, subject, body, cohort.id]);

  // Авто-приховання saveStatus після 2.5с — щоб індикатор не висів вічно.
  useEffect(() => {
    if (!saveStatus) return;
    const t = setTimeout(() => setSaveStatus(null), 2500);
    return () => clearTimeout(t);
  }, [saveStatus]);

  const cohortEnd = useMemo(() => new Date(cohort.endDate), [cohort.endDate]);
  const scheduledDate = useMemo(() => new Date(scheduledFor), [scheduledFor]);
  // Дата вже у минулому = invalid; також забороняємо обрати після завершення cohort-у.
  const scheduleInvalid = scheduledDate.getTime() <= Date.now() || scheduledDate.getTime() > cohortEnd.getTime();
  const scheduledDateOnly = extractDateUTC(scheduledFor);
  const minDateOnly = extractDateUTC(new Date().toISOString());
  const maxDateOnly = extractDateUTC(new Date(cohort.endDate).toISOString());

  async function saveTemplate() {
    setSavingTpl(true);
    setSaveStatus(null);
    try {
      const res = await fetch(`/api/admin/yearly-program/cohorts/${cohort.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ launchEmailSubject: subject, launchEmailBody: body }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveStatus({ kind: 'error', message: data.error ?? 'Помилка збереження' });
        return;
      }
      const newSubject = data.launchEmailSubject ?? subject;
      const newBody = data.launchEmailBody ?? body;
      setSubject(newSubject);
      setBody(newBody);
      setSavedSubject(newSubject);
      setSavedBody(newBody);
      setSaveStatus({ kind: 'ok', message: 'Шаблон збережено' });
      router.refresh();
    } catch (e) {
      setSaveStatus({ kind: 'error', message: (e as Error).message });
    } finally {
      setSavingTpl(false);
    }
  }

  async function resetTemplate() {
    const ok = await confirm({
      title: 'Скинути шаблон до дефолту?',
      description: 'Усі поточні правки welcome-листа буде втрачено — лист повернеться до канонічного тексту з коду.',
      confirmLabel: 'Скинути',
      destructive: true,
    });
    if (!ok) return;
    setResettingTpl(true);
    setSaveStatus(null);
    try {
      const res = await fetch(`/api/admin/yearly-program/cohorts/${cohort.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ launchEmailSubject: '', launchEmailBody: '' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveStatus({ kind: 'error', message: data.error ?? 'Помилка скидання' });
        return;
      }
      const newSubject = data.launchEmailSubject ?? DEFAULT_LAUNCH_EMAIL_SUBJECT;
      const newBody = data.launchEmailBody ?? DEFAULT_LAUNCH_EMAIL_BODY;
      setSubject(newSubject);
      setBody(newBody);
      setSavedSubject(newSubject);
      setSavedBody(newBody);
      // Скидаємо warning-tracking — інакше на дефолті можуть спрацювати old-removals.
      prevUsedRef.current = extractUsedPlaceholders(newBody);
      setRemovedPlaceholder(null);
      setDismissedRemovals(new Set());
      setSaveStatus({ kind: 'ok', message: 'Скинуто до дефолту' });
      router.refresh();
    } catch (e) {
      setSaveStatus({ kind: 'error', message: (e as Error).message });
    } finally {
      setResettingTpl(false);
    }
  }

  async function sendTest() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail.trim())) {
      toast('error', 'Невірний email');
      return;
    }
    setTestSending(true);
    try {
      const res = await fetch(`/api/admin/yearly-program/cohorts/${cohort.id}/test-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: testEmail, subject, body }),
      });
      const data = await res.json();
      if (!res.ok) toast('error', data.error ?? 'Помилка відправки');
      else toast('success', `Тестовий лист надіслано на ${testEmail}`);
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setTestSending(false);
    }
  }

  async function submit() {
    const willSchedule = mode === 'schedule';
    if (willSchedule && scheduleInvalid) {
      toast('error', 'Дата запуску має бути у майбутньому і до завершення cohort-у');
      return;
    }
    if (sendWelcomeEmails && dirty) {
      toast('info', 'Спочатку збережіть зміни шаблону листа або скасуйте їх');
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
          ...(sendWelcomeEmails
            ? [{ icon: '✉️', text: `Одразу надішле welcome-лист (${paidPendingCount} ${pluralize(paidPendingCount, 'студент', 'студенти', 'студентів')})` }]
            : [{ icon: '🔇', text: 'Welcome-лист НЕ буде надіслано (можна зробити пізніше через "Дослати лист")' }]),
        ],
        confirmLabel: sendWelcomeEmails ? 'Запустити та надіслати' : 'Запустити зараз',
      });
      if (!ok) return;
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/admin/yearly-program/cohorts/${cohort.id}/launch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(willSchedule ? { scheduledAt: scheduledDate.toISOString() } : {}),
          sendWelcomeEmails,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast('error', data.error ?? res.statusText);
        return;
      }
      if (willSchedule) {
        toast(
          'success',
          sendWelcomeEmails
            ? `📅 Запуск + лист заплановано на ${humanizeDate(scheduledFor)}`
            : `📅 Запуск заплановано на ${humanizeDate(scheduledFor)} (без листа)`,
        );
      } else {
        const ls = data.summary;
        const es = data.emailSummary;
        const launchLine = `Доступ відкрито: ${ls.opened}/${ls.total}${ls.failed > 0 ? ` · Помилок: ${ls.failed}` : ''}`;
        const emailLine = es ? `Листи: ${es.sent}/${es.total}${es.failed > 0 ? ` · Помилок: ${es.failed}` : ''}` : null;
        const variant = ls.failed > 0 || (es?.failed ?? 0) > 0 ? 'info' : 'success';
        toast(variant, `✅ Програму "${cohort.name}" запущено\n${launchLine}${emailLine ? `\n${emailLine}` : ''}`);
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
      description: 'Cohort залишиться у стані "не запущений" — оплати будуть надходити, доступ не відкриється. Запланований лист (якщо був) теж скасується.',
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
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={`relative w-full max-h-[94vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden ${
          dark ? 'bg-zinc-950 border border-white/10 text-slate-200' : 'bg-stone-100 border border-stone-200 text-stone-800'
        }`}
        // Розширено до 1360 — щоб блоки «Прев'ю» і «Редактор» поміщалися side-by-side
        // у grid-2col без обрізання UIMP-wrapper-а 600px у iframe.
        style={{ maxWidth: 'min(1360px, 96vw)' }}
      >
        {/* HEADER */}
        <header className={`shrink-0 flex items-center justify-between px-6 py-4 border-b backdrop-blur ${
          dark ? 'bg-zinc-900/95 border-white/10' : 'bg-white/95 border-stone-200'
        }`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-[18px] ${
              dark ? 'bg-amber-400/15 text-amber-300 border border-amber-400/30' : 'bg-amber-100 text-amber-800 border border-amber-300/60'
            }`}>
              <HiOutlineRocketLaunch />
            </div>
            <div className="min-w-0">
              <h3 className="text-[16px] font-bold leading-tight">Запустити програму</h3>
              <p className={`text-[11.5px] leading-tight mt-0.5 truncate ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
                {cohort.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Закрити"
            className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[14px] transition-colors ${
              dark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-stone-100 text-stone-500'
            }`}
          >✕</button>
        </header>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="px-6 py-5 space-y-5">
            {/* Інфо-смужка про paidPendingCount + дати cohort-у */}
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
                    Запуск заплановано{cohort.emailScheduledFor ? ' · з листом' : ' · без листа'}
                  </div>
                  <div className={`text-[13px] ${dark ? 'text-slate-200' : 'text-stone-800'}`}>
                    {humanizeDate(cohort.launchScheduledFor)}
                    <span className={`ml-2 text-[11px] ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
                      ({new Date(cohort.launchScheduledFor).toLocaleDateString('uk-UA')})
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

            {/* === BLOCK: Коли запустити === */}
            <BlockHeader dark={dark} title="Коли запустити" icon={<HiOutlineRocketLaunch />} />
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
                    ⚡ Послідовне відкриття SendPulse{sendWelcomeEmails ? ' + одразу welcome-лист' : ' (без листа)'}.
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
                subtitle={mode === 'schedule' ? humanizeDate(scheduledFor) : 'Запуститься зранку обраного дня'}
              >
                {mode === 'schedule' && (
                  <div className="mt-3 space-y-2.5">
                    <input
                      type="date"
                      value={scheduledDateOnly}
                      min={minDateOnly}
                      max={maxDateOnly}
                      onChange={(e) => {
                        e.stopPropagation();
                        if (e.target.value) setScheduledFor(buildScheduledISOFromDate(e.target.value));
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className={`w-full px-3 py-2 rounded-lg border text-[13px] outline-none transition-colors ${
                        dark
                          ? 'bg-white/[0.04] border-white/[0.08] text-slate-200 focus:border-indigo-400/40'
                          : 'bg-white border-stone-300/60 text-stone-800 focus:border-indigo-500/50'
                      }`}
                    />
                    {scheduleInvalid && (
                      <div className={`text-[11px] flex items-center gap-1 ${dark ? 'text-rose-300' : 'text-rose-700'}`}>
                        <HiOutlineExclamationTriangle /> Має бути у майбутньому, до {fmtDate(cohort.endDate)}.
                      </div>
                    )}
                    <div className={`text-[10px] leading-snug ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                      ✅ Запуск гарантовано спрацює <strong>зранку обраного дня</strong> (~07:00 за Києвом). Час фіксує система.
                    </div>
                  </div>
                )}
              </ModeCard>
            </div>

            {/* === BLOCK: Welcome-лист === */}
            <BlockHeader dark={dark} title="Welcome-лист" icon={<HiOutlineEnvelope />} />

            {/* Toggle row: чекбокс "Надіслати разом" */}
            <label className={`flex items-start gap-3 px-3.5 py-3 rounded-xl border cursor-pointer transition-colors ${
              sendWelcomeEmails
                ? dark
                  ? 'bg-emerald-500/[0.08] border-emerald-400/30'
                  : 'bg-emerald-50 border-emerald-300/60'
                : dark
                  ? 'bg-white/[0.02] border-white/[0.08] hover:bg-white/[0.04]'
                  : 'bg-white border-stone-300/60 hover:bg-stone-50'
            }`}>
              <input
                type="checkbox"
                checked={sendWelcomeEmails}
                onChange={(e) => setSendWelcomeEmails(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-emerald-500"
              />
              <div className="flex-1 min-w-0">
                <div className={`text-[13px] font-semibold ${dark ? 'text-slate-100' : 'text-stone-900'}`}>
                  ✉️ Надіслати welcome-лист одночасно
                  {mode === 'schedule' && sendWelcomeEmails && (
                    <span className={`ml-2 text-[11px] font-medium ${dark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                      (на ту саму дату)
                    </span>
                  )}
                </div>
                <div className={`text-[11px] mt-0.5 ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
                  {sendWelcomeEmails
                    ? mode === 'now'
                      ? `Лист піде ${paidPendingCount} студентам одразу після відкриття доступу.`
                      : `Cron надішле лист у вибрану дату — після відкриття доступу.`
                    : 'Запуск без листа. Надіслати пізніше можна через "✉️ Дослати лист".'}
                </div>
              </div>
            </label>

            {/* Editor — тільки коли чекбокс ON */}
            {sendWelcomeEmails && (
              <>
                {/* Інфо-картка про шаблон (як в TemplateEditor у Listах) */}
                <div className={`rounded-xl border overflow-hidden ${dark ? 'border-white/10 bg-zinc-900' : 'border-stone-200 bg-white'}`}>
                  <div className={`px-4 py-3 flex items-start gap-3 ${dark ? 'bg-amber-500/[0.08]' : 'bg-amber-50/70 border-amber-200/40'}`}>
                    <div className={`shrink-0 w-7 h-7 rounded-md flex items-center justify-center mt-0.5 ${
                      dark ? 'bg-amber-400/20 text-amber-200' : 'bg-white/80 text-amber-900'
                    }`}>
                      <HiOutlineInformationCircle className="text-[15px]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-[12px] font-bold leading-tight mb-1 ${dark ? 'text-amber-200' : 'text-amber-900'}`}>
                        Коли надсилається
                      </div>
                      <p className={`text-[12px] leading-snug ${dark ? 'text-slate-300' : 'text-stone-700'}`}>
                        Лист отримує кожен студент cohort-у одразу після того, як SendPulse відкриває доступ.
                        {mode === 'schedule'
                          ? ' Cron 04:00 UTC підхоплює запланований запуск і шле лист у вибраний день.'
                          : ' При миттєвому запуску надсилається послідовно одразу за відкриттям доступу.'}
                      </p>
                      {isCustomized && (
                        <p className={`mt-2 text-[10.5px] inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded ${
                          dark ? 'bg-white/[0.06] text-slate-400' : 'bg-stone-100 text-stone-600'
                        }`}>
                          <HiOutlinePencilSquare className="text-[11px]" />
                          Шаблон кастомізовано — текст відрізняється від канонічного дефолту.
                        </p>
                      )}
                    </div>
                  </div>
                  <div className={`px-4 py-2.5 border-t text-[11px] ${
                    dark ? 'border-white/[0.06] bg-white/[0.02] text-slate-400' : 'border-stone-200 bg-stone-50 text-stone-600'
                  }`}>
                    <span className={`font-semibold uppercase tracking-wider text-[10px] ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                      Доступні поля:
                    </span>{' '}
                    <code className={`font-mono ${dark ? 'text-amber-300' : 'text-amber-800'}`}>
                      {COHORT_PLACEHOLDERS.map((p) => `{{${p}}}`).join(' · ')}
                    </code>
                    <span className={`ml-2 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                      — вставляйте через кнопки <code className="font-mono">{'{…}'}</code> у тулбарі редактора
                    </span>
                  </div>
                </div>

                {/* SECTION 1: Тема */}
                <SectionCard
                  dark={dark}
                  num={1}
                  title="Тема листа"
                  hint="Те, що отримувач бачить у списку папки «Вхідні»"
                >
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    maxLength={300}
                    placeholder="Ласкаво просимо до {{cohortName}} — програма стартувала!"
                    className={`w-full px-3.5 py-2.5 rounded-lg border text-[13.5px] font-medium outline-none focus:ring-2 transition-colors ${
                      dark
                        ? 'bg-zinc-950 border-white/10 text-slate-100 placeholder:text-slate-500 focus:border-amber-400/40 focus:ring-amber-400/20'
                        : 'bg-white border-stone-300 text-stone-800 placeholder:text-stone-400 focus:border-amber-500/60 focus:ring-amber-500/20'
                    }`}
                  />
                </SectionCard>

                {/* SECTIONS 2+3 — side-by-side у grid-2col на широких екранах. Менеджер бачить
                    зміни прев'ю одразу під час редагування, без скролу. На <1024px stack. */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <SectionCard
                  dark={dark}
                  num={2}
                  title="Прев'ю — як побачить отримувач"
                  hint="Оновлюється автоматично при редагуванні"
                  icon={<HiOutlineEye />}
                >
                  <EmailPreviewFrame
                    dark={dark}
                    subject={preview?.subject ?? subject}
                    loading={previewLoading}
                    loadingHeight={previewHeight}
                  >
                    <iframe
                      ref={previewIframeRef}
                      key={cohort.id}
                      srcDoc={preview?.body ?? ''}
                      title="Прев'ю welcome-листа"
                      scrolling="no"
                      onLoad={() => {
                        const ifr = previewIframeRef.current;
                        if (!ifr) return;
                        try {
                          const doc = ifr.contentDocument;
                          if (!doc?.body) return;
                          // Дефолтний browser-margin на body додає 8px — нормалізуємо.
                          doc.body.style.margin = '0';
                          doc.body.style.padding = '12px';
                          // Скидаємо iframe до 0 перед вимірюванням, щоб body.scrollHeight рахувався
                          // від реальної висоти контенту, а не від поточної висоти iframe-viewport-а.
                          ifr.style.height = '0px';
                          const h = doc.body.scrollHeight;
                          if (h > 0) setPreviewHeight(h);
                        } catch {
                          /* same-origin → safe */
                        }
                      }}
                      style={{ height: `${previewHeight}px` }}
                      className={`w-full bg-white border-0 block transition-opacity duration-200 ${previewLoading ? 'opacity-0' : 'opacity-100'}`}
                    />
                  </EmailPreviewFrame>
                </SectionCard>

                {/* SECTION 3: Редактор */}
                <SectionCard
                  dark={dark}
                  num={3}
                  title="Редактор листа"
                  hint="Жирний / курсив / списки / посилання · вставка полів"
                  icon={<HiOutlinePencilSquare />}
                  headerRight={
                    <button
                      type="button"
                      onClick={() => setTestInlineOpen((v) => !v)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${
                        testInlineOpen
                          ? dark
                            ? 'bg-amber-400/15 border-amber-400/40 text-amber-200'
                            : 'bg-amber-100 border-amber-300 text-amber-900'
                          : dark
                            ? 'bg-white/[0.04] border-white/[0.10] text-slate-300 hover:bg-white/[0.08]'
                            : 'bg-white border-stone-300/60 text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      <HiOutlinePaperAirplane className="text-[13px] rotate-[-30deg]" />
                      Тестовий лист
                    </button>
                  }
                >
                  {removedPlaceholder && (
                    <RemovedPlaceholderAlert
                      dark={dark}
                      placeholder={removedPlaceholder}
                      descriptions={COHORT_PLACEHOLDER_DESCRIPTIONS}
                      format="double"
                      onRestore={() => restorePlaceholder(removedPlaceholder)}
                      onDismiss={() => dismissPlaceholderRemoval(removedPlaceholder)}
                    />
                  )}
                  <WysiwygEmailEditor
                    value={body}
                    onChange={setBody}
                    theme={theme}
                    placeholders={COHORT_PLACEHOLDERS}
                    placeholderFormat="double"
                    paperMaxWidth={null}
                  />
                  <div className="mt-3">
                    <PlaceholderLegend
                      dark={dark}
                      placeholders={COHORT_PLACEHOLDERS}
                      sampleData={COHORT_SAMPLE_DATA}
                      descriptions={COHORT_PLACEHOLDER_DESCRIPTIONS}
                      format="double"
                    />
                  </div>
                  <div className={`mt-2 flex items-start gap-2 px-3 py-2 rounded-lg text-[10.5px] leading-snug ${
                    dark ? 'bg-white/[0.03] text-slate-400 border border-white/[0.06]' : 'bg-stone-100 text-stone-600 border border-stone-200/70'
                  }`}>
                    <HiOutlineInformationCircle className="text-[13px] shrink-0 mt-0.5 opacity-70" />
                    <span>
                      Поле <code className="font-mono">{`{{name}}`}</code> при відсутньому імені студента підставить «учаснику».
                      Дати <code className="font-mono">{`{{startDate}}/{{endDate}}`}</code> форматуються як «1 вересня 2026».
                    </span>
                  </div>

                  {/* Editor footer: status + reset + save */}
                  <div className={`mt-4 flex items-center justify-between gap-3 pt-3 border-t ${
                    dark ? 'border-white/[0.06]' : 'border-stone-200/70'
                  }`}>
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {dirty && !savingTpl && !resettingTpl && !saveStatus && (
                        <span className={`inline-flex items-center gap-1.5 text-[11.5px] font-medium ${dark ? 'text-amber-300' : 'text-amber-700'}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                          Є незбережені зміни
                        </span>
                      )}
                      {saveStatus?.kind === 'ok' && (
                        <span className={`inline-flex items-center gap-1.5 text-[11.5px] font-semibold ${dark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                          <HiOutlineCheck className="text-[13px]" /> {saveStatus.message}
                        </span>
                      )}
                      {saveStatus?.kind === 'error' && (
                        <span className={`inline-flex items-center gap-1.5 text-[11.5px] ${dark ? 'text-rose-300' : 'text-rose-700'}`}>
                          <HiOutlineXMark className="text-[13px]" /> {saveStatus.message}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isCustomized && (
                        <button
                          type="button"
                          onClick={resetTemplate}
                          disabled={resettingTpl || savingTpl}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors disabled:opacity-50 ${
                            dark ? 'border-white/10 text-slate-300 hover:bg-white/[0.06]' : 'border-stone-300 text-stone-700 hover:bg-stone-50'
                          }`}
                        >
                          <HiOutlineArrowUturnLeft className="text-[13px]" />
                          {resettingTpl ? 'Скидаю…' : 'Скинути до дефолту'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={saveTemplate}
                        disabled={!dirty || savingTpl || resettingTpl}
                        className={`inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-[13px] font-bold border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          dark
                            ? 'bg-gradient-to-br from-amber-400/20 to-amber-500/30 border-amber-400/40 text-amber-100 hover:from-amber-400/30 hover:to-amber-500/40 shadow-[0_0_18px_rgba(212,168,67,0.20)]'
                            : 'bg-gradient-to-br from-amber-300 to-amber-400 border-amber-400/60 text-amber-950 hover:from-amber-400 hover:to-amber-500 shadow-[0_4px_14px_rgba(212,168,67,0.30)]'
                        }`}
                      >
                        <HiOutlineCheck className="text-[14px]" />
                        {savingTpl ? 'Зберігаю…' : 'Зберегти шаблон'}
                      </button>
                    </div>
                  </div>
                </SectionCard>
                </div>

                {/* Test inline row */}
                {testInlineOpen && (
                  <div className={`rounded-xl border p-3 flex items-end gap-2 ${
                    dark ? 'bg-amber-500/[0.06] border-amber-400/20' : 'bg-amber-50/60 border-amber-200/70'
                  }`}>
                    <div className="flex-1">
                      <label className={`block text-[10px] uppercase tracking-[0.18em] font-medium mb-1 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                        Надіслати тестовий лист на
                      </label>
                      <input
                        type="email"
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                        placeholder="email@example.com"
                        autoFocus
                        className={`w-full px-3 py-2 rounded-lg border text-[13px] outline-none transition-colors ${
                          dark
                            ? 'bg-white/[0.04] border-white/[0.08] text-slate-200 focus:border-amber-400/40'
                            : 'bg-white border-stone-300/60 text-stone-800 focus:border-amber-600/50'
                        }`}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={sendTest}
                      disabled={testSending || !testEmail}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold border transition-colors disabled:opacity-50 ${
                        dark
                          ? 'bg-amber-400/15 text-amber-200 border-amber-400/30 hover:bg-amber-400/25'
                          : 'bg-amber-100 text-amber-900 border-amber-300/60 hover:bg-amber-200'
                      }`}
                    >
                      {testSending ? 'Шлю…' : 'Відправити'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTestInlineOpen(false)}
                      className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                        dark ? 'text-slate-400 hover:bg-white/[0.06]' : 'text-stone-500 hover:bg-stone-100'
                      }`}
                      aria-label="Закрити"
                    >
                      <HiOutlineXMark />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* FOOTER — головна дія "Запустити" */}
        <div className={`flex items-center justify-between gap-3 px-6 py-4 border-t ${dark ? 'border-white/10 bg-zinc-900/95' : 'border-stone-200 bg-white/95'}`}>
          <div className={`text-[11px] ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
            {sendWelcomeEmails && dirty
              ? <span className={dark ? 'text-amber-300' : 'text-amber-700'}>⚠ Зміни шаблону не збережено — натисни «Зберегти шаблон» у редакторі.</span>
              : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={busy}
              className={`px-3.5 py-2 rounded-lg text-[12px] font-medium ${dark ? 'text-slate-300 hover:bg-white/[0.06]' : 'text-stone-700 hover:bg-stone-100'}`}
            >
              Закрити
            </button>
            <button
              onClick={submit}
              disabled={busy || (mode === 'schedule' && scheduleInvalid) || (sendWelcomeEmails && dirty)}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-[14px] font-bold border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                dark
                  ? 'bg-gradient-to-br from-amber-400/20 to-amber-500/30 border-amber-400/40 text-amber-100 hover:from-amber-400/30 hover:to-amber-500/40 shadow-[0_0_20px_rgba(212,168,67,0.15)]'
                  : 'bg-gradient-to-br from-amber-300 to-amber-400 border-amber-400/60 text-amber-950 hover:from-amber-400 hover:to-amber-500 shadow-[0_4px_14px_rgba(212,168,67,0.30)]'
              }`}
            >
              {busy ? 'Виконую…' : renderSubmitLabel({ mode, scheduledFor, sendWelcomeEmails, paidPendingCount, isReplan: !!cohort.launchScheduledFor })}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function renderSubmitLabel({
  mode,
  scheduledFor,
  sendWelcomeEmails,
  paidPendingCount,
  isReplan,
}: {
  mode: 'now' | 'schedule';
  scheduledFor: string;
  sendWelcomeEmails: boolean;
  paidPendingCount: number;
  isReplan: boolean;
}) {
  if (mode === 'now') {
    return (
      <>
        <HiOutlineBolt className="text-base" />
        {sendWelcomeEmails
          ? `Запустити та надіслати (${paidPendingCount})`
          : `Запустити зараз (${paidPendingCount})`}
      </>
    );
  }
  return (
    <>
      <HiOutlineCalendarDays className="text-base" />
      {isReplan ? 'Перепланувати на' : 'Запланувати на'} {humanizeDate(scheduledFor, { compact: true })}
      {sendWelcomeEmails && <span className="opacity-70">+ лист</span>}
    </>
  );
}

/// Заголовок верхнього блоку (Коли запустити / Welcome-лист). Без номера, лише з іконкою —
/// внутрішня нумерація 1/2/3 належить sectioned editor-у і має лишитись унікальною, як у Listах.
function BlockHeader({ dark, title, icon }: { dark: boolean; title: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      {icon && (
        <span className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-[15px] ${
          dark ? 'bg-white/[0.04] text-slate-300 border border-white/10' : 'bg-stone-100 text-stone-600 border border-stone-200'
        }`}>
          {icon}
        </span>
      )}
      <h4 className={`text-[14px] font-bold ${dark ? 'text-slate-100' : 'text-stone-900'}`}>
        {title}
      </h4>
    </div>
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

/// Будує ISO 03:50 UTC обраної дати (формат YYYY-MM-DD).
function buildScheduledISOFromDate(dateStr: string): string {
  // dateStr = 'YYYY-MM-DD'
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, LAUNCH_HOUR_UTC, LAUNCH_MINUTE_UTC, 0));
  return dt.toISOString();
}

function buildScheduledISOFromOffsetDays(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(LAUNCH_HOUR_UTC, LAUNCH_MINUTE_UTC, 0, 0);
  return d.toISOString();
}

function extractDateUTC(iso: string): string {
  return iso.slice(0, 10);
}

function pluralize(n: number, nom1: string, nom2_4: string, gen: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return nom1;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return nom2_4;
  return gen;
}

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));
}

/// Date-only humanize: "Завтра", "У середу", "01 вересня 2026". Без часу — час фіксований системою.
function humanizeDate(iso: string | null | undefined, opts?: { compact?: boolean }): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const now = new Date();
  if (d.getTime() < now.getTime()) return 'у минулому ⚠';
  const today = startOfDay(now);
  const target = startOfDay(d);
  const dayDelta = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (dayDelta === 0) return 'Сьогодні';
  if (dayDelta === 1) return 'Завтра';
  if (dayDelta < 7) {
    const wd = d.toLocaleDateString('uk-UA', { weekday: 'long' });
    return opts?.compact ? wd : `У ${wd}`;
  }
  const date = d.toLocaleDateString('uk-UA', { day: '2-digit', month: 'long', year: 'numeric' });
  return date;
}

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}
