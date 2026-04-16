import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isAdmin } from "@/lib/adminAuth";
import type { BundleType } from "@prisma/client";

interface BundleCourseInput {
  courseSlug: string;
  isFree?: boolean;
}

const ALLOWED_TYPES: BundleType[] = ["DISCOUNT", "FIXED_FREE", "CHOICE_FREE"];

function normalizeCourses(
  courses: BundleCourseInput[] | string[] | undefined,
): BundleCourseInput[] {
  if (!courses || courses.length === 0) return [];
  if (typeof courses[0] === "string") {
    return (courses as string[]).map((courseSlug) => ({ courseSlug, isFree: false }));
  }
  return (courses as BundleCourseInput[]).map((c) => ({
    courseSlug: c.courseSlug,
    isFree: !!c.isFree,
  }));
}

function validateByType(
  type: BundleType,
  paidCount: number,
  freeCount: number,
  courses: BundleCourseInput[],
): string | null {
  const paid = courses.filter((c) => !c.isFree);
  const free = courses.filter((c) => c.isFree);

  if (type === "DISCOUNT") {
    if (paid.length < 2) return "DISCOUNT: потрібно мінімум 2 платні курси";
    if (free.length > 0) return "DISCOUNT: безкоштовних курсів не має бути";
    return null;
  }
  if (type === "FIXED_FREE") {
    if (paid.length !== paidCount)
      return `FIXED_FREE: обери рівно ${paidCount} платних курсів (зараз ${paid.length})`;
    if (free.length !== freeCount)
      return `FIXED_FREE: обери рівно ${freeCount} безкоштовних курсів (зараз ${free.length})`;
    return null;
  }
  if (type === "CHOICE_FREE") {
    if (paid.length !== paidCount)
      return `CHOICE_FREE: обери рівно ${paidCount} платних курсів (зараз ${paid.length})`;
    if (free.length < freeCount)
      return `CHOICE_FREE: пул безкоштовних має містити мінімум ${freeCount} курсів (зараз ${free.length})`;
    return null;
  }
  return "Невідомий тип пакету";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  const { id } = await params;

  const bundle = await prisma.bundle.findUnique({
    where: { id },
    include: { courses: true },
  });

  if (!bundle) {
    return NextResponse.json({ error: "Пакет не знайдено" }, { status: 404 });
  }

  return NextResponse.json(bundle);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const {
    title,
    slug,
    price,
    imageUrl,
    published,
    suspendedAt,
    resumeAt,
    type,
    paidCount,
    freeCount,
    displayMode,
  } = body;

  const courses = body.courses !== undefined || body.courseSlugs !== undefined
    ? normalizeCourses(body.courses ?? body.courseSlugs)
    : null;

  if (slug) {
    const existing = await prisma.bundle.findFirst({
      where: { slug, NOT: { id } },
    });
    if (existing) {
      return NextResponse.json({ error: "Пакет з таким slug вже існує" }, { status: 400 });
    }
  }

  // Якщо передали type/counts/courses — валідуємо комбінацію з урахуванням поточного стану пакету
  if (type !== undefined || paidCount !== undefined || freeCount !== undefined || courses !== null) {
    const current = await prisma.bundle.findUnique({
      where: { id },
      include: { courses: true },
    });
    if (!current) {
      return NextResponse.json({ error: "Пакет не знайдено" }, { status: 404 });
    }

    const effType = (type as BundleType | undefined) && ALLOWED_TYPES.includes(type as BundleType)
      ? (type as BundleType)
      : current.type;
    const effPaidCount = paidCount ?? current.paidCount;
    const effFreeCount = freeCount ?? current.freeCount;
    const effCourses = courses ?? current.courses.map((c) => ({ courseSlug: c.courseSlug, isFree: c.isFree }));

    const validationError = validateByType(effType, effPaidCount, effFreeCount, effCourses);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }
  }

  const updateData: Record<string, unknown> = {};
  if (title !== undefined) updateData.title = title;
  if (slug !== undefined) updateData.slug = slug;
  if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
  if (published !== undefined) updateData.published = published;
  if (type !== undefined && ALLOWED_TYPES.includes(type as BundleType)) updateData.type = type;
  if (paidCount !== undefined) updateData.paidCount = paidCount;
  if (freeCount !== undefined) updateData.freeCount = freeCount;
  if (suspendedAt !== undefined) updateData.suspendedAt = suspendedAt ? new Date(suspendedAt) : null;
  if (resumeAt !== undefined) updateData.resumeAt = resumeAt ? new Date(resumeAt) : null;
  if (displayMode !== undefined) updateData.displayMode = displayMode === "solo" ? "solo" : "auto";

  // Для FIXED_FREE / CHOICE_FREE автоматично перерахувати price = сума платних
  const effectiveType = (updateData.type as BundleType | undefined) ?? (await prisma.bundle.findUnique({ where: { id }, select: { type: true } }))?.type;

  if (price !== undefined) {
    updateData.price = price;
  }
  if (courses && (effectiveType === "FIXED_FREE" || effectiveType === "CHOICE_FREE")) {
    const paidSlugs = courses.filter((c) => !c.isFree).map((c) => c.courseSlug);
    const paidCourses = await prisma.course.findMany({
      where: { OR: [{ slug: { in: paidSlugs } }, { id: { in: paidSlugs } }] },
      select: { slug: true, id: true, price: true },
    });
    updateData.price = paidSlugs.reduce((sum, slug) => {
      const c = paidCourses.find((p) => p.slug === slug || p.id === slug);
      return sum + (c?.price ?? 0);
    }, 0);
  }

  await prisma.bundle.update({ where: { id }, data: updateData });

  if (courses) {
    await prisma.bundleCourse.deleteMany({ where: { bundleId: id } });
    await prisma.bundleCourse.createMany({
      data: courses.map((c) => ({
        bundleId: id,
        courseSlug: c.courseSlug,
        isFree: !!c.isFree,
      })),
    });
  }

  const updated = await prisma.bundle.findUnique({
    where: { id },
    include: { courses: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  const { id } = await params;

  await prisma.bundle.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
