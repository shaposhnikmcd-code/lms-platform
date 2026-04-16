import prisma from "./prisma";

export async function getCoursePriceOverrides(): Promise<Map<string, number>> {
  const rows = await prisma.coursePriceOverride.findMany();
  const map = new Map<string, number>();
  for (const r of rows) {
    if (r.price !== null) map.set(r.slug, r.price);
  }
  return map;
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
    oldPrice: row?.oldPrice ?? fallbackOldPrice,
  };
}
