/// POST /api/admin/certificates/yearly — видача сертифіката Річної програми (ручна).
/// GET  /api/admin/certificates/yearly — кандидати: всі підписки + health статус оплат
/// (9/9 для MONTHLY, 1/1 для YEARLY) + чи вже є сертифікат.

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/certificates/adminAuth';
import { issueYearlyCertificate } from '@/lib/certificates/service';

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const sp = req.nextUrl.searchParams;
  const statusFilter = sp.get('status'); // optional YearlyProgramSubscriptionStatus
  const limit = Math.min(Number(sp.get('limit')) || 500, 1000);

  const subs = await prisma.yearlyProgramSubscription.findMany({
    where: statusFilter ? { status: statusFilter as never } : {},
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { id: true, name: true, email: true, deletedAt: true } },
      payments: { where: { status: 'PAID' }, select: { amount: true, paidAt: true } },
      certificates: {
        where: { revoked: false, type: 'YEARLY_PROGRAM' },
        select: { id: true, certNumber: true, category: true, emailStatus: true, issuedAt: true },
      },
    },
  });

  const candidates = subs
    .filter((s) => !s.user.deletedAt)
    .map((s) => {
      const paidCount = s.payments.length;
      const expectedPayments = s.plan === 'MONTHLY' ? 9 : 1;
      let paymentHealth: 'FULL' | 'PARTIAL' | 'NONE' = 'NONE';
      if (paidCount >= expectedPayments) paymentHealth = 'FULL';
      else if (paidCount > 0) paymentHealth = 'PARTIAL';
      return {
        subscriptionId: s.id,
        userId: s.userId,
        userName: s.user.name,
        userEmail: s.user.email,
        plan: s.plan,
        status: s.status,
        startDate: s.startDate,
        expiresAt: s.expiresAt,
        paidCount,
        expectedPayments,
        paymentHealth,
        spProgressPercent: s.spProgressPercent,
        spProgressCheckedAt: s.spProgressCheckedAt,
        certificate: s.certificates[0] ?? null,
      };
    });

  return NextResponse.json({ candidates });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const { userId, subscriptionId, category, recipientName } = (body ?? {}) as {
    userId?: string;
    subscriptionId?: string;
    category?: 'LISTENER' | 'PRACTICAL';
    recipientName?: string;
  };
  if (!userId || !subscriptionId || !category) {
    return NextResponse.json(
      { error: 'userId, subscriptionId та category обов\'язкові' },
      { status: 400 },
    );
  }
  if (category !== 'LISTENER' && category !== 'PRACTICAL') {
    return NextResponse.json({ error: 'category має бути LISTENER або PRACTICAL' }, { status: 400 });
  }

  try {
    const cert = await issueYearlyCertificate({
      userId,
      subscriptionId,
      category,
      recipientName,
      actor: guard.actor,
    });
    return NextResponse.json({ certificate: cert });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
