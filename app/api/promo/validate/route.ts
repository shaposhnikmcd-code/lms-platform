import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkRateLimit } from '@/lib/ratelimit';

export async function POST(req: NextRequest) {
  try {
    const rl = await checkRateLimit(req, 'promo');
    if (!rl.ok) return rl.response!;

    const { code, courseId } = await req.json();

    if (!code) {
      return NextResponse.json({ valid: false, message: 'Промокод не вказано' });
    }

    const promo = await prisma.promoCode.findUnique({
      where: { code: code.toUpperCase() },
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
