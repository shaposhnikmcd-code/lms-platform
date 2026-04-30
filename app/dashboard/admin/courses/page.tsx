import prisma from "@/lib/prisma";
import { COURSES_CATALOG } from "@/lib/coursesCatalog";
import { PSYCHOLOGY_COURSE } from "@/app/[locale]/courses/psychology-basics/config";
import { MILITARY_PSYCHOLOGY_COURSE } from "@/app/[locale]/courses/military-psychology/config";
import { syncCatalogCourses } from "@/lib/syncCatalogCourses";
import CoursesView from "./_components/CoursesView";

export const revalidate = 30;

const FALLBACK_OLD_PRICE: Record<string, number | null> = {
  "psychology-basics": Number(PSYCHOLOGY_COURSE.priceOld),
  "military-psychology": Number(MILITARY_PSYCHOLOGY_COURSE.priceOld),
};

export default async function AdminCourses() {
  await syncCatalogCourses();

  const [overrides, dbCourses, categoryPromos] = await Promise.all([
    prisma.coursePriceOverride.findMany(),
    prisma.course.findMany({ select: { slug: true, id: true, sendpulseCourseId: true } }),
    prisma.categoryPromoOverride.findMany(),
  ]);
  const overridesBySlug = new Map(overrides.map((o) => [o.slug, o]));
  const dbBySlug = new Map(dbCourses.map((c) => [c.slug ?? c.id, c]));

  const rows = COURSES_CATALOG.map((c) => {
    const o = overridesBySlug.get(c.slug);
    const db = dbBySlug.get(c.slug);
    return {
      slug: c.slug,
      titleUk: c.titleUk,
      icon: c.icon,
      accent: c.accent,
      defaultPrice: c.price,
      defaultOldPrice: FALLBACK_OLD_PRICE[c.slug] ?? null,
      hasOverride: !!o,
      overridePrice: o?.price ?? null,
      overrideOldPrice: o?.oldPrice ?? null,
      promo1Code: o?.promo1Code ?? null,
      promo1Price: o?.promo1Price ?? null,
      promo1StartsAt: o?.promo1StartsAt ? o.promo1StartsAt.toISOString() : null,
      promo1ExpiresAt: o?.promo1ExpiresAt ? o.promo1ExpiresAt.toISOString() : null,
      promo2Code: o?.promo2Code ?? null,
      promo2Price: o?.promo2Price ?? null,
      promo2StartsAt: o?.promo2StartsAt ? o.promo2StartsAt.toISOString() : null,
      promo2ExpiresAt: o?.promo2ExpiresAt ? o.promo2ExpiresAt.toISOString() : null,
      sendpulseCourseId: db?.sendpulseCourseId ?? null,
    };
  });

  const promosByCategory = new Map(categoryPromos.map((c) => [c.category, c]));
  const buildCategoryRow = (
    category: 'bundle' | 'connector' | 'yearly' | 'monthly',
    titleUk: string,
    icon: string,
    accent: string,
    hint: string,
  ) => {
    const p = promosByCategory.get(category);
    return {
      category,
      titleUk,
      icon,
      accent,
      hint,
      promo1Code: p?.promo1Code ?? null,
      promo1Price: p?.promo1Price ?? null,
      promo1StartsAt: p?.promo1StartsAt ? p.promo1StartsAt.toISOString() : null,
      promo1ExpiresAt: p?.promo1ExpiresAt ? p.promo1ExpiresAt.toISOString() : null,
    };
  };
  const categoryRows = [
    buildCategoryRow('bundle', 'Пакети курсів', '📦', '#D4A843', 'Один промокод на всі пакети'),
    buildCategoryRow('connector', 'Гра Конектор', '🧩', '#7C9D7C', 'Промокод обнуляє доставку'),
    buildCategoryRow('yearly', 'Річна програма', '📅', '#9C6FB6', '(Річна підписка)'),
    buildCategoryRow('monthly', 'Річна програма', '🔁', '#6FA8B6', '(Місячний платіж)'),
  ];

  return <CoursesView rows={rows} categoryRows={categoryRows} />;
}
