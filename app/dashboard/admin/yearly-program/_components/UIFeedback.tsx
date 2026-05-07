'use client';

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HiOutlineCheckCircle, HiOutlineExclamationTriangle, HiOutlineInformationCircle, HiOutlineXMark } from 'react-icons/hi2';
import type { Theme } from '../../_components/adminTheme';

export type ToastVariant = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  variant: ToastVariant;
  message: string;
}

export interface ConfirmOptions {
  title: string;
  description?: string;
  bullets?: { icon?: string; text: string }[];
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /// Якщо true — показуємо лише confirm-кнопку (info-модалка для помилок/звітів,
  /// де cancel не має сенсу). Resolve все одно повертає true після кліку.
  hideCancel?: boolean;
}

export interface PromptOptions {
  title: string;
  description?: string;
  inputLabel: string;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  multiline?: boolean;
  initialValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface UIFeedbackContextValue {
  toast: (variant: ToastVariant, message: string) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  prompt: (opts: PromptOptions) => Promise<string | null>;
}

const Ctx = createContext<UIFeedbackContextValue | null>(null);

export function useUIFeedback() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useUIFeedback must be used inside <UIFeedbackProvider>');
  return v;
}

export function UIFeedbackProvider({ theme, children }: { theme: Theme; children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const [promptState, setPromptState] = useState<(PromptOptions & { resolve: (v: string | null) => void }) | null>(null);
  const idRef = useRef(0);

  const toast = useCallback((variant: ToastVariant, message: string) => {
    const id = ++idRef.current;
    setToasts((arr) => [...arr, { id, variant, message }]);
    setTimeout(() => {
      setToasts((arr) => arr.filter((t) => t.id !== id));
    }, variant === 'error' ? 7000 : 4500);
  }, []);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ ...opts, resolve });
    });
  }, []);

  const prompt = useCallback((opts: PromptOptions) => {
    return new Promise<string | null>((resolve) => {
      setPromptState({ ...opts, resolve });
    });
  }, []);

  const closeConfirm = useCallback((result: boolean) => {
    setConfirmState((s) => {
      if (s) s.resolve(result);
      return null;
    });
  }, []);

  const closePrompt = useCallback((result: string | null) => {
    setPromptState((s) => {
      if (s) s.resolve(result);
      return null;
    });
  }, []);

  return (
    <Ctx.Provider value={{ toast, confirm, prompt }}>
      {children}
      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((a) => a.filter((t) => t.id !== id))} theme={theme} />
      {confirmState && (
        <ConfirmDialog
          theme={theme}
          options={confirmState}
          onConfirm={() => closeConfirm(true)}
          onCancel={() => closeConfirm(false)}
        />
      )}
      {promptState && (
        <PromptDialog
          theme={theme}
          options={promptState}
          onConfirm={(v) => closePrompt(v)}
          onCancel={() => closePrompt(null)}
        />
      )}
    </Ctx.Provider>
  );
}

