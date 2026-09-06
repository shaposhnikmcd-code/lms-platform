import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAdmin, getAdminActor } from '@/lib/adminAuth';
import { calculateAccessUntil } from '@/lib/yearlyProgramAccess';
import { getYearlyPostAccessMonths, RESET_REMINDER_AND_GRACE_FIELDS } from '@/lib/yearlyProgramConfig';
import { syncAutopaySchedule } from '@/lib/yearlyProgramScheduleSync';

/// POST — перенести підписку в інший cohort. Body: { cohortId: string | null }.
/// Доступно лише для підписок, які ще НЕ запущені (cohort.launchedAt = null) — після
/// запуску переносити вже не безпечно (доступ у SendPulse прив'язаний до cohort-у).
/// Перенос повний: expiresAt перераховується по новому cohort-у, протермінована підписка
/// оживає (GRACE → ACTIVE зі скиданням grace/reminder-полів), а WFP-графік автосписань
/// переноситься під нові дати — інакше WFP списував би за розкладом старого набору.
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
      payments: { select: { amount: true, status: true, paidAt: true, createdAt: true, excludedFromAccess: true, manualMethod: true } },
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

  const postAccessMonths = await getYearlyPostAccessMonths(prisma);
  const newExpiresAt = targetCohort
    ? calculateAccessUntil({
        plan: sub.plan,
        autoRenew: sub.autoRenew,
        cohort: { startDate: targetCohort.startDate, endDate: targetCohort.endDate },
        payments: sub.payments,
        postAccessMonths,
      })
    : sub.expiresAt;

  // Новий cohort може «оживити» підписку: якщо перерахований expiresAt у майбутньому,
  // стара протермінованість більше не діє. GRACE повертаємо в ACTIVE і скидаємо grace-дати
  // разом зі спожитими прапорами нагадувань — інакше cron закриє доступ за старим
  // gracePeriodEndsAt (тобто за графіком набору, з якого ми щойно пішли), а цикл попереджень
  // для нової дати завершення не відпрацює взагалі. Той самий патерн, що й у PATCH дат
  // cohort-у (cohorts/[id]/route.ts).
  const now = new Date();
  const backToLife = !!newExpiresAt && newExpiresAt > now;
  const revive = backToLife && sub.status === 'GRACE';

  await prisma.$transaction([
    prisma.yearlyProgramSubscription.update({
      where: { id },
      data: {
        cohortId: body.cohortId,
        expiresAt: newExpiresAt,
        // Скидаємо і лічильник невдалих списань: «провина» за прострочення пішла разом
        // зі старими датами, інакше наступний цикл одразу надішле «charge failed»-шаблон.
        ...(revive ? { status: 'ACTIVE' as const, failedChargeCount: 0, lastChargeError: null } : {}),
        ...(backToLife ? RESET_REMINDER_AND_GRACE_FIELDS : {}),
      },
    }),
    prisma.yearlyProgramSubscriptionEvent.create({
      data: {
        subscriptionId: id,
        type: 'admin_action',
        message: `Cohort moved by ${actorLabel}: ${sub.cohort?.name ?? 'none'} → ${targetCohort?.name ?? 'none'}${revive ? ' · GRACE → ACTIVE (revived)' : ''}`,
        metadata: {
          fromCohortId: sub.cohort?.id ?? null,
          toCohortId: body.cohortId,
          newExpiresAt: newExpiresAt?.toISOString() ?? null,
          revived: revive,
          graceFieldsReset: backToLife,
        },
      },
    }),
  ]);

  // Після коміту (HTTP-виклики до WFP не можна тримати всередині $transaction): переносимо
  // правило регулярки під дати нового набору. Без цього WFP продовжував би списувати за
  // графіком старого cohort-у. Помилка синку не валить перенос — він уже зафіксований у БД,
  // менеджер побачить outcome у відповіді й у логу підписки, а нічний cron звірить графік.
  let wfpSync: { outcome: string; reason: string | null; nextChargeAt: string | null; changed: boolean } | null = null;
  if (sub.plan === 'MONTHLY' && sub.autoRenew) {
    try {
      const r = await syncAutopaySchedule(id, { apply: true, source: 'move_cohort' });
      wfpSync = {
        outcome: r.outcome,
        reason: r.reason,
        nextChargeAt: r.nextChargeAt?.toISOString() ?? null,
        changed: r.changed,
      };
    } catch (e) {
      wfpSync = { outcome: 'error', reason: (e as Error).message.slice(0, 300), nextChargeAt: null, changed: false };
    }
    await prisma.yearlyProgramSubscriptionEvent.create({
      data: {
        subscriptionId: id,
        type: wfpSync.outcome === 'error' ? 'wfp_schedule_sync_failed' : 'admin_action',
        message: `Cohort move · WFP-графік: ${wfpSync.outcome}${wfpSync.reason ? ` (${wfpSync.reason.slice(0, 200)})` : ''}${wfpSync.nextChargeAt ? ` · наступне списання ${wfpSync.nextChargeAt.slice(0, 10)}` : ''}`,
        metadata: {
          source: 'move_cohort',
          toCohortId: body.cohortId,
          outcome: wfpSync.outcome,
          changed: wfpSync.changed,
        },
      },
    });
  }

  return NextResponse.json({ ok: true, revived: revive, newExpiresAt: newExpiresAt?.toISOString() ?? null, wfpSync });
}
