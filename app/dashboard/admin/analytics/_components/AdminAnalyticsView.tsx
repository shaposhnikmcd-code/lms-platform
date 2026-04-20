'use client';

import {
  HiOutlineUsers,
  HiOutlineAcademicCap,
  HiOutlineBanknotes,
  HiOutlineChartBar,
  HiOutlineSparkles,
} from 'react-icons/hi2';
import { useAdminTheme, type Theme, type Tone } from '../../_components/adminTheme';
import { AdminShell, AdminPanel } from '../../_components/AdminShell';
import SourceBadge from '../../_components/SourceBadge';

export interface AnalyticsData {
  totalUsers: number;
  newUsersMonth: number;
  newUsersWeek: number;
  totalEnrollments: number;
  newEnrollmentsMonth: number;
  totalRevenue: number;
  monthRevenue: number;
  weekRevenue: number;
  courseStats: Array<{ courseId: string; count: number; title: string }>;
  bundleByType: Record<'DISCOUNT' | 'FIXED_FREE' | 'CHOICE_FREE', { count: number; revenue: number }>;
  topBundles: Array<{ id: string; title: string; type: 'DISCOUNT' | 'FIXED_FREE' | 'CHOICE_FREE'; count: number; revenue: number }>;
  topFreeChoices: Array<{ slug: string; title: string; count: number }>;
  totalBundleSales: number;
  totalBundleRevenue: number;
  tetyana: {
    courseRevenue: number;
    courseCount: number;
    connectorRevenue: number;
    connectorCount: number;
  };
}

