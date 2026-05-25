import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkRateLimit } from '@/lib/ratelimit';

/// Pre-submit enrollment check для CoursePurchaseDialog. Викликається коли користувач
/// заповнив email — щоб одразу показати банер "вже придбано" замість того, щоб давати
/// ввести промокод і впертися в 409 від /api/wayforpay.
///
/// Два режими:
///  1) Звичайний курс (`courseId` = id курсу) — повертає `{ enrolled: true/false }`.
///     На фронті блокує оплату (hard-stop = 409 на /api/wayforpay).
///  2) Пакет (`courseId` = `bundle_<slug>`) — повертає `{ overlap: [{ slug, title }] }`
///     зі списком курсів у пакеті, які користувач вже має. Це **soft-warning** —
///     оплату не блокуємо, бо в пакеті можуть бути інші курси, які користувач ще не має.
///
/// Yearly/connector — пропускаємо (свої політики).
export async function POST(req: NextRequest) {
  try {
    const rl = await checkRateLimit(req, 'promo');
    if (!rl.ok) return rl.response!;

    const { email, courseId } = await req.json();

    if (typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ enrolled: false });
    }
    if (typeof courseId !== 'string' || !courseId) {
      return NextResponse.json({ enrolled: false });
    }

    // Yearly/connector мають власну логіку.
    if (
      courseId === 'yearly-program' ||
      courseId === 'yearly-program-monthly' ||
      courseId === 'connector' ||
      courseId.startsWith('connector_')
    ) {
      return NextResponse.json({ enrolled: false });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findFirst({
      where: { email: trimmedEmail, deletedAt: null },
      select: { id: true },
    });
    if (!user) return NextResponse.json({ enrolled: false, overlap: [] });

    // Bundle: знаходимо всі курси пакету (paid+free) і дивимось, які з них вже є у юзера.
    if (courseId.startsWith('bundle_')) {
      const slug = courseId.slice('bundle_'.length);
      const bundle = await prisma.bundle.findUnique({
        where: { slug },
        include: { courses: { select: { courseSlug: true } } },
      });
      if (!bundle) return NextResponse.json({ overlap: [] });

      const slugs = bundle.courses.map((c) => c.courseSlug);
      if (slugs.length === 0) return NextResponse.json({ overlap: [] });

      const ownedCourses = await prisma.course.findMany({
        where: {
          slug: { in: slugs },
          enrollments: { some: { userId: user.id } },
        },
        select: { slug: true, title: true },
      });
      const overlap = ownedCourses
        .filter((c): c is { slug: string; title: string } => !!c.slug)
        .map((c) => ({ slug: c.slug, title: c.title }));
      return NextResponse.json({ overlap });
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: user.id, courseId } },
      select: { id: true },
    });

    return NextResponse.json({ enrolled: !!enrollment });
  } catch (error) {
    console.error('check-enrollment error:', error);
    return NextResponse.json({ enrolled: false }, { status: 500 });
  }
}
