'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { FaEye, FaEyeSlash, FaPause } from 'react-icons/fa';
import type { Theme } from '../../_components/adminTheme';
import InlineDateTimePicker, {
  localInputToIso,
  nowLocalInput,
  formatLocalChip,
} from '../../_components/InlineDateTimePicker';

type Result = {
  published: boolean;
  suspendedAt: string | null;
  resumeAt: string | null;
};

type StatusKey = 'visible' | 'suspended' | 'draft';
type Position = { top: number; left: number };

const STATUS_META: Record<
  StatusKey,
  {
    /// Назва стану (показується на pill-кнопці).
    label: string;
    /// Дієслово-дія (показується у випадайці — що станеться при кліку).
    action: string;
    iconKey: 'eye' | 'pause' | 'eyeSlash';
    dark: string;
    light: string;
  }
> = {
  visible: {
    label: 'Опубліковано',
    action: 'Опублікувати',
    iconKey: 'eye',
    dark: 'bg-emerald-500/10 text-emerald-200 border-emerald-400/25',
    light: 'bg-emerald-200/40 text-emerald-800 border-emerald-500/30',
  },
  suspended: {
    label: 'Призупинено',
    action: 'Призупинити',
    iconKey: 'pause',
    dark: 'bg-amber-500/10 text-amber-200 border-amber-400/25',
    light: 'bg-amber-200/40 text-amber-900 border-amber-500/40',
  },
  draft: {
    label: 'Чернетка',
    action: 'У чернетку',
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
  // Локальний draft у форматі YYYY-MM-DDTHH:mm.
  const [dt, setDt] = useState('');

  // «Зараз призупинена» = suspendedAt у минулому/зараз і ще немає resume.
  // Якщо suspendedAt у майбутньому — це заплановане призупинення, новина все ще видима.
  const now = new Date();
  const activeSuspension =
    !!suspendedAt &&
    new Date(suspendedAt) <= now &&
    (!resumeAt || new Date(resumeAt) > now);
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

  // Призупинити: dt порожнє → миттєво (suspendedAt=now). dt задане → запланувати (suspendedAt=dt).
  const confirmSuspend = async () => {
    const dtISO = localInputToIso(dt);
    const suspendedISO = dtISO ?? new Date().toISOString();
    setBusy(true);
    try {
      const res = await patch({
        published: true,
        suspendedAt: suspendedISO,
        resumeAt: null,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err?.error || 'Не вдалося');
        return;
      }
      onChange?.({ published: true, suspendedAt: suspendedISO, resumeAt: null });
      router.refresh();
      setShowSuspendModal(false);
      setDt('');
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
            <div
              className={`absolute rounded-xl border shadow-2xl p-2 animate-[slideDown_120ms_ease-out] origin-top ${
                dark ? 'bg-[#14161d] border-white/[0.1]' : 'bg-[#fbf7ec] border-stone-300/60'
              }`}
              style={{ top: pos.top, left: pos.left, width: 156 }}
              onClick={e => e.stopPropagation()}
            >
              <p
                className={`text-[9px] uppercase tracking-[0.18em] font-semibold mb-1.5 px-1 ${
                  dark ? 'text-slate-500' : 'text-stone-500'
                }`}
              >
                Змінити на
              </p>
              <ul role="listbox" className="list-none flex flex-col gap-1">
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
                          className={`w-full inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-full text-[11px] font-medium border transition-all hover:shadow-md active:scale-[0.97] disabled:opacity-60 ${
                            dark ? meta.dark : meta.light
                          }`}
                        >
                          {renderIcon(meta.iconKey)}
                          {meta.action}
                        </button>
                      </li>
                    );
                  })}
              </ul>
            </div>
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
                setDt('');
              }
            }}
          >
            <div
              className={`rounded-2xl p-6 w-full max-w-md mx-4 border shadow-2xl ${
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
              <p className={`text-sm mb-4 ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
                Призупинити зараз — або обрати час, з якого новина має зникнути з вітрини. До
                цього часу вона залишається опублікованою.
              </p>
              <InlineDateTimePicker
                value={dt}
                onChange={setDt}
                theme={theme}
                min={nowLocalInput()}
              />
              <div
                className={`mt-3 mb-4 rounded-lg border px-3 py-2 ${
                  dark
                    ? 'bg-amber-400/[0.05] border-amber-400/20'
                    : 'bg-amber-100/40 border-amber-500/30'
                }`}
              >
                <p
                  className={`text-[9px] uppercase tracking-[0.2em] font-semibold mb-1 ${
                    dark ? 'text-amber-200/70' : 'text-amber-900/70'
                  }`}
                >
                  Призупиниться
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={dt ? () => setDt('') : undefined}
                    disabled={!dt}
                    title={dt ? 'Стерти час' : undefined}
                    aria-label={dt ? 'Стерти час' : undefined}
                    className={`group inline-flex items-center justify-center w-4 h-4 rounded-full flex-shrink-0 text-[9px] font-bold leading-none transition-colors ${
                      dt
                        ? dark
                          ? 'bg-emerald-500/90 text-white hover:bg-rose-500/90'
                          : 'bg-emerald-600 text-white hover:bg-rose-600'
                        : dark
                        ? 'bg-white/[0.06] text-slate-600 border border-white/[0.08] cursor-default'
                        : 'bg-white/60 text-stone-400 border border-stone-300/60 cursor-default'
                    }`}
                  >
                    {dt ? (
                      <>
                        <span className="group-hover:hidden">✓</span>
                        <span className="hidden group-hover:inline">✕</span>
                      </>
                    ) : (
                      '○'
                    )}
                  </button>
                  <span
                    className={`text-[11.5px] truncate ${
                      dt
                        ? dark
                          ? 'text-slate-100 font-medium'
                          : 'text-stone-900 font-medium'
                        : dark
                        ? 'text-slate-500 italic'
                        : 'text-stone-500 italic'
                    }`}
                  >
                    {dt ? formatLocalChip(dt) : 'призупинити зараз'}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowSuspendModal(false);
                    setDt('');
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
                  {busy ? '...' : dt ? 'Запланувати' : 'Призупинити зараз'}
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