function ToastStack({ toasts, onDismiss, theme }: { toasts: ToastItem[]; onDismiss: (id: number) => void; theme: Theme }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted || toasts.length === 0) return null;
  const dark = theme === 'dark';
  return createPortal(
    <div className="fixed top-20 right-5 z-[300] flex flex-col gap-2 max-w-md w-[calc(100vw-2.5rem)] sm:w-auto pointer-events-none">
      {toasts.map((t) => {
        const cfg = variantConfig(t.variant, dark);
        const Icon = cfg.Icon;
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-xl px-4 py-3 shadow-xl border backdrop-blur-md animate-[toastIn_0.18s_ease-out] ${cfg.cls}`}
            role="status"
            aria-live="polite"
          >
            <Icon className={`text-xl shrink-0 mt-0.5 ${cfg.iconCls}`} />
            <div className="flex-1 text-[13px] leading-snug whitespace-pre-line">{t.message}</div>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              aria-label="Закрити"
              className={`shrink-0 -mr-1 -mt-0.5 w-6 h-6 rounded-md flex items-center justify-center ${dark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-black/5 text-stone-500'}`}
            >
              <HiOutlineXMark />
            </button>
          </div>
        );
      })}
      <style>{`@keyframes toastIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>,
    document.body,
  );
}

/// Inline ⓘ-tooltip biла кнопки. Hover/focus = відкрити, leave/blur = закрити.
/// Click — toggle (для touch). Pointer-нейтральний overlay через portal на body, щоб не клікати приховану кнопку.
export function HoverInfo({
  theme,
  title,
  body,
  side = 'bottom',
  align = 'end',
}: {
  theme: Theme;
  title?: string;
  body: React.ReactNode;
  side?: 'top' | 'bottom';
  align?: 'start' | 'center' | 'end';
}) {
  const dark = theme === 'dark';
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const id = useId();

  const place = useCallback(() => {
    const btn = btnRef.current;
    const pop = popRef.current;
    if (!btn || !pop) return;
    const r = btn.getBoundingClientRect();
    const pw = pop.offsetWidth || 280;
    const ph = pop.offsetHeight || 80;
    let top = side === 'top' ? r.top - ph - 8 : r.bottom + 8;
    let left: number;
    if (align === 'start') left = r.left;
    else if (align === 'center') left = r.left + r.width / 2 - pw / 2;
    else left = r.right - pw;
    const margin = 8;
    left = Math.max(margin, Math.min(left, window.innerWidth - pw - margin));
    top = Math.max(margin, Math.min(top, window.innerHeight - ph - margin));
    setCoords({ top: top + window.scrollY, left: left + window.scrollX });
  }, [side, align]);

  useEffect(() => {
    if (!open) return;
    place();
    const onScroll = () => place();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, place]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-describedby={open ? id : undefined}
        aria-label={title ?? 'Підказка'}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => { e.preventDefault(); setOpen((v) => !v); }}
        className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[12px] border transition-colors ${
          dark
            ? 'border-white/15 text-slate-400 hover:bg-white/10 hover:text-amber-300'
            : 'border-stone-300/70 text-stone-500 hover:bg-stone-100 hover:text-amber-800'
        }`}
      >
        <HiOutlineInformationCircle />
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={popRef}
          id={id}
          role="tooltip"
          style={{
            position: 'absolute',
            top: coords?.top ?? -9999,
            left: coords?.left ?? -9999,
            width: 280,
            zIndex: 320,
            opacity: coords ? 1 : 0,
            transition: coords ? 'opacity 0.14s ease-out' : 'none',
          }}
          className={`rounded-xl border shadow-xl px-3.5 py-3 text-[12px] leading-snug pointer-events-none ${
            dark ? 'bg-zinc-800/95 border-white/10 text-slate-200 backdrop-blur-sm' : 'bg-white border-stone-200 text-stone-800'
          }`}
        >
          {title && <div className={`font-semibold mb-1 ${dark ? 'text-amber-300' : 'text-amber-800'}`}>{title}</div>}
          <div className="whitespace-pre-line">{body}</div>
        </div>,
        document.body,
      )}
    </>
  );
}

function variantConfig(v: ToastVariant, dark: boolean) {
  if (v === 'success') {
    return {
      Icon: HiOutlineCheckCircle,
      cls: dark
        ? 'bg-emerald-500/12 border-emerald-400/30 text-emerald-100'
        : 'bg-emerald-50 border-emerald-300/70 text-emerald-900',
      iconCls: dark ? 'text-emerald-300' : 'text-emerald-700',
    };
  }
  if (v === 'error') {
    return {
      Icon: HiOutlineExclamationTriangle,
      cls: dark
        ? 'bg-rose-500/12 border-rose-400/30 text-rose-100'
        : 'bg-rose-50 border-rose-300/70 text-rose-900',
      iconCls: dark ? 'text-rose-300' : 'text-rose-700',
    };
  }
  return {
    Icon: HiOutlineInformationCircle,
    cls: dark
      ? 'bg-slate-700/60 border-white/10 text-slate-100'
      : 'bg-white/95 border-stone-300/70 text-stone-800',
    iconCls: dark ? 'text-amber-300' : 'text-amber-700',
  };
}

