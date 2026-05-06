import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAdmin, getAdminActor } from '@/lib/adminAuth';
import { sendCohortLaunchEmails } from '@/lib/yearlyProgramSendEmails';

/// POST — запустити welcome-розсилку для cohort-у.
/// Body:
///   { mode: 'now' }                  → шле всім негайно (sequential)
///   { mode: 'schedule', at: ISOdate } → ставить emailScheduledFor; cron обробить пізніше
///   { mode: 'schedule', cancel: true } → скасувати запланований emailScheduledFor
///
/// Шле тільки тим, хто ще не отримав (subscription.events не містить
/// `launch_email_sent_<cohortId>`). Дублі при ретраї виключені.
///
/// Per-recipient resend (`subscriptionIds: [...]`) автоматично ігнорує dedup —
/// менеджер свідомо повторює.
///
/// Bulk override (`force: true`) — повторна розсилка цілому cohort-у з ігноруванням dedup.
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
  const body = (await req.json().catch(() => ({}))) as {
    mode?: 'now' | 'schedule';
    at?: string;
    subscriptionIds?: string[];
    force?: boolean;
    cancel?: boolean;
  };

  const cohort = await prisma.yearlyProgramCohort.findUnique({ where: { id } });
  if (!cohort) {
    return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });
  }

  if (body.mode === 'schedule') {
    if (body.subscriptionIds || body.force) {
      return NextResponse.json({ error: 'Планування підтримує лише повну розсилку cohort-у' }, { status: 400 });
    }
    if (body.cancel) {
      await prisma.yearlyProgramCohort.update({
        where: { id },
        data: { emailScheduledFor: null },
      });
      return NextResponse.json({ ok: true, cancelled: true });
    }
    if (!body.at) {
      return NextResponse.json({ error: 'Дата планування обов\'язкова' }, { status: 400 });
    }
    const at = new Date(body.at);
    if (Number.isNaN(at.getTime())) {
      return NextResponse.json({ error: 'Невірний формат дати' }, { status: 400 });
    }
    await prisma.yearlyProgramCohort.update({
      where: { id },
      data: { emailScheduledFor: at },
    });
    return NextResponse.json({ ok: true, scheduledFor: at.toISOString() });
  }

  // mode = now — відправляємо одразу.
  const targetIds = Array.isArray(body.subscriptionIds) && body.subscriptionIds.length > 0
    ? body.subscriptionIds
    : null;

  const summary = await sendCohortLaunchEmails(cohort, {
    force: body.force === true,
    targetIds,
    actorLabel,
    source: 'manager',
  });

  return NextResponse.json({
    ok: true,
    summary: {
      total: summary.total,
      sent: summary.sent,
      skipped: summary.skipped,
      failed: summary.failed,
    },
    results: summary.results,
  });
}
