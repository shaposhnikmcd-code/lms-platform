import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isAdmin } from "@/lib/adminAuth";
import { revalidateLocalized } from "@/lib/revalidatePaths";
import { translateBundleTitle } from "@/lib/translateBundle";
import { getCoursePriceOverrides } from "@/lib/coursePrice";
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

/// Ціна пакету: тільки ціле число в межах 1…999999 грн. Приймає і рядок з форми
/// («12000»), і число. Повертає нормалізоване значення або null якщо невалідне.
function parsePrice(value: unknown): number | null {
  const num = typeof value === 'string' ? Number(value.trim()) : value;
  if (typeof num !== 'number' || !Number.isInteger(num)) return null;
  if (num <= 0 || num >= 1_000_000) return null;
  return num;
}

/// Звіряє courseSlug-и з каталогом (як і решта коду — по slug АБО id).
/// Повертає список тих, яких немає в БД.
async function findUnknownCourseSlugs(courses: BundleCourseInput[]): Promise<string[]> {
  const slugs = [...new Set(courses.map((c) => c.courseSlug).filter(Boolean))];
  if (slugs.length !== courses.length) return ['(порожній slug)'];
  if (slugs.length === 0) return [];

  const found = await prisma.course.findMany({
    where: { OR: [{ slug: { in: slugs } }, { id: { in: slugs } }] },
    select: { slug: true, id: true },
  });
  const known = new Set<string>();
  for (const c of found) {
    if (c.slug) known.add(c.slug);
    known.add(c.id);
  }
  return slugs.filter((s) => !known.has(s));
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

  try {
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

  // Ціна валідується до будь-яких записів: раніше `price: null` / рядок / від'ємне
  // значення долітало до Prisma і поверталось голим 500 (PrismaClientValidationError).
  let validatedPrice: number | null = null;
  if (price !== undefined) {
    validatedPrice = parsePrice(price);
    if (validatedPrice === null) {
      return NextResponse.json(
        { error: 'Ціна пакету має бути цілим числом від 1 до 999999 грн' },
        { status: 400 },
      );
    }
  }

  // Неіснуючий courseSlug раніше створював «мертвий» BundleCourse: пакет
  // рендериться з діркою замість курсу, а ціна рахується як 0.
  if (courses && courses.length > 0) {
    const unknown = await findUnknownCourseSlugs(courses);
    if (unknown.length > 0) {
      return NextResponse.json(
        { error: `Курси не знайдено: ${unknown.join(', ')}` },
        { status: 400 },
      );
    }
  }

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
  if (title !== undefined) {
    updateData.title = title;
    // Re-translate EN/PL тільки коли заголовок реально змінили (щоб не палити DeepL квоту на toggle-патчах).
    const current = await prisma.bundle.findUnique({ where: { id }, select: { title: true } });
    if (!current || current.title !== title) {
      const translations = await translateBundleTitle(title);
      updateData.titleEn = translations.titleEn;
      updateData.titlePl = translations.titlePl;
    }
  }
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

  if (validatedPrice !== null) {
    updateData.price = validatedPrice;
  }
  if (courses && (effectiveType === "FIXED_FREE" || effectiveType === "CHOICE_FREE")) {
    const paidSlugs = courses.filter((c) => !c.isFree).map((c) => c.courseSlug);
    const [paidCourses, overrides] = await Promise.all([
      prisma.course.findMany({
        where: { OR: [{ slug: { in: paidSlugs } }, { id: { in: paidSlugs } }] },
        select: { slug: true, id: true, price: true },
      }),
      getCoursePriceOverrides(),
    ]);
    updateData.price = paidSlugs.reduce((sum, slug) => {
      const c = paidCourses.find((p) => p.slug === slug || p.id === slug);
      return sum + (overrides.get(slug) ?? c?.price ?? 0);
    }, 0);
  }

  // Атомарно: якщо createMany впаде після deleteMany, пакет лишався б без курсів
  // (порожній пакет на вітрині). Транзакція відкочує обидві операції разом з update.
  await prisma.$transaction([
    prisma.bundle.update({ where: { id }, data: updateData }),
    ...(courses
      ? [
          prisma.bundleCourse.deleteMany({ where: { bundleId: id } }),
          prisma.bundleCourse.createMany({
            data: courses.map((c) => ({
              bundleId: id,
              courseSlug: c.courseSlug,
              isFree: !!c.isFree,
            })),
          }),
        ]
      : []),
  ]);

  const updated = await prisma.bundle.findUnique({
    where: { id },
    include: { courses: true },
  });

  revalidateLocalized('/courses');
  return NextResponse.json(updated);
  } catch (error) {
    // P2025 = запис не знайдено (пакет видалили паралельно).
    if ((error as { code?: string })?.code === 'P2025') {
      return NextResponse.json({ error: "Пакет не знайдено" }, { status: 404 });
    }
    console.error('Помилка PATCH /api/admin/bundles/[id]:', error);
    return NextResponse.json({ error: "Не вдалося зберегти пакет" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  const { id } = await params;

  try {
    // Пакет з платежами видаляти не можна: Payment.bundleId — це історія продажів,
    // і delete або впаде на FK, або (гірше) знеособить платіж у звітах.
    const paymentsCount = await prisma.payment.count({ where: { bundleId: id } });
    if (paymentsCount > 0) {
      return NextResponse.json(
        {
          error: `Пакет має ${paymentsCount} платеж(ів) — видалити не можна. Зніміть його з публікації замість видалення.`,
        },
        { status: 409 },
      );
    }

    await prisma.bundle.delete({ where: { id } });

    revalidateLocalized('/courses');
    return NextResponse.json({ ok: true });
  } catch (error) {
    if ((error as { code?: string })?.code === 'P2025') {
      return NextResponse.json({ error: "Пакет не знайдено" }, { status: 404 });
    }
    console.error('Помилка DELETE /api/admin/bundles/[id]:', error);
    return NextResponse.json({ error: "Не вдалося видалити пакет" }, { status: 500 });
  }
}
