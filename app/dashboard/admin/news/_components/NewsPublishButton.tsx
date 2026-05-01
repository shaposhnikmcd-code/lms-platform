'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { FaCheck, FaPause, FaPlay } from 'react-icons/fa';
import type { Theme } from '../../_components/adminTheme';
import InlineDateTimePicker, {
  isoToLocalInput,
  localInputToIso,
  nowLocalInput,
  formatLocalChip,
} from '../../_components/InlineDateTimePicker';

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
  // Новина «зараз призупинена» лише якщо suspendedAt уже настав і resume ще не настав/не задано.
  // Майбутній suspendedAt означає «заплановане призупинення» — новина все ще видима.
  const now = new Date();
  const activeSuspension =
    !!suspendedAt &&
    new Date(suspendedAt) <= now &&
    (!resumeAt || new Date(resumeAt) > now);
  const mode: Mode = !published ? 'publish' : activeSuspension ? 'resume' : 'suspend';

  const [showModal, setShowModal] = useState(false);
  // Локальний draft у форматі YYYY-MM-DDTHH:mm; для resume preinit-ним поточним resumeAt.
  const [dt, setDt] = useState('');
  const [loading, setLoading] = useState(false);

  // При відкритті resume-модалки одразу заповнюємо вже існуючий resumeAt (якщо є).
  const openModal = () => {
    if (mode === 'resume') {
      setDt(isoToLocalInput(resumeAt));
    } else {
      setDt('');
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setDt('');
  };

  const patch = (data: Record<string, unknown>) =>
    fetch(`/api/admin/news/${newsId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include',
    });

  // Опублікувати: зараз (dt порожнє) або запланувати на майбутню дату через suspendedAt+resumeAt-патерн.
  const onPublish = async () => {
    setLoading(true);
    try {
      const resumeISO = localInputToIso(dt);
      const suspendedISO = resumeISO ? new Date().toISOString() : null;
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
      closeModal();
    } finally {
      setLoading(false);
    }
  };

  // Призупинити: dt порожнє → миттєво (suspendedAt=now). dt задане → запланувати на майбутнє
  // (suspendedAt=dt). resumeAt лишаємо null — задається окремо через UI ScheduledTimerPill.
  const onSuspend = async () => {
    setLoading(true);
    try {
      const dtISO = localInputToIso(dt);
      const suspendedISO = dtISO ?? new Date().toISOString();
      const res = await patch({ suspendedAt: suspendedISO, resumeAt: null });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err?.error || 'Не вдалося призупинити');
        return;
      }
      onChange?.({ published: true, suspendedAt: suspendedISO, resumeAt: null });
      router.refresh();
      closeModal();
    } finally {
      setLoading(false);
    }
  };

  // Увімкнути: dt порожнє → миттєво (clear suspendedAt+resumeAt). dt задане → запланувати на час (update resumeAt).
  const onResume = async () => {
    setLoading(true);
    try {
      const resumeISO = localInputToIso(dt);
      const payload = resumeISO
        ? { suspendedAt: suspendedAt ?? new Date().toISOString(), resumeAt: resumeISO }
        : { suspendedAt: null, resumeAt: null };
      const res = await patch(payload);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err?.error || 'Не вдалося');
        return;
      }
      onChange?.({
        published: true,
        suspendedAt: (payload.suspendedAt as string | null) ?? null,
        resumeAt: (payload.resumeAt as string | null) ?? null,
      });
      router.refresh();
      closeModal();
    } finally {
      setLoading(false);
    }
  };

  // Миттєве ввімкнення без модалки — використовується коли вже є запланований таймер
  // (його видно як окремий pill — користувач хоче override-нути і опублікувати зараз).
  const onInstantResume = async () => {
    setLoading(true);
    try {
      const res = await patch({ suspendedAt: null, resumeAt: null });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err?.error || 'Не вдалося');
        return;
      }
      onChange?.({ published: true, suspendedAt: null, resumeAt: null });
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  // Миттєве призупинення (suspendedAt=now, resumeAt=null) — для випадку коли вже є
  // заплановане призупинення (pill його показує і керує датою). Основна кнопка тоді
  // не дублює календар, а просто призупиняє зараз.
  const onInstantSuspend = async () => {
    setLoading(true);
    try {
      const suspendedISO = new Date().toISOString();
      const res = await patch({ suspendedAt: suspendedISO, resumeAt: null });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err?.error || 'Не вдалося призупинити');
        return;
      }
      onChange?.({ published: true, suspendedAt: suspendedISO, resumeAt: null });
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  // Миттєва публікація без модалки — коли в чернетці вже є запланована публікація
  // (futureResume → pill керує датою). Основна кнопка просто публікує зараз.
  const onInstantPublish = async () => {
    setLoading(true);
    try {
      const res = await patch({ published: true, suspendedAt: null, resumeAt: null });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err?.error || 'Не вдалося опублікувати');
        return;
      }
      onChange?.({ published: true, suspendedAt: null, resumeAt: null });
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  const minNow = nowLocalInput();
  const hasScheduledResume = !!resumeAt && new Date(resumeAt) > new Date();
  const hasScheduledSuspend = !!suspendedAt && new Date(suspendedAt) > new Date();
  const hasScheduledPublish =
    !!resumeAt &&
    new Date(resumeAt) > new Date() &&
    (!suspendedAt || new Date(suspendedAt) <= new Date());

  // --- Resume (paused → enable) ---
  if (mode === 'resume') {
    return (
      <>
        <button
          type="button"
          onClick={hasScheduledResume ? onInstantResume : openModal}
          disabled={loading}
          title={hasScheduledResume ? 'Опублікувати зараз (override запланованого таймера)' : 'Увімкнути'}
          className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-lg border transition-colors disabled:opacity-50 ${
            dark
              ? 'bg-emerald-500/10 text-emerald-200 border-emerald-400/25 hover:bg-emerald-500/20'
              : 'bg-emerald-200/40 text-emerald-800 border-emerald-500/30 hover:bg-emerald-200/70'
          }`}
        >
          <FaPlay className="text-[10px]" />
          Увімкнути
        </button>
        {showModal && (
          <Modal theme={theme} onClose={closeModal}>
            <ResumeModalBody
              theme={theme}
              dt={dt}
              setDt={setDt}
              onCancel={closeModal}
              onConfirm={onResume}
              loading={loading}
              minNow={minNow}
            />
          </Modal>
        )}
      </>
    );
  }

  // --- Publish (draft) ---
  if (mode === 'publish') {
    return (
      <>
        <button
          type="button"
          onClick={hasScheduledPublish ? onInstantPublish : openModal}
          disabled={loading}
          title={hasScheduledPublish ? 'Опублікувати зараз (override запланованого таймера)' : undefined}
          className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-lg border transition-colors disabled:opacity-50 ${
            dark
              ? 'bg-emerald-500/10 text-emerald-200 border-emerald-400/25 hover:bg-emerald-500/20'
              : 'bg-emerald-200/40 text-emerald-800 border-emerald-500/30 hover:bg-emerald-200/70'
          }`}
        >
          <FaCheck className="text-[10px]" />
          Опублікувати
        </button>
        {showModal && (
          <Modal theme={theme} onClose={closeModal}>
            <PublishModalBody
              theme={theme}
              dt={dt}
              setDt={setDt}
              onCancel={closeModal}
              onConfirm={onPublish}
              loading={loading}
              minNow={minNow}
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
        onClick={hasScheduledSuspend ? onInstantSuspend : openModal}
        disabled={loading}
        title={hasScheduledSuspend ? 'Призупинити зараз (override запланованого таймера)' : undefined}
        className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-lg border transition-colors disabled:opacity-50 ${
          dark
            ? 'bg-amber-500/10 text-amber-200 border-amber-400/25 hover:bg-amber-500/20'
            : 'bg-amber-200/40 text-amber-900 border-amber-500/40 hover:bg-amber-200/70'
        }`}
      >
        <FaPause className="text-[10px]" />
        Призупинити
      </button>
      {showModal && (
        <Modal theme={theme} onClose={closeModal}>
          <SuspendModalBody
            theme={theme}
            dt={dt}
            setDt={setDt}
            onCancel={closeModal}
            onConfirm={onSuspend}
            loading={loading}
            minNow={minNow}
          />
        </Modal>
      )}
    </>
  );
}

