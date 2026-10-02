'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Theme } from '../../_components/adminTheme';

/// Вікно з персональним посиланням на оплату модуля. Адміністраторка не технічна:
/// мовчазне копіювання в буфер їй нічого не пояснює, тому показуємо посилання, що з ним
/// робити, і явну кнопку «Скопіювати посилання». Нічого не копіюється саме при відкритті.
export default function RenewLinkModal({
  theme,
  studentLabel,
  url,
  moduleNumber,
  moduleTotal,
  expiresAt,
  onClose,
}: {
  theme: Theme;
  studentLabel: string;
  url: string;
  moduleNumber?: number;
  moduleTotal?: number;
  expiresAt?: string;
  onClose: () => void;
}) {
  const dark = theme === 'dark';
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopyFailed(false);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyFailed(true);
      inputRef.current?.select();
    }
  }

  if (!mounted) return null;

  const until = expiresAt ? new Date(expiresAt) : null;
  const untilText = until && !Number.isNaN(until.getTime())
    ? until.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null;
  const hasModule = typeof moduleNumber === 'number' && typeof moduleTotal === 'number';
  const muted = dark ? 'text-slate-400' : 'text-stone-500';

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={`relative w-full max-h-[94vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden ${
          dark ? 'bg-zinc-950 border border-white/10 text-slate-200' : 'bg-stone-100 border border-stone-200 text-stone-800'
        }`}
        style={{ maxWidth: 'min(480px, 96vw)' }}
      >
        <header className={`shrink-0 flex items-center justify-between px-5 py-3 border-b ${
          dark ? 'bg-zinc-900/95 border-white/10' : 'bg-white/95 border-stone-200'
        }`}>
          <h3 className="text-[16px] font-bold leading-tight">🔗 Посилання на оплату модуля</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрити"
            className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[14px] cursor-pointer transition-colors ${
              dark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-stone-200 text-stone-500'
            }`}
          >✕</button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <div className="text-[13px] leading-snug">
            <div className="font-semibold break-words">{studentLabel}</div>
            <div className={muted}>
              {hasModule ? `Модуль ${moduleNumber} з ${moduleTotal}` : null}
              {hasModule && untilText ? ' · ' : null}
              {untilText ? `Посилання дійсне до ${untilText}` : null}
            </div>
          </div>

          <p className="text-[13px] leading-relaxed">
            Надішліть це посилання студенту — у Telegram, Viber або листом. Студент відкриє його, обере, скільки модулів
            оплатити, або підключить автоплатіж. Оплата зарахується йому автоматично.
          </p>

          <input
            ref={inputRef}
            type="text"
            readOnly
            value={url}
            onClick={(e) => e.currentTarget.select()}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Посилання на оплату"
            className={`w-full h-10 px-3 rounded-lg border text-[12.5px] font-mono truncate ${
              dark ? 'bg-zinc-900 border-white/15 text-slate-200' : 'bg-white border-stone-300 text-stone-800'
            }`}
          />

          <button
            type="button"
            onClick={copy}
            className={`w-full h-12 rounded-xl text-[15px] font-bold cursor-pointer transition-colors ${
              copied
                ? (dark ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/40' : 'bg-emerald-100 text-emerald-800 border border-emerald-300')
                : (dark ? 'bg-amber-400 text-zinc-900 hover:bg-amber-300' : 'bg-amber-500 text-white hover:bg-amber-600')
            }`}
          >
            {copied ? '✓ Скопійовано' : 'Скопіювати посилання'}
          </button>
          {copyFailed && (
            <p className={`text-[12px] ${dark ? 'text-amber-300' : 'text-amber-700'}`}>Виділіть посилання і скопіюйте вручну</p>
          )}
        </div>

        <footer className={`shrink-0 flex justify-end px-5 py-3 border-t ${
          dark ? 'bg-zinc-900/95 border-white/10' : 'bg-white/95 border-stone-200'
        }`}>
          <button
            type="button"
            onClick={onClose}
            className={`h-10 px-5 rounded-lg text-[13px] font-semibold cursor-pointer border transition-colors ${
              dark ? 'border-white/15 hover:bg-white/10' : 'border-stone-300 hover:bg-stone-200'
            }`}
          >Закрити</button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
