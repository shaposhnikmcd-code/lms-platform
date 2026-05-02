'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { HiOutlinePencilSquare, HiOutlineEye, HiOutlinePaperAirplane, HiOutlineCheck, HiOutlineBolt, HiOutlineCalendarDays, HiOutlineUserGroup, HiOutlineEnvelope, HiOutlineMagnifyingGlass, HiOutlineChevronDown, HiOutlineChevronUp, HiOutlineXMark, HiOutlineArrowPath } from 'react-icons/hi2';
import type { Theme } from '../../_components/adminTheme';
import type { CohortListItem } from './types';
import { useUIFeedback } from './UIFeedback';
import InlineDateTimePicker from '../../_components/InlineDateTimePicker';

interface RecipientInfo {
  subscriptionId: string;
  name: string | null;
  email: string;
  alreadySent: boolean;
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

/// Об'єднана модалка "Запустити розсилку" — три секції:
///   1. Лист — Subject + Body (редагування) + live preview + тестова відправка + зберегти шаблон
///   2. Одержувачі — From-адреса, список, лічильники
///   3. Надсилання — toggle Зараз/Запланувати, datetime picker, кнопка Надіслати
///
/// Замінює два окремі модали (SendEmailsModal + EmailTemplateModal). Менеджер бачить лист,
/// може його відредагувати, перевірити одержувачів і надіслати — все в одному вікні.
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

  // Email template state
  const [subject, setSubject] = useState(cohort.launchEmailSubject ?? '');
  const [body, setBody] = useState(cohort.launchEmailBody ?? '');
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState<{ subject: string; body: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [savingTpl, setSavingTpl] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testSending, setTestSending] = useState(false);

  // Recipients state
  const [recipients, setRecipients] = useState<RecipientsResponse | null>(null);
  const [recipientsLoading, setRecipientsLoading] = useState(true);
  const [recipientsExpanded, setRecipientsExpanded] = useState(false);
  const [recipientsSearch, setRecipientsSearch] = useState('');
  const [recipientsFilter, setRecipientsFilter] = useState<'all' | 'pending' | 'sent' | 'unpaid'>('all');
  // Per-recipient resend (subscription id, поки yet idle).
  const [resendingId, setResendingId] = useState<string | null>(null);

  // Inline test-send (поза edit-режимом, за один клік на «Тестовий лист»)
  const [testInlineOpen, setTestInlineOpen] = useState(false);

  // Send state. Якщо вже існує запланована розсилка — стартуємо у режимі 'schedule'
  // з підтягнутою датою, щоб менеджер одразу бачив поточний час і міг його змінити.
  const [mode, setMode] = useState<'now' | 'schedule'>(cohort.emailScheduledFor ? 'schedule' : 'now');
  const [scheduledFor, setScheduledFor] = useState(() => {
    if (cohort.emailScheduledFor) return formatDateTimeInput(new Date(cohort.emailScheduledFor));
    const t = new Date();
    t.setHours(t.getHours() + 1, 0, 0, 0);
    return formatDateTimeInput(t);
  });
  const [sending, setSending] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [result, setResult] = useState<{ kind: 'ok' | 'err'; text: string; details?: string } | null>(null);

