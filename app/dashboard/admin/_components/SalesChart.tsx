'use client';

import { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import type { SalesSeries, CategoryKey } from '@/lib/admin-sales-analytics';
import type { Theme } from './adminTheme';

type Props = {
  series: SalesSeries;
  theme: Theme;
};

const CATEGORIES: { key: CategoryKey; label: string; color: string }[] = [
  { key: 'courses', label: 'Курси', color: '#F2C76D' },
  { key: 'bundles', label: 'Пакети', color: '#D4A843' },
  { key: 'yearly', label: 'Річна програма', color: '#10B981' },
  { key: 'connector', label: 'Гра Конектор', color: '#38BDF8' },
];

/// Порядок укладання областей у стеку (перший = нижній шар).
/// Конектор має лежати ПІД іншими, тож він перший.
const STACK_ORDER: CategoryKey[] = ['connector', 'courses', 'bundles', 'yearly'];
const STACKED_CATEGORIES = STACK_ORDER.map(k => CATEGORIES.find(c => c.key === k)!);

function formatK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(Math.round(n));
}

function formatUah(n: number): string {
  return `${n.toLocaleString('uk-UA')} ₴`;
}

function formatBig(n: number): string {
  return Math.round(n).toLocaleString('uk-UA').replace(/,/g, ' ');
}

