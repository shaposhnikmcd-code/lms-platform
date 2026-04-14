import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || req.headers.get('cf-connecting-ip') || 'unknown';
}

function detectKind(orderReference: string | undefined): 'course' | 'bundle' | 'connector' | 'unknown' {
  if (!orderReference) return 'unknown';
  if (orderReference.startsWith('connector_')) return 'connector';
  if (orderReference.startsWith('bundle_')) return 'bundle';
  return 'course';
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const userAgent = req.headers.get('user-agent') || '';
  let body: Record<string, unknown> = {};
  const actions: string[] = [];
  const sendpulseSlugs: string[] = [];
  let signatureValid: boolean | null = null;
  let kind: 'course' | 'bundle' | 'connector' | 'unknown' = 'unknown';
  let prevStatus: string | null = null;
  let skipped = false;
  let skipReason: string | null = null;
  let errorMsg: string | null = null;

  try {
    body = await req.json();
    const orderReference = body.orderReference as string | undefined;
    const transactionStatus = body.transactionStatus as string | undefined;
    const merchantSignature = body.merchantSignature as string | undefined;

    kind = detectKind(orderReference);

    console.log('📩 WayForPay callback:', {
      orderReference,
      transactionStatus,
      kind,
      ip,
    });

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

    signatureValid = merchantSignature === expectedSignature;

    if (!signatureValid) {
      console.error('❌ Невірний підпис WayForPay:', orderReference);
      await writeLog({
        kind,
        body,
        ip,
        userAgent,
        signatureValid,
        actions,
        sendpulseSlugs,
        skipped: true,
        skipReason: 'invalid_signature',
        prevStatus,
        errorMsg: 'Invalid signature',
      });
      return NextResponse.json({ status: 'error', message: 'Invalid signature' }, { status: 400 });
    }

    if (transactionStatus === 'Approved') {
      if (kind === 'connector') {
        const existing = await prisma.connectorOrder.findUnique({
          where: { orderReference: orderReference! },
          select: { paymentStatus: true },
        });
        prevStatus = existing?.paymentStatus || null;

        if (prevStatus === 'PAID') {
          skipped = true;
          skipReason = 'already_paid';
          actions.push('skip:already_paid');
          console.log('ℹ️ Конектор уже PAID, пропускаю:', orderReference);
        } else {
          await prisma.connectorOrder.update({
            where: { orderReference: orderReference! },
            data: {
              paymentStatus: 'PAID',
              paidAt: new Date(),
              orderStatus: 'NEW',
            },
          });
          actions.push('connector:paid');
          console.log('✅ Конектор оплачено:', orderReference);
        }
      } else {
        // course або bundle
        const payment = await prisma.payment.findUnique({
          where: { orderReference: orderReference! },
        });

        if (!payment) {
          skipped = true;
          skipReason = 'payment_not_found';
          errorMsg = 'Payment not found';
          console.error('❌ Payment не знайдено для:', orderReference);
        } else if (!payment.courseId && !payment.bundleId) {
          skipped = true;
          skipReason = 'missing_course_and_bundle';
          errorMsg = 'Payment has no courseId/bundleId';
          console.error('❌ courseId та bundleId відсутні у Payment:', orderReference);
        } else {
          prevStatus = payment.status;

          if (payment.status === 'PAID') {
            // Ідемпотентність: callback вже оброблявся раніше — НЕ повторювати enrollment/SendPulse
            skipped = true;
            skipReason = 'already_paid';
            actions.push('skip:already_paid');
            console.log('ℹ️ Payment уже PAID, пропускаю enrollment+SendPulse:', orderReference);
          } else {
            await prisma.payment.update({
              where: { orderReference: orderReference! },
              data: { status: 'PAID', paidAt: new Date() },
            });
            actions.push('payment:updated');

            const user = await prisma.user.findUnique({ where: { id: payment.userId } });
            const sendpulseEventUrl = process.env.SENDPULSE_EVENT_URL;

            let courseSlugs: string[] = [];
            if (payment.bundleId) {
              const bundle = await prisma.bundle.findUnique({
                where: { id: payment.bundleId },
                include: { courses: true },
              });
              if (bundle) {
                const paidSlugs = bundle.courses.filter((c) => !c.isFree).map((c) => c.courseSlug);
                if (bundle.type === 'CHOICE_FREE') {
                  // Клієнт обирав з пулу — використовуємо збережені freeSlugs
                  courseSlugs = [...paidSlugs, ...(payment.freeSlugs ?? [])];
                } else {
                  // DISCOUNT: всі (isFree=false). FIXED_FREE: платні + всі фіксовані безкоштовні
                  const freeSlugs = bundle.courses.filter((c) => c.isFree).map((c) => c.courseSlug);
                  courseSlugs = [...paidSlugs, ...freeSlugs];
                }
                actions.push(`bundle:${bundle.type}(${bundle.courses.length})`);
              }
            } else if (payment.courseId) {
              courseSlugs = [payment.courseId];
            }

            for (const slug of courseSlugs) {
              try {
                await prisma.enrollment.upsert({
                  where: { userId_courseId: { userId: payment.userId, courseId: slug } },
                  create: { userId: payment.userId, courseId: slug },
                  update: {},
                });
                actions.push(`enrollment:${slug}`);
              } catch {
                actions.push(`enrollment-skip:${slug}`);
              }
            }

            if (user?.email && sendpulseEventUrl) {
              for (const slug of courseSlugs) {
                try {
                  await fetch(sendpulseEventUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      email: user.email,
                      phone: '',
                      product_name: slug,
                      product_id: 0,
                      product_price: Number(payment.amount),
                      order_date: new Date().toISOString().split('T')[0],
                    }),
                  });
                  sendpulseSlugs.push(slug);
                  console.log('✅ SendPulse event sent:', user.email, slug);
                } catch (spError) {
                  console.error('❌ SendPulse event error:', spError, slug);
                  actions.push(`sendpulse-error:${slug}`);
                }
              }
              if (sendpulseSlugs.length) {
                actions.push(`sendpulse:sent(${sendpulseSlugs.length})`);
              }
            } else if (!sendpulseEventUrl) {
              actions.push('sendpulse:env-missing');
            }
          }
        }
      }
    } else if (transactionStatus === 'Declined' || transactionStatus === 'Expired') {
      if (kind === 'connector') {
        await prisma.connectorOrder.updateMany({
          where: { orderReference: orderReference! },
          data: { paymentStatus: 'FAILED' },
        });
        actions.push('connector:failed');
      } else {
        await prisma.payment.updateMany({
          where: { orderReference: orderReference! },
          data: { status: 'FAILED' },
        });
        actions.push('payment:failed');
      }
      console.log('❌ Оплата відхилена для:', orderReference);
    } else {
      actions.push(`status:${transactionStatus || 'unknown'}`);
    }

    await writeLog({
      kind,
      body,
      ip,
      userAgent,
      signatureValid,
      actions,
      sendpulseSlugs,
      skipped,
      skipReason,
      prevStatus,
      errorMsg,
    });

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
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Помилка callback:', error);
    try {
      await writeLog({
        kind,
        body,
        ip,
        userAgent,
        signatureValid,
        actions,
        sendpulseSlugs,
        skipped,
        skipReason,
        prevStatus,
        errorMsg: message,
      });
    } catch {}
    return NextResponse.json({ status: 'error' }, { status: 500 });
  }
}

