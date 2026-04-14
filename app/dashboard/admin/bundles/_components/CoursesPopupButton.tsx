'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaBook, FaTimes } from 'react-icons/fa';

type Course = { slug: string; title: string; price: number };

export default function CoursesPopupButton({ courses }: { courses: Course[] }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    // Lock body scroll while modal is open
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const modal = open && mounted ? createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div
        className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Курси в системі</h2>
            <p className="text-xs text-slate-500 mt-1">
              Джерело: <code className="px-1 py-0.5 bg-slate-100 rounded text-[11px]">lib/coursesCatalog.ts</code>
            </p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-slate-400 hover:text-slate-600 ml-3"
            aria-label="Закрити"
          >
            <FaTimes size={18} />
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto flex-1">
          {courses.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">Курсів немає</p>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {courses.map((c) => (
                <div key={c.slug} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
                  <div className="min-w-0 flex-1 mr-3">
                    <p className="text-sm font-medium text-slate-800 truncate">{c.title}</p>
                    <p className="text-[11px] text-slate-400 font-mono truncate">{c.slug}</p>
                  </div>
                  <span className="text-sm font-semibold text-amber-600 tabular-nums flex-shrink-0 whitespace-nowrap">
                    {c.price.toLocaleString()} ₴
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative inline-flex items-center gap-2 pl-3 pr-2 py-1.5 text-sm font-medium text-violet-700 bg-gradient-to-br from-white to-violet-50/70 border border-violet-200/70 rounded-lg shadow-sm hover:shadow-md hover:border-violet-300 hover:from-violet-50 hover:to-violet-100/50 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 overflow-hidden"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/70 to-transparent group-hover:translate-x-full transition-transform duration-[900ms] ease-out"
        />
        <FaBook className="relative text-violet-500 text-xs transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110" />
        <span className="relative">Курси</span>
        <span className="relative inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 text-[11px] font-bold text-white bg-gradient-to-br from-violet-500 to-violet-600 rounded-md shadow-sm shadow-violet-500/20 tabular-nums transition-all duration-300 group-hover:shadow-violet-500/40 group-hover:shadow-md">
          {courses.length}
        </span>
      </button>
      {modal}
    </>
  );
}
