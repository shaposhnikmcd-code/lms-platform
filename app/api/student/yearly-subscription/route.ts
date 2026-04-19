import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { removeRegularSchedule } from '@/lib/wayforpay';

/// Повертає активну/grace підписку юзера (якщо є). Для user-facing "Моя підписка".
export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const sub = await prisma.yearlyProgramSubscription.findFirst({
    where: {
      userId,
      status: { in: ['PENDING', 'ACTIVE', 'GRACE', 'EXPIRED', 'CANCELLED'] },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      payments: {
        where: { status: 'PAID' },
        orderBy: { paidAt: 'desc' },
        select: { amount: true, paidAt: true },
      },
    },
  });

  if (!sub) {
    return NextResponse.json({ subscription: null });
  }

  const totalPaid = sub.payments.reduce((sum, p) => sum + p.amount, 0);
  const paymentsCount = sub.payments.length;

  return NextResponse.json({
    subscription: {
      id: sub.id,
      plan: sub.plan,
      status: sub.status,
      startDate: sub.startDate?.toISOString() ?? null,
      expiresAt: sub.expiresAt?.toISOString() ?? null,
      lastPaymentAt: sub.lastPaymentAt?.toISOString() ?? null,
      cancelledAt: sub.cancelledAt?.toISOString() ?? null,
      paymentsCount,
      totalPaid,
      canCancel: sub.plan === 'MONTHLY' && ['ACTIVE', 'GRACE', 'PENDING'].includes(sub.status),
    },
  });
}

/// POST з body `{action: 'cancel'}` — користувач скасовує свою MONTHLY підписку.
/// Скасовує регулярку в WFP. Доступ до контенту лишається до кінця оплаченого періоду (expiresAt),
/// після чого cron сам закриє SendPulse-доступ.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { action?: string };
  if (body.action !== 'cancel') {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }

  // Знаходимо активну MONTHLY підписку юзера
  const sub = await prisma.yearlyProgramSubscription.findFirst({
    where: {
      userId,
      plan: 'MONTHLY',
      status: { in: ['PENDING', 'ACTIVE', 'GRACE'] },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!sub) {
    return NextResponse.json({ error: 'Active subscription not found' }, { status: 404 });
  }

  // Скасовуємо регулярний платіж у WFP
  let wfpRemoved = false;
  let wfpError: string | null = null;
  try {
    const merchantAccount = process.env.WAYFORPAY_MERCHANT_LOGIN!;
    const merchantPassword = process.env.WAYFORPAY_MERCHANT_PASSWORD;
    if (!merchantPassword) {
      wfpError = 'WAYFORPAY_MERCHANT_PASSWORD не налаштовано';
    } else {
      const firstPayment = await prisma.payment.findFirst({
        where: { yearlyProgramSubscriptionId: sub.id, status: 'PAID' },
        orderBy: { paidAt: 'asc' },
      });
      if (!firstPayment) {
        wfpError = 'Немає оплаченого платежу — регулярки ще нема';
      } else {
        const result = await removeRegularSchedule({
          merchantAccount,
          merchantPassword,
          orderReference: firstPayment.orderReference,
        });
        wfpRemoved = result.ok;
        if (!result.ok) wfpError = JSON.stringify(result.raw).slice(0, 300);
      }
    }
  } catch (e) {
    wfpError = (e as Error).message;
  }

  await prisma.yearlyProgramSubscription.update({
    where: { id: sub.id },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelledBy: 'user',
      cancelledReason: 'Self-service cancel from /dashboard/student/subscription',
      // Очищуємо recToken — якщо WFP remove впав, callback на подальше автосписання
      // не знайде підписку через recToken-binding і не продовжить expiresAt.
      recToken: null,
    },
  });

  await prisma.yearlyProgramSubscriptionEvent.create({
    data: {
      subscriptionId: sub.id,
      type: 'cancelled',
      message: `Cancelled by user${wfpRemoved ? ' · WFP regular removed' : (wfpError ? ` · WFP error: ${wfpError}` : '')}`,
      metadata: { wfpRemoved, wfpError },
    },
  });

  return NextResponse.json({
    ok: true,
    wfpRemoved,
    // Якщо WFP-запит не пройшов — попереджаємо клієнта. В БД скасували все одно — важливіше
    // убезпечити статус, бо навіть якщо WFP списуватиме далі, callback побачить CANCELLED і
    // не продовжить expiresAt, а cron закриє доступ у звичайному порядку.
    warning: wfpError,
  });
}
