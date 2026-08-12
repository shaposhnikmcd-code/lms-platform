'use client';

import type { Theme } from './adminTheme';

/// Дата запису в TZ `Europe/Kyiv` у вигляді `YYYY-MM-DD` — рівно в тому форматі, який
/// віддає `<input type="date">`. Порівнюємо рядки лексикографічно, тому межі доби не
/// їдуть від UTC-зсуву браузера і збігаються з датою, яку показує таблиця.
const kyivKeyCache = new Map<string, string>();

export function kyivDateKey(iso: string): string {
  const cached = kyivKeyCache.get(iso);
  if (cached !== undefined) return cached;
  const d = new Date(iso);
  const key = Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Kyiv' });
  // Кеш живе стільки ж, скільки вкладка — обмежуємо, щоб не тримати нескінченну мапу.
  if (kyivKeyCache.size > 20000) kyivKeyCache.clear();
  kyivKeyCache.set(iso, key);
  return key;
}

/// Обидві межі включно (`to` = до кінця дня). Порожнє поле = межі немає.
/// Некоректний діапазон (from > to) природно дає порожню вибірку, без крешів.
export function isWithinDateRange(iso: string, from: string, to: string): boolean {
  if (!from && !to) return true;
  const key = kyivDateKey(iso);
  if (!key) return false;
  if (from && key < from) return false;
  if (to && key > to) return false;
  return true;
}

/// Пара полів «Період з … по …» для клієнтських фільтрів адмін-таблиць.
/// `variant`: `panel` — усередині AdminPanel-тулбара (Річна), `toolbar` — у sub-header
/// таблиці (Платежі); відрізняються тільки фоном/фокусом під сусідні контроли сторінки.
export default function DateRangeFilter({
  theme,
  from,
  to,
  onFrom,
  onTo,
  label = 'Період',
  variant = 'panel',
  className,
}: {
  theme: Theme;
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
  label?: string;
  variant?: 'panel' | 'toolbar';
  className?: string;
}) {
  const dark = theme === 'dark';
  const invalid = Boolean(from && to && from > to);

  const base = `px-2.5 py-1.5 rounded-lg border text-[12px] outline-none transition-colors ${
    dark ? '[color-scheme:dark]' : ''
  }`;
  const tone =
    variant === 'toolbar'
      ? dark
        ? 'bg-black/30 text-slate-100 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20'
        : 'bg-white text-stone-800 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20'
      : dark
        ? 'bg-white/[0.04] text-slate-200 focus:border-amber-400/40'
        : 'bg-white/80 text-stone-800 focus:border-amber-600/50';
  // Межа окремо від тону: при некоректному діапазоні підсвічуємо обидва поля.
  const borderTone = invalid
    ? dark ? 'border-rose-400/60' : 'border-rose-400'
    : variant === 'toolbar'
      ? dark ? 'border-white/[0.08]' : 'border-stone-300/70'
      : dark ? 'border-white/[0.08]' : 'border-stone-300/60';
  const inputCls = `${base} ${tone} ${borderTone}`;

  return (
    <div className={`flex items-center gap-1.5 flex-wrap ${className ?? ''}`}>
      <span className={`text-[11px] whitespace-nowrap ${dark ? 'text-slate-400' : 'text-stone-600'}`}>{label}</span>
      {/* Пара «з — по» переноситься цілим блоком: інакше на вузькому екрані тире
          лишалось висіти в кінці попереднього рядка. */}
      <span className="inline-flex items-center gap-1.5 flex-nowrap">
        <input
          type="date"
          value={from}
          max={to || undefined}
          onChange={(e) => onFrom(e.target.value)}
          aria-label={`${label} — з`}
          title={invalid ? 'Початок періоду пізніший за кінець' : undefined}
          className={inputCls}
        />
        <span className={`text-[11px] ${dark ? 'text-slate-500' : 'text-stone-500'}`}>—</span>
        <input
          type="date"
          value={to}
          min={from || undefined}
          onChange={(e) => onTo(e.target.value)}
          aria-label={`${label} — по`}
          title={invalid ? 'Кінець періоду раніший за початок' : undefined}
          className={inputCls}
        />
      </span>
      {(from || to) && (
        <button
          type="button"
          onClick={() => { onFrom(''); onTo(''); }}
          aria-label="Очистити період"
          title="Очистити період"
          className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] leading-none transition-colors ${
            dark
              ? 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.08]'
              : 'text-stone-500 hover:text-stone-900 hover:bg-stone-200/70'
          }`}
        >
          ✕
        </button>
      )}
    </div>
  );
}
