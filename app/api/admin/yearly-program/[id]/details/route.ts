import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAdmin } from '@/lib/adminAuth';

/// Деталі однієї підписки + повний лог подій + список платежів. Для expandable row в адмінці.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Немає доступу' }, { status: 403 });
  }

  const { id } = await params;
  const sub = await prisma.yearlyProgramSubscription.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      payments: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          orderReference: true,
          amount: true,
          status: true,
          createdAt: true,
          paidAt: true,
        },
      },
      events: {
        orderBy: { createdAt: 'desc' },
        take: 100,
      },
    },
  });

  if (!sub) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({
    id: sub.id,
    user: sub.user,
    plan: sub.plan,
    status: sub.status,
    startDate: sub.startDate?.toISOString() ?? null,
    expiresAt: sub.expiresAt?.toISOString() ?? null,
    cancelledAt: sub.cancelledAt?.toISOString() ?? null,
    cancelledBy: sub.cancelledBy,
    cancelledReason: sub.cancelledReason,
    recTokenMasked: sub.recToken ? `${sub.recToken.slice(0, 6)}…${sub.recToken.slice(-4)}` : null,
    lastPaymentAt: sub.lastPaymentAt?.toISOString() ?? null,
    lastChargeAttemptAt: sub.lastChargeAttemptAt?.toISOString() ?? null,
    lastChargeError: sub.lastChargeError,
    failedChargeCount: sub.failedChargeCount,
    sendpulseStudentId: sub.sendpulseStudentId,
    sendpulseAccessOpenedAt: sub.sendpulseAccessOpenedAt?.toISOString() ?? null,
    sendpulseAccessClosedAt: sub.sendpulseAccessClosedAt?.toISOString() ?? null,
    reminderSent3d: sub.reminderSent3d,
    reminderSent1d: sub.reminderSent1d,
    reminderSentExpired: sub.reminderSentExpired,
    createdAt: sub.createdAt.toISOString(),
    updatedAt: sub.updatedAt.toISOString(),
    payments: sub.payments.map((p) => ({
      id: p.id,
      orderReference: p.orderReference,
      amount: p.amount,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
      paidAt: p.paidAt?.toISOString() ?? null,
    })),
    events: sub.events.map((e) => ({
      id: e.id,
      type: e.type,
      message: e.message,
      metadata: e.metadata,
      createdAt: e.createdAt.toISOString(),
    })),
  });
}
