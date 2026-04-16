'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { FaPause, FaPlay } from 'react-icons/fa';
import type { Theme } from '../../_components/adminTheme';

interface SuspendButtonProps {
  bundleId: string;
  suspendedAt: string | null;
  resumeAt: string | null;
  theme?: Theme;
}

export default function SuspendButton({ bundleId, suspendedAt, theme = 'light' }: SuspendButtonProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(false);
  const isSuspended = !!suspendedAt;
  const dark = theme === 'dark';

  const patch = (data: Record<string, unknown>) =>
    fetch(`/api/admin/bundles/${bundleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include',
    });

  const handleSuspend = async () => {
    setLoading(true);
    try {
      const res = await patch({
        suspendedAt: new Date().toISOString(),
        resumeAt: date || null,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(JSON.stringify(data, null, 2));
        return;
      }
      router.refresh();
    } catch (err) {
      alert(`Fetch помилка: ${err}`);
    } finally {
      setLoading(false);
      setShowModal(false);
      setDate('');
    }
  };

  const handleResume = async () => {
    setLoading(true);
    try {
      await patch({ suspendedAt: null, resumeAt: null });
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  if (isSuspended) {
    return (
      <button
        onClick={handleResume}
        disabled={loading}
        className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-lg border transition-colors disabled:opacity-50 w-full ${
          dark
            ? 'bg-emerald-500/10 text-emerald-200 border-emerald-400/25 hover:bg-emerald-500/20'
            : 'bg-emerald-200/40 text-emerald-800 border-emerald-500/30 hover:bg-emerald-200/70'
        }`}
      >
        <FaPlay className="text-[10px]" />
        {loading ? '...' : 'Увімкнути'}
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-lg border transition-colors w-full ${
          dark
            ? 'bg-amber-500/10 text-amber-200 border-amber-400/25 hover:bg-amber-500/20'
            : 'bg-amber-200/40 text-amber-900 border-amber-500/40 hover:bg-amber-200/70'
        }`}
      >
        <FaPause className="text-[10px]" />
        Призупинити
      </button>

      {showModal && (
        <Modal theme={theme} onClose={() => setShowModal(false)}>
          <h3 className={`text-lg font-semibold mb-1 ${dark ? 'text-slate-100' : 'text-stone-900'}`}>
            Призупинити пакет
          </h3>
          <p className={`text-sm mb-5 ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
            Пакет зникне з вітрини. Можна задати дату автоматичного повернення.
          </p>

          <label className={`block text-[12px] font-medium mb-1.5 ${dark ? 'text-slate-300' : 'text-stone-700'}`}>
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
              Пакет повернеться на вітрину{' '}
              <span className={`font-semibold ${dark ? 'text-slate-200' : 'text-stone-900'}`}>
                {new Date(date).toLocaleDateString('uk-UA')}
              </span>
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowModal(false);
                setDate('');
              }}
              className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-xl border transition-colors ${
                dark
                  ? 'bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.08]'
                  : 'bg-white/70 border-stone-300/60 text-stone-700 hover:bg-white'
              }`}
            >
              Скасувати
            </button>
            <button
              onClick={handleSuspend}
              disabled={loading}
              className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 ${
                dark
                  ? 'bg-amber-400/90 text-stone-900 hover:bg-amber-300 shadow-[0_0_18px_-4px_rgba(251,191,36,0.5)]'
                  : 'bg-amber-600 text-white hover:bg-amber-700 shadow-sm'
              }`}
            >
              {loading ? '...' : 'Призупинити'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function Modal({
  theme,
  onClose,
  children,
}: {
  theme: Theme;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const dark = theme === 'dark';
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 flex items-center justify-center z-[100] backdrop-blur-sm ${
        dark ? 'bg-black/60' : 'bg-stone-900/30'
      }`}
      onClick={onClose}
    >
      <div
        className={`rounded-2xl p-6 w-full max-w-sm mx-4 border shadow-2xl ${
          dark
            ? 'bg-[#14161d] border-white/[0.08]'
            : 'bg-[#fbf7ec] border-stone-300/60'
        }`}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
