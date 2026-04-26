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

  const [overrides, dbCourses] = await Promise.all([
    prisma.coursePriceOverride.findMany(),
    prisma.course.findMany({ select: { slug: true, id: true, sendpulseCourseId: true } }),
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
      overridePrice: o?.price ?? null,
      overrideOldPrice: o?.oldPrice ?? null,
      sendpulseCourseId: db?.sendpulseCourseId ?? null,
    };
  });

  return <CoursesView rows={rows} />;
}
