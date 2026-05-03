import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAdmin } from '@/lib/adminAuth';
import { revalidateLocalized } from '@/lib/revalidatePaths';
import { getDefaultCohortValues, DEFAULT_LAUNCH_EMAIL_BODY, DEFAULT_LAUNCH_EMAIL_SUBJECT } from '@/lib/yearlyProgramCohort';

/// GET — список усіх cohort-ів (Річних програм) з агрегованими лічильниками підписок.
/// Сортовано за startDate DESC. Поточний (`isCurrent=true`) — позначено окремим прапором.
export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Немає доступу' }, { status: 403 });
  }

  const cohorts = await prisma.yearlyProgramCohort.findMany({
    orderBy: { startDate: 'desc' },
  });

  // Лічильники підписок по cohort-у одним groupBy.
  const counts = await prisma.yearlyProgramSubscription.groupBy({
    by: ['cohortId'],
    _count: { _all: true },
  });
  const countByCohort = new Map<string | null, number>();
  for (const c of counts) {
    countByCohort.set(c.cohortId, c._count._all);
  }

  return NextResponse.json({
    cohorts: cohorts.map((c) => ({
      id: c.id,
      name: c.name,
      startDate: c.startDate.toISOString(),
      endDate: c.endDate.toISOString(),
      launchedAt: c.launchedAt?.toISOString() ?? null,
      emailScheduledFor: c.emailScheduledFor?.toISOString() ?? null,
      emailSentAt: c.emailSentAt?.toISOString() ?? null,
      launchEmailSubject: c.launchEmailSubject,
      launchEmailBody: c.launchEmailBody,
      isCurrent: c.isCurrent,
      subscriptionsCount: countByCohort.get(c.id) ?? 0,
      createdAt: c.createdAt.toISOString(),
    })),
  });
}

/// POST — створення нового cohort-у. Body: { name?, startDate, endDate, makeCurrent? }.
/// Якщо `makeCurrent=true` (default true для першого cohort, false якщо вже є) — нове cohort
/// стає поточним, попередній автоматично знімається з isCurrent (atomic transaction).
export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Немає доступу' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    startDate?: string;
    endDate?: string;
    makeCurrent?: boolean;
    launchEmailSubject?: string;
    launchEmailBody?: string;
  };

  const defaults = getDefaultCohortValues();
  const startDate = body.startDate ? new Date(body.startDate) : defaults.startDate;
  const endDate = body.endDate ? new Date(body.endDate) : defaults.endDate;

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return NextResponse.json({ error: 'Невірний формат дат' }, { status: 400 });
  }
  if (endDate <= startDate) {
    return NextResponse.json({ error: 'Дата завершення має бути пізніше дати старту' }, { status: 400 });
  }

  const name = (body.name ?? '').trim() || `Річна програма ${startDate.getFullYear()}`;
  const subject = body.launchEmailSubject?.trim() || DEFAULT_LAUNCH_EMAIL_SUBJECT;
  const launchBody = body.launchEmailBody?.trim() || DEFAULT_LAUNCH_EMAIL_BODY;

  // Якщо ще немає жодного cohort — новий стає поточним за замовчуванням.
  const existingCount = await prisma.yearlyProgramCohort.count();
  const makeCurrent = body.makeCurrent ?? existingCount === 0;

  // Atomic: якщо makeCurrent — спочатку знімаємо isCurrent з усіх інших.
  const created = await prisma.$transaction(async (tx) => {
    if (makeCurrent) {
      await tx.yearlyProgramCohort.updateMany({
        where: { isCurrent: true },
        data: { isCurrent: false },
      });
    }
    return tx.yearlyProgramCohort.create({
      data: {
        name,
        startDate,
        endDate,
        isCurrent: makeCurrent,
        launchEmailSubject: subject,
        launchEmailBody: launchBody,
      },
    });
  });

  // Публічна `/yearly-program` гейтить кнопки оплати на наявності isCurrent cohort-у —
  // інвалідуємо ISR-кеш, щоб новий cohort одразу відкрив реєстрацію без 1h затримки.
  revalidateLocalized('/yearly-program');

  return NextResponse.json({
    id: created.id,
    name: created.name,
    startDate: created.startDate.toISOString(),
    endDate: created.endDate.toISOString(),
    isCurrent: created.isCurrent,
  });
}
