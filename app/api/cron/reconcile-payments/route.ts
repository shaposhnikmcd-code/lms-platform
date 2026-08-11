/// Reconciliation cron — догенеровує те, що не встигла зробити best-effort фаза
/// callback-у (через тимчасові помилки БД, мережі, missing migrations, тощо).
///
/// Це **страховка**, без якої "PAID-but-not-provisioned" Payment залишився б назавжди
/// (до ручного втручання адміна). Cron робить систему self-healing.
///
/// Три кроки:
///   1) КУРСИ/ПАКЕТИ. Payment-и зі status=PAID, де `enrollmentsCompletedAt` АБО
///      `sendpulseSentAt` ще NULL → `provisionPayment` (idempotent).
///   2) КОНЕКТОР. ConnectorOrder з paymentStatus=PAID, orderStatus=NEW і `paidNotifiedAt`
///      NULL → повторний `notifyManagers('paid')`. Без цього кроку оплачена гра, чия
///      нотифікація впала (Resend/Telegram лягли), тихо лежала б у списку невідправленою.
///   3) АЛЕРТ. Усе, що лишилось зламаним, і Approved-callback-и без Payment
///      (`skipReason=payment_not_found`) — пушимо менеджерам на email+Telegram.
///      Дедуплікація: `Payment.provisionAlertedAt` / `PaymentCallbackLog.alertedAt`.
///
/// Усі вікна обмежені 30 днями, щоб не сканувати всю історію.
/// Запускається раз на добу о 04:45 (`45 4 * * *` у vercel.json — Hobby-план дозволяє
/// лише добові cron-и). Авторизація: `Authorization: Bearer ${CRON_SECRET}`.

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyBearer } from '@/lib/authTiming';
import { provisionPayment, AMOUNT_MISMATCH_MARKER } from '@/lib/paymentProvisioning';
import { notifyManagers, isNotificationDelivered } from '@/lib/connectorNotifications';
import { alertStuckPayments, type StuckPaymentAlertItem } from '@/lib/paymentAlerts';

const SCAN_WINDOW_DAYS = 30;
const MAX_BATCH = 50;

export async function POST(req: NextRequest) {
  return await run(req);
}

export async function GET(req: NextRequest) {
  // GET доступний для зручності тестування з браузера/curl. POST — стандарт для cron.
  return await run(req);
}

