import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAdmin, getAdminActor } from '@/lib/adminAuth';
import { sendCohortLaunchEmails } from '@/lib/yearlyProgramSendEmails';

/// «Дослати лист» — послідовна розсилка (Telegram-invite + Resend на кожного одержувача).
/// Це головна кнопка порятунку після часткового запуску: на дефолтному ліміті функції
/// платформа рубала її посеред циклу, без partial-звіту менеджеру. Fluid Compute-ліміт 300с.
export const maxDuration = 300;

/// Запас до `maxDuration`, за який цикл має завершитись штатно і встигнути віддати summary.
/// Далі `sendCohortLaunchEmails` переривається сам (interrupted), а решту добирає нічний
/// `heal_missing_welcome_email` — `emailSentAt` уже виставлений на старті розсилки.
const SEND_EMAILS_SOFT_DEADLINE_MARGIN_MS = 45_000;

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
  const startedAt = Date.now();
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
    // `emailSentAt: null` — обов'язково разом із плануванням. Cron шукає заплановані
    // розсилки умовою `emailScheduledFor <= now AND emailSentAt = null`, а таймстемп міг
    // лишитись від попереднього (обірваного) запуску з листом. Без скидання менеджер бачив
    // би «заплановано», а розсилки не сталося б ніколи.
    await prisma.yearlyProgramCohort.update({
      where: { id },
      data: { emailScheduledFor: at, emailSentAt: null },
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
    deadlineAt: new Date(startedAt + maxDuration * 1000 - SEND_EMAILS_SOFT_DEADLINE_MARGIN_MS),
  });

  return NextResponse.json({
    ok: true,
    summary: {
      total: summary.total,
      sent: summary.sent,
      skipped: summary.skipped,
      failed: summary.failed,
    },
    ...(summary.interrupted ? { interrupted: summary.interrupted } : {}),
    results: summary.results,
  });
}
