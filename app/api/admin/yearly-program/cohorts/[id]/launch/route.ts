import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAdmin, getAdminActor } from '@/lib/adminAuth';
import { executeLaunchLoop } from '@/lib/yearlyProgramLaunch';
import { sendCohortLaunchEmails } from '@/lib/yearlyProgramSendEmails';
import { revalidateLocalized } from '@/lib/revalidatePaths';

/// 🚀 Запустити програму. Дія менеджера в адмінці. Об'єднує два кроки в один:
/// відкриття доступу + (опціонально) розсилка welcome-листа.
///
/// 1. Negайний запуск (`{}` або без `scheduledAt`):
///    a. Атомарно забирає `launchedAt = now()` (concurrency lock).
///    b. Знаходить усі підписки cohort-у з PAID-платежем.
///    c. Відкриває доступ у SendPulse (event → funnel) для кожної.
///    d. Перераховує expiresAt (cohort-aware).
///    e. Зберігає лог у YearlyProgramSubscriptionEvent (`access_opened`).
///    f. Якщо `sendWelcomeEmails: true` — одразу розсилає welcome-лист (sequential через
///       Resend, dedup по `launch_email_sent` event). Failure окремих листів не зриває launch.
///
/// 2. Запланований запуск (`{ scheduledAt: ISO, sendWelcomeEmails?: bool }`):
///    Виставляє `launchScheduledFor` без виконання роботи. Якщо `sendWelcomeEmails=true` —
///    одночасно виставляє `emailScheduledFor` на ту саму дату. Cron yearly-subscriptions
///    щодоби виконує спочатку launch, далі розсилку (порядок викликів у GET handler гарантує
///    обидва спрацюють у тому ж проході).
///
/// 3. Скасування запланованого (`{ cancelScheduled: true }`): чистить обидва таймстемпи.
///
/// 4. Retry для часткового запуску (`?retry=1`): пройти sub-loop ще раз для тих,
///    у кого sendpulseAccessOpenedAt все ще null. Ідемпотентно. Не торкається листів —
///    для повторної розсилки є окрема кнопка "Дослати лист" у CohortActions.
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
    /// При true (default ON у LaunchProgramModal) — після відкриття доступу одразу шле
    /// welcome-листи. Для запланованого launch виставляє `emailScheduledFor=scheduledAt`.
    sendWelcomeEmails?: boolean;
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
    // Розриваємо парну зв'язку: scheduled launch + scheduled email завжди узгоджені.
    await prisma.yearlyProgramCohort.update({
      where: { id },
      data: { launchScheduledFor: null, emailScheduledFor: null },
    });
    revalidateLocalized('/yearly-program');
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
      data: {
        launchScheduledFor: at,
        // Якщо менеджер хоче лист одночасно — плануємо на ту саму дату.
        // Якщо знімає галочку — чистимо попереднє планування (могло бути від попередніх дій).
        emailScheduledFor: body.sendWelcomeEmails ? at : null,
      },
    });
    revalidateLocalized('/yearly-program');
    return NextResponse.json({
      ok: true,
      mode: 'scheduled',
      launchScheduledFor: at.toISOString(),
      emailScheduledFor: body.sendWelcomeEmails ? at.toISOString() : null,
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
  const launchSummary = await executeLaunchLoop(
    { id, startDate: cohort.startDate, endDate: cohort.endDate },
    actorLabel,
  );

  // Опціональна розсилка welcome-листа одразу після відкриття доступу.
  // На retry емейли НЕ шлемо — це окрема дія через "Дослати лист".
  let emailSummary: Awaited<ReturnType<typeof sendCohortLaunchEmails>> | null = null;
  if (!isRetry && body.sendWelcomeEmails) {
    emailSummary = await sendCohortLaunchEmails(
      {
        id,
        name: cohort.name,
        startDate: cohort.startDate,
        endDate: cohort.endDate,
        launchEmailSubject: cohort.launchEmailSubject,
        launchEmailBody: cohort.launchEmailBody,
      },
      { actorLabel, source: 'launch' },
    );
  }

  revalidateLocalized('/yearly-program');
  return NextResponse.json({
    ok: true,
    mode: 'launched',
    launchedAt: cohort.launchedAt?.toISOString() ?? new Date().toISOString(),
    retry: isRetry,
    summary: {
      total: launchSummary.total,
      opened: launchSummary.opened,
      skipped: launchSummary.skipped,
      failed: launchSummary.failed,
    },
    results: launchSummary.results,
    emailSummary: emailSummary
      ? {
          total: emailSummary.total,
          sent: emailSummary.sent,
          skipped: emailSummary.skipped,
          failed: emailSummary.failed,
          /// Per-recipient результати — потрібні фронту для info-модалки з деталями помилок,
          /// коли частина листів не пішла (SMTP rate-limit, hard bounce тощо).
          results: emailSummary.results,
        }
      : null,
  });
}
