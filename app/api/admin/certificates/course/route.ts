/// POST /api/admin/certificates/course — видача курсового сертифіката вручну (адмін).
/// GET  /api/admin/certificates/course — кандидати: usersхто enrolled в платному курсі, які
/// ще НЕ мають сертифіката (для picker-а в адмінці).

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/certificates/adminAuth';
import { issueCourseCertificate } from '@/lib/certificates/service';
import { TEST_PURCHASE_ROLES } from '@/lib/certificates/testUsers';

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const sp = req.nextUrl.searchParams;
  const courseId = sp.get('courseId');
  const limit = Math.min(Number(sp.get('limit')) || 500, 1000);

  const enrollments = await prisma.enrollment.findMany({
    where: {
      ...(courseId ? { courseId } : {}),
      // Виключаємо тестові покупки ADMIN/MANAGER (1 ₴) — див. lib/certificates/testUsers.ts
      user: { role: { notIn: TEST_PURCHASE_ROLES } },
    },
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { id: true, name: true, email: true, deletedAt: true } },
      course: { select: { id: true, title: true, price: true, sendpulseCourseId: true } },
    },
  });
  // Поля spProgressPercent / spProgressCheckedAt беруться напряму з кожного `e`
  // (Prisma їх повертає за замовчуванням після регенерації клієнта).

  // Сортуємо так, щоб для дубльованих (userId,courseId) пари в Map потрапив
  // НЕ-відкликаний (бо може бути 1 відкликаний + 1 новий) і свіжіший.
  const issued = await prisma.certificate.findMany({
    where: {
      type: 'COURSE',
      userId: { in: enrollments.map((e) => e.userId) },
      courseId: { in: enrollments.map((e) => e.courseId) },
    },
    orderBy: [{ revoked: 'asc' }, { issuedAt: 'desc' }],
    select: {
      id: true,
      userId: true,
      courseId: true,
      certNumber: true,
      emailStatus: true,
      emailFromAddress: true,
      issuedAt: true,
      issuedManually: true,
      revoked: true,
    },
  });
  const issuedKey = new Map<string, (typeof issued)[number]>();
  for (const c of issued) {
    const key = `${c.userId}_${c.courseId}`;
    if (!issuedKey.has(key)) issuedKey.set(key, c);
  }

  const candidates = enrollments
    .filter((e) => !e.user.deletedAt && e.course.price > 0)
    .map((e) => {
      const cert = issuedKey.get(`${e.userId}_${e.courseId}`);
      return {
        userId: e.userId,
        userName: e.user.name,
        userEmail: e.user.email,
        courseId: e.courseId,
        courseTitle: e.course.title,
        sendpulseCourseId: e.course.sendpulseCourseId,
        enrolledAt: e.createdAt,
        spProgressPercent: e.spProgressPercent,
        spProgressCheckedAt: e.spProgressCheckedAt,
        certificate: cert
          ? {
              id: cert.id,
              certNumber: cert.certNumber,
              emailStatus: cert.emailStatus,
              emailFromAddress: cert.emailFromAddress,
              issuedAt: cert.issuedAt,
              issuedManually: cert.issuedManually,
              revoked: cert.revoked,
            }
          : null,
      };
    });

  return NextResponse.json({ candidates });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const { userId, courseId, recipientName } = (body ?? {}) as {
    userId?: string;
    courseId?: string;
    recipientName?: string;
  };
  if (!userId || !courseId) {
    return NextResponse.json({ error: 'userId та courseId обов\'язкові' }, { status: 400 });
  }

  try {
    const cert = await issueCourseCertificate({
      userId,
      courseId,
      recipientName,
      actor: guard.actor,
      issuedManually: true,
    });
    return NextResponse.json({ certificate: cert });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
