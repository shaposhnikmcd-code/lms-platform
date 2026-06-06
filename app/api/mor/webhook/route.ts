/// Webhook Paddle (Merchant of Record) для закордонних платежів.
/// Дзеркало до app/api/wayforpay/callback — та сама двофазна логіка:
///   ФАЗА A (critical): атомарний claim-then-act flip Payment.status = PAID.
///   ФАЗА B (best-effort): provisionPayment() — Enrollment.upsert + SendPulse event.
/// Скоуп Фази 1: course/bundle. Підпис — HMAC-SHA256 (заголовок Paddle-Signature), не MD5.

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyPaddleSignature } from '@/lib/paddle';
import { provisionPayment } from '@/lib/paymentProvisioning';
import { sendBundlePurchaseEmail } from '@/lib/bundlePurchaseEmail';

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

/// Paddle емітить кілька подій на оплату; нас цікавить підтверджена оплата транзакції.
const PAID_EVENTS = new Set(['transaction.completed', 'transaction.paid']);

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const userAgent = req.headers.get('user-agent') || '';
  const actions: string[] = [];
  const sendpulseSlugs: string[] = [];
  let signatureValid: boolean | null = null;
  let prevStatus: string | null = null;
  let skipped = false;
  let skipReason: string | null = null;
  let errorMsg: string | null = null;
  let body: Record<string, unknown> = {};
  let orderReference: string | null = null;
  let eventType: string | null = null;

  try {
    // Сирий текст тіла — потрібен 1:1 для перевірки підпису.
    const raw = await req.text();
    signatureValid = verifyPaddleSignature(raw, req.headers.get('paddle-signature'));

    if (!signatureValid) {
      console.error('❌ Невірний підпис Paddle webhook');
      await writeLog({ body: {}, ip, userAgent, signatureValid, actions, sendpulseSlugs, skipped: true, skipReason: 'invalid_signature', prevStatus, errorMsg: 'Invalid signature', orderReference, eventType });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    body = JSON.parse(raw) as Record<string, unknown>;
    eventType = (body.event_type as string | undefined) ?? null;
    const data = (body.data as Record<string, unknown> | undefined) ?? {};
    const customData = (data.custom_data as Record<string, unknown> | undefined) ?? {};
    orderReference = (customData.orderReference as string | undefined) ?? null;
    const transactionId = (data.id as string | undefined) ?? null;

    console.log('📩 Paddle webhook:', { eventType, orderReference, transactionId, ip });

    if (!eventType || !PAID_EVENTS.has(eventType)) {
      // Інші події (subscription.*, transaction.created тощо) — ack без дій у Фазі 1.
      actions.push(`ignored:${eventType ?? 'unknown'}`);
      await writeLog({ body, ip, userAgent, signatureValid, actions, sendpulseSlugs, skipped: true, skipReason: 'event_not_handled', prevStatus, errorMsg: null, orderReference, eventType });
      return NextResponse.json({ ok: true });
    }

    // Знаходимо Payment за orderReference (custom_data) або за externalRef (Paddle txn id).
    const payment = orderReference
      ? await prisma.payment.findUnique({ where: { orderReference } })
      : transactionId
        ? await prisma.payment.findFirst({ where: { externalRef: transactionId, paymentProvider: 'paddle' } })
        : null;

    if (!payment) {
      skipped = true;
      skipReason = 'payment_not_found';
      errorMsg = 'Payment not found';
      console.error('❌ Paddle: Payment не знайдено', { orderReference, transactionId });
    } else if (!payment.courseId && !payment.bundleId) {
      skipped = true;
      skipReason = 'missing_course_and_bundle';
      errorMsg = 'Payment has no courseId/bundleId';
    } else {
      orderReference = payment.orderReference;
      prevStatus = payment.status;

      // USD-сума в центах із Paddle totals (рядкове поле minor units).
      const totals = ((data.details as Record<string, unknown> | undefined)?.totals) as Record<string, unknown> | undefined;
      const grandTotalRaw = totals?.grand_total;
      const amountCents = typeof grandTotalRaw === 'string' ? parseInt(grandTotalRaw, 10) : (typeof grandTotalRaw === 'number' ? grandTotalRaw : null);

      // === ФАЗА A: атомарний claim flip ===
      const claim = await prisma.payment.updateMany({
        where: { orderReference: payment.orderReference, status: { not: 'PAID' } },
        data: {
          status: 'PAID',
          paidAt: new Date(),
          ...(amountCents !== null && Number.isFinite(amountCents) ? { amount: amountCents } : {}),
        },
      });

      if (claim.count === 0) {
        skipped = true;
        skipReason = 'already_paid';
        actions.push('skip:already_paid');
        console.log('ℹ️ Paddle: Payment уже PAID, пропускаю:', payment.orderReference);
      } else {
        actions.push('payment:updated');

        // === ФАЗА B: best-effort провіжинінг (та сама функція, що й WFP) ===
        const fresh = await prisma.payment.findUnique({ where: { id: payment.id } });
        if (fresh) {
          const provision = await provisionPayment(fresh);
          if (provision.enrollmentsCreated.length > 0) actions.push(`enrollments:${provision.enrollmentsCreated.join(',')}`);
          if (provision.sendpulseSent.length > 0) {
            sendpulseSlugs.push(...provision.sendpulseSent);
            actions.push(`sendpulse:sent(${provision.sendpulseSent.length})`);
          }
          if (provision.errors.length > 0) {
            actions.push(`provision-deferred:${provision.errors.length}_err`);
            console.error('⚠️ Paddle provision deferred to recon cron:', payment.orderReference, provision.errors);
          }

          // Bundle confirmation email — один раз тут (всередині claim>0).
          if (fresh.bundleId) {
            try {
              const u = await prisma.user.findUnique({ where: { id: fresh.userId }, select: { email: true, name: true } });
              if (u?.email) {
                const r = await sendBundlePurchaseEmail({ to: u.email, name: u.name, bundleId: fresh.bundleId, freeSlugs: fresh.freeSlugs ?? [] });
                actions.push(r.ok ? 'bundle-email:sent' : `bundle-email:failed(${r.error ?? 'unknown'})`);
              }
            } catch (e) {
              console.error('⚠️ Paddle bundle email throw:', payment.orderReference, e);
              actions.push('bundle-email:throw');
            }
          }
        }
      }
    }

    await writeLog({ body, ip, userAgent, signatureValid, actions, sendpulseSlugs, skipped, skipReason, prevStatus, errorMsg, orderReference, eventType });
    // Paddle очікує 200 — інакше ретраїть. Помилки провіжинінгу не блокують ack (recon догенерує).
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Помилка Paddle webhook:', message);
    try {
      await writeLog({ body, ip, userAgent, signatureValid, actions, sendpulseSlugs, skipped, skipReason, prevStatus, errorMsg: message, orderReference, eventType });
    } catch {}
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

interface LogArgs {
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
  orderReference: string | null;
  eventType: string | null;
}

/// Лог у PaymentCallbackLog із source='paddle' + dedupe (як у WFP-callback):
/// не задвоюємо рядок з тією ж помилкою для того ж orderRef за останню годину.
async function writeLog(args: LogArgs) {
  try {
    const data = (args.body.data as Record<string, unknown> | undefined) ?? {};
    const totals = ((data.details as Record<string, unknown> | undefined)?.totals) as Record<string, unknown> | undefined;
    const grandTotalRaw = totals?.grand_total;
    const amount = typeof grandTotalRaw === 'string' ? Math.round(Number(grandTotalRaw)) : (typeof grandTotalRaw === 'number' ? Math.round(grandTotalRaw) : null);
    const currency = (totals?.currency_code as string | undefined) ?? ((data.currency_code as string | undefined) ?? null);

    if (args.orderReference && args.errorMsg) {
      const recent = await prisma.paymentCallbackLog.findFirst({
        where: { orderReference: args.orderReference, error: args.errorMsg, createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } },
        select: { id: true },
      });
      if (recent) {
        console.log(`📋 Skipping duplicate Paddle log (same error in last 1h): ${args.orderReference}`);
        return;
      }
    }

    await prisma.paymentCallbackLog.create({
      data: {
        source: 'paddle',
        kind: 'course_or_bundle',
        orderReference: args.orderReference,
        transactionStatus: args.eventType,
        amount: Number.isFinite(amount) ? (amount as number) : null,
        currency,
        clientEmail: null,
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
    console.error('⚠️ Не вдалося записати Paddle PaymentCallbackLog:', logError);
  }
}
