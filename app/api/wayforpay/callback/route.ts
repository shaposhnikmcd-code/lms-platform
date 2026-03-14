import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('📩 WayForPay callback:', body);

    const {
      orderReference,
      transactionStatus,
      merchantSignature,
    } = body;

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

    if (transactionStatus === 'Approved') {
      await prisma.connectorOrder.update({
        where: { orderReference },
        data: {
          paymentStatus: 'PAID',
          paidAt: new Date(),
          orderStatus: 'NEW',
        },
      });
      console.log('✅ Оплата підтверджена для:', orderReference);
    } else if (transactionStatus === 'Declined' || transactionStatus === 'Expired') {
      await prisma.connectorOrder.update({
        where: { orderReference },
        data: { paymentStatus: 'FAILED' },
      });
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