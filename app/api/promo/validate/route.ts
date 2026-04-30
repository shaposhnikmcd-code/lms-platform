import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkRateLimit } from '@/lib/ratelimit';
import { COURSES_BY_SLUG } from '@/lib/coursesCatalog';
import { YEARLY_PROGRAM_CONFIG } from '@/lib/yearlyProgramConfig';
import { isPromoWindowActive } from '@/lib/paymentPricing';

/// Якщо код збігся, але вікно дії ще не настало / вже минуло — повертаємо точне
/// повідомлення замість generic "не знайдено", щоб користувач не плутався.
function windowFeedback(
  startsAt: Date | null | undefined,
  expiresAt: Date | null | undefined,
  now: Date,
): string {
  if (startsAt && now.getTime() < startsAt.getTime()) return 'Промокод ще не активний';
  if (expiresAt && now.getTime() >= expiresAt.getTime()) return 'Промокод прострочений';
  return 'Промокод не активний';
}

export async function POST(req: NextRequest) {
  try {
    const rl = await checkRateLimit(req, 'promo');
    if (!rl.ok) return rl.response!;

    const { code, courseId } = await req.json();

    if (!code) {
      return NextResponse.json({ valid: false, message: 'Промокод не вказано' });
    }

    const upper = String(code).toUpperCase();
    const now = new Date();

    // 1) Per-course override-промо: керується з /dashboard/admin/courses.
    // Той самий код може існувати на різних курсах із різними цінами; перевіряємо
    // тільки в межах поточного курсу.
    if (courseId && typeof courseId === 'string' && COURSES_BY_SLUG[courseId]) {
      const override = await prisma.coursePriceOverride.findUnique({
        where: { slug: courseId },
        select: {
          promo1Code: true,
          promo1Price: true,
          promo1StartsAt: true,
          promo1ExpiresAt: true,
          promo2Code: true,
          promo2Price: true,
          promo2StartsAt: true,
          promo2ExpiresAt: true,
        },
      });
      if (override) {
        if (override.promo1Code === upper && override.promo1Price !== null) {
          if (!isPromoWindowActive(override.promo1StartsAt, override.promo1ExpiresAt, now)) {
            return NextResponse.json({
              valid: false,
              message: windowFeedback(override.promo1StartsAt, override.promo1ExpiresAt, now),
            });
          }
          return NextResponse.json({
            valid: true,
            discountType: 'FIXED_PRICE',
            fixedPrice: Math.max(1, override.promo1Price),
          });
        }
        if (override.promo2Code === upper && override.promo2Price !== null) {
          if (!isPromoWindowActive(override.promo2StartsAt, override.promo2ExpiresAt, now)) {
            return NextResponse.json({
              valid: false,
              message: windowFeedback(override.promo2StartsAt, override.promo2ExpiresAt, now),
            });
          }
          return NextResponse.json({
            valid: true,
            discountType: 'FIXED_PRICE',
            fixedPrice: Math.max(1, override.promo2Price),
          });
        }
      }
    }

    // 1b) Категорійний промокод (bundle / connector / yearly / monthly) — один код на всю категорію.
    const categoryKey: string | null =
      typeof courseId === 'string' && courseId.startsWith('bundle_')
        ? 'bundle'
        : courseId === 'connector'
        ? 'connector'
        : courseId === YEARLY_PROGRAM_CONFIG.monthlyOrderPrefix
        ? 'monthly'
        : courseId === YEARLY_PROGRAM_CONFIG.yearlyOrderPrefix
        ? 'yearly'
        : null;
    if (categoryKey) {
      const cat = await prisma.categoryPromoOverride.findUnique({
        where: { category: categoryKey },
        select: {
          promo1Code: true,
          promo1Price: true,
          promo1StartsAt: true,
          promo1ExpiresAt: true,
        },
      });
      if (cat?.promo1Code === upper && cat.promo1Price !== null) {
        if (!isPromoWindowActive(cat.promo1StartsAt, cat.promo1ExpiresAt, now)) {
          return NextResponse.json({
            valid: false,
            message: windowFeedback(cat.promo1StartsAt, cat.promo1ExpiresAt, now),
          });
        }
        return NextResponse.json({
          valid: true,
          discountType: 'FIXED_PRICE',
          fixedPrice: Math.max(1, cat.promo1Price),
        });
      }
    }

    // 2) Global PromoCode fallback
    const promo = await prisma.promoCode.findUnique({
      where: { code: upper },
    });

    if (!promo) {
      return NextResponse.json({ valid: false, message: 'Промокод не знайдено' });
    }

    if (!promo.active) {
      return NextResponse.json({ valid: false, message: 'Промокод неактивний' });
    }

    if (promo.expiresAt && promo.expiresAt < new Date()) {
      return NextResponse.json({ valid: false, message: 'Промокод прострочений' });
    }

    if (promo.maxUses && promo.usedCount >= promo.maxUses) {
      return NextResponse.json({ valid: false, message: 'Промокод вичерпано' });
    }

    if (promo.courseId && promo.courseId !== courseId) {
      return NextResponse.json({ valid: false, message: 'Промокод не дійсний для цього курсу' });
    }

    return NextResponse.json({
      valid: true,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
    });
  } catch (error) {
    console.error('Помилка перевірки промокоду:', error);
    return NextResponse.json({ valid: false, message: 'Помилка сервера' }, { status: 500 });
  }
}