export default function AdminAnalyticsView({ data }: { data: AnalyticsData }) {
  const { theme, setTheme } = useAdminTheme();
  const dark = theme === 'dark';

  return (
    <AdminShell
      theme={theme}
      setTheme={setTheme}
      eyebrow="Admin · Аналітика"
      title="Аналітика"
      subtitle="Метрики продажів, активності користувачів і популярності курсів."
    >
      {/* KPI strip */}
      <div
        className={`mb-6 rounded-2xl grid grid-cols-2 lg:grid-cols-4 overflow-hidden backdrop-blur-sm border divide-y lg:divide-y-0 lg:divide-x ${
          dark
            ? 'bg-white/[0.03] border-white/[0.06] divide-white/[0.06]'
            : 'bg-white/55 border-stone-300/50 divide-stone-300/40 shadow-[0_1px_2px_rgba(68,64,60,0.04)]'
        }`}
      >
        <Kpi theme={theme} icon={HiOutlineUsers} label="Користувачів" value={data.totalUsers.toLocaleString()} />
        <Kpi theme={theme} icon={HiOutlineAcademicCap} label="Записів" value={data.totalEnrollments.toLocaleString()} />
        <Kpi theme={theme} icon={HiOutlineBanknotes} label="Дохід · всього" value={`${data.totalRevenue.toLocaleString()} ₴`} glow />
        <Kpi theme={theme} icon={HiOutlineChartBar} label="Дохід · 30д" value={`${data.monthRevenue.toLocaleString()} ₴`} />
      </div>

      <TetyanaStrip theme={theme} tetyana={data.tetyana} />

      {/* Row 1: Users + Sales */}
      <div className="grid md:grid-cols-2 gap-5 mb-6">
        <AdminPanel theme={theme}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className={`text-[15px] font-semibold tracking-tight ${dark ? 'text-white' : 'text-stone-900'}`}>
                Нові користувачі
              </h2>
              <p className={`text-[12px] mt-0.5 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                Динаміка реєстрацій
              </p>
            </div>
          </div>
          <div
            className={`grid grid-cols-3 rounded-xl overflow-hidden border divide-x ${
              dark
                ? 'bg-black/20 border-white/[0.04] divide-white/[0.04]'
                : 'bg-stone-50/60 border-stone-200/70 divide-stone-200/70'
            }`}
          >
            <MiniStat theme={theme} label="Тиждень" value={data.newUsersWeek} />
            <MiniStat theme={theme} label="Місяць" value={data.newUsersMonth} />
            <MiniStat theme={theme} label="Всього" value={data.totalUsers} />
          </div>
        </AdminPanel>

        <AdminPanel theme={theme}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className={`text-[15px] font-semibold tracking-tight ${dark ? 'text-white' : 'text-stone-900'}`}>
                Продажі
              </h2>
              <p className={`text-[12px] mt-0.5 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                Дохід і записи
              </p>
            </div>
          </div>
          <div
            className={`grid grid-cols-3 rounded-xl overflow-hidden border divide-x ${
              dark
                ? 'bg-black/20 border-white/[0.04] divide-white/[0.04]'
                : 'bg-stone-50/60 border-stone-200/70 divide-stone-200/70'
            }`}
          >
            <MiniStat theme={theme} label="Тиждень" value={`${data.weekRevenue.toLocaleString()} ₴`} small />
            <MiniStat theme={theme} label="Місяць" value={`${data.monthRevenue.toLocaleString()} ₴`} small />
            <MiniStat theme={theme} label="Записи · 30д" value={data.newEnrollmentsMonth} />
          </div>
        </AdminPanel>
      </div>

      {/* Bundles */}
      <AdminPanel theme={theme} className="mb-6">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
          <div>
            <h2 className={`text-[15px] font-semibold tracking-tight ${dark ? 'text-white' : 'text-stone-900'}`}>
              Пакети курсів
            </h2>
            <p className={`text-[12px] mt-0.5 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
              {data.totalBundleSales} продажів · {data.totalBundleRevenue.toLocaleString()} ₴
            </p>
          </div>
        </div>

        {/* By type */}
        <div
          className={`grid grid-cols-1 md:grid-cols-3 rounded-xl overflow-hidden mb-5 border divide-y md:divide-y-0 md:divide-x ${
            dark
              ? 'bg-black/20 border-white/[0.04] divide-white/[0.04]'
              : 'bg-stone-50/60 border-stone-200/70 divide-stone-200/70'
          }`}
        >
          {(['DISCOUNT', 'FIXED_FREE', 'CHOICE_FREE'] as const).map(t => {
            const stats = data.bundleByType[t];
            const typeLabel = t === 'DISCOUNT' ? 'Знижка' : t === 'FIXED_FREE' ? 'Сталий безкошт.' : 'Вибір безкошт.';
            const share = data.totalBundleSales > 0 ? Math.round((stats.count / data.totalBundleSales) * 100) : 0;
            return (
              <div key={t} className="px-4 py-4">
                <div
                  className={`text-[10px] uppercase tracking-[0.18em] font-medium mb-2 ${
                    dark ? 'text-slate-500' : 'text-stone-500'
                  }`}
                >
                  {typeLabel}
                </div>
                <div className="flex items-baseline gap-2 mb-1.5">
                  <span className={`text-[22px] font-semibold tabular-nums leading-none ${dark ? 'text-white' : 'text-stone-900'}`}>
                    {stats.count}
                  </span>
                  <span className={`text-[11px] ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
                    продажів · {share}%
                  </span>
                </div>
                <div className={`text-[12px] font-semibold tabular-nums ${dark ? 'text-amber-300' : 'text-amber-800'}`}>
                  {stats.revenue.toLocaleString()} ₴
                </div>
              </div>
            );
          })}
        </div>

        {/* Top bundles */}
        <div className={`text-[10px] uppercase tracking-[0.18em] font-medium mb-3 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
          Топ пакетів · дохід
        </div>
        {data.topBundles.length === 0 ? (
          <div className={`px-4 py-3 rounded-xl text-[12px] border ${
            dark ? 'bg-black/20 border-white/[0.04] text-slate-500' : 'bg-stone-50/60 border-stone-200/70 text-stone-500'
          }`}>
            Жодного продажу пакетів ще не було
          </div>
        ) : (
          <div className="space-y-3">
            {data.topBundles.map((b, i) => {
              const maxRev = data.topBundles[0].revenue;
              const percent = maxRev > 0 ? Math.round((b.revenue / maxRev) * 100) : 0;
              return (
                <div key={b.id}>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <TypeBadge theme={theme} type={b.type} />
                      <span className={`text-[13px] truncate ${dark ? 'text-slate-200' : 'text-stone-800'}`}>
                        {b.title}
                      </span>
                    </div>
                    <span className={`shrink-0 text-[12px] font-semibold tabular-nums ${dark ? 'text-slate-100' : 'text-stone-900'}`}>
                      {b.count}× · {b.revenue.toLocaleString()} ₴
                    </span>
                  </div>
                  <div className={`w-full h-1.5 rounded-full overflow-hidden ${dark ? 'bg-white/[0.05]' : 'bg-stone-200/70'}`}>
                    <div
                      className={`h-full rounded-full transition-all ${i === 0
                        ? dark ? 'bg-gradient-to-r from-amber-400 to-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.4)]' : 'bg-gradient-to-r from-amber-600 to-amber-500'
                        : dark ? 'bg-gradient-to-r from-amber-500/60 to-amber-400/60' : 'bg-gradient-to-r from-amber-500/80 to-amber-400/80'
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* CHOICE_FREE picks */}
        {data.topFreeChoices.length > 0 && (
          <div className={`mt-6 pt-5 border-t ${dark ? 'border-white/[0.06]' : 'border-stone-300/50'}`}>
            <div className={`flex items-center gap-2 mb-3 text-[10px] uppercase tracking-[0.18em] font-medium ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
              <HiOutlineSparkles className="text-xs" />
              Популярний вибір у CHOICE_FREE
            </div>
            <div className="space-y-2.5">
              {data.topFreeChoices.map((x, i) => {
                const maxCount = data.topFreeChoices[0].count;
                const percent = Math.round((x.count / maxCount) * 100);
                return (
                  <div key={x.slug}>
                    <div className="flex justify-between items-baseline text-[12px] mb-1">
                      <span className={`truncate ${dark ? 'text-slate-300' : 'text-stone-700'}`}>{x.title}</span>
                      <span className={`shrink-0 ml-3 font-semibold tabular-nums ${dark ? 'text-slate-100' : 'text-stone-900'}`}>{x.count}</span>
                    </div>
                    <div className={`w-full h-1 rounded-full overflow-hidden ${dark ? 'bg-white/[0.05]' : 'bg-stone-200/70'}`}>
                      <div
                        className={`h-full rounded-full ${i === 0
                          ? dark ? 'bg-gradient-to-r from-emerald-400 to-emerald-300' : 'bg-gradient-to-r from-emerald-600 to-emerald-500'
                          : dark ? 'bg-gradient-to-r from-emerald-500/60 to-emerald-400/60' : 'bg-gradient-to-r from-emerald-500/80 to-emerald-400/80'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </AdminPanel>

      {/* Course popularity */}
      <AdminPanel theme={theme}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className={`text-[15px] font-semibold tracking-tight ${dark ? 'text-white' : 'text-stone-900'}`}>
              Популярність курсів
            </h2>
            <p className={`text-[12px] mt-0.5 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
              За кількістю записів
            </p>
          </div>
        </div>
        {data.courseStats.length === 0 ? (
          <div className={`px-4 py-3 rounded-xl text-[12px] border ${
            dark ? 'bg-black/20 border-white/[0.04] text-slate-500' : 'bg-stone-50/60 border-stone-200/70 text-stone-500'
          }`}>
            Даних ще немає
          </div>
        ) : (
          <div className="space-y-3">
            {data.courseStats.map((c, i) => {
              const maxCount = data.courseStats[0].count;
              const percent = Math.round((c.count / maxCount) * 100);
              return (
                <div key={c.courseId}>
                  <div className="flex justify-between items-baseline text-[13px] mb-1.5 gap-3">
                    <span className={`truncate ${dark ? 'text-slate-200' : 'text-stone-800'}`}>{c.title}</span>
                    <span className={`shrink-0 font-semibold tabular-nums ${dark ? 'text-slate-100' : 'text-stone-900'}`}>
                      {c.count} {pluralize(c.count, ['студент', 'студенти', 'студентів'])}
                    </span>
                  </div>
                  <div className={`w-full h-1.5 rounded-full overflow-hidden ${dark ? 'bg-white/[0.05]' : 'bg-stone-200/70'}`}>
                    <div
                      className={`h-full rounded-full transition-all ${i === 0
                        ? dark ? 'bg-gradient-to-r from-indigo-400 to-indigo-300 shadow-[0_0_10px_rgba(129,140,248,0.4)]' : 'bg-gradient-to-r from-indigo-600 to-indigo-500'
                        : dark ? 'bg-gradient-to-r from-indigo-500/60 to-indigo-400/60' : 'bg-gradient-to-r from-indigo-500/80 to-indigo-400/80'
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </AdminPanel>
    </AdminShell>
  );
}

function TetyanaStrip({
  theme,
  tetyana,
}: {
  theme: Theme;
  tetyana: AnalyticsData['tetyana'];
}) {
  const totalRevenue = tetyana.courseRevenue + tetyana.connectorRevenue;
  const totalCount = tetyana.courseCount + tetyana.connectorCount;
  if (totalCount === 0) return null;

  const dark = theme === 'dark';
  const parts: string[] = [];
  if (tetyana.courseCount > 0) {
    parts.push(
      `${tetyana.courseCount} ${pluralize(tetyana.courseCount, ['курс', 'курси', 'курсів'])}`,
    );
  }
  if (tetyana.connectorCount > 0) {
    parts.push(
      `${tetyana.connectorCount} ${pluralize(tetyana.connectorCount, ['гра', 'гри', 'ігор'])}`,
    );
  }

  return (
    <div
      className={`mb-6 rounded-xl px-4 py-3 border flex items-center gap-3 flex-wrap ${
        dark
          ? 'bg-amber-500/[0.05] border-amber-500/20'
          : 'bg-amber-50/70 border-amber-300/40'
      }`}
    >
      <SourceBadge source="TETYANA" size={24} />
      <div className="flex-1 min-w-0">
        <div
          className={`text-[11px] uppercase tracking-[0.16em] font-medium mb-0.5 ${
            dark ? 'text-amber-300/70' : 'text-amber-800/80'
          }`}
        >
          З персонального сайту Тетяни Шапошник
        </div>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span
            className={`text-[17px] font-semibold tabular-nums ${
              dark ? 'text-amber-100' : 'text-amber-900'
            }`}
          >
            {totalRevenue.toLocaleString()} ₴
          </span>
          <span
            className={`text-[12px] ${dark ? 'text-slate-400' : 'text-stone-600'}`}
          >
            · {totalCount} {pluralize(totalCount, ['замовлення', 'замовлення', 'замовлень'])}
            {parts.length > 0 && ` (${parts.join(' · ')})`}
          </span>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  glow = false,
  theme,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  glow?: boolean;
  theme: Theme;
}) {
  const dark = theme === 'dark';
  return (
    <div className="px-5 py-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`text-sm ${dark ? 'text-slate-500' : 'text-stone-500'}`} />
        <div
          className={`text-[10px] uppercase tracking-[0.18em] font-medium ${
            dark ? 'text-slate-500' : 'text-stone-500'
          }`}
        >
          {label}
        </div>
      </div>
      <div
        className={`text-[24px] font-semibold tabular-nums leading-none ${
          glow
            ? dark
              ? 'text-amber-200 drop-shadow-[0_0_16px_rgba(251,191,36,0.25)]'
              : 'text-amber-800 drop-shadow-[0_0_14px_rgba(180,83,9,0.2)]'
            : dark
              ? 'text-white'
              : 'text-stone-900'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone = 'neutral',
  small = false,
  theme,
}: {
  label: string;
  value: string | number;
  tone?: Tone;
  small?: boolean;
  theme: Theme;
}) {
  const dark = theme === 'dark';
  const toneColor: Record<Tone, { dark: string; light: string }> = {
    neutral: { dark: 'text-slate-100', light: 'text-stone-900' },
    success: { dark: 'text-emerald-300', light: 'text-emerald-800' },
    warning: { dark: 'text-amber-300', light: 'text-amber-800' },
    danger: { dark: 'text-rose-300', light: 'text-rose-700' },
  };
  return (
    <div className="px-4 py-3.5">
      <div
        className={`text-[10px] uppercase tracking-[0.18em] font-medium mb-1.5 truncate ${
          dark ? 'text-slate-500' : 'text-stone-500'
        }`}
      >
        {label}
      </div>
      <div
        className={`${small ? 'text-[13px]' : 'text-[18px]'} font-semibold tabular-nums leading-tight ${
          dark ? toneColor[tone].dark : toneColor[tone].light
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function TypeBadge({ theme, type }: { theme: Theme; type: 'DISCOUNT' | 'FIXED_FREE' | 'CHOICE_FREE' }) {
  const dark = theme === 'dark';
  const map: Record<typeof type, { label: string; dark: string; light: string }> = {
    DISCOUNT:    { label: 'Знижка',  dark: 'bg-violet-500/15 text-violet-300 border-violet-500/20',   light: 'bg-violet-500/10 text-violet-800 border-violet-500/25' },
    FIXED_FREE:  { label: 'Сталий',  dark: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20', light: 'bg-emerald-500/10 text-emerald-800 border-emerald-500/25' },
    CHOICE_FREE: { label: 'Вибір',   dark: 'bg-sky-500/15 text-sky-300 border-sky-500/20',             light: 'bg-sky-500/10 text-sky-800 border-sky-500/25' },
  };
  const m = map[type];
  return (
    <span
      className={`shrink-0 px-2 py-0.5 text-[10px] font-semibold rounded-md border ${
        dark ? m.dark : m.light
      }`}
    >
      {m.label}
    </span>
  );
}

function pluralize(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const n1 = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (n1 > 1 && n1 < 5) return forms[1];
  if (n1 === 1) return forms[0];
  return forms[2];
}
