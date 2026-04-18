import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { isYearlyProgramOrderRef, YEARLY_PROGRAM_CONFIG } from '@/lib/yearlyProgramConfig';
import { buildRegularPurchaseFlags } from '@/lib/wayforpay';

export async function POST(req: NextRequest) {
  try {
    const { orderReference, amount, productName, productPrice, productCount, clientEmail, clientName, clientPhone, courseId, promoCode, selectedFreeSlugs } = await req.json();

    const merchantLogin = process.env.WAYFORPAY_MERCHANT_LOGIN!;
    const secretKey = process.env.WAYFORPAY_SECRET_KEY!;
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
    const proto = req.headers.get('x-forwarded-proto') || (host?.includes('localhost') ? 'http' : 'https');
    const domain = host ? `${proto}://${host}` : (process.env.NEXTAUTH_URL || 'http://localhost:3000');
    const merchantDomain = 'www.uimp.com.ua';

    const isConnector = orderReference.startsWith('connector_');
    const isBundle = typeof courseId === 'string' && courseId.startsWith('bundle_');
    const yearlyKind = isYearlyProgramOrderRef(orderReference);

    // Для курсів/пакетів — створюємо/знаходимо користувача і Payment
    if (!isConnector) {
      if (!clientEmail) {
        return NextResponse.json({ error: 'Email is required' }, { status: 400 });
      }

      // Валідація суми (фронт уже застосував промо)
      const finalAmount = Number(amount);
      if (!Number.isFinite(finalAmount) || finalAmount <= 0) {
        return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
      }

      // Admin test mode: 1 ₴ дозволено лише для ADMIN-сесії.
      // Якщо ціна підозріло низька (< 10 ₴) і user не адмін — відкидаємо, щоб ніхто
      // не прикидався адміном через фронтенд-підробку.
      if (finalAmount < 10) {
        const session = await getServerSession(authOptions);
        const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'ADMIN';
        if (!isAdmin) {
          return NextResponse.json({ error: 'Amount too low' }, { status: 400 });
        }
      }

      // Знайти або створити користувача за email
      const user = await prisma.user.upsert({
        where: { email: clientEmail },
        create: {
          email: clientEmail,
          name: clientName || '',
        },
        update: {},
      });

      // Інкрементуємо usedCount промокоду (саму знижку вже застосував фронт)
      if (promoCode) {
        const promo = await prisma.promoCode.findUnique({
          where: { code: promoCode.toUpperCase() },
        });
        if (promo && promo.active) {
          await prisma.promoCode.update({
            where: { id: promo.id },
            data: { usedCount: { increment: 1 } },
          });
        }
      }

      // Для пакетів — знайти bundleId по slug і перевалідувати вибір безкоштовних
      let bundleId: string | null = null;
      let paymentCourseId: string | null = courseId;
      let finalFreeSlugs: string[] = [];
      if (isBundle) {
        const bundleSlug = courseId.replace('bundle_', '');
        const bundle = await prisma.bundle.findUnique({
          where: { slug: bundleSlug },
          include: { courses: true },
        });
        if (bundle) {
          bundleId = bundle.id;
          paymentCourseId = null; // пакет, не окремий курс

          const fixedFree = bundle.courses.filter((c) => c.isFree).map((c) => c.courseSlug);
          const choicePool = bundle.courses.filter((c) => c.isFree).map((c) => c.courseSlug);

          if (bundle.type === 'FIXED_FREE') {
            finalFreeSlugs = fixedFree;
          } else if (bundle.type === 'CHOICE_FREE') {
            const incoming: string[] = Array.isArray(selectedFreeSlugs) ? selectedFreeSlugs : [];
            // Валідація: всі обрані мають бути в пулі, кількість точно = freeCount
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
        // Шукаємо активну/pending підписку цього юзера на цьому плані. Якщо є — реюзаємо,
        // інакше створюємо нову. Один юзер може мати лише одну актуальну підписку.
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
        // paymentCourseId лишаємо як є (yearly-program / yearly-program-monthly) —
        // Payment.course FK опційна й немає такого запису в Course, тож обнулимо.
        paymentCourseId = null;
      }

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
          freeSlugs: finalFreeSlugs,
          yearlyProgramSubscriptionId,
        },
      });
    }

    const orderDate = Math.floor(Date.now() / 1000);

    const signatureString = [
      merchantLogin,
      merchantDomain,
      orderReference,
      orderDate,
      amount,
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
      amount,
      currency: 'UAH',
      orderLifetime: 86400,
      productName: [productName],
      productPrice: [productPrice],
      productCount: [productCount],
      clientEmail,
      clientFirstName: clientName?.split(' ')[0] || '',
      clientLastName: clientName?.split(' ').slice(1).join(' ') || '',
      clientPhone: clientPhone || '',
      returnUrl: `${domain}/api/wayforpay/return`,
      serviceUrl: `${domain}/api/wayforpay/callback`,
      merchantSignature,
      language: 'UA',
    };

    // Для MONTHLY плану Річної програми — увімкнути токенізацію й регулярне щомісячне списання
    // на стороні WFP. WFP щомісяця шле callback з новим orderReference, який ми ловимо нижче.
    // (Не входить у signature — додаткові поля.)
    if (yearlyKind === 'monthly') {
      const flags = buildRegularPurchaseFlags({
        amount: Number(amount),
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