import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAdmin } from '@/lib/adminAuth';
import { revalidateLocalized } from '@/lib/revalidatePaths';
import { calculateAccessUntil } from '@/lib/yearlyProgramAccess';
import { getYearlyPostAccessMonths, RESET_REMINDER_AND_GRACE_FIELDS } from '@/lib/yearlyProgramConfig';
import { syncAutopaySchedule } from '@/lib/yearlyProgramScheduleSync';
import {
  normalizeCohortEndDate,
  validateCohortSchedule,
  DEFAULT_LAUNCH_EMAIL_BODY,
  DEFAULT_LAUNCH_EMAIL_SUBJECT,
} from '@/lib/yearlyProgramCohort';

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
  const rawEndDate = body.endDate ? new Date(body.endDate) : existing.endDate;
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(rawEndDate.getTime())) {
    return NextResponse.json({ error: 'Невірний формат дат' }, { status: 400 });
  }
  // Останній день набору зараховується цілком (23:59:59.999 UTC). Нормалізуємо і збережені
  // рядки теж — старі cohort-и лежать з 00:00 і через це втрачали останній місячний слот.
  const endDate = normalizeCohortEndDate(rawEndDate);
  if (endDate <= startDate) {
    return NextResponse.json({ error: 'Дата завершення має бути пізніше дати старту' }, { status: 400 });
  }

  // Порівнюємо НОРМАЛІЗОВАНІ значення з обох боків. Інакше збережений legacy-рядок
  // (endDate о 00:00) завжди «відрізнявся» б від нормалізованого 23:59:59.999 — і будь-яка
  // правка назви/листа/прапорця «Поточний» вважалась би зміною дат: 400 на наборах із
  // періодом ≠ 9 слотів + перерахунок усіх підписок + масовий CHANGE у WFP.
  const datesChanged = startDate.getTime() !== existing.startDate.getTime()
    || endDate.getTime() !== normalizeCohortEndDate(existing.endDate).getTime();

  // Валідуємо лише коли дати справді змінюються: правка назви/листа в legacy-наборі
  // з «неправильним» періодом не має падати в 400.
  if (datesChanged) {
    const scheduleError = validateCohortSchedule(startDate, endDate);
    if (scheduleError) {
      return NextResponse.json({ error: scheduleError }, { status: 400 });
    }
  }

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

  // У транзакції — ТІЛЬКИ сам cohort (2 короткі запити). Перерахунок підписок винесено
  // за її межі: на 150+ підписках по 2 запити кожна interactive-транзакція впиралась у
  // 5-секундний timeout Prisma (P2028) і відкочувала вже збережені дати — менеджер
  // бачив помилку, хоча правка була коректна.
  const updated = await prisma.$transaction(async (tx) => {
    if (body.makeCurrent === true && !existing.isCurrent) {
      await tx.yearlyProgramCohort.updateMany({
        where: { isCurrent: true },
        data: { isCurrent: false },
      });
    }
    return tx.yearlyProgramCohort.update({
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
  });

  // Зміна isCurrent / dates впливає на публічну сторінку → інвалідуємо ISR-кеш.
  revalidateLocalized('/yearly-program');

  // Дати вже збережені. Перераховуємо expiresAt усіх ACTIVE/GRACE/PENDING підписок
  // cohort-у батчами по 25: кожен батч — окрема коротка транзакція (апдейти + createMany
  // подій). Фейл батчу логуємо і йдемо далі — краще частковий перерахунок з чесним
  // звітом, ніж відкат правки дат.
  const RECALC_BATCH_SIZE = 25;
  const recalc = { scanned: 0, recalculated: 0, failed: 0 };
  if (datesChanged) {
    const postAccessMonths = await getYearlyPostAccessMonths(prisma);
    const now = new Date();
    const subs = await prisma.yearlyProgramSubscription.findMany({
      where: {
        cohortId: id,
        status: { in: ['ACTIVE', 'GRACE', 'PENDING'] },
      },
      include: {
        payments: { select: { amount: true, status: true, paidAt: true, createdAt: true } },
      },
    });
    recalc.scanned = subs.length;

    // Кандидати на WFP-синк — усі автоплатіжні cohort-у, незалежно від того, чи
    // змінився їхній expiresAt (графік у WFP міг розійтись і без зміни доступу).
    for (const s of subs) {
      if (s.plan === 'MONTHLY' && s.autoRenew) autopaySubIds.push(s.id);
    }

    // Готуємо зміни в пам'яті (без запитів), щоб батч тримав БД мінімальний час.
    const pending = subs.flatMap((s) => {
      const newExpires = calculateAccessUntil({
        plan: s.plan,
        autoRenew: s.autoRenew,
        cohort: { startDate, endDate },
        payments: s.payments,
        postAccessMonths,
      });
      if (!newExpires || (s.expiresAt && newExpires.getTime() === s.expiresAt.getTime())) return [];
      // Якщо новий expiresAt у майбутньому — підписка більше не протермінована:
      // GRACE повертаємо в ACTIVE, скидаємо grace-дати і спожиті прапори нагадувань,
      // щоб цикл попереджень коректно відпрацював уже для НОВОЇ дати завершення.
      // (Кейс: cohort-у виправили дату старту з минулої на майбутню — підписки, яких
      // cron встиг штовхнути в GRACE через стару дату, мають ожити без ручних дій.)
      const backToLife = newExpires > now;
      const revive = backToLife && s.status === 'GRACE';
      return [{ id: s.id, newExpires, backToLife, revive }];
    });

    for (let i = 0; i < pending.length; i += RECALC_BATCH_SIZE) {
      const batch = pending.slice(i, i + RECALC_BATCH_SIZE);
      const writes = batch.map((p) => prisma.yearlyProgramSubscription.update({
        where: { id: p.id },
        data: {
          expiresAt: p.newExpires,
          // Revive = «звинувачення» у простроченні знято разом зі старою датою:
          // скидаємо і лічильник невдалих списань, інакше наступний цикл одразу
          // пропустить autopay-буфер і надішле «charge failed»-шаблон без реальної відмови.
          ...(p.revive ? { status: 'ACTIVE' as const, failedChargeCount: 0, lastChargeError: null } : {}),
          ...(p.backToLife ? RESET_REMINDER_AND_GRACE_FIELDS : {}),
        },
      }));
      try {
        await prisma.$transaction([
          ...writes,
          prisma.yearlyProgramSubscriptionEvent.createMany({
            data: batch.map((p) => ({
              subscriptionId: p.id,
              type: 'admin_action',
              message: `Cohort dates changed → expiresAt recomputed to ${p.newExpires.toISOString().slice(0, 10)}${p.revive ? ' · GRACE → ACTIVE (revived)' : ''}`,
              metadata: { reason: 'cohort_dates_changed', cohortId: id },
            })),
          }),
        ]);
        recalc.recalculated += batch.length;
      } catch (e) {
        recalc.failed += batch.length;
        console.error(
          `[cohort ${id}] recalc batch ${i / RECALC_BATCH_SIZE + 1} failed (${batch.length} підписок): ${(e as Error).message}`,
          batch.map((p) => p.id),
        );
      }
    }
  }

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
    // Дати збережені завжди; тут — чесний звіт по перерахунку підписок.
    recalculated: datesChanged ? recalc.recalculated : null,
    failed: datesChanged ? recalc.failed : null,
    scanned: datesChanged ? recalc.scanned : null,
    ...(recalc.failed > 0
      ? { warning: `Дати збережено, але ${recalc.failed} із ${recalc.scanned} підписок не перерахувались — повторіть збереження або перевірте лог.` }
      : {}),
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