export default function SalesChart({ series, theme }: Props) {
  const dark = theme === 'dark';

  const data = useMemo(() => series.buckets.map(b => ({
    key: b.key,
    label: b.label,
    courses: b.courses,
    bundles: b.bundles,
    yearly: b.yearly,
    connector: b.connector,
    total: b.courses + b.bundles + b.yearly + b.connector,
  })), [series.buckets]);

  const totalAll = series.totals.all;
  const previousTotal = series.previousTotal;
  const deltaPct = previousTotal > 0
    ? Math.round(((totalAll - previousTotal) / previousTotal) * 100)
    : (totalAll > 0 ? 100 : 0);

  const breakdown = useMemo(() => {
    const items = CATEGORIES.map(c => ({
      ...c,
      total: series.totals[c.key as 'courses' | 'bundles' | 'yearly' | 'connector'],
    }));
    items.sort((a, b) => b.total - a.total);
    return items.map(it => ({ ...it, pct: totalAll > 0 ? (it.total / totalAll) * 100 : 0 }));
  }, [series.totals, totalAll]);

  /// Тижні (тільки на day-гранулярності) — для тижневих підсумків під X-віссю.
  const weekRanges = useMemo(() => {
    if (series.granularity !== 'day') return [];
    const result: { startKey: string; endKey: string; total: number; weekNum: number; dayCount: number }[] = [];
    let blockStart = 0;
    let weekNum = 0;
    series.buckets.forEach((b, i) => {
      if (b.weekTotal && b.weekTotal > 0) {
        weekNum++;
        result.push({
          startKey: series.buckets[blockStart].key,
          endKey: b.key,
          total: b.weekTotal,
          weekNum,
          dayCount: i - blockStart + 1,
        });
        blockStart = i + 1;
      }
    });
    /// Якщо останні дні без завершеного тижня (середина тижня в кінці місяця) —
    /// додаємо як "обірваний" тиждень з накопиченою сумою.
    if (blockStart < series.buckets.length) {
      let acc = 0;
      for (let i = blockStart; i < series.buckets.length; i++) {
        const b = series.buckets[i];
        acc += b.courses + b.bundles + b.yearly + b.connector;
      }
      if (acc > 0 || series.buckets.length - blockStart > 0) {
        weekNum++;
        result.push({
          startKey: series.buckets[blockStart].key,
          endKey: series.buckets[series.buckets.length - 1].key,
          total: acc,
          weekNum,
          dayCount: series.buckets.length - blockStart,
        });
      }
    }
    return result;
  }, [series.buckets, series.granularity]);

  /// Round Y-axis max to a nice value (1, 2, 5 × 10^n) щоб overlay-числа сиділи точно.
  const niceMax = useMemo(() => {
    const max = Math.max(0, ...data.map(d => d.total)) || 1;
    const exp = Math.pow(10, Math.floor(Math.log10(max)));
    const f = max / exp;
    let nice;
    if (f <= 1) nice = 1;
    else if (f <= 2) nice = 2;
    else if (f <= 5) nice = 5;
    else nice = 10;
    return nice * exp;
  }, [data]);

  /// Явний список tick-індексів для XAxis. Для day — кожен 2-й день (15 міток на 30 днів),
  /// для week/month — всі без декімації, бо їх і так не багато.
  const xTicks = useMemo(() => {
    const len = data.length;
    if (series.granularity !== 'day' || len <= 16) return data.map(d => d.key);
    const step = 2;
    const result: string[] = [];
    for (let i = 0; i < len; i += step) result.push(data[i].key);
    if (result[result.length - 1] !== data[len - 1].key) result.push(data[len - 1].key);
    return result;
  }, [data, series.granularity]);

  const gridStroke = dark ? 'rgba(255,255,255,0.05)' : 'rgba(68,64,60,0.06)';
  const axisColor = dark ? 'rgba(148,163,184,0.6)' : 'rgba(120,113,108,0.75)';
  const tooltipBg = dark ? '#0f172a' : '#ffffff';
  const tooltipBorder = dark ? 'rgba(255,255,255,0.08)' : 'rgba(168,162,158,0.4)';
  const tooltipText = dark ? '#e2e8f0' : '#292524';

  type TooltipItem = { name?: unknown; value?: unknown; color?: string; dataKey?: unknown };
  type TooltipProps = { active?: boolean; payload?: readonly TooltipItem[]; label?: unknown };
  const renderTooltip = ({ active, payload, label }: TooltipProps) => {
    if (!active || !payload || !payload.length) return null;
    const items = payload.filter(p => String(p.dataKey) !== 'total');
    const total = items.reduce((s, p) => s + Number(p.value ?? 0), 0);
    if (total === 0) return null;
    /// label у нашій схемі — це key (YYYY-MM-DD). Lookup у data.label.
    const row = data.find(d => d.key === label);
    return (
      <div
        style={{
          background: tooltipBg,
          border: `1px solid ${tooltipBorder}`,
          borderRadius: 12,
          padding: '12px 14px',
          boxShadow: dark ? '0 12px 32px rgba(0,0,0,0.5)' : '0 12px 32px rgba(68,64,60,0.18)',
          fontSize: 12,
          color: tooltipText,
          minWidth: 220,
        }}
      >
        <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
          {row?.label ?? String(label ?? '')}
        </div>
        {items.map(p => Number(p.value ?? 0) > 0 && (
          <div key={String(p.dataKey ?? p.name ?? '')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '3px 0' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: p.color }} />
              <span style={{ opacity: 0.85 }}>{String(p.name ?? '')}</span>
            </span>
            <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {formatUah(Number(p.value ?? 0))}
            </span>
          </div>
        ))}
        <div style={{
          marginTop: 8, paddingTop: 8, borderTop: `1px solid ${tooltipBorder}`,
          display: 'flex', justifyContent: 'space-between', gap: 14,
          fontSize: 12, fontWeight: 700,
        }}>
          <span style={{ opacity: 0.7 }}>Всього</span>
          <span style={{ fontVariantNumeric: 'tabular-nums', color: dark ? '#F2C76D' : '#92400e' }}>
            {formatUah(total)}
          </span>
        </div>
      </div>
    );
  };

  const trendPositive = deltaPct >= 0;
  const deltaColor = trendPositive
    ? (dark ? '#34d399' : '#047857')
    : (dark ? '#fb7185' : '#be123c');

  /// Геометрія chart-area для overlay.
  const chartHeight = 360;
  const chartTopMargin = 16;
  const chartBottomAxis = 28;
  const dataAreaHeight = chartHeight - chartTopMargin - chartBottomAxis;

  return (
    <div className="w-full">
      {/* ========= ВЕРХНЯ СМУГА: Hero число + Категорії в одному рядку ========= */}
      <div className="flex items-start justify-between gap-8 flex-wrap mb-6">
        <div className="min-w-0">
          <div className={`text-[10.5px] uppercase tracking-[0.2em] font-semibold mb-2 ${
            dark ? 'text-slate-500' : 'text-stone-500'
          }`}>
            Загальний обіг
          </div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <span
              className={`text-[44px] font-semibold tabular-nums leading-none tracking-tight ${
                dark ? 'text-white' : 'text-stone-900'
              }`}
            >
              {formatBig(totalAll)}
              <span className={`ml-2 text-[20px] font-normal ${dark ? 'text-slate-500' : 'text-stone-500'}`}>₴</span>
            </span>
            {previousTotal > 0 && (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold tabular-nums"
                style={{
                  color: deltaColor,
                  background: trendPositive
                    ? (dark ? 'rgba(52,211,153,0.1)' : 'rgba(4,120,87,0.08)')
                    : (dark ? 'rgba(251,113,133,0.1)' : 'rgba(190,18,60,0.08)'),
                  border: `1px solid ${trendPositive
                    ? (dark ? 'rgba(52,211,153,0.2)' : 'rgba(4,120,87,0.18)')
                    : (dark ? 'rgba(251,113,133,0.2)' : 'rgba(190,18,60,0.18)')}`,
                }}
              >
                <span style={{ fontSize: 14, lineHeight: 1 }}>{trendPositive ? '↗' : '↘'}</span>
                {trendPositive ? '+' : ''}{deltaPct}%
                <span className={`font-medium ${dark ? 'opacity-70' : 'opacity-65'}`}>
                  vs {series.previousLabel}
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Категорії — компактна мережа з кольоровою смугою прогресу */}
        <div className="flex-1 min-w-[320px] max-w-[560px]">
          <div className={`text-[10.5px] uppercase tracking-[0.2em] font-semibold mb-2 text-right ${
            dark ? 'text-slate-500' : 'text-stone-500'
          }`}>
            Розподіл за категоріями
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {breakdown.map(b => (
              <div key={b.key}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: 2,
                        background: b.color,
                        boxShadow: `0 0 6px ${b.color}66`,
                      }}
                    />
                    <span className={`text-[11.5px] font-medium truncate ${dark ? 'text-slate-200' : 'text-stone-800'}`}>
                      {b.label}
                    </span>
                  </span>
                  <span className="flex items-baseline gap-1 flex-shrink-0">
                    <span className={`text-[12px] font-semibold tabular-nums ${dark ? 'text-white' : 'text-stone-900'}`}>
                      {formatK(b.total)}
                    </span>
                    <span className={`text-[10px] tabular-nums ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                      ₴ · {b.pct.toFixed(0)}%
                    </span>
                  </span>
                </div>
                <div className={`relative h-1 rounded-full overflow-hidden ${dark ? 'bg-white/[0.04]' : 'bg-stone-200/60'}`}>
                  <div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      width: `${Math.max(b.pct, b.total > 0 ? 2 : 0)}%`,
                      background: `linear-gradient(90deg, ${b.color}, ${b.color}dd)`,
                      boxShadow: `0 0 8px ${b.color}40`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ========= ЧАРТ — full width ========= */}
      <div
        className="relative"
        style={{ height: chartHeight }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: chartTopMargin, right: 8, left: 0, bottom: 0 }}>
            <defs>
              {CATEGORIES.map(c => (
                <linearGradient key={c.key} id={`area-${c.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={c.color} stopOpacity={0.55} />
                  <stop offset="100%" stopColor={c.color} stopOpacity={0.05} />
                </linearGradient>
              ))}
            </defs>

            <CartesianGrid stroke={gridStroke} vertical={false} strokeDasharray="2 4" />

            <XAxis
              dataKey="key"
              tick={{ fontSize: 10.5, fill: axisColor, fontWeight: 500 }}
              axisLine={{ stroke: gridStroke }}
              tickLine={false}
              ticks={xTicks}
              tickFormatter={(v) => data.find(d => d.key === v)?.label ?? ''}
              dy={6}
            />
            <YAxis
              tick={{ fontSize: 10.5, fill: axisColor, fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={formatK}
              width={48}
              domain={[0, niceMax]}
            />

            <Tooltip
              content={renderTooltip}
              cursor={{ stroke: dark ? 'rgba(212,168,67,0.4)' : 'rgba(180,83,9,0.32)', strokeWidth: 1, strokeDasharray: '3 4' }}
            />

            {STACKED_CATEGORIES.map(c => (
              <Area
                key={c.key}
                type="monotone"
                dataKey={c.key}
                stackId="sales"
                stroke={c.color}
                strokeWidth={2}
                fill={`url(#area-${c.key})`}
                isAnimationActive={false}
                name={c.label}
                activeDot={{ r: 4, strokeWidth: 2, stroke: dark ? '#0f172a' : '#fff', fill: c.color }}
                connectNulls
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>

        {/* Overlay з денною сумою — завжди видно (навіть на hover). Tooltip
            відцентрований по бару й має повністю непрозорий фон, тож накриває
            числа без візуальних артефактів коли вони збігаються. */}
        <div
          className="absolute pointer-events-none"
          style={{
            left: 48,
            right: 8,
            top: 0,
            bottom: chartBottomAxis,
          }}
        >
          <div
            className="grid h-full"
            style={{ gridTemplateColumns: `repeat(${data.length}, 1fr)` }}
          >
            {data.map(d => {
              if (d.total === 0) return <div key={d.key} />;
              const ratio = d.total / niceMax;
              const pointY = chartTopMargin + dataAreaHeight * (1 - ratio);
              const labelTop = Math.max(0, pointY - 16);
              return (
                <div key={d.key} className="relative flex justify-center">
                  <div
                    className={`absolute text-[9.5px] font-semibold tabular-nums whitespace-nowrap leading-none ${
                      dark ? 'text-amber-200' : 'text-amber-900'
                    }`}
                    style={{
                      top: labelTop,
                      textShadow: dark
                        ? '0 1px 4px rgba(15,23,42,0.85), 0 0 10px rgba(15,23,42,0.7)'
                        : '0 1px 3px rgba(255,255,255,0.95), 0 0 8px rgba(255,255,255,0.8)',
                    }}
                  >
                    {formatK(d.total)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Тижневі підсумки — під X-віссю, рівно вирівняно з даними чарту через padding,
          що відповідає YAxis.width і chart-margin.right. Кожен тиждень — flex-сегмент
          пропорційний кількості днів, з тонким золотим розділювачем між тижнями. */}
      {series.granularity === 'day' && weekRanges.length > 0 && (
        <div
          className="flex mt-1"
          style={{ paddingLeft: 48, paddingRight: 8 }}
        >
          {weekRanges.map((w, i) => (
            <div
              key={w.weekNum}
              style={{ flex: w.dayCount }}
              className={`flex flex-col items-center justify-center text-center px-1 py-2 ${
                i > 0
                  ? dark ? 'border-l border-amber-500/15' : 'border-l border-amber-500/25'
                  : ''
              }`}
            >
              <span
                className={`text-[9px] uppercase tracking-[0.18em] font-semibold ${
                  dark ? 'text-amber-300/65' : 'text-amber-800/70'
                }`}
              >
                Тиждень {w.weekNum}
              </span>
              <span
                className={`text-[12.5px] font-bold tabular-nums leading-tight mt-0.5 ${
                  dark ? 'text-amber-200' : 'text-amber-900'
                }`}
                style={{
                  textShadow: dark ? '0 0 14px rgba(251,191,36,0.22)' : 'none',
                }}
              >
                {formatK(w.total)} <span className="text-[10px] opacity-70 font-medium">₴</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
