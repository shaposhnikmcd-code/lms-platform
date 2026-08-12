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

export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  const bundles = await prisma.bundle.findMany({
    include: { courses: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(bundles);
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  const body = await req.json();
  const {
    title,
    slug,
    price,
    imageUrl,
    published,
    type = "DISCOUNT",
    paidCount = 2,
    freeCount = 0,
    displayMode = "solo",
  } = body;

  const bundleType: BundleType = ALLOWED_TYPES.includes(type as BundleType)
    ? (type as BundleType)
    : "DISCOUNT";

  const courses = normalizeCourses(body.courses ?? body.courseSlugs);

  if (!title || !slug || courses.length === 0) {
    return NextResponse.json({ error: "Заповніть обов'язкові поля" }, { status: 400 });
  }

  if (bundleType === "DISCOUNT" && (price === undefined || price === null || price === "")) {
    return NextResponse.json({ error: "Для DISCOUNT потрібна ціна пакету" }, { status: 400 });
  }

  // Ціну FIXED_FREE/CHOICE_FREE сервер перераховує сам (сума платних), тому
  // валідуємо тільки там, де вона реально приходить з форми.
  let discountPrice = 0;
  if (bundleType === "DISCOUNT") {
    const parsed = parsePrice(price);
    if (parsed === null) {
      return NextResponse.json(
        { error: "Ціна пакету має бути цілим числом від 1 до 999999 грн" },
        { status: 400 },
      );
    }
    discountPrice = parsed;
  }

  const validationError = validateByType(bundleType, paidCount, freeCount, courses);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  // Неіснуючий courseSlug → «мертвий» BundleCourse у пакеті (дірка на вітрині,
  // курс не рахується в ціні). Звіряємо з каталогом до створення.
  const unknownSlugs = await findUnknownCourseSlugs(courses);
  if (unknownSlugs.length > 0) {
    return NextResponse.json(
      { error: `Курси не знайдено: ${unknownSlugs.join(', ')}` },
      { status: 400 },
    );
  }

  const existing = await prisma.bundle.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: "Пакет з таким slug вже існує" }, { status: 400 });
  }

  // Для FIXED_FREE і CHOICE_FREE ціна пакету = сума цін платних курсів (безкоштовні = 0).
  // Враховуємо override (admin "Курси — ціни") як єдине джерело істини.
  let finalPrice = discountPrice;
  if (bundleType === "FIXED_FREE" || bundleType === "CHOICE_FREE") {
    const paidSlugs = courses.filter((c) => !c.isFree).map((c) => c.courseSlug);
    const [paidCourses, overrides] = await Promise.all([
      prisma.course.findMany({
        where: { OR: [{ slug: { in: paidSlugs } }, { id: { in: paidSlugs } }] },
        select: { slug: true, id: true, price: true },
      }),
      getCoursePriceOverrides(),
    ]);
    finalPrice = paidSlugs.reduce((sum, slug) => {
      const c = paidCourses.find((p) => p.slug === slug || p.id === slug);
      return sum + (overrides.get(slug) ?? c?.price ?? 0);
    }, 0);
  }

  // Новий пакет йде на початок списку — sortOrder = min(existing) - 1
  const minSort = await prisma.bundle.aggregate({ _min: { sortOrder: true } });
  const newSortOrder = (minSort._min.sortOrder ?? 0) - 1;

  const translations = await translateBundleTitle(title);

  const bundle = await prisma.bundle.create({
    data: {
      title,
      ...translations,
      slug,
      price: finalPrice,
      imageUrl: imageUrl || null,
      published: published || false,
      type: bundleType,
      paidCount,
      freeCount,
      sortOrder: newSortOrder,
      displayMode: displayMode === "solo" ? "solo" : "auto",
      courses: {
        create: courses.map((c) => ({ courseSlug: c.courseSlug, isFree: !!c.isFree })),
      },
    },
    include: { courses: true },
  });

  revalidateLocalized('/courses');
  return NextResponse.json(bundle);
}
