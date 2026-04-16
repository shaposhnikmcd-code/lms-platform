'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { FaEye, FaEyeSlash, FaPause } from 'react-icons/fa';
import type { Theme } from '../../_components/adminTheme';

type Result = {
  published: boolean;
  suspendedAt: string | null;
  resumeAt: string | null;
};

type StatusKey = 'visible' | 'suspended' | 'draft';
type Position = { top: number; left: number };

const STATUS_META: Record<
  StatusKey,
  { label: string; iconKey: 'eye' | 'pause' | 'eyeSlash'; dark: string; light: string }
> = {
  visible: {
    label: 'Опубліковано',
    iconKey: 'eye',
    dark: 'bg-emerald-500/10 text-emerald-200 border-emerald-400/25',
    light: 'bg-emerald-200/40 text-emerald-800 border-emerald-500/30',
  },
  suspended: {
    label: 'Призупинено',
    iconKey: 'pause',
    dark: 'bg-amber-500/10 text-amber-200 border-amber-400/25',
    light: 'bg-amber-200/40 text-amber-900 border-amber-500/40',
  },
  draft: {
    label: 'Чернетка',
    iconKey: 'eyeSlash',
    dark: 'bg-white/[0.04] text-slate-300 border-white/[0.08]',
    light: 'bg-stone-100/80 text-stone-700 border-stone-300/60',
  },
};

function renderIcon(key: 'eye' | 'pause' | 'eyeSlash') {
  if (key === 'eye') return <FaEye className="text-[9px]" />;
  if (key === 'pause') return <FaPause className="text-[9px]" />;
  return <FaEyeSlash className="text-[9px]" />;
}

