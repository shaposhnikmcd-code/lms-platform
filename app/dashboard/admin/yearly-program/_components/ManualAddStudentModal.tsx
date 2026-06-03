'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { HiOutlineUserPlus, HiOutlineCheck, HiOutlineExclamationTriangle } from 'react-icons/hi2';
import type { Theme } from '../../_components/adminTheme';
import type { CohortListItem, Plan } from './types';
import { useUIFeedback } from './UIFeedback';

/// Модалка «➕ Додати студента вручну» — менеджер заводить студента у Річну програму
/// БЕЗ нової оплати (перенесення з минулорічного набору тощо). Платіж не створюється,
/// дохід не чіпається. POST /api/admin/yearly-program/manual-add.
export default function ManualAddStudentModal({
  theme,
  cohorts,
  defaultCohortId,
  onClose,
  onDone,
}: {
  theme: Theme;
  cohorts: CohortListItem[];
  defaultCohortId: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const dark = theme === 'dark';
  const { toast } = useUIFeedback();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [plan, setPlan] = useState<Plan>('YEARLY');
  const [cohortId, setCohortId] = useState<string>(defaultCohortId ?? cohorts[0]?.id ?? '');
  const [telegram, setTelegram] = useState('');
  const [sendPasswordEmail, setSendPasswordEmail] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit = validEmail && !!cohortId && !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/yearly-program/manual-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          name: name.trim() || undefined,
          plan,
          cohortId,
          telegramUsername: telegram.trim() || undefined,
          sendPasswordEmail,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? res.statusText);
        return;
      }
      let note = data.userCreated ? ' · акаунт створено' : '';
      note += ' · статус «Очікує» (підтвердьте оплату вручну для активації)';
      if (data.passwordEmail && !data.passwordEmail.sent) {
        note += ` · ⚠ лист пароля FAILED: ${data.passwordEmail.error ?? 'помилка'}`;
      } else if (data.passwordEmail?.sent) {
        note += ' · лист для пароля надіслано';
      }
      toast('success', `Студента ${email.trim().toLowerCase()} додано${note}`);
      onDone();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
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
        style={{ maxWidth: 'min(540px, 96vw)' }}
      >
        {/* HEADER */}
        <header className={`shrink-0 flex items-center justify-between px-6 py-4 border-b ${
          dark ? 'bg-zinc-900/95 border-white/10' : 'bg-white/95 border-stone-200'
        }`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-[18px] ${
              dark ? 'bg-sky-400/15 text-sky-300 border border-sky-400/30' : 'bg-sky-100 text-sky-800 border border-sky-300/60'
            }`}>
              <HiOutlineUserPlus />
            </div>
            <div className="min-w-0">
              <h3 className="text-[16px] font-bold leading-tight">Додати студента вручну</h3>
              <p className={`text-[11.5px] leading-tight mt-0.5 ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
                Створює запис «Очікує» — активація після підтвердження оплати
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
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className={`flex items-start gap-2.5 px-4 py-3 rounded-xl border text-[12px] leading-relaxed ${
            dark ? 'bg-sky-500/[0.05] border-sky-400/20 text-sky-100/90' : 'bg-sky-50/60 border-sky-200/70 text-sky-900'
          }`}>
            <span className="shrink-0">ℹ️</span>
            <span>
              Заводить студента у вибраний запуск зі статусом «Очікує» (без доступу). Щоб
              активувати — на рядку студента натисніть 💵 «Підтвердити оплату вручну».
            </span>
          </div>

          <Field theme={theme} label="Email" required>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@example.com"
              className={inputCls(dark)}
              autoFocus
            />
          </Field>

          <Field theme={theme} label="Імʼя">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Імʼя та прізвище"
              className={inputCls(dark)}
            />
          </Field>

          <Field theme={theme} label="План" required>
            <div className="grid grid-cols-2 gap-2">
              {([['YEARLY', '📅 Річний'], ['MONTHLY', '🗓 Місячний']] as const).map(([v, label]) => {
                const active = plan === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setPlan(v)}
                    className={`px-3 py-2.5 rounded-lg border text-[12px] font-semibold transition-colors ${
                      active
                        ? dark ? 'bg-sky-500/15 border-sky-400/40 text-sky-200' : 'bg-sky-50 border-sky-400/70 text-sky-900'
                        : dark ? 'bg-zinc-800 border-white/10 text-slate-300 hover:bg-white/[0.06]' : 'bg-white border-stone-300 text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field theme={theme} label="Запуск (cohort)" required>
            <select
              value={cohortId}
              onChange={(e) => setCohortId(e.target.value)}
              className={inputCls(dark)}
            >
              {cohorts.length === 0 && <option value="">Немає cohort-ів</option>}
              {cohorts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.isCurrent ? ' (поточний)' : ''}{c.launchedAt ? ' · запущений' : ' · ще не запущено'}
                </option>
              ))}
            </select>
          </Field>

          <Field theme={theme} label="Telegram-нік">
            <input
              type="text"
              value={telegram}
              onChange={(e) => setTelegram(e.target.value)}
              placeholder="@username"
              className={inputCls(dark)}
            />
          </Field>

          <div className="space-y-2.5 pt-1">
            <Checkbox
              theme={theme}
              checked={sendPasswordEmail}
              onChange={setSendPasswordEmail}
              label="Створити акаунт і надіслати лист для пароля"
              hint="Тільки якщо акаунта з таким email ще немає. Лист дійсний 7 днів."
            />
          </div>

          {error && (
            <div className={`text-[12.5px] px-4 py-3 rounded-xl flex items-start gap-2.5 ${
              dark ? 'bg-rose-500/10 border border-rose-400/25 text-rose-200/90' : 'bg-rose-50 border border-rose-200 text-rose-900'
            }`}>
              <HiOutlineExclamationTriangle className="text-base shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <footer className={`shrink-0 flex items-center justify-end gap-2 px-6 py-4 border-t ${
          dark ? 'bg-zinc-900/95 border-white/10' : 'bg-white/95 border-stone-200'
        }`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-lg text-[13px] font-medium border ${
              dark ? 'border-white/10 text-slate-300 hover:bg-white/[0.06]' : 'border-stone-300 text-stone-700 hover:bg-stone-50'
            }`}
          >
            Скасувати
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className={`inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-[13px] font-bold border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              dark
                ? 'bg-sky-500/15 text-sky-200 border-sky-400/30 hover:bg-sky-500/25'
                : 'bg-sky-50 text-sky-900 border-sky-300/60 hover:bg-sky-100'
            }`}
          >
            <HiOutlineCheck className="text-[14px]" />
            {submitting ? 'Додаю…' : 'Додати студента'}
          </button>
        </footer>
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

function Checkbox({
  theme, checked, onChange, label, hint,
}: { theme: Theme; checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  const dark = theme === 'dark';
  return (
    <label className="flex items-start gap-2.5 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 accent-sky-500 cursor-pointer"
      />
      <span>
        <span className={`block text-[12.5px] font-medium ${dark ? 'text-slate-200' : 'text-stone-800'}`}>{label}</span>
        {hint && <span className={`block text-[11px] mt-0.5 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>{hint}</span>}
      </span>
    </label>
  );
}

function inputCls(dark: boolean): string {
  return `w-full px-3 py-2 rounded-lg border text-[13px] outline-none transition-colors ${
    dark
      ? 'bg-zinc-800 border-white/10 text-slate-100 focus:border-sky-400/40'
      : 'bg-white border-stone-300 text-stone-900 focus:border-sky-400'
  }`;
}
