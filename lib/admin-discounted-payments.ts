import prisma from '@/lib/prisma';

export type DiscountedPayment = {
  paymentId: string;
  orderReference: string;
  productKind: 'course' | 'bundle';
  productName: string;
  amount: number;
  basePrice: number;
  /// Знижка в гривнях (basePrice - amount). Завжди > 0.
  discount: number;
  buyerEmail: string;
  createdAt: string; // ISO
};

/**
 * Повертає список оплат, де клієнт заплатив МЕНШЕ за базову ціну продукту
 * (з промокодом, акцією, чи будь-якою іншою знижкою).
 *
 * Виключає: тестові 1-2₴, ADMIN/MANAGER, річну програму (інша модель цін).
 *
 * Базова ціна:
 *   - bundle: Bundle.price
 *   - course: CoursePriceOverride.price ?? Course.price
 */
export async function getDiscountedPayments(
  rangeStart: Date,
  rangeEnd: Date,
): Promise<DiscountedPayment[]> {
  const [payments, overrides] = await Promise.all([
    prisma.payment.findMany({
      where: {
        status: 'PAID',
        createdAt: { gte: rangeStart, lte: rangeEnd },
        yearlyProgramSubscriptionId: null,
        amount: { gt: 2 },
        user: { role: { notIn: ['ADMIN', 'MANAGER'] } },
      },
      select: {
        id: true,
        orderReference: true,
        amount: true,
        courseId: true,
        bundleId: true,
        createdAt: true,
        user: { select: { email: true, name: true } },
        course: { select: { slug: true, price: true, title: true } },
        bundle: { select: { price: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.coursePriceOverride.findMany({ select: { slug: true, price: true } }),
  ]);

  const overrideBySlug = new Map<string, number | null>();
  for (const o of overrides) overrideBySlug.set(o.slug, o.price);

  const out: DiscountedPayment[] = [];
  for (const p of payments) {
    let basePrice: number | null = null;
    let productKind: 'course' | 'bundle' | null = null;
    let productName = '—';

    if (p.bundleId && p.bundle) {
      basePrice = p.bundle.price;
      productKind = 'bundle';
      productName = p.bundle.title ?? '—';
    } else if (p.courseId && p.course) {
      const slugKey = p.course.slug ?? p.courseId;
      const overridePrice = overrideBySlug.get(slugKey);
      basePrice = overridePrice ?? p.course.price;
      productKind = 'course';
      productName = p.course.title ?? '—';
    }

    if (productKind && basePrice !== null && basePrice > 0 && p.amount < basePrice) {
      out.push({
        paymentId: p.id,
        orderReference: p.orderReference,
        productKind,
        productName,
        amount: p.amount,
        basePrice,
        discount: basePrice - p.amount,
        buyerEmail: p.user.email ?? '',
        createdAt: p.createdAt.toISOString(),
      });
    }
  }
  return out;
}
