import { FaUsers, FaGraduationCap, FaChartLine } from "react-icons/fa";
import { HiOutlineCurrencyDollar, HiOutlineUserGroup, HiOutlineBookOpen, HiOutlineNewspaper, HiOutlineChartBar, HiOutlineCreditCard } from "react-icons/hi2";
import Link from "next/link";
import prisma from "@/lib/prisma";
import SyncDivisionsButton from "./_components/SyncDivisionsButton";

export default async function AdminDashboard() {
  const [
    totalUsers,
    totalEnrollments,
    recentPayments,
    popularCourses,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.enrollment.count(),
    prisma.payment.count({
      where: {
        status: 'PAID',
        createdAt: { gte: new Date(new Date().setDate(new Date().getDate() - 30)) },
      },
    }),
    prisma.enrollment.groupBy({
      by: ['courseId'],
      _count: { courseId: true },
      orderBy: { _count: { courseId: 'desc' } },
      take: 5,
    }),
  ]);

  const courseIds = popularCourses.map(p => p.courseId);
  const courses = await prisma.course.findMany({
    where: { id: { in: courseIds } },
  });
  const courseMap = new Map(courses.map(c => [c.id, c]));

  const monthRevenue = await prisma.payment.aggregate({
    where: {
      status: 'PAID',
      createdAt: { gte: new Date(new Date().setDate(new Date().getDate() - 30)) },
    },
    _sum: { amount: true },
  });

  const stats = [
    {
      icon: FaUsers,
      label: 'Користувачів',
      value: totalUsers.toLocaleString(),
      accent: 'from-indigo-500/15 to-indigo-500/5',
      iconColor: 'text-indigo-600',
      iconBg: 'bg-indigo-50',
      ring: 'ring-indigo-100',
    },
    {
      icon: FaGraduationCap,
      label: 'Активних студентів',
      value: totalEnrollments.toLocaleString(),
      accent: 'from-emerald-500/15 to-emerald-500/5',
      iconColor: 'text-emerald-600',
      iconBg: 'bg-emerald-50',
      ring: 'ring-emerald-100',
    },
    {
      icon: HiOutlineCurrencyDollar,
      label: 'Дохід (місяць)',
      value: `${(monthRevenue._sum.amount || 0).toLocaleString()} ₴`,
      accent: 'from-amber-500/15 to-amber-500/5',
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-50',
      ring: 'ring-amber-100',
    },
    {
      icon: FaChartLine,
      label: 'Продажів за місяць',
      value: recentPayments.toLocaleString(),
      accent: 'from-sky-500/15 to-sky-500/5',
      iconColor: 'text-sky-600',
      iconBg: 'bg-sky-50',
      ring: 'ring-sky-100',
    },
  ];

  const quickActions = [
    { href: '/dashboard/admin/users', label: 'Користувачі', desc: 'Керування акаунтами та ролями', icon: HiOutlineUserGroup, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { href: '/dashboard/admin/courses', label: 'Курси', desc: 'Каталог і викладачі', icon: HiOutlineBookOpen, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { href: '/dashboard/admin/news', label: 'Новини', desc: 'Публікації та чернетки', icon: HiOutlineNewspaper, color: 'text-rose-600', bg: 'bg-rose-50' },
    { href: '/dashboard/admin/analytics', label: 'Аналітика', desc: 'Метрики та звіти', icon: HiOutlineChartBar, color: 'text-sky-600', bg: 'bg-sky-50' },
    { href: '/dashboard/admin/payments', label: 'Платежі', desc: 'Транзакції та статуси', icon: HiOutlineCreditCard, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
<div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {stats.map((stat, i) => (
          <div
            key={i}
            className="relative overflow-hidden bg-white rounded-xl border border-slate-200/70 px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:shadow-[0_6px_18px_-12px_rgba(15,23,42,0.15)] hover:-translate-y-0.5 transition-all duration-300"
          >
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

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Popular courses */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/70 p-7 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Популярні курси</h2>
              <p className="text-xs text-slate-500 mt-0.5">Топ-5 за кількістю студентів</p>
            </div>
            <Link
              href="/dashboard/admin/courses"
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              Усі курси →
            </Link>
          </div>

          {popularCourses.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-slate-400">Даних ще немає</p>
            </div>
          ) : (
            <div className="space-y-2">
              {popularCourses.map((p, idx) => {
                const course = courseMap.get(p.courseId);
                if (!course) return null;
                const max = popularCourses[0]._count.courseId;
                const pct = (p._count.courseId / max) * 100;
                return (
                  <div
                    key={p.courseId}
                    className="group relative px-4 py-3 rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex-shrink-0 w-6 h-6 rounded-md bg-slate-100 text-slate-500 text-xs font-semibold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="text-sm font-medium text-slate-700 truncate">{course.title}</span>
                      </div>
                      <span className="text-xs font-semibold text-slate-500 tabular-nums flex-shrink-0 ml-3">
                        {p._count.courseId}
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="bg-white rounded-2xl border border-slate-200/70 p-7 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h2 className="text-lg font-semibold text-slate-800 mb-1">Швидкі дії</h2>
          <p className="text-xs text-slate-500 mb-6">Перехід до розділів</p>

          <div className="space-y-1.5">
            {quickActions.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="group flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors"
              >
                <div className={`w-9 h-9 ${a.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                  <a.icon className={`text-lg ${a.color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-700 group-hover:text-slate-900">{a.label}</div>
                  <div className="text-xs text-slate-400 truncate">{a.desc}</div>
                </div>
                <span className="text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all text-sm">→</span>
              </Link>
            ))}
          </div>

          <div className="mt-5 pt-5 border-t border-slate-100">
            <SyncDivisionsButton />
          </div>
        </div>
      </div>
    </div>
  );
}
