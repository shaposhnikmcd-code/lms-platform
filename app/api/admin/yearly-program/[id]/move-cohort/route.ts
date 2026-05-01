import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAdmin, getAdminActor } from '@/lib/adminAuth';
import { calculateAccessUntil } from '@/lib/yearlyProgramAccess';

/// POST — перенести підписку в інший cohort. Body: { cohortId: string | null }.
/// Доступно лише для підписок, які ще НЕ запущені (cohort.launchedAt = null) — після
/// запуску переносити вже не безпечно (доступ у SendPulse прив'язаний до cohort-у).
/// Перерахунок expiresAt по новому cohort-у виконується одразу.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Немає доступу' }, { status: 403 });
  }
  const actor = await getAdminActor(req);
  const actorLabel = actor?.email ?? actor?.name ?? 'admin';
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { cohortId?: string | null };

  if (body.cohortId === undefined) {
    return NextResponse.json({ error: 'cohortId required' }, { status: 400 });
  }

  const sub = await prisma.yearlyProgramSubscription.findUnique({
    where: { id },
    include: {
      cohort: { select: { id: true, name: true, launchedAt: true } },
      payments: { select: { amount: true, status: true, paidAt: true, createdAt: true } },
    },
  });
  if (!sub) {
    return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
  }
  if (sub.cohort?.launchedAt) {
    return NextResponse.json(
      { error: 'Не можна переносити підписку з уже запущеного cohort-у' },
      { status: 400 },
    );
  }

  let targetCohort: { id: string; name: string; startDate: Date; endDate: Date; launchedAt: Date | null } | null = null;
  if (body.cohortId !== null) {
    targetCohort = await prisma.yearlyProgramCohort.findUnique({
      where: { id: body.cohortId },
      select: { id: true, name: true, startDate: true, endDate: true, launchedAt: true },
    });
    if (!targetCohort) {
      return NextResponse.json({ error: 'Target cohort not found' }, { status: 404 });
    }
    if (targetCohort.launchedAt) {
      return NextResponse.json(
        { error: 'Не можна переносити в уже запущений cohort' },
        { status: 400 },
      );
    }
  }

  const newExpiresAt = targetCohort
    ? calculateAccessUntil({
        plan: sub.plan,
        autoRenew: sub.autoRenew,
        cohort: { startDate: targetCohort.startDate, endDate: targetCohort.endDate },
        payments: sub.payments,
      })
    : sub.expiresAt;

  await prisma.$transaction([
    prisma.yearlyProgramSubscription.update({
      where: { id },
      data: {
        cohortId: body.cohortId,
        expiresAt: newExpiresAt,
      },
    }),
    prisma.yearlyProgramSubscriptionEvent.create({
      data: {
        subscriptionId: id,
        type: 'admin_action',
        message: `Cohort moved by ${actorLabel}: ${sub.cohort?.name ?? 'none'} → ${targetCohort?.name ?? 'none'}`,
        metadata: {
          fromCohortId: sub.cohort?.id ?? null,
          toCohortId: body.cohortId,
          newExpiresAt: newExpiresAt?.toISOString() ?? null,
        },
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
