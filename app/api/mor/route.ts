/// Checkout для закордонних платежів через Paddle (Merchant of Record).
/// Дзеркало до app/api/wayforpay/route.ts, але для іноземців. Скоуп Фази 1: КУРСИ + ПАКЕТИ.
/// Річна програма через Paddle — окремо (Фаза 2b), бо потребує підписочної логіки.
///
/// Флоу: клієнт POST → серверний price lookup → user upsert → Payment(PENDING, provider=paddle)
/// → createPaddleTransaction → повертаємо checkoutUrl, клієнт редіректить на Paddle.
/// Далі app/api/mor/webhook ловить transaction.completed і видає доступ через provisionPayment.

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { resolveServerPricing } from '@/lib/paymentPricing';
import { checkRateLimit } from '@/lib/ratelimit';
import { isPaddleConfigured, createPaddleTransaction } from '@/lib/paddle';
import { resolvePaddlePriceId, buildPaddleProductKey } from '@/lib/paddleProducts';

export async function POST(req: NextRequest) {
  try {
    const rl = await checkRateLimit(req, 'payment');
    if (!rl.ok) return rl.response!;

    if (!isPaddleConfigured()) {
      // Очікувано до завершення Фази 1 (реєстрація Paddle + env).
      return NextResponse.json({ error: 'Платіжна система для закордонних карток ще не активована. Напишіть на edu@uimp.com.ua', code: 'paddle_not_configured' }, { status: 503 });
    }

    const { orderReference, clientEmail, clientName, courseId, selectedFreeSlugs } = await req.json();

    if (typeof orderReference !== 'string' || !orderReference) {
      return NextResponse.json({ error: 'Missing orderReference' }, { status: 400 });
    }
    // Скоуп Фази 1 — тільки course/bundle. Connector/yearly/monthly не через цей роут.
    if (orderReference.startsWith('connector_') || orderReference.includes('yearly-program')) {
      return NextResponse.json({ error: 'Цей продукт поки недоступний для оплати закордонною карткою', code: 'not_supported_yet' }, { status: 400 });
    }

    if (!clientEmail || typeof clientEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail.trim())) {
      return NextResponse.json({ error: 'Невалідний email' }, { status: 400 });
    }

    // Серверний price lookup — НЕ довіряємо клієнту (як у WFP).
    const resolved = await resolveServerPricing({
      orderReference,
      courseId: typeof courseId === 'string' ? courseId : undefined,
    });
    if (!resolved || (resolved.kind !== 'course' && resolved.kind !== 'bundle')) {
      return NextResponse.json({ error: 'Unknown product' }, { status: 400 });
    }

    // Paddle Price ID — джерело правди про USD-ціну. Промокоди для закордону поки
    // не застосовуємо (знижки робитимуться через Paddle discount codes у Фазі 2).
    const productKey = buildPaddleProductKey({
      kind: resolved.kind,
      courseId: typeof courseId === 'string' ? courseId : null,
      paymentCourseId: resolved.paymentCourseId,
    });
    const priceId = productKey ? resolvePaddlePriceId(productKey) : null;
    if (!priceId) {
      return NextResponse.json({ error: 'Для цього продукту ще не налаштована закордонна ціна. Напишіть на edu@uimp.com.ua', code: 'price_not_mapped' }, { status: 503 });
    }

    // User upsert — та сама логіка, що у WFP-роуті (активний юзер за email або новий).
    const trimmedName = typeof clientName === 'string' ? clientName.trim() : '';
    let user = await prisma.user.findFirst({ where: { email: clientEmail, deletedAt: null } });
    if (user) {
      if (trimmedName && trimmedName !== user.name) {
        user = await prisma.user.update({ where: { id: user.id }, data: { name: trimmedName } });
      }
    } else {
      const zombie = await prisma.user.findUnique({ where: { email: clientEmail } });
      if (zombie && zombie.deletedAt) {
        await prisma.user.update({ where: { id: zombie.id }, data: { email: `deleted_${Date.now()}_${zombie.email}` } });
      }
      user = await prisma.user.create({ data: { email: clientEmail, name: trimmedName } });
    }

    let bundleId: string | null = resolved.bundleId;
    let paymentCourseId: string | null = resolved.paymentCourseId;
    let finalFreeSlugs: string[] = [];

    // Duplicate-purchase guard для індивідуального курсу (як у WFP).
    if (paymentCourseId && !bundleId) {
      const existing = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: user.id, courseId: paymentCourseId } },
        select: { id: true },
      });
      if (existing) {
        return NextResponse.json({ error: 'У вас уже є цей курс. Допомога: edu@uimp.com.ua', code: 'course_already_purchased' }, { status: 409 });
      }
    }

    // Bundle: валідація вибору безкоштовних (CHOICE_FREE) + finalFreeSlugs (як у WFP).
    if (bundleId) {
      const bundle = await prisma.bundle.findUnique({ where: { id: bundleId }, include: { courses: true } });
      if (bundle) {
        paymentCourseId = null;
        const fixedFree = bundle.courses.filter((c) => c.isFree).map((c) => c.courseSlug);
        if (bundle.type === 'FIXED_FREE') {
          finalFreeSlugs = fixedFree;
        } else if (bundle.type === 'CHOICE_FREE') {
          const incoming: string[] = Array.isArray(selectedFreeSlugs) ? selectedFreeSlugs : [];
          const unique = [...new Set(incoming)];
          if (unique.length !== bundle.freeCount) {
            return NextResponse.json({ error: `Оберіть рівно ${bundle.freeCount} безкоштовних курсів` }, { status: 400 });
          }
          if (unique.some((s) => !fixedFree.includes(s))) {
            return NextResponse.json({ error: 'Один з обраних курсів не входить до пулу пакету' }, { status: 400 });
          }
          finalFreeSlugs = unique;
        }
      }
    }

    // Payment.upsert. amount=0 поки — реальну USD-суму (в центах) випишемо у webhook
    // з data.details.totals.grand_total. currency=USD, provider=paddle.
    const existingPayment = await prisma.payment.findUnique({ where: { orderReference }, select: { status: true } });
    if (existingPayment?.status === 'PAID') {
      return NextResponse.json({ error: 'Payment already finalized' }, { status: 409 });
    }

    await prisma.payment.upsert({
      where: { orderReference },
      create: {
        userId: user.id,
        courseId: paymentCourseId,
        bundleId,
        orderReference,
        amount: 0,
        currency: 'USD',
        status: 'PENDING',
        paymentProvider: 'paddle',
        freeSlugs: finalFreeSlugs,
      },
      update: {
        currency: 'USD',
        paymentProvider: 'paddle',
        freeSlugs: finalFreeSlugs,
      },
    });

    // Створюємо Paddle Transaction + повертаємо checkout URL.
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
    const proto = req.headers.get('x-forwarded-proto') || (host?.includes('localhost') ? 'http' : 'https');
    const domain = host ? `${proto}://${host}` : (process.env.NEXTAUTH_URL || 'http://localhost:3000');

    const session = await getServerSession(authOptions); // зарезервовано: admin-тест-знижки в майбутньому
    void session;

    const tx = await createPaddleTransaction({
      priceId,
      email: clientEmail,
      customData: { orderReference },
      successUrl: `${domain}/payment/success?type=${resolved.kind}`,
    });

    // Лінкуємо Paddle transaction id у externalRef — webhook зможе зматчити навіть без custom_data.
    await prisma.payment.update({
      where: { orderReference },
      data: { externalRef: tx.transactionId },
    });

    return NextResponse.json({ checkoutUrl: tx.checkoutUrl, transactionId: tx.transactionId });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('❌ Помилка створення Paddle-платежу:', msg);
    if (msg === 'paddle_not_configured') {
      return NextResponse.json({ error: 'Платіжна система ще не активована', code: 'paddle_not_configured' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