export default function StatusPicker({
  newsId,
  published,
  suspendedAt,
  resumeAt,
  theme,
  onChange,
}: {
  newsId: string;
  published: boolean;
  suspendedAt: string | null;
  resumeAt: string | null;
  theme: Theme;
  onChange?: (r: Result) => void;
}) {
  const router = useRouter();
  const dark = theme === 'dark';
  const btnRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Position>({ top: 0, left: 0 });
  const [busy, setBusy] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [date, setDate] = useState('');

  const activeSuspension =
    !!suspendedAt && (!resumeAt || new Date(resumeAt) > new Date());
  const current: StatusKey = !published ? 'draft' : activeSuspension ? 'suspended' : 'visible';

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

  const patch = (data: Record<string, unknown>) =>
    fetch(`/api/admin/news/${newsId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include',
    });

  const applyChange = async (payload: Record<string, unknown>, result: Result) => {
    setBusy(true);
    try {
      const res = await patch(payload);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err?.error || 'Не вдалося');
        return;
      }
      onChange?.(result);
      router.refresh();
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  const makePublished = () =>
    applyChange(
      { published: true, suspendedAt: null, resumeAt: null },
      { published: true, suspendedAt: null, resumeAt: null },
    );

  const makeDraft = () =>
    applyChange(
      { published: false, suspendedAt: null, resumeAt: null },
      { published: false, suspendedAt: null, resumeAt: null },
    );

  const openSuspendModal = () => {
    setOpen(false);
    setShowSuspendModal(true);
  };

  const confirmSuspend = async () => {
    const suspendedISO = new Date().toISOString();
    const resumeISO = date ? new Date(date).toISOString() : null;
    setBusy(true);
    try {
      const res = await patch({
        published: true,
        suspendedAt: suspendedISO,
        resumeAt: resumeISO,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err?.error || 'Не вдалося');
        return;
      }
      onChange?.({ published: true, suspendedAt: suspendedISO, resumeAt: resumeISO });
      router.refresh();
      setShowSuspendModal(false);
      setDate('');
    } finally {
      setBusy(false);
    }
  };

  const onOptionClick = (key: StatusKey) => {
    if (key === current) {
      setOpen(false);
      return;
    }
    if (key === 'visible') makePublished();
    else if (key === 'suspended') openSuspendModal();
    else makeDraft();
  };

  const cur = STATUS_META[current];
  const curCls = dark ? cur.dark : cur.light;

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
        title="Змінити статус"
        className={`inline-flex items-center justify-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium border w-[130px] transition-all hover:shadow-sm active:scale-[0.97] disabled:opacity-60 ${curCls} ${
          open ? (dark ? 'ring-2 ring-amber-400/40' : 'ring-2 ring-amber-500/40') : ''
        }`}
      >
        {renderIcon(cur.iconKey)}
        <span className="flex-1">{cur.label}</span>
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
              style={{ top: pos.top, left: pos.left, width: 130 }}
              onClick={e => e.stopPropagation()}
            >
              {(['visible', 'suspended', 'draft'] as StatusKey[])
                .filter(key => key !== current)
                .map(key => {
                  const meta = STATUS_META[key];
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        role="option"
                        onClick={() => onOptionClick(key)}
                        disabled={busy}
                        className={`w-full inline-flex items-center justify-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium border shadow-md transition-all hover:shadow-lg active:scale-[0.97] disabled:opacity-60 ${
                          dark ? meta.dark : meta.light
                        }`}
                      >
                        {renderIcon(meta.iconKey)}
                        {meta.label}
                      </button>
                    </li>
                  );
                })}
            </ul>
          </div>,
          document.body,
        )}

      {showSuspendModal &&
        mounted &&
        createPortal(
          <div
            className={`fixed inset-0 flex items-center justify-center z-[100] backdrop-blur-sm ${
              dark ? 'bg-black/60' : 'bg-stone-900/30'
            }`}
            onClick={() => {
              if (!busy) {
                setShowSuspendModal(false);
                setDate('');
              }
            }}
          >
            <div
              className={`rounded-2xl p-6 w-full max-w-sm mx-4 border shadow-2xl ${
                dark ? 'bg-[#14161d] border-white/[0.08]' : 'bg-[#fbf7ec] border-stone-300/60'
              }`}
              onClick={e => e.stopPropagation()}
            >
              <h3
                className={`text-lg font-semibold mb-1 ${
                  dark ? 'text-slate-100' : 'text-stone-900'
                }`}
              >
                Призупинити новину
              </h3>
              <p className={`text-sm mb-5 ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
                Новина зникне з вітрини. Можна задати дату автоматичного повернення.
              </p>
              <label
                className={`block text-[12px] font-medium mb-1.5 ${
                  dark ? 'text-slate-300' : 'text-stone-700'
                }`}
              >
                Повернути автоматично (необовʼязково)
              </label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                onClick={e => (e.target as HTMLInputElement).showPicker()}
                className={`w-full rounded-lg px-3 py-2 text-sm mb-5 cursor-pointer focus:outline-none focus:ring-2 border ${
                  dark
                    ? 'bg-white/[0.04] border-white/[0.08] text-slate-100 focus:ring-amber-400/40 focus:border-amber-400/40 [color-scheme:dark]'
                    : 'bg-white/80 border-stone-300/60 text-stone-900 focus:ring-amber-500/40 focus:border-amber-500/50'
                }`}
              />
              {date && (
                <p className={`text-[11px] mb-4 -mt-3 ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
                  Новина повернеться на вітрину{' '}
                  <span className={`font-semibold ${dark ? 'text-slate-200' : 'text-stone-900'}`}>
                    {new Date(date).toLocaleDateString('uk-UA')}
                  </span>
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowSuspendModal(false);
                    setDate('');
                  }}
                  disabled={busy}
                  className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-xl border transition-colors disabled:opacity-50 ${
                    dark
                      ? 'bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.08]'
                      : 'bg-white/70 border-stone-300/60 text-stone-700 hover:bg-white'
                  }`}
                >
                  Скасувати
                </button>
                <button
                  onClick={confirmSuspend}
                  disabled={busy}
                  className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 ${
                    dark
                      ? 'bg-amber-400/90 text-stone-900 hover:bg-amber-300 shadow-[0_0_18px_-4px_rgba(251,191,36,0.5)]'
                      : 'bg-amber-600 text-white hover:bg-amber-700 shadow-sm'
                  }`}
                >
                  {busy ? '...' : 'Призупинити'}
                </button>
              </div>
            </div>
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
