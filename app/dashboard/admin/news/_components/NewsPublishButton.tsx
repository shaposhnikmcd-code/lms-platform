'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { FaCheck, FaPause, FaPlay } from 'react-icons/fa';
import type { Theme } from '../../_components/adminTheme';

type Mode = 'publish' | 'suspend' | 'resume';

type Result = {
  published: boolean;
  suspendedAt: string | null;
  resumeAt: string | null;
};

export default function NewsPublishButton({
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
  const activeSuspension =
    !!suspendedAt && (!resumeAt || new Date(resumeAt) > new Date());
  const mode: Mode = !published ? 'publish' : activeSuspension ? 'resume' : 'suspend';

  const [showModal, setShowModal] = useState(false);
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(false);

  const patch = (data: Record<string, unknown>) =>
    fetch(`/api/admin/news/${newsId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include',
    });

  const onPublish = async () => {
    setLoading(true);
    try {
      const suspendedISO = date ? new Date().toISOString() : null;
      const resumeISO = date ? new Date(date).toISOString() : null;
      const res = await patch({
        published: true,
        suspendedAt: suspendedISO,
        resumeAt: resumeISO,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err?.error || 'Не вдалося опублікувати');
        return;
      }
      onChange?.({ published: true, suspendedAt: suspendedISO, resumeAt: resumeISO });
      router.refresh();
      setShowModal(false);
      setDate('');
    } finally {
      setLoading(false);
    }
  };

  const onSuspend = async () => {
    setLoading(true);
    try {
      const suspendedISO = new Date().toISOString();
      const resumeISO = date ? new Date(date).toISOString() : null;
      const res = await patch({ suspendedAt: suspendedISO, resumeAt: resumeISO });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err?.error || 'Не вдалося призупинити');
        return;
      }
      onChange?.({ published: true, suspendedAt: suspendedISO, resumeAt: resumeISO });
      router.refresh();
      setShowModal(false);
      setDate('');
    } finally {
      setLoading(false);
    }
  };

  const onResume = async () => {
    setLoading(true);
    try {
      const res = await patch({ suspendedAt: null, resumeAt: null });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err?.error || 'Не вдалося відновити');
        return;
      }
      onChange?.({ published: true, suspendedAt: null, resumeAt: null });
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  // --- Resume (immediate) ---
  if (mode === 'resume') {
    return (
      <button
        type="button"
        onClick={onResume}
        disabled={loading}
        className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-lg border transition-colors disabled:opacity-50 ${
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

  // --- Publish (draft) ---
  if (mode === 'publish') {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-lg border transition-colors ${
            dark
              ? 'bg-emerald-500/10 text-emerald-200 border-emerald-400/25 hover:bg-emerald-500/20'
              : 'bg-emerald-200/40 text-emerald-800 border-emerald-500/30 hover:bg-emerald-200/70'
          }`}
        >
          <FaCheck className="text-[10px]" />
          Опублікувати
        </button>
        {showModal && (
          <Modal theme={theme} onClose={() => setShowModal(false)}>
            <PublishModalBody
              theme={theme}
              date={date}
              setDate={setDate}
              onCancel={() => { setShowModal(false); setDate(''); }}
              onConfirm={onPublish}
              loading={loading}
            />
          </Modal>
        )}
      </>
    );
  }

  // --- Suspend (published → pause) ---
  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-lg border transition-colors ${
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
          <SuspendModalBody
            theme={theme}
            date={date}
            setDate={setDate}
            onCancel={() => { setShowModal(false); setDate(''); }}
            onConfirm={onSuspend}
            loading={loading}
          />
        </Modal>
      )}
    </>
  );
}

