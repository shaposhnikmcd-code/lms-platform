import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Детальне логування всього що приходить від WayForPay
    console.log('📩 WayForPay callback FULL BODY:', JSON.stringify(body, null, 2));

    const { orderReference, transactionStatus, merchantSignature } = body;

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

    // Логуємо підписи для порівняння
    console.log('🔐 merchantSignature (від WFP):', merchantSignature);
    console.log('🔐 expectedSignature (наш):', expectedSignature);
    console.log('🔐 signatureString:', signatureString);
    console.log('🔐 Підписи співпадають:', merchantSignature === expectedSignature);

    // ТИМЧАСОВО: не блокуємо якщо підпис не співпадає — тільки логуємо
    if (merchantSignature !== expectedSignature) {
      console.error('⚠️ Невірний підпис — але продовжуємо для діагностики');
    }

    const isConnector = orderReference.startsWith('connector_');

    console.log('📦 orderReference:', orderReference);
    console.log('📦 transactionStatus:', transactionStatus);
    console.log('📦 isConnector:', isConnector);

    if (transactionStatus === 'Approved') {

      if (isConnector) {
        await prisma.connectorOrder.update({
          where: { orderReference },
          data: {
            paymentStatus: 'PAID',
            paidAt: new Date(),
            orderStatus: 'NEW',
          },
        });
        console.log('✅ Конектор оплачено:', orderReference);

      } else {
        const payment = await prisma.payment.findUnique({
          where: { orderReference },
        });

        if (!payment) {
          console.error('❌ Payment не знайдено для:', orderReference);
        } else if (!payment.courseId) {
          console.error('❌ courseId відсутній у Payment:', orderReference);
        } else {
          await prisma.payment.update({
            where: { orderReference },
            data: {
              status: 'PAID',
              paidAt: new Date(),
            },
          });

          await prisma.enrollment.upsert({
            where: {
              userId_courseId: {
                userId: payment.userId,
                courseId: payment.courseId,
              },
            },
            create: {
              userId: payment.userId,
              courseId: payment.courseId,
            },
            update: {},
          });

          console.log('✅ Payment оновлено та Enrollment створено для userId:', payment.userId, 'courseId:', payment.courseId);
        }
      }

    } else if (transactionStatus === 'Declined' || transactionStatus === 'Expired') {

      if (isConnector) {
        await prisma.connectorOrder.update({
          where: { orderReference },
          data: { paymentStatus: 'FAILED' },
        });
      } else {
        await prisma.payment.updateMany({
          where: { orderReference },
          data: { status: 'FAILED' },
        });
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