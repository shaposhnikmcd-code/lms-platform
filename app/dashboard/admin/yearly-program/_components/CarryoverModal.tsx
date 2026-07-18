'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { HiOutlineCheck, HiOutlineExclamationTriangle } from 'react-icons/hi2';
import type { Theme } from '../../_components/adminTheme';
import type { Row } from './types';
import { useUIFeedback } from './UIFeedback';

/// Модалка «🔄 Перенесення з минулого року» для ІСНУЮЧОЇ підписки (студент заведений вручну
/// в режимі «Очікує оплату», платежів ще немає). Фіксує Payment 0 ₴ (manualMethod='carryover'),
/// переводить план у YEARLY і активує доступ — POST action:'carryover'.
/// Чекбокс welcome-листа дефолтом ON; менеджер знімає його, якщо студент уже в каналі.
export default function CarryoverModal({
  row,
  theme,
  onClose,
  onDone,
}: {
  row: Row;
  theme: Theme;
  onClose: () => void;
  onDone: () => void;
}) {
  const dark = theme === 'dark';
  const { toast } = useUIFeedback();
  const [mounted, setMounted] = useState(false);
  const [note, setNote] = useState('');
  const [sendWelcome, setSendWelcome] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/yearly-program/${row.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'carryover', note: note.trim(), sendWelcome }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? res.statusText);
        return;
      }
      const em = row.userEmail ?? row.userName ?? 'студента';
      const launched = !!data.cohortLaunched;
      let suffix = '';
      if (launched && data.extraLaunch && data.extraLaunch.ok === false) {
        suffix += ` · ⚠ відкриття доступу: ${data.extraLaunch.reason ?? 'помилка'}`;
      }
      if (!launched && sendWelcome) {
        if (data.welcome?.welcomeSent) suffix += ' · welcome-лист надіслано';
        else if (data.welcome?.welcomeSkipped) suffix += ' · ⚠ лист не надіслано (мейлер off)';
      }
      toast('success', launched
        ? `Студента ${em} перенесено · доступ відкрито${suffix}`
        : `Студента ${em} перенесено · активовано, креди на запуску${suffix}`);
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
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-3" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={`relative w-full max-h-[94vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden ${
          dark ? 'bg-zinc-950 border border-white/10 text-slate-200' : 'bg-stone-100 border border-stone-200 text-stone-800'
        }`}
        style={{ maxWidth: 'min(520px, 96vw)' }}
      >
        {/* HEADER */}
        <header className={`shrink-0 flex items-center justify-between px-6 py-4 border-b ${
          dark ? 'bg-zinc-900/95 border-white/10' : 'bg-white/95 border-stone-200'
        }`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-[18px] ${
              dark ? 'bg-violet-400/15 text-violet-300 border border-violet-400/30' : 'bg-violet-100 text-violet-800 border border-violet-300/60'
            }`}>
              🔄
            </div>
            <div className="min-w-0">
              <h3 className="text-[16px] font-bold leading-tight">Перенесення з минулого року</h3>
              <p className={`text-[11.5px] leading-tight mt-0.5 truncate ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
                {row.userEmail ?? row.userName ?? '—'}
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
            dark ? 'bg-violet-500/[0.06] border-violet-400/20 text-violet-100/90' : 'bg-violet-50/70 border-violet-200/70 text-violet-900'
          }`}>
            <span className="shrink-0">🔄</span>
            <span>
              Студент оплатив минулорічний набір. Створимо платіж <b>0 ₴</b> — <b>дохід не змінюється</b>,
              доступ відкриється як у Річного (план стане «Річний», без автосписання).
            </span>
          </div>

          <div>
            <label className={`block text-[11px] uppercase tracking-wider font-medium mb-1.5 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
              Коментар (опціонально)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Напр.: сплачувала 3.0 у 2025"
              autoFocus
              className={`w-full px-3 py-2 rounded-lg border text-[13px] outline-none transition-colors resize-none ${
                dark
                  ? 'bg-zinc-800 border-white/10 text-slate-100 focus:border-violet-400/40'
                  : 'bg-white border-stone-300 text-stone-900 focus:border-violet-400'
              }`}
            />
          </div>

          <label className={`flex items-start gap-2.5 px-4 py-3 rounded-xl border cursor-pointer transition-colors ${
            dark ? 'bg-zinc-900/60 border-white/10 hover:bg-white/[0.04]' : 'bg-white border-stone-300 hover:bg-stone-50'
          }`}>
            <input
              type="checkbox"
              checked={sendWelcome}
              onChange={(e) => setSendWelcome(e.target.checked)}
              className="mt-0.5 accent-violet-500"
            />
            <span className="min-w-0">
              <span className="block text-[12.5px] font-semibold">Надіслати welcome-лист з TG-запрошенням</span>
              <span className={`block text-[11px] mt-0.5 leading-relaxed ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
                Вимкни, якщо студент уже отримав запрошення або вже в каналі
              </span>
            </span>
          </label>

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
            disabled={submitting}
            className={`inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-[13px] font-bold border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              dark
                ? 'bg-violet-500/15 text-violet-200 border-violet-400/30 hover:bg-violet-500/25'
                : 'bg-violet-50 text-violet-900 border-violet-300/60 hover:bg-violet-100'
            }`}
          >
            <HiOutlineCheck className="text-[14px]" />
            {submitting ? 'Переношу…' : 'Перенести'}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
