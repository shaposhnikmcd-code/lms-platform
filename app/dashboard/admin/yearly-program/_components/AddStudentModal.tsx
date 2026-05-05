'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { HiOutlineUserPlus, HiOutlineLink, HiOutlineCheck, HiOutlineDocumentDuplicate } from 'react-icons/hi2';
import type { Theme } from '../../_components/adminTheme';
import type { CohortListItem } from './types';
import { useUIFeedback } from './UIFeedback';

/// Модалка "Додати студента" — менеджер вводить email/ім'я → отримує signed invite-link
/// (термін дії 7 днів) для відправки студенту, який не встиг купити Річну програму до запуску.
/// Студент сам обирає план (Річна / Місячна Автосписання / Місячна Разова) на сторінці.
/// Після оплати у таблиці з'явиться рядок з пілюлею "✋ Додано вручну" і кнопкою
/// "🎯 Екстра Запуск нового студента".
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
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ url: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canGenerate = validEmail && !generating;

  async function generate() {
    if (!canGenerate) return;
    setGenerating(true);
    setError(null);
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
        setError(data.error ?? res.statusText);
        return;
      }
      setResult({ url: data.url, expiresAt: data.expiresAt });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
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
    setError(null);
  }

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className={`relative max-w-lg w-full rounded-2xl shadow-2xl ${
        dark ? 'bg-zinc-900 border border-white/10 text-slate-200' : 'bg-white border border-stone-200 text-stone-800'
      }`}>
        <div className={`flex items-center justify-between px-5 py-3 border-b ${dark ? 'border-white/10' : 'border-stone-200'}`}>
          <h3 className="text-base font-bold flex items-center gap-2">
            <HiOutlineUserPlus className="text-lg" /> Додати студента вручну
          </h3>
          <button onClick={onClose} aria-label="Закрити" className={`w-7 h-7 rounded-full flex items-center justify-center ${dark ? 'hover:bg-white/10' : 'hover:bg-stone-100'}`}>✕</button>
        </div>

        {!result ? (
          <>
            <div className="px-5 py-4 space-y-4">
              <div className={`text-[12px] leading-relaxed px-3 py-2 rounded-lg ${
                dark ? 'bg-amber-500/8 border border-amber-400/20 text-amber-200/90' : 'bg-amber-50 border border-amber-200 text-amber-900'
              }`}>
                Згенеруємо персональне посилання для студента, який не встиг купити Річну програму. Запуск: <b>{cohort.name}</b>.
                Token дійсний 7 днів. На сторінці студент сам обере план — <b>Річна / Місячна Автосписання / Місячна Разова</b>.
                Після оплати студент з&apos;явиться у таблиці з пілюлею <b>«Додано вручну»</b>.
              </div>

              <Field theme={theme} label="Email студента" required>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@gmail.com"
                  className={inputCls(dark)}
                  autoFocus
                />
              </Field>

              <Field theme={theme} label="Ім'я (опціонально)">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Імʼя Прізвище"
                  className={inputCls(dark)}
                />
              </Field>

              {error && (
                <div className={`px-3 py-2 rounded-lg text-[12px] ${dark ? 'bg-rose-500/10 text-rose-300 border border-rose-400/20' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
                  {error}
                </div>
              )}
            </div>

            <div className={`flex items-center justify-end gap-2 px-5 py-3 border-t ${dark ? 'border-white/10' : 'border-stone-200'}`}>
              <button
                onClick={onClose}
                disabled={generating}
                className={`px-3 py-1.5 rounded-lg text-[12px] ${
                  dark ? 'text-slate-300 hover:bg-white/[0.06]' : 'text-stone-700 hover:bg-stone-100'
                }`}
              >
                Скасувати
              </button>
              <button
                onClick={generate}
                disabled={!canGenerate}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  dark
                    ? 'bg-rose-500/15 text-rose-200 border-rose-400/30 hover:bg-rose-500/25'
                    : 'bg-rose-50 text-rose-900 border-rose-300/60 hover:bg-rose-100'
                }`}
              >
                <HiOutlineLink />
                {generating ? 'Генерую…' : 'Згенерувати посилання'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="px-5 py-4 space-y-4">
              <div className={`text-[12px] leading-relaxed px-3 py-2.5 rounded-lg ${
                dark ? 'bg-emerald-500/10 border border-emerald-400/25 text-emerald-200/90' : 'bg-emerald-50 border border-emerald-200 text-emerald-900'
              }`}>
                ✅ Посилання згенеровано. Скопіюй і відправ студенту через email/Telegram.
              </div>

              <div>
                <label className={`block text-[11px] uppercase tracking-wider font-medium mb-1.5 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                  Лінк на оплату
                </label>
                <div className={`flex gap-2 items-stretch`}>
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
              </div>

              <div className={`text-[11px] ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                Дійсний до: <span className={dark ? 'text-slate-300' : 'text-stone-700'}>
                  {new Date(result.expiresAt).toLocaleString('uk-UA', { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
              </div>
            </div>

            <div className={`flex items-center justify-between gap-2 px-5 py-3 border-t ${dark ? 'border-white/10' : 'border-stone-200'}`}>
              <button
                onClick={reset}
                className={`px-3 py-1.5 rounded-lg text-[12px] ${
                  dark ? 'text-slate-300 hover:bg-white/[0.06]' : 'text-stone-700 hover:bg-stone-100'
                }`}
              >
                ← Згенерувати ще
              </button>
              <button
                onClick={onClose}
                className={`px-4 py-1.5 rounded-lg text-[12px] font-semibold ${
                  dark
                    ? 'bg-white/[0.06] text-slate-200 border border-white/10 hover:bg-white/[0.10]'
                    : 'bg-white border border-stone-300 text-stone-800 hover:bg-stone-50'
                }`}
              >
                Готово
              </button>
            </div>
          </>
        )}
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
      ? 'bg-zinc-800 border-white/10 text-slate-100 focus:border-amber-400/40'
      : 'bg-white border-stone-300 text-stone-900 focus:border-amber-400'
  }`;
}
