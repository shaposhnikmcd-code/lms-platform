import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAdmin } from '@/lib/adminAuth';
import { revalidateLocalized } from '@/lib/revalidatePaths';
import { calculateAccessUntil } from '@/lib/yearlyProgramAccess';
import { getYearlyPostAccessMonths, RESET_REMINDER_AND_GRACE_FIELDS } from '@/lib/yearlyProgramConfig';
import { syncAutopaySchedule } from '@/lib/yearlyProgramScheduleSync';
import { DEFAULT_LAUNCH_EMAIL_BODY, DEFAULT_LAUNCH_EMAIL_SUBJECT } from '@/lib/yearlyProgramCohort';

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

  // Welcome-лист: порожній рядок або null трактуємо як «скинути до дефолту» — записуємо
  // канонічний текст з коду, щоб менеджер не отримав порожнього листа в адмінці й щоб
  // подальші правки порівнювались з відомою точкою відліку.
  const launchEmailSubject =
    body.launchEmailSubject === undefined
      ? undefined
      : (body.launchEmailSubject?.trim() ? body.launchEmailSubject : DEFAULT_LAUNCH_EMAIL_SUBJECT);
  const launchEmailBody =
    body.launchEmailBody === undefined
      ? undefined
      : (body.launchEmailBody?.trim() ? body.launchEmailBody : DEFAULT_LAUNCH_EMAIL_BODY);

  // Автоплатіжні підписки cohort-у, чиї WFP-графіки треба синхронізувати ПІСЛЯ
  // коміту транзакції (HTTP-виклики до WFP не можна тримати всередині $transaction).
  const autopaySubIds: string[] = [];

  const updated = await prisma.$transaction(async (tx) => {
    if (body.makeCurrent === true && !existing.isCurrent) {
      await tx.yearlyProgramCohort.updateMany({
        where: { isCurrent: true },
        data: { isCurrent: false },
      });
    }
    const u = await tx.yearlyProgramCohort.update({
      where: { id },
      data: {
        name: body.name?.trim() ? body.name.trim() : undefined,
        startDate,
        endDate,
        isCurrent: body.makeCurrent === true ? true : undefined,
        launchEmailSubject,
        launchEmailBody,
      },
    });

    // Якщо дати змінились — перераховуємо expiresAt усіх ACTIVE/GRACE/PENDING підписок cohort-у.
    if (datesChanged) {
      const postAccessMonths = await getYearlyPostAccessMonths(tx);
      const now = new Date();
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
          postAccessMonths,
        });
        if (newExpires && (!s.expiresAt || newExpires.getTime() !== s.expiresAt.getTime())) {
          // Якщо новий expiresAt у майбутньому — підписка більше не протермінована:
          // GRACE повертаємо в ACTIVE, скидаємо grace-дати і спожиті прапори нагадувань,
          // щоб цикл попереджень коректно відпрацював уже для НОВОЇ дати завершення.
          // (Кейс: cohort-у виправили дату старту з минулої на майбутню — підписки, яких
          // cron встиг штовхнути в GRACE через стару дату, мають ожити без ручних дій.)
          const backToLife = newExpires > now;
          const revive = backToLife && s.status === 'GRACE';
          await tx.yearlyProgramSubscription.update({
            where: { id: s.id },
            data: {
              expiresAt: newExpires,
              // Revive = «звинувачення» у простроченні знято разом зі старою датою:
              // скидаємо і лічильник невдалих списань, інакше наступний цикл одразу
              // пропустить autopay-буфер і надішле «charge failed»-шаблон без реальної відмови.
              ...(revive ? { status: 'ACTIVE', failedChargeCount: 0, lastChargeError: null } : {}),
              ...(backToLife ? RESET_REMINDER_AND_GRACE_FIELDS : {}),
            },
          });
          await tx.yearlyProgramSubscriptionEvent.create({
            data: {
              subscriptionId: s.id,
              type: 'admin_action',
              message: `Cohort dates changed → expiresAt recomputed to ${newExpires.toISOString().slice(0, 10)}${revive ? ' · GRACE → ACTIVE (revived)' : ''}`,
              metadata: { reason: 'cohort_dates_changed', cohortId: id },
            },
          });
        }
        // Кандидати на WFP-синк — усі автоплатіжні cohort-у, незалежно від того, чи
        // змінився їхній expiresAt (графік у WFP міг розійтись і без зміни доступу).
        if (s.plan === 'MONTHLY' && s.autoRenew) {
          autopaySubIds.push(s.id);
        }
      }
    }

    return u;
  });

  // Зміна isCurrent / dates впливає на публічну сторінку → інвалідуємо ISR-кеш.
  revalidateLocalized('/yearly-program');

  // Після коміту: переносимо WFP-графіки автосписань під нові дати. Кожен виклик сам
  // пише подію в лог підписки; помилка одного не зупиняє решту і не валить PATCH.
  const wfpSync = { synced: 0, checked: 0, noRule: 0, skipped: 0, failed: 0 };
  for (const subId of autopaySubIds) {
    try {
      const r = await syncAutopaySchedule(subId, { apply: true, source: 'cohort_dates_changed' });
      if (r.outcome === 'synced') wfpSync.synced++;
      else if (r.outcome === 'checked') wfpSync.checked++;
      else if (r.outcome === 'no_rule') wfpSync.noRule++;
      else if (r.outcome === 'skipped') wfpSync.skipped++;
      else wfpSync.failed++;
    } catch {
      wfpSync.failed++;
    }
  }

  return NextResponse.json({
    ok: true,
    launchEmailSubject: updated.launchEmailSubject,
    launchEmailBody: updated.launchEmailBody,
    wfpSync: autopaySubIds.length > 0 ? wfpSync : null,
  });
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
  revalidateLocalized('/yearly-program');
  return NextResponse.json({ ok: true });
}
