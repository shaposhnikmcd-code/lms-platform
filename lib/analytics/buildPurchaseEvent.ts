/// Builds a GA4 Enhanced Ecommerce `purchase` event payload from an `orderReference`.
/// Returns null if the order is not found or not in a PAID state.
///
/// Bundle purchases are split into one item per course with proportional price,
/// so GA4 reports show real per-course popularity (the bundle name is appended
/// to each `item_name` for context).

import prisma from '@/lib/prisma';
import { inferKindFromOrderRef } from '@/lib/paymentStatus';

export interface GA4Item {
  item_id: string;
  item_name: string;
  price: number;
  quantity: number;
  item_category?: string;
}

export interface GA4PurchaseEvent {
  event: 'purchase';
  ecommerce: {
    transaction_id: string;
    value: number;
    currency: string;
    items: GA4Item[];
  };
}

export async function buildPurchaseEvent(
  orderRef: string,
): Promise<GA4PurchaseEvent | null> {
  const kind = inferKindFromOrderRef(orderRef);

  if (kind === 'connector') {
    const c = await prisma.connectorOrder.findUnique({
      where: { orderReference: orderRef },
      select: { amount: true, paymentStatus: true },
    });
    if (!c || c.paymentStatus !== 'PAID') return null;
    return {
      event: 'purchase',
      ecommerce: {
        transaction_id: orderRef,
        value: c.amount,
        currency: 'UAH',
        items: [
          {
            item_id: 'connector',
            item_name: 'Гра «Конектор»',
            item_category: 'Гра',
            price: c.amount,
            quantity: 1,
          },
        ],
      },
    };
  }

  const p = await prisma.payment.findUnique({
    where: { orderReference: orderRef },
    select: {
      amount: true,
      currency: true,
      status: true,
      course: { select: { id: true, title: true, slug: true } },
      bundle: {
        select: {
          id: true,
          title: true,
          slug: true,
          courses: { select: { courseSlug: true, isFree: true } },
        },
      },
      yearlyProgramSubscription: { select: { plan: true } },
    },
  });
  if (!p || p.status !== 'PAID') return null;

  const value = p.amount;
  const currency = p.currency || 'UAH';

  if (p.course) {
    return {
      event: 'purchase',
      ecommerce: {
        transaction_id: orderRef,
        value,
        currency,
        items: [
          {
            item_id: p.course.slug || p.course.id,
            item_name: p.course.title,
            item_category: 'Курс',
            price: value,
            quantity: 1,
          },
        ],
      },
    };
  }

  if (p.bundle) {
    const paidSlugs = p.bundle.courses
      .filter((c) => !c.isFree)
      .map((c) => c.courseSlug);
    const slugsForItems = paidSlugs.length > 0 ? paidSlugs : p.bundle.courses.map((c) => c.courseSlug);

    const courses = await prisma.course.findMany({
      where: { slug: { in: slugsForItems } },
      select: { id: true, title: true, slug: true },
    });

    const n = courses.length || 1;
    const pricePerCourse = Math.round((value / n) * 100) / 100;

    return {
      event: 'purchase',
      ecommerce: {
        transaction_id: orderRef,
        value,
        currency,
        items: courses.map((c) => ({
          item_id: c.slug || c.id,
          item_name: `${c.title} (пакет: ${p.bundle!.title})`,
          item_category: 'Пакет',
          price: pricePerCourse,
          quantity: 1,
        })),
      },
    };
  }

  if (p.yearlyProgramSubscription) {
    const plan = p.yearlyProgramSubscription.plan;
    const isYearly = plan === 'YEARLY';
    return {
      event: 'purchase',
      ecommerce: {
        transaction_id: orderRef,
        value,
        currency,
        items: [
          {
            item_id: isYearly ? 'yearly-program-annual' : 'yearly-program-monthly',
            item_name: isYearly
              ? 'Річна програма (річна підписка)'
              : 'Річна програма (місячна підписка)',
            item_category: 'Річна програма',
            price: value,
            quantity: 1,
          },
        ],
      },
    };
  }

  return null;
}
