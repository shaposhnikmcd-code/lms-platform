/// GET /api/admin/certificates/analytics — KPI + reconciliation.
/// Payment-cert reconciliation: yearly сертифікати, видані користувачам, які недоплатили
/// очікувану кількість внесків (MONTHLY: < 9 PAID payments; YEARLY: < 1 PAID).

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/certificates/adminAuth';

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));

  const [
    totalAll,
    totalCourse,
    totalYearly,
    monthAll,
    yearAll,
    byEmailStatus,
    revokedCount,
    yearlyCerts,
    topCourses,
  ] = await Promise.all([
    prisma.certificate.count({ where: { revoked: false } }),
    prisma.certificate.count({ where: { revoked: false, type: 'COURSE' } }),
    prisma.certificate.count({ where: { revoked: false, type: 'YEARLY_PROGRAM' } }),
    prisma.certificate.count({ where: { revoked: false, issuedAt: { gte: monthStart } } }),
    prisma.certificate.count({ where: { revoked: false, issuedAt: { gte: yearStart } } }),
    prisma.certificate.groupBy({
      by: ['emailStatus'],
      _count: { _all: true },
    }),
    prisma.certificate.count({ where: { revoked: true } }),
    prisma.certificate.findMany({
      where: { type: 'YEARLY_PROGRAM', subscriptionId: { not: null } },
      select: {
        id: true,
        certNumber: true,
        recipientName: true,
        recipientEmail: true,
        category: true,
        issuedAt: true,
        revoked: true,
        subscription: {
          select: {
            id: true,
            plan: true,
            status: true,
            payments: { where: { status: 'PAID' }, select: { amount: true } },
          },
        },
      },
    }),
    prisma.certificate.groupBy({
      by: ['courseId', 'courseName'],
      where: { type: 'COURSE', revoked: false, courseId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { courseId: 'desc' } },
      take: 10,
    }),
  ]);

  const emailStatusBreakdown: Record<string, number> = {};
  for (const b of byEmailStatus) emailStatusBreakdown[b.emailStatus] = b._count._all;

  const reconciliation = yearlyCerts
    .map((c) => {
      const paidCount = c.subscription?.payments.length ?? 0;
      const expected = c.subscription?.plan === 'MONTHLY' ? 9 : 1;
      return {
        certId: c.id,
        certNumber: c.certNumber,
        recipientName: c.recipientName,
        recipientEmail: c.recipientEmail,
        category: c.category,
        issuedAt: c.issuedAt,
        revoked: c.revoked,
        plan: c.subscription?.plan ?? null,
        status: c.subscription?.status ?? null,
        paidCount,
        expectedPayments: expected,
        health:
          paidCount >= expected
            ? 'FULL'
            : paidCount > 0
              ? 'PARTIAL'
              : 'NONE',
      };
    })
    .filter((r) => r.health !== 'FULL' && !r.revoked);

  return NextResponse.json({
    kpi: {
      totalAll,
      totalCourse,
      totalYearly,
      thisMonth: monthAll,
      thisYear: yearAll,
      revoked: revokedCount,
      emailStatus: emailStatusBreakdown,
    },
    topCourses: topCourses.map((c) => ({
      courseId: c.courseId,
      courseName: c.courseName,
      count: c._count._all,
    })),
    reconciliation,
  });
}
