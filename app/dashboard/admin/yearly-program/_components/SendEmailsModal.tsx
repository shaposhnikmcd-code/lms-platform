'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  HiOutlinePencilSquare,
  HiOutlineEye,
  HiOutlinePaperAirplane,
  HiOutlineCheck,
  HiOutlineUserGroup,
  HiOutlineEnvelope,
  HiOutlineMagnifyingGlass,
  HiOutlineChevronDown,
  HiOutlineChevronUp,
  HiOutlineXMark,
  HiOutlineArrowPath,
  HiOutlineInformationCircle,
  HiOutlineArrowUturnLeft,
  HiOutlineCalendarDays,
  HiOutlineExclamationCircle,
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
  SkeletonBox,
  SkeletonAvatarRow,
  SkeletonFooterTick,
  extractUsedPlaceholders,
} from './EmailEditorParts';
import {
  getRecipientsCache,
  setRecipientsCache,
  hasRecipientsCache,
} from './modalCaches';
import {
  DEFAULT_LAUNCH_EMAIL_BODY,
  DEFAULT_LAUNCH_EMAIL_SUBJECT,
} from '@/lib/yearlyProgramCohort';

interface RecipientInfo {
  subscriptionId: string;
  name: string | null;
  email: string;
  alreadySent: boolean;
  /// ISO-час найсвіжішої відправки welcome-листа цьому студенту в межах cohort-у.
  /// null якщо ще не отримував.
  sentAt: string | null;
  hasPaidPayment: boolean;
  plan: 'YEARLY' | 'MONTHLY';
  autoRenew: boolean;
}

interface RecipientsResponse {
  fromEmail: string;
  resendConfigured: boolean;
  recipients: RecipientInfo[];
  summary: { total: number; pending: number; alreadySent: number };
}

// Module-level кеш recipients per cohort живе у './modalCaches'.

/// Опис кожного поля cohort welcome-листа — спільні з LaunchProgramModal: один welcome-лист,
/// одне джерело правди (cohort.launchEmailSubject/Body), однакові плейсхолдери.
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

const COHORT_SAMPLE_DATA: Record<string, string> = {
  name: 'Іван Петренко',
  email: 'ivan@example.com',
  startDate: '01.09.2026',
  endDate: '31.05.2027',
  cohortName: 'Річна 2026/27',
};

const COHORT_PLACEHOLDERS = ['name', 'email', 'startDate', 'endDate', 'cohortName'];

