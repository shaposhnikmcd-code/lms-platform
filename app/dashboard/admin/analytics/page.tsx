import prisma from '@/lib/prisma';
import { FaChartLine, FaUsers, FaGraduationCap, FaDollarSign } from 'react-icons/fa';

export default async function AdminAnalytics() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));
  const sevenDaysAgo = new Date(new Date().setDate(new Date().getDate() - 7));

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
  ]);

  const courseIds = courseStats.map(c => c.courseId);
  const courses = await prisma.course.findMany({ where: { id: { in: courseIds } } });
  const courseMap = new Map(courses.map(c => [c.id, c]));

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