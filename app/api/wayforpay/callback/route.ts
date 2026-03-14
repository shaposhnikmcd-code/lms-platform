import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('📩 WayForPay callback:', body);

    const { orderReference, transactionStatus, merchantSignature } = body;

    // Перевірка підпису від WayForPay
    const secretKey = process.env.WAYFORPAY_SECRET_KEY!;
    const signatureString = [
      body.merchantAccount,
      body.orderReference,
      body.amount,
      body.currency,
      body.authCode,
      body.cardPan,
      body.transactionStatus,
      body.reasonCode,
    ].join(';');

    const expectedSignature = crypto
      .createHmac('md5', secretKey)
      .update(signatureString)
      .digest('hex');

    if (merchantSignature !== expectedSignature) {
      console.error('❌ Невірний підпис WayForPay');
      return NextResponse.json({ status: 'error', message: 'Invalid signature' }, { status: 400 });
    }

    const isConnector = orderReference.startsWith('connector_');
    const isCourse = !isConnector;

    if (transactionStatus === 'Approved') {

      if (isConnector) {
        // Оновлюємо замовлення Конектора
        await prisma.connectorOrder.update({
          where: { orderReference },
          data: {
            paymentStatus: 'PAID',
            paidAt: new Date(),
            orderStatus: 'NEW',
          },
        });
        console.log('✅ Конектор оплачено:', orderReference);
      }

      if (isCourse) {
        // orderReference має формат: courseId_timestamp
        const courseId = orderReference.split('_')[0];
        const email = body.email || body.clientEmail || '';

        console.log('📚 Курс оплачено:', courseId, 'email:', email);

        // Знаходимо юзера по email
        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (user) {
          // Створюємо Enrollment якщо ще немає
          await prisma.enrollment.upsert({
            where: {
              userId_courseId: {
                userId: user.id,
                courseId,
              },
            },
            create: {
              userId: user.id,
              courseId,
            },
            update: {},
          });

          // Зберігаємо Payment
          await prisma.payment.upsert({
            where: { orderReference },
            create: {
              userId: user.id,
              courseId,
              orderReference,
              amount: body.amount,
              status: 'PAID',
              paidAt: new Date(),
            },
            update: {
              status: 'PAID',
              paidAt: new Date(),
            },
          });

          console.log('✅ Enrollment та Payment створено для:', user.email, courseId);
        } else {
          console.error('❌ Юзера не знайдено по email:', email);
        }
      }

    } else if (transactionStatus === 'Declined' || transactionStatus === 'Expired') {

      if (isConnector) {
        await prisma.connectorOrder.update({
          where: { orderReference },
          data: { paymentStatus: 'FAILED' },
        });
      }

      if (isCourse) {
        const courseId = orderReference.split('_')[0];
        const email = body.email || body.clientEmail || '';
        const user = await prisma.user.findUnique({ where: { email } });

        if (user) {
          await prisma.payment.upsert({
            where: { orderReference },
            create: {
              userId: user.id,
              courseId,
              orderReference,
              amount: body.amount,
              status: 'FAILED',
            },
            update: { status: 'FAILED' },
          });
        }
      }

      console.log('❌ Оплата відхилена для:', orderReference);
    }

    const responseSignature = crypto
      .createHmac('md5', secretKey)
      .update(`${orderReference};accept`)
      .digest('hex');

    return NextResponse.json({
      orderReference,
      status: 'accept',
      time: Math.floor(Date.now() / 1000),
      signature: responseSignature,
    });
  } catch (error) {
    console.error('❌ Помилка callback:', error);
    return NextResponse.json({ status: 'error' }, { status: 500 });
  }
}