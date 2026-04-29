import prisma from "./prisma";
import { COURSES_BY_SLUG } from "./coursesCatalog";

export async function getCoursePriceOverrides(): Promise<Map<string, number>> {
  const rows = await prisma.coursePriceOverride.findMany();
  const map = new Map<string, number>();
  for (const r of rows) {
    if (r.price !== null) map.set(r.slug, r.price);
  }
  return map;
}

/// Effective price = override if set, else catalog default. Single source of truth
/// for everything that needs current course pricing (admin bundles editor, auto
/// price calc on bundle save, public render). Returns Map<slug, price> covering
/// every catalog course; missing slugs fall back to 0.
export async function getEffectiveCoursePrices(): Promise<Map<string, number>> {
  const overrides = await getCoursePriceOverrides();
  const map = new Map<string, number>();
  for (const [slug, info] of Object.entries(COURSES_BY_SLUG)) {
    map.set(slug, overrides.get(slug) ?? info.price);
  }
  return map;
}

/// Перераховує price у FIXED_FREE/CHOICE_FREE пакетах, що містять цей курс як платний.
/// Викликається після зміни/видалення CoursePriceOverride, щоб bundle.price (DB)
/// залишався узгодженим з ефективною ціною курсу. DISCOUNT пакети не чіпаємо —
/// у них ціна задається адміном вручну.
export async function recalcAutoPricedBundlesForCourse(slug: string): Promise<void> {
  const bundles = await prisma.bundle.findMany({
    where: {
      type: { in: ['FIXED_FREE', 'CHOICE_FREE'] },
      courses: { some: { courseSlug: slug, isFree: false } },
    },
    include: { courses: true },
  });
  if (bundles.length === 0) return;

  const effective = await getEffectiveCoursePrices();

  await Promise.all(
    bundles.map(async (b) => {
      const paidSlugs = b.courses.filter((c) => !c.isFree).map((c) => c.courseSlug);
      const newPrice = paidSlugs.reduce((sum, s) => sum + (effective.get(s) ?? 0), 0);
      if (newPrice !== b.price) {
        await prisma.bundle.update({ where: { id: b.id }, data: { price: newPrice } });
      }
    }),
  );
}

export async function getCoursePrice(slug: string, fallback: number): Promise<number> {
  const row = await prisma.coursePriceOverride.findUnique({ where: { slug } });
  return row?.price ?? fallback;
}

export async function getCoursePriceInfo(
  slug: string,
  fallbackPrice: number,
  fallbackOldPrice: number | null = null,
): Promise<{ price: number; oldPrice: number | null }> {
  const row = await prisma.coursePriceOverride.findUnique({ where: { slug } });
  return {
    price: row?.price ?? fallbackPrice,
    oldPrice: row ? row.oldPrice : fallbackOldPrice,
  };
}
