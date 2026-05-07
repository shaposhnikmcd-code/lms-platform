'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { HiOutlineUserPlus, HiOutlineEnvelope, HiOutlineCheck, HiOutlineDocumentDuplicate, HiOutlineExclamationTriangle, HiOutlineSparkles } from 'react-icons/hi2';
import type { Theme } from '../../_components/adminTheme';
import type { CohortListItem } from './types';
import { useUIFeedback } from './UIFeedback';
import { TemplateEditor, PAYMENT_CONFIG } from './PaymentTemplatesModal';
import type { CachedTemplateFull, CachedTemplateListItem } from './modalCaches';
import { getTemplateFullCache, getTemplateListCache } from './modalCaches';

const TEMPLATE_KEY = 'manual-add-invite';

/// Модалка "Додати студента" — менеджер вводить email/ім'я → бачить прев'ю+редактор листа
/// (той самий компонент TemplateEditor, що у «Листи Платежів») → натискає «Надіслати студенту лист».
/// Система генерує signed invite-link (7 днів) і одразу шле студенту лист з посиланням на оплату.
/// Шаблон `manual-add-invite` редагується тут же — правки персистяться у БД як в інших шаблонах.
/// Студент сам обирає план (Річна / Місячна Авто / Місячна Разова) на сторінці. Після оплати
/// підписка створюється з `manuallyAddedAt = now()`, прив'язується до cohort-у з invite. Якщо
/// cohort вже launched — авто-extra-launch шле SP-доступ + лист з логіном.
export default function AddStudentModal({
  cohort,
  theme,
  onClose,
}: {
  cohort: CohortListItem;
  theme: Theme;
  onClose: () => void;
}) {
  const dark = theme === 'dark';
  const { toast } = useUIFeedback();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');

  const [tplFull, setTplFull] = useState<CachedTemplateFull | null>(null);
  const [tplLoadError, setTplLoadError] = useState<string | null>(null);

  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ url: string; expiresAt: string; emailSent: boolean; emailError: string | null } | null>(null);
  const [copied, setCopied] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  // Тягнемо повний шаблон одразу при mount-і. Якщо PaymentTemplatesModal вже відкривали в цій
  // сесії — кеш per-key є, тоді showуємо одразу. Інакше fetch + fill кешу для consistency.
  useEffect(() => {
    const fullCache = getTemplateFullCache(PAYMENT_CONFIG.cacheKey);
    const cached = fullCache[TEMPLATE_KEY];
    if (cached) {
      setTplFull(cached);
      return;
    }
    let cancelled = false;
    fetch(`${PAYMENT_CONFIG.apiBase}/${TEMPLATE_KEY}`)
      .then(async (r) => ({ ok: r.ok, status: r.status, body: await r.json() }))
      .then(({ ok, status, body }) => {
        if (cancelled) return;
        if (!ok) {
          setTplLoadError(body?.error ?? `HTTP ${status}`);
          return;
        }
        // Метадані з list (when, placeholders, sampleData) GET /:key не повертає —
        // склеюємо з registry-кешу або стартуємо з пустими, головне щоб TemplateEditor отримав поля.
        const listCache = getTemplateListCache(PAYMENT_CONFIG.cacheKey);
        const meta = listCache?.items.find((i) => i.key === TEMPLATE_KEY) as CachedTemplateListItem | undefined;
        const full: CachedTemplateFull = {
          // Безпечні дефолти для полів meta — TemplateEditor розрахований на наявність placeholders/sampleData,
          // але без list-кешу їх просто не буде, фоллбек: пусті масиви/обʼєкти.
          key: TEMPLATE_KEY,
          group: 'manual-add',
          title: '✉️ Запрошення вручну — посилання на оплату',
          when: 'Шлеться студенту коли менеджер додає його вручну з адмінки.',
          placeholders: [],
          sampleData: {},
          isCustomized: false,
          updatedAt: null,
          updatedBy: null,
          ...(meta ?? {}),
          ...body,
        };
        fullCache[TEMPLATE_KEY] = full;
        setTplFull(full);
      })
      .catch((e) => { if (!cancelled) setTplLoadError((e as Error).message); });
    return () => { cancelled = true; };
  }, []);

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSend = validEmail && !sending && !!tplFull;

  // Коли менеджер зберігає зміни шаблону — оновлюємо кеш і локальний state, щоб після save
  // нова версія миттєво підставлялась у наступний "Надіслати". Поведінка ідентична PaymentTemplatesModal.
  const onTemplateSaved = (updated: { subject: string; bodyHtml: string; bodyInnerHtml: string; isCustomized: boolean; updatedAt: string | null; updatedBy: string | null }) => {
    if (!tplFull) return;
    const next: CachedTemplateFull = { ...tplFull, ...updated };
    const fullCache = getTemplateFullCache(PAYMENT_CONFIG.cacheKey);
    fullCache[TEMPLATE_KEY] = next;
    setTplFull(next);
  };

  async function send() {
    if (!canSend) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch(`/api/admin/yearly-program/cohorts/${cohort.id}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          name: name.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSendError(data.error ?? res.statusText);
        return;
      }
      setResult({
        url: data.url,
        expiresAt: data.expiresAt,
        emailSent: !!data.emailSent,
        emailError: data.emailError ?? null,
      });
      if (data.emailSent) {
        toast('success', `Лист надіслано на ${email.trim().toLowerCase()}`);
      } else if (data.emailError) {
        toast('error', 'Не вдалося надіслати лист — скопіюйте посилання вручну');
      }
    } catch (e) {
      setSendError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function copyLink() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast('success', 'Посилання скопійовано');
    } catch {
      toast('error', 'Не вдалося скопіювати — виділіть і Ctrl+C');
    }
  }

  function reset() {
    setResult(null);
    setEmail('');
    setName('');
    setSendError(null);
  }

  if (!mounted) return null;

  // Кнопка «Надіслати студенту лист» — рендериться у sticky-footer-і TemplateEditor через
  // extraFooterAction слот. Disabled поки email невалідний або іде запит.
  const sendButton = !result ? (
    <button
      type="button"
      onClick={send}
      disabled={!canSend}
      className={`inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-[13px] font-bold border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        dark
          ? 'bg-rose-500/15 text-rose-200 border-rose-400/30 hover:bg-rose-500/25'
          : 'bg-rose-50 text-rose-900 border-rose-300/60 hover:bg-rose-100'
      }`}
    >
      <HiOutlineEnvelope className="text-[14px]" />
      {sending ? 'Надсилаю…' : 'Надіслати студенту лист'}
    </button>
  ) : null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={`relative w-full max-h-[94vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden ${
          dark ? 'bg-zinc-950 border border-white/10 text-slate-200' : 'bg-stone-100 border border-stone-200 text-stone-800'
        }`}
        style={{ maxWidth: 'min(1360px, 96vw)' }}
      >
        {/* HEADER */}
        <header className={`shrink-0 flex items-center justify-between px-6 py-4 border-b backdrop-blur ${
          dark ? 'bg-zinc-900/95 border-white/10' : 'bg-white/95 border-stone-200'
        }`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-[18px] ${
              dark ? 'bg-rose-400/15 text-rose-300 border border-rose-400/30' : 'bg-rose-100 text-rose-800 border border-rose-300/60'
            }`}>
              <HiOutlineUserPlus />
            </div>
            <div className="min-w-0">
              <h3 className="text-[16px] font-bold leading-tight">Додати студента вручну</h3>
              <p className={`text-[11.5px] leading-tight mt-0.5 ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
                Запуск: <b>{cohort.name}</b> · персональне посилання + лист на email
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
            {/* Інтро-callout */}
            <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${
              dark ? 'bg-amber-500/[0.05] border-amber-400/20 text-amber-100/90' : 'bg-amber-50/60 border-amber-200/70 text-amber-900'
            }`}>
              <HiOutlineSparkles className="text-base shrink-0 mt-0.5" />
              <p className="text-[12px] leading-relaxed">
                Введи дані студента — система згенерує персональне посилання й одразу надішле йому лист на email з кнопкою <b>«Перейти до оплати»</b>.
                Текст листа можна відредагувати тут же у редакторі нижче (правки персистяться у БД для всіх майбутніх запрошень — як у «Листи Платежів»).
                Студент сам обере план (Річна / Місячна Авто / Місячна Разова), посилання дійсне 7 днів. Після оплати — у таблиці зʼявиться рядок з пілюлею <b>«Додано вручну»</b>, доступ відкриється автоматично.
              </p>
            </div>

            {/* Студентські дані */}
            <div className={`rounded-xl border ${dark ? 'border-white/10 bg-zinc-900' : 'border-stone-200 bg-white'}`}>
              <div className={`px-4 py-2.5 border-b ${dark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-stone-200/70 bg-stone-50/60'}`}>
                <div className={`text-[11.5px] font-bold uppercase tracking-wider ${dark ? 'text-slate-300' : 'text-stone-700'}`}>
                  Дані студента
                </div>
              </div>
              <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field theme={theme} label="Email студента" required>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@gmail.com"
                    className={inputCls(dark)}
                    autoFocus
                    disabled={!!result}
                  />
                </Field>
                <Field theme={theme} label="Ім'я (опціонально)">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Імʼя Прізвище"
                    className={inputCls(dark)}
                    disabled={!!result}
                  />
                </Field>
              </div>
            </div>

            {/* Стан після відправки */}
            {result && (
              <>
                {result.emailSent ? (
                  <div className={`text-[12.5px] leading-relaxed px-4 py-3 rounded-xl flex items-start gap-2.5 ${
                    dark ? 'bg-emerald-500/10 border border-emerald-400/25 text-emerald-200/90' : 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                  }`}>
                    <HiOutlineCheck className="text-base shrink-0 mt-0.5" />
                    <span>
                      Лист надіслано на <b>{email.trim().toLowerCase()}</b>. Студент отримає посилання на оплату Річної програми.
                    </span>
                  </div>
                ) : (
                  <div className={`text-[12.5px] leading-relaxed px-4 py-3 rounded-xl flex items-start gap-2.5 ${
                    dark ? 'bg-rose-500/10 border border-rose-400/25 text-rose-200/90' : 'bg-rose-50 border border-rose-200 text-rose-900'
                  }`}>
                    <HiOutlineExclamationTriangle className="text-base shrink-0 mt-0.5" />
                    <span>
                      Не вдалося надіслати лист{result.emailError ? ` (${result.emailError})` : ''}. Скопіюйте посилання нижче й відправте студенту вручну.
                    </span>
                  </div>
                )}

                <div className={`rounded-xl border p-4 ${dark ? 'border-white/10 bg-zinc-900' : 'border-stone-200 bg-white'}`}>
                  <label className={`block text-[11px] uppercase tracking-wider font-medium mb-1.5 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                    {result.emailSent ? 'Резервне посилання (на випадок якщо лист не дійшов)' : 'Лінк на оплату'}
                  </label>
                  <div className="flex gap-2 items-stretch">
                    <input
                      readOnly
                      value={result.url}
                      onClick={(e) => (e.currentTarget as HTMLInputElement).select()}
                      className={`${inputCls(dark)} font-mono text-[11px] truncate`}
                    />
                    <button
                      type="button"
                      onClick={copyLink}
                      className={`shrink-0 inline-flex items-center gap-1.5 px-3 rounded-lg text-[12px] font-semibold border transition-colors ${
                        copied
                          ? dark
                            ? 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30'
                            : 'bg-emerald-50 text-emerald-900 border-emerald-300/60'
                          : dark
                            ? 'bg-amber-400/15 text-amber-200 border-amber-400/30 hover:bg-amber-400/25'
                            : 'bg-amber-100 text-amber-900 border-amber-300/60 hover:bg-amber-200'
                      }`}
                    >
                      {copied ? <HiOutlineCheck /> : <HiOutlineDocumentDuplicate />}
                      {copied ? 'Скопійовано' : 'Копіювати'}
                    </button>
                  </div>
                  <div className={`mt-2 text-[11px] ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                    Дійсний до: <span className={dark ? 'text-slate-300' : 'text-stone-700'}>
                      {new Date(result.expiresAt).toLocaleString('uk-UA', { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={reset}
                      className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border ${
                        dark ? 'border-white/10 text-slate-300 hover:bg-white/[0.06]' : 'border-stone-300 text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      ← Додати ще одного
                    </button>
                  </div>
                </div>
              </>
            )}

            {sendError && !result && (
              <div className={`text-[12.5px] px-4 py-3 rounded-xl flex items-start gap-2.5 ${
                dark ? 'bg-rose-500/10 border border-rose-400/25 text-rose-200/90' : 'bg-rose-50 border border-rose-200 text-rose-900'
              }`}>
                <HiOutlineExclamationTriangle className="text-base shrink-0 mt-0.5" />
                <span>{sendError}</span>
              </div>
            )}

            {/* TemplateEditor — preview + WYSIWYG, ідентичний UX як у «Листи Платежів» */}
            {tplLoadError && (
              <div className={`p-3 rounded-lg text-[12px] ${dark ? 'bg-rose-500/15 text-rose-300 border border-rose-400/20' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
                Не вдалося завантажити шаблон: {tplLoadError}
              </div>
            )}
            {!tplFull && !tplLoadError && (
              <div className={`p-6 rounded-xl text-center text-[12px] ${dark ? 'border border-white/10 bg-zinc-900 text-slate-400' : 'border border-stone-200 bg-white text-stone-500'}`}>
                Завантажую шаблон листа…
              </div>
            )}
            {tplFull && (
              <TemplateEditor
                key={tplFull.key}
                theme={theme}
                item={tplFull}
                config={PAYMENT_CONFIG}
                onSaved={onTemplateSaved}
                extraFooterAction={sendButton}
              />
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Field({ theme, label, required, children }: { theme: Theme; label: string; required?: boolean; children: React.ReactNode }) {
  const dark = theme === 'dark';
  return (
    <div>
      <label className={`block text-[11px] uppercase tracking-wider font-medium mb-1.5 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
        {label} {required && <span className={dark ? 'text-rose-300' : 'text-rose-500'}>*</span>}
      </label>
      {children}
    </div>
  );
}

function inputCls(dark: boolean): string {
  return `w-full px-3 py-2 rounded-lg border text-[13px] outline-none transition-colors ${
    dark
      ? 'bg-zinc-800 border-white/10 text-slate-100 focus:border-amber-400/40 disabled:opacity-60'
      : 'bg-white border-stone-300 text-stone-900 focus:border-amber-400 disabled:opacity-60'
  }`;
}
