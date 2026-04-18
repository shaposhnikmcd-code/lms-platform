import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { isYearlyProgramOrderRef, YEARLY_PROGRAM_CONFIG } from '@/lib/yearlyProgramConfig';
import { lookupStudentIdByEmail, openAccessViaEvent } from '@/lib/sendpulse';
import { timingSafeEqualStr } from '@/lib/authTiming';
import { YEARLY_PROGRAM } from '@/app/[locale]/yearly-program/config';

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || req.headers.get('cf-connecting-ip') || 'unknown';
}

type CallbackKind = 'course' | 'bundle' | 'connector' | 'yearly' | 'monthly' | 'unknown';

function detectKind(orderReference: string | undefined): CallbackKind {
  if (!orderReference) return 'unknown';
  if (orderReference.startsWith('connector_')) return 'connector';
  if (orderReference.startsWith('bundle_')) return 'bundle';
  const yp = isYearlyProgramOrderRef(orderReference);
  if (yp) return yp;
  return 'course';
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const userAgent = req.headers.get('user-agent') || '';
  let body: Record<string, unknown> = {};
  const actions: string[] = [];
  const sendpulseSlugs: string[] = [];
  let signatureValid: boolean | null = null;
  let kind: CallbackKind = 'unknown';
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

    signatureValid = typeof merchantSignature === 'string'
      && timingSafeEqualStr(merchantSignature, expectedSignature);

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

        // Claim-then-act: атомарний flip, щоб два одночасних callback-и не задвоїли зміну
        // orderStatus/paidAt. count=0 ⇒ вже PAID, skip.
        const claim = await prisma.connectorOrder.updateMany({
          where: { orderReference: orderReference!, paymentStatus: { not: 'PAID' } },
          data: {
            paymentStatus: 'PAID',
            paidAt: new Date(),
            orderStatus: 'NEW',
          },
        });
        if (claim.count === 0) {
          skipped = true;
          skipReason = 'already_paid';
          actions.push('skip:already_paid');
          console.log('ℹ️ Конектор уже PAID (claim lost), пропускаю:', orderReference);
        } else {
          actions.push('connector:paid');
          console.log('✅ Конектор оплачено:', orderReference);
        }
      } else if (kind === 'yearly' || kind === 'monthly') {
        const result = await handleYearlyProgramCallback({
          orderReference: orderReference!,
          kind,
          body,
        });
        prevStatus = result.prevStatus;
        skipped = result.skipped;
        skipReason = result.skipReason;
        errorMsg = result.errorMsg;
        actions.push(...result.actions);
        sendpulseSlugs.push(...result.sendpulseSlugs);
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

          // Claim-then-act (Bug #2 fix): атомарно переводимо PENDING → PAID. Якщо count=0,
          // значить інший callback вже відпрацював — skip enrollment/SendPulse, щоб уникнути
          // подвійної відправки SendPulse event.
          const claim = await prisma.payment.updateMany({
            where: { orderReference: orderReference!, status: { not: 'PAID' } },
            data: { status: 'PAID', paidAt: new Date() },
          });

          if (claim.count === 0) {
            skipped = true;
            skipReason = 'already_paid';
            actions.push('skip:already_paid');
            console.log('ℹ️ Payment уже PAID (claim lost), пропускаю:', orderReference);
          } else {
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
                // Dedupe (Bug #15): якщо той самий courseSlug у paid і free — не шлемо двічі SendPulse.
                courseSlugs = [...new Set(courseSlugs)];
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

        // Для MONTHLY регулярки фіксуємо невдалу спробу на підписці — cron
        // потім вирішує чи закривати доступ після grace-періоду.
        if (kind === 'monthly') {
          const failedPayment = await prisma.payment.findUnique({
            where: { orderReference: orderReference! },
            select: { yearlyProgramSubscriptionId: true },
          });
          if (failedPayment?.yearlyProgramSubscriptionId) {
            await prisma.yearlyProgramSubscription.update({
              where: { id: failedPayment.yearlyProgramSubscriptionId },
              data: {
                failedChargeCount: { increment: 1 },
                lastChargeAttemptAt: new Date(),
                lastChargeError: `WFP ${transactionStatus}: ${String(body.reason ?? body.reasonCode ?? '')}`.slice(0, 500),
              },
            });
            await prisma.yearlyProgramSubscriptionEvent.create({
              data: {
                subscriptionId: failedPayment.yearlyProgramSubscriptionId,
                type: 'charge_failed',
                message: `${transactionStatus}: ${String(body.reason ?? body.reasonCode ?? 'unknown')}`,
                metadata: { orderReference, transactionStatus, reason: body.reason ?? null },
              },
            });
            actions.push('yearly:charge_failed_logged');
          }
        }
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

interface YearlyResult {
  prevStatus: string | null;
  skipped: boolean;
  skipReason: string | null;
  errorMsg: string | null;
  actions: string[];
  sendpulseSlugs: string[];
}

/// Обробка callback-а для Річної програми (yearly або monthly plan).
/// — Перший платіж: Payment із orderReference знайдений у БД → PAID, активуємо підписку.
/// — Наступний регулярний (WFP автосписання): Payment не знайдений, шукаємо підписку по email
///   користувача → створюємо новий Payment, продовжуємо expiresAt.
async function handleYearlyProgramCallback(args: {
  orderReference: string;
  kind: 'yearly' | 'monthly';
  body: Record<string, unknown>;
}): Promise<YearlyResult> {
  const actions: string[] = [];
  const sendpulseSlugs: string[] = [];
  const clientEmail = (args.body.email as string | undefined) ?? null;
  const amountRaw = args.body.amount;
  const amountInt = typeof amountRaw === 'number'
    ? Math.round(amountRaw)
    : typeof amountRaw === 'string'
      ? Math.round(Number(amountRaw))
      : 0;
  const recToken = (args.body.recToken as string | undefined) ?? null;

  // 1) Знаходимо Payment за orderReference (перший платіж).
  const existingPayment = await prisma.payment.findUnique({
    where: { orderReference: args.orderReference },
    include: { user: true },
  });

  let payment = existingPayment;
  let isRecurring = false;

  if (!payment) {
    // 2) Це, найімовірніше, WFP авто-списання по регулярному платежу. orderReference новий.
    //    Шукаємо активну MONTHLY підписку по email клієнта.
    if (args.kind !== 'monthly' || !clientEmail) {
      return {
        prevStatus: null,
        skipped: true,
        skipReason: 'payment_not_found',
        errorMsg: `Payment not found for ${args.orderReference}${clientEmail ? '' : ' (no email)'}`,
        actions,
        sendpulseSlugs,
      };
    }
    const user = await prisma.user.findUnique({ where: { email: clientEmail } });
    if (!user) {
      return {
        prevStatus: null,
        skipped: true,
        skipReason: 'user_not_found',
        errorMsg: `User not found for email ${clientEmail}`,
        actions,
        sendpulseSlugs,
      };
    }
    // Для recurring callback обовʼязково привʼязуємо по recToken (C5 fix).
    // Не довіряємо тільки email — WFP може прислати callback з правильним підписом,
    // але без recToken це ще не доводить що це наш merchantAccount.
    if (!recToken) {
      return {
        prevStatus: null,
        skipped: true,
        skipReason: 'missing_rec_token',
        errorMsg: `Recurring callback without recToken for ${clientEmail}`,
        actions,
        sendpulseSlugs,
      };
    }
    const sub = await prisma.yearlyProgramSubscription.findFirst({
      where: {
        userId: user.id,
        plan: 'MONTHLY',
        status: { in: ['ACTIVE', 'GRACE'] },
        recToken,
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!sub) {
      return {
        prevStatus: null,
        skipped: true,
        skipReason: 'subscription_not_found',
        errorMsg: `No active MONTHLY subscription matching email+recToken`,
        actions,
        sendpulseSlugs,
      };
    }
    // Перевірка суми — має відповідати config.monthlyPrice (допустимий дрейф ±1 ₴).
    const expectedAmount = Number(YEARLY_PROGRAM.monthlyPrice);
    if (Number.isFinite(expectedAmount) && Math.abs(amountInt - expectedAmount) > 1) {
      return {
        prevStatus: null,
        skipped: true,
        skipReason: 'amount_mismatch',
        errorMsg: `Recurring charge amount ${amountInt} ≠ expected ${expectedAmount}`,
        actions,
        sendpulseSlugs,
      };
    }
    // Перевірка 9-платіжного cap (Bug #4): якщо вже є N PAID платежів — відмовляємо.
    const paidCount = await prisma.payment.count({
      where: { yearlyProgramSubscriptionId: sub.id, status: 'PAID' },
    });
    if (paidCount >= YEARLY_PROGRAM_CONFIG.totalMonthlyPayments) {
      return {
        prevStatus: null,
        skipped: true,
        skipReason: 'monthly_cap_reached',
        errorMsg: `MONTHLY already has ${paidCount} paid (cap ${YEARLY_PROGRAM_CONFIG.totalMonthlyPayments})`,
        actions,
        sendpulseSlugs,
      };
    }
    // Створюємо Payment для цього автосписання і лінкуємо з підпискою.
    payment = await prisma.payment.create({
      data: {
        userId: user.id,
        courseId: null,
        bundleId: null,
        orderReference: args.orderReference,
        amount: amountInt || 0,
        status: 'PENDING',
        yearlyProgramSubscriptionId: sub.id,
      },
      include: { user: true },
    });
    isRecurring = true;
    actions.push('yearly:recurring_payment_created');
  } else {
    // Перший платіж: Payment знайдений. Перевіряємо, що підписка ще не CANCELLED/EXPIRED
    // (Bug #6) — callback для такої підписки не має продовжувати доступ.
    if (payment.yearlyProgramSubscriptionId) {
      const subCheck = await prisma.yearlyProgramSubscription.findUnique({
        where: { id: payment.yearlyProgramSubscriptionId },
        select: { status: true },
      });
      if (subCheck && (subCheck.status === 'CANCELLED' || subCheck.status === 'EXPIRED')) {
        return {
          prevStatus: payment.status,
          skipped: true,
          skipReason: `subscription_${subCheck.status.toLowerCase()}`,
          errorMsg: `Subscription is ${subCheck.status}, refusing to extend`,
          actions,
          sendpulseSlugs,
        };
      }
    }
    // Якщо email у callback відрізняється від Payment.user.email — відмовляємо (H2 fix).
    if (clientEmail && payment.user?.email && clientEmail.toLowerCase() !== payment.user.email.toLowerCase()) {
      return {
        prevStatus: payment.status,
        skipped: true,
        skipReason: 'email_mismatch',
        errorMsg: `Callback email ≠ Payment.user.email`,
        actions,
        sendpulseSlugs,
      };
    }
  }

  const prevStatus = payment.status;
  if (prevStatus === 'PAID') {
    return {
      prevStatus,
      skipped: true,
      skipReason: 'already_paid',
      errorMsg: null,
      actions: [...actions, 'skip:already_paid'],
      sendpulseSlugs,
    };
  }

  if (!payment.yearlyProgramSubscriptionId) {
    return {
      prevStatus,
      skipped: true,
      skipReason: 'missing_subscription_link',
      errorMsg: `Payment ${payment.id} has no yearlyProgramSubscriptionId`,
      actions,
      sendpulseSlugs,
    };
  }

  // Claim-then-act: атомарний flip PAID. Якщо інший callback вже позначив PAID — skip
  // щоб не продовжити expiresAt двічі (Bug #1 fix).
  const claim = await prisma.payment.updateMany({
    where: { id: payment.id, status: { not: 'PAID' } },
    data: { status: 'PAID', paidAt: new Date() },
  });
  if (claim.count === 0) {
    return {
      prevStatus: 'PAID',
      skipped: true,
      skipReason: 'already_paid',
      errorMsg: null,
      actions: [...actions, 'skip:already_paid_claim_lost'],
      sendpulseSlugs,
    };
  }
  actions.push('payment:paid');

  // Тягнемо підписку і користувача
  const sub = await prisma.yearlyProgramSubscription.findUnique({
    where: { id: payment.yearlyProgramSubscriptionId },
  });
  const user = payment.user;
  if (!sub || !user) {
    return {
      prevStatus,
      skipped: false,
      skipReason: null,
      errorMsg: 'Subscription or user missing after payment',
      actions,
      sendpulseSlugs,
    };
  }

  // Продовжуємо доступ
  const now = new Date();
  const durationDays = sub.plan === 'YEARLY'
    ? YEARLY_PROGRAM_CONFIG.yearlyDurationDays
    : YEARLY_PROGRAM_CONFIG.monthlyDurationDays;
  const currentExpires = sub.expiresAt && sub.expiresAt > now ? sub.expiresAt : now;
  const newExpiresAt = new Date(currentExpires.getTime() + durationDays * 24 * 60 * 60 * 1000);
  const wasFirstPayment = !sub.startDate;

  await prisma.yearlyProgramSubscription.update({
    where: { id: sub.id },
    data: {
      status: 'ACTIVE',
      startDate: sub.startDate ?? now,
      expiresAt: newExpiresAt,
      lastPaymentAt: now,
      failedChargeCount: 0,
      lastChargeError: null,
      // recToken оновлюємо якщо WFP прислав його у цьому callback (перший платіж monthly).
      ...(recToken ? { recToken } : {}),
      // Reset reminders — щоб наступний цикл знову їх відправив.
      reminderSent3d: false,
      reminderSent1d: false,
      reminderSentExpired: false,
    },
  });

  await prisma.yearlyProgramSubscriptionEvent.create({
    data: {
      subscriptionId: sub.id,
      type: wasFirstPayment ? 'created' : (isRecurring ? 'renewed' : 'renewed'),
      message: `Payment ${payment.orderReference} · +${durationDays}d · expires ${newExpiresAt.toISOString().slice(0, 10)}`,
      metadata: {
        amount: payment.amount,
        paymentId: payment.id,
        recurring: isRecurring,
      },
    },
  });
  actions.push(`yearly:${sub.plan.toLowerCase()}:+${durationDays}d`);

  // Відкриваємо доступ у SendPulse (event → funnel → enrollment).
  // Для recurring-платежу це не обовʼязково (доступ вже відкритий), але повторне відправлення
  // не шкодить — SendPulse ігнорує дублі.
  try {
    await openAccessViaEvent(
      user.email,
      YEARLY_PROGRAM_CONFIG.sendpulseEventSlug,
      payment.amount,
    );
    sendpulseSlugs.push(YEARLY_PROGRAM_CONFIG.sendpulseEventSlug);
    actions.push('sendpulse:event_sent');

    if (!sub.sendpulseAccessOpenedAt) {
      await prisma.yearlyProgramSubscription.update({
        where: { id: sub.id },
        data: { sendpulseAccessOpenedAt: now, sendpulseAccessClosedAt: null },
      });
      await prisma.yearlyProgramSubscriptionEvent.create({
        data: {
          subscriptionId: sub.id,
          type: 'access_opened',
          message: `SendPulse event sent (${YEARLY_PROGRAM_CONFIG.sendpulseEventSlug})`,
        },
      });
    }

    // Лукапимо SendPulse studentId, якщо його ще нема і сконфігуровано courseId.
    // Це може не спрацювати одразу (воронка створює Student async), тому не блокуючи.
    if (!sub.sendpulseStudentId && YEARLY_PROGRAM_CONFIG.sendpulseCourseId) {
      try {
        const studentId = await lookupStudentIdByEmail(
          YEARLY_PROGRAM_CONFIG.sendpulseCourseId,
          user.email,
        );
        if (studentId) {
          await prisma.yearlyProgramSubscription.update({
            where: { id: sub.id },
            data: { sendpulseStudentId: studentId },
          });
          actions.push(`sendpulse:student_id:${studentId}`);
        } else {
          actions.push('sendpulse:student_id:not_found_yet');
        }
      } catch (e) {
        actions.push(`sendpulse:lookup_err:${(e as Error).message.slice(0, 40)}`);
      }
    }
  } catch (e) {
    actions.push(`sendpulse:event_err:${(e as Error).message.slice(0, 40)}`);
  }

  return {
    prevStatus,
    skipped: false,
    skipReason: null,
    errorMsg: null,
    actions,
    sendpulseSlugs,
  };
}
