'use client';

import type { Theme } from '../../_components/adminTheme';

/// Маленька кнопка program-level налаштувань (Вартість/GRACE/Нагадування) — сірий ghost-стиль
/// з amber-hover. Використовується в toolbar workspace-карточки і в cohort-actions row,
/// щоб налаштування візуально не конкурували з основними діями (🚀 Запустити, ✉️ Дослати).
export default function ProgramSettingButton({
  theme,
  icon,
  label,
  title,
  onClick,
  badge,
}: {
  theme: Theme;
  icon: React.ReactNode;
  label: string;
  title?: string;
  onClick: () => void;
  badge?: string | null;
}) {
  const dark = theme === 'dark';
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
      {label}
      {badge && (
        <span
          className={`ml-0.5 text-[9px] uppercase tracking-wider font-semibold rounded-full px-1.5 py-0.5 ${
            dark ? 'bg-rose-500/15 text-rose-300' : 'bg-rose-100 text-rose-700'
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
