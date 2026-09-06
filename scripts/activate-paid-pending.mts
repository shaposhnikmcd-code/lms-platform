/// Одноразова РЕТРОАКТИВНА активація: PENDING-підписки Річної, які вже мають ≥1 PAID-платіж,
/// але «залипли» у PENDING (додані ручним флоу до уніфікації, коли ручна оплата тримала
/// PENDING до запуску). Ставить їм ACTIVE + startDate (найраніший paidAt, якщо порожній) +
/// перераховує expiresAt по cohort-логіці. Листів / SendPulse / Telegram НЕ шле — ТІЛЬКИ статуси.
///
/// Запуск (DEV branch за замовчуванням, як усі scripts/ через .env.local override):
///   node --import tsx scripts/activate-paid-pending.mts            (dry-run — лише таблиця)
///   node --import tsx scripts/activate-paid-pending.mts --execute  (застосувати на DEV)
/// ПРОД (свідома мутація) — прапор --prod: НЕ вантажимо .env.local, лишається .env (прод-URL,
/// який @prisma/client auto-load-ить). Комбінується з --execute:
///   node --import tsx scripts/activate-paid-pending.mts --prod              (dry-run проти прода)
///   node --import tsx scripts/activate-paid-pending.mts --prod --execute    (застосувати на проді)
/// Скрипт ЗАВЖДИ друкує host цільової БД перед роботою — щоб не сплутати dev/pre/prod.
///
/// ⚠️ НЕ використовує scripts/_db.mjs: той безумовно робить .env.local override (=завжди DEV),
/// тож не підтримав би --prod. Тут — умовне завантаження env.
///
/// ⚠️ Формулу доступу НЕ дублюємо: раніше тут лежало ручне дзеркало `calculateAccessUntil`,
/// яке встигло розійтись з оригіналом (не відсіювало `excludedFromAccess`) і рахувало людям
/// зайвий місяць. Тепер імпортуємо справжню функцію з lib/ — тому це .mts і запуск через tsx.
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const EXECUTE = process.argv.includes('--execute');
const USE_PROD = process.argv.includes('--prod');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (!USE_PROD) config({ path: resolve(root, '.env.local'), override: true });

// Динамічні імпорти: PrismaClient — щоб клієнт створився ПІСЛЯ підстановки dev-URL;
// lib/ — бо статичний named-import .ts з .mts Node не резолвить (tsx віддає CJS-модуль).
const { calculateAccessUntil } = await import('../lib/yearlyProgramAccess');
const { getYearlyPostAccessMonths } = await import('../lib/yearlyProgramConfig');
const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();

const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : '∅');

async function main() {
  const dbHost = (process.env.DATABASE_URL || '').match(/@([^/:?]+)/)?.[1] || 'unknown';
  console.log(`[activate-paid-pending] target DB host: ${dbHost} ${USE_PROD ? '(--prod)' : '(dev default)'} · mode: ${EXECUTE ? 'EXECUTE' : 'DRY-RUN'}`);

  const postAccessMonths = await getYearlyPostAccessMonths(prisma);

  const subs = await prisma.yearlyProgramSubscription.findMany({
    where: { status: 'PENDING', payments: { some: { status: 'PAID' } } },
    include: {
      user: { select: { email: true } },
      cohort: true,
      payments: {
        select: { amount: true, status: true, paidAt: true, createdAt: true, excludedFromAccess: true, manualMethod: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`\nЗнайдено PENDING-підписок з ≥1 PAID-платежем: ${subs.length}\n`);
  if (subs.length === 0) {
    await prisma.$disconnect();
    return;
  }

  const rows: {
    email: string; plan: string; status: string; startDate: string; expiresAt: string;
    _id: string; _newStartDate: Date | null; _newExpiresAt: Date | null;
  }[] = [];
  for (const s of subs) {
    const paid = s.payments.filter((p) => p.status === 'PAID');
    const earliestPaidAt = paid
      .map((p) => p.paidAt ?? p.createdAt)
      .sort((a, b) => a.getTime() - b.getTime())[0];
    const newExpiresAt = calculateAccessUntil({
      plan: s.plan as 'YEARLY' | 'MONTHLY',
      autoRenew: s.autoRenew,
      cohort: s.cohort ? { startDate: s.cohort.startDate, endDate: s.cohort.endDate } : null,
      payments: s.payments,
      postAccessMonths,
    });
    const newStartDate = s.startDate ?? earliestPaidAt ?? null;
    rows.push({
      email: s.user?.email ?? '∅',
      plan: s.plan,
      status: 'PENDING → ACTIVE',
      startDate: `${iso(s.startDate)} → ${iso(newStartDate)}`,
      expiresAt: `${iso(s.expiresAt)} → ${iso(newExpiresAt)}`,
      _id: s.id,
      _newStartDate: newStartDate,
      _newExpiresAt: newExpiresAt,
    });
  }

  console.table(rows.map(({ _id, _newStartDate, _newExpiresAt, ...view }) => view));

  if (!EXECUTE) {
    console.log('\nℹ️ DRY-RUN. Додай --execute щоб застосувати статуси (листи/SP/TG не чіпаються).');
    await prisma.$disconnect();
    return;
  }

  let updated = 0;
  for (const r of rows) {
    await prisma.yearlyProgramSubscription.update({
      where: { id: r._id },
      data: {
        status: 'ACTIVE',
        ...(r._newStartDate ? { startDate: r._newStartDate } : {}),
        expiresAt: r._newExpiresAt,
      },
    });
    await prisma.yearlyProgramSubscriptionEvent.create({
      data: {
        subscriptionId: r._id,
        type: 'admin_action',
        message: `Ретроактивна активація (PENDING→ACTIVE) by script · expiresAt=${iso(r._newExpiresAt)}`,
        metadata: { retroactiveActivate: true, script: 'activate-paid-pending' },
      },
    });
    updated++;
  }
  console.log(`\n✅ Активовано підписок: ${updated}. (Листи / SendPulse / Telegram НЕ надсилались.)`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
