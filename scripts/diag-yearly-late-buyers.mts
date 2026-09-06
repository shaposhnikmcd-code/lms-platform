/// READ-ONLY діагностика: пізні покупці Річної (перша оплата вже ПІСЛЯ старту набору).
/// Показує, що їм дає нова сітка модулів проти того, що зараз записано в БД і у WFP.
/// Нічого не мутує — жодного update/create, тільки select-и.
///
/// Запуск:
///   node --import tsx scripts/diag-yearly-late-buyers.mts            (DEV branch, .env.local)
///   node --import tsx scripts/diag-yearly-late-buyers.mts --prod     (ПРОД, тільки читання)
///
/// ⚠️ tsx потрібен, бо скрипт імпортує справжні `monthlySchedule` / `cohortSlotIndex`
/// з lib/ — дублювати формулу доступу в скриптах заборонено (одна копія вже встигла
/// розійтись з оригіналом і рахувати людям зайвий місяць).
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const USE_PROD = process.argv.includes('--prod');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (!USE_PROD) config({ path: resolve(root, '.env.local'), override: true });

const { cohortModuleCount, cohortSlotIndex, monthlySchedule } = await import('../lib/yearlyProgramAccess');
const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();

const d = (v: Date | string | null | undefined) => (v ? new Date(v).toISOString().slice(0, 10) : '∅');

async function main() {
  const dbHost = (process.env.DATABASE_URL || '').match(/@([^/:?]+)/)?.[1] || 'unknown';
  console.log(`[diag-yearly-late-buyers] READ-ONLY · target DB host: ${dbHost} ${USE_PROD ? '(--prod)' : '(dev default)'}`);

  // Поточний набір — за прапорцем `isCurrent`, як його визначає адмінка і як у нього
  // потрапляють нові оплати. `createdAt desc` брав би щойно створений чернетковий
  // набір наступного року і показував би порожню таблицю замість живого набору.
  const select = { id: true, name: true, startDate: true, endDate: true, launchedAt: true };
  const cohort = (await prisma.yearlyProgramCohort.findFirst({ where: { isCurrent: true }, select }))
    ?? (await prisma.yearlyProgramCohort.findFirst({ orderBy: { startDate: 'desc' }, select }));
  if (!cohort) {
    console.log('Наборів немає — нічого діагностувати.');
    await prisma.$disconnect();
    return;
  }
  console.log(`Набір: ${cohort.name} · ${d(cohort.startDate)} → ${d(cohort.endDate)} · модулів: ${cohortModuleCount(cohort)} · запущено: ${d(cohort.launchedAt)}`);

  const subs = await prisma.yearlyProgramSubscription.findMany({
    where: {
      cohortId: cohort.id,
      plan: 'MONTHLY',
      status: { in: ['ACTIVE', 'GRACE', 'PENDING'] },
    },
    include: {
      user: { select: { email: true } },
      payments: {
        where: { status: 'PAID', excludedFromAccess: false },
        select: { amount: true, status: true, paidAt: true, createdAt: true, excludedFromAccess: true, manualMethod: true },
        orderBy: [{ paidAt: 'asc' }, { createdAt: 'asc' }],
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const rows = [];
  for (const s of subs) {
    if (s.payments.length === 0) continue;
    const firstPaidAt = s.payments[0].paidAt ?? s.payments[0].createdAt;
    // Пізній покупець — перша оплата вже після старту набору.
    if (firstPaidAt < cohort.startDate) continue;

    const schedule = monthlySchedule({ cohort, payments: s.payments });
    rows.push({
      email: s.user?.email ?? '∅',
      статус: s.status,
      план: s.autoRenew ? 'MONTHLY авто' : 'MONTHLY разова',
      'перша оплата': d(firstPaidAt),
      модуль: `${schedule.firstSlot + 1}`,
      слотів: schedule.totalSlots,
      сплачено: schedule.paidCount,
      'expiresAt зараз': d(s.expiresAt),
      'coveredUntil нове': d(schedule.coveredUntil),
      'WFP next зараз': d(s.wfpNextChargeAt),
      'dateNext нове': schedule.nextSlotStart ? d(schedule.nextSlotStart) : 'сплачено все',
    });
  }

  console.log(`\nПізніх покупців (перша оплата ≥ старту набору): ${rows.length}\n`);
  if (rows.length > 0) console.table(rows);

  // Поточний модуль набору — щоб адміністраторка бачила, з чим порівнювати.
  const nowSlot = cohortSlotIndex(cohort, new Date());
  console.log(`\nСьогодні йде модуль ${nowSlot + 1} з ${cohortModuleCount(cohort)}.`);
  console.log('Нічого не змінено — скрипт лише читає.');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
