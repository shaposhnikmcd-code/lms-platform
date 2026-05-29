import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { isYearlyProgramOrderRef, YEARLY_PROGRAM_CONFIG } from '@/lib/yearlyProgramConfig';
import { sendYearlyProgramWelcomeEmail } from '@/lib/yearlyProgramWelcomeEmail';
import {
  generateInviteForSubscription,
  getYearlyProgramTelegramSettings,
} from '@/lib/yearlyProgramTelegram';
import { sendYearlyProgramPlanChangedEmail } from '@/lib/yearlyProgramPlanChangedEmail';
import { sendYearlyProgramPaymentReceiptEmail } from '@/lib/yearlyProgramPaymentReceiptEmail';
import { timingSafeEqualStr } from '@/lib/authTiming';
import { getYearlyProgramSettings } from '@/lib/yearlyProgramSettings';
import { provisionPayment } from '@/lib/paymentProvisioning';
import { sendBundlePurchaseEmail } from '@/lib/bundlePurchaseEmail';
import { getWayforpayCreds } from '@/lib/wayforpay';
import { calculateAccessUntil, maxAutopayChargeCount } from '@/lib/yearlyProgramAccess';
import { notifyManagers as notifyConnectorManagers } from '@/lib/connectorNotifications';

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

    const secretKey = getWayforpayCreds().secretKey;
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

          // Сповіщення менеджерам про успішну оплату (best-effort, не блокує WFP-ack).
          const paidOrder = await prisma.connectorOrder.findUnique({
            where: { orderReference: orderReference! },
          });
          if (paidOrder) {
            notifyConnectorManagers('paid', paidOrder).catch((e) =>
              console.error('[wfp callback] connector notifyManagers failed:', e),
            );
          }
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
        // course або bundle — двофазна обробка:
        //
        // ФАЗА A (critical, must-succeed):
        //   Атомарний flip Payment.status = PAID через claim-then-act updateMany.
        //   Якщо БД-помилка — НЕ ack-аємо WFP (повернемо 500), він ретраїть, поки не пройде.
        //   Це фінансово-критична частина — гарантує що PAID не загубиться.
        //
        // ФАЗА B (best-effort, idempotent):
        //   Enrollment.upsert + SendPulse event для кожного slug-а (через provisionPayment helper).
        //   Якщо щось падає — логуємо `provisionError`, **але WFP отримує `accept`**.
        //   Reconciliation cron (`/api/cron/reconcile-payments`) щочверть години бачить
        //   PAID payments із NULL у `enrollmentsCompletedAt`/`sendpulseSentAt` і догенеровує.
        //   Це і є страховка від ситуації типу 28.04 (column missing → 12 retry-storm).
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

          // === ФАЗА A: атомарний claim flip ===
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

            // === ФАЗА B: best-effort провіжинінг (НЕ кидає, повертає errors) ===
            const fresh = await prisma.payment.findUnique({
              where: { id: payment.id },
            });
            if (fresh) {
              const provision = await provisionPayment(fresh);
              if (provision.enrollmentsCreated.length > 0) {
                actions.push(`enrollments:${provision.enrollmentsCreated.join(',')}`);
              }
              if (provision.sendpulseSent.length > 0) {
                sendpulseSlugs.push(...provision.sendpulseSent);
                actions.push(`sendpulse:sent(${provision.sendpulseSent.length})`);
              }
              if (provision.errors.length > 0) {
                actions.push(`provision-deferred:${provision.errors.length}_err`);
                console.error('⚠️ Provision deferred to recon cron:', orderReference, provision.errors);
                // Не виставляємо errorMsg — Payment вже PAID, recon догенерує. Помилки
                // лежать у Payment.provisionError для діагностики.
              }

              // Bundle purchase confirmation email — шлемо ОДИН раз тут (тільки на
              // wasFirstApproved=true, тобто всередині гілки claim.count>0). Recon не
              // йде через цей шлях, тому дублів не буде. Незалежний від SP-воронки —
              // гарантований лист навіть якщо студент вже має курси з пакета на SP.
              if (fresh.bundleId) {
                try {
                  const user = await prisma.user.findUnique({
                    where: { id: fresh.userId },
                    select: { email: true, name: true },
                  });
                  if (user?.email) {
                    const r = await sendBundlePurchaseEmail({
                      to: user.email,
                      name: user.name,
                      bundleId: fresh.bundleId,
                      freeSlugs: fresh.freeSlugs ?? [],
                    });
                    if (r.ok) {
                      actions.push('bundle-email:sent');
                    } else {
                      actions.push(`bundle-email:failed(${r.error ?? 'unknown'})`);
                      console.error('⚠️ Bundle email failed:', orderReference, r.error);
                    }
                  }
                } catch (e) {
                  console.error('⚠️ Bundle email throw:', orderReference, e);
                  actions.push('bundle-email:throw');
                }
              }
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
      } else if (kind === 'monthly') {
        // Для MONTHLY Declined/Expired йдемо через спеціальний handler який знає
        // про recurring сценарій: коли cyclical-callback приходить з НОВИМ orderRef
        // (якого нема в нашій БД), треба знайти sub за email і створити Payment FAILED
        // лінкованим до неї + інкрементувати failedChargeCount, щоб cron потім міг
        // надіслати лист cyclicalChargeFailed1 і запустити grace-flow.
        const result = await handleYearlyProgramFailedCallback({
          orderReference: orderReference!,
          body,
          transactionStatus,
        });
        skipped = result.skipped;
        skipReason = result.skipReason;
        errorMsg = result.errorMsg;
        actions.push(...result.actions);
      } else {
        // course / bundle / yearly (single-shot) — простий flip існуючого Payment у FAILED.
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

    // WFP вимагає підпис над orderReference;status;time. Без time у вхідному рядку
    // WFP вважає acknowledge невалідним і ретраїть callback кожні 30-60с до 24г.
    const responseTime = Math.floor(Date.now() / 1000);
    const responseSignature = crypto
      .createHmac('md5', secretKey)
      .update(`${orderReference};accept;${responseTime}`)
      .digest('hex');

    return NextResponse.json({
      orderReference,
      status: 'accept',
      time: responseTime,
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

    // Dedup: WFP ретраїть кожні 30с-1год коли callback повертає 500. Без дедупа це
    // призводить до 12+ ідентичних рядків у БД (як було 27-28.04 із missing column).
    // Skip створення нового рядка якщо за останню годину для того ж orderRef уже є
    // запис із ТИМ САМИМ error. Console.log нижче зберігає per-invocation trace у Vercel runtime,
    // тому аудит не втрачаємо повністю.
    if (orderReference && args.errorMsg) {
      const recent = await prisma.paymentCallbackLog.findFirst({
        where: {
          orderReference,
          error: args.errorMsg,
          createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) },
        },
        select: { id: true },
      });
      if (recent) {
        console.log(`📋 Skipping duplicate WFP callback log (same error in last 1h): ${orderReference}`);
        return;
      }
    }

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

/// Обробка failed (Declined/Expired) callback для MONTHLY plan.
/// — Якщо Payment з orderReference знайдений (це failed initial autopay платіж) — flip у FAILED.
/// — Якщо orderReference новий (failed cyclical від WFP, sub існує) — знаходимо sub за email,
///   створюємо Payment FAILED лінкований до неї + інкрементуємо failedChargeCount.
///
/// Без цього handler-а cyclical-FAILED був би тихим: updateMany оновлював 0 рядків
/// (Payment не існує), failedChargeCount не ріс, cron не бачив підставу для grace-листа.
/// Клієнт не дізнавався про невдалий cyclical поки не закінчиться доступ.
async function handleYearlyProgramFailedCallback(args: {
  orderReference: string;
  body: Record<string, unknown>;
  transactionStatus: string;
}): Promise<{
  skipped: boolean;
  skipReason: string | null;
  errorMsg: string | null;
  actions: string[];
}> {
  const actions: string[] = [];
  const clientEmail = (args.body.email as string | undefined) ?? null;
  const amountRaw = args.body.amount;
  const amountInt = typeof amountRaw === 'number'
    ? Math.round(amountRaw)
    : typeof amountRaw === 'string'
      ? Math.round(Number(amountRaw))
      : 0;
  const reasonStr = `WFP ${args.transactionStatus}: ${String(args.body.reason ?? args.body.reasonCode ?? 'unknown')}`.slice(0, 500);

  // Path 1: Payment вже існує (initial autopay-платіж не пройшов 3DS, або ручний РАЗОВА FAILED).
  const existing = await prisma.payment.findUnique({
    where: { orderReference: args.orderReference },
    select: { id: true, yearlyProgramSubscriptionId: true, status: true },
  });

  if (existing) {
    // Idempotent: оновлюємо тільки якщо ще не FAILED.
    if (existing.status !== 'FAILED') {
      await prisma.payment.update({
        where: { id: existing.id },
        data: { status: 'FAILED' },
      });
      actions.push('payment:failed');
    } else {
      actions.push('skip:already_failed');
    }
    if (existing.yearlyProgramSubscriptionId) {
      await prisma.yearlyProgramSubscription.update({
        where: { id: existing.yearlyProgramSubscriptionId },
        data: {
          failedChargeCount: { increment: 1 },
          lastChargeAttemptAt: new Date(),
          lastChargeError: reasonStr,
        },
      });
      await prisma.yearlyProgramSubscriptionEvent.create({
        data: {
          subscriptionId: existing.yearlyProgramSubscriptionId,
          type: 'charge_failed',
          message: reasonStr,
          metadata: { orderReference: args.orderReference, transactionStatus: args.transactionStatus, reason: args.body.reason ?? null, source: 'existing_payment' },
        },
      });
      actions.push('yearly:charge_failed_logged');
    }
    return { skipped: false, skipReason: null, errorMsg: null, actions };
  }

  // Path 2: Payment не існує — це cyclical FAILED від WFP з новим orderRef.
  // Шукаємо sub за email (як у Approved recurring branch).
  if (!clientEmail) {
    return {
      skipped: true,
      skipReason: 'cyclical_failed_no_email',
      errorMsg: `Failed cyclical for ${args.orderReference}: no email in callback`,
      actions,
    };
  }
  const user = await prisma.user.findUnique({ where: { email: clientEmail } });
  if (!user) {
    return {
      skipped: true,
      skipReason: 'cyclical_failed_user_not_found',
      errorMsg: `Failed cyclical for ${args.orderReference}: no user with email ${clientEmail}`,
      actions,
    };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const sub = await tx.yearlyProgramSubscription.findFirst({
        where: {
          userId: user.id,
          plan: 'MONTHLY',
          status: { in: ['ACTIVE', 'GRACE'] },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (!sub) {
        return { ok: false as const, skipReason: 'cyclical_failed_no_sub', errorMsg: `No active MONTHLY sub for ${clientEmail}` };
      }
      // Створюємо Payment FAILED лінкований до sub (на майбутні аудити і admin UI).
      await tx.payment.create({
        data: {
          userId: user.id,
          courseId: null,
          bundleId: null,
          orderReference: args.orderReference,
          amount: amountInt || 0,
          status: 'FAILED',
          yearlyProgramSubscriptionId: sub.id,
        },
      });
      await tx.yearlyProgramSubscription.update({
        where: { id: sub.id },
        data: {
          failedChargeCount: { increment: 1 },
          lastChargeAttemptAt: new Date(),
          lastChargeError: reasonStr,
        },
      });
      await tx.yearlyProgramSubscriptionEvent.create({
        data: {
          subscriptionId: sub.id,
          type: 'charge_failed',
          message: `Cyclical FAILED · ${reasonStr}`,
          metadata: { orderReference: args.orderReference, transactionStatus: args.transactionStatus, reason: args.body.reason ?? null, source: 'cyclical' },
        },
      });
      return { ok: true as const };
    }, { isolationLevel: 'Serializable' });

    if (!result.ok) {
      return { skipped: true, skipReason: result.skipReason, errorMsg: result.errorMsg, actions };
    }
    actions.push('yearly:cyclical_failed_recorded');
    return { skipped: false, skipReason: null, errorMsg: null, actions };
  } catch (e) {
    // UNIQUE conflict на orderReference: паралельний колбек встиг створити — ОК, idempotent.
    actions.push('yearly:cyclical_failed_race_recovered');
    return { skipped: false, skipReason: null, errorMsg: null, actions };
  }
}

/// Обробка callback-а для Річної програми (yearly або monthly plan).
/// — Перший платіж: Payment із orderReference знайдений у БД → PAID, активуємо підписку.
/// — Наступний регулярний (WFP автосписання): Payment не знайдений, шукаємо підписку по email
///   користувача → створюємо новий Payment, продовжуємо expiresAt.
///
/// Atomicity guarantees (100% no double-charge, no partial state):
/// 1. Recurring Payment creation: Serializable $transaction (sub lookup + cap check + create)
///    захищає від гонки двох паралельних recurring-колбеків з різними orderRef на одну sub.
/// 2. Payment flip PAID + subscription extend + renewal event: один $transaction.
///    Якщо будь-який з кроків падає — rollback, Payment лишається PENDING, WFP retry відпрацює.
/// 3. Payment.orderReference UNIQUE (БД) — захист від дубля Payment для того самого orderRef.
/// 4. Claim-then-act `updateMany where status != PAID` — захист від подвійного flip паралельними колбеками.
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

  // 1) Знаходимо Payment за orderReference (перший платіж).
  const existingPayment = await prisma.payment.findUnique({
    where: { orderReference: args.orderReference },
    include: { user: true },
  });

  let payment = existingPayment;
  let isRecurring = false;

  if (!payment) {
    // 2) Це WFP авто-списання по регулярному платежу. orderReference новий.
    //    Валідуємо kind/email, потім атомарно створюємо Payment у Serializable tx
    //    (щоб два одночасних recurring-колбеки з різними orderRef не подвоїли списання).
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
    // Для recurring callback довіряємо merchantSignature (вже валідовано вище).
    // Шукаємо sub за email+plan+active. Якщо є — створюємо новий Payment лінкований
    // до неї. Захист від двох одночасних recurring-колбеків — Serializable transaction
    // + UNIQUE constraint на Payment.orderReference.
    type RecurringCreateResult =
      | { kind: 'ok'; payment: NonNullable<typeof existingPayment> }
      | { kind: 'error'; skipReason: string; errorMsg: string };

    let createResult: RecurringCreateResult;
    try {
      createResult = await prisma.$transaction(async (tx) => {
        const sub = await tx.yearlyProgramSubscription.findFirst({
          where: {
            userId: user.id,
            plan: 'MONTHLY',
            status: { in: ['ACTIVE', 'GRACE'] },
          },
          orderBy: { createdAt: 'desc' },
        });
        if (!sub) {
          return {
            kind: 'error',
            skipReason: 'subscription_not_found',
            errorMsg: `No active MONTHLY subscription for ${clientEmail}`,
          } as RecurringCreateResult;
        }
        // Очікувана сума для рекурент-списання = сума першого PAID платежу
        // цієї підписки (бо WFP токенізує оригінальну суму). Якщо немає
        // попередніх PAID — fallback на поточний monthlyPrice з налаштувань.
        const firstPaid = await tx.payment.findFirst({
          where: { yearlyProgramSubscriptionId: sub.id, status: 'PAID' },
          orderBy: { paidAt: 'asc' },
          select: { amount: true },
        });
        const settings = firstPaid ? null : await getYearlyProgramSettings(tx);
        const expectedAmount = firstPaid ? firstPaid.amount : settings?.monthlyPrice;
        if (typeof expectedAmount === 'number' && Number.isFinite(expectedAmount) && Math.abs(amountInt - expectedAmount) > 1) {
          return {
            kind: 'error',
            skipReason: 'amount_mismatch',
            errorMsg: `Recurring charge amount ${amountInt} ≠ expected ${expectedAmount}`,
          } as RecurringCreateResult;
        }
        const paidCount = await tx.payment.count({
          where: { yearlyProgramSubscriptionId: sub.id, status: 'PAID' },
        });
        if (paidCount >= YEARLY_PROGRAM_CONFIG.totalMonthlyPayments) {
          return {
            kind: 'error',
            skipReason: 'monthly_cap_reached',
            errorMsg: `MONTHLY already has ${paidCount} paid (cap ${YEARLY_PROGRAM_CONFIG.totalMonthlyPayments})`,
          } as RecurringCreateResult;
        }
        const created = await tx.payment.create({
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
        return { kind: 'ok', payment: created } as RecurringCreateResult;
      }, { isolationLevel: 'Serializable' });
    } catch (e) {
      // UNIQUE constraint violation на orderReference: паралельний колбек встиг створити
      // Payment першим. Перечитуємо і продовжуємо у звичайному флоу — claim-then-act нижче
      // обробить подвійний flip коректно.
      const retry = await prisma.payment.findUnique({
        where: { orderReference: args.orderReference },
        include: { user: true },
      });
      if (!retry) throw e;
      payment = retry;
      isRecurring = true;
      actions.push('yearly:recurring_race_recovered');
      createResult = { kind: 'ok', payment: retry };
    }

    if (createResult.kind === 'error') {
      return {
        prevStatus: null,
        skipped: true,
        skipReason: createResult.skipReason,
        errorMsg: createResult.errorMsg,
        actions,
        sendpulseSlugs,
      };
    }
    if (!payment) {
      payment = createResult.payment;
      isRecurring = true;
      actions.push('yearly:recurring_payment_created');
    }
  } else {
    // Перший платіж: Payment знайдений. Перевіряємо, що підписка ще не CANCELLED/EXPIRED
    // (Bug #6) — callback для такої підписки не має продовжувати доступ.
    if (payment.yearlyProgramSubscriptionId) {
      const subCheck = await prisma.yearlyProgramSubscription.findUnique({
        where: { id: payment.yearlyProgramSubscriptionId },
        select: { status: true },
      });
      if (subCheck && (subCheck.status === 'CANCELLED' || subCheck.status === 'EXPIRED' || subCheck.status === 'ARCHIVED')) {
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
    // Email у callback може відрізнятись від форми (інша картка, saved profile WFP,
    // share-cart). Підпис WFP вже гарантує автентичність — orderReference унікальний
    // і WFP надсилає callback лише за платіж, який він сам обробив. Email — лише
    // metadata для audit-trail, не блокуємо.
    if (clientEmail && payment.user?.email && clientEmail.toLowerCase() !== payment.user.email.toLowerCase()) {
      // PII hygiene: raw email diff є в `clientEmail` колонці і в Payment.user.email;
      // тут — лише прапорець. Адмін побачить обидва через деталі Payment.
      actions.push('warn:email_diff');
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

  // Atomic: flip Payment → PAID + extend subscription + create renewal event.
  // Якщо будь-який крок падає — rollback. Payment лишається PENDING, WFP retry відпрацює знову.
  // Гарантує: неможливо мати PAID Payment без відповідного extend-у sub.expiresAt.
  type SubWithCohort = NonNullable<Awaited<ReturnType<typeof prisma.yearlyProgramSubscription.findUnique>>> & {
    cohort: { startDate: Date; endDate: Date; launchedAt: Date | null } | null;
  };
  type FlipResult =
    | { kind: 'already_paid' }
    | { kind: 'sub_missing' }
    | { kind: 'ok'; sub: SubWithCohort; newExpiresAt: Date; durationDays: number; wasFirstPayment: boolean };

  const SUB_MISSING_SENTINEL = '__SUB_MISSING_ROLLBACK__';
  let flipResult: FlipResult;
  try {
    flipResult = await prisma.$transaction(async (tx): Promise<FlipResult> => {
      const claim = await tx.payment.updateMany({
        where: { id: payment!.id, status: { not: 'PAID' } },
        data: { status: 'PAID', paidAt: new Date() },
      });
      if (claim.count === 0) {
        return { kind: 'already_paid' };
      }

      const sub = await tx.yearlyProgramSubscription.findUnique({
        where: { id: payment!.yearlyProgramSubscriptionId! },
        include: {
          cohort: { select: { startDate: true, endDate: true, launchedAt: true } },
        },
      });
      if (!sub) {
        // Кидаємо sentinel щоб зробити rollback flip-а — Payment має лишитись PENDING.
        throw new Error(SUB_MISSING_SENTINEL);
      }

      const now = new Date();
      const wasFirstPayment = !sub.startDate;

      // Cohort-aware розрахунок expiresAt. Якщо у sub є cohort — використовуємо його межі;
      // без cohort (legacy) — стара логіка `last_payment + N днів`.
      // Поточний Payment уже флипнутий у PAID на line вище (claim updateMany), тож він
      // ВЖЕ є в allPayments. Не пушимо newPaymentAt, інакше платіж рахується двічі
      // (Bug 2026-05-03: давало 2×30=60 днів замість 30 при першій оплаті).
      const allPayments = await tx.payment.findMany({
        where: { yearlyProgramSubscriptionId: sub.id, status: 'PAID' },
        select: { amount: true, status: true, paidAt: true, createdAt: true },
      });
      const newExpiresAt = calculateAccessUntil({
        plan: sub.plan,
        autoRenew: sub.autoRenew,
        cohort: sub.cohort ? { startDate: sub.cohort.startDate, endDate: sub.cohort.endDate } : null,
        payments: allPayments,
      }) ?? now;
      const durationDays = Math.round((newExpiresAt.getTime() - (sub.expiresAt ?? now).getTime()) / (24 * 60 * 60 * 1000));

      await tx.yearlyProgramSubscription.update({
        where: { id: sub.id },
        data: {
          status: 'ACTIVE',
          startDate: sub.startDate ?? now,
          expiresAt: newExpiresAt,
          lastPaymentAt: now,
          failedChargeCount: 0,
          lastChargeError: null,
          // Reset ВСІХ нагадувань + grace-дат — щоб наступний цикл життя підписки
          // (особливо MONTHLY-автоплатіж після відновлення з GRACE) знову коректно
          // відпрацював попередження. Без скидання grace-прапорів на 2-му циклі студент
          // не отримував жодного grace-листа, а стара grace-дата псувала текст листа.
          reminderSent3d: false,
          reminderSentExpired: false,
          reminderSentOnExpiry: false,
          reminderSentGraceStart: false,
          reminderSentGraceMid: false,
          reminderSentGraceLast: false,
          graceStartedAt: null,
          gracePeriodEndsAt: null,
        },
      });

      await tx.yearlyProgramSubscriptionEvent.create({
        data: {
          subscriptionId: sub.id,
          type: wasFirstPayment ? 'created' : 'renewed',
          message: `Payment ${payment!.orderReference} · +${durationDays}d · expires ${newExpiresAt.toISOString().slice(0, 10)}`,
          metadata: {
            amount: payment!.amount,
            paymentId: payment!.id,
            recurring: isRecurring,
          },
        },
      });

      return { kind: 'ok', sub: sub as SubWithCohort, newExpiresAt, durationDays, wasFirstPayment };
    });
  } catch (e) {
    if (e instanceof Error && e.message === SUB_MISSING_SENTINEL) {
      flipResult = { kind: 'sub_missing' };
    } else {
      throw e;
    }
  }

  if (flipResult.kind === 'already_paid') {
    return {
      prevStatus: 'PAID',
      skipped: true,
      skipReason: 'already_paid',
      errorMsg: null,
      actions: [...actions, 'skip:already_paid_claim_lost'],
      sendpulseSlugs,
    };
  }
  if (flipResult.kind === 'sub_missing') {
    return {
      prevStatus,
      skipped: true,
      skipReason: 'subscription_missing',
      errorMsg: `Subscription ${payment.yearlyProgramSubscriptionId} not found (tx rolled back, payment stays PENDING)`,
      actions,
      sendpulseSlugs,
    };
  }

  const sub = flipResult.sub;
  const user = payment.user;
  if (!user) {
    return {
      prevStatus,
      skipped: false,
      skipReason: null,
      errorMsg: 'User missing after payment flip',
      actions,
      sendpulseSlugs,
    };
  }
  actions.push('payment:paid');
  const planLabel =
    sub.plan === 'YEARLY'
      ? 'yearly'
      : sub.autoRenew
        ? 'monthly-autopay'
        : 'monthly-once';
  actions.push(`yearly:${planLabel}:+${flipResult.durationDays}d`);

  // На оплату Річної програми SendPulse-event НЕ викликається в загальному випадку — доступ
  // до платформи (логін/пароль) відкривається централізовано в момент масової розсилки на
  // запуск програми (`executeLaunchLoop`).
  // ВИНЯТОК: якщо cohort вже launched (студент платить ПІСЛЯ запуску), автоматично
  // викликаємо `runExtraLaunchForSubscription` — це відкриває SP-доступ + шле cohort launch
  // lett, без ручного "🎯 Екстра Запуск" кліку менеджера. Запасний ручний шлях все одно
  // лишається на випадок збою SP API під час оплати.
  // Інакше (звичайний flow до launch) — шлемо тільки наш generic welcome lett (без креденшилз).
  if (flipResult.wasFirstPayment) {
    // Auto-add у Telegram-канал перед розсилкою welcome / extra-launch листа.
    // Якщо settings.autoAdd=ON, є chatId, і користувач надав telegramUsername —
    // генеруємо одноразовий invite-link і вкладаємо в лист. Помилка генерації
    // не блокує лист (link просто не з'явиться, error логнеться у sub.telegramInviteError).
    let tgInviteLink: string | null = null;
    try {
      const tgSettings = await getYearlyProgramTelegramSettings();
      if (tgSettings.autoAdd && tgSettings.chatId && sub.telegramUsername) {
        const tgRes = await generateInviteForSubscription({
          subscriptionId: sub.id,
          triggeredBy: 'system:auto-add-on-payment',
          prefetched: {
            id: sub.id,
            telegramInviteLink: sub.telegramInviteLink ?? null,
            userEmail: user.email,
            userName: user.name,
          },
        });
        if (tgRes.ok) {
          tgInviteLink = tgRes.inviteLink;
          actions.push('telegram:invite_generated');
        } else {
          actions.push(`telegram:invite_err:${(tgRes.error ?? 'unknown').slice(0, 40)}`);
        }
      }
    } catch (e) {
      actions.push(`telegram:invite_err:${(e as Error).message.slice(0, 40)}`);
    }

    const cohortAlreadyLaunched = !!sub.cohort?.launchedAt;
    if (cohortAlreadyLaunched) {
      try {
        const { runExtraLaunchForSubscription } = await import('@/lib/yearlyProgramLaunch');
        const extraResult = await runExtraLaunchForSubscription(sub.id, 'system:auto-late-payer', {
          telegramInviteLink: tgInviteLink,
        });
        if (extraResult.ok) {
          actions.push('extra_launch:auto_triggered');
          if (extraResult.email.sent) actions.push('email:launch_sent');
          else if (extraResult.email.error) actions.push(`email:launch_err:${extraResult.email.error.slice(0, 40)}`);
        } else {
          actions.push(`extra_launch:auto_failed:${extraResult.reason ?? 'unknown'}`);
          // Fallback на звичайний welcome lett — щоб користувач хоча б щось отримав на оплату.
          await sendYearlyProgramWelcomeEmail({
            to: user.email,
            name: user.name ?? null,
            plan: sub.plan,
            autoRenew: sub.autoRenew,
            telegramInviteLink: tgInviteLink,
          }).then((r) => {
            if (r.ok) actions.push('email:welcome_sent_fallback');
          }).catch(() => { /* swallow */ });
        }
      } catch (e) {
        actions.push(`extra_launch:auto_err:${(e as Error).message.slice(0, 40)}`);
      }
    } else {
      try {
        const result = await sendYearlyProgramWelcomeEmail({
          to: user.email,
          name: user.name ?? null,
          plan: sub.plan,
          autoRenew: sub.autoRenew,
          telegramInviteLink: tgInviteLink,
        });
        if (result.skipped) {
          // Мейлер не налаштований (немає RESEND_API_KEY) — лист реально НЕ пішов.
          // Логуємо чесно, щоб подія не показувала оманливе «sent».
          actions.push('email:welcome_skipped_no_mailer');
          await prisma.yearlyProgramSubscriptionEvent.create({
            data: {
              subscriptionId: sub.id,
              type: 'admin_action',
              message: 'Welcome lett ПРОПУЩЕНО — мейлер не налаштований (RESEND_API_KEY відсутній на цьому середовищі)',
            },
          });
        } else if (result.ok) {
          actions.push('email:welcome_sent');
          await prisma.yearlyProgramSubscriptionEvent.create({
            data: {
              subscriptionId: sub.id,
              type: 'admin_action',
              message: 'Welcome lett sent (no credentials — credentials follow on launch)',
            },
          });
        } else {
          actions.push(`email:welcome_err:${(result.error ?? 'unknown').slice(0, 40)}`);
        }
      } catch (e) {
        actions.push(`email:welcome_err:${(e as Error).message.slice(0, 40)}`);
      }
    }
  } else {
    // Не перша оплата — перевіряємо чи в межах поточної покупки відбулась зміна autoRenew
    // (upgrade разова→автоплатіж або downgrade автоплатіж→разова). Маркер — наявність
    // `autorenew_upgraded` / `autorenew_downgraded` event-у, створеного після paidAt
    // попереднього PAID-платежу цієї підписки.
    try {
      const previousPayment = await prisma.payment.findFirst({
        where: {
          yearlyProgramSubscriptionId: sub.id,
          status: 'PAID',
          id: { not: payment.id },
        },
        orderBy: { paidAt: 'desc' },
        select: { paidAt: true, createdAt: true },
      });
      const previousAt = previousPayment?.paidAt ?? previousPayment?.createdAt ?? sub.startDate ?? null;
      if (previousAt) {
        const recentAutorenewEvent = await prisma.yearlyProgramSubscriptionEvent.findFirst({
          where: {
            subscriptionId: sub.id,
            type: { in: ['autorenew_upgraded', 'autorenew_downgraded'] },
            createdAt: { gt: previousAt },
          },
          orderBy: { createdAt: 'desc' },
          select: { type: true },
        });
        if (recentAutorenewEvent) {
          const direction: 'upgrade' | 'downgrade' = recentAutorenewEvent.type === 'autorenew_upgraded'
            ? 'upgrade'
            : 'downgrade';
          const result = await sendYearlyProgramPlanChangedEmail({
            to: user.email,
            name: user.name ?? null,
            direction,
            expiresAt: flipResult.newExpiresAt,
          });
          if (result.ok) {
            actions.push(`email:plan_changed_${direction}`);
            await prisma.yearlyProgramSubscriptionEvent.create({
              data: {
                subscriptionId: sub.id,
                type: 'admin_action',
                message: `Plan-changed lett sent (${direction})`,
              },
            });
          } else {
            actions.push(`email:plan_changed_err:${(result.error ?? 'unknown').slice(0, 40)}`);
          }
        } else if (sub.plan === 'MONTHLY') {
          // Receipt-лист: повторне MONTHLY-списання (autopay charge або ручна разова
          // продовження). Не для YEARLY (там тільки 1 платіж = welcome). Не для
          // плану-зміни (вище). Не для першої оплати (там welcome).
          let chargeProgress: { current: number; total: number } | null = null;
          if (sub.autoRenew && sub.cohort) {
            // Для autopay рахуємо порядковий номер списання у графіку cohort-у.
            const paidPayments = await prisma.payment.count({
              where: { yearlyProgramSubscriptionId: sub.id, status: 'PAID' },
            });
            const firstPaid = await prisma.payment.findFirst({
              where: { yearlyProgramSubscriptionId: sub.id, status: 'PAID' },
              orderBy: { paidAt: 'asc' },
              select: { paidAt: true, createdAt: true },
            });
            const firstPaymentDate = firstPaid?.paidAt ?? firstPaid?.createdAt ?? sub.startDate ?? null;
            if (firstPaymentDate) {
              const total = maxAutopayChargeCount({
                firstPaymentDate,
                cohortEndDate: sub.cohort.endDate,
              });
              chargeProgress = { current: paidPayments, total };
            }
          }
          const result = await sendYearlyProgramPaymentReceiptEmail({
            to: user.email,
            name: user.name ?? null,
            amount: payment.amount,
            autoRenew: sub.autoRenew,
            newExpiresAt: flipResult.newExpiresAt,
            chargeProgress,
          });
          if (result.ok) {
            actions.push('email:receipt_sent');
            await prisma.yearlyProgramSubscriptionEvent.create({
              data: {
                subscriptionId: sub.id,
                type: 'admin_action',
                message: `Payment receipt lett sent (${sub.autoRenew ? 'autopay' : 'one-time renewal'})`,
              },
            });
          } else {
            actions.push(`email:receipt_err:${(result.error ?? 'unknown').slice(0, 40)}`);
          }
        }
      }
    } catch (e) {
      actions.push(`email:plan_changed_err:${(e as Error).message.slice(0, 40)}`);
    }
  }

  actions.push('sendpulse:deferred_until_launch');

  return {
    prevStatus,
    skipped: false,
    skipReason: null,
    errorMsg: null,
    actions,
    sendpulseSlugs,
  };
}
