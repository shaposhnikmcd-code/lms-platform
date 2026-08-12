import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import type { YearlyProgramSubscriptionStatus } from '@prisma/client';
import prisma from '@/lib/prisma';
import { isYearlyProgramOrderRef, YEARLY_PROGRAM_CONFIG, getYearlyPostAccessMonths, getYearlySendpulseCourseId, RESET_REMINDER_AND_GRACE_FIELDS } from '@/lib/yearlyProgramConfig';
import { syncAutopaySchedule } from '@/lib/yearlyProgramScheduleSync';
import { sendYearlyProgramWelcomeEmail } from '@/lib/yearlyProgramWelcomeEmail';
import { closeAccessInCourse, lookupStudentIdByEmail } from '@/lib/sendpulse';
import {
  generateInviteForSubscription,
  getYearlyProgramTelegramSettings,
  kickSubscriptionFromChannel,
} from '@/lib/yearlyProgramTelegram';
import { sendYearlyProgramPlanChangedEmail } from '@/lib/yearlyProgramPlanChangedEmail';
import { sendYearlyProgramPaymentReceiptEmail } from '@/lib/yearlyProgramPaymentReceiptEmail';
import { timingSafeEqualStr } from '@/lib/authTiming';
import { getYearlyProgramSettings } from '@/lib/yearlyProgramSettings';
import { provisionPayment, AMOUNT_MISMATCH_MARKER } from '@/lib/paymentProvisioning';
import { sendBundlePurchaseEmail } from '@/lib/bundlePurchaseEmail';
import { getRegularStatus, getWayforpayCreds } from '@/lib/wayforpay';
import { calculateAccessUntil, maxAutopayChargeCount } from '@/lib/yearlyProgramAccess';
import { releasePromoUse } from '@/lib/promoUsage';
import { removeSubscriptionAutopay, recordAutopayRemoveOutcome } from '@/lib/yearlyProgramAutopay';
import { archiveDuplicatePendingSubscriptions } from '@/lib/yearlyProgramDedup';
import { CALLBACK_LOG_SUB_ACTION_PREFIX } from '@/lib/yearlyProgramIssues';
import { notifyManagers as notifyConnectorManagers, isNotificationDelivered as isConnectorNotificationDelivered } from '@/lib/connectorNotifications';

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || req.headers.get('cf-connecting-ip') || 'unknown';
}

type CallbackKind = 'course' | 'bundle' | 'connector' | 'yearly' | 'monthly' | 'unknown';

/// Статуси повернення коштів у WFP. `RefundInProcessing` — рефанд ініційований і вже
/// незворотний з нашого боку, тому обробляємо так само як завершений: краще зупинити
/// автосписання на день раніше, ніж зняти з людини ще один платіж після заявки.
const REFUND_STATUSES = new Set(['Refunded', 'Voided', 'RefundInProcessing']);

/// Сума з callback-у WFP приходить то числом, то рядком — нормалізуємо в гривні (int).
function parseCallbackAmount(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.round(raw);
  if (typeof raw === 'string' && raw.trim() !== '' && Number.isFinite(Number(raw))) return Math.round(Number(raw));
  return null;
}

