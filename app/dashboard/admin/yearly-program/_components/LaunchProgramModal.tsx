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
  HiOutlineEnvelope,
  HiOutlinePencilSquare,
  HiOutlinePaperAirplane,
  HiOutlineEye,
} from 'react-icons/hi2';
import type { Theme } from '../../_components/adminTheme';
import type { CohortListItem } from './types';
import { useUIFeedback } from './UIFeedback';
import InlineDateTimePicker from '../../_components/InlineDateTimePicker';

/// Модалка "🚀 Запустити програму" — об'єднана дія "відкрити доступ + надіслати welcome-лист".
///
/// Дві осі вибору:
///   1. КОЛИ запускати: зараз / запланувати на дату.
///   2. ЧИ надсилати лист одночасно (default ON): можна редагувати subject/body тут же.
///      Запланований launch + checkbox ON → emailScheduledFor встановлюється на ту саму дату.
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
  const [scheduledFor, setScheduledFor] = useState(() => {
    if (cohort.launchScheduledFor) return formatDateTimeInput(new Date(cohort.launchScheduledFor));
    const t = new Date();
    t.setDate(t.getDate() + 1);
    t.setHours(9, 0, 0, 0);
    return formatDateTimeInput(t);
  });

  // === Welcome email ===
  // Дефолт: ON. Якщо при попередньому збереженні scheduled launch менеджер зняв галочку
  // (emailScheduledFor=null при launchScheduledFor!=null) — стартуємо з OFF, щоб поточний
  // стан UI відповідав збереженому в БД.
  const [sendWelcomeEmails, setSendWelcomeEmails] = useState(() => {
    if (cohort.launchScheduledFor) return cohort.emailScheduledFor !== null;
    return true;
  });

  // Email editor state (тільки коли sendWelcomeEmails=true)
  const [subject, setSubject] = useState(cohort.launchEmailSubject ?? '');
  const [body, setBody] = useState(cohort.launchEmailBody ?? '');
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState<{ subject: string; body: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [savingTpl, setSavingTpl] = useState(false);
  const [testInlineOpen, setTestInlineOpen] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testSending, setTestSending] = useState(false);

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

  // Preview підвантажується ТІЛЬКИ якщо менеджер тримає лист увімкненим — інакше зайва робота.
  useEffect(() => {
    if (!sendWelcomeEmails) return;
    if (preview) return; // вже завантажено
    let cancelled = false;
    setPreviewLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/admin/yearly-program/cohorts/${cohort.id}/preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subject: subject || undefined, body: body || undefined }),
        });
        if (cancelled) return;
        if (res.ok) setPreview(await res.json());
      } catch {
        // ignore — UI покаже стан помилки
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendWelcomeEmails]);

  const cohortEnd = useMemo(() => new Date(cohort.endDate), [cohort.endDate]);
  const scheduledDate = useMemo(() => new Date(scheduledFor), [scheduledFor]);
  const scheduleInvalid = scheduledDate.getTime() <= Date.now() || scheduledDate.getTime() > cohortEnd.getTime();

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
      await refreshPreview();
      router.refresh();
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setSavingTpl(false);
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
            ? `📅 Запуск + лист заплановано на ${humanizeWhen(scheduledFor)}`
            : `📅 Запуск заплановано на ${humanizeWhen(scheduledFor)} (без листа)`,
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
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className={`relative max-w-3xl w-full max-h-[92vh] flex flex-col rounded-2xl shadow-2xl ${
        dark ? 'bg-zinc-900 border border-white/10 text-slate-200' : 'bg-white border border-stone-200 text-stone-800'
      }`}>
        <div className={`flex items-center justify-between px-6 py-3.5 border-b ${dark ? 'border-white/10' : 'border-stone-200'}`}>
          <h3 className="text-base font-bold flex items-center gap-2">
            <HiOutlineRocketLaunch className="text-lg" />
            Запустити програму · {cohort.name}
          </h3>
          <button onClick={onClose} aria-label="Закрити" className={`w-7 h-7 rounded-full flex items-center justify-center ${dark ? 'hover:bg-white/10' : 'hover:bg-stone-100'}`}>✕</button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                  Запуск заплановано{cohort.emailScheduledFor ? ' · з листом' : ' · без листа'}
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

          {/* === SECTION 1: Коли запустити === */}
          <Section theme={theme} num={1} title="Коли запустити" icon={<HiOutlineRocketLaunch />}>
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
                      ℹ️ Cron перевіряє щодоби о 04:00 UTC. Фактичний запуск може зсунутись на ≤24 години.
                    </div>
                  </div>
                )}
              </ModeCard>
            </div>
          </Section>

          {/* === SECTION 2: Welcome-лист === */}
          <Section
            theme={theme}
            num={2}
            title="Welcome-лист"
            icon={<HiOutlineEnvelope />}
            actions={
              !editing && sendWelcomeEmails && preview ? (
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
              ) : null
            }
          >
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

            {/* Editor / preview — тільки коли чекбокс ON */}
            {sendWelcomeEmails && (
              <div className="mt-3 space-y-3">
                {editing ? (
                  <>
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
                    <div className="flex items-center justify-end gap-1.5">
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
                  </>
                ) : (
                  <CompactPreview theme={theme} preview={preview} loading={previewLoading} />
                )}

                {testInlineOpen && !editing && (
                  <div className={`rounded-lg border p-3 flex items-end gap-2 ${
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
              </div>
            )}
          </Section>
        </div>

        <div className={`flex items-center justify-between gap-3 px-6 py-4 border-t ${dark ? 'border-white/10 bg-white/[0.02]' : 'border-stone-200 bg-stone-50/50'}`}>
          <div className={`text-[11px] ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
            {dirty
              ? <span className={dark ? 'text-amber-300' : 'text-amber-700'}>⚠ Зміни шаблону не збережено — натисни «Зберегти» вище.</span>
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
      {isReplan ? 'Перепланувати на' : 'Запланувати на'} {humanizeWhen(scheduledFor, { compact: true })}
      {sendWelcomeEmails && <span className="opacity-70">+ лист</span>}
    </>
  );
}

function Section({
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
      <div className="flex items-center justify-between mb-2.5 gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold border ${
            dark ? 'bg-amber-400/15 border-amber-400/30 text-amber-200' : 'bg-amber-100 border-amber-300/60 text-amber-900'
          }`}>
            {num}
          </div>
          <h4 className={`text-[14px] font-bold flex items-center gap-1.5 ${dark ? 'text-slate-100' : 'text-stone-900'}`}>
            {icon && <span className={`text-[15px] ${dark ? 'text-slate-400' : 'text-stone-500'}`}>{icon}</span>}
            {title}
          </h4>
        </div>
        {actions}
      </div>
      {children}
    </section>
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
          className="prose prose-sm max-w-none px-4 py-3 max-h-[200px] overflow-y-auto"
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

function Label({ theme, children }: { theme: Theme; children: React.ReactNode }) {
  const dark = theme === 'dark';
  return (
    <label className={`block text-[10px] uppercase tracking-[0.18em] font-medium mb-1 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
      {children}
    </label>
  );
}

function inputCls(dark: boolean): string {
  return `w-full px-3 py-2 rounded-lg border text-[13px] outline-none transition-colors ${
    dark
      ? 'bg-white/[0.04] border-white/[0.08] text-slate-200 focus:border-amber-400/40'
      : 'bg-white border-stone-300/60 text-stone-800 focus:border-amber-600/50'
  }`;
}

function btnCls(dark: boolean, variant: 'neutral-sm' | 'primary-sm' | 'ghost-sm'): string {
  const sizeBase = 'px-2.5 py-1 text-[11px]';
  if (variant === 'primary-sm') {
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

function pluralize(n: number, nom1: string, nom2_4: string, gen: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return nom1;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return nom2_4;
  return gen;
}

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
