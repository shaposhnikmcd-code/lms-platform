/// Reconciliation cron — догенеровує enrollments + SendPulse events для PAID Payment-ів,
/// у яких best-effort фаза callback-у не завершилась (через тимчасові помилки БД, мережі,
/// missing migrations, тощо).
///
/// Це **страховка**, без якої "PAID-but-not-provisioned" Payment залишився б назавжди
/// (до ручного втручання адміна). Cron робить систему self-healing.
///
/// Як це працює:
///   1) Знаходить Payment-и зі status=PAID, де `enrollmentsCompletedAt` АБО `sendpulseSentAt` ще NULL.
///   2) Обмежує вікно: createdAt > 30 днів тому (щоб не сканувати всю історію).
///   3) Для кожного — викликає `provisionPayment` (idempotent).
///
/// Запускається раз на 15 хвилин (vercel.json cron). Авторизація: `Authorization: Bearer ${CRON_SECRET}`.

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyBearer } from '@/lib/authTiming';
import { provisionPayment } from '@/lib/paymentProvisioning';

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

  // Beracaем тільки course/bundle. Yearly/monthly з yearlyProgramSubscriptionId не належать
  // цьому крону — у них своя логіка SP access (sendpulseAccessOpenedAt) у `yearly-subscriptions`.
  const stuck = await prisma.payment.findMany({
    where: {
      status: 'PAID',
      yearlyProgramSubscriptionId: null,
      createdAt: { gt: cutoff },
      OR: [
        { enrollmentsCompletedAt: null },
        { sendpulseSentAt: null },
      ],
    },
    take: MAX_BATCH,
    orderBy: { paidAt: 'asc' },
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

  for (const payment of stuck) {
    try {
      const provision = await provisionPayment(payment);
      const fullyHealed = provision.errors.length === 0;
      if (fullyHealed) healed += 1;
      else stillBroken += 1;
      results.push({
        orderReference: payment.orderReference,
        enrollmentsCreated: provision.enrollmentsCreated,
        sendpulseSent: provision.sendpulseSent,
        errors: provision.errors,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      stillBroken += 1;
      results.push({
        orderReference: payment.orderReference,
        enrollmentsCreated: [],
        sendpulseSent: [],
        errors: [`unhandled: ${msg.slice(0, 200)}`],
      });
    }
  }

  return NextResponse.json({
    ok: true,
    scanned: stuck.length,
    healed,
    stillBroken,
    timestamp: new Date().toISOString(),
    results,
  });
}
