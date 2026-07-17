// Одноразова РЕТРОАКТИВНА активація: PENDING-підписки Річної, які вже мають ≥1 PAID-платіж,
// але «залипли» у PENDING (додані ручним флоу до уніфікації, коли ручна оплата тримала
// PENDING до запуску). Ставить їм ACTIVE + startDate (найраніший paidAt, якщо порожній) +
// перераховує expiresAt по cohort-логіці. Листів / SendPulse / Telegram НЕ шле — ТІЛЬКИ статуси.
//
// Запуск (DEV branch за замовчуванням, як усі scripts/ через .env.local override):
//   node scripts/activate-paid-pending.mjs            (dry-run — лише таблиця, нічого не пише)
//   node scripts/activate-paid-pending.mjs --execute  (застосувати на DEV)
// ПРОД (свідома мутація) — прапор --prod: НЕ вантажимо .env.local, лишається .env (прод-URL,
// який @prisma/client auto-load-ить). Комбінується з --execute:
//   node scripts/activate-paid-pending.mjs --prod              (dry-run проти прода)
//   node scripts/activate-paid-pending.mjs --prod --execute    (застосувати на проді)
// Скрипт ЗАВЖДИ друкує host цільової БД перед роботою — щоб не сплутати dev/pre/prod.
//
// ⚠️ НЕ використовує scripts/_db.mjs: той безумовно робить .env.local override (=завжди DEV),
// тож не підтримав би --prod. Тут — умовне завантаження env за зразком backfillNewsTranslations.mjs.
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const EXECUTE = process.argv.includes('--execute');
const USE_PROD = process.argv.includes('--prod');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (!USE_PROD) config({ path: resolve(root, '.env.local'), override: true });
const prisma = new PrismaClient();

// ── Дзеркало lib/yearlyProgramConfig.ts (константи) ──────────────────────────────
const TOTAL_MONTHLY_PAYMENTS = 9;
const YEARLY_DURATION_DAYS = 365;
const MONTHLY_DURATION_DAYS = 30;
const DEFAULT_POST_ACCESS_MONTHS = 6;
const POST_ACCESS_SETTING_KEY = 'yearlyPostAccessMonths';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ── Дзеркало lib/yearlyProgramAccess.ts (addCalendarMonths + calculateAccessUntil) ──
function addCalendarMonths(date, months) {
  if (!months) return new Date(date);
  const day = date.getDate();
  const result = new Date(date);
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDayOfTarget = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDayOfTarget));
  return result;
}

function paidPaymentDates(payments) {
  return payments
    .filter((p) => p.status === 'PAID')
    .map((p) => p.paidAt ?? p.createdAt)
    .sort((a, b) => a.getTime() - b.getTime());
}

function calculateAccessUntil({ plan, cohort, payments, postAccessMonths }) {
  const paymentDates = paidPaymentDates(payments);
  if (paymentDates.length === 0) return null;

  if (!cohort) {
    const last = paymentDates[paymentDates.length - 1];
    const days = plan === 'YEARLY' ? YEARLY_DURATION_DAYS : MONTHLY_DURATION_DAYS;
    return new Date(last.getTime() + days * MS_PER_DAY);
  }

  const months = postAccessMonths ?? 0;
  const accessEnd = addCalendarMonths(cohort.endDate, months);
  if (plan === 'YEARLY') return accessEnd;

  const firstPaid = paymentDates[0];
  const cohortStart = cohort.startDate;
  const cohortEnd = cohort.endDate;
  const paidCount = paymentDates.length;
  if (paidCount >= TOTAL_MONTHLY_PAYMENTS) return accessEnd;

  const anchor = firstPaid < cohortStart ? cohortStart : firstPaid;
  const expires = addCalendarMonths(anchor, paidCount);
  if (expires > cohortEnd) return cohortEnd;
  return expires;
}

async function getPostAccessMonths() {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: POST_ACCESS_SETTING_KEY } });
    return row?.value ?? DEFAULT_POST_ACCESS_MONTHS;
  } catch {
    return DEFAULT_POST_ACCESS_MONTHS;
  }
}

const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '∅');

async function main() {
  const dbHost = (process.env.DATABASE_URL || '').match(/@([^/:?]+)/)?.[1] || 'unknown';
  console.log(`[activate-paid-pending] target DB host: ${dbHost} ${USE_PROD ? '(--prod)' : '(dev default)'} · mode: ${EXECUTE ? 'EXECUTE' : 'DRY-RUN'}`);

  const postAccessMonths = await getPostAccessMonths();

  const subs = await prisma.yearlyProgramSubscription.findMany({
    where: { status: 'PENDING', payments: { some: { status: 'PAID' } } },
    include: {
      user: { select: { email: true } },
      cohort: true,
      payments: { select: { amount: true, status: true, paidAt: true, createdAt: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`\nЗнайдено PENDING-підписок з ≥1 PAID-платежем: ${subs.length}\n`);
  if (subs.length === 0) {
    await prisma.$disconnect();
    return;
  }

  const rows = [];
  for (const s of subs) {
    const paid = s.payments.filter((p) => p.status === 'PAID');
    const earliestPaidAt = paid
      .map((p) => p.paidAt ?? p.createdAt)
      .sort((a, b) => a.getTime() - b.getTime())[0];
    const newExpiresAt = calculateAccessUntil({
      plan: s.plan,
      cohort: s.cohort ? { startDate: s.cohort.startDate, endDate: s.cohort.endDate } : null,
      payments: s.payments,
      postAccessMonths,
    });
    const newStartDate = s.startDate ?? earliestPaidAt ?? null;
    rows.push({
      email: s.user?.email ?? '∅',
      plan: s.plan,
      status: `PENDING → ACTIVE`,
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
