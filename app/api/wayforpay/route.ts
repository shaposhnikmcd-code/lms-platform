import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  const { orderReference, amount, productName, productPrice, productCount, clientEmail } = await req.json();

  const merchantLogin = process.env.WAYFORPAY_MERCHANT_LOGIN!;
  const secretKey = process.env.WAYFORPAY_SECRET_KEY!;
  const domain = process.env.NEXTAUTH_URL || 'https://dr-shaposhnik-platform.vercel.app';

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
    returnUrl: `${domain}/payment/success`,
    serviceUrl: `${domain}/api/wayforpay/callback`,
    merchantSignature,
    language: 'UA',
  };

  return NextResponse.json(paymentData);
}