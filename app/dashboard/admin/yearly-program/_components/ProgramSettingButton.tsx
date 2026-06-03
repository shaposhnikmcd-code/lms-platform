'use client';

import type { Theme } from '../../_components/adminTheme';

/// Маленька кнопка program-level налаштувань (Активація/GRACE/Доступ) — сірий ghost-стиль
/// з amber-hover. Назва (`label`) — звичайний текст, а поточне значення налаштування
/// (`value`) рендериться окремим «чипом» праворуч, щоб одразу читалось як значення, а не
/// частина назви. `valueTone`: 'on' (емеральд) / 'off' (rose) / 'neutral' (amber).
export default function ProgramSettingButton({
  theme,
  icon,
  label,
  value,
  valueTone = 'neutral',
  title,
  onClick,
}: {
  theme: Theme;
  icon: React.ReactNode;
  label: string;
  value?: string | null;
  valueTone?: 'on' | 'off' | 'neutral';
  title?: string;
  onClick: () => void;
}) {
  const dark = theme === 'dark';

  const chipCls =
    valueTone === 'on'
      ? dark
        ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/25'
        : 'bg-emerald-100 text-emerald-700 ring-emerald-300/60'
      : valueTone === 'off'
        ? dark
          ? 'bg-rose-500/15 text-rose-300 ring-rose-400/25'
          : 'bg-rose-100 text-rose-700 ring-rose-300/60'
        : dark
          ? 'bg-amber-400/15 text-amber-300 ring-amber-400/25'
          : 'bg-amber-100 text-amber-800 ring-amber-300/60';

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
        dark
          ? 'text-slate-400 hover:bg-white/[0.06] hover:text-amber-300'
          : 'text-stone-600 hover:bg-stone-100 hover:text-amber-800'
      }`}
    >
      {icon}
      <span>{label}</span>
      {value != null && value !== '' && (
        <span
          className={`ml-0.5 inline-flex items-center text-[10px] font-bold tabular-nums rounded-md px-1.5 py-0.5 ring-1 ${chipCls}`}
        >
          {value}
        </span>
      )}
    </button>
  );
}