  const dirty = useMemo(
    () => subject !== (cohort.launchEmailSubject ?? '') || body !== (cohort.launchEmailBody ?? ''),
    [subject, body, cohort.launchEmailSubject, cohort.launchEmailBody],
  );

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  // Початкове завантаження: preview + recipients паралельно.
  useEffect(() => {
    let cancelled = false;
    async function loadAll() {
      try {
        const [previewRes, recipientsRes] = await Promise.all([
          fetch(`/api/admin/yearly-program/cohorts/${cohort.id}/preview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subject: subject || undefined, body: body || undefined }),
          }),
          fetch(`/api/admin/yearly-program/cohorts/${cohort.id}/recipients`),
        ]);
        if (cancelled) return;
        if (previewRes.ok) {
          const previewData = await previewRes.json();
          setPreview(previewData);
          // Якщо cohort не зберіг шаблон — підставляємо дефолти у поля редагування.
          if (!cohort.launchEmailSubject && previewData.subject) {
            setSubject(previewRes.headers.get('x-default-subject') ?? cohort.launchEmailSubject ?? '');
          }
        }
        if (recipientsRes.ok) {
          setRecipients(await recipientsRes.json());
        }
      } catch {
        // ignore — UI покаже стан ".не вдалося завантажити"
      } finally {
        if (!cancelled) {
          setPreviewLoading(false);
          setRecipientsLoading(false);
        }
      }
    }
    setPreviewLoading(true);
    void loadAll();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cohort.id]);

  async function refreshPreview() {
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/admin/yearly-program/cohorts/${cohort.id}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body }),
      });
      const data = await res.json();
      if (res.ok) setPreview(data);
      else toast('error', data.error ?? 'Помилка preview');
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function saveTemplate() {
    setSavingTpl(true);
    try {
      const res = await fetch(`/api/admin/yearly-program/cohorts/${cohort.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ launchEmailSubject: subject, launchEmailBody: body }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast('error', data.error ?? 'Помилка збереження');
        return;
      }
      toast('success', 'Шаблон збережено');
      setEditing(false);
      router.refresh();
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setSavingTpl(false);
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
      description: `Цей студент уже отримував welcome-лист. Повторна відправка надішле йому той самий шаблон ще раз.`,
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
      description: 'Запланований час буде скинуто. Розсилка не виконається автоматично — щоб запустити, треба буде вибрати "Зараз" або заново запланувати.',
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

  async function submitSend() {
    if (dirty) {
      toast('info', 'Спочатку збережіть зміни шаблону або скасуйте їх');
      return;
    }

    // Cross-validation: коли welcome-лист піде РАНІШЕ за фактичний запуск програми,
    // студенти можуть отримати лист зі ще закритим SendPulse-доступом. Попереджаємо.
    const emailAt = mode === 'now' ? new Date() : new Date(scheduledFor);
    const launchAt = cohort.launchedAt
      ? new Date(cohort.launchedAt)
      : cohort.launchScheduledFor
        ? new Date(cohort.launchScheduledFor)
        : null;

    let warning: 'no-launch' | 'before-launch' | null = null;
    if (!launchAt) {
      warning = 'no-launch';
    } else if (!cohort.launchedAt && launchAt.getTime() > emailAt.getTime() + 5 * 60_000) {
      warning = 'before-launch';
    }

    if (warning) {
      const ok = await confirm({
        title: warning === 'no-launch'
          ? '⚠ Програма ще не запущена'
          : '⚠ Розсилка раніше за запуск програми',
        description: warning === 'no-launch'
          ? 'Студенти можуть отримати welcome-лист, у якому буде сказано про відкриття доступу — але доступ у SendPulse ще не відкритий. Зазвичай розсилку роблять після 🚀 Запустити програму або одночасно з нею.'
          : 'Зазвичай welcome-лист надсилається після того, як SendPulse-доступ відкритий. Інакше посилання у листі може ще не працювати.',
        bullets: [
          {
            icon: '📨',
            text: `Розсилка: ${mode === 'now' ? 'зараз (одразу)' : humanizeWhenLong(scheduledFor)}`,
          },
          {
            icon: '🚀',
            text: launchAt
              ? `Запуск програми: ${cohort.launchedAt ? 'вже виконано ' + humanizeWhenLong(cohort.launchedAt) : 'заплановано на ' + humanizeWhenLong(launchAt.toISOString())}`
              : 'Запуск програми: ще не запущено і не заплановано',
          },
          ...(warning === 'before-launch' && launchAt
            ? [{ icon: '⏱', text: `Різниця: ${humanizeDelta(emailAt, launchAt)} між розсилкою та запуском` }]
            : []),
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
        body: JSON.stringify(
          mode === 'now'
            ? { mode: 'now' }
            : { mode: 'schedule', at: new Date(scheduledFor).toISOString() },
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ kind: 'err', text: data.error ?? 'Помилка', details: JSON.stringify(data) });
        return;
      }
      if (mode === 'now') {
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
      } else {
        toast('success', `📅 Розсилку заплановано на ${humanizeWhenLong(scheduledFor)}`);
        router.refresh();
        onClose();
        return;
      }
    } catch (e) {
      setResult({ kind: 'err', text: (e as Error).message });
    } finally {
      setSending(false);
    }
  }

  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className={`relative max-w-5xl w-full max-h-[92vh] flex flex-col rounded-2xl shadow-2xl ${
        dark ? 'bg-zinc-900 border border-white/10 text-slate-200' : 'bg-white border border-stone-200 text-stone-800'
      }`}>
        <div className={`flex items-center justify-between px-5 py-3 border-b ${dark ? 'border-white/10' : 'border-stone-200'}`}>
          <h3 className="text-base font-bold flex items-center gap-2">
            <HiOutlinePaperAirplane className="text-lg rotate-[-30deg]" />
            Запустити розсилку · {cohort.name}
          </h3>
          <button onClick={onClose} className={`w-7 h-7 rounded-full flex items-center justify-center ${dark ? 'hover:bg-white/10' : 'hover:bg-stone-100'}`}>✕</button>
        </div>

        <div className="px-6 py-5 space-y-6 overflow-y-auto flex-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* === SECTION 1: Хто отримає === */}
          <NumberedSection theme={theme} num={1} title="Хто отримає" icon={<HiOutlineUserGroup />}>
            <RecipientsBlock
              theme={theme}
              recipients={recipients}
              loading={recipientsLoading}
              expanded={recipientsExpanded}
              setExpanded={setRecipientsExpanded}
              search={recipientsSearch}
              setSearch={setRecipientsSearch}
              filter={recipientsFilter}
              setFilter={setRecipientsFilter}
              resendingId={resendingId}
              onResend={resendOne}
            />
          </NumberedSection>

          {/* === SECTION 2: Що отримають === */}
          <NumberedSection
            theme={theme}
            num={2}
            title="Що отримають"
            icon={<HiOutlineEnvelope />}
            actions={
              !editing ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setTestInlineOpen((v) => !v)}
                    className={btnCls(dark, 'neutral-sm')}
                  >
                    <HiOutlinePaperAirplane className="text-sm rotate-[-30deg]" />
                    Тестовий лист
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className={btnCls(dark, 'neutral-sm')}
                  >
                    <HiOutlinePencilSquare className="text-sm" />
                    Редагувати
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSubject(cohort.launchEmailSubject ?? '');
                      setBody(cohort.launchEmailBody ?? '');
                      setEditing(false);
                    }}
                    disabled={savingTpl}
                    className={btnCls(dark, 'ghost-sm')}
                  >
                    Скасувати
                  </button>
                  <button
                    type="button"
                    onClick={refreshPreview}
                    disabled={previewLoading}
                    className={btnCls(dark, 'neutral-sm')}
                  >
                    <HiOutlineEye className="text-sm" /> Оновити
                  </button>
                  <button
                    type="button"
                    onClick={saveTemplate}
                    disabled={savingTpl || !dirty}
                    className={btnCls(dark, 'primary-sm')}
                  >
                    <HiOutlineCheck className="text-sm" /> {savingTpl ? 'Зберігаю…' : 'Зберегти'}
                  </button>
                </div>
              )
            }
          >
            {editing ? (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <Label theme={theme}>Тема листа</Label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Ласкаво просимо до {{cohortName}}…"
                      className={inputCls(dark)}
                    />
                  </div>
                  <div>
                    <Label theme={theme}>Текст листа (HTML)</Label>
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={14}
                      placeholder="<p>Вітаємо, {{name}}!</p>…"
                      className={`${inputCls(dark)} font-mono text-[12px]`}
                    />
                    <div className={`mt-1 text-[10px] ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                      Плейсхолдери: <code>{'{{name}}'}</code> · <code>{'{{email}}'}</code> · <code>{'{{startDate}}'}</code> · <code>{'{{endDate}}'}</code> · <code>{'{{cohortName}}'}</code>
                    </div>
                  </div>
                </div>
                <PreviewPanel theme={theme} preview={preview} loading={previewLoading} />
              </div>
            ) : (
              <CompactPreview theme={theme} preview={preview} loading={previewLoading} />
            )}

            {testInlineOpen && !editing && (
              <div className={`mt-3 rounded-lg border p-3 flex items-end gap-2 ${
                dark ? 'bg-amber-500/[0.06] border-amber-400/20' : 'bg-amber-50/60 border-amber-200/70'
              }`}>
                <div className="flex-1">
                  <Label theme={theme}>Надіслати тестовий лист на</Label>
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="email@example.com"
                    className={inputCls(dark)}
                    autoFocus
                  />
                </div>
                <button
                  type="button"
                  onClick={sendTest}
                  disabled={testSending || !testEmail}
                  className={btnCls(dark, 'primary-sm')}
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
          </NumberedSection>

          {/* === SECTION 3: Коли відправити === */}
          <NumberedSection theme={theme} num={3} title="Коли відправити" icon={<HiOutlinePaperAirplane className="rotate-[-30deg]" />}>
            {cohort.emailScheduledFor && (
              <div className={`mb-3 rounded-xl border px-4 py-3 flex items-center gap-3 ${
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
                    {humanizeWhen(formatDateTimeInput(new Date(cohort.emailScheduledFor)))}
                    <span className={`ml-2 text-[11px] ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
                      ({new Date(cohort.emailScheduledFor).toLocaleString('uk-UA')})
                    </span>
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
            <div className="grid md:grid-cols-2 gap-3">
              <SendModeCard
                theme={theme}
                active={mode === 'now'}
                onClick={() => setMode('now')}
                icon={<HiOutlineBolt className="text-2xl" />}
                accent="amber"
                title="Надіслати зараз"
                subtitle={`${recipients?.summary.pending ?? 0} підписників отримають лист протягом хвилини`}
              >
                {mode === 'now' && (
                  <div className={`mt-2 text-[11px] ${dark ? 'text-amber-200/70' : 'text-amber-900/80'}`}>
                    ⚡ Послідовна відправка через Resend. Дублі виключено.
                  </div>
                )}
              </SendModeCard>

              <SendModeCard
                theme={theme}
                active={mode === 'schedule'}
                onClick={() => setMode('schedule')}
                icon={<HiOutlineCalendarDays className="text-2xl" />}
                accent="indigo"
                title="Запланувати"
                subtitle={mode === 'schedule' ? humanizeWhen(scheduledFor) : 'Cron надішле у вибраний день'}
              >
                {mode === 'schedule' && (
                  <div className="mt-3 space-y-2.5">
                    <div className="flex flex-wrap gap-1.5">
                      {SCHEDULE_PRESETS.map((p) => {
                        const presetIso = p.compute();
                        const presetVal = formatDateTimeInput(new Date(presetIso));
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
                    <div className={`text-[10px] leading-snug ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                      ℹ️ Cron перевіряє розсилки раз на добу о 04:00 UTC.
                      Фактичний час може зсунутись на ≤24 години.
                    </div>
                  </div>
                )}
              </SendModeCard>
            </div>

            {result && (
              <div className={`mt-3 rounded-lg px-3 py-2 text-[12px] ${
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
          </NumberedSection>
        </div>

        <div className={`flex items-center justify-between gap-3 px-6 py-4 border-t ${dark ? 'border-white/10 bg-white/[0.02]' : 'border-stone-200 bg-stone-50/50'}`}>
          <div className={`text-[11px] ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
            {dirty
              ? <span className={dark ? 'text-amber-300' : 'text-amber-700'}>⚠ Зміни шаблону не збережено — натисни «Зберегти» вище.</span>
              : mode === 'now' && recipients && recipients.summary.pending === 0
                ? 'Усі вже отримали — надсилати нема кому. Або заплануй на майбутню дату для нових студентів.'
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
              disabled={sending || dirty || (mode === 'now' && (recipients?.summary.pending ?? 0) === 0)}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-[14px] font-bold border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                dark
                  ? 'bg-gradient-to-br from-amber-400/20 to-amber-500/30 border-amber-400/40 text-amber-100 hover:from-amber-400/30 hover:to-amber-500/40 shadow-[0_0_20px_rgba(212,168,67,0.15)]'
                  : 'bg-gradient-to-br from-amber-300 to-amber-400 border-amber-400/60 text-amber-950 hover:from-amber-400 hover:to-amber-500 shadow-[0_4px_14px_rgba(212,168,67,0.30)]'
              }`}
            >
              {sending
                ? 'Виконую…'
                : mode === 'now'
                  ? <><HiOutlineBolt className="text-base" /> Надіслати {recipients?.summary.pending ?? 0} {pluralize(recipients?.summary.pending ?? 0, 'листу', 'лист', 'листи', 'листів')}</>
                  : <><HiOutlineCalendarDays className="text-base" /> {cohort.emailScheduledFor ? 'Змінити запланований час на' : 'Запланувати на'} {humanizeWhen(scheduledFor, { compact: true })}</>}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/// Нумерована секція з іконкою та опціональними інлайн-екшенами справа.
function NumberedSection({
  theme,
  num,
  title,
  icon,
  actions,
  children,
}: {
  theme: Theme;
  num: number;
  title: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const dark = theme === 'dark';
  return (
    <section>
      <div className="flex items-center justify-between mb-3 gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold border ${
            dark ? 'bg-amber-400/15 border-amber-400/30 text-amber-200' : 'bg-amber-100 border-amber-300/60 text-amber-900'
          }`}>
            {num}
          </div>
          <h4 className={`text-[15px] font-bold flex items-center gap-1.5 ${dark ? 'text-slate-100' : 'text-stone-900'}`}>
            {icon && <span className={`text-[16px] ${dark ? 'text-slate-400' : 'text-stone-500'}`}>{icon}</span>}
            {title}
          </h4>
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

function Label({ theme, children }: { theme: Theme; children: React.ReactNode }) {
  const dark = theme === 'dark';
  return (
    <label className={`block text-[10px] uppercase tracking-[0.18em] font-medium mb-1 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
      {children}
    </label>
  );
}

/// Edit-mode preview (повний preview з повною висотою).
function PreviewPanel({
  theme,
  preview,
  loading,
}: {
  theme: Theme;
  preview: { subject: string; body: string } | null;
  loading: boolean;
}) {
  const dark = theme === 'dark';
  return (
    <div className={`rounded-lg border min-h-[400px] ${dark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-stone-50 border-stone-300/50'}`}>
      {loading && !preview ? (
        <div className={`px-4 py-8 text-center text-[12px] ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
          Рендерю…
        </div>
      ) : preview ? (
        <div className="p-4">
          <div className={`pb-3 mb-3 border-b text-[12px] ${dark ? 'border-white/[0.06] text-slate-300' : 'border-stone-200 text-stone-700'}`}>
            <div className={dark ? 'text-slate-500' : 'text-stone-500'}>Тема:</div>
            <div className="font-semibold">{preview.subject}</div>
          </div>
          <div
            className="prose prose-sm max-w-none"
            style={{ color: dark ? '#cbd5e1' : '#1c1917' }}
            dangerouslySetInnerHTML={{ __html: preview.body }}
          />
        </div>
      ) : (
        <div className={`px-4 py-8 text-center text-[12px] ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
          Не вдалося завантажити preview
        </div>
      )}
    </div>
  );
}

/// Read-only preview (за замовчуванням): subject inline як у Gmail-кліенті,
/// body з фіксованою висотою 220px і fade-out gradient на нижньому краї як натяк "є більше".
function CompactPreview({
  theme,
  preview,
  loading,
}: {
  theme: Theme;
  preview: { subject: string; body: string } | null;
  loading: boolean;
}) {
  const dark = theme === 'dark';
  if (loading && !preview) {
    return (
      <div className={`rounded-xl border px-4 py-8 text-center text-[12px] ${
        dark ? 'bg-white/[0.02] border-white/[0.06] text-slate-500' : 'bg-stone-50 border-stone-300/50 text-stone-500'
      }`}>
        Рендерю preview…
      </div>
    );
  }
  if (!preview) {
    return (
      <div className={`rounded-xl border px-4 py-8 text-center text-[12px] ${
        dark ? 'bg-white/[0.02] border-white/[0.06] text-rose-300' : 'bg-stone-50 border-stone-300/50 text-rose-700'
      }`}>
        Не вдалося завантажити preview
      </div>
    );
  }
  return (
    <div className={`rounded-xl border overflow-hidden ${dark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-white border-stone-200'}`}>
      <div className={`px-4 py-2.5 border-b text-[12px] flex items-baseline gap-2 ${dark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-stone-200 bg-stone-50/60'}`}>
        <span className={`text-[10px] uppercase tracking-[0.18em] font-medium shrink-0 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>Тема</span>
        <span className={`font-semibold truncate ${dark ? 'text-slate-100' : 'text-stone-900'}`}>{preview.subject}</span>
      </div>
      <div className="relative">
        <div
          className="prose prose-sm max-w-none px-4 py-3 max-h-[220px] overflow-y-auto"
          style={{ color: dark ? '#cbd5e1' : '#1c1917' }}
          dangerouslySetInnerHTML={{ __html: preview.body }}
        />
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0 h-12"
          style={{
            background: dark
              ? 'linear-gradient(to bottom, transparent, rgba(24,24,27,0.95))'
              : 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.95))',
          }}
        />
      </div>
    </div>
  );
}

/// Блок одержувачів — компактний за замовчуванням, розгортається на повний список зі search.
function RecipientsBlock({
  theme,
  recipients,
  loading,
  expanded,
  setExpanded,
  search,
  setSearch,
  filter,
  setFilter,
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
  filter: 'all' | 'pending' | 'sent' | 'unpaid';
  setFilter: (v: 'all' | 'pending' | 'sent' | 'unpaid') => void;
  resendingId: string | null;
  onResend: (subscriptionId: string, email: string) => void;
}) {
  const dark = theme === 'dark';

  if (loading) {
    return (
      <div className={`rounded-xl border px-4 py-6 text-center text-[12px] ${
        dark ? 'bg-white/[0.02] border-white/[0.06] text-slate-500' : 'bg-stone-50 border-stone-300/50 text-stone-500'
      }`}>
        Завантажую одержувачів…
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

  // Фільтрація для розгорнутого списку
  const filtered = list.filter((r) => {
    if (filter === 'pending' && (r.alreadySent || !r.hasPaidPayment)) return false;
    if (filter === 'sent' && !r.alreadySent) return false;
    if (filter === 'unpaid' && (r.alreadySent || r.hasPaidPayment)) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!r.email.toLowerCase().includes(q) && !(r.name ?? '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className={`rounded-xl border ${dark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-white border-stone-200'}`}>
      {/* HEADER: stats + sender */}
      <div className="px-4 py-3.5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <StatPill theme={theme} tone="emerald" count={summary.pending} label={summary.pending === 1 ? 'буде надіслано' : 'буде надіслано'} active />
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
          <>
            {/* AVATAR STACK + кнопка розкриття */}
            <div className="mt-3 flex items-center justify-between gap-3">
              <AvatarStack theme={theme} list={list} max={10} />
              {total > 0 && (
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
              )}
            </div>
          </>
        )}

        {total === 0 && (
          <div className={`mt-3 text-[12px] text-center py-3 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
            Немає підписників у цьому запуску
          </div>
        )}
      </div>

      {/* EXPANDED LIST */}
      {expanded && total > 0 && (
        <div className={`border-t ${dark ? 'border-white/[0.06]' : 'border-stone-200'}`}>
          <div className={`px-3 py-2 flex items-center gap-2 ${dark ? 'bg-white/[0.02]' : 'bg-stone-50/40'}`}>
            <div className={`flex-1 flex items-center gap-2 px-2.5 py-1 rounded-md border ${dark ? 'bg-zinc-900/60 border-white/[0.08]' : 'bg-white border-stone-300/60'}`}>
              <HiOutlineMagnifyingGlass className={`text-sm shrink-0 ${dark ? 'text-slate-500' : 'text-stone-400'}`} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Пошук за email або іменем"
                className={`flex-1 bg-transparent outline-none text-[12px] ${dark ? 'text-slate-200 placeholder:text-slate-500' : 'text-stone-800 placeholder:text-stone-400'}`}
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
            <FilterTabs theme={theme} filter={filter} setFilter={setFilter} />
          </div>
          {filtered.length === 0 ? (
            <div className={`px-4 py-6 text-center text-[12px] ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
              Нічого не знайдено
            </div>
          ) : (
            <div className={`max-h-[260px] overflow-y-auto divide-y ${dark ? 'divide-white/[0.04]' : 'divide-stone-100'}`}>
              {filtered.map((r) => {
                const status = recipientStatus(r);
                return (
                  <div key={r.subscriptionId} className="group px-3 py-2 flex items-center justify-between gap-3 text-[12px]">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <Avatar theme={theme} name={r.name} email={r.email} status={status} size={28} />
                      <div className="min-w-0 flex-1">
                        <div className={`truncate ${dark ? 'text-slate-200' : 'text-stone-800'}`}>
                          {r.name ?? <span className={dark ? 'text-slate-500 italic' : 'text-stone-500 italic'}>без імені</span>}
                        </div>
                        <div className={`text-[11px] truncate ${dark ? 'text-slate-500' : 'text-stone-500'}`}>{r.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <StatusBadge theme={theme} status={status} />
                      {(status === 'sent' || status === 'pending') && (
                        <button
                          type="button"
                          onClick={() => onResend(r.subscriptionId, r.email)}
                          disabled={!!resendingId}
                          title={status === 'sent' ? 'Надіслати лист повторно' : 'Надіслати лист одразу'}
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-md border transition-all disabled:opacity-50 disabled:cursor-wait ${
                            status === 'sent'
                              ? 'opacity-0 group-hover:opacity-100 focus:opacity-100'
                              : 'opacity-60 group-hover:opacity-100 focus:opacity-100'
                          } ${
                            dark
                              ? 'bg-white/[0.04] border-white/[0.10] text-slate-300 hover:bg-amber-400/15 hover:border-amber-400/40 hover:text-amber-200'
                              : 'bg-white border-stone-300/60 text-stone-600 hover:bg-amber-50 hover:border-amber-400/60 hover:text-amber-900'
                          }`}
                          aria-label="Надіслати знов"
                        >
                          {resendingId === r.subscriptionId ? (
                            <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <HiOutlineArrowPath className="text-[13px]" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/// Кругла "пілюля статистика" зі стрілкою акценту.
function StatPill({
  theme,
  tone,
  count,
  label,
  active = false,
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

function StatusBadge({ theme, status }: { theme: Theme; status: RecipientStatus }) {
  const dark = theme === 'dark';
  if (status === 'sent') {
    return (
      <span className={`text-[10px] px-1.5 py-0.5 rounded ${dark ? 'bg-stone-500/20 text-slate-400' : 'bg-stone-200 text-stone-600'}`}>
        ✓ отримав
      </span>
    );
  }
  if (status === 'unpaid') {
    return (
      <span className={`text-[10px] px-1.5 py-0.5 rounded ${dark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-800'}`}>
        не оплачено
      </span>
    );
  }
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded ${dark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-800'}`}>
      буде надіслано
    </span>
  );
}

function FilterTabs({
  theme,
  filter,
  setFilter,
}: {
  theme: Theme;
  filter: 'all' | 'pending' | 'sent' | 'unpaid';
  setFilter: (v: 'all' | 'pending' | 'sent' | 'unpaid') => void;
}) {
  const dark = theme === 'dark';
  const opts: { v: typeof filter; label: string }[] = [
    { v: 'all', label: 'Усі' },
    { v: 'pending', label: 'Надіслати' },
    { v: 'sent', label: 'Отримали' },
    { v: 'unpaid', label: 'Не оплат.' },
  ];
  return (
    <div className={`shrink-0 inline-flex p-0.5 rounded-md border ${dark ? 'bg-zinc-900/60 border-white/[0.06]' : 'bg-stone-100 border-stone-300/40'}`}>
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => setFilter(o.v)}
          className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
            filter === o.v
              ? dark ? 'bg-white/10 text-white' : 'bg-white text-stone-900 shadow-sm'
              : dark ? 'text-slate-500 hover:text-slate-200' : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/// Avatar з ініціалами + status ring.
function Avatar({
  theme,
  name,
  email,
  status,
  size = 32,
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

/// Стабільна палітра для аватара — hash email-у в один з 8 пресетів.
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

/// Українська плюралізація (1 одержувач / 2-4 одержувачі / 5-21 одержувачів).
function pluralize(n: number, _accSing: string, nom1: string, nom2_4: string, gen: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return nom1;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return nom2_4;
  return gen;
}

function inputCls(dark: boolean): string {
  return `w-full px-3 py-2 rounded-lg border text-[13px] outline-none transition-colors ${
    dark
      ? 'bg-white/[0.04] border-white/[0.08] text-slate-200 focus:border-amber-400/40'
      : 'bg-white border-stone-300/60 text-stone-800 focus:border-amber-600/50'
  }`;
}

function btnCls(dark: boolean, variant: 'neutral-sm' | 'primary-sm' | 'primary' | 'ghost-sm'): string {
  const sizeBase = variant.endsWith('-sm') ? 'px-2.5 py-1 text-[11px]' : 'px-4 py-1.5 text-[12px]';
  if (variant === 'primary' || variant === 'primary-sm') {
    return `inline-flex items-center gap-1.5 rounded-lg font-semibold transition-colors disabled:opacity-50 ${sizeBase} ${
      dark
        ? 'bg-amber-400/15 text-amber-200 border border-amber-400/30 hover:bg-amber-400/20'
        : 'bg-amber-100 text-amber-900 border border-amber-300/60 hover:bg-amber-200'
    }`;
  }
  if (variant === 'ghost-sm') {
    return `${sizeBase} rounded-lg ${dark ? 'text-slate-400 hover:bg-white/[0.06]' : 'text-stone-600 hover:bg-stone-100'}`;
  }
  return `inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${sizeBase} ${
    dark
      ? 'bg-white/[0.04] border border-white/[0.1] text-slate-300 hover:bg-white/[0.08]'
      : 'bg-white border border-stone-300/60 text-stone-700 hover:bg-stone-50'
  }`;
}

function formatDateTimeInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/// Картка вибору режиму відправки. Active state = amber/indigo рамка та тло.
function SendModeCard({
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
  // <div role="button"> а не <button>, бо вкладені діти можуть містити <button> (presets, inputs).
  // HTML не допускає nested-<button>, тому використовуємо div з керованою keyboard-доступністю.
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

/// Швидкі пресети планування. compute() повертає ISO для майбутньої дати.
const SCHEDULE_PRESETS: { label: string; compute: () => string }[] = [
  {
    label: 'Через 1 годину',
    compute: () => {
      const d = new Date();
      d.setMinutes(0, 0, 0);
      d.setHours(d.getHours() + 1);
      return d.toISOString();
    },
  },
  {
    label: 'Сьогодні 18:00',
    compute: () => {
      const d = new Date();
      d.setHours(18, 0, 0, 0);
      if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
      return d.toISOString();
    },
  },
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
      const day = d.getDay(); // 0=Sun, 1=Mon
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
      d.setMinutes(0, 0, 0);
      return d.toISOString();
    },
  },
];

/// Перетворює "2026-05-05T14:00" у "Завтра, 14:00" / "У понеділок, 5 травня о 14:00" / "Через 2 години".
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

/// Повна форма дати+часу для confirmation-діалогу: "5 травня 2026, 14:00".
function humanizeWhenLong(isoOrLocal: string): string {
  const d = new Date(isoOrLocal);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('uk-UA', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/// Тривалість між двома датами у людській формі: "27 днів 5 годин".
function humanizeDelta(from: Date, to: Date): string {
  const diffMs = Math.abs(to.getTime() - from.getTime());
  const days = Math.floor(diffMs / 86_400_000);
  const hours = Math.floor((diffMs % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diffMs % 3_600_000) / 60_000);
  if (days > 0) return `${days} ${pluralize(days, '', 'день', 'дні', 'днів')}${hours > 0 ? ` ${hours} год` : ''}`;
  if (hours > 0) return `${hours} ${pluralize(hours, '', 'година', 'години', 'годин')}${minutes > 0 ? ` ${minutes} хв` : ''}`;
  return `${minutes} хв`;
}
