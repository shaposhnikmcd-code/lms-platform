import { FaUsers, FaGraduationCap, FaDollarSign, FaChartLine } from "react-icons/fa";
import Link from "next/link";
import prisma from "@/lib/prisma";
import SyncDivisionsButton from "./_components/SyncDivisionsButton";

export default async function AdminDashboard() {
  const [
    totalUsers,
    totalEnrollments,
    totalPayments,
    recentPayments,
    popularCourses,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.enrollment.count(),
    prisma.payment.aggregate({
      where: { status: 'PAID' },
      _sum: { amount: true },
    }),
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
    { icon: FaUsers, label: 'Користувачів', value: totalUsers.toString(), color: 'text-blue-600', bg: 'bg-blue-50' },
    { icon: FaGraduationCap, label: 'Активних студентів', value: totalEnrollments.toString(), color: 'text-green-600', bg: 'bg-green-50' },
    { icon: FaDollarSign, label: 'Дохід (місяць)', value: `${(monthRevenue._sum.amount || 0).toLocaleString()} UAH`, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { icon: FaChartLine, label: 'Всього продажів', value: recentPayments.toString(), color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-[#1C3A2E] mb-8">{"Адмін-панель"}</h1>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm p-6">
            <div className={`w-12 h-12 ${stat.bg} rounded-full flex items-center justify-center mb-4`}>
              <stat.icon className={`text-xl ${stat.color}`} />
            </div>
            <div className="text-2xl font-bold text-[#1C3A2E] mb-1">{stat.value}</div>
            <div className="text-sm text-gray-500">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-[#1C3A2E] mb-4">{"Популярні курси"}</h2>
          {popularCourses.length === 0 ? (
            <p className="text-gray-400">{"Даних ще немає"}</p>
          ) : (
            <div className="space-y-4">
              {popularCourses.map((p) => {
                const course = courseMap.get(p.courseId);
                if (!course) return null;
                return (
                  <div key={p.courseId} className="flex items-center justify-between">
                    <span className="text-gray-700">{course.title}</span>
                    <span className="text-[#D4A017] font-medium">{p._count.courseId} {"студентів"}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-[#1C3A2E] mb-4">{"Швидкі дії"}</h2>
          <div className="space-y-3">
            <Link href="/dashboard/admin/users" className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              {"👥 Користувачі"}
            </Link>
            <Link href="/dashboard/admin/courses" className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              {"📚 Курси"}
            </Link>
            <Link href="/dashboard/admin/news" className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              {"📰 Новини"}
            </Link>
            <Link href="/dashboard/admin/analytics" className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              {"📊 Аналітика"}
            </Link>
            <Link href="/dashboard/admin/payments" className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              {"💰 Платежі"}
            </Link>
            <SyncDivisionsButton />
          </div>
        </div>
      </div>
    </div>
  );
}