function PublishModalBody({
  theme,
  date,
  setDate,
  onCancel,
  onConfirm,
  loading,
}: {
  theme: Theme;
  date: string;
  setDate: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  const dark = theme === 'dark';
  return (
    <>
      <h3 className={`text-lg font-semibold mb-1 ${dark ? 'text-slate-100' : 'text-stone-900'}`}>
        Опублікувати новину
      </h3>
      <p className={`text-sm mb-5 ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
        Опублікувати зараз, або задати дату, з якої новина зʼявиться на вітрині.
      </p>
      <DateField theme={theme} label="Опублікувати з дати (необовʼязково)" date={date} setDate={setDate} />
      {date && (
        <p className={`text-[11px] mb-4 -mt-3 ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
          Новина зʼявиться на вітрині{' '}
          <span className={`font-semibold ${dark ? 'text-slate-200' : 'text-stone-900'}`}>
            {new Date(date).toLocaleDateString('uk-UA')}
          </span>
        </p>
      )}
      <ModalButtons
        theme={theme}
        onCancel={onCancel}
        onConfirm={onConfirm}
        loading={loading}
        confirmLabel={date ? 'Запланувати' : 'Опублікувати'}
        tone="emerald"
      />
    </>
  );
}

function SuspendModalBody({
  theme,
  date,
  setDate,
  onCancel,
  onConfirm,
  loading,
}: {
  theme: Theme;
  date: string;
  setDate: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  const dark = theme === 'dark';
  return (
    <>
      <h3 className={`text-lg font-semibold mb-1 ${dark ? 'text-slate-100' : 'text-stone-900'}`}>
        Призупинити новину
      </h3>
      <p className={`text-sm mb-5 ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
        Новина зникне з вітрини. Можна задати дату автоматичного повернення.
      </p>
      <DateField theme={theme} label="Повернути автоматично (необовʼязково)" date={date} setDate={setDate} />
      {date && (
        <p className={`text-[11px] mb-4 -mt-3 ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
          Новина повернеться на вітрину{' '}
          <span className={`font-semibold ${dark ? 'text-slate-200' : 'text-stone-900'}`}>
            {new Date(date).toLocaleDateString('uk-UA')}
          </span>
        </p>
      )}
      <ModalButtons
        theme={theme}
        onCancel={onCancel}
        onConfirm={onConfirm}
        loading={loading}
        confirmLabel="Призупинити"
        tone="amber"
      />
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
          dark ? 'bg-[#14161d] border-white/[0.08]' : 'bg-[#fbf7ec] border-stone-300/60'
        }`}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

function DateField({
  theme,
  label,
  date,
  setDate,
}: {
  theme: Theme;
  label: string;
  date: string;
  setDate: (v: string) => void;
}) {
  const dark = theme === 'dark';
  return (
    <>
      <label className={`block text-[12px] font-medium mb-1.5 ${dark ? 'text-slate-300' : 'text-stone-700'}`}>
        {label}
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
    </>
  );
}

function ModalButtons({
  theme,
  onCancel,
  onConfirm,
  loading,
  confirmLabel,
  tone,
}: {
  theme: Theme;
  onCancel: () => void;
  onConfirm: () => void;
  loading: boolean;
  confirmLabel: string;
  tone: 'amber' | 'emerald';
}) {
  const dark = theme === 'dark';
  const confirmCls =
    tone === 'emerald'
      ? dark
        ? 'bg-emerald-500/90 text-white hover:bg-emerald-500 shadow-[0_0_18px_-4px_rgba(16,185,129,0.5)]'
        : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
      : dark
        ? 'bg-amber-400/90 text-stone-900 hover:bg-amber-300 shadow-[0_0_18px_-4px_rgba(251,191,36,0.5)]'
        : 'bg-amber-600 text-white hover:bg-amber-700 shadow-sm';
  return (
    <div className="flex gap-2">
      <button
        onClick={onCancel}
        disabled={loading}
        className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-xl border transition-colors disabled:opacity-50 ${
          dark
            ? 'bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.08]'
            : 'bg-white/70 border-stone-300/60 text-stone-700 hover:bg-white'
        }`}
      >
        Скасувати
      </button>
      <button
        onClick={onConfirm}
        disabled={loading}
        className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 ${confirmCls}`}
      >
        {loading ? '...' : confirmLabel}
      </button>
    </div>
  );
}