/// Звірка суми, яку реально списав WFP, із сумою, яку ми виставили.
/// Розбіжність до 1 ₴ — округлення на боці WFP, ігноруємо. Більша — сигнал, що товар
/// і гроші розійшлись (підміна суми, ручна правка в кабінеті WFP, баг у нас): гроші
/// фіксуємо як PAID, але автоматичну видачу товару НЕ запускаємо.
/// Виняток — адмін/менеджер-тести за символічні 1-2 ₴: там очікувана сума саме така.
const AMOUNT_TOLERANCE_UAH = 1;
function checkAmountMismatch(expected: number | null | undefined, raw: unknown): { mismatch: boolean; callbackAmount: number | null } {
  const callbackAmount = parseCallbackAmount(raw);
  if (expected === null || expected === undefined) return { mismatch: false, callbackAmount };
  if (expected <= 2) return { mismatch: false, callbackAmount };
  if (callbackAmount === null) return { mismatch: false, callbackAmount };
  return { mismatch: Math.abs(callbackAmount - expected) > AMOUNT_TOLERANCE_UAH, callbackAmount };
}

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
          select: { paymentStatus: true, amount: true },
        });
        prevStatus = existing?.paymentStatus || null;

        // Замовлення з таким orderReference у базі немає ВЗАГАЛІ — а гроші списані.
        // Раніше цей кейс провалювався в `claim.count === 0` і маркувався як
        // `already_paid`: тобто «все гаразд, дубль callback-у». Recon-алерт таких не
        // бачив, і оплачена гра просто зникала. Тепер це окрема причина, яку
        // денний recon піднімає менеджерам нарівні з `payment_not_found`.
        if (!existing) {
          skipped = true;
          skipReason = 'order_not_found';
          errorMsg = `Connector order not found for ${orderReference} — оплату підтверджено, замовлення в базі немає`;
          actions.push(`skip:${skipReason}`);
          console.error('🚨 Конектор: Approved по неіснуючому замовленню:', orderReference);
        } else {

          // Звірка суми: скільки WFP реально списав проти суми замовлення.
          const amountCheck = checkAmountMismatch(existing.amount, body.amount);

          // Claim-then-act: атомарний flip, щоб два одночасних callback-и не задвоїли зміну
          // orderStatus/paidAt. count=0 ⇒ вже PAID/REFUNDED, skip. REFUNDED недоторканний:
          // запізнілий Approved після повернення коштів не має воскрешати замовлення.
          const claim = await prisma.connectorOrder.updateMany({
            where: { orderReference: orderReference!, paymentStatus: { notIn: ['PAID', 'REFUNDED'] } },
            data: {
              paymentStatus: 'PAID',
              paidAt: new Date(),
              orderStatus: 'NEW',
            },
          });
          if (claim.count === 0) {
            skipped = true;
            skipReason = prevStatus === 'REFUNDED' ? 'already_refunded' : 'already_paid';
            actions.push(`skip:${skipReason}`);
            console.log('ℹ️ Конектор уже завершений (claim lost), пропускаю:', orderReference, prevStatus);
          } else {
            // Гроші фіксуємо завжди. Якщо сума розійшлась — замовлення все одно PAID, але
            // і в нотифікації менеджерам, і в самому рядку замовлення (`managerNote`) має
            // стояти явне «не відправляти»: у списку замовлень видно суму З БД, а не
            // фактично списану, тож без помітки менеджер відправить гру собі у збиток.
            const mismatchWarning = amountCheck.mismatch
              ? `⚠️ РОЗБІЖНІСТЬ СУМИ: сплачено ${amountCheck.callbackAmount} ₴ із ${existing.amount} ₴ — НЕ відправляти замовлення до з'ясування`
              : null;

            if (mismatchWarning) {
              skipped = true;
              skipReason = 'amount_mismatch';
              errorMsg = `Amount mismatch: callback=${amountCheck.callbackAmount} ₴, order=${existing.amount} ₴ — позначено PAID, менеджерам надіслано попередження`;
              actions.push('connector:paid', `amount-mismatch:${amountCheck.callbackAmount}!=${existing.amount}`);
              console.error('🚨 Конектор: сума callback-у не збігається з замовленням:', orderReference, errorMsg);
              // Помітка в рядку замовлення. Наявний текст менеджера не затираємо —
              // дописуємо попередження на початок.
              try {
                const current = await prisma.connectorOrder.findUnique({
                  where: { orderReference: orderReference! },
                  select: { managerNote: true },
                });
                const prevNote = current?.managerNote?.trim();
                await prisma.connectorOrder.update({
                  where: { orderReference: orderReference! },
                  data: { managerNote: prevNote ? `${mismatchWarning}\n\n${prevNote}` : mismatchWarning },
                });
                actions.push('connector:manager_note_warned');
              } catch (e) {
                console.error('[wfp callback] connector managerNote update failed:', e);
              }
            } else {
              actions.push('connector:paid');
              console.log('✅ Конектор оплачено:', orderReference);
            }

            // Сповіщення менеджерам про успішну оплату (best-effort, не блокує WFP-ack).
            // При розбіжності суми лист/повідомлення йдуть із червоним попередженням.
            const paidOrder = await prisma.connectorOrder.findUnique({
              where: { orderReference: orderReference! },
            });
            if (paidOrder) {
              // `paidNotifiedAt` ставимо лише на реальну доставку: recon-cron добере
              // замовлення з NULL і надішле повторно, якщо і пошта, і Telegram лягли.
              //
              // AWAIT обов'язковий, попри «best-effort» природу нотифікації. Fire-and-forget
              // тут програвав гонку самому собі: serverless-інстанс міг завершитись одразу
              // після відповіді WFP, `paidNotifiedAt` не встигав записатись — і recon-cron
              // бачив «оплачено, менеджерам не сказано» та слав ДРУГЕ повідомлення про ту
              // саму гру. Помилки й далі не валять callback: усе в try/catch.
              try {
                const notifyResult = await notifyConnectorManagers('paid', paidOrder, { warning: mismatchWarning });
                if (isConnectorNotificationDelivered(notifyResult)) {
                  await prisma.connectorOrder.update({
                    where: { id: paidOrder.id },
                    data: { paidNotifiedAt: new Date() },
                  });
                  actions.push('connector:managers_notified');
                } else {
                  actions.push('connector:notify_undelivered');
                }
              } catch (e) {
                console.error('[wfp callback] connector notifyManagers failed:', e);
                actions.push('connector:notify_failed');
              }
            }
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

          // Звірка суми: WFP міг списати не те, що ми виставили (підміна суми на
          // платіжній сторінці, ручна правка в кабінеті WFP). Гроші фіксуємо, доступи —
          // ні: курс/пакет за меншу суму видавати не можна.
          const amountCheck = checkAmountMismatch(payment.amount, body.amount);

          // === ФАЗА A: атомарний claim flip ===
          // REFUNDED виключений нарівні з PAID: запізнілий Approved після повернення
          // коштів не має повертати платіж у PAID і заново видавати доступи.
          const claim = await prisma.payment.updateMany({
            where: { orderReference: orderReference!, status: { notIn: ['PAID', 'REFUNDED'] } },
            data: {
              status: 'PAID',
              paidAt: new Date(),
              paymentMethod: typeof body.paymentSystem === 'string' ? body.paymentSystem : undefined,
            },
          });

          if (claim.count === 0) {
            skipped = true;
            skipReason = prevStatus === 'REFUNDED' ? 'already_refunded' : 'already_paid';
            actions.push(`skip:${skipReason}`);
            console.log('ℹ️ Payment уже завершений (claim lost), пропускаю:', orderReference, prevStatus);
          } else if (amountCheck.mismatch) {
            // Платіж лишається PAID (гроші прийшли), але провіжининг не запускаємо —
            // менеджер розбирається вручну за логом.
            skipped = true;
            skipReason = 'amount_mismatch';
            errorMsg = `Amount mismatch: callback=${amountCheck.callbackAmount} ₴, payment=${payment.amount} ₴ — платіж позначено PAID, доступи НЕ видані`;
            actions.push('payment:updated', `amount-mismatch:${amountCheck.callbackAmount}!=${payment.amount}`);
            console.error('🚨 Сума callback-у не збігається з Payment:', orderReference, errorMsg);
            // Позначаємо платіж, щоб reconciliation-cron НЕ добрав його як «PAID без
            // провіжинінгу» і не видав курси в обхід цієї перевірки (він фільтрує саме
            // за цим префіксом). Знімає позначку менеджер після розбору.
            await prisma.payment.update({
              where: { id: payment.id },
              data: { provisionError: `${AMOUNT_MISMATCH_MARKER}: ${errorMsg}`.slice(0, 1000) },
            });
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
        // Дзеркально до guard-а курсів нижче: WFP присилає запізнілі Declined уже після
        // успішної оплати (ретрай першої спроби, дубль-callback). Без guard-а такий пакет
        // «розплачував» оплачене замовлення — менеджер бачив FAILED по грі, яку вже
        // відправив. REFUNDED теж недоторканний: слід «гроші приходили і повернулись»
        // не має перетворюватись на FAILED.
        const failFlip = await prisma.connectorOrder.updateMany({
          where: { orderReference: orderReference!, paymentStatus: { notIn: ['PAID', 'REFUNDED'] } },
          data: { paymentStatus: 'FAILED' },
        });
        if (failFlip.count > 0) {
          actions.push('connector:failed');
        } else {
          const existingOrder = await prisma.connectorOrder.findUnique({
            where: { orderReference: orderReference! },
            select: { paymentStatus: true },
          });
          const settled = existingOrder?.paymentStatus === 'PAID' || existingOrder?.paymentStatus === 'REFUNDED';
          prevStatus = existingOrder?.paymentStatus ?? null;
          skipped = true;
          skipReason = settled ? 'late_declined_after_paid' : 'order_not_found';
          errorMsg = settled
            ? `Late ${transactionStatus} for ${existingOrder!.paymentStatus} connector order ${orderReference} — статус не змінено`
            : `Connector order not found for ${orderReference}`;
          actions.push(`skip:${skipReason}`);
          if (settled) console.warn('⚠️ Запізнілий Declined по завершеному замовленню конектора:', orderReference);
        }
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
        // course / bundle / yearly (single-shot) — flip існуючого Payment у FAILED,
        // але НІКОЛИ поверх PAID. WFP присилає запізнілі Declined уже після успішної
        // оплати (ретрай першої спроби, дубль-callback) — без guard-а такий пакет
        // «розплачував» куплений курс: студент лишався з доступом, а платіж у звіті
        // ставав FAILED. Для Річної це ще й з'їдало місяць при перерахунку доступу.
        // REFUNDED теж недоторканний: повернений платіж не має ставати FAILED — інакше
        // втрачається слід «гроші приходили і повернулись» і ламається звітність.
        const failFlip = await prisma.payment.updateMany({
          where: { orderReference: orderReference!, status: { notIn: ['PAID', 'REFUNDED'] } },
          data: { status: 'FAILED' },
        });
        if (failFlip.count > 0) {
          actions.push('payment:failed');
          // Промокод, використання якого зайняв цей чекаут, повертаємо в ліміт: оплати
          // не сталося. Без цього кожна відмова/протермінований інвойс безповоротно
          // з'їдали одне використання — акція на 50 місць вигорала на невдалих спробах.
          // Ідемпотентно: `promoCodeId` одразу обнуляється, дубль-Declined уже не зайде.
          const failedPayment = await prisma.payment.findUnique({
            where: { orderReference: orderReference! },
            select: { id: true, promoCodeId: true },
          });
          if (failedPayment?.promoCodeId) {
            try {
              await releasePromoUse(failedPayment.promoCodeId);
              await prisma.payment.update({
                where: { id: failedPayment.id },
                data: { promoCodeId: null },
              });
              actions.push('promo:released');
            } catch (e) {
              console.error('[wfp callback] promo release failed:', orderReference, e);
            }
          }
        } else {
          const existingPay = await prisma.payment.findUnique({
            where: { orderReference: orderReference! },
            select: { status: true },
          });
          const settled = existingPay?.status === 'PAID' || existingPay?.status === 'REFUNDED';
          prevStatus = existingPay?.status ?? null;
          skipped = true;
          skipReason = settled ? 'late_declined_after_paid' : 'payment_not_found';
          errorMsg = settled
            ? `Late ${transactionStatus} for ${existingPay!.status} payment ${orderReference} — статус не змінено`
            : `Payment not found for ${orderReference}`;
          actions.push(`skip:${skipReason}`);
          if (settled) console.warn('⚠️ Запізнілий Declined по завершеному платежу:', orderReference);
        }
      }
      console.log('❌ Оплата відхилена для:', orderReference);
    } else if (REFUND_STATUSES.has(transactionStatus ?? '')) {
      // У рефанд-callback-у `amount` — це сума, яку WFP реально повернув. Вона може бути
      // меншою за суму платежу (частковий рефанд), тому передаємо її в хендлер, а не
      // припускаємо, що повернули все.
      const refundRaw = body.amount;
      const refundedAmount =
        typeof refundRaw === 'number' ? Math.round(refundRaw)
        : typeof refundRaw === 'string' && refundRaw.trim() !== '' && Number.isFinite(Number(refundRaw)) ? Math.round(Number(refundRaw))
        : null;
      const result = await handleRefundCallback({
        orderReference: orderReference!,
        kind,
        transactionStatus: transactionStatus!,
        refundedAmount,
      });
      prevStatus = result.prevStatus;
      skipped = result.skipped;
      skipReason = result.skipReason;
      errorMsg = result.errorMsg;
      actions.push(...result.actions);
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

/// Статуси, у яких підписка вже закрита: доступ по ній не продовжуємо автоматично,
/// але гроші, що прийшли, ОБОВʼЯЗКОВО фіксуємо (див. `recordOrphanRecurringCharge`).
const CLOSED_SUB_STATUSES = new Set(['EXPIRED', 'CANCELLED', 'ARCHIVED']);

interface ResolvedRecurring {
  sub: { id: string; userId: string; status: string; plan: string } | null;
  /// Користувач, знайдений за email із платіжної сторінки (або власник підписки).
  /// Потрібен щоб відрізнити `user_not_found` від `subscription_not_found`.
  user: { id: string; email: string } | null;
  via: 'parent_order' | 'email' | null;
}

/// Пошук підписки для рекурентного (WFP-ініційованого) callback-а.
///
/// Порядок навмисний:
/// 1. **Parent orderReference.** WFP формує child-ref автосписання як `<батьківський>_WFPREG-<n>`.
///    Це єдиний 100% надійний звʼязок: він не залежить від того, який email людина ввела
///    на платіжній сторінці WFP (інша адреса / інший регістр / share-cart).
/// 2. **Email** — fallback для історичних/нестандартних ref-ів. Case-insensitive: WFP віддає
///    email так, як його набрали, і `Ivan@x.ua` не мав знаходити акаунт `ivan@x.ua`.
///
/// Закриті підписки (EXPIRED/CANCELLED) теж повертаються — рішення, що з ними робити,
/// приймає викликач. Мовчазний `subscription_not_found` на списаних грошах неприпустимий.
async function resolveRecurringSubscription(args: {
  orderReference: string;
  clientEmail: string | null;
}): Promise<ResolvedRecurring> {
  const subSelect = {
    id: true,
    userId: true,
    status: true,
    plan: true,
    user: { select: { id: true, email: true } },
  } as const;

  const wfpregAt = args.orderReference.indexOf('_WFPREG');
  if (wfpregAt > 0) {
    const parentRef = args.orderReference.slice(0, wfpregAt);
    const parent = await prisma.payment.findUnique({
      where: { orderReference: parentRef },
      select: { yearlyProgramSubscriptionId: true },
    });
    if (parent?.yearlyProgramSubscriptionId) {
      const sub = await prisma.yearlyProgramSubscription.findUnique({
        where: { id: parent.yearlyProgramSubscriptionId },
        select: subSelect,
      });
      if (sub) {
        return {
          sub: { id: sub.id, userId: sub.userId, status: sub.status, plan: sub.plan },
          user: sub.user,
          via: 'parent_order',
        };
      }
    }
  }

  const email = args.clientEmail?.trim().toLowerCase();
  if (!email) return { sub: null, user: null, via: null };

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, email: true },
  });
  if (!user) return { sub: null, user: null, via: null };

  // Пріоритет строгий, а не «найновіша з усіх»: жива → недооплачена → закрита.
  // Без тирів свіжа абандонована PENDING-спроба перебивала б ACTIVE-підписку
  // (orderBy createdAt desc), і місячне списання пішло б не на ту підписку.
  //   ACTIVE/GRACE — нормальний рекурент.
  //   PENDING — незавершений чекаут (WFP уже має правило регулярки → списання належить
  //             саме цій підписці, доступ по ній ще не відкривався).
  //   EXPIRED/CANCELLED/ARCHIVED — закрита: платіж фіксуємо як orphan (див. викликач).
  const STATUS_TIERS: YearlyProgramSubscriptionStatus[][] = [
    ['ACTIVE', 'GRACE'],
    ['PENDING'],
    ['EXPIRED', 'CANCELLED', 'ARCHIVED'],
  ];
  let found:
    | { id: string; userId: string; status: string; plan: string; user: { id: string; email: string } | null }
    | null = null;
  for (const tier of STATUS_TIERS) {
    found = await prisma.yearlyProgramSubscription.findFirst({
      where: { userId: user.id, plan: 'MONTHLY', status: { in: tier } },
      orderBy: { createdAt: 'desc' },
      select: subSelect,
    });
    if (found) break;
  }

  if (!found) return { sub: null, user, via: null };
  return {
    sub: { id: found.id, userId: found.userId, status: found.status, plan: found.plan },
    user,
    via: 'email',
  };
}

