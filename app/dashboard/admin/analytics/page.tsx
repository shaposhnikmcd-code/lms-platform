import prisma from '@/lib/prisma';
import AdminAnalyticsView, { type AnalyticsData } from './_components/AdminAnalyticsView';

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

  // Bundle aggregation
  const bundleMap = new Map(allBundles.map(b => [b.id, b]));
  const byBundle = new Map<string, { count: number; revenue: number }>();
  const byType: AnalyticsData['bundleByType'] = {
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

  const topBundles: AnalyticsData['topBundles'] = [...byBundle.entries()]
    .map(([id, s]) => {
      const b = bundleMap.get(id);
      if (!b) return null;
      return { id, title: b.title, type: b.type as 'DISCOUNT' | 'FIXED_FREE' | 'CHOICE_FREE', count: s.count, revenue: s.revenue };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const topFreeChoices: AnalyticsData['topFreeChoices'] = [...freeChoiceFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([slug, count]) => {
      const course = courses.find(c => c.slug === slug || c.id === slug);
      return { slug, title: course?.title ?? slug, count };
    });

  const data: AnalyticsData = {
    totalUsers,
    newUsersMonth,
    newUsersWeek,
    totalEnrollments,
    newEnrollmentsMonth,
    totalRevenue: paidPayments._sum.amount ?? 0,
    monthRevenue: monthPayments._sum.amount ?? 0,
    weekRevenue: weekPayments._sum.amount ?? 0,
    courseStats: courseStats
      .map(s => {
        const c = courseMap.get(s.courseId);
        if (!c) return null;
        return { courseId: s.courseId, count: s._count.courseId, title: c.title };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null),
    bundleByType: byType,
    topBundles,
    topFreeChoices,
    totalBundleSales: bundlePayments.length,
    totalBundleRevenue: bundlePayments.reduce((s, p) => s + p.amount, 0),
  };

  return <AdminAnalyticsView data={data} />;
}