interface LogArgs {
  kind: string;
  body: Record<string, unknown>;
  ip: string;
  userAgent: string;
  signatureValid: boolean | null;
  actions: string[];
  sendpulseSlugs: string[];
  skipped: boolean;
  skipReason: string | null;
  prevStatus: string | null;
  errorMsg: string | null;
}

async function writeLog(args: LogArgs) {
  try {
    const orderReference = (args.body.orderReference as string | undefined) || null;
    const transactionStatus = (args.body.transactionStatus as string | undefined) || null;
    const amountRaw = args.body.amount;
    const amount =
      typeof amountRaw === 'number'
        ? Math.round(amountRaw)
        : typeof amountRaw === 'string'
          ? Math.round(Number(amountRaw))
          : null;
    const currency = (args.body.currency as string | undefined) || null;
    const clientEmail = (args.body.email as string | undefined) || null;

    await prisma.paymentCallbackLog.create({
      data: {
        source: 'wayforpay',
        kind: args.kind,
        orderReference,
        transactionStatus,
        amount: Number.isFinite(amount) ? (amount as number) : null,
        currency,
        clientEmail,
        ip: args.ip,
        userAgent: args.userAgent,
        signatureValid: args.signatureValid,
        prevStatus: args.prevStatus,
        actionsTaken: args.actions.length ? args.actions.join(',') : null,
        sendpulseSlugs: args.sendpulseSlugs.length ? args.sendpulseSlugs.join(',') : null,
        skipped: args.skipped,
        skipReason: args.skipReason,
        rawPayload: args.body as object,
        error: args.errorMsg,
      },
    });
  } catch (logError) {
    console.error('⚠️ Не вдалося записати PaymentCallbackLog:', logError);
  }
}