/// Модалка "Дослати лист" — миттєва розсилка welcome-листа cohort-у. Дві секції:
///   1. Хто отримає — From-адреса, статистика, розкривний список з пер-юзер resend.
///   2. Що отримають — sectioned редактор welcome-листа (1·Тема · 2·Прев'ю · 3·Редактор + sticky-save).
///      Шаблон спільний з кнопкою «🚀 Запустити програму» — обидва редагують `cohort.launchEmailSubject/Body`.
///
/// Запланована розсилка (з checkbox «надіслати разом» у Launch modal) показується інлайн-банером
/// з кнопкою «Скасувати запланований». Самостійного planning у цій модалці немає — менеджер
/// або шле зараз, або скасовує заплановану і пере-плануває через Launch modal.
export default function SendEmailsModal({
  cohort,
  theme,
  onClose,
}: {
  cohort: CohortListItem;
  theme: Theme;
  onClose: () => void;
}) {
  const dark = theme === 'dark';
  const router = useRouter();
  const { toast, confirm } = useUIFeedback();
  const [mounted, setMounted] = useState(false);

  // Editor: ефективні значення. cohort.launchEmailSubject/Body майже завжди нон-null
  // (POST cohort записує DEFAULT_*); fallback потрібен лише для старих cohort-ів і для UX-консистентності
  // з LaunchProgramModal, де менеджер бачить рендеринг дефолту, а не порожній редактор.
  const initialSubject = cohort.launchEmailSubject ?? DEFAULT_LAUNCH_EMAIL_SUBJECT;
  const initialBody = cohort.launchEmailBody ?? DEFAULT_LAUNCH_EMAIL_BODY;
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [savedSubject, setSavedSubject] = useState(initialSubject);
  const [savedBody, setSavedBody] = useState(initialBody);

  const dirty = useMemo(
    () => subject !== savedSubject || body !== savedBody,
    [subject, body, savedSubject, savedBody],
  );
  const isCustomized = useMemo(
    () => savedSubject !== DEFAULT_LAUNCH_EMAIL_SUBJECT || savedBody !== DEFAULT_LAUNCH_EMAIL_BODY,
    [savedSubject, savedBody],
  );

  const [preview, setPreview] = useState<{ subject: string; body: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewHeight, setPreviewHeight] = useState<number>(420);
  const previewIframeRef = useRef<HTMLIFrameElement | null>(null);

  const [savingTpl, setSavingTpl] = useState(false);
  const [resettingTpl, setResettingTpl] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ kind: 'ok' | 'error'; message: string } | null>(null);

  const [testInlineOpen, setTestInlineOpen] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testSending, setTestSending] = useState(false);

  // Recipients — initial з module-level кешу (SSR-prewarm від YearlyProgramView).
  // Якщо є кеш — модалка стартує без skeleton-у і fetch-а.
  const cachedRecipients = getRecipientsCache(cohort.id) ?? null;
  const [recipients, setRecipients] = useState<RecipientsResponse | null>(cachedRecipients);
  const [recipientsLoading, setRecipientsLoading] = useState(!cachedRecipients);
  const [recipientsExpanded, setRecipientsExpanded] = useState(false);
  const [recipientsSearch, setRecipientsSearch] = useState('');
  const [resendingId, setResendingId] = useState<string | null>(null);

  const [sending, setSending] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [result, setResult] = useState<{ kind: 'ok' | 'err'; text: string; details?: string } | null>(null);

  // Detect placeholder removal
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

  // Recipients fetch — пропускаємо якщо є prewarm-кеш (миттєвий стан з SSR).
  // У майбутньому стейл-валідація: revalidate у фоні через короткий debounce, але поки кеш
  // надійний — він збирається в page.tsx server-side за той самий запит що й cohort-list.
  useEffect(() => {
    if (hasRecipientsCache(cohort.id)) return;
    let cancelled = false;
    fetch(`/api/admin/yearly-program/cohorts/${cohort.id}/recipients`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setRecipients(data);
        setRecipientsCache(cohort.id, data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setRecipientsLoading(false);
      });
    return () => { cancelled = true; };
  }, [cohort.id]);

  // Real-time preview debounce 350ms — синхронно з LaunchProgramModal.
  const previewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
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
  }, [subject, body, cohort.id]);

  // Auto-clear save status
  useEffect(() => {
    if (!saveStatus) return;
    const t = setTimeout(() => setSaveStatus(null), 2500);
    return () => clearTimeout(t);
  }, [saveStatus]);

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
      description: 'Усі поточні правки welcome-листа буде втрачено — лист повернеться до канонічного тексту з коду. Ця сама зміна стосується і кнопки 🚀 «Запустити програму», бо це той самий шаблон.',
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

  async function resendOne(subscriptionId: string, email: string) {
    if (resendingId) return;
    if (dirty) {
      toast('info', 'Спочатку збережіть зміни шаблону або скасуйте їх');
      return;
    }
    const ok = await confirm({
      title: 'Надіслати лист повторно?',
      description: 'Цей студент уже отримував welcome-лист. Повторна відправка надішле йому той самий шаблон ще раз.',
      bullets: [{ icon: '📧', text: email }],
      confirmLabel: 'Надіслати знов',
    });
    if (!ok) return;
    setResendingId(subscriptionId);
    try {
      const res = await fetch(`/api/admin/yearly-program/cohorts/${cohort.id}/send-emails`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'now', subscriptionIds: [subscriptionId] }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast('error', data.error ?? 'Помилка відправки');
        return;
      }
      const failed = (data.results ?? []).find((r: { error?: string }) => r.error);
      if (failed) {
        toast('error', `Помилка: ${failed.error}`);
        return;
      }
      toast('success', `Лист повторно надіслано: ${email}`);
      router.refresh();
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setResendingId(null);
    }
  }

  async function cancelScheduled() {
    const ok = await confirm({
      title: 'Скасувати заплановану розсилку?',
      description: 'Запланований час буде скинуто. Розсилка не виконається автоматично — щоб запустити, треба буде або надіслати тут вручну, або заново запланувати через кнопку «🚀 Запустити програму».',
      confirmLabel: 'Скасувати запланований',
      destructive: true,
    });
    if (!ok) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/admin/yearly-program/cohorts/${cohort.id}/send-emails`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'schedule', cancel: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast('error', data.error ?? 'Помилка скасування');
        return;
      }
      toast('success', 'Заплановану розсилку скасовано');
      router.refresh();
      onClose();
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setCancelling(false);
    }
  }

  async function submitSend() {
    if (dirty) {
      toast('info', 'Спочатку збережіть зміни шаблону або скасуйте їх');
      return;
    }

    // Cross-validation: якщо програма ще не запущена — попереджаємо що SendPulse-доступ
    // ще не відкритий, тому посилання у листі можуть не працювати.
    if (!cohort.launchedAt) {
      const ok = await confirm({
        title: '⚠ Програма ще не запущена',
        description: 'Студенти можуть отримати welcome-лист, у якому буде сказано про відкриття доступу — але доступ у SendPulse ще не відкритий. Зазвичай розсилку роблять після 🚀 «Запустити програму» або одночасно з нею.',
        bullets: [
          { icon: '📨', text: 'Розсилка: зараз (одразу)' },
          { icon: '🚀', text: 'Запуск програми: ще не виконано' },
        ],
        confirmLabel: 'Все одно надіслати',
        cancelLabel: 'Передумав',
        destructive: true,
      });
      if (!ok) return;
    }

    setSending(true);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/yearly-program/cohorts/${cohort.id}/send-emails`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'now' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ kind: 'err', text: data.error ?? 'Помилка', details: JSON.stringify(data) });
        return;
      }
      const s = data.summary;
      const text = `Надіслано: ${s.sent} · Пропущено: ${s.skipped} · Помилок: ${s.failed}`;
      setResult({
        kind: 'ok',
        text,
        details: data.results
          ?.filter((r: { error?: string }) => r.error)
          .map((r: { email: string; error?: string }) => `${r.email}: ${r.error}`)
          .join('\n') || undefined,
      });
      toast(s.failed > 0 ? 'info' : 'success', `✉ Розсилка виконана\n${text}`);
      router.refresh();
    } catch (e) {
      setResult({ kind: 'err', text: (e as Error).message });
    } finally {
      setSending(false);
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
              <HiOutlinePaperAirplane className="rotate-[-30deg]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-[16px] font-bold leading-tight">Дослати welcome-лист</h3>
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
            {/* Запланована розсилка (якщо була створена через Launch modal — checkbox «надіслати разом») */}
            {cohort.emailScheduledFor && (
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
                    Розсилку заплановано
                  </div>
                  <div className={`text-[13px] ${dark ? 'text-slate-200' : 'text-stone-800'}`}>
                    {new Date(cohort.emailScheduledFor).toLocaleString('uk-UA', {
                      day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={cancelScheduled}
                  disabled={cancelling || sending}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors disabled:opacity-50 ${
                    dark ? 'bg-rose-500/10 border-rose-400/30 text-rose-200 hover:bg-rose-500/20' : 'bg-white border-rose-300/60 text-rose-700 hover:bg-rose-50'
                  }`}
                >
                  <HiOutlineXMark /> {cancelling ? 'Скасовую…' : 'Скасувати'}
                </button>
              </div>
            )}

            {/* === BLOCK: Хто отримає === */}
            <BlockHeader dark={dark} title="Хто отримає" icon={<HiOutlineUserGroup />} />
            <RecipientsBlock
              theme={theme}
              recipients={recipients}
              loading={recipientsLoading}
              expanded={recipientsExpanded}
              setExpanded={setRecipientsExpanded}
              search={recipientsSearch}
              setSearch={setRecipientsSearch}
              resendingId={resendingId}
              onResend={resendOne}
            />

            {/* === BLOCK: Що отримають === */}
            <BlockHeader dark={dark} title="Що отримають" icon={<HiOutlineEnvelope />} />

            {/* Інфо-картка про шаблон + sync hint */}
            <div className={`rounded-xl border overflow-hidden ${dark ? 'border-white/10 bg-zinc-900' : 'border-stone-200 bg-white'}`}>
              <div className={`px-4 py-3 flex items-start gap-3 ${dark ? 'bg-amber-500/[0.08]' : 'bg-amber-50/70 border-amber-200/40'}`}>
                <div className={`shrink-0 w-7 h-7 rounded-md flex items-center justify-center mt-0.5 ${
                  dark ? 'bg-amber-400/20 text-amber-200' : 'bg-white/80 text-amber-900'
                }`}>
                  <HiOutlineInformationCircle className="text-[15px]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-[12px] font-bold leading-tight mb-1 ${dark ? 'text-amber-200' : 'text-amber-900'}`}>
                    Той самий шаблон, що й у «🚀 Запустити програму»
                  </div>
                  <p className={`text-[12px] leading-snug ${dark ? 'text-slate-300' : 'text-stone-700'}`}>
                    Welcome-лист один на cohort. Зміна тут одразу відобразиться у модалці «Запустити програму», і навпаки. Збереження пише в БД (`cohort.launchEmailSubject/Body`).
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
                      // Дефолтний browser-margin на body додає 8px зверху + знизу — нормалізуємо,
                      // щоб iframe не мав «зайвого» простору навколо контенту.
                      doc.body.style.margin = '0';
                      doc.body.style.padding = '12px';
                      // Скидаємо iframe до 0 перед вимірюванням, щоб body.scrollHeight рахувався
                      // від реальної висоти контенту, а не від поточної висоти iframe-viewport-а.
                      // Інакше height тільки накопичується і ніколи не зменшується для коротких листів.
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

            {/* Test inline */}
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

            {result && (
              <div className={`rounded-lg px-3 py-2 text-[12px] ${
                result.kind === 'ok'
                  ? dark ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-400/20' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : dark ? 'bg-rose-500/10 text-rose-300 border border-rose-400/20' : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}>
                <div>{result.text}</div>
                {result.details && (
                  <pre className={`mt-2 max-h-40 overflow-y-auto text-[10px] font-mono whitespace-pre-wrap ${dark ? 'text-slate-400' : 'text-stone-700'}`}>{result.details}</pre>
                )}
              </div>
            )}
          </div>
        </div>

        {/* FOOTER — головна дія "Надіслати зараз" */}
        <div className={`flex items-center justify-between gap-3 px-6 py-4 border-t ${dark ? 'border-white/10 bg-zinc-900/95' : 'border-stone-200 bg-white/95'}`}>
          <div className={`text-[11px] ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
            {dirty
              ? <span className={dark ? 'text-amber-300' : 'text-amber-700'}>⚠ Зміни шаблону не збережено — натисни «Зберегти шаблон» у редакторі.</span>
              : recipients && recipients.summary.pending === 0
                ? 'Усі вже отримали — надсилати нема кому. Нові студенти отримають лист автоматично при відкритті їм доступу.'
                : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={sending}
              className={`px-3.5 py-2 rounded-lg text-[12px] font-medium ${dark ? 'text-slate-300 hover:bg-white/[0.06]' : 'text-stone-700 hover:bg-stone-100'}`}
            >
              Закрити
            </button>
            <button
              onClick={submitSend}
              disabled={sending || dirty || (recipients?.summary.pending ?? 0) === 0}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-[14px] font-bold border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                dark
                  ? 'bg-gradient-to-br from-amber-400/20 to-amber-500/30 border-amber-400/40 text-amber-100 hover:from-amber-400/30 hover:to-amber-500/40 shadow-[0_0_20px_rgba(212,168,67,0.15)]'
                  : 'bg-gradient-to-br from-amber-300 to-amber-400 border-amber-400/60 text-amber-950 hover:from-amber-400 hover:to-amber-500 shadow-[0_4px_14px_rgba(212,168,67,0.30)]'
              }`}
            >
              <HiOutlinePaperAirplane className="text-base rotate-[-30deg]" />
              {sending
                ? 'Надсилаю…'
                : `Надіслати ${recipients?.summary.pending ?? 0} ${pluralize(recipients?.summary.pending ?? 0, 'лист', 'листи', 'листів')}`}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/// Заголовок верхнього блоку — без номера, тільки з іконкою. Внутрішня нумерація 1/2/3
/// належить sectioned editor-у і має лишитись унікальною (як у LaunchProgramModal).
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

/// Блок одержувачів — компактний header за замовчуванням, розгортається на повний список зі search.
function RecipientsBlock({
  theme,
  recipients,
  loading,
  expanded,
  setExpanded,
  search,
  setSearch,
  resendingId,
  onResend,
}: {
  theme: Theme;
  recipients: RecipientsResponse | null;
  loading: boolean;
  expanded: boolean;
  setExpanded: (v: boolean) => void;
  search: string;
  setSearch: (v: string) => void;
  resendingId: string | null;
  onResend: (subscriptionId: string, email: string) => void;
}) {
  const dark = theme === 'dark';

  if (loading) {
    return (
      <div className={`rounded-xl border overflow-hidden ${dark ? 'bg-zinc-900 border-white/10' : 'bg-white border-stone-200'}`}>
        {/* Header skeleton: статистики + sender */}
        <div className="px-4 py-3.5 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <SkeletonBox dark={dark} width="120px" height="26px" delay={0} rounded="rounded-md" />
              <SkeletonBox dark={dark} width="100px" height="26px" delay={80} rounded="rounded-md" />
            </div>
            <SkeletonBox dark={dark} width="180px" height="11px" delay={160} />
          </div>
          {/* Avatar stack skeleton */}
          <div className="flex items-center -space-x-1.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonBox key={i} dark={dark} width="32px" height="32px" delay={i * 40} rounded="rounded-full" />
            ))}
          </div>
        </div>
        {/* Rows skeleton — компактний прев'ю списку */}
        <div className={`border-t divide-y ${dark ? 'border-white/[0.06] divide-white/[0.04]' : 'border-stone-200 divide-stone-100'}`}>
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonAvatarRow key={i} dark={dark} delay={i * 80 + 200} />
          ))}
        </div>
        <SkeletonFooterTick dark={dark} label="Завантажую одержувачів…" />
      </div>
    );
  }
  if (!recipients) {
    return (
      <div className={`rounded-xl border px-4 py-6 text-center text-[12px] ${
        dark ? 'bg-white/[0.02] border-white/[0.06] text-rose-300' : 'bg-stone-50 border-stone-300/50 text-rose-700'
      }`}>
        Не вдалося завантажити одержувачів
      </div>
    );
  }

  const { recipients: list, summary, fromEmail, resendConfigured } = recipients;
  const unpaidCount = list.filter((r) => !r.alreadySent && !r.hasPaidPayment).length;
  const total = list.length;

  // Простий fuzzy-search по email/імені — фільтр-вкладок нема, бо для cohort welcome
  // практичніше бачити список одразу зі статусами кольорами, а не перемикатися між
  // «отримали / у черзі / не оплатили» — статуси і так візуально розрізняються.
  const filtered = list.filter((r) => {
    if (search) {
      const q = search.toLowerCase();
      if (!r.email.toLowerCase().includes(q) && !(r.name ?? '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className={`rounded-xl border ${dark ? 'bg-zinc-900 border-white/10' : 'bg-white border-stone-200'}`}>
      <div className="px-4 py-3.5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <StatPill theme={theme} tone="emerald" count={summary.pending} label="буде надіслано" active />
            {summary.alreadySent > 0 && (
              <StatPill theme={theme} tone="stone" count={summary.alreadySent} label="вже отримали" />
            )}
            {unpaidCount > 0 && (
              <StatPill theme={theme} tone="amber" count={unpaidCount} label="не оплачено" />
            )}
          </div>
          <div className={`flex items-center gap-1.5 text-[11px] truncate ${dark ? 'text-slate-500' : 'text-stone-500'}`} title={`Відправник: ${fromEmail}`}>
            <span className="opacity-70">↗ Від</span>
            <span className={`font-mono truncate ${dark ? 'text-slate-300' : 'text-stone-700'}`}>{fromEmail}</span>
          </div>
        </div>
        {!resendConfigured && (
          <div className={`mt-2 text-[10px] ${dark ? 'text-rose-300' : 'text-rose-700'}`}>
            ⚠ RESEND_API_KEY не налаштовано — листи лише логуються в консоль
          </div>
        )}

        {total > 0 && (
          <div className="mt-3 flex items-center justify-between gap-3">
            <AvatarStack theme={theme} list={list} max={10} />
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors ${
                dark ? 'bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.08]' : 'bg-white border-stone-300/60 text-stone-700 hover:bg-stone-50'
              }`}
            >
              {expanded ? <HiOutlineChevronUp className="text-xs" /> : <HiOutlineChevronDown className="text-xs" />}
              {expanded ? 'Згорнути' : `Усі ${total}`}
            </button>
          </div>
        )}

        {total === 0 && (
          <div className={`mt-3 text-[12px] text-center py-3 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
            Немає підписників у цьому запуску
          </div>
        )}
      </div>

      {expanded && total > 0 && (
        <div className={`border-t ${dark ? 'border-white/[0.06]' : 'border-stone-200'}`}>
          {/* Search row — без filter-табів, статуси пілюлями вже і так візуально групують */}
          <div className={`px-3 py-2 ${dark ? 'bg-white/[0.02]' : 'bg-stone-50/40'}`}>
            <div className={`flex items-center gap-2 px-2.5 py-1 rounded-md border ${dark ? 'bg-zinc-900/60 border-white/[0.08]' : 'bg-white border-stone-300/60'}`}>
              <HiOutlineMagnifyingGlass className={`text-sm shrink-0 ${dark ? 'text-slate-500' : 'text-stone-400'}`} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Пошук за email або іменем"
                className={`flex-1 bg-transparent outline-none text-[12.5px] ${dark ? 'text-slate-200 placeholder:text-slate-500' : 'text-stone-800 placeholder:text-stone-400'}`}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className={`shrink-0 ${dark ? 'text-slate-500 hover:text-slate-300' : 'text-stone-400 hover:text-stone-600'}`}
                  aria-label="Очистити"
                >
                  <HiOutlineXMark className="text-sm" />
                </button>
              )}
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className={`px-4 py-6 text-center text-[12px] ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
              Нічого не знайдено
            </div>
          ) : (
            <div className={`max-h-[320px] overflow-y-auto divide-y ${dark ? 'divide-white/[0.04]' : 'divide-stone-100'}`}>
              {filtered.map((r) => {
                const status = recipientStatus(r);
                return (
                  <RecipientRow
                    key={r.subscriptionId}
                    theme={theme}
                    recipient={r}
                    status={status}
                    isResending={resendingId === r.subscriptionId}
                    anyResending={!!resendingId}
                    onResend={onResend}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatPill({
  theme, tone, count, label, active = false,
}: {
  theme: Theme;
  tone: 'emerald' | 'stone' | 'amber';
  count: number;
  label: string;
  active?: boolean;
}) {
  const dark = theme === 'dark';
  const tones: Record<typeof tone, { dark: string; light: string }> = {
    emerald: {
      dark: active ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-200' : 'bg-emerald-500/8 border-emerald-400/20 text-emerald-300',
      light: active ? 'bg-emerald-100 border-emerald-300/70 text-emerald-900' : 'bg-emerald-50 border-emerald-200 text-emerald-800',
    },
    stone: {
      dark: 'bg-white/[0.04] border-white/[0.08] text-slate-400',
      light: 'bg-stone-100 border-stone-300/60 text-stone-600',
    },
    amber: {
      dark: 'bg-amber-500/10 border-amber-400/25 text-amber-200',
      light: 'bg-amber-50 border-amber-300/60 text-amber-900',
    },
  };
  const cls = dark ? tones[tone].dark : tones[tone].light;
  return (
    <div className={`inline-flex items-baseline gap-1.5 px-2.5 py-1 rounded-md border text-[12px] ${cls}`}>
      <span className="font-bold tabular-nums text-[15px] leading-none">{count}</span>
      <span className="font-medium opacity-90">{label}</span>
    </div>
  );
}

type RecipientStatus = 'pending' | 'sent' | 'unpaid';

function recipientStatus(r: RecipientInfo): RecipientStatus {
  if (r.alreadySent) return 'sent';
  if (!r.hasPaidPayment) return 'unpaid';
  return 'pending';
}

function StatusBadge({ theme, status, sentAt }: { theme: Theme; status: RecipientStatus; sentAt?: string | null }) {
  const dark = theme === 'dark';
  if (status === 'sent') {
    return (
      <span
        title={sentAt ? new Date(sentAt).toLocaleString('uk-UA') : undefined}
        className={`inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-[3px] rounded-md border ${
          dark
            ? 'bg-emerald-500/12 text-emerald-300 border-emerald-400/25'
            : 'bg-emerald-50 text-emerald-800 border-emerald-300/50'
        }`}
      >
        <HiOutlineCheck className="text-[12px]" strokeWidth={3} />
        Отримав
        {sentAt && (
          <span className={`font-normal ${dark ? 'text-emerald-400/70' : 'text-emerald-700/75'}`}>
            · {formatSentAt(sentAt)}
          </span>
        )}
      </span>
    );
  }
  if (status === 'unpaid') {
    return (
      <span className={`inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-[3px] rounded-md border ${
        dark
          ? 'bg-amber-500/12 text-amber-300 border-amber-400/25'
          : 'bg-amber-50 text-amber-900 border-amber-300/50'
      }`}>
        <HiOutlineExclamationCircle className="text-[12px]" />
        Не оплачено
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-[3px] rounded-md border ${
      dark
        ? 'bg-emerald-500/15 text-emerald-200 border-emerald-400/35'
        : 'bg-emerald-100 text-emerald-900 border-emerald-400/50'
    }`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      У черзі
    </span>
  );
}

/// Один рядок списку одержувачів. Layout: [avatar][name+email+sentAt][plan-pill][status][resend].
/// Plan-pill заповнює простір між email і статусом — без нього на широких екранах ламається
/// співвідношення (email коротше за контейнер, утворюється «дірка»).
function RecipientRow({
  theme,
  recipient,
  status,
  isResending,
  anyResending,
  onResend,
}: {
  theme: Theme;
  recipient: RecipientInfo;
  status: RecipientStatus;
  isResending: boolean;
  anyResending: boolean;
  onResend: (subscriptionId: string, email: string) => void;
}) {
  const dark = theme === 'dark';
  const planLabel = recipient.plan === 'YEARLY'
    ? 'Річна'
    : recipient.autoRenew
      ? 'Місячна авто'
      : 'Місячна разова';
  return (
    <div
      className={`group px-3.5 py-2.5 flex items-center gap-3 transition-colors ${
        dark ? 'hover:bg-white/[0.025]' : 'hover:bg-stone-50/60'
      }`}
    >
      <Avatar theme={theme} name={recipient.name} email={recipient.email} status={status} size={32} />
      <div className="min-w-0 flex-1">
        <div className={`text-[12.5px] font-semibold truncate ${dark ? 'text-slate-100' : 'text-stone-900'}`}>
          {recipient.name ?? <span className={dark ? 'text-slate-500 italic font-normal' : 'text-stone-500 italic font-normal'}>без імені</span>}
        </div>
        <div className={`text-[11px] truncate ${dark ? 'text-slate-500' : 'text-stone-500'}`}>{recipient.email}</div>
      </div>
      <span className={`shrink-0 hidden sm:inline-flex items-center text-[10.5px] font-medium px-1.5 py-[2px] rounded ${
        dark ? 'bg-white/[0.04] text-slate-400 border border-white/[0.06]' : 'bg-stone-100 text-stone-600 border border-stone-200/70'
      }`}>
        {planLabel}
      </span>
      <StatusBadge theme={theme} status={status} sentAt={recipient.sentAt} />
      {(status === 'sent' || status === 'pending') && (
        <button
          type="button"
          onClick={() => onResend(recipient.subscriptionId, recipient.email)}
          disabled={anyResending}
          className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-all disabled:opacity-50 disabled:cursor-wait ${
            // sent (вже отримав) — кнопка з'являється тільки на hover row, щоб таблиця не була
            // галаслива. pending (ще не надіслали) — підкреслено solid amber з halo, видима
            // завжди: дія потрібна негайно і має кидатись в око.
            isResending
              ? 'opacity-100'
              : status === 'sent'
                ? 'opacity-0 group-hover:opacity-100 focus:opacity-100'
                : 'opacity-100'
          } ${
            status === 'pending'
              ? dark
                ? 'bg-gradient-to-br from-amber-400/25 to-amber-500/35 border-amber-400/60 text-amber-100 hover:from-amber-400/35 hover:to-amber-500/45 shadow-[0_0_12px_rgba(212,168,67,0.18)]'
                : 'bg-gradient-to-br from-amber-300 to-amber-400 border-amber-500/60 text-amber-950 hover:from-amber-400 hover:to-amber-500 shadow-[0_2px_8px_rgba(212,168,67,0.30)]'
              : dark
                ? 'bg-amber-400/10 border-amber-400/30 text-amber-200 hover:bg-amber-400/20 hover:border-amber-400/50'
                : 'bg-amber-50 border-amber-300/60 text-amber-900 hover:bg-amber-100 hover:border-amber-400'
          }`}
        >
          {isResending ? (
            <>
              <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Надсилаю…
            </>
          ) : (
            <>
              <HiOutlineArrowPath className="text-[12px]" />
              {status === 'pending' ? 'Надіслати' : 'Надіслати ще раз'}
            </>
          )}
        </button>
      )}
    </div>
  );
}

/// Human-readable час відправки: «щойно» / «5 хв тому» / «2 год тому» / «Вчора, 14:30» / «5 травня, 14:30».
/// Tooltip-ом (`title`) на батьківському span поверх — повний timestamp.
function formatSentAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'щойно';
  if (diffMin < 60) return `${diffMin} хв тому`;
  const diffHr = Math.floor(diffMs / 3_600_000);
  if (diffHr < 24) return `${diffHr} ${pluralize(diffHr, 'годину', 'години', 'годин')} тому`;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const dayDelta = Math.round((today.getTime() - target.getTime()) / 86_400_000);
  const time = d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
  if (dayDelta === 1) return `вчора, ${time}`;
  if (dayDelta < 7) return `${d.toLocaleDateString('uk-UA', { weekday: 'long' })}, ${time}`;
  return `${d.toLocaleDateString('uk-UA', { day: '2-digit', month: 'long' })}, ${time}`;
}

function Avatar({
  theme, name, email, status, size = 32,
}: {
  theme: Theme;
  name: string | null;
  email: string;
  status: RecipientStatus;
  size?: number;
}) {
  const dark = theme === 'dark';
  const initials = getInitials(name, email);
  const palette = getAvatarPalette(email, dark);
  const ring =
    status === 'pending'
      ? dark ? 'ring-emerald-400/60' : 'ring-emerald-500/70'
      : status === 'unpaid'
        ? dark ? 'ring-amber-400/60' : 'ring-amber-500/70'
        : dark ? 'ring-white/10' : 'ring-stone-300';
  const opacity = status === 'sent' ? 'opacity-50' : 'opacity-100';
  return (
    <div
      className={`shrink-0 rounded-full ring-2 ring-offset-0 flex items-center justify-center font-semibold ${ring} ${opacity}`}
      style={{
        width: size,
        height: size,
        background: palette.bg,
        color: palette.fg,
        fontSize: Math.round(size * 0.38),
      }}
      title={`${name ?? email}${status === 'sent' ? ' · отримав' : status === 'unpaid' ? ' · не оплачено' : ''}`}
    >
      {initials}
    </div>
  );
}

function AvatarStack({ theme, list, max }: { theme: Theme; list: RecipientInfo[]; max: number }) {
  const dark = theme === 'dark';
  const visible = list.slice(0, max);
  const rest = list.length - visible.length;
  return (
    <div className="flex items-center -space-x-1.5">
      {visible.map((r) => (
        <Avatar key={r.subscriptionId} theme={theme} name={r.name} email={r.email} status={recipientStatus(r)} size={32} />
      ))}
      {rest > 0 && (
        <div
          className={`shrink-0 rounded-full ring-2 flex items-center justify-center text-[11px] font-semibold ${
            dark ? 'bg-white/[0.04] text-slate-300 ring-white/10' : 'bg-stone-100 text-stone-700 ring-stone-300'
          }`}
          style={{ width: 32, height: 32 }}
          title={`Ще ${rest}`}
        >
          +{rest}
        </div>
      )}
    </div>
  );
}

function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2 && parts[0] && parts[1]) return (parts[0][0] + parts[1][0]).toUpperCase();
    if (parts[0]) return parts[0].slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function getAvatarPalette(seed: string, dark: boolean): { bg: string; fg: string } {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  const palettes = dark
    ? [
        { bg: 'rgba(244,114,182,0.22)', fg: '#fbcfe8' },
        { bg: 'rgba(251,191,36,0.22)', fg: '#fde68a' },
        { bg: 'rgba(52,211,153,0.22)', fg: '#a7f3d0' },
        { bg: 'rgba(56,189,248,0.22)', fg: '#bae6fd' },
        { bg: 'rgba(129,140,248,0.22)', fg: '#c7d2fe' },
        { bg: 'rgba(167,139,250,0.22)', fg: '#ddd6fe' },
        { bg: 'rgba(232,121,249,0.22)', fg: '#f5d0fe' },
        { bg: 'rgba(248,113,113,0.22)', fg: '#fecaca' },
      ]
    : [
        { bg: '#fce7f3', fg: '#9d174d' },
        { bg: '#fef3c7', fg: '#92400e' },
        { bg: '#d1fae5', fg: '#065f46' },
        { bg: '#e0f2fe', fg: '#0c4a6e' },
        { bg: '#e0e7ff', fg: '#3730a3' },
        { bg: '#ede9fe', fg: '#5b21b6' },
        { bg: '#fae8ff', fg: '#86198f' },
        { bg: '#fee2e2', fg: '#991b1b' },
      ];
  return palettes[Math.abs(hash) % palettes.length]!;
}

function pluralize(n: number, nom1: string, nom2_4: string, gen: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return nom1;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return nom2_4;
  return gen;
}