/// Мітка `sub:<id>` в `actionsTaken` — за нею `lib/yearlyProgramIssues.ts` привʼязує
/// пропущений callback-лог до підписки (без окремої колонки в PaymentCallbackLog).
function subRefAction(subscriptionId: string): string {
  return `${CALLBACK_LOG_SUB_ACTION_PREFIX}${subscriptionId}`;
}

/// Подія «callback пропущено» в підписці — щоб причина була видна прямо у вкладці
/// «Події» конкретного студента, а не лише в загальних логах платежів.
/// Best-effort: помилка запису не має ламати відповідь WFP.
async function logCallbackSkipEvent(args: {
  subscriptionId: string;
  orderReference: string;
  skipReason: string;
  message: string;
  amount: number;
}): Promise<void> {
  try {
    await prisma.yearlyProgramSubscriptionEvent.create({
      data: {
        subscriptionId: args.subscriptionId,
        type: 'callback_skipped',
        message: `Callback пропущено (${args.skipReason}) · ${args.message}`,
        metadata: {
          orderReference: args.orderReference,
          skipReason: args.skipReason,
          amount: args.amount,
        },
      },
    });
  } catch (e) {
    console.error('⚠️ Не вдалося записати callback_skipped event:', args.orderReference, e);
  }
}

/// Рекурентне списання прийшло на вже закриту підписку (WFP не встиг зняти правило,
/// або підписку скасували між списаннями). Гроші реально списані — фіксуємо Payment
/// із лінком на підписку і піднімаємо critical-issue. Статус підписки НЕ чіпаємо:
/// повернути кошти чи поновити доступ — рішення менеджера.
///
/// `skipReason` пояснює, ЧОМУ платіж пішов орфанним шляхом, і формує текст події.
/// Спільний принцип для всіх причин: гроші вже списані реально, тому Payment мусить
/// бути в БД — «відкотити транзакцію і нічого не записати» означало б, що списання
/// зникло з обліку назавжди (WFP цей callback більше не повторить).
async function recordOrphanRecurringCharge(args: {
  subscriptionId: string;
  userId: string;
  subscriptionStatus: string;
  orderReference: string;
  amountInt: number;
  paymentSystem: string | undefined;
  /// Причина: 'closed_subscription' (дефолт), 'subscription_closed_race',
  /// 'plan_not_monthly', 'amount_mismatch', 'monthly_cap_reached'.
  skipReason?: string;
  /// Технічна деталь для журналу (текст помилки з перевірки).
  detail?: string;
}): Promise<string[]> {
  const actions: string[] = [];
  const skipReason = args.skipReason ?? 'closed_subscription';
  const reasonText: Record<string, string> = {
    plan_not_monthly: `Автосписання ${args.amountInt} грн надійшло на підписку, переведену на Річний план (регулярка у WayForPay лишилась живою). Платіж записано, доступ НЕ продовжено — потрібне рішення: повернути кошти або зарахувати доплату. Обов'язково зніміть правило автосписання у WFP.`,
    amount_mismatch: `Автосписання ${args.amountInt} грн не збіглося з очікуваною сумою підписки. Платіж записано (гроші реально списані), доступ НЕ продовжено — потрібне рішення менеджера.`,
    monthly_cap_reached: `Автосписання ${args.amountInt} грн надійшло понад ліміт місячних платежів програми. Платіж записано, доступ НЕ продовжено — ймовірно, правило регулярки у WayForPay не було знято після повної оплати.`,
  };
  const message = reasonText[skipReason]
    ?? `Автосписання ${args.amountInt} грн надійшло на підписку у статусі ${args.subscriptionStatus}. Платіж записано, доступ НЕ продовжено — потрібне рішення: повернути кошти або поновити підписку.`;
  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.payment.findUnique({
        where: { orderReference: args.orderReference },
        select: { id: true },
      });
      if (existing) {
        actions.push('yearly:orphan_charge_already_recorded');
        return;
      }
      await tx.payment.create({
        data: {
          userId: args.userId,
          courseId: null,
          bundleId: null,
          orderReference: args.orderReference,
          amount: args.amountInt || 0,
          status: 'PAID',
          paidAt: new Date(),
          paymentMethod: args.paymentSystem,
          yearlyProgramSubscriptionId: args.subscriptionId,
          // Ключове: платіж є слідом реального списання, але в доступ НЕ йде. Без цієї
          // позначки `calculateAccessUntil` рахував його звичайним оплаченим місяцем —
          // і будь-який наступний перерахунок (cron-звірка, зміна дат набору, ручна дія
          // менеджера) мовчки продовжував доступ, від якого ми щойно відмовились.
          excludedFromAccess: true,
        },
      });
      await tx.yearlyProgramSubscriptionEvent.create({
        data: {
          subscriptionId: args.subscriptionId,
          type: 'orphan_recurring_charge',
          message,
          metadata: {
            orderReference: args.orderReference,
            amount: args.amountInt,
            subscriptionStatus: args.subscriptionStatus,
            skipReason,
            ...(args.detail ? { detail: args.detail.slice(0, 300) } : {}),
          },
        },
      });
      actions.push('yearly:orphan_charge_recorded');
    }, { isolationLevel: 'Serializable' });
  } catch (e) {
    // UNIQUE на orderReference: паралельний колбек уже записав цей платіж — idempotent.
    console.error('⚠️ orphan recurring charge write conflict:', args.orderReference, e);
    actions.push('yearly:orphan_charge_race');
  }
  return actions;
}

