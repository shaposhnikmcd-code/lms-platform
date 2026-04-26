/// GET /api/admin/certificates/issues — аномалії сертифікатів. Шукає 4 види "не так як мало б":
///   - UNPAID:               сертифікат видано без слідів оплати (ні прямого Payment по курсу,
///                           ні bundle-Payment, ні yearly-підписки з хоч одним успішним charge).
///   - MANUAL_INCOMPLETE:    cert виданий вручну, але SendPulse-прогрес < 100%.
///   - EMAIL_FAILED:         emailStatus = FAILED/BOUNCED або стирчить у PENDING > 1 год після видачі.
///   - COMPLETED_NO_CERT:    Enrollment у платному SP-курсі з progress=100, але сертифіката немає
///                           (cron мав видати, не видав).
///
/// Працює і для COURSE, і для YEARLY_PROGRAM.

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/certificates/adminAuth';

export type IssueKind = 'UNPAID' | 'MANUAL_INCOMPLETE' | 'EMAIL_FAILED' | 'COMPLETED_NO_CERT';

type IssueRow = {
  kind: IssueKind;
  certType: 'COURSE' | 'YEARLY_PROGRAM' | null;
  certificate: {
    id: string;
    certNumber: string;
    issuedAt: string;
    issuedManually: boolean;
    emailStatus: string;
    revoked: boolean;
  } | null;
  user: { id: string; name: string | null; email: string };
  subjectTitle: string;
  subjectMeta: string | null;
  details: string;
  issuedBy: { name: string | null; email: string | null } | null;
};

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const issues: IssueRow[] = [];

  // 1) Завантажуємо невідкликані сертифікати з усіма потрібними зв'язками.
  const certs = await prisma.certificate.findMany({
    where: { revoked: false },
    orderBy: { issuedAt: 'desc' },
    include: {
      user: { select: { id: true, name: true, email: true, deletedAt: true } },
      course: { select: { id: true, title: true, slug: true } },
      subscription: {
        select: {
          id: true,
          plan: true,
          status: true,
          spProgressPercent: true,
          lastPaymentAt: true,
        },
      },
    },
  });

  // 2) Платежі PAID — групуємо по userId і по subscriptionId (для перевірки 9/9 / 1/1).
  const userIds = Array.from(new Set(certs.map((c) => c.userId)));
  const payments = await prisma.payment.findMany({
    where: { userId: { in: userIds }, status: 'PAID' },
    select: {
      userId: true,
      courseId: true,
      bundleId: true,
      yearlyProgramSubscriptionId: true,
    },
  });

  const paidCoursesByUser = new Map<string, Set<string>>();
  const paidBundlesByUser = new Map<string, Set<string>>();
  const paidCountBySubscription = new Map<string, number>();
  for (const p of payments) {
    if (p.courseId) {
      const s = paidCoursesByUser.get(p.userId) ?? new Set<string>();
      s.add(p.courseId);
      paidCoursesByUser.set(p.userId, s);
    }
    if (p.bundleId) {
      const s = paidBundlesByUser.get(p.userId) ?? new Set<string>();
      s.add(p.bundleId);
      paidBundlesByUser.set(p.userId, s);
    }
    if (p.yearlyProgramSubscriptionId) {
      paidCountBySubscription.set(
        p.yearlyProgramSubscriptionId,
        (paidCountBySubscription.get(p.yearlyProgramSubscriptionId) ?? 0) + 1,
      );
    }
  }

  // 3) Bundle → set<courseSlug>. Тягнемо тільки ті bundle-и, які купили наші юзери.
  const usedBundleIds = Array.from(new Set(payments.map((p) => p.bundleId).filter(Boolean) as string[]));
  const bundleCourses = usedBundleIds.length
    ? await prisma.bundleCourse.findMany({
        where: { bundleId: { in: usedBundleIds } },
        select: { bundleId: true, courseSlug: true },
      })
    : [];
  const slugsByBundle = new Map<string, Set<string>>();
  for (const bc of bundleCourses) {
    const s = slugsByBundle.get(bc.bundleId) ?? new Set<string>();
    s.add(bc.courseSlug);
    slugsByBundle.set(bc.bundleId, s);
  }

  // 4) Прогрес enrollments — лук-ап по (userId,courseId).
  const courseIds = Array.from(
    new Set(certs.filter((c) => c.courseId).map((c) => c.courseId!) ),
  );
  const enrollments = courseIds.length
    ? await prisma.enrollment.findMany({
        where: { userId: { in: userIds }, courseId: { in: courseIds } },
        select: { userId: true, courseId: true, spProgressPercent: true },
      })
    : [];
  const progressByEnrollment = new Map<string, number | null>();
  for (const e of enrollments) {
    progressByEnrollment.set(`${e.userId}_${e.courseId}`, e.spProgressPercent);
  }

  // 5) Користувачі, які мають yearly-підписку з принаймні 1 успішним платежем —
  // вважаємо, що це дає доступ до всіх курсів (для UNPAID-checks по COURSE-сертах).
  // Для UNPAID-чеків самих YEARLY-сертів використовуємо точніший лук-ап paidCountBySubscription.
  const usersWithPaidYearly = await prisma.yearlyProgramSubscription.findMany({
    where: { userId: { in: userIds }, lastPaymentAt: { not: null } },
    select: { userId: true },
  });
  const yearlyAccessUsers = new Set(usersWithPaidYearly.map((s) => s.userId));

  const now = Date.now();
  const ONE_HOUR = 60 * 60 * 1000;

  // ---------- Аналіз сертифікатів ----------
  for (const cert of certs) {
    if (cert.user.deletedAt) continue;
    const userObj = { id: cert.user.id, name: cert.user.name, email: cert.user.email };
    const issuedBy =
      cert.issuedByName || cert.issuedByEmail
        ? { name: cert.issuedByName, email: cert.issuedByEmail }
        : null;

    const subjectTitle =
      cert.type === 'COURSE'
        ? cert.course?.title ?? cert.courseName ?? '—'
        : 'Річна програма';
    const subjectMeta =
      cert.type === 'YEARLY_PROGRAM'
        ? `${cert.subscription?.plan === 'MONTHLY' ? 'Місячний' : 'Річний'} · ${cert.subscription?.status ?? '—'}`
        : null;

    const baseCert = {
      id: cert.id,
      certNumber: cert.certNumber,
      issuedAt: cert.issuedAt.toISOString(),
      issuedManually: cert.issuedManually,
      emailStatus: cert.emailStatus,
      revoked: cert.revoked,
    };

    // --- UNPAID ---
    let hasPaymentTrail = false;
    let unpaidDetails = '';
    if (cert.type === 'COURSE' && cert.courseId) {
      const direct = paidCoursesByUser.get(cert.userId)?.has(cert.courseId) ?? false;
      const courseSlug = cert.course?.slug ?? null;
      let viaBundle = false;
      if (courseSlug) {
        const userBundles = paidBundlesByUser.get(cert.userId);
        if (userBundles) {
          for (const bId of userBundles) {
            if (slugsByBundle.get(bId)?.has(courseSlug)) {
              viaBundle = true;
              break;
            }
          }
        }
      }
      const viaYearly = yearlyAccessUsers.has(cert.userId);
      hasPaymentTrail = direct || viaBundle || viaYearly;
      unpaidDetails = 'Немає PAID Payment по курсу, бандлу з цим курсом, ні річної підписки з оплатами';
    } else if (cert.type === 'YEARLY_PROGRAM') {
      const expected = cert.subscription?.plan === 'MONTHLY' ? 9 : 1;
      const paidCount = cert.subscriptionId
        ? paidCountBySubscription.get(cert.subscriptionId) ?? 0
        : 0;
      hasPaymentTrail = paidCount >= expected;
      unpaidDetails = `Оплачено ${paidCount}/${expected} платежів`;
    }

    if (!hasPaymentTrail) {
      issues.push({
        kind: 'UNPAID',
        certType: cert.type,
        certificate: baseCert,
        user: userObj,
        subjectTitle,
        subjectMeta,
        details: unpaidDetails,
        issuedBy,
      });
    }

    // --- MANUAL_INCOMPLETE ---
    // Видали вручну, але SP-підтвердження 100% немає (або null = не підтверджено, або < 100%).
    if (cert.issuedManually) {
      let progress: number | null | undefined = undefined;
      if (cert.type === 'COURSE' && cert.courseId) {
        progress = progressByEnrollment.get(`${cert.userId}_${cert.courseId}`);
      } else if (cert.type === 'YEARLY_PROGRAM') {
        progress = cert.subscription?.spProgressPercent ?? null;
      }
      const isIncomplete = progress == null || progress < 100;
      if (isIncomplete) {
        issues.push({
          kind: 'MANUAL_INCOMPLETE',
          certType: cert.type,
          certificate: baseCert,
          user: userObj,
          subjectTitle,
          subjectMeta,
          details:
            progress == null
              ? 'Прогрес у SendPulse не підтверджено (немає даних)'
              : `SendPulse прогрес: ${progress}%`,
          issuedBy,
        });
      }
    }

    // --- EMAIL_FAILED ---
    const isFailed = cert.emailStatus === 'FAILED' || cert.emailStatus === 'BOUNCED';
    const isStuckPending =
      cert.emailStatus === 'PENDING' &&
      now - cert.issuedAt.getTime() > ONE_HOUR;
    if (isFailed || isStuckPending) {
      issues.push({
        kind: 'EMAIL_FAILED',
        certType: cert.type,
        certificate: baseCert,
        user: userObj,
        subjectTitle,
        subjectMeta,
        details: isFailed
          ? `Email status: ${cert.emailStatus}${cert.emailError ? ` · ${cert.emailError}` : ''}`
          : 'Email застряг у PENDING > 1 години',
        issuedBy,
      });
    }
  }

  // ---------- COMPLETED_NO_CERT ----------
  // Енролменти з progress=100 у платних курсах з sendpulseCourseId, без COURSE-сертифіката.
  const completedEnrollments = await prisma.enrollment.findMany({
    where: {
      spProgressPercent: 100,
      course: { price: { gt: 0 }, sendpulseCourseId: { not: null }, published: true },
    },
    include: {
      user: { select: { id: true, name: true, email: true, deletedAt: true } },
      course: { select: { id: true, title: true } },
    },
  });

  if (completedEnrollments.length) {
    const completedKeys = completedEnrollments.map((e) => ({
      userId: e.userId,
      courseId: e.courseId,
    }));
    const existingCerts = await prisma.certificate.findMany({
      where: {
        type: 'COURSE',
        OR: completedKeys.map((k) => ({ userId: k.userId, courseId: k.courseId })),
      },
      select: { userId: true, courseId: true },
    });
    const certKeys = new Set(existingCerts.map((c) => `${c.userId}_${c.courseId}`));
    for (const e of completedEnrollments) {
      if (e.user.deletedAt) continue;
      if (certKeys.has(`${e.userId}_${e.courseId}`)) continue;
      issues.push({
        kind: 'COMPLETED_NO_CERT',
        certType: 'COURSE',
        certificate: null,
        user: { id: e.user.id, name: e.user.name, email: e.user.email },
        subjectTitle: e.course.title,
        subjectMeta: null,
        details: 'Прогрес 100%, але сертифіката немає (auto-видача не спрацювала)',
        issuedBy: null,
      });
    }
  }

  // Сортуємо: спершу останні події (issuedAt desc), у COMPLETED_NO_CERT нема — хай у кінці.
  issues.sort((a, b) => {
    const ax = a.certificate?.issuedAt ?? '';
    const bx = b.certificate?.issuedAt ?? '';
    return bx.localeCompare(ax);
  });

  return NextResponse.json({ issues, totals: countByKind(issues) });
}

function countByKind(issues: IssueRow[]): Record<IssueKind, number> {
  const out: Record<IssueKind, number> = {
    UNPAID: 0,
    MANUAL_INCOMPLETE: 0,
    EMAIL_FAILED: 0,
    COMPLETED_NO_CERT: 0,
  };
  for (const i of issues) out[i.kind] += 1;
  return out;
}
