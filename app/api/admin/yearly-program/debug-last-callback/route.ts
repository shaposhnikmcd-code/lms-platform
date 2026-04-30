import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAdmin } from '@/lib/adminAuth';

export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Немає доступу' }, { status: 403 });
  }
  const url = new URL(req.url);
  const orderRef = url.searchParams.get('orderRef');
  const where = orderRef ? { orderReference: orderRef } : {};
  const logs = await prisma.paymentCallbackLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  return NextResponse.json(logs.map(l => ({
    createdAt: l.createdAt,
    orderReference: l.orderReference,
    transactionStatus: l.transactionStatus,
    actionsTaken: l.actionsTaken,
    skipReason: l.skipReason,
    error: l.error,
    rawPayload: l.rawPayload,
  })));
}