function ConfirmDialog({
  theme,
  options,
  onConfirm,
  onCancel,
}: {
  theme: Theme;
  options: ConfirmOptions;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dark = theme === 'dark';
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onConfirm();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onCancel, onConfirm]);
  if (!mounted) return null;

  const destructive = !!options.destructive;
  const confirmLabel = options.confirmLabel ?? (destructive ? 'Підтвердити' : 'Продовжити');
  const cancelLabel = options.cancelLabel ?? 'Скасувати';

  return createPortal(
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 animate-[fadeIn_0.15s_ease-out]" onClick={onCancel} />
      <div
        className={`relative max-w-md w-full rounded-2xl shadow-2xl animate-[dlgIn_0.2s_ease-out] ${
          dark ? 'bg-zinc-900 border border-white/10 text-slate-200' : 'bg-white border border-stone-200 text-stone-800'
        }`}
      >
        <div className={`px-5 pt-5 pb-3 ${options.bullets || options.description ? 'border-b' : ''} ${dark ? 'border-white/10' : 'border-stone-200'}`}>
          <h3 className="text-base font-bold leading-tight">{options.title}</h3>
          {options.description && (
            <p className={`mt-2 text-[13px] leading-snug ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
              {options.description}
            </p>
          )}
        </div>
        {options.bullets && options.bullets.length > 0 && (
          <ul className="px-5 py-4 space-y-2.5">
            {options.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[13px] leading-snug">
                <span className="text-base shrink-0 leading-tight">{b.icon ?? '•'}</span>
                <span className={dark ? 'text-slate-300' : 'text-stone-700'}>{b.text}</span>
              </li>
            ))}
          </ul>
        )}
        <div className={`flex items-center justify-end gap-2 px-5 py-3 ${dark ? 'border-t border-white/10' : 'border-t border-stone-200'}`}>
          {!options.hideCancel && (
            <button
              type="button"
              onClick={onCancel}
              className={`px-3.5 py-2 rounded-lg text-[13px] font-medium ${
                dark ? 'text-slate-300 hover:bg-white/[0.06]' : 'text-stone-700 hover:bg-stone-100'
              }`}
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            autoFocus
            className={`px-4 py-2 rounded-lg text-[13px] font-semibold border transition-colors ${
              destructive
                ? dark
                  ? 'bg-rose-500/15 text-rose-200 border-rose-400/30 hover:bg-rose-500/25'
                  : 'bg-rose-100 text-rose-900 border-rose-300/70 hover:bg-rose-200'
                : dark
                  ? 'bg-amber-400/15 text-amber-200 border-amber-400/30 hover:bg-amber-400/25'
                  : 'bg-amber-100 text-amber-900 border-amber-300/60 hover:bg-amber-200'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
        <style>{`
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes dlgIn { from { opacity: 0; transform: translateY(8px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        `}</style>
      </div>
    </div>,
    document.body,
  );
}

function PromptDialog({
  theme,
  options,
  onConfirm,
  onCancel,
}: {
  theme: Theme;
  options: PromptOptions;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}) {
  const dark = theme === 'dark';
  const [mounted, setMounted] = useState(false);
  const [value, setValue] = useState(options.initialValue ?? '');
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, []);

  const trimmed = value.trim();
  const required = options.required ?? false;
  const minLength = options.minLength ?? (required ? 1 : 0);
  const tooShort = trimmed.length < minLength;
  const error = touched && tooShort
    ? (minLength > 1 ? `Мінімум ${minLength} символів` : 'Поле обов\'язкове')
    : null;
  const canSubmit = !tooShort;

  function submit() {
    setTouched(true);
    if (!canSubmit) {
      inputRef.current?.focus();
      return;
    }
    onConfirm(trimmed);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter' && !options.multiline && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        submit();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  if (!mounted) return null;

  const destructive = !!options.destructive;
  const confirmLabel = options.confirmLabel ?? (destructive ? 'Підтвердити' : 'OK');
  const cancelLabel = options.cancelLabel ?? 'Скасувати';

  const inputClasses = `w-full rounded-lg border px-3 py-2 text-[13px] outline-none transition-colors ${
    error
      ? dark
        ? 'bg-rose-500/5 border-rose-400/50 text-rose-100 focus:border-rose-400'
        : 'bg-rose-50 border-rose-300 text-rose-900 focus:border-rose-400'
      : dark
        ? 'bg-white/[0.04] border-white/10 text-slate-100 focus:border-amber-400/60'
        : 'bg-white border-stone-300 text-stone-800 focus:border-amber-400'
  }`;

  return createPortal(
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 animate-[fadeIn_0.15s_ease-out]" onClick={onCancel} />
      <div
        className={`relative max-w-md w-full rounded-2xl shadow-2xl animate-[dlgIn_0.2s_ease-out] ${
          dark ? 'bg-zinc-900 border border-white/10 text-slate-200' : 'bg-white border border-stone-200 text-stone-800'
        }`}
      >
        <div className={`px-5 pt-5 pb-3 ${dark ? 'border-b border-white/10' : 'border-b border-stone-200'}`}>
          <h3 className="text-base font-bold leading-tight">{options.title}</h3>
          {options.description && (
            <p className={`mt-2 text-[13px] leading-snug ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
              {options.description}
            </p>
          )}
        </div>
        <div className="px-5 py-4">
          <label className={`block text-[12px] font-semibold mb-1.5 ${dark ? 'text-slate-300' : 'text-stone-700'}`}>
            {options.inputLabel}
            {required && <span className={`ml-1 ${dark ? 'text-rose-300' : 'text-rose-600'}`}>*</span>}
          </label>
          {options.multiline ? (
            <textarea
              ref={(el) => { inputRef.current = el; }}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder={options.placeholder}
              rows={4}
              className={inputClasses}
            />
          ) : (
            <input
              ref={(el) => { inputRef.current = el; }}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder={options.placeholder}
              className={inputClasses}
            />
          )}
          {error && (
            <p className={`mt-1.5 text-[12px] ${dark ? 'text-rose-300' : 'text-rose-600'}`}>{error}</p>
          )}
        </div>
        <div className={`flex items-center justify-end gap-2 px-5 py-3 ${dark ? 'border-t border-white/10' : 'border-t border-stone-200'}`}>
          <button
            type="button"
            onClick={onCancel}
            className={`px-3.5 py-2 rounded-lg text-[13px] font-medium ${
              dark ? 'text-slate-300 hover:bg-white/[0.06]' : 'text-stone-700 hover:bg-stone-100'
            }`}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={touched && !canSubmit}
            className={`px-4 py-2 rounded-lg text-[13px] font-semibold border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              destructive
                ? dark
                  ? 'bg-rose-500/15 text-rose-200 border-rose-400/30 hover:bg-rose-500/25'
                  : 'bg-rose-100 text-rose-900 border-rose-300/70 hover:bg-rose-200'
                : dark
                  ? 'bg-amber-400/15 text-amber-200 border-amber-400/30 hover:bg-amber-400/25'
                  : 'bg-amber-100 text-amber-900 border-amber-300/60 hover:bg-amber-200'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
        <style>{`
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes dlgIn { from { opacity: 0; transform: translateY(8px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        `}</style>
      </div>
    </div>,
    document.body,
  );
}
