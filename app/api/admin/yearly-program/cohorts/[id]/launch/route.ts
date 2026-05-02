import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAdmin, getAdminActor } from '@/lib/adminAuth';
import { executeLaunchLoop } from '@/lib/yearlyProgramLaunch';

/// 🚀 Запустити програму. Дія менеджера в адмінці. Три режими:
///
/// 1. Negайний запуск (body порожній або без `scheduledAt`):
///    a. Атомарно забирає `launchedAt = now()` (concurrency lock).
///    b. Знаходить усі підписки cohort-у з PAID-платежем.
///    c. Відкриває доступ у SendPulse (event → funnel) для кожної.
///    d. Перераховує expiresAt (cohort-aware).
///    e. Зберігає лог у YearlyProgramSubscriptionEvent (`access_opened`).
///
/// 2. Запланований запуск ({ scheduledAt: ISO } у body):
///    Виставляє `launchScheduledFor` без виконання роботи. Cron yearly-subscriptions
///    щодоби перевіряє і виконує реальний запуск, коли launchScheduledFor <= now.
///
/// 3. Скасування запланованого ({ cancelScheduled: true }):
///    Очищує `launchScheduledFor` (якщо ще не виконано).
///
/// 4. Retry для часткового запуску (?retry=1): пройти sub-loop ще раз для тих,
///    у кого sendpulseAccessOpenedAt все ще null. Ідемпотентно.
///
/// Розсилка welcome-листа НЕ виконується тут — це окремий endpoint /send-emails.
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

  const url = new URL(req.url);
  const isRetry = url.searchParams.get('retry') === '1';

  const body = (await req.json().catch(() => ({}))) as {
    scheduledAt?: string;
    cancelScheduled?: boolean;
  };

  const cohort = await prisma.yearlyProgramCohort.findUnique({ where: { id } });
  if (!cohort) {
    return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });
  }

  // === Скасування запланованого запуску ===
  if (body.cancelScheduled) {
    if (cohort.launchedAt) {
      return NextResponse.json({ error: 'Програма вже запущена — скасувати неможливо' }, { status: 400 });
    }
    if (!cohort.launchScheduledFor) {
      return NextResponse.json({ error: 'Запланованого запуску немає' }, { status: 400 });
    }
    await prisma.yearlyProgramCohort.update({
      where: { id },
      data: { launchScheduledFor: null },
    });
    return NextResponse.json({ ok: true, mode: 'cancelled' });
  }

  // === Запланований запуск ===
  if (body.scheduledAt) {
    if (cohort.launchedAt) {
      return NextResponse.json({ error: 'Програма вже запущена' }, { status: 400 });
    }
    const at = new Date(body.scheduledAt);
    if (Number.isNaN(at.getTime())) {
      return NextResponse.json({ error: 'Невірний формат дати' }, { status: 400 });
    }
    if (at.getTime() <= Date.now()) {
      return NextResponse.json({ error: 'Дата запуску має бути у майбутньому' }, { status: 400 });
    }
    if (cohort.endDate.getTime() < at.getTime()) {
      return NextResponse.json({ error: 'Дата запуску після завершення cohort-у' }, { status: 400 });
    }
    await prisma.yearlyProgramCohort.update({
      where: { id },
      data: { launchScheduledFor: at },
    });
    return NextResponse.json({
      ok: true,
      mode: 'scheduled',
      launchScheduledFor: at.toISOString(),
    });
  }

  // === Негайний запуск (з concurrency lock + retry) ===
  // #14 Concurrency lock: атомарно забираємо launchedAt у одному запиті, щоб два паралельних
  // кліки не запустили роботу двічі. Перший виграє — другий бачить count=0 і отримує 409.
  // #15 Retry: для повторного запуску (?retry=1) cohort вже має launchedAt — пропускаємо claim;
  // sub-loop сам по собі ідемпотентний (skip-ить тих, у кого sendpulseAccessOpenedAt вже є).
  if (isRetry) {
    if (!cohort.launchedAt) {
      return NextResponse.json({ error: 'Cohort ще не запущено — використай звичайний запуск' }, { status: 400 });
    }
  } else {
    if (cohort.launchedAt) {
      return NextResponse.json({ error: 'Програма вже запущена' }, { status: 400 });
    }
    const claim = await prisma.yearlyProgramCohort.updateMany({
      where: { id, launchedAt: null },
      data: { launchedAt: new Date(), launchScheduledFor: null },
    });
    if (claim.count === 0) {
      return NextResponse.json({ error: 'Програма вже запущена або зараз запускається' }, { status: 409 });
    }
  }

  // launchedAt вже виставлений атомарним claim-ом вище (для першого запуску) або був раніше (retry).
  const summary = await executeLaunchLoop(
    { id, startDate: cohort.startDate, endDate: cohort.endDate },
    actorLabel,
  );

  return NextResponse.json({
    ok: true,
    mode: 'launched',
    launchedAt: cohort.launchedAt?.toISOString() ?? new Date().toISOString(),
    retry: isRetry,
    summary: { total: summary.total, opened: summary.opened, failed: summary.failed },
    results: summary.results,
  });
}
