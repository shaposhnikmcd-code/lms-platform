'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import type { Theme } from '../../_components/adminTheme';
import type { CohortListItem } from './types';

/// Модалка редагування welcome-листа cohort-у. Subject + body (HTML), preview, тестова відправка.
/// Плейсхолдери: {{name}}, {{email}}, {{startDate}}, {{endDate}}, {{cohortName}}.
export default function EmailTemplateModal({
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
  const [subject, setSubject] = useState(cohort.launchEmailSubject ?? '');
  const [body, setBody] = useState(cohort.launchEmailBody ?? '');
  const [preview, setPreview] = useState<{ subject: string; body: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  // Прелоад дефолтів якщо cohort ще не зберіг шаблон.
  useEffect(() => {
    if (!cohort.launchEmailSubject || !cohort.launchEmailBody) {
      void loadPreview(undefined, undefined, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadPreview(s?: string, b?: string, fillEmpty = false) {
    setPreviewLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/yearly-program/cohorts/${cohort.id}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: s ?? subject,
          body: b ?? body,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Помилка preview');
      setPreview(data);
      // Якщо текст-area порожні — заповнюємо рендером з default плейсхолдерами як стартовий шаблон.
      if (fillEmpty && !subject) setSubject(s ?? subject);
      if (fillEmpty && !body) setBody(b ?? body);
    } catch (e) {
      setMsg({ kind: 'err', text: (e as Error).message });
    } finally {
      setPreviewLoading(false);
    }
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/yearly-program/cohorts/${cohort.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ launchEmailSubject: subject, launchEmailBody: body }),
      });
      if (!res.ok) {
        const data = await res.json();
        setMsg({ kind: 'err', text: data.error ?? 'Помилка збереження' });
        return;
      }
      setMsg({ kind: 'ok', text: 'Збережено' });
      router.refresh();
    } catch (e) {
      setMsg({ kind: 'err', text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    if (!testEmail.includes('@')) {
      setMsg({ kind: 'err', text: 'Невірний email' });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/yearly-program/cohorts/${cohort.id}/test-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: testEmail, subject, body }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ kind: 'err', text: data.error ?? 'Помилка відправки' });
      } else {
        setMsg({ kind: 'ok', text: `Тестовий лист надіслано на ${testEmail}` });
      }
    } catch (e) {
      setMsg({ kind: 'err', text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className={`relative max-w-5xl w-full max-h-[90vh] flex flex-col rounded-2xl shadow-2xl ${
        dark ? 'bg-zinc-900 border border-white/10 text-slate-200' : 'bg-white border border-stone-200 text-stone-800'
      }`}>
        <div className={`flex items-center justify-between px-5 py-3 border-b ${dark ? 'border-white/10' : 'border-stone-200'}`}>
          <h3 className="text-base font-bold">E-mail запуску · {cohort.name}</h3>
          <button onClick={onClose} className={`w-7 h-7 rounded-full flex items-center justify-center ${dark ? 'hover:bg-white/10' : 'hover:bg-stone-100'}`}>✕</button>
        </div>

        <div className="grid md:grid-cols-2 gap-5 px-5 py-4 overflow-y-auto flex-1">
          <div className="space-y-3">
            <div>
              <label className={`block text-[10px] uppercase tracking-[0.18em] font-medium mb-1 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                Тема листа
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Ласкаво просимо до {{cohortName}}…"
                className={inputCls(dark)}
              />
            </div>
            <div>
              <label className={`block text-[10px] uppercase tracking-[0.18em] font-medium mb-1 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                Текст листа (HTML)
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={16}
                placeholder="<p>Вітаємо, {{name}}!</p>…"
                className={`${inputCls(dark)} font-mono text-[12px]`}
              />
              <div className={`mt-1 text-[10px] ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                Плейсхолдери: <code>{'{{name}}'}</code> · <code>{'{{email}}'}</code> · <code>{'{{startDate}}'}</code> · <code>{'{{endDate}}'}</code> · <code>{'{{cohortName}}'}</code>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap pt-2">
              <button
                type="button"
                onClick={() => loadPreview()}
                disabled={previewLoading}
                className={btnCls(dark, 'neutral')}
              >
                {previewLoading ? 'Рендерю…' : '👁 Попередній перегляд'}
              </button>
            </div>

            <div className={`pt-3 border-t ${dark ? 'border-white/[0.06]' : 'border-stone-200'}`}>
              <label className={`block text-[10px] uppercase tracking-[0.18em] font-medium mb-1 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                Тестова відправка
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="email@example.com"
                  className={inputCls(dark)}
                />
                <button
                  type="button"
                  onClick={sendTest}
                  disabled={busy || !testEmail}
                  className={btnCls(dark, 'neutral')}
                >
                  Відправити
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className={`block text-[10px] uppercase tracking-[0.18em] font-medium mb-1 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
              Превʼю
            </label>
            <div className={`rounded-lg border min-h-[400px] ${dark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-stone-50 border-stone-300/50'}`}>
              {preview ? (
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
                  Натисни "Попередній перегляд" — побачиш як виглядатиме лист
                </div>
              )}
            </div>
          </div>
        </div>

        {msg && (
          <div className={`mx-5 my-2 px-3 py-2 rounded-lg text-[12px] ${
            msg.kind === 'ok'
              ? dark ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-400/20' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : dark ? 'bg-rose-500/10 text-rose-300 border border-rose-400/20' : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}>
            {msg.text}
          </div>
        )}

        <div className={`flex items-center justify-end gap-2 px-5 py-3 border-t ${dark ? 'border-white/10' : 'border-stone-200'}`}>
          <button onClick={onClose} disabled={busy} className={`px-3 py-1.5 rounded-lg text-[12px] ${dark ? 'text-slate-300 hover:bg-white/[0.06]' : 'text-stone-700 hover:bg-stone-100'}`}>
            Закрити
          </button>
          <button onClick={save} disabled={busy} className={btnCls(dark, 'primary')}>
            {busy ? 'Зберігаю…' : 'Зберегти шаблон'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function inputCls(dark: boolean): string {
  return `w-full px-3 py-2 rounded-lg border text-[13px] outline-none transition-colors ${
    dark
      ? 'bg-white/[0.04] border-white/[0.08] text-slate-200 focus:border-amber-400/40'
      : 'bg-white border-stone-300/60 text-stone-800 focus:border-amber-600/50'
  }`;
}

function btnCls(dark: boolean, variant: 'neutral' | 'primary'): string {
  if (variant === 'primary') {
    return `px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-colors disabled:opacity-50 ${
      dark
        ? 'bg-amber-400/15 text-amber-200 border border-amber-400/30 hover:bg-amber-400/20'
        : 'bg-amber-100 text-amber-900 border border-amber-300/60 hover:bg-amber-200'
    }`;
  }
  return `px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors disabled:opacity-50 ${
    dark
      ? 'bg-white/[0.04] border border-white/[0.1] text-slate-300 hover:bg-white/[0.08]'
      : 'bg-white border border-stone-300/60 text-stone-700 hover:bg-stone-50'
  }`;
}
