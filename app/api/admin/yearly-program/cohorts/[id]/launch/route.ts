import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAdmin, getAdminActor } from '@/lib/adminAuth';
import { openAccessViaEvent, lookupStudentIdByEmail } from '@/lib/sendpulse';
import { YEARLY_PROGRAM_CONFIG } from '@/lib/yearlyProgramConfig';
import { calculateAccessUntil } from '@/lib/yearlyProgramAccess';

/// 🚀 Запустити програму. Дія менеджера в адмінці:
/// 1. Знаходить усі підписки cohort-у з оплачуваним статусом (PENDING/ACTIVE з PAID-платежами).
/// 2. Відкриває доступ у SendPulse (event → funnel) для кожної.
/// 3. Перераховує expiresAt по новій логіці (cohort-aware).
/// 4. Фіксує `launchedAt` на cohort-і.
/// 5. Зберігає лог у YearlyProgramSubscriptionEvent (`access_opened` + metadata).
///
/// Розсилка welcome-листа НЕ виконується тут — це окремий endpoint /send-emails
/// (менеджер може запустити її окремо, навіть до launchedAt).
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

  const cohort = await prisma.yearlyProgramCohort.findUnique({ where: { id } });
  if (!cohort) {
    return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });
  }
  if (cohort.launchedAt) {
    return NextResponse.json({ error: 'Програма вже запущена' }, { status: 400 });
  }

  // Беремо всі підписки cohort-у з PAID-платежем (PENDING без оплати — пропускаємо).
  const subs = await prisma.yearlyProgramSubscription.findMany({
    where: {
      cohortId: id,
      status: { in: ['PENDING', 'ACTIVE', 'GRACE'] },
    },
    include: {
      user: { select: { id: true, email: true } },
      payments: { select: { amount: true, status: true, paidAt: true, createdAt: true } },
    },
  });

  type Result = {
    subscriptionId: string;
    email: string;
    accessOpened: boolean;
    expiresAt: string | null;
    error?: string;
  };
  const results: Result[] = [];

  // Послідовно (не паралельно), бо openAccessViaEvent → external SendPulse webhook
  // — обмеження rate-limit. Можемо batch-нути по 5 при 100+ підписників.
  for (const s of subs) {
    if (!s.user?.email) continue;
    const paidPayments = s.payments.filter((p) => p.status === 'PAID');
    if (paidPayments.length === 0) {
      results.push({ subscriptionId: s.id, email: s.user.email, accessOpened: false, expiresAt: null, error: 'no_paid_payments' });
      continue;
    }

    let openedNow = false;
    let openErr: string | null = null;
    if (!s.sendpulseAccessOpenedAt) {
      try {
        await openAccessViaEvent(
          s.user.email,
          YEARLY_PROGRAM_CONFIG.sendpulseEventSlug,
          paidPayments[0]!.amount,
        );
        openedNow = true;
        // SendPulse студент створюється async — лукапимо студент-ID best-effort.
        if (!s.sendpulseStudentId && YEARLY_PROGRAM_CONFIG.sendpulseCourseId) {
          try {
            const studentId = await lookupStudentIdByEmail(
              YEARLY_PROGRAM_CONFIG.sendpulseCourseId,
              s.user.email,
            );
            if (studentId) {
              await prisma.yearlyProgramSubscription.update({
                where: { id: s.id },
                data: { sendpulseStudentId: studentId },
              });
            }
          } catch {
            // ignore lookup err
          }
        }
      } catch (e) {
        openErr = (e as Error).message;
      }
    } else {
      openedNow = true; // вже відкрито раніше — для звітності рахуємо як ok
    }

    const newExpiresAt = calculateAccessUntil({
      plan: s.plan,
      autoRenew: s.autoRenew,
      cohort: { startDate: cohort.startDate, endDate: cohort.endDate },
      payments: s.payments,
    });

    await prisma.yearlyProgramSubscription.update({
      where: { id: s.id },
      data: {
        status: 'ACTIVE',
        startDate: s.startDate ?? cohort.startDate,
        expiresAt: newExpiresAt,
        ...(openedNow && !s.sendpulseAccessOpenedAt
          ? { sendpulseAccessOpenedAt: new Date(), sendpulseAccessClosedAt: null }
          : {}),
      },
    });

    await prisma.yearlyProgramSubscriptionEvent.create({
      data: {
        subscriptionId: s.id,
        type: openedNow && !s.sendpulseAccessOpenedAt ? 'access_opened' : 'admin_action',
        message: openErr
          ? `Cohort launch · access open FAILED: ${openErr.slice(0, 200)}`
          : `Cohort launch by ${actorLabel} · expiresAt=${newExpiresAt?.toISOString().slice(0, 10) ?? 'null'}`,
        metadata: { cohortId: id, openedNow, openErr },
      },
    });

    results.push({
      subscriptionId: s.id,
      email: s.user.email,
      accessOpened: openedNow && !openErr,
      expiresAt: newExpiresAt?.toISOString() ?? null,
      error: openErr ?? undefined,
    });
  }

  await prisma.yearlyProgramCohort.update({
    where: { id },
    data: { launchedAt: new Date() },
  });

  const okCount = results.filter((r) => r.accessOpened).length;
  const failCount = results.filter((r) => !r.accessOpened).length;

  return NextResponse.json({
    ok: true,
    launchedAt: new Date().toISOString(),
    summary: { total: results.length, opened: okCount, failed: failCount },
    results,
  });
}
