'use client';

import { useEffect } from 'react';
import { HiOutlineXMark, HiOutlineSparkles } from 'react-icons/hi2';
import type { Theme } from '../../_components/adminTheme';
import {
  YEARLY_INFO_SECTIONS,
  YEARLY_INFO_VERSION,
  YEARLY_INFO_LAST_UPDATED,
} from './yearlyProgramInfo';

export default function YearlyInfoModal({
  theme,
  onClose,
}: {
  theme: Theme;
  onClose: () => void;
}) {
  const dark = theme === 'dark';

  /// Esc закриває, scroll body замикається.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      className={`fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-8 ${dark ? 'bg-black/75' : 'bg-stone-900/55'}`}
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-[820px] max-h-[90vh] flex flex-col rounded-2xl shadow-2xl border ${dark ? 'bg-[#0f1115] border-white/[0.08] text-slate-100' : 'bg-[#fbf7ec] border-stone-300/60 text-stone-900'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header (fixed) */}
        <div
          className={`relative flex-shrink-0 px-6 sm:px-8 pt-7 pb-6 rounded-t-2xl border-b ${dark ? 'border-white/[0.06] bg-gradient-to-br from-amber-500/[0.08] via-transparent to-emerald-500/[0.04]' : 'border-stone-200/70 bg-gradient-to-br from-amber-200/40 via-amber-50/20 to-emerald-100/30'}`}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрити"
            className={`absolute top-4 right-4 inline-flex items-center justify-center w-9 h-9 rounded-full transition-colors ${dark ? 'bg-white/[0.06] text-slate-300 hover:bg-white/[0.12]' : 'bg-white/70 text-stone-600 hover:bg-white'}`}
          >
            <HiOutlineXMark className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <span
              className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${dark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-200/60 text-amber-800'}`}
            >
              <HiOutlineSparkles className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-[20px] sm:text-[22px] font-semibold tracking-tight">
                Як працює Річна програма
              </h2>
              <p className={`text-[12px] mt-0.5 ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
                Довідник для менеджерів · v{YEARLY_INFO_VERSION} · оновлено {YEARLY_INFO_LAST_UPDATED}
              </p>
            </div>
          </div>
        </div>

        {/* Sections (scrollable) */}
        <div className="yearly-info-scroll flex-1 overflow-y-auto px-6 sm:px-8 py-6 space-y-5">
          {YEARLY_INFO_SECTIONS.map((section, i) => (
            <section
              key={i}
              className={`rounded-xl border p-5 ${dark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-stone-200/70 bg-white/60'}`}
            >
              <h3 className="flex items-center gap-2.5 text-[15px] font-semibold mb-2.5">
                <span className="text-[18px] leading-none">{section.emoji}</span>
                <span>{section.title}</span>
              </h3>
              <div
                className={`text-[13.5px] leading-[1.65] info-prose ${dark ? 'text-slate-300' : 'text-stone-700'}`}
              >
                {section.body}
              </div>
            </section>
          ))}

          {/* Footer */}
          <div
            className={`rounded-xl px-5 py-4 text-[12.5px] leading-relaxed ${dark ? 'bg-white/[0.03] text-slate-400' : 'bg-stone-100/80 text-stone-600'}`}
          >
            Бачиш помилку чи нюанс, який тут не описано? Скажи менеджеру продукту
            або напиши в інтернал-чат — оновимо текст у єдиному джерелі правди
            (<code className={`px-1.5 py-0.5 rounded ${dark ? 'bg-white/[0.05] text-slate-300' : 'bg-stone-200/70 text-stone-800'}`}>yearlyProgramInfo.tsx</code>),
            і всі менеджери побачать оновлення після найближчого деплою.
          </div>
        </div>
      </div>

      {/* Inline scoped styles for prose lists + invisible scrollbar */}
      <style jsx>{`
        .info-prose :global(p) {
          margin: 0 0 8px;
        }
        .info-prose :global(p:last-child) {
          margin-bottom: 0;
        }
        .info-prose :global(ul) {
          list-style: disc;
          padding-left: 22px;
          margin: 0;
        }
        .info-prose :global(li) {
          margin-bottom: 6px;
        }
        .info-prose :global(li:last-child) {
          margin-bottom: 0;
        }
        .info-prose :global(strong) {
          font-weight: 600;
        }
        :global(.yearly-info-scroll) {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        :global(.yearly-info-scroll)::-webkit-scrollbar {
          width: 0;
          height: 0;
          display: none;
        }
      `}</style>
    </div>
  );
}