function PublishModalBody({
  theme,
  dt,
  setDt,
  onCancel,
  onConfirm,
  loading,
  minNow,
}: ModalBodyProps) {
  const dark = theme === 'dark';
  return (
    <>
      <h3 className={`text-lg font-semibold mb-1 ${dark ? 'text-slate-100' : 'text-stone-900'}`}>
        Опублікувати новину
      </h3>
      <p className={`text-sm mb-4 ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
        Опублікувати зараз — або обрати час, з якого новина зʼявиться на вітрині.
      </p>
      <SchedulePicker theme={theme} dt={dt} setDt={setDt} minNow={minNow} emptyLabel="одразу" />
      <ModalButtons
        theme={theme}
        onCancel={onCancel}
        onConfirm={onConfirm}
        loading={loading}
        confirmLabel={dt ? 'Запланувати' : 'Опублікувати зараз'}
        tone="emerald"
      />
    </>
  );
}

function SuspendModalBody({
  theme,
  dt,
  setDt,
  onCancel,
  onConfirm,
  loading,
  minNow,
}: ModalBodyProps) {
  const dark = theme === 'dark';
  return (
    <>
      <h3 className={`text-lg font-semibold mb-1 ${dark ? 'text-slate-100' : 'text-stone-900'}`}>
        Призупинити новину
      </h3>
      <p className={`text-sm mb-4 ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
        Призупинити зараз — або обрати час, з якого новина має зникнути з вітрини. До цього
        часу вона залишається опублікованою.
      </p>
      <SchedulePicker
        theme={theme}
        dt={dt}
        setDt={setDt}
        minNow={minNow}
        emptyLabel="призупинити зараз"
      />
      <ModalButtons
        theme={theme}
        onCancel={onCancel}
        onConfirm={onConfirm}
        loading={loading}
        confirmLabel={dt ? 'Запланувати' : 'Призупинити зараз'}
        tone="amber"
      />
    </>
  );
}

function ResumeModalBody({
  theme,
  dt,
  setDt,
  onCancel,
  onConfirm,
  loading,
  minNow,
}: ModalBodyProps) {
  const dark = theme === 'dark';
  return (
    <>
      <h3 className={`text-lg font-semibold mb-1 ${dark ? 'text-slate-100' : 'text-stone-900'}`}>
        Увімкнути новину
      </h3>
      <p className={`text-sm mb-4 ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
        Увімкнути зараз — або задати час, коли новина автоматично повернеться на вітрину.
      </p>
      <SchedulePicker
        theme={theme}
        dt={dt}
        setDt={setDt}
        minNow={minNow}
        emptyLabel="увімкнути зараз"
      />
      <ModalButtons
        theme={theme}
        onCancel={onCancel}
        onConfirm={onConfirm}
        loading={loading}
        confirmLabel={dt ? 'Запланувати' : 'Увімкнути зараз'}
        tone="emerald"
      />
    </>
  );
}

interface ModalBodyProps {
  theme: Theme;
  dt: string;
  setDt: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  loading: boolean;
  minNow: string;
}

function SchedulePicker({
  theme,
  dt,
  setDt,
  minNow,
  emptyLabel,
}: {
  theme: Theme;
  dt: string;
  setDt: (v: string) => void;
  minNow: string;
  emptyLabel: string;
}) {
  const dark = theme === 'dark';
  return (
    <>
      <InlineDateTimePicker value={dt} onChange={setDt} theme={theme} min={minNow} />
      <div
        className={`mt-3 rounded-lg border px-3 py-2 mb-4 ${
          dark ? 'bg-amber-400/[0.05] border-amber-400/20' : 'bg-amber-100/40 border-amber-500/30'
        }`}
      >
        <p
          className={`text-[9px] uppercase tracking-[0.2em] font-semibold mb-1 ${
            dark ? 'text-amber-200/70' : 'text-amber-900/70'
          }`}
        >
          Буде застосовано
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
            {dt ? formatLocalChip(dt) : emptyLabel}
          </span>
        </div>
      </div>
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
        className={`rounded-2xl p-6 w-full max-w-md mx-4 border shadow-2xl ${
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
