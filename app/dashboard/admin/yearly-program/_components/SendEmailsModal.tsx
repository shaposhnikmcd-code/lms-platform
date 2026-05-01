'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import type { Theme } from '../../_components/adminTheme';
import type { CohortListItem } from './types';

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

/// Модалка запуску welcome-розсилки. Дві гілки:
///   1. "Зараз" → негайна послідовна відправка через mailer (Resend).
///   2. "Запланувати" → date+time picker; cron перевіряє щодоби о 04:00 UTC.
///      На Vercel Hobby cron може спрацювати з лагом до 24h — про це попереджаємо.
/// При відкритті фетчить список одержувачів і From-адресу — менеджер бачить
/// конкретно кому і звідки піде лист перед натисненням "Надіслати".
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
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<'now' | 'schedule'>('now');
  const [scheduledFor, setScheduledFor] = useState(() => {
    const t = new Date();
    t.setHours(t.getHours() + 1, 0, 0, 0);
    return formatDateTimeInput(t);
  });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ kind: 'ok' | 'err'; text: string; details?: string } | null>(null);
  const [recipients, setRecipients] = useState<RecipientsResponse | null>(null);
  const [recipientsLoading, setRecipientsLoading] = useState(true);
  const [showAllRecipients, setShowAllRecipients] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  // Підтягуємо список одержувачів + From при відкритті.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/admin/yearly-program/cohorts/${cohort.id}/recipients`);
        const data = await res.json();
        if (!cancelled && res.ok) {
          setRecipients(data);
        }
      } catch {
        // ignore — UI просто покаже "не вдалося завантажити"
      } finally {
        if (!cancelled) setRecipientsLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [cohort.id]);

  async function submit() {
    setBusy(true);
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
        setResult({
          kind: 'ok',
          text: `Надіслано: ${s.sent} · Пропущено (вже отримали): ${s.skipped} · Помилок: ${s.failed}`,
          details: data.results
            ?.filter((r: { error?: string }) => r.error)
            .map((r: { email: string; error?: string }) => `${r.email}: ${r.error}`)
            .join('\n') || undefined,
        });
      } else {
        setResult({
          kind: 'ok',
          text: `Розсилку заплановано на ${new Date(scheduledFor).toLocaleString('uk-UA')}. Cron виконає її автоматично.`,
        });
      }
      router.refresh();
    } catch (e) {
      setResult({ kind: 'err', text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className={`relative max-w-lg w-full rounded-2xl shadow-2xl ${
        dark ? 'bg-zinc-900 border border-white/10 text-slate-200' : 'bg-white border border-stone-200 text-stone-800'
      }`}>
        <div className={`flex items-center justify-between px-5 py-3 border-b ${dark ? 'border-white/10' : 'border-stone-200'}`}>
          <h3 className="text-base font-bold">Запустити розсилку · {cohort.name}</h3>
          <button onClick={onClose} className={`w-7 h-7 rounded-full flex items-center justify-center ${dark ? 'hover:bg-white/10' : 'hover:bg-stone-100'}`}>✕</button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className={`text-[12px] ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
            Розсилається welcome-лист усім підписникам у запуску, які ще не отримали його. Дублі виключені.
          </div>

          {/* From-адреса — звідки піде лист */}
          <div className={`rounded-lg p-3 text-[12px] ${dark ? 'bg-white/[0.03] border border-white/[0.06]' : 'bg-stone-50 border border-stone-200'}`}>
            <div className={`text-[10px] uppercase tracking-[0.18em] font-medium mb-1 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
              Відправник (From)
            </div>
            {recipientsLoading ? (
              <div className={dark ? 'text-slate-500' : 'text-stone-500'}>Завантажую…</div>
            ) : recipients ? (
              <>
                <div className={`font-mono ${dark ? 'text-slate-200' : 'text-stone-800'}`}>{recipients.fromEmail}</div>
                {!recipients.resendConfigured && (
                  <div className={`mt-1 text-[11px] ${dark ? 'text-rose-300' : 'text-rose-700'}`}>
                    ⚠ RESEND_API_KEY не налаштовано — листи лише логуються в консоль (dev-режим)
                  </div>
                )}
              </>
            ) : (
              <div className={dark ? 'text-rose-300' : 'text-rose-700'}>Не вдалося завантажити</div>
            )}
          </div>

          {/* Список одержувачів */}
          <div className={`rounded-lg border ${dark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-white border-stone-200'}`}>
            <div className={`px-3 py-2 flex items-center justify-between text-[11px] uppercase tracking-[0.18em] font-medium ${dark ? 'text-slate-500 border-b border-white/[0.06]' : 'text-stone-500 border-b border-stone-200'}`}>
              <span>Одержувачі</span>
              {recipients && (
                <span className={`normal-case tracking-normal ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
                  {recipients.summary.pending} буде надіслано
                  {recipients.summary.alreadySent > 0 && ` · ${recipients.summary.alreadySent} вже отримали`}
                </span>
              )}
            </div>
            {recipientsLoading ? (
              <div className={`px-3 py-4 text-center text-[12px] ${dark ? 'text-slate-500' : 'text-stone-500'}`}>Завантажую…</div>
            ) : !recipients || recipients.recipients.length === 0 ? (
              <div className={`px-3 py-4 text-center text-[12px] ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                Немає підписників у цьому запуску
              </div>
            ) : (
              <>
                <div className={`max-h-[200px] overflow-y-auto divide-y ${dark ? 'divide-white/[0.04]' : 'divide-stone-100'}`}>
                  {(showAllRecipients ? recipients.recipients : recipients.recipients.slice(0, 8)).map((r) => (
                    <div key={r.subscriptionId} className="px-3 py-2 flex items-center justify-between gap-3 text-[12px]">
                      <div className="min-w-0 flex-1">
                        <div className={`truncate ${dark ? 'text-slate-200' : 'text-stone-800'}`}>
                          {r.name ?? <span className={dark ? 'text-slate-500 italic' : 'text-stone-500 italic'}>без імені</span>}
                        </div>
                        <div className={`text-[11px] truncate ${dark ? 'text-slate-500' : 'text-stone-500'}`}>{r.email}</div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {r.alreadySent ? (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${dark ? 'bg-slate-500/20 text-slate-400' : 'bg-stone-200 text-stone-600'}`}>
                            ✓ вже отримав
                          </span>
                        ) : !r.hasPaidPayment ? (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${dark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-800'}`}>
                            не оплачено
                          </span>
                        ) : (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${dark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-800'}`}>
                            буде надіслано
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {recipients.recipients.length > 8 && (
                  <button
                    type="button"
                    onClick={() => setShowAllRecipients((v) => !v)}
                    className={`w-full px-3 py-2 text-[11px] border-t transition-colors ${
                      dark
                        ? 'text-slate-400 hover:text-slate-200 border-white/[0.06] hover:bg-white/[0.04]'
                        : 'text-stone-600 hover:text-stone-900 border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    {showAllRecipients ? 'Згорнути' : `Показати ще ${recipients.recipients.length - 8}`}
                  </button>
                )}
              </>
            )}
          </div>

          <div className={`rounded-lg border p-1 inline-flex ${dark ? 'bg-black/30 border-white/[0.06]' : 'bg-stone-100 border-stone-300/50'}`}>
            <button
              onClick={() => setMode('now')}
              className={`px-3 py-1.5 text-[12px] font-medium rounded transition-colors ${
                mode === 'now'
                  ? dark ? 'bg-white/10 text-white' : 'bg-white text-stone-900 shadow-sm'
                  : dark ? 'text-slate-500 hover:text-slate-200' : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              Зараз
            </button>
            <button
              onClick={() => setMode('schedule')}
              className={`px-3 py-1.5 text-[12px] font-medium rounded transition-colors ${
                mode === 'schedule'
                  ? dark ? 'bg-white/10 text-white' : 'bg-white text-stone-900 shadow-sm'
                  : dark ? 'text-slate-500 hover:text-slate-200' : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              Запланувати
            </button>
          </div>

          {mode === 'now' ? (
            <div className={`rounded-lg p-3 text-[12px] ${dark ? 'bg-amber-500/10 border border-amber-400/20 text-amber-200' : 'bg-amber-50 border border-amber-300/40 text-amber-900'}`}>
              ⚡ Розсилка запуститься одразу. {recipients?.summary.pending ?? 0} підписників отримають лист.
            </div>
          ) : (
            <div className="space-y-2">
              <label className={`block text-[10px] uppercase tracking-[0.18em] font-medium ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                Дата та час відправки
              </label>
              <input
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border text-[13px] outline-none ${
                  dark ? 'bg-white/[0.04] border-white/[0.08] text-slate-200 focus:border-amber-400/40' : 'bg-white border-stone-300/60 text-stone-800 focus:border-amber-600/50'
                }`}
              />
              <div className={`text-[11px] ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                ℹ️ Cron перевіряє розсилки раз на добу о 04:00 UTC. Розсилка піде у наступний tick після
                запланованої дати — фактичний час відправки може зсунутись на ≤24 години.
              </div>
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

        <div className={`flex items-center justify-end gap-2 px-5 py-3 border-t ${dark ? 'border-white/10' : 'border-stone-200'}`}>
          <button onClick={onClose} disabled={busy} className={`px-3 py-1.5 rounded-lg text-[12px] ${dark ? 'text-slate-300 hover:bg-white/[0.06]' : 'text-stone-700 hover:bg-stone-100'}`}>
            Закрити
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className={`px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-colors disabled:opacity-50 ${
              dark
                ? 'bg-amber-400/15 text-amber-200 border border-amber-400/30 hover:bg-amber-400/20'
                : 'bg-amber-100 text-amber-900 border border-amber-300/60 hover:bg-amber-200'
            }`}
          >
            {busy ? 'Виконую…' : mode === 'now' ? 'Надіслати зараз' : 'Запланувати'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function formatDateTimeInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
