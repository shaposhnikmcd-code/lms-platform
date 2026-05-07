'use client';

import Link from 'next/link';
import { HiOutlineBookOpen, HiOutlineCalendarDays, HiOutlineCubeTransparent } from 'react-icons/hi2';
import type { ProductSalesData, ProductSalesType } from '@/lib/admin-sales-by-product';
import type { SalesPeriod } from '@/lib/admin-sales-analytics';
import type { Theme } from './adminTheme';

type Props = {
  data: ProductSalesData;
  theme: Theme;
  activePeriod: SalesPeriod;
  periodOptions: { value: SalesPeriod; label: string }[];
  /// Базовий URL для побудови query: /dashboard/admin?productPeriod=...
  /// Зберігаємо існуючий ?period=, щоб не скидати фільтр графіка.
  baseQuery: string;
};

const ICON: Record<ProductSalesType, typeof HiOutlineBookOpen> = {
  course: HiOutlineBookOpen,
  cohort: HiOutlineCalendarDays,
  connector: HiOutlineCubeTransparent,
};

const TYPE_LABEL: Record<ProductSalesType, string> = {
  course: 'Курс',
  cohort: 'Річна програма',
  connector: 'Гра',
};

const TYPE_COLOR_LIGHT: Record<ProductSalesType, string> = {
  course: '#92400e',
  cohort: '#047857',
  connector: '#0369a1',
};
const TYPE_COLOR_DARK: Record<ProductSalesType, string> = {
  course: '#F2C76D',
  cohort: '#34d399',
  connector: '#38BDF8',
};

function fmtUah(n: number): string {
  return Math.round(n).toLocaleString('uk-UA').replace(/,/g, ' ');
}

export default function SalesByProductBlock({ data, theme, activePeriod, periodOptions, baseQuery }: Props) {
  const dark = theme === 'dark';
  const muted = dark ? 'text-slate-500' : 'text-stone-500';
  const subtle = dark ? 'text-slate-400' : 'text-stone-600';
  const titleClr = dark ? 'text-slate-100' : 'text-stone-900';
  const rowBorder = dark ? 'border-white/[0.05]' : 'border-stone-300/40';
  const rowHover = dark ? 'hover:bg-white/[0.03]' : 'hover:bg-stone-100/60';

  const max = data.rows.reduce((m, r) => Math.max(m, r.sum), 0);

  return (
    <div className="w-full">
      <div className="flex items-center gap-4 flex-wrap mb-4">
        <div className="min-w-0">
          <h3 className={`text-[14px] font-semibold tracking-tight ${dark ? 'text-white' : 'text-stone-900'}`}>
            Продажі по продуктах
          </h3>
          <p className={`text-[11px] mt-0.5 tabular-nums ${muted}`}>
            {data.rangeLabel} · {data.totalCount.toLocaleString('uk-UA')} продаж · {fmtUah(data.totalSum)} ₴
          </p>
        </div>
        <div
          className={`inline-flex flex-wrap rounded-lg p-0.5 border ${
            dark ? 'bg-black/30 border-white/[0.06]' : 'bg-stone-100/80 border-stone-300/50'
          }`}
        >
          {periodOptions.map(opt => {
            const active = opt.value === activePeriod;
            const params = new URLSearchParams(baseQuery);
            params.set('productPeriod', opt.value);
            return (
              <Link
                key={opt.value}
                href={`/dashboard/admin?${params.toString()}`}
                scroll={false}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all ${
                  active
                    ? dark
                      ? 'bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                      : 'bg-stone-900 text-white shadow-sm'
                    : dark
                      ? 'text-slate-500 hover:text-slate-200'
                      : 'text-stone-500 hover:text-stone-900'
                }`}
              >
                {opt.label}
              </Link>
            );
          })}
        </div>
      </div>

      {data.rows.length === 0 ? (
        <div className={`text-[12px] py-8 text-center ${muted}`}>
          За цей період продажів немає.
        </div>
      ) : (
        <div className="flex flex-col">
          {data.rows.map(r => {
            const Icon = ICON[r.type];
            const accent = dark ? TYPE_COLOR_DARK[r.type] : TYPE_COLOR_LIGHT[r.type];
            const pct = max > 0 ? (r.sum / max) * 100 : 0;
            return (
              <div
                key={r.key}
                className={`relative flex items-center gap-3 px-3 py-2.5 border-t ${rowBorder} ${rowHover} transition-colors`}
              >
                {/* Прогрес-бар фоном */}
                <div
                  className="absolute inset-y-0 left-0 rounded-r-md pointer-events-none"
                  style={{
                    width: `${Math.max(pct, r.sum > 0 ? 1 : 0)}%`,
                    background: dark
                      ? `linear-gradient(90deg, ${accent}14, ${accent}06)`
                      : `linear-gradient(90deg, ${accent}1a, ${accent}08)`,
                  }}
                />
                <Icon className="text-base flex-shrink-0 relative" style={{ color: accent }} />
                <div className="min-w-0 flex-1 relative">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] uppercase tracking-[0.14em] font-medium px-1.5 py-0.5 rounded flex-shrink-0`}
                      style={{
                        color: accent,
                        background: dark ? `${accent}18` : `${accent}14`,
                        border: `1px solid ${accent}33`,
                      }}
                    >
                      {TYPE_LABEL[r.type]}
                    </span>
                    <span className={`text-[12.5px] font-medium truncate ${titleClr}`} title={r.title}>
                      {r.title}
                    </span>
                  </div>
                  {r.subtitle && (
                    <div className={`text-[10.5px] truncate mt-0.5 ${subtle}`}>{r.subtitle}</div>
                  )}
                </div>
                <div className="flex items-baseline gap-3 flex-shrink-0 relative">
                  <div className="text-right">
                    <div className={`text-[10px] uppercase tracking-[0.14em] font-medium ${muted}`}>Кількість</div>
                    <div className={`text-[14px] font-semibold tabular-nums ${titleClr}`}>
                      {r.count.toLocaleString('uk-UA')}
                    </div>
                  </div>
                  <div className="text-right" style={{ minWidth: 110 }}>
                    <div className={`text-[10px] uppercase tracking-[0.14em] font-medium ${muted}`}>Сума</div>
                    <div className={`text-[14px] font-semibold tabular-nums ${titleClr}`}>
                      {fmtUah(r.sum)} <span className={`text-[11px] font-normal ${muted}`}>₴</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
