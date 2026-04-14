import prisma from '@/lib/prisma';
import { FaChartLine, FaUsers, FaGraduationCap, FaDollarSign } from 'react-icons/fa';

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

export default async function AdminAnalytics() {
  const thirtyDaysAgo = daysAgo(30);
  const sevenDaysAgo = daysAgo(7);

  const [
    totalUsers,
    newUsersMonth,
    newUsersWeek,
    totalEnrollments,
    newEnrollmentsMonth,
    paidPayments,
    monthPayments,
    weekPayments,
    courseStats,
    bundlePayments,
    allBundles,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.enrollment.count(),
    prisma.enrollment.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.payment.aggregate({ where: { status: 'PAID' }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { status: 'PAID', createdAt: { gte: thirtyDaysAgo } }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { status: 'PAID', createdAt: { gte: sevenDaysAgo } }, _sum: { amount: true } }),
    prisma.enrollment.groupBy({
      by: ['courseId'],
      _count: { courseId: true },
      orderBy: { _count: { courseId: 'desc' } },
    }),
    prisma.payment.findMany({
      where: { status: 'PAID', bundleId: { not: null } },
      select: { bundleId: true, amount: true, freeSlugs: true, createdAt: true },
    }),
    prisma.bundle.findMany({
      select: { id: true, title: true, type: true, paidCount: true, freeCount: true },
    }),
  ]);

  const courseIds = courseStats.map(c => c.courseId);
  const courses = await prisma.course.findMany({ where: { id: { in: courseIds } } });
  const courseMap = new Map(courses.map(c => [c.id, c]));

  // --- Bundle analytics aggregation ---
  const bundleMap = new Map(allBundles.map((b) => [b.id, b]));

  const byBundle = new Map<string, { count: number; revenue: number }>();
  const byType: Record<string, { count: number; revenue: number }> = {
    DISCOUNT: { count: 0, revenue: 0 },
    FIXED_FREE: { count: 0, revenue: 0 },
    CHOICE_FREE: { count: 0, revenue: 0 },
  };
  const freeChoiceFreq = new Map<string, number>();

  for (const p of bundlePayments) {
    if (!p.bundleId) continue;
    const stats = byBundle.get(p.bundleId) ?? { count: 0, revenue: 0 };
    stats.count += 1;
    stats.revenue += p.amount;
    byBundle.set(p.bundleId, stats);

    const b = bundleMap.get(p.bundleId);
    if (b) {
      byType[b.type].count += 1;
      byType[b.type].revenue += p.amount;
      if (b.type === 'CHOICE_FREE') {
        for (const slug of p.freeSlugs ?? []) {
          freeChoiceFreq.set(slug, (freeChoiceFreq.get(slug) ?? 0) + 1);
        }
      }
    }
  }

  const topBundles = [...byBundle.entries()]
    .map(([id, s]) => ({ id, bundle: bundleMap.get(id), ...s }))
    .filter((x) => x.bundle)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const totalBundleSales = bundlePayments.length;
  const totalBundleRevenue = bundlePayments.reduce((s, p) => s + p.amount, 0);

  const topFreeChoices = [...freeChoiceFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const metrics = [
    { label: 'Всього користувачів', value: totalUsers.toLocaleString(), icon: FaUsers, iconColor: 'text-indigo-600', iconBg: 'bg-indigo-50', ring: 'ring-indigo-100', accent: 'from-indigo-500/15 to-indigo-500/5' },
    { label: 'Всього записів', value: totalEnrollments.toLocaleString(), icon: FaGraduationCap, iconColor: 'text-emerald-600', iconBg: 'bg-emerald-50', ring: 'ring-emerald-100', accent: 'from-emerald-500/15 to-emerald-500/5' },
    { label: 'Загальний дохід', value: `${(paidPayments._sum.amount || 0).toLocaleString()} ₴`, icon: FaDollarSign, iconColor: 'text-amber-600', iconBg: 'bg-amber-50', ring: 'ring-amber-100', accent: 'from-amber-500/15 to-amber-500/5' },
    { label: 'Дохід за місяць', value: `${(monthPayments._sum.amount || 0).toLocaleString()} ₴`, icon: FaChartLine, iconColor: 'text-sky-600', iconBg: 'bg-sky-50', ring: 'ring-sky-100', accent: 'from-sky-500/15 to-sky-500/5' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold text-slate-800 mb-8">Аналітика</h1>

      {/* Головні метрики */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {metrics.map((stat) => (
          <div key={stat.label} className="relative overflow-hidden bg-white rounded-xl border border-slate-200/70 px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:shadow-[0_6px_18px_-12px_rgba(15,23,42,0.15)] hover:-translate-y-0.5 transition-all duration-300">
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.accent} pointer-events-none`} />
            <div className="relative flex items-center gap-3">
              <div className={`w-9 h-9 ${stat.iconBg} ring-1 ${stat.ring} rounded-lg flex items-center justify-center flex-shrink-0`}>
                <stat.icon className={`text-base ${stat.iconColor}`} />
              </div>
              <div className="min-w-0">
                <div className="text-lg font-bold text-slate-800 tracking-tight tabular-nums leading-tight">{stat.value}</div>
                <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wider truncate">{stat.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Користувачі */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-7">
          <h2 className="text-lg font-semibold text-slate-800 mb-5">Нові користувачі</h2>
          <div className="space-y-3">
            {[
              { label: 'За тиждень', value: newUsersWeek },
              { label: 'За місяць', value: newUsersMonth },
              { label: 'Всього', value: totalUsers },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <span className="text-sm text-slate-600">{item.label}</span>
                <span className="font-semibold text-slate-800 tabular-nums">{item.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Продажі */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-7">
          <h2 className="text-lg font-semibold text-slate-800 mb-5">Продажі</h2>
          <div className="space-y-3">
            {[
              { label: 'За тиждень', value: `${(weekPayments._sum.amount || 0).toLocaleString()} ₴` },
              { label: 'За місяць', value: `${(monthPayments._sum.amount || 0).toLocaleString()} ₴` },
              { label: 'Нових записів за місяць', value: newEnrollmentsMonth.toLocaleString() },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <span className="text-sm text-slate-600">{item.label}</span>
                <span className="font-semibold text-slate-800 tabular-nums">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bundle analytics */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-7 mb-6">
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="text-lg font-semibold text-slate-800">Пакети курсів</h2>
          <p className="text-xs text-slate-500">
            Всього продажів: <span className="font-semibold text-slate-700 tabular-nums">{totalBundleSales}</span> · Дохід: <span className="font-semibold text-slate-700 tabular-nums">{totalBundleRevenue.toLocaleString()} ₴</span>
          </p>
        </div>

        {/* By type */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          {(['DISCOUNT', 'FIXED_FREE', 'CHOICE_FREE'] as const).map((t) => {
            const stats = byType[t];
            const typeLabel = t === 'DISCOUNT' ? 'Знижка' : t === 'FIXED_FREE' ? '3-й безкоштовний (сталий)' : '3-й безкоштовний (вибір)';
            const share = totalBundleSales > 0 ? Math.round((stats.count / totalBundleSales) * 100) : 0;
            return (
              <div key={t} className="border border-slate-200 rounded-xl p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  {typeLabel}
                </p>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-2xl font-bold text-slate-800 tabular-nums">{stats.count}</span>
                  <span className="text-xs text-slate-500">продажів ({share}%)</span>
                </div>
                <p className="text-sm font-semibold text-amber-700 tabular-nums">
                  {stats.revenue.toLocaleString()} ₴
                </p>
              </div>
            );
          })}
        </div>

        {/* Top bundles */}
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Топ пакетів за доходом</h3>
        {topBundles.length === 0 ? (
          <p className="text-sm text-slate-400">Жодного продажу пакетів ще не було</p>
        ) : (
          <div className="space-y-3">
            {topBundles.map((b) => {
              const maxRev = topBundles[0].revenue;
              const percent = maxRev > 0 ? Math.round((b.revenue / maxRev) * 100) : 0;
              const typeBadge = b.bundle!.type === 'DISCOUNT' ? { label: 'Знижка', cls: 'bg-violet-100 text-violet-700' } : b.bundle!.type === 'FIXED_FREE' ? { label: 'Сталий безкошт.', cls: 'bg-emerald-100 text-emerald-700' } : { label: 'Вибір', cls: 'bg-sky-100 text-sky-700' };
              return (
                <div key={b.id}>
                  <div className="flex justify-between items-center text-sm mb-1.5 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`shrink-0 px-2 py-0.5 text-[10px] font-semibold rounded ${typeBadge.cls}`}>
                        {typeBadge.label}
                      </span>
                      <span className="text-slate-700 truncate">{b.bundle!.title}</span>
                    </div>
                    <span className="shrink-0 font-semibold text-slate-800 tabular-nums">
                      {b.count} × · {b.revenue.toLocaleString()} ₴
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* CHOICE_FREE picks */}
        {topFreeChoices.length > 0 && (
          <div className="mt-6 pt-5 border-t border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Популярний вибір у CHOICE_FREE</h3>
            <div className="space-y-2">
              {topFreeChoices.map(([slug, count]) => {
                const course = courses.find((c) => c.slug === slug || c.id === slug);
                const maxCount = topFreeChoices[0][1];
                const percent = Math.round((count / maxCount) * 100);
                return (
                  <div key={slug}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600">{course?.title ?? slug}</span>
                      <span className="font-semibold text-slate-700 tabular-nums">{count}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Популярність курсів */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-7">
        <h2 className="text-lg font-semibold text-slate-800 mb-5">Популярність курсів</h2>
        {courseStats.length === 0 ? (
          <p className="text-slate-400 text-sm">Даних ще немає</p>
        ) : (
          <div className="space-y-4">
            {courseStats.map((stat) => {
              const course = courseMap.get(stat.courseId);
              if (!course) return null;
              const maxCount = courseStats[0]._count.courseId;
              const percent = Math.round((stat._count.courseId / maxCount) * 100);
              return (
                <div key={stat.courseId}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-slate-700">{course.title}</span>
                    <span className="font-semibold text-slate-800 tabular-nums">{stat._count.courseId} студентів</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full transition-all"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}