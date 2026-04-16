'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { FaTrash } from 'react-icons/fa';
import type { Theme } from '../../_components/adminTheme';

export default function DeleteBundleButton({
  bundleId,
  bundleTitle,
  theme = 'light',
}: {
  bundleId: string;
  bundleTitle: string;
  theme?: Theme;
}) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dark = theme === 'dark';

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!showModal) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showModal]);

  const handleDelete = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/bundles/${bundleId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data?.error || 'Не вдалося видалити');
        return;
      }
      router.refresh();
    } catch (err) {
      alert(`Помилка видалення: ${err}`);
    } finally {
      setLoading(false);
      setShowModal(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-lg border transition-colors w-full ${
          dark
            ? 'bg-rose-500/10 text-rose-200 border-rose-400/25 hover:bg-rose-500/20'
            : 'bg-rose-200/40 text-rose-800 border-rose-500/30 hover:bg-rose-200/70'
        }`}
      >
        <FaTrash className="text-[10px]" />
        Видалити
      </button>

      {showModal && mounted && createPortal(
        <div
          className={`fixed inset-0 flex items-center justify-center z-[100] backdrop-blur-sm ${
            dark ? 'bg-black/60' : 'bg-stone-900/30'
          }`}
          onClick={() => setShowModal(false)}
        >
          <div
            className={`rounded-2xl p-6 w-full max-w-sm mx-4 border shadow-2xl ${
              dark ? 'bg-[#14161d] border-white/[0.08]' : 'bg-[#fbf7ec] border-stone-300/60'
            }`}
            onClick={e => e.stopPropagation()}
          >
            <h3 className={`text-lg font-semibold mb-1 ${dark ? 'text-slate-100' : 'text-stone-900'}`}>
              Видалити пакет?
            </h3>
            <p className={`text-sm mb-5 ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
              Пакет{' '}
              <span className={`font-semibold ${dark ? 'text-slate-100' : 'text-stone-900'}`}>
                «{bundleTitle}»
              </span>{' '}
              буде видалено назавжди. Цю дію не можна відмінити.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowModal(false)}
                className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-xl border transition-colors ${
                  dark
                    ? 'bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.08]'
                    : 'bg-white/70 border-stone-300/60 text-stone-700 hover:bg-white'
                }`}
              >
                Скасувати
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 ${
                  dark
                    ? 'bg-rose-500/90 text-white hover:bg-rose-500 shadow-[0_0_20px_-4px_rgba(244,63,94,0.5)]'
                    : 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm'
                }`}
              >
                {loading ? '...' : 'Видалити'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
