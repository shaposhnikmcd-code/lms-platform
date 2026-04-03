import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { orderReference, amount, productName, productPrice, productCount, clientEmail, clientName, clientPhone, courseId, promoCode } = await req.json();

    const merchantLogin = process.env.WAYFORPAY_MERCHANT_LOGIN!;
    const secretKey = process.env.WAYFORPAY_SECRET_KEY!;
    const domain = process.env.NEXTAUTH_URL || 'https://dr-shaposhnik-platform.vercel.app';

    const isConnector = orderReference.startsWith('connector_');

    // Для курсів — створюємо/знаходимо користувача і Payment
    if (!isConnector) {
      if (!clientEmail) {
        return NextResponse.json({ error: 'Email is required' }, { status: 400 });
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

      // Перевірка та використання промокоду
      let finalAmount = amount;
      if (promoCode) {
        const promo = await prisma.promoCode.findUnique({
          where: { code: promoCode.toUpperCase() },
        });
        if (promo && promo.active) {
          if (promo.discountType === 'PERCENTAGE') {
            finalAmount = Math.round(amount * (1 - promo.discountValue / 100));
          } else {
            finalAmount = Math.max(0, amount - promo.discountValue);
          }
          await prisma.promoCode.update({
            where: { id: promo.id },
            data: { usedCount: { increment: 1 } },
          });
        }
      }

      await prisma.payment.upsert({
        where: { orderReference },
        create: {
          userId: user.id,
          courseId,
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
      domain,
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
      merchantDomainName: domain,
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