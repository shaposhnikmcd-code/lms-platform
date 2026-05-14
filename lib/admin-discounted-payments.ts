import prisma from '@/lib/prisma';

/**
 * Рахує оплати в заданому вікні, де клієнт заплатив МЕНШЕ за базову ціну
 * продукту (тобто з промокодом, акцією, чи будь-якою знижкою).
 *
 * Виключає:
 *   - адмін/менеджер test-payments (1₴/2₴) — їх ловить роль або сам amount ≤ 2
 *   - річну програму (там окрема логіка плану)
 *
 * Базова ціна:
 *   - для bundle:  Bundle.price (поточна ціна пакету)
 *   - для course:  CoursePriceOverride.price ?? Course.price
 *
 * Yearly програма не входить, бо там окремі стандартні суми (15000/2200).
 */
export async function getDiscountedPaymentsCount(rangeStart: Date, rangeEnd: Date) {
  const [payments, overrides] = await Promise.all([
    prisma.payment.findMany({
      where: {
        status: 'PAID',
        createdAt: { gte: rangeStart, lte: rangeEnd },
        yearlyProgramSubscriptionId: null,
        amount: { gt: 2 }, // відсікти тестові 1₴/2₴
        user: { role: { notIn: ['ADMIN', 'MANAGER'] } },
      },
      select: {
        id: true,
        amount: true,
        courseId: true,
        bundleId: true,
        course: { select: { slug: true, price: true } },
        bundle: { select: { price: true } },
      },
    }),
    prisma.coursePriceOverride.findMany({ select: { slug: true, price: true } }),
  ]);

  const overrideBySlug = new Map<string, number | null>();
  for (const o of overrides) overrideBySlug.set(o.slug, o.price);

  let count = 0;
  for (const p of payments) {
    let basePrice: number | null = null;
    if (p.bundleId && p.bundle) {
      basePrice = p.bundle.price;
    } else if (p.courseId && p.course) {
      const slugKey = p.course.slug ?? p.courseId;
      const overridePrice = overrideBySlug.get(slugKey);
      basePrice = overridePrice ?? p.course.price;
    }
    if (basePrice !== null && basePrice > 0 && p.amount < basePrice) {
      count++;
    }
  }
  return count;
}
