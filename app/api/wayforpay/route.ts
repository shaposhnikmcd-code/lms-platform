import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { orderReference, amount, productName, productPrice, productCount, clientEmail, clientName, clientPhone, courseId, promoCode } = await req.json();

    const merchantLogin = process.env.WAYFORPAY_MERCHANT_LOGIN!;
    const secretKey = process.env.WAYFORPAY_SECRET_KEY!;
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
    const proto = req.headers.get('x-forwarded-proto') || (host?.includes('localhost') ? 'http' : 'https');
    const domain = host ? `${proto}://${host}` : (process.env.NEXTAUTH_URL || 'http://localhost:3000');
    const merchantDomain = 'www.uimp.com.ua';

    const isConnector = orderReference.startsWith('connector_');
    const isBundle = typeof courseId === 'string' && courseId.startsWith('bundle_');

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

      // Для пакетів — знайти bundleId по slug
      let bundleId: string | null = null;
      let paymentCourseId: string | null = courseId;
      if (isBundle) {
        const bundleSlug = courseId.replace('bundle_', '');
        const bundle = await prisma.bundle.findUnique({ where: { slug: bundleSlug } });
        if (bundle) {
          bundleId = bundle.id;
          paymentCourseId = null; // пакет, не окремий курс
        }
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
        },
        update: {},
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

    const paymentData = {
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

    return NextResponse.json(paymentData);
  } catch (error) {
    console.error('❌ Помилка створення платежу:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}