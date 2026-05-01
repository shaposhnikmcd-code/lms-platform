'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { HiOutlineClock } from 'react-icons/hi2';
import { FaXmark } from 'react-icons/fa6';
import type { Theme } from '../../_components/adminTheme';
import InlineDateTimePicker, {
  isoToLocalInput,
  localInputToIso,
  nowLocalInput,
  formatLocalChip,
} from '../../_components/InlineDateTimePicker';

type Result = {
  published: boolean;
  suspendedAt: string | null;
  resumeAt: string | null;
};

interface Props {
  newsId: string;
  published: boolean;
  suspendedAt: string | null;
  resumeAt: string | null;
  theme: Theme;
  onChange?: (r: Result) => void;
}

/// Pill із зображенням майбутнього таймера (заплановане призупинення АБО заплановане
/// поновлення). Клік — модалка для зміни/стирання таймера.
///
/// Розрізнення:
/// - suspendedAt у майбутньому → "Призупиниться" (редагуємо suspendedAt)
/// - suspendedAt у минулому/null + resumeAt у майбутньому → "Опублікується" (редагуємо resumeAt)
export default function ScheduledTimerPill({
  newsId,
  published,
  suspendedAt,
  resumeAt,
  theme,
  onChange,
}: Props) {
  const router = useRouter();
  const dark = theme === 'dark';
  const [open, setOpen] = useState(false);
  const [dt, setDt] = useState('');
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const now = new Date();
  const futureSuspend = !!suspendedAt && new Date(suspendedAt) > now;
  const futureResume =
    !futureSuspend && !!resumeAt && new Date(resumeAt) > now;

  // Який режим: 'suspend' (буде призупинено) | 'resume' (буде опубліковано/відновлено)
  const kind: 'suspend' | 'resume' | null = futureSuspend
    ? 'suspend'
    : futureResume
    ? 'resume'
    : null;

  if (!kind) return null;

  const targetISO = kind === 'suspend' ? suspendedAt! : resumeAt!;
  const labelTop = kind === 'suspend' ? 'Призупиниться' : 'Опублікується';

  const openModal = () => {
    setDt(isoToLocalInput(targetISO));
    setOpen(true);
  };
  const closeModal = () => {
    setOpen(false);
    setDt('');
  };

  const patch = (data: Record<string, unknown>) =>
    fetch(`/api/admin/news/${newsId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include',
    });

  const onSave = async () => {
    const newISO = localInputToIso(dt);
    if (!newISO) return;
    setBusy(true);
    try {
      const payload =
        kind === 'suspend' ? { suspendedAt: newISO } : { resumeAt: newISO };
      const res = await patch(payload);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err?.error || 'Не вдалося зберегти');
        return;
      }
      onChange?.({
        published,
        suspendedAt: kind === 'suspend' ? newISO : suspendedAt,
        resumeAt: kind === 'resume' ? newISO : resumeAt,
      });
      router.refresh();
      closeModal();
    } finally {
      setBusy(false);
    }
  };

  // Стерти таймер:
  // - 'suspend' kind: clear suspendedAt → новина лишається опублікованою без заплановоного призупинення
  // - 'resume' kind: clear resumeAt → новина лишається призупиненою (без автоповернення)
  const onClear = async () => {
    setBusy(true);
    try {
      const payload =
        kind === 'suspend' ? { suspendedAt: null } : { resumeAt: null };
      const res = await patch(payload);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err?.error || 'Не вдалося');
        return;
      }
      onChange?.({
        published,
        suspendedAt: kind === 'suspend' ? null : suspendedAt,
        resumeAt: kind === 'resume' ? null : resumeAt,
      });
      router.refresh();
      closeModal();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        title="Змінити або стерти таймер"
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10.5px] font-medium border whitespace-nowrap transition-colors ${
          dark
            ? 'bg-amber-500/10 text-amber-200 border-amber-400/25 hover:bg-amber-500/20'
            : 'bg-amber-200/40 text-amber-900 border-amber-500/40 hover:bg-amber-200/70'
        }`}
      >
        <HiOutlineClock className="text-[12px] flex-shrink-0" />
        <span className="flex flex-col leading-tight text-left">
          <span className="text-[8.5px] uppercase tracking-[0.14em] opacity-75">
            {labelTop}
          </span>
          <span className="tabular-nums">
            {new Date(targetISO).toLocaleString('uk-UA', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </span>
      </button>

      {open &&
        mounted &&
        createPortal(
          <div
            className={`fixed inset-0 flex items-center justify-center z-[100] backdrop-blur-sm ${
              dark ? 'bg-black/60' : 'bg-stone-900/30'
            }`}
            onClick={() => !busy && closeModal()}
          >
            <div
              className={`rounded-2xl p-6 w-full max-w-md mx-4 border shadow-2xl ${
                dark ? 'bg-[#14161d] border-white/[0.08]' : 'bg-[#fbf7ec] border-stone-300/60'
              }`}
              onClick={e => e.stopPropagation()}
            >
              <h3 className={`text-lg font-semibold mb-1 ${dark ? 'text-slate-100' : 'text-stone-900'}`}>
                {kind === 'suspend' ? 'Заплановане призупинення' : 'Запланована публікація'}
              </h3>
              <p className={`text-sm mb-4 ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
                {kind === 'suspend'
                  ? 'Змініть час або стерти таймер — тоді новина лишиться опублікованою без призупинення.'
                  : 'Змініть час або стерти таймер — тоді новина залишиться прихованою, поки ви не ввімкнете її вручну.'}
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
                  Новий час
                </p>
                <span
                  className={`text-[11.5px] truncate block ${
                    dt
                      ? dark
                        ? 'text-slate-100 font-medium'
                        : 'text-stone-900 font-medium'
                      : dark
                      ? 'text-slate-500 italic'
                      : 'text-stone-500 italic'
                  }`}
                >
                  {dt ? formatLocalChip(dt) : 'не задано'}
                </span>
              </div>
              <div className="flex gap-2 items-center">
                <button
                  type="button"
                  onClick={onClear}
                  disabled={busy}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium rounded-xl border transition-colors disabled:opacity-50 ${
                    dark
                      ? 'bg-rose-500/10 text-rose-200 border-rose-400/30 hover:bg-rose-500/20'
                      : 'bg-rose-100/60 text-rose-700 border-rose-400/50 hover:bg-rose-100'
                  }`}
                >
                  <FaXmark className="text-[10px]" />
                  Стерти таймер
                </button>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={busy}
                  className={`px-4 py-2 text-sm font-medium rounded-xl border transition-colors disabled:opacity-50 ${
                    dark
                      ? 'bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.08]'
                      : 'bg-white/70 border-stone-300/60 text-stone-700 hover:bg-white'
                  }`}
                >
                  Скасувати
                </button>
                <button
                  type="button"
                  onClick={onSave}
                  disabled={busy || !dt}
                  className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 ${
                    dark
                      ? 'bg-amber-400/90 text-stone-900 hover:bg-amber-300 shadow-[0_0_18px_-4px_rgba(251,191,36,0.5)]'
                      : 'bg-amber-600 text-white hover:bg-amber-700 shadow-sm'
                  }`}
                >
                  {busy ? '...' : 'Зберегти'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
