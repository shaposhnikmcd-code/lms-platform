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

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-[#1C3A2E] mb-6">Аналітика</h1>

      {/* Головні метрики */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Всього користувачів', value: totalUsers, icon: FaUsers, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Всього записів', value: totalEnrollments, icon: FaGraduationCap, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Загальний дохід', value: `${(paidPayments._sum.amount || 0).toLocaleString()} UAH`, icon: FaDollarSign, color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: 'Дохід за місяць', value: `${(monthPayments._sum.amount || 0).toLocaleString()} UAH`, icon: FaChartLine, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className={`w-10 h-10 ${stat.bg} rounded-full flex items-center justify-center mb-3`}>
              <stat.icon className={`${stat.color}`} />
            </div>
            <p className="text-2xl font-bold text-[#1C3A2E]">{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Користувачі */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-[#1C3A2E] mb-4">Нові користувачі</h2>
          <div className="space-y-4">
            {[
              { label: 'За тиждень', value: newUsersWeek },
              { label: 'За місяць', value: newUsersMonth },
              { label: 'Всього', value: totalUsers },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{item.label}</span>
                <span className="font-bold text-[#1C3A2E]">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Продажі */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-[#1C3A2E] mb-4">Продажі</h2>
          <div className="space-y-4">
            {[
              { label: 'За тиждень', value: `${(weekPayments._sum.amount || 0).toLocaleString()} UAH` },
              { label: 'За місяць', value: `${(monthPayments._sum.amount || 0).toLocaleString()} UAH` },
              { label: 'Нових записів за місяць', value: newEnrollmentsMonth },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{item.label}</span>
                <span className="font-bold text-[#1C3A2E]">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Популярність курсів */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-[#1C3A2E] mb-4">Популярність курсів</h2>
        {courseStats.length === 0 ? (
          <p className="text-gray-400">Даних ще немає</p>
        ) : (
          <div className="space-y-3">
            {courseStats.map((stat) => {
              const course = courseMap.get(stat.courseId);
              if (!course) return null;
              const maxCount = courseStats[0]._count.courseId;
              const percent = Math.round((stat._count.courseId / maxCount) * 100);
              return (
                <div key={stat.courseId}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700">{course.title}</span>
                    <span className="font-medium text-[#1C3A2E]">{stat._count.courseId} студентів</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-[#D4A017] h-2 rounded-full transition-all"
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