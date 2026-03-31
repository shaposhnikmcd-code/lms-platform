import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { orderReference, amount, productName, productPrice, productCount, clientEmail, courseId } = await req.json();

    const merchantLogin = process.env.WAYFORPAY_MERCHANT_LOGIN!;
    const secretKey = process.env.WAYFORPAY_SECRET_KEY!;
    const domain = process.env.NEXTAUTH_URL || 'https://dr-shaposhnik-platform.vercel.app';

    const isConnector = orderReference.startsWith('connector_');

    // Для курсів — перевіряємо сесію і створюємо Payment
    if (!isConnector) {
      const session = await getServerSession(authOptions);

      if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const user = await prisma.user.findUnique({
        where: { email: clientEmail },
      });

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      await prisma.payment.upsert({
        where: { orderReference },
        create: {
          userId: user.id,
          courseId,
          orderReference,
          amount,
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