/// Закриття доступу після повного рефанду останнього платежу Річної: SendPulse + Telegram.
/// Дзеркалить крок `expire` денного cron-а, але з однією відмінністю: cron при помилці SP
/// НЕ ставить EXPIRED і пробує завтра, а тут відкладати нікуди — гроші вже повернені, і
/// підписка не має лишатись живою. Тому статус ставимо в будь-якому разі, а невдале
/// закриття фіксуємо подією `access_close_failed`.
/// Обидва кроки best-effort: помилка не валить callback (WFP має отримати accept).
async function closeAccessAfterFullRefund(args: {
  subscriptionId: string;
  userEmail: string | null;
  sendpulseStudentId: number | null;
}): Promise<{
  actions: string[];
  spOutcome: 'closed' | 'not_found' | 'error';
  spError: string | null;
  tgOutcome: 'kicked' | 'skipped' | 'error';
}> {
  const actions: string[] = [];
  let tgOutcome: 'kicked' | 'skipped' | 'error' = 'error';
  /// `closed` — доступ реально закрито (тільки в цьому випадку є сенс у
  /// `sendpulseAccessClosedAt`); `not_found` — студента в курсі немає, закривати нічого;
  /// `error` — SP не відповів, доступ міг лишитись відкритим.
  let spOutcome: 'closed' | 'not_found' | 'error' = 'error';
  let spError: string | null = null;

  try {
    const courseId = await getYearlySendpulseCourseId(prisma);
    let studentId = args.sendpulseStudentId;
    if (courseId && !studentId && args.userEmail) {
      studentId = await lookupStudentIdByEmail(courseId, args.userEmail);
      if (studentId) {
        await prisma.yearlyProgramSubscription.update({
          where: { id: args.subscriptionId },
          data: { sendpulseStudentId: studentId },
        });
      }
    }
    if (!courseId) {
      spError = 'SENDPULSE_YEARLY_COURSE_ID не налаштовано';
    } else if (!studentId) {
      // Студента в курсі немає — закривати нічого. Це не помилка, але й дату закриття
      // ставити нема за що: доступ ніхто не відкривав.
      spOutcome = 'not_found';
    } else {
      await closeAccessInCourse(studentId, courseId);
      spOutcome = 'closed';
    }
  } catch (e) {
    spError = (e as Error).message.slice(0, 300);
  }
  actions.push(
    spOutcome === 'closed' ? 'sp:access_closed'
    : spOutcome === 'not_found' ? 'sp:close_skipped:student_not_found'
    : `sp:close_err:${(spError ?? 'unknown').slice(0, 40)}`,
  );

  try {
    const kick = await kickSubscriptionFromChannel({
      subscriptionId: args.subscriptionId,
      mode: 'permanent',
      triggeredBy: 'system:full-refund',
    });
    // `skipped` — це не збій: канал не налаштований або людина ніколи в ньому не була.
    // Такі випадки не мають виглядати як помилка в логах callback-а.
    tgOutcome = kick.skipped ? 'skipped' : kick.ok ? 'kicked' : 'error';
    actions.push(
      kick.skipped ? `telegram:kick_skipped:${kick.skipped}`
      : kick.ok ? 'telegram:kicked'
      : `telegram:kick_err:${(kick.error ?? 'unknown').slice(0, 40)}`,
    );
  } catch (e) {
    actions.push(`telegram:kick_err:${(e as Error).message.slice(0, 40)}`);
  }

  return { actions, spOutcome, spError, tgOutcome };
}

/// Обробка повернення коштів (Refunded / Voided / RefundInProcessing).
///
/// Обробляємо ТІЛЬКИ платіж у статусі PAID. Voided по PENDING/FAILED — це «скасовано
/// неоплачену спробу», а не повернення грошей: якщо на ньому спрацювати, ми б знімали
/// живу регулярку і псували цілком здорову підписку.
///
/// Що робимо для повного рефанду:
///   — Payment → REFUNDED (claim-then-act, ідемпотентно);
///   — для платежу Річної: знімаємо ВСІ WFP-регулярки підписки і перераховуємо expiresAt.
///     REFUNDED випадає з PAID-набору, тому `calculateAccessUntil` сам скорочує доступ
///     на повернений місяць — окремої арифметики не треба;
///   — якщо PAID-платежів не лишилось ЖОДНОГО: підписка → EXPIRED з `expiresAt = now`,
///     плюс закриття SendPulse і кік із Telegram. Без цього `calculateAccessUntil` віддає
///     null, підписка з null-датою випадає з усіх cron-фільтрів (`expiresAt < now`) і живе
///     вічно: доступ відкритий, а купити заново людина не може (Rule 1 у /api/wayforpay);
///   — подія в підписку з фактично поверненою сумою і новою датою.
///
/// Частковий рефанд (повернено менше, ніж сума платежу) автоматично НЕ обробляємо:
/// скільки доступу лишити — рішення менеджера. Пишемо подію і лишаємо платіж PAID.
///
/// Чого свідомо НЕ робимо: не чіпаємо Enrollment звичайних курсів/пакетів. Відкликання
/// доступу до курсу — рішення людини, а не автоматичний наслідок рефанду (буває
/// частковий рефанд, компенсація, помилковий платіж). Слід лишається в логу і у статусі
/// платежу. ConnectorOrder теж не чіпаємо — там свій ручний флоу в адмінці.
async function handleRefundCallback(args: {
  orderReference: string;
  kind: CallbackKind;
  transactionStatus: string;
  /// Сума з callback-а WFP — для рефанду це те, скільки реально повернули.
  /// null — у пакеті суми не було (тоді вважаємо рефанд повним).
  refundedAmount: number | null;
}): Promise<{
  prevStatus: string | null;
  skipped: boolean;
  skipReason: string | null;
  errorMsg: string | null;
  actions: string[];
}> {
  const actions: string[] = [];

  // Конектор живе в окремій таблиці ConnectorOrder зі своїм ручним флоу в адмінці —
  // автоматом статус не перебиваємо, лишаємо слід у логу callback-ів.
  if (args.kind === 'connector') {
    return {
      prevStatus: null,
      skipped: true,
      skipReason: 'refund_connector_manual',
      errorMsg: `Refund (${args.transactionStatus}) для конектора ${args.orderReference} — обробити вручну в адмінці`,
      actions: [...actions, 'skip:refund_connector_manual'],
    };
  }

  const payment = await prisma.payment.findUnique({
    where: { orderReference: args.orderReference },
    select: { id: true, status: true, amount: true, yearlyProgramSubscriptionId: true },
  });
  if (!payment) {
    return {
      prevStatus: null,
      skipped: true,
      skipReason: 'refund_payment_not_found',
      errorMsg: `Refund (${args.transactionStatus}) for unknown payment ${args.orderReference}`,
      actions,
    };
  }
  if (payment.status === 'REFUNDED') {
    return { prevStatus: 'REFUNDED', skipped: true, skipReason: 'already_refunded', errorMsg: null, actions: ['skip:already_refunded'] };
  }
  // Повертати можна лише те, що було оплачене. Voided/Refunded по PENDING чи FAILED —
  // це закриття неоплаченої спроби: нічого не флипаємо і НЕ чіпаємо регулярку.
  if (payment.status !== 'PAID') {
    return {
      prevStatus: payment.status,
      skipped: true,
      skipReason: 'refund_on_unpaid',
      errorMsg: `${args.transactionStatus} for ${payment.status} payment ${args.orderReference} — нічого не змінено`,
      actions: [...actions, 'skip:refund_on_unpaid'],
    };
  }

  const sub = payment.yearlyProgramSubscriptionId
    ? await prisma.yearlyProgramSubscription.findUnique({
        where: { id: payment.yearlyProgramSubscriptionId },
        include: {
          cohort: { select: { startDate: true, endDate: true } },
          user: { select: { email: true } },
        },
      })
    : null;

  // Частковий рефанд: суму платежу не «згорає» цілком, тож автоматично зменшити доступ
  // ми не можемо — скільки місяців лишити, вирішує менеджер. Толеранс 1 ₴ на округлення.
  const isPartial =
    args.refundedAmount !== null
    && args.refundedAmount > 0
    && args.refundedAmount < payment.amount - 1;
  if (isPartial) {
    if (sub) {
      await prisma.yearlyProgramSubscriptionEvent.create({
        data: {
          subscriptionId: sub.id,
          type: 'admin_action',
          message: `⚠️ Частковий рефанд ${args.refundedAmount}₴ з ${payment.amount}₴ (WFP ${args.transactionStatus}, ${args.orderReference}) — платіж лишено PAID, доступ не змінено. Потрібне ручне рішення: скоригувати дати або оформити повний рефанд.`,
          metadata: {
            orderReference: args.orderReference,
            transactionStatus: args.transactionStatus,
            refundedAmount: args.refundedAmount,
            paymentAmount: payment.amount,
            partialRefund: true,
          },
        },
      });
    }
    return {
      prevStatus: payment.status,
      skipped: true,
      skipReason: 'partial_refund_manual',
      errorMsg: `Partial refund ${args.refundedAmount} of ${payment.amount} for ${args.orderReference} — потребує ручного рішення`,
      actions: [...actions, 'skip:partial_refund_manual'],
    };
  }

  const refundedAmount = args.refundedAmount && args.refundedAmount > 0 ? args.refundedAmount : payment.amount;

  // Регулярку знімаємо ДО flip-а статусу: `removeSubscriptionAutopay` ітерує PAID-платежі,
  // а правило у WFP прив'язане саме до orderReference одного з них — можливо цього.
  let autopayRemoved = 0;
  if (sub && sub.plan === 'MONTHLY') {
    try {
      const res = await removeSubscriptionAutopay(sub.id);
      autopayRemoved = res.removed;
      actions.push(`autopay:removed(${res.removed}/${res.attempted})`);
      if (res.error) actions.push(`autopay:err:${res.error.slice(0, 40)}`);
      // Окрема подія на провал REMOVE — інакше після рефанду жива регулярка у WFP
      // продовжила б списувати гроші, а в адмінці це виглядало б як штатне повернення.
      await recordAutopayRemoveOutcome({
        subscriptionId: sub.id,
        result: res,
        source: `wfp-callback:${args.orderReference} · refund`,
      });
    } catch (e) {
      actions.push(`autopay:err:${(e as Error).message.slice(0, 40)}`);
    }
  }

  const claim = await prisma.payment.updateMany({
    where: { id: payment.id, status: 'PAID' },
    data: { status: 'REFUNDED' },
  });
  if (claim.count === 0) {
    return { prevStatus: payment.status, skipped: true, skipReason: 'already_refunded', errorMsg: null, actions: [...actions, 'skip:already_refunded_claim_lost'] };
  }
  actions.push('payment:refunded');

  if (sub) {
    const postAccessMonths = await getYearlyPostAccessMonths(prisma);
    const remaining = await prisma.payment.findMany({
      where: { yearlyProgramSubscriptionId: sub.id, status: 'PAID' },
      select: { amount: true, status: true, paidAt: true, createdAt: true, excludedFromAccess: true },
    });
    const now = new Date();
    const nothingLeftPaid = remaining.length === 0;
    const recalculated = calculateAccessUntil({
      plan: sub.plan,
      autoRenew: false,
      cohort: sub.cohort ? { startDate: sub.cohort.startDate, endDate: sub.cohort.endDate } : null,
      payments: remaining,
      postAccessMonths,
    });
    // Без жодного PAID підписка не має на що спиратись: `calculateAccessUntil` віддає null,
    // а null-дата робить підписку невидимою для cron-ів. Закриваємо явно.
    const newExpiresAt = nothingLeftPaid ? now : recalculated;

    let closeResult: Awaited<ReturnType<typeof closeAccessAfterFullRefund>> | null = null;
    if (nothingLeftPaid) {
      closeResult = await closeAccessAfterFullRefund({
        subscriptionId: sub.id,
        userEmail: sub.user?.email ?? null,
        sendpulseStudentId: sub.sendpulseStudentId,
      });
      actions.push(...closeResult.actions);
    }

    await prisma.yearlyProgramSubscription.update({
      where: { id: sub.id },
      data: {
        expiresAt: newExpiresAt,
        // Прапорець має відповідати реальності: правил у WFP більше немає.
        ...(sub.plan === 'MONTHLY' ? { autoRenew: false } : {}),
        ...(nothingLeftPaid
          ? {
              status: 'EXPIRED' as const,
              // Дата закриття — тільки якщо доступ РЕАЛЬНО закрили. «Студента в курсі
              // немає» це не закриття: поле лишається порожнім, як і було.
              ...(closeResult?.spOutcome === 'closed' ? { sendpulseAccessClosedAt: now } : {}),
            }
          : {}),
      },
    });

    if (nothingLeftPaid && closeResult?.spOutcome === 'error') {
      await prisma.yearlyProgramSubscriptionEvent.create({
        data: {
          subscriptionId: sub.id,
          type: 'access_close_failed',
          message: `SendPulse: не вдалося закрити доступ після повного рефанду — ${closeResult.spError ?? 'невідома помилка'}. Підписка все одно EXPIRED, закрити доступ треба вручну.`,
          metadata: { orderReference: args.orderReference, spError: closeResult.spError },
        },
      });
      actions.push('sp:close_failed_logged');
    }
    if (nothingLeftPaid && closeResult?.spOutcome === 'not_found') {
      await prisma.yearlyProgramSubscriptionEvent.create({
        data: {
          subscriptionId: sub.id,
          type: 'admin_action',
          message: 'SendPulse: студента в курсі не знайдено — закривати доступ не було чого (повний рефанд).',
          metadata: { orderReference: args.orderReference, spSkipped: 'student_not_found' },
        },
      });
    }

    await prisma.yearlyProgramSubscriptionEvent.create({
      data: {
        subscriptionId: sub.id,
        type: 'refunded',
        message: `Повернення ${refundedAmount}₴ з ${payment.amount}₴ (WFP ${args.transactionStatus}) · оплачених платежів лишилось ${remaining.length} · ${
          nothingLeftPaid
            ? `оплат не лишилось → підписку закрито (EXPIRED), доступ у SendPulse ${
                closeResult?.spOutcome === 'closed' ? 'закрито'
                : closeResult?.spOutcome === 'not_found' ? 'закривати не було чого (студента в курсі немає)'
                : 'ЗАКРИТИ ВРУЧНУ'
              }, Telegram: ${
                closeResult?.tgOutcome === 'kicked' ? 'вилучено з каналу'
                : closeResult?.tgOutcome === 'skipped' ? 'вилучати не було кого'
                : 'ВИЛУЧИТИ ВРУЧНУ'
              }`
            : `доступ до ${newExpiresAt ? newExpiresAt.toISOString().slice(0, 10) : '—'}`
        }${sub.plan === 'MONTHLY' ? ` · автосписання знято (${autopayRemoved})` : ''}`,
        metadata: {
          orderReference: args.orderReference,
          transactionStatus: args.transactionStatus,
          refundedAmount,
          paymentAmount: payment.amount,
          paidPaymentsLeft: remaining.length,
          expiresAt: newExpiresAt?.toISOString() ?? null,
          autopayRemoved,
          subscriptionClosed: nothingLeftPaid,
        },
      },
    });
    actions.push(
      nothingLeftPaid
        ? 'yearly:refund_closed_subscription'
        : `yearly:refund_recalc:${newExpiresAt ? newExpiresAt.toISOString().slice(0, 10) : 'null'}`,
    );
  }

  console.log('💸 Повернення коштів:', args.orderReference, args.transactionStatus);
  return { prevStatus: payment.status, skipped: false, skipReason: null, errorMsg: null, actions };
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
    // Запізнілий Declined по вже оплаченому (чи поверненому) платежу НЕ чіпаємо: WFP шле
    // такі пакети після успішної оплати (ретрай першої спроби), а flip PAID→FAILED
    // викидав платіж з розрахунку доступу — студент миттєво втрачав оплачений місяць.
    // Лічильник невдалих списань теж не рухаємо: списання відбулось, а не провалилось.
    if (existing.status !== 'PENDING' && existing.status !== 'FAILED') {
      return {
        skipped: true,
        skipReason: 'late_declined_after_paid',
        errorMsg: `Late ${args.transactionStatus} for ${existing.status} payment ${args.orderReference} — статус не змінено`,
        actions: [...actions, 'skip:late_declined_after_paid'],
      };
    }
    // Idempotent claim: у FAILED переводимо тільки з PENDING, і рівно один раз.
    // count важливий — від нього залежить, чи рухати лічильник невдалих списань.
    const failFlip = await prisma.payment.updateMany({
      where: { id: existing.id, status: 'PENDING' },
      data: { status: 'FAILED' },
    });
    const flipped = failFlip.count > 0;
    if (flipped) {
      actions.push('payment:failed');
    } else {
      actions.push('skip:already_failed');
    }
    // Дубль-Declined по вже FAILED-платежу не має накручувати failedChargeCount:
    // на ньому зав'язані grace-листи і рішення cron-а, а WFP шле такі пакети повторно.
    if (existing.yearlyProgramSubscriptionId && flipped) {
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
  // Шукаємо sub тим самим резолвером, що й Approved-гілка: спершу по батьківському
  // orderReference (`_WFPREG`), потім по email case-insensitive.
  const resolved = await resolveRecurringSubscription({
    orderReference: args.orderReference,
    clientEmail,
  });
  if (!resolved.sub) {
    return {
      skipped: true,
      skipReason: resolved.user ? 'cyclical_failed_no_sub' : 'cyclical_failed_user_not_found',
      errorMsg: resolved.user
        ? `Failed cyclical for ${args.orderReference}: no MONTHLY sub for ${resolved.user.email}`
        : `Failed cyclical for ${args.orderReference}: no user with email ${clientEmail ?? '—'}`,
      actions,
    };
  }
  const targetSub = resolved.sub;
  actions.push(subRefAction(targetSub.id));

  // Невдале списання по вже закритій підписці — грошей не рухалось, ескалювати нічого.
  // Пишемо лише подію для аудиту, лічильник фейлів не чіпаємо (підписка вже не жива).
  if (CLOSED_SUB_STATUSES.has(targetSub.status)) {
    await logCallbackSkipEvent({
      subscriptionId: targetSub.id,
      orderReference: args.orderReference,
      skipReason: 'cyclical_failed_sub_closed',
      message: `${reasonStr} · статус підписки ${targetSub.status}`,
      amount: amountInt,
    });
    return {
      skipped: true,
      skipReason: 'cyclical_failed_sub_closed',
      errorMsg: null,
      actions,
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Створюємо Payment FAILED лінкований до sub (на майбутні аудити і admin UI).
      await tx.payment.create({
        data: {
          userId: targetSub.userId,
          courseId: null,
          bundleId: null,
          orderReference: args.orderReference,
          amount: amountInt || 0,
          status: 'FAILED',
          yearlyProgramSubscriptionId: targetSub.id,
        },
      });
      await tx.yearlyProgramSubscription.update({
        where: { id: targetSub.id },
        data: {
          failedChargeCount: { increment: 1 },
          lastChargeAttemptAt: new Date(),
          lastChargeError: reasonStr,
        },
      });
      await tx.yearlyProgramSubscriptionEvent.create({
        data: {
          subscriptionId: targetSub.id,
          type: 'charge_failed',
          message: `Cyclical FAILED · ${reasonStr}`,
          metadata: { orderReference: args.orderReference, transactionStatus: args.transactionStatus, reason: args.body.reason ?? null, source: 'cyclical' },
        },
      });
    }, { isolationLevel: 'Serializable' });
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
/// — Наступний регулярний (WFP автосписання): Payment не знайдений, резолвимо підписку через
///   `resolveRecurringSubscription` (батьківський orderReference → email case-insensitive)
///   → створюємо новий Payment, продовжуємо expiresAt. Якщо підписка вже закрита —
///   платіж усе одно фіксуємо (orphan charge), але доступ не продовжуємо.
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
    //    Резолвимо підписку (parent orderReference → email), потім атомарно створюємо
    //    Payment у Serializable tx (щоб два одночасних recurring-колбеки з різними
    //    orderRef не подвоїли списання).
    if (args.kind !== 'monthly') {
      return {
        prevStatus: null,
        skipped: true,
        skipReason: 'payment_not_found',
        errorMsg: `Payment not found for ${args.orderReference}`,
        actions,
        sendpulseSlugs,
      };
    }

    const resolved = await resolveRecurringSubscription({
      orderReference: args.orderReference,
      clientEmail,
    });

    if (!resolved.sub) {
      // Гроші списані, а прив'язати нема до чого. Мовчазним цей кейс не лишається:
      // skipReason потрапляє в PaymentCallbackLog, звідки його піднімає детектор
      // RECURRING_CALLBACK_SKIPPED у вкладку «Помилки» адмінки.
      return {
        prevStatus: null,
        skipped: true,
        skipReason: resolved.user ? 'subscription_not_found' : 'user_not_found',
        errorMsg: resolved.user
          ? `No MONTHLY subscription for ${resolved.user.email} (order ${args.orderReference})`
          : `User not found for email ${clientEmail ?? '—'} (order ${args.orderReference})`,
        actions,
        sendpulseSlugs,
      };
    }

    const targetSub = resolved.sub;
    actions.push(subRefAction(targetSub.id));
    actions.push(`yearly:resolved_via_${resolved.via}`);

    // Підписка вже закрита (EXPIRED/CANCELLED/ARCHIVED), але WFP усе одно списав.
    // Платіж фіксуємо з лінком на підписку + critical-issue; статус НЕ міняємо.
    if (CLOSED_SUB_STATUSES.has(targetSub.status)) {
      const orphanActions = await recordOrphanRecurringCharge({
        subscriptionId: targetSub.id,
        userId: targetSub.userId,
        subscriptionStatus: targetSub.status,
        orderReference: args.orderReference,
        amountInt,
        paymentSystem: typeof args.body.paymentSystem === 'string' ? args.body.paymentSystem : undefined,
      });
      actions.push(...orphanActions);
      return {
        prevStatus: null,
        skipped: true,
        skipReason: 'orphan_recurring_charge',
        errorMsg: `Recurring charge ${amountInt} on ${targetSub.status} subscription ${targetSub.id} (order ${args.orderReference})`,
        actions,
        sendpulseSlugs,
      };
    }

    // Підписку перевели на Річний план («⬆️ Перевести на Річну»), а регулярка у WFP
    // усе одно спрацювала. Звичайним `renewed`-платежем це бути не може: місячних слотів
    // на YEARLY-плані немає, і зарахування мовчки подовжило б доступ за зайві гроші.
    // Фіксуємо як orphan + critical-issue, щоб у «Помилках» було видно «списання по
    // переведеній підписці» і менеджер зняв правило/повернув кошти.
    if (targetSub.plan !== 'MONTHLY') {
      const orphanActions = await recordOrphanRecurringCharge({
        subscriptionId: targetSub.id,
        userId: targetSub.userId,
        subscriptionStatus: targetSub.status,
        orderReference: args.orderReference,
        amountInt,
        paymentSystem: typeof args.body.paymentSystem === 'string' ? args.body.paymentSystem : undefined,
        skipReason: 'plan_not_monthly',
        detail: `plan=${targetSub.plan}`,
      });
      actions.push(...orphanActions);
      return {
        prevStatus: null,
        skipped: true,
        skipReason: 'orphan_recurring_charge',
        errorMsg: `Recurring charge ${amountInt} on ${targetSub.plan} subscription ${targetSub.id} (order ${args.orderReference})`,
        actions,
        sendpulseSlugs,
      };
    }

    // Для recurring callback довіряємо merchantSignature (вже валідовано вище).
    // Захист від двох одночасних recurring-колбеків — Serializable transaction
    // + UNIQUE constraint на Payment.orderReference.
    type RecurringCreateResult =
      | { kind: 'ok'; payment: NonNullable<typeof existingPayment> }
      | { kind: 'error'; skipReason: string; errorMsg: string };

    let createResult: RecurringCreateResult;
    try {
      createResult = await prisma.$transaction(async (tx) => {
        const sub = await tx.yearlyProgramSubscription.findUnique({
          where: { id: targetSub.id },
        });
        if (!sub) {
          return {
            kind: 'error',
            skipReason: 'subscription_not_found',
            errorMsg: `Subscription ${targetSub.id} disappeared mid-callback (order ${args.orderReference})`,
          } as RecurringCreateResult;
        }
        // Статус перевіряємо ЩЕ РАЗ усередині Serializable-транзакції: між резолвом
        // і цим місцем менеджер міг натиснути «Скасувати». Без повторної перевірки
        // ми б продовжили доступ по щойно скасованій підписці.
        if (CLOSED_SUB_STATUSES.has(sub.status)) {
          return {
            kind: 'error',
            skipReason: 'subscription_closed_race',
            errorMsg: `Subscription ${sub.id} became ${sub.status} mid-callback (order ${args.orderReference})`,
          } as RecurringCreateResult;
        }
        // Очікувана сума для рекурент-списання = сума першого PAID платежу
        // цієї підписки (бо WFP токенізує оригінальну суму). Якщо немає
        // попередніх PAID — fallback на поточний monthlyPrice з налаштувань.
        //
        // `manualMethod: null` обов'язковий: еталоном може бути ТІЛЬКИ платіж WayForPay.
        // Ручні рядки (готівка/переказ/перенесення 0 ₴/залишок авто-розбивки) сумою до
        // регулярки не мають стосунку — якби такий рядок став еталоном, усі легальні
        // списання почали б відкидатись як amount_mismatch.
        // Вторинне сортування по createdAt: у ручних/імпортованих рядків paidAt може
        // збігатись до мілісекунди, і без нього порядок був би недетермінований.
        const firstPaid = await tx.payment.findFirst({
          where: { yearlyProgramSubscriptionId: sub.id, status: 'PAID', manualMethod: null },
          orderBy: [{ paidAt: 'asc' }, { createdAt: 'asc' }],
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
          // Орфанні списання (закрита підписка / понад ліміт / розбіжність суми) у кеп
          // не входять — інакше одне зайве списання назавжди блокувало б легальні.
          where: { yearlyProgramSubscriptionId: sub.id, status: 'PAID', excludedFromAccess: false },
        });
        if (paidCount >= YEARLY_PROGRAM_CONFIG.totalMonthlyPayments) {
          return {
            kind: 'error',
            skipReason: 'monthly_cap_reached',
            errorMsg: `MONTHLY already has ${paidCount} paid (cap ${YEARLY_PROGRAM_CONFIG.totalMonthlyPayments})`,
          } as RecurringCreateResult;
        }
        // userId беремо з ПІДПИСКИ, а не з email платіжної сторінки: якщо людина
        // оплатила з іншої адреси, платіж усе одно має належати власнику підписки.
        const created = await tx.payment.create({
          data: {
            userId: sub.userId,
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
      // Транзакція відкотилась, але гроші списані реально. Усі причини нижче ведуть
      // одним шляхом — orphan-запис: Payment фіксуємо, доступ НЕ продовжуємо, підіймаємо
      // critical-issue. Раніше amount_mismatch і monthly_cap_reached просто відкочували
      // все і не записували нічого — списання зникало з обліку (WFP цей callback не повторить).
      //   subscription_closed_race — гонка з адмін-скасуванням;
      //   amount_mismatch — WFP списав не ту суму;
      //   monthly_cap_reached — списання понад ліміт платежів програми.
      const ORPHAN_SKIP_REASONS = new Set(['subscription_closed_race', 'amount_mismatch', 'monthly_cap_reached']);
      if (ORPHAN_SKIP_REASONS.has(createResult.skipReason)) {
        const raceActions = await recordOrphanRecurringCharge({
          subscriptionId: targetSub.id,
          userId: targetSub.userId,
          subscriptionStatus: createResult.skipReason === 'subscription_closed_race'
            ? 'CLOSED_MID_CALLBACK'
            : targetSub.status,
          orderReference: args.orderReference,
          amountInt,
          paymentSystem: typeof args.body.paymentSystem === 'string' ? args.body.paymentSystem : undefined,
          skipReason: createResult.skipReason,
          detail: createResult.errorMsg,
        });
        actions.push(...raceActions, `yearly:orphan_reason_${createResult.skipReason}`);
        return {
          prevStatus: null,
          skipped: true,
          // Єдиний skipReason на всі orphan-кейси: гроші вже зафіксовані Payment-ом,
          // тож дублювати їх ще й як RECURRING_CALLBACK_SKIPPED у «Помилках» не треба —
          // конкретна причина лишається в події підписки і в actionsTaken лог-запису.
          skipReason: 'orphan_recurring_charge',
          errorMsg: createResult.errorMsg,
          actions,
          sendpulseSlugs,
        };
      }
      // Підписку ідентифікували, але платіж не зарахували (сума не збіглась / вичерпано
      // ліміт списань). Пишемо подію прямо в підписку — менеджер бачить причину у
      // «Подіях» студента; сам лог-запис підніметься як critical-issue.
      await logCallbackSkipEvent({
        subscriptionId: targetSub.id,
        orderReference: args.orderReference,
        skipReason: createResult.skipReason,
        message: createResult.errorMsg,
        amount: amountInt,
      });
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
    // Перший платіж (Payment створений при ініціації оплати).
    //
    // ARCHIVED — далі відхиляємо: архів це «видалено менеджером», оживляти нічого.
    // EXPIRED/CANCELLED — навпаки, ОЖИВЛЯЄМО. Це повторна покупка людини, чия підписка
    // померла: `/api/wayforpay` лінкує новий Payment саме до неї, щоб сплачені місяці
    // не згорали. Раніше тут стояла відмова, і людина платила в порожнечу.
    if (payment.yearlyProgramSubscriptionId) {
      const subCheck = await prisma.yearlyProgramSubscription.findUnique({
        where: { id: payment.yearlyProgramSubscriptionId },
        select: { status: true },
      });
      if (subCheck?.status === 'ARCHIVED') {
        return {
          prevStatus: payment.status,
          skipped: true,
          skipReason: 'subscription_archived',
          errorMsg: 'Subscription is ARCHIVED, refusing to extend',
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
  // REFUNDED нарівні з PAID: запізнілий Approved після повернення коштів не має
  // воскрешати платіж у PAID і продовжувати доступ за гроші, які ми вже віддали назад.
  if (prevStatus === 'PAID' || prevStatus === 'REFUNDED') {
    const reason = prevStatus === 'REFUNDED' ? 'already_refunded' : 'already_paid';
    return {
      prevStatus,
      skipped: true,
      skipReason: reason,
      errorMsg: null,
      actions: [...actions, `skip:${reason}`],
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

  // Звірка суми для ПЕРШОГО платежу Річної (Payment створений на чекауті). Рекурентні
  // списання таку перевірку вже мають (`expectedAmount` у Serializable-транзакції вище),
  // а тут її не було зовсім: скільки б WFP не списав, підписка активувалась на повний
  // строк. Тобто підміна суми на платіжній сторінці давала річний доступ за копійки —
  // рівно та діра, яку для курсів і пакетів закриває `checkAmountMismatch` (див. Approved
  // course/bundle гілку). Символічні адмін-тести (1–2 ₴) хелпер пропускає сам.
  //
  // Поведінка дзеркалить курси: гроші фіксуємо (PAID), товар — НЕ видаємо. Підписка
  // лишається неактивованою, платіж позначається `excludedFromAccess`, щоб жоден
  // наступний перерахунок не зарахував його як оплачений місяць. Розбирає менеджер.
  const firstPaymentAmountCheck = checkAmountMismatch(payment.amount, args.body.amount);
  if (firstPaymentAmountCheck.mismatch) {
    const subId = payment.yearlyProgramSubscriptionId;
    const errorMsg = `Amount mismatch: callback=${firstPaymentAmountCheck.callbackAmount} ₴, payment=${payment.amount} ₴ — платіж позначено PAID, підписку НЕ активовано`;
    actions.push(subRefAction(subId));
    const claim = await prisma.payment.updateMany({
      where: { id: payment.id, status: { notIn: ['PAID', 'REFUNDED'] } },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        paymentMethod: typeof args.body.paymentSystem === 'string' ? args.body.paymentSystem : undefined,
        excludedFromAccess: true,
      },
    });
    if (claim.count > 0) {
      actions.push('yearly:amount_mismatch_paid_without_access');
      // Тип події той самий, що й в орфанних списаннях: у вкладці «Помилки» це
      // ORPHAN_RECURRING_CHARGE (critical) — «гроші є, доступу немає, потрібне рішення».
      try {
        await prisma.yearlyProgramSubscriptionEvent.create({
          data: {
            subscriptionId: subId,
            type: 'orphan_recurring_charge',
            message: `Оплата ${payment.orderReference} на ${firstPaymentAmountCheck.callbackAmount} ₴ не збіглася з виставленою сумою ${payment.amount} ₴. Платіж записано (гроші реально списані), підписку НЕ активовано і доступ НЕ відкрито — потрібне рішення: повернути кошти або зарахувати вручну.`,
            metadata: {
              orderReference: payment.orderReference,
              skipReason: 'first_payment_amount_mismatch',
              callbackAmount: firstPaymentAmountCheck.callbackAmount,
              expectedAmount: payment.amount,
            },
          },
        });
      } catch (e) {
        console.error('⚠️ Не вдалося записати подію про розбіжність суми:', payment.orderReference, e);
      }
    }
    console.error('🚨 Річна: сума callback-у не збігається з Payment:', args.orderReference, errorMsg);
    return {
      prevStatus,
      skipped: true,
      skipReason: 'amount_mismatch',
      errorMsg,
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
    | { kind: 'sub_archived' }
    | {
        kind: 'ok';
        sub: SubWithCohort;
        newExpiresAt: Date;
        durationDays: number;
        wasFirstPayment: boolean;
        /// Статус, з якого підписку оживили (EXPIRED/CANCELLED), або null для звичайної оплати.
        revivedFrom: string | null;
        /// true — SendPulse-доступ був закритий і ми скинули маркери, щоб відкрити його заново.
        accessReset: boolean;
        /// Скільки PAID-платежів у підписки ПІСЛЯ зарахування цього (для 9/9-перевірки).
        paidCount: number;
      };

  const SUB_MISSING_SENTINEL = '__SUB_MISSING_ROLLBACK__';
  const SUB_ARCHIVED_SENTINEL = '__SUB_ARCHIVED_ROLLBACK__';
  let flipResult: FlipResult;
  try {
    flipResult = await prisma.$transaction(async (tx): Promise<FlipResult> => {
      const claim = await tx.payment.updateMany({
        // REFUNDED виключений нарівні з PAID — повернений платіж не флипаємо назад у PAID.
        where: { id: payment!.id, status: { notIn: ['PAID', 'REFUNDED'] } },
        data: {
          status: 'PAID',
          paidAt: new Date(),
          paymentMethod: typeof args.body.paymentSystem === 'string' ? args.body.paymentSystem : undefined,
        },
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
      if (sub.status === 'ARCHIVED') {
        // Архівували вже після зовнішньої перевірки — відкочуємо flip.
        throw new Error(SUB_ARCHIVED_SENTINEL);
      }

      const now = new Date();
      const wasFirstPayment = !sub.startDate;
      /// Оживлення: підписка була мертвою, людина повернулась і доплатила.
      /// Дати рахуються тією ж формулою, що й для звичайної оплати — сплачені раніше
      /// місяці лишаються в заліку, бо `calculateAccessUntil` бере всі PAID цієї підписки.
      const revivedFrom = sub.status === 'EXPIRED' || sub.status === 'CANCELLED' ? sub.status : null;
      /// Доступ у SendPulse колись закривали → маркери треба скинути, інакше
      /// `runExtraLaunchForSubscription` вийде з `already_opened` і людина лишиться
      /// з оплаченою, але закритою програмою.
      const accessReset = !!sub.sendpulseAccessClosedAt;

      // Cohort-aware розрахунок expiresAt. Якщо у sub є cohort — використовуємо його межі;
      // без cohort (legacy) — стара логіка `last_payment + N днів`.
      // Поточний Payment уже флипнутий у PAID на line вище (claim updateMany), тож він
      // ВЖЕ є в allPayments. Не пушимо newPaymentAt, інакше платіж рахується двічі
      // (Bug 2026-05-03: давало 2×30=60 днів замість 30 при першій оплаті).
      const allPayments = await tx.payment.findMany({
        // Виключені зі заліку списання відсіюємо на рівні запиту: вони не місяць доступу
        // і не одиниця в лічильнику 9/9.
        where: { yearlyProgramSubscriptionId: sub.id, status: 'PAID', excludedFromAccess: false },
        select: { amount: true, status: true, paidAt: true, createdAt: true, excludedFromAccess: true },
      });
      const postAccessMonths = await getYearlyPostAccessMonths(tx);
      const newExpiresAt = calculateAccessUntil({
        plan: sub.plan,
        autoRenew: sub.autoRenew,
        cohort: sub.cohort ? { startDate: sub.cohort.startDate, endDate: sub.cohort.endDate } : null,
        payments: allPayments,
        postAccessMonths,
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
          ...RESET_REMINDER_AND_GRACE_FIELDS,
          // Оживлення: слід скасування більше не актуальний. Прив'язано до самого
          // `cancelledAt`, а не до статусу — скасована підписка може дійти сюди і не з
          // CANCELLED (напр. після ручних правок статусу в адмінці).
          ...(sub.cancelledAt ? { cancelledAt: null, cancelledBy: null, cancelledReason: null } : {}),
          // Доступ закривали → відкриваємо заново (шлях відкриття нижче по коду).
          ...(accessReset ? { sendpulseAccessOpenedAt: null, sendpulseAccessClosedAt: null } : {}),
        },
      });

      await tx.yearlyProgramSubscriptionEvent.create({
        data: {
          subscriptionId: sub.id,
          type: wasFirstPayment ? 'created' : 'renewed',
          message: `Payment ${payment!.orderReference} · +${durationDays}d · expires ${newExpiresAt.toISOString().slice(0, 10)}${revivedFrom ? ` · оживлено з ${revivedFrom}` : ''}`,
          metadata: {
            amount: payment!.amount,
            paymentId: payment!.id,
            recurring: isRecurring,
            ...(revivedFrom ? { revivedFrom, accessReset } : {}),
          },
        },
      });

      // Людина повернулась із «боргом»: платежів не вистачає навіть на поточну дату,
      // тому перерахований доступ уже прострочений. Активуємо все одно (гроші прийшли),
      // але лишаємо слід. Тип події `revived_with_debt` мапиться у вкладку «Помилки» —
      // менеджер має вирішити: допродати місяці чи скоригувати дати.
      if (newExpiresAt.getTime() <= now.getTime()) {
        const totalSlots = sub.plan === 'MONTHLY' ? YEARLY_PROGRAM_CONFIG.totalMonthlyPayments : 1;
        await tx.yearlyProgramSubscriptionEvent.create({
          data: {
            subscriptionId: sub.id,
            type: 'revived_with_debt',
            message: `⚠️ Оплата зарахована, але доступ уже прострочений: сплачено ${allPayments.length} з ${totalSlots} — розрахована дата завершення ${newExpiresAt.toISOString().slice(0, 10)} вже в минулому.${revivedFrom ? ` Підписку оживлено зі статусу ${revivedFrom}.` : ''} Потрібне рішення менеджера: допродати місяці або скоригувати дати.`,
            metadata: {
              orderReference: payment!.orderReference,
              expiresAt: newExpiresAt.toISOString(),
              paidPayments: allPayments.length,
              totalSlots,
              revivedFrom,
            },
          },
        });
      }

      return { kind: 'ok', sub: sub as SubWithCohort, newExpiresAt, durationDays, wasFirstPayment, revivedFrom, accessReset, paidCount: allPayments.length };
    });
  } catch (e) {
    if (e instanceof Error && e.message === SUB_MISSING_SENTINEL) {
      flipResult = { kind: 'sub_missing' };
    } else if (e instanceof Error && e.message === SUB_ARCHIVED_SENTINEL) {
      flipResult = { kind: 'sub_archived' };
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
  if (flipResult.kind === 'sub_archived') {
    return {
      prevStatus,
      skipped: true,
      skipReason: 'subscription_archived',
      errorMsg: `Subscription ${payment.yearlyProgramSubscriptionId} is ARCHIVED (tx rolled back, payment stays PENDING)`,
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

  // Підписка щойно стала ACTIVE — одразу прибираємо осиротілі PENDING-дублі тієї самої
  // людини (невдала спроба перед успішною оплатою, можливо з іншим email, але тим самим
  // телефоном/Telegram). Без цього дубль жив би до нічного cron-а і KPI «В очікуванні»
  // показувало б фантомний +1. Помилки лише логуються — платіж уже проведено.
  try {
    const dedup = await archiveDuplicatePendingSubscriptions({
      id: sub.id,
      userId: sub.userId,
      phone: sub.phone,
      telegramUsername: sub.telegramUsername,
    });
    if (dedup.archived.length > 0) actions.push(`dedup:archived_pending:${dedup.archived.length}`);
    if (dedup.errors.length > 0) actions.push(`dedup:err:${dedup.errors[0].slice(0, 40)}`);
  } catch (e) {
    actions.push(`dedup:err:${(e as Error).message.slice(0, 40)}`);
  }

  const fullyPaid = flipResult.paidCount >= YEARLY_PROGRAM_CONFIG.totalMonthlyPayments;

  // Прапорець autoRenew вмикається САМЕ ТУТ, за фактом живого правила у WFP. Ініціація
  // оплати (`/api/wayforpay`) навмисно не робить upgrade разова→автоплатіж у БД: інакше
  // людина, яка перемкнула тумблер і закрила вкладку не заплативши, лишалась би з
  // autoRenew=true без жодної регулярки — і Rule 2 («скасуйте автосписання») блокував би
  // їй наступну оплату. Перевіряємо STATUS правила, створеного цим самим Purchase-ом.
  // `sub` мутуємо в пам'яті, щоб уся логіка нижче (лейбли, листи, receipt) бачила правду.
  if (sub.plan === 'MONTHLY' && !sub.autoRenew && !fullyPaid) {
    try {
      const merchantPassword = process.env.WAYFORPAY_MERCHANT_PASSWORD;
      if (!merchantPassword) {
        actions.push('autopay:probe_skipped:no_password');
      } else {
        const creds = getWayforpayCreds();
        const st = await getRegularStatus({
          merchantAccount: creds.merchantAccount,
          merchantPassword,
          orderReference: payment.orderReference,
        });
        if (st.inconclusive) {
          // WFP не дав чесної відповіді — прапорець не чіпаємо, нічна звірка добере.
          actions.push('autopay:probe_inconclusive');
        } else if (st.found && st.status === 'Active') {
          await prisma.yearlyProgramSubscription.update({
            where: { id: sub.id },
            data: { autoRenew: true },
          });
          await prisma.yearlyProgramSubscriptionEvent.create({
            data: {
              subscriptionId: sub.id,
              type: 'autorenew_upgraded',
              message: `Автоплатіж увімкнено після оплати ${payment.orderReference} — у WFP знайдено активне правило регулярки.`,
              metadata: { orderReference: payment.orderReference, ruleStatus: st.status },
            },
          });
          sub.autoRenew = true;
          actions.push('autopay:enabled_after_payment');
        } else {
          actions.push('autopay:probe_no_rule');
        }
      }
    } catch (e) {
      actions.push(`autopay:probe_err:${(e as Error).message.slice(0, 40)}`);
    }
  }

  const planLabel =
    sub.plan === 'YEARLY'
      ? 'yearly'
      : sub.autoRenew
        ? 'monthly-autopay'
        : 'monthly-once';
  actions.push(`yearly:${planLabel}:+${flipResult.durationDays}d`);

  // Оновлюємо кеш «Наступний платіж» (wfpNextChargeAt) з WFP після успішного списання.
  // Звичайне списання — checkOnly: без CHANGE, бо WFP сам щойно перерахував свій графік.
  // 9/9 — навпаки, apply:true: гілка `fullyPaid` у sync-у знімає правило регулярки (REMOVE).
  // Без цього WFP пробує 10-те списання, ми його відхиляємо по monthly_cap_reached, а гроші
  // доводиться повертати вручну. Помилка не блокує callback.
  if (sub.plan === 'MONTHLY' && sub.autoRenew) {
    try {
      const syncRes = await syncAutopaySchedule(sub.id, { apply: fullyPaid, source: fullyPaid ? 'callback:fully-paid' : 'callback' });
      actions.push(`wfp_cache:${syncRes.outcome}`);
      if (fullyPaid) actions.push(`autopay:final_sync:${syncRes.outcome}`);
    } catch (e) {
      actions.push(`wfp_cache:err:${(e as Error).message.slice(0, 40)}`);
    }
  }

  // На оплату Річної програми SendPulse-event НЕ викликається в загальному випадку — доступ
  // до платформи (логін/пароль) відкривається централізовано в момент масової розсилки на
  // запуск програми (`executeLaunchLoop`).
  // ВИНЯТОК: якщо cohort вже launched (студент платить ПІСЛЯ запуску), автоматично
  // викликаємо `runExtraLaunchForSubscription` — це відкриває SP-доступ + шле cohort launch
  // lett, без ручного "🎯 Екстра Запуск" кліку менеджера. Запасний ручний шлях все одно
  // лишається на випадок збою SP API під час оплати.
  // Інакше (звичайний flow до launch) — шлемо тільки наш generic welcome lett (без креденшилз).
  //
  // Умова входу — НЕ «перший платіж», а «доступу немає». Інакше реюзнута підписка
  // (повторна покупка після EXPIRED: `startDate` уже заповнений, тож wasFirstPayment=false)
  // проходила б повз відкриття SendPulse, TG-invite і листа — людина платить і не
  // отримує нічого. Три випадки:
  //   1) перший платіж — класичний онбординг;
  //   2) оживлення / повторне відкриття закритого доступу;
  //   3) heal: cohort уже запущений, а доступ так і не відкрився (збій SP на launch-і) —
  //      чергова оплата стає нагодою добити відкриття (extra-launch ідемпотентний).
  // Звичайне місячне продовження живої підписки сюди НЕ потрапляє: до запуску
  // cohort-у `launchedAt` порожній, після запуску `sendpulseAccessOpenedAt` заповнений.
  const needsAccessOpen =
    flipResult.revivedFrom !== null
    || flipResult.accessReset
    || (!!sub.cohort?.launchedAt && !sub.sendpulseAccessOpenedAt);
  if (flipResult.revivedFrom) actions.push(`yearly:revived_from_${flipResult.revivedFrom.toLowerCase()}`);
  if (flipResult.accessReset) actions.push('yearly:sp_access_reset');
  if (flipResult.wasFirstPayment || needsAccessOpen) {
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
