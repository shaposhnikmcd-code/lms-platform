import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAdmin } from '@/lib/adminAuth';
import { calculateAccessUntil } from '@/lib/yearlyProgramAccess';

/// GET — деталі cohort-у з підписками й платежами для деталізованого view.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Немає доступу' }, { status: 403 });
  }
  const { id } = await params;
  const cohort = await prisma.yearlyProgramCohort.findUnique({
    where: { id },
    include: {
      subscriptions: {
        include: {
          user: { select: { id: true, name: true, email: true } },
          payments: { select: { id: true, amount: true, status: true, createdAt: true, paidAt: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  if (!cohort) {
    return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });
  }
  return NextResponse.json({
    id: cohort.id,
    name: cohort.name,
    startDate: cohort.startDate.toISOString(),
    endDate: cohort.endDate.toISOString(),
    launchedAt: cohort.launchedAt?.toISOString() ?? null,
    emailScheduledFor: cohort.emailScheduledFor?.toISOString() ?? null,
    emailSentAt: cohort.emailSentAt?.toISOString() ?? null,
    launchEmailSubject: cohort.launchEmailSubject,
    launchEmailBody: cohort.launchEmailBody,
    isCurrent: cohort.isCurrent,
  });
}

/// PATCH — редагування cohort-у. Якщо запущений (launchedAt set), startDate/endDate ще
/// можна редагувати — тоді перераховуємо expiresAt усіх підписок цього cohort-у.
/// makeCurrent=true → atomic переключає поточний cohort.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Немає доступу' }, { status: 403 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    startDate?: string;
    endDate?: string;
    makeCurrent?: boolean;
    launchEmailSubject?: string;
    launchEmailBody?: string;
  };

  const existing = await prisma.yearlyProgramCohort.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });
  }

  const startDate = body.startDate ? new Date(body.startDate) : existing.startDate;
  const endDate = body.endDate ? new Date(body.endDate) : existing.endDate;
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return NextResponse.json({ error: 'Невірний формат дат' }, { status: 400 });
  }
  if (endDate <= startDate) {
    return NextResponse.json({ error: 'Дата завершення має бути пізніше дати старту' }, { status: 400 });
  }

  const datesChanged = startDate.getTime() !== existing.startDate.getTime()
    || endDate.getTime() !== existing.endDate.getTime();

  await prisma.$transaction(async (tx) => {
    if (body.makeCurrent === true && !existing.isCurrent) {
      await tx.yearlyProgramCohort.updateMany({
        where: { isCurrent: true },
        data: { isCurrent: false },
      });
    }
    await tx.yearlyProgramCohort.update({
      where: { id },
      data: {
        name: body.name?.trim() ? body.name.trim() : undefined,
        startDate,
        endDate,
        isCurrent: body.makeCurrent === true ? true : undefined,
        launchEmailSubject: body.launchEmailSubject !== undefined ? body.launchEmailSubject : undefined,
        launchEmailBody: body.launchEmailBody !== undefined ? body.launchEmailBody : undefined,
      },
    });

    // Якщо дати змінились — перераховуємо expiresAt усіх ACTIVE/GRACE/PENDING підписок cohort-у.
    if (datesChanged) {
      const subs = await tx.yearlyProgramSubscription.findMany({
        where: {
          cohortId: id,
          status: { in: ['ACTIVE', 'GRACE', 'PENDING'] },
        },
        include: {
          payments: { select: { amount: true, status: true, paidAt: true, createdAt: true } },
        },
      });
      for (const s of subs) {
        const newExpires = calculateAccessUntil({
          plan: s.plan,
          autoRenew: s.autoRenew,
          cohort: { startDate, endDate },
          payments: s.payments,
        });
        if (newExpires && (!s.expiresAt || newExpires.getTime() !== s.expiresAt.getTime())) {
          await tx.yearlyProgramSubscription.update({
            where: { id: s.id },
            data: { expiresAt: newExpires },
          });
          await tx.yearlyProgramSubscriptionEvent.create({
            data: {
              subscriptionId: s.id,
              type: 'admin_action',
              message: `Cohort dates changed → expiresAt recomputed to ${newExpires.toISOString().slice(0, 10)}`,
              metadata: { reason: 'cohort_dates_changed', cohortId: id },
            },
          });
        }
      }
    }
  });

  return NextResponse.json({ ok: true });
}

/// DELETE — видалення cohort-у. Дозволено тільки якщо немає прив'язаних підписок або всі
/// з них ARCHIVED. SetNull на FK означає що при race-у підписки лишаться без cohort.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Немає доступу' }, { status: 403 });
  }
  const { id } = await params;
  const liveSubs = await prisma.yearlyProgramSubscription.count({
    where: {
      cohortId: id,
      status: { not: 'ARCHIVED' },
    },
  });
  if (liveSubs > 0) {
    return NextResponse.json(
      { error: `Cohort має ${liveSubs} активних підписок. Перенесіть їх в інший cohort або заархівуйте перед видаленням.` },
      { status: 400 },
    );
  }
  await prisma.yearlyProgramCohort.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
