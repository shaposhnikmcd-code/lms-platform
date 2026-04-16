'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Theme } from '../../_components/adminTheme';

export const CATEGORY_LABELS: Record<string, string> = {
  NEWS: 'Новини',
  ANNOUNCEMENT: 'Оголошення',
  ARTICLE: 'Стаття',
  EVENT: 'Подія',
};

const CATEGORIES = ['NEWS', 'ANNOUNCEMENT', 'ARTICLE', 'EVENT'] as const;

export function categoryClass(cat: string, dark: boolean): string {
  const map: Record<string, { dark: string; light: string }> = {
    NEWS: {
      dark: 'bg-sky-500/10 text-sky-200 border-sky-400/25',
      light: 'bg-sky-200/40 text-sky-800 border-sky-500/30',
    },
    ANNOUNCEMENT: {
      dark: 'bg-amber-500/10 text-amber-200 border-amber-400/25',
      light: 'bg-amber-200/40 text-amber-800 border-amber-500/30',
    },
    ARTICLE: {
      dark: 'bg-violet-500/10 text-violet-200 border-violet-400/25',
      light: 'bg-violet-200/40 text-violet-800 border-violet-500/30',
    },
    EVENT: {
      dark: 'bg-rose-500/10 text-rose-200 border-rose-400/25',
      light: 'bg-rose-200/40 text-rose-800 border-rose-500/30',
    },
  };
  const m = map[cat] ?? {
    dark: 'bg-white/[0.04] text-slate-300 border-white/[0.08]',
    light: 'bg-stone-100/80 text-stone-700 border-stone-300/60',
  };
  return dark ? m.dark : m.light;
}

type Position = { top: number; left: number };

export default function CategoryPicker({
  current,
  theme,
  onChange,
}: {
  current: string;
  theme: Theme;
  onChange: (next: string) => void | Promise<void>;
}) {
  const dark = theme === 'dark';
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<Position>({ top: 0, left: 0 });
  const [busy, setBusy] = useState(false);

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (!r) return;
      setPos({ top: r.bottom + 6, left: r.left });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const handlePick = async (cat: string) => {
    if (cat === current || busy) {
      setOpen(false);
      return;
    }
    setBusy(true);
    try {
      await onChange(cat);
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={e => {
          e.stopPropagation();
          if (!busy) setOpen(v => !v);
        }}
        disabled={busy}
        title="Змінити категорію"
        className={`inline-flex items-center justify-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium border w-[110px] transition-all hover:shadow-sm active:scale-[0.97] disabled:opacity-60 ${categoryClass(
          current,
          dark,
        )} ${open ? (dark ? 'ring-2 ring-amber-400/40' : 'ring-2 ring-amber-500/40') : ''}`}
      >
        <span className="flex-1">{CATEGORY_LABELS[current] ?? current}</span>
        <svg
          className={`w-2 h-2 opacity-70 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden
        >
          <path
            d="M3 4.5 L6 7.5 L9 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open &&
        mounted &&
        createPortal(
          <div className="fixed inset-0 z-[100]" onClick={() => setOpen(false)}>
            <ul
              role="listbox"
              className="absolute list-none flex flex-col gap-1 animate-[slideDown_120ms_ease-out] origin-top"
              style={{ top: pos.top, left: pos.left, width: 110 }}
              onClick={e => e.stopPropagation()}
            >
              {CATEGORIES.filter(cat => cat !== current).map(cat => (
                <li key={cat}>
                  <button
                    type="button"
                    role="option"
                    onClick={() => handlePick(cat)}
                    disabled={busy}
                    className={`w-full px-2 py-1 rounded-full text-[11px] font-medium border shadow-md transition-all hover:shadow-lg active:scale-[0.97] disabled:opacity-60 ${categoryClass(
                      cat,
                      dark,
                    )}`}
                  >
                    {CATEGORY_LABELS[cat]}
                  </button>
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )}

      <style jsx>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
}
