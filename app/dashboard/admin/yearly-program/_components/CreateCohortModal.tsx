'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import type { Theme } from '../../_components/adminTheme';

/// Модалка створення нового запуску. startDate за замовчуванням = 01.09.{рік},
/// endDate = +9 міс − 1 день. Назва редагується (default "Річна програма {рік}").
export default function CreateCohortModal({
  theme,
  onClose,
  onCreated,
}: {
  theme: Theme;
  onClose: () => void;
  onCreated: (cohortId: string) => void;
}) {
  const dark = theme === 'dark';
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const today = new Date();
  const defaultYear = today.getMonth() >= 8 && today.getDate() > 1 ? today.getFullYear() + 1 : today.getFullYear();
  const defaultStart = new Date(defaultYear, 8, 1);
  const defaultEnd = new Date(defaultYear + 1, 5, 1);
  defaultEnd.setDate(defaultEnd.getDate() - 1);

  const [name, setName] = useState(`Річна програма ${defaultYear}`);
  const [startDate, setStartDate] = useState(formatDateInput(defaultStart));
  const [endDate, setEndDate] = useState(formatDateInput(defaultEnd));
  const [makeCurrent, setMakeCurrent] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  // Авто-update name коли користувач змінює startDate (якщо ім'я ще дефолтне).
  useEffect(() => {
    const newYear = new Date(startDate).getFullYear();
    if (Number.isFinite(newYear)) {
      const expectedDefault = `Річна програма ${defaultYear}`;
      if (name === expectedDefault) {
        setName(`Річна програма ${newYear}`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate]);

  async function save() {
    if (saving) return;
    setError(null);
    if (!name.trim()) {
      setError('Назва не може бути порожньою');
      return;
    }
    if (new Date(endDate) <= new Date(startDate)) {
      setError('Дата завершення має бути пізніше дати старту');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/yearly-program/cohorts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
          makeCurrent,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Помилка створення');
        return;
      }
      onCreated(data.id);
      router.refresh();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
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
          <h3 className="text-base font-bold">Створити новий запуск</h3>
          <button onClick={onClose} className={`w-7 h-7 rounded-full flex items-center justify-center ${dark ? 'hover:bg-white/10' : 'hover:bg-stone-100'}`}>✕</button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <Field theme={theme} label="Назва запуску">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls(dark)}
              placeholder="Річна програма 2026"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field theme={theme} label="Дата старту">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={inputCls(dark)}
              />
            </Field>
            <Field theme={theme} label="Дата завершення">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={inputCls(dark)}
              />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-[13px] cursor-pointer">
            <input
              type="checkbox"
              checked={makeCurrent}
              onChange={(e) => setMakeCurrent(e.target.checked)}
              className="rounded"
            />
            <span className={dark ? 'text-slate-300' : 'text-stone-700'}>
              Зробити цей запуск поточним <span className={dark ? 'text-slate-500' : 'text-stone-500'}>(нові оплати потраплятимуть сюди)</span>
            </span>
          </label>

          {error && (
            <div className={`px-3 py-2 rounded-lg text-[12px] ${dark ? 'bg-rose-500/10 text-rose-300 border border-rose-400/20' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
              {error}
            </div>
          )}
        </div>
        <div className={`flex items-center justify-end gap-2 px-5 py-3 border-t ${dark ? 'border-white/10' : 'border-stone-200'}`}>
          <button
            onClick={onClose}
            disabled={saving}
            className={`px-3 py-1.5 rounded-lg text-[12px] ${
              dark ? 'text-slate-300 hover:bg-white/[0.06]' : 'text-stone-700 hover:bg-stone-100'
            }`}
          >
            Скасувати
          </button>
          <button
            onClick={save}
            disabled={saving}
            className={`px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-colors disabled:opacity-50 ${
              dark
                ? 'bg-amber-400/15 text-amber-200 border border-amber-400/30 hover:bg-amber-400/20'
                : 'bg-amber-100 text-amber-900 border border-amber-300/60 hover:bg-amber-200'
            }`}
          >
            {saving ? 'Створюю…' : 'Створити запуск'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function formatDateInput(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function Field({ theme, label, children }: { theme: Theme; label: string; children: React.ReactNode }) {
  const dark = theme === 'dark';
  return (
    <label className="block">
      <span className={`block text-[10px] uppercase tracking-[0.18em] font-medium mb-1 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
        {label}
      </span>
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
