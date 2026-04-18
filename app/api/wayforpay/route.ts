import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { isYearlyProgramOrderRef, YEARLY_PROGRAM_CONFIG } from '@/lib/yearlyProgramConfig';
import { buildRegularPurchaseFlags } from '@/lib/wayforpay';
import { applyPromoServerSide, resolveServerPricing } from '@/lib/paymentPricing';
import { checkRateLimit } from '@/lib/ratelimit';

export async function POST(req: NextRequest) {
  try {
    const rl = await checkRateLimit(req, 'payment');
    if (!rl.ok) return rl.response!;

    const { orderReference, clientEmail, clientName, clientPhone, courseId, promoCode, selectedFreeSlugs, recurring } = await req.json();

    if (typeof orderReference !== 'string' || !orderReference) {
      return NextResponse.json({ error: 'Missing orderReference' }, { status: 400 });
    }

    const merchantLogin = process.env.WAYFORPAY_MERCHANT_LOGIN!;
    const secretKey = process.env.WAYFORPAY_SECRET_KEY!;
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
    const proto = req.headers.get('x-forwarded-proto') || (host?.includes('localhost') ? 'http' : 'https');
    const domain = host ? `${proto}://${host}` : (process.env.NEXTAUTH_URL || 'http://localhost:3000');
    const merchantDomain = 'www.uimp.com.ua';

    const isConnector = orderReference.startsWith('connector_');
    const yearlyKind = isYearlyProgramOrderRef(orderReference);

    // Серверний price lookup — НЕ довіряємо клієнту. Якщо resolveServerPricing повернув null —
    // орder невідомий (неіснуючий bundle/course, не зареєстрований connector order, etc.).
    const resolved = await resolveServerPricing({
      orderReference,
      courseId: typeof courseId === 'string' ? courseId : undefined,
    });
    if (!resolved) {
      return NextResponse.json({ error: 'Unknown product' }, { status: 400 });
    }

    // Промо — теж на сервері. Якщо невалідний — ігноруємо, працюємо з basePrice.
    // courseId для промо — для course/bundle це courseId з body. Для yearly-program —
    // спеціальний slug, проти якого може бути створено PromoCode (наприклад monthlyPromoCode).
    const promoCourseKey = yearlyKind
      ? (yearlyKind === 'monthly' ? YEARLY_PROGRAM_CONFIG.monthlyOrderPrefix : YEARLY_PROGRAM_CONFIG.yearlyOrderPrefix)
      : (typeof courseId === 'string' ? courseId : null);
    const { finalPrice: promoFinalPrice, promoId } = await applyPromoServerSide({
      promoCode: typeof promoCode === 'string' ? promoCode : undefined,
      courseId: promoCourseKey,
      basePrice: resolved.basePrice,
    });

    // Admin test: дозволяємо символічну ціну 1/2 ₴ для перевірки callback-флоу. Адмін перевіряється
    // через session, клієнт не може підробити.
    const session = await getServerSession(authOptions);
    const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'ADMIN';
    const adminTestPrice = yearlyKind === 'yearly' ? 2 : 1;
    const finalAmount = isAdmin ? adminTestPrice : promoFinalPrice;

    if (!Number.isFinite(finalAmount) || finalAmount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    let bundleId: string | null = resolved.bundleId;
    let paymentCourseId: string | null = resolved.paymentCourseId;
    const productName: string = resolved.productName;
    const productPrice: number = finalAmount;
    const productCount: number = resolved.productCount;

    // Для курсів/пакетів/yearly — створюємо/знаходимо користувача і Payment
    if (!isConnector) {
      if (!clientEmail || typeof clientEmail !== 'string') {
        return NextResponse.json({ error: 'Email is required' }, { status: 400 });
      }

      // Знайти або створити користувача за email
      const user = await prisma.user.upsert({
        where: { email: clientEmail },
        create: {
          email: clientEmail,
          name: typeof clientName === 'string' ? clientName : '',
        },
        update: {},
      });

      // Для bundle — валідація вибору безкоштовних (CHOICE_FREE) + обчислення finalFreeSlugs
      let finalFreeSlugs: string[] = [];
      if (bundleId) {
        const bundle = await prisma.bundle.findUnique({
          where: { id: bundleId },
          include: { courses: true },
        });
        if (bundle) {
          paymentCourseId = null;
          const fixedFree = bundle.courses.filter((c) => c.isFree).map((c) => c.courseSlug);
          const choicePool = fixedFree;

          if (bundle.type === 'FIXED_FREE') {
            finalFreeSlugs = fixedFree;
          } else if (bundle.type === 'CHOICE_FREE') {
            const incoming: string[] = Array.isArray(selectedFreeSlugs) ? selectedFreeSlugs : [];
            const unique = [...new Set(incoming)];
            if (unique.length !== bundle.freeCount) {
              return NextResponse.json(
                { error: `Оберіть рівно ${bundle.freeCount} безкоштовних курсів` },
                { status: 400 },
              );
            }
            if (unique.some((s) => !choicePool.includes(s))) {
              return NextResponse.json(
                { error: 'Один з обраних курсів не входить до пулу пакету' },
                { status: 400 },
              );
            }
            finalFreeSlugs = unique;
          }
        }
      }

      // Для річної програми — знаходимо/створюємо підписку і лінкуємо Payment
      let yearlyProgramSubscriptionId: string | null = null;
      if (yearlyKind) {
        const plan = yearlyKind === 'yearly' ? 'YEARLY' : 'MONTHLY';
        const existing = await prisma.yearlyProgramSubscription.findFirst({
          where: {
            userId: user.id,
            plan,
            status: { in: ['PENDING', 'ACTIVE', 'GRACE'] },
          },
          orderBy: { createdAt: 'desc' },
        });
        if (existing) {
          yearlyProgramSubscriptionId = existing.id;
        } else {
          const created = await prisma.yearlyProgramSubscription.create({
            data: {
              userId: user.id,
              plan,
              status: 'PENDING',
            },
          });
          yearlyProgramSubscriptionId = created.id;
        }
        paymentCourseId = null;
      }

      // Upsert Payment. Якщо Payment вже PAID — відмовляємо (захист від replay
      // з новим selectedFreeSlugs / promo після callback-у).
      const existingPayment = await prisma.payment.findUnique({
        where: { orderReference },
        select: { status: true },
      });
      if (existingPayment?.status === 'PAID') {
        return NextResponse.json({ error: 'Payment already finalized' }, { status: 409 });
      }

      const isNewPayment = !existingPayment;
      await prisma.payment.upsert({
        where: { orderReference },
        create: {
          userId: user.id,
          courseId: paymentCourseId,
          bundleId,
          orderReference,
          amount: finalAmount,
          status: 'PENDING',
          freeSlugs: finalFreeSlugs,
          yearlyProgramSubscriptionId,
        },
        update: {
          amount: finalAmount,
          freeSlugs: finalFreeSlugs,
          yearlyProgramSubscriptionId,
        },
      });

      // Idempotent promo counter: інкрементуємо usedCount лише на першому створенні Payment.
      // Raw SQL гарантує атомарну перевірку maxUses (CAS) — дві паралельні оплати не зможуть
      // перевищити ліміт.
      if (isNewPayment && promoId) {
        await prisma.$executeRaw`
          UPDATE "PromoCode"
          SET "usedCount" = "usedCount" + 1
          WHERE "id" = ${promoId}
            AND "active" = true
            AND ("maxUses" IS NULL OR "usedCount" < "maxUses")
        `;
      }
    }

    const orderDate = Math.floor(Date.now() / 1000);

    const signatureString = [
      merchantLogin,
      merchantDomain,
      orderReference,
      orderDate,
      finalAmount,
      'UAH',
      productName,
      productCount,
      productPrice,
    ].join(';');

    const merchantSignature = crypto
      .createHmac('md5', secretKey)
      .update(signatureString)
      .digest('hex');

    const paymentData: Record<string, unknown> = {
      merchantAccount: merchantLogin,
      merchantDomainName: merchantDomain,
      orderReference,
      orderDate,
      amount: finalAmount,
      currency: 'UAH',
      orderLifetime: 86400,
      productName: [productName],
      productPrice: [productPrice],
      productCount: [productCount],
      clientEmail,
      clientFirstName: typeof clientName === 'string' ? clientName.split(' ')[0] || '' : '',
      clientLastName: typeof clientName === 'string' ? clientName.split(' ').slice(1).join(' ') || '' : '',
      clientPhone: typeof clientPhone === 'string' ? clientPhone : '',
      returnUrl: `${domain}/api/wayforpay/return`,
      serviceUrl: `${domain}/api/wayforpay/callback`,
      merchantSignature,
      language: 'UA',
    };

    // Для MONTHLY плану Річної програми — увімкнути токенізацію й регулярне щомісячне списання.
    // Адмінський тест (1 ₴) НЕ викликає регулярку — щоб не створити рекурентну оплату в WFP.
    if (yearlyKind === 'monthly' && recurring !== false && !isAdmin) {
      const flags = buildRegularPurchaseFlags({
        amount: finalAmount,
        totalPayments: YEARLY_PROGRAM_CONFIG.totalMonthlyPayments,
      });
      Object.assign(paymentData, flags);
    }

    return NextResponse.json(paymentData);
  } catch (error) {
    console.error('❌ Помилка створення платежу:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
