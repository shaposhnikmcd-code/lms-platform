/// Server-side price resolver для WayForPay Purchase створення.
/// Визначає authoritative ціну на сервері, незалежно від того, що клієнт передав у body.
/// Забезпечує, що clientAmount не може бути підроблений (C1 security fix).

import prisma from './prisma';
import { COURSES_BY_SLUG } from './coursesCatalog';
import { YEARLY_PROGRAM_CONFIG } from './yearlyProgramConfig';
import { YEARLY_PROGRAM } from '@/app/[locale]/yearly-program/config';

export type ResolvedPricingKind = 'course' | 'bundle' | 'yearly' | 'monthly' | 'connector';

export interface ResolvedPricing {
  kind: ResolvedPricingKind;
  basePrice: number;
  productName: string;
  productCount: number;
  bundleId: string | null;
  paymentCourseId: string | null;
  yearlyProgramSubscriptionId: null; // визначається пізніше в route при створенні підписки
}

/// Визначає kind + базову ціну серверно. Повертає null якщо courseId невідомий
/// і orderReference не впізнаний (ні yearly, ні bundle, ні каталог).
export async function resolveServerPricing(args: {
  orderReference: string;
  courseId?: string;
  /// Для bundle CHOICE_FREE — потрібно для productName
  bundleSlugOverride?: string;
}): Promise<{
  kind: ResolvedPricingKind;
  basePrice: number;
  productName: string;
  productCount: number;
  bundleId: string | null;
  paymentCourseId: string | null;
} | null> {
  const { orderReference, courseId } = args;

  // connector: ціна з ConnectorOrder (створюється раніше POST /api/connector)
  if (orderReference.startsWith('connector_')) {
    const order = await prisma.connectorOrder.findUnique({
      where: { orderReference },
      select: { amount: true },
    });
    if (!order) return null;
    return {
      kind: 'connector',
      basePrice: order.amount,
      productName: 'Гра Конектор',
      productCount: 1,
      bundleId: null,
      paymentCourseId: null,
    };
  }

  // yearly program (monthly PREFIX перевіряємо першим — він містить "yearly-program")
  if (orderReference.startsWith(`${YEARLY_PROGRAM_CONFIG.monthlyOrderPrefix}_`)) {
    return {
      kind: 'monthly',
      basePrice: Number(YEARLY_PROGRAM.monthlyPrice),
      productName: YEARLY_PROGRAM_CONFIG.monthlyOrderPrefix,
      productCount: 1,
      bundleId: null,
      paymentCourseId: null,
    };
  }
  if (orderReference.startsWith(`${YEARLY_PROGRAM_CONFIG.yearlyOrderPrefix}_`)) {
    return {
      kind: 'yearly',
      basePrice: Number(YEARLY_PROGRAM.price),
      productName: YEARLY_PROGRAM_CONFIG.yearlyOrderPrefix,
      productCount: 1,
      bundleId: null,
      paymentCourseId: null,
    };
  }

  // bundle
  if (courseId && courseId.startsWith('bundle_')) {
    const slug = courseId.slice('bundle_'.length);
    const bundle = await prisma.bundle.findUnique({
      where: { slug },
      select: { id: true, price: true, title: true, published: true, suspendedAt: true },
    });
    if (!bundle || !bundle.published || bundle.suspendedAt) return null;
    return {
      kind: 'bundle',
      basePrice: bundle.price,
      productName: bundle.title,
      productCount: 1,
      bundleId: bundle.id,
      paymentCourseId: null,
    };
  }

  // course slug (catalog або override)
  if (courseId && COURSES_BY_SLUG[courseId]) {
    const catalog = COURSES_BY_SLUG[courseId];
    const override = await prisma.coursePriceOverride.findUnique({
      where: { slug: courseId },
      select: { price: true },
    });
    const price = override?.price ?? catalog.price;
    return {
      kind: 'course',
      basePrice: price,
      productName: catalog.titleUk,
      productCount: 1,
      bundleId: null,
      paymentCourseId: courseId,
    };
  }

  return null;
}

/// Застосовує promo код до базової ціни на сервері (без довіри до клієнта).
/// Повертає { discountedPrice, promoId } — і потім саме ROUTE вирішує коли
/// інкрементувати usedCount (has be after Payment is successfully created).
export async function applyPromoServerSide(args: {
  promoCode: string | null | undefined;
  courseId: string | null | undefined;
  basePrice: number;
}): Promise<{ finalPrice: number; promoId: string | null }> {
  const { promoCode, courseId, basePrice } = args;
  if (!promoCode) return { finalPrice: basePrice, promoId: null };

  const promo = await prisma.promoCode.findUnique({
    where: { code: promoCode.toUpperCase() },
  });
  if (!promo || !promo.active) return { finalPrice: basePrice, promoId: null };
  if (promo.expiresAt && promo.expiresAt < new Date()) return { finalPrice: basePrice, promoId: null };
  if (promo.maxUses && promo.usedCount >= promo.maxUses) return { finalPrice: basePrice, promoId: null };
  if (promo.courseId && promo.courseId !== courseId) return { finalPrice: basePrice, promoId: null };

  let discounted = basePrice;
  if (promo.discountType === 'PERCENTAGE') {
    discounted = Math.max(1, Math.round(basePrice * (1 - promo.discountValue / 100)));
  } else {
    discounted = Math.max(1, basePrice - promo.discountValue);
  }

  return { finalPrice: discounted, promoId: promo.id };
}
