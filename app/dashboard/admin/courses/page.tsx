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
      promo2Code: o?.promo2Code ?? null,
      promo2Price: o?.promo2Price ?? null,
      sendpulseCourseId: db?.sendpulseCourseId ?? null,
    };
  });

  const promosByCategory = new Map(categoryPromos.map((c) => [c.category, c]));
  const categoryRows = [
    {
      category: 'bundle' as const,
      titleUk: 'Пакети курсів',
      icon: '📦',
      accent: '#D4A843',
      hint: 'Один промокод на всі пакети',
      promo1Code: promosByCategory.get('bundle')?.promo1Code ?? null,
      promo1Price: promosByCategory.get('bundle')?.promo1Price ?? null,
    },
    {
      category: 'connector' as const,
      titleUk: 'Гра Конектор',
      icon: '🧩',
      accent: '#7C9D7C',
      hint: 'Промокод обнуляє доставку',
      promo1Code: promosByCategory.get('connector')?.promo1Code ?? null,
      promo1Price: promosByCategory.get('connector')?.promo1Price ?? null,
    },
    {
      category: 'yearly' as const,
      titleUk: 'Річна програма',
      icon: '📅',
      accent: '#9C6FB6',
      hint: '(Річна підписка)',
      promo1Code: promosByCategory.get('yearly')?.promo1Code ?? null,
      promo1Price: promosByCategory.get('yearly')?.promo1Price ?? null,
    },
    {
      category: 'monthly' as const,
      titleUk: 'Річна програма',
      icon: '🔁',
      accent: '#6FA8B6',
      hint: '(Місячний платіж)',
      promo1Code: promosByCategory.get('monthly')?.promo1Code ?? null,
      promo1Price: promosByCategory.get('monthly')?.promo1Price ?? null,
    },
  ];

  return <CoursesView rows={rows} categoryRows={categoryRows} />;
}
