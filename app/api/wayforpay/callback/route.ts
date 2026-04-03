import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('📩 WayForPay callback:', body.orderReference, body.transactionStatus);

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

    if (merchantSignature !== expectedSignature) {
      console.error('❌ Невірний підпис WayForPay');
      return NextResponse.json({ status: 'error', message: 'Invalid signature' }, { status: 400 });
    }

    const isConnector = orderReference.startsWith('connector_');

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

          console.log('✅ Enrollment створено для userId:', payment.userId, 'courseId:', payment.courseId);

          // Відправляємо подію в SendPulse для зарахування на курс
          const user = await prisma.user.findUnique({ where: { id: payment.userId } });
          if (user?.email) {
            const sendpulseEventUrl = process.env.SENDPULSE_EVENT_URL;
            if (sendpulseEventUrl) {
              try {
                await fetch(sendpulseEventUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    email: user.email,
                    phone: '',
                    product_name: payment.courseId || '',
                    product_id: 0,
                    product_price: String(payment.amount),
                    order_date: new Date().toISOString().split('T')[0],
                  }),
                });
                console.log('✅ SendPulse event відправлено для:', user.email);
              } catch (spError) {
                console.error('❌ Помилка SendPulse event:', spError);
              }
            }
          }
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