async function run(req: NextRequest) {
  if (!verifyBearer(req.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - SCAN_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // ─────────────────────────────────────────────────────────────────────────
  // КРОК 1 — курси/пакети
  // ─────────────────────────────────────────────────────────────────────────
  // Беремо тільки course/bundle. Yearly/monthly з yearlyProgramSubscriptionId не належать
  // цьому крону — у них своя логіка SP access (sendpulseAccessOpenedAt) у `yearly-subscriptions`.
  const stuck = await prisma.payment.findMany({
    where: {
      status: 'PAID',
      yearlyProgramSubscriptionId: null,
      createdAt: { gt: cutoff },
      AND: [
        { OR: [{ enrollmentsCompletedAt: null }, { sendpulseSentAt: null }] },
        // Платежі, де сума callback-у не збіглась із сумою Payment, callback свідомо
        // лишив без провіжинінгу. Без цього виключення cron «полікував» би їх за добу
        // і видав курси в обхід перевірки суми. Розбирає менеджер вручну.
        //
        // `provisionError: null` у цьому OR — обов'язковий. Голий
        // `NOT: { provisionError: { startsWith: … } }` перетворюється на SQL
        // `NOT (col LIKE '…%')`, який для NULL дає NULL, а не TRUE — тобто відсікав
        // РІВНО ті платежі, заради яких крон і існує: оплачені, без помилки, без доступу.
        {
          OR: [
            { provisionError: null },
            { NOT: { provisionError: { startsWith: AMOUNT_MISMATCH_MARKER } } },
          ],
        },
      ],
    },
    take: MAX_BATCH,
    orderBy: { paidAt: 'asc' },
    include: {
      user: { select: { email: true } },
      course: { select: { title: true } },
      bundle: { select: { title: true } },
    },
  });

  type PerPaymentResult = {
    orderReference: string;
    enrollmentsCreated: string[];
    sendpulseSent: string[];
    errors: string[];
  };
  const results: PerPaymentResult[] = [];
  let healed = 0;
  let stillBroken = 0;
  /// Платежі, які лишились зламаними і по яких алерт ще не йшов.
  const alertItems: StuckPaymentAlertItem[] = [];
  const alertedPaymentIds: string[] = [];

  for (const payment of stuck) {
    try {
      const provision = await provisionPayment(payment);
      const fullyHealed = provision.errors.length === 0;
      if (fullyHealed) healed += 1;
      else {
        stillBroken += 1;
        if (!payment.provisionAlertedAt) {
          alertItems.push({
            kind: 'provision_failed',
            orderReference: payment.orderReference,
            amount: payment.amount,
            currency: payment.currency,
            clientEmail: payment.user?.email ?? null,
            productLabel: payment.bundle?.title ?? payment.course?.title ?? '—',
            reason: provision.errors.join('; ').slice(0, 300),
            paidAt: payment.paidAt,
          });
          alertedPaymentIds.push(payment.id);
        }
      }
      results.push({
        orderReference: payment.orderReference,
        enrollmentsCreated: provision.enrollmentsCreated,
        sendpulseSent: provision.sendpulseSent,
        errors: provision.errors,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      stillBroken += 1;
      if (!payment.provisionAlertedAt) {
        alertItems.push({
          kind: 'provision_failed',
          orderReference: payment.orderReference,
          amount: payment.amount,
          currency: payment.currency,
          clientEmail: payment.user?.email ?? null,
          productLabel: payment.bundle?.title ?? payment.course?.title ?? '—',
          reason: `unhandled: ${msg.slice(0, 200)}`,
          paidAt: payment.paidAt,
        });
        alertedPaymentIds.push(payment.id);
      }
      results.push({
        orderReference: payment.orderReference,
        enrollmentsCreated: [],
        sendpulseSent: [],
        errors: [`unhandled: ${msg.slice(0, 200)}`],
      });
    }
  }

  // Платежі з AMOUNT_MISMATCH свідомо не лікуємо (див. фільтр вище), але про них теж
  // треба сказати вголос: гроші прийшли, доступу немає, і сам собою кейс не розсмокчеться.
  const mismatched = await prisma.payment.findMany({
    where: {
      status: 'PAID',
      createdAt: { gt: cutoff },
      provisionError: { startsWith: AMOUNT_MISMATCH_MARKER },
      provisionAlertedAt: null,
    },
    take: MAX_BATCH,
    include: {
      user: { select: { email: true } },
      course: { select: { title: true } },
      bundle: { select: { title: true } },
    },
  });
  for (const p of mismatched) {
    alertItems.push({
      kind: 'provision_failed',
      orderReference: p.orderReference,
      amount: p.amount,
      currency: p.currency,
      clientEmail: p.user?.email ?? null,
      productLabel: p.bundle?.title ?? p.course?.title ?? '—',
      reason: (p.provisionError ?? AMOUNT_MISMATCH_MARKER).slice(0, 300),
      paidAt: p.paidAt,
    });
    alertedPaymentIds.push(p.id);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // КРОК 2 — осиротілі оплачені замовлення «Конектора»
  // ─────────────────────────────────────────────────────────────────────────
  const orphanConnectors = await prisma.connectorOrder.findMany({
    where: {
      paymentStatus: 'PAID',
      orderStatus: 'NEW',
      paidNotifiedAt: null,
      createdAt: { gt: cutoff },
    },
    take: MAX_BATCH,
    orderBy: { paidAt: 'asc' },
  });

  let connectorNotified = 0;
  let connectorStillSilent = 0;
  const connectorResults: Array<{ orderReference: string; notified: boolean }> = [];
  for (const order of orphanConnectors) {
    try {
      const notify = await notifyManagers('paid', order);
      const delivered = isNotificationDelivered(notify);
      if (delivered) {
        await prisma.connectorOrder.update({
          where: { id: order.id },
          data: { paidNotifiedAt: new Date() },
        });
        connectorNotified += 1;
      } else {
        connectorStillSilent += 1;
      }
      connectorResults.push({ orderReference: order.orderReference, notified: delivered });
    } catch (e) {
      connectorStillSilent += 1;
      console.error('❌ [recon] connector notify failed:', order.orderReference, e);
      connectorResults.push({ orderReference: order.orderReference, notified: false });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // КРОК 3 — Approved-callback-и, для яких Payment так і не знайшовся
  // ─────────────────────────────────────────────────────────────────────────
  const orphanCallbacks = await prisma.paymentCallbackLog.findMany({
    where: {
      createdAt: { gt: cutoff },
      skipped: true,
      skipReason: 'payment_not_found',
      alertedAt: null,
    },
    take: MAX_BATCH,
    orderBy: { createdAt: 'asc' },
  });
  for (const log of orphanCallbacks) {
    alertItems.push({
      kind: 'payment_not_found',
      orderReference: log.orderReference ?? '—',
      amount: log.amount,
      currency: log.currency ?? 'UAH',
      clientEmail: log.clientEmail,
      productLabel: log.kind === 'connector' ? 'Конектор' : log.kind,
      reason: log.error ?? 'Callback підтвердив оплату, але замовлення з таким orderReference немає в базі',
      paidAt: log.createdAt,
    });
  }

  // Один дайджест на прохід. Помітки ставимо ЛИШЕ якщо алерт реально доставлено —
  // інакше збій пошти зам'яв би проблему назавжди.
  const alert = await alertStuckPayments(alertItems);
  const alertDelivered = alertItems.length > 0 && (alert.emailsSent > 0 || alert.telegramSent > 0);
  if (alertDelivered) {
    const now = new Date();
    if (alertedPaymentIds.length > 0) {
      await prisma.payment.updateMany({
        where: { id: { in: alertedPaymentIds } },
        data: { provisionAlertedAt: now },
      });
    }
    if (orphanCallbacks.length > 0) {
      await prisma.paymentCallbackLog.updateMany({
        where: { id: { in: orphanCallbacks.map((l) => l.id) } },
        data: { alertedAt: now },
      });
    }
  }

  return NextResponse.json({
    ok: true,
    scanned: stuck.length,
    healed,
    stillBroken,
    connector: {
      scanned: orphanConnectors.length,
      notified: connectorNotified,
      stillSilent: connectorStillSilent,
      results: connectorResults,
    },
    alert: {
      items: alertItems.length,
      delivered: alertDelivered,
      ...alert,
    },
    timestamp: new Date().toISOString(),
    results,
  });
}
