'use client';

import Link from 'next/link';
import { HiOutlineSun, HiOutlineMoon, HiOutlineArrowLeft } from 'react-icons/hi2';
import type { Theme } from './adminTheme';

export function AdminThemeToggle({
  theme,
  setTheme,
}: {
  theme: Theme;
  setTheme: (t: Theme) => void;
}) {
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={dark ? 'Світла тема' : 'Темна тема'}
      title={dark ? 'Світла тема' : 'Темна тема'}
      className={`group relative inline-flex items-center gap-2.5 pl-3.5 pr-4 py-2 rounded-full border text-[12px] font-medium transition-all duration-300 overflow-hidden ${
        dark
          ? 'bg-gradient-to-br from-white/[0.07] to-white/[0.02] border-white/[0.12] text-amber-100 hover:border-amber-300/40 hover:shadow-[0_0_24px_-4px_rgba(251,191,36,0.35)]'
          : 'bg-gradient-to-br from-white/90 to-stone-50/70 border-stone-300/70 text-stone-800 hover:border-amber-500/50 hover:shadow-[0_0_24px_-4px_rgba(180,83,9,0.25)]'
      }`}
    >
      {/* Shimmer sweep on hover */}
      <span
        className={`pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 skew-x-[-20deg] opacity-0 group-hover:opacity-100 group-hover:translate-x-[260%] transition-all duration-[900ms] ease-out ${
          dark
            ? 'bg-gradient-to-r from-transparent via-amber-200/20 to-transparent'
            : 'bg-gradient-to-r from-transparent via-amber-600/15 to-transparent'
        }`}
      />

      {/* Icon crossfade */}
      <span className="relative w-[18px] h-[18px] inline-block flex-shrink-0">
        <HiOutlineSun
          className={`absolute inset-0 text-[18px] transition-all duration-500 ${
            dark
              ? 'opacity-100 rotate-0 scale-100 drop-shadow-[0_0_8px_rgba(251,191,36,0.7)]'
              : 'opacity-0 -rotate-90 scale-50'
          }`}
        />
        <HiOutlineMoon
          className={`absolute inset-0 text-[18px] transition-all duration-500 ${
            dark
              ? 'opacity-0 rotate-90 scale-50'
              : 'opacity-100 rotate-0 scale-100 drop-shadow-[0_0_6px_rgba(180,83,9,0.35)]'
          }`}
        />
      </span>

      <span className="relative tracking-wide">{dark ? 'Світла' : 'Темна'}</span>
    </button>
  );
}

export function AdminShell({
  theme,
  setTheme,
  title,
  subtitle,
  eyebrow = 'Admin',
  backHref,
  rightSlot,
  rightSlotAfter,
  maxWidth = 'max-w-6xl',
  rightInset = 0,
  children,
}: {
  theme: Theme;
  setTheme: (t: Theme) => void;
  title: string;
  subtitle?: React.ReactNode;
  eyebrow?: string;
  backHref?: string;
  rightSlot?: React.ReactNode;
  /** Слот після ThemeToggle (рендериться праворуч від "Темна"). */
  rightSlotAfter?: React.ReactNode;
  /** Tailwind max-width class for content container. Default: `max-w-6xl`. */
  maxWidth?: string;
  /** Px inset від правого краю для кластера (rightSlot + ThemeToggle + rightSlotAfter). Default: 0. */
  rightInset?: number;
  children: React.ReactNode;
}) {
  const dark = theme === 'dark';
  return (
    <div className={`relative min-h-[calc(100vh-4rem)] overflow-hidden ${dark ? 'bg-[#0b0d12]' : 'bg-[#f4eee1]'}`}>
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className={`absolute -top-40 -left-40 w-[520px] h-[520px] rounded-full blur-[120px] ${
            dark ? 'bg-amber-500/[0.08]' : 'bg-amber-300/30'
          }`}
        />
        <div
          className={`absolute top-20 right-[-160px] w-[520px] h-[520px] rounded-full blur-[140px] ${
            dark ? 'bg-indigo-500/[0.07]' : 'bg-rose-300/20'
          }`}
        />
        <div
          className={`absolute bottom-0 left-1/3 w-[460px] h-[460px] rounded-full blur-[140px] ${
            dark ? 'bg-emerald-500/[0.04]' : 'bg-emerald-300/15'
          }`}
        />
      </div>

      {/* Grid overlay */}
      <div
        className={`pointer-events-none absolute inset-0 ${dark ? 'opacity-[0.025]' : 'opacity-[0.04]'}`}
        style={{
          backgroundImage: dark
            ? 'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)'
            : 'linear-gradient(to right, #1c1917 1px, transparent 1px), linear-gradient(to bottom, #1c1917 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className={`relative ${maxWidth} mx-auto px-6 py-10`}>
        <header className="flex items-end justify-between gap-4 mb-10 flex-wrap">
          <div className="min-w-0">
            {eyebrow && (
              <div
                className={`inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] font-medium mb-3 ${
                  dark ? 'text-amber-400/80' : 'text-amber-700'
                }`}
              >
                <span className={`w-5 h-px ${dark ? 'bg-amber-400/50' : 'bg-amber-700/60'}`} />
                {eyebrow}
              </div>
            )}
            <div className="flex items-center gap-3">
              {backHref && (
                <Link
                  href={backHref}
                  aria-label="Назад"
                  title="Назад"
                  className={`inline-flex items-center justify-center w-9 h-9 rounded-full border transition-colors ${
                    dark
                      ? 'bg-white/[0.04] border-white/[0.1] text-slate-300 hover:bg-white/[0.08] hover:text-white'
                      : 'bg-white/70 border-stone-300/60 text-stone-600 hover:bg-white hover:text-stone-900'
                  }`}
                >
                  <HiOutlineArrowLeft className="text-sm" />
                </Link>
              )}
              <h1
                className={`text-[32px] font-semibold tracking-tight leading-none ${
                  dark ? 'text-white' : 'text-stone-900'
                }`}
              >
                {title}
              </h1>
            </div>
            {subtitle && (
              <p className={`text-[13px] mt-2.5 ${dark ? 'text-slate-400' : 'text-stone-500'}`}>{subtitle}</p>
            )}
          </div>

          <div className="flex items-center gap-2.5" style={rightInset ? { marginRight: rightInset } : undefined}>
            {rightSlot}
            <AdminThemeToggle theme={theme} setTheme={setTheme} />
            {rightSlotAfter}
          </div>
        </header>

        {children}
      </div>
    </div>
  );
}

export function AdminPanel({
  theme,
  padding = 'p-6',
  className = '',
  children,
}: {
  theme: Theme;
  padding?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const dark = theme === 'dark';
  return (
    <section
      className={`relative rounded-2xl backdrop-blur-sm border ${padding} ${
        dark
          ? 'bg-white/[0.03] border-white/[0.06] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]'
          : 'bg-white/60 border-stone-300/50 shadow-[0_1px_2px_rgba(68,64,60,0.04),0_10px_30px_-20px_rgba(68,64,60,0.1)]'
      } ${className}`}
    >
      {children}
    </section>
  );
}
