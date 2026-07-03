// READONLY діагностика (прод): дати cohort-ів + стан MONTHLY/GRACE підписок.
// Свідомо читає .env (прод), НЕ .env.local. Жодних мутацій.
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
config({ path: resolve(root, '.env'), override: true });

const url = process.env.DATABASE_URL ?? '';
console.log('DB host:', url.match(/@([^/]+)\//)?.[1] ?? '???');

const prisma = new PrismaClient({ datasourceUrl: url });

const cohorts = await prisma.yearlyProgramCohort.findMany({
  select: {
    id: true, name: true, startDate: true, endDate: true,
    launchedAt: true, isCurrent: true,
    _count: { select: { subscriptions: true } },
  },
  orderBy: { startDate: 'asc' },
});
console.log('\n=== COHORTS ===');
for (const c of cohorts) {
  console.log(`${c.name} | start=${c.startDate.toISOString().slice(0, 10)} end=${c.endDate.toISOString().slice(0, 10)} | launchedAt=${c.launchedAt?.toISOString().slice(0, 10) ?? 'NULL'} | isCurrent=${c.isCurrent} | subs=${c._count.subscriptions}`);
}

const subs = await prisma.yearlyProgramSubscription.findMany({
  where: { status: { in: ['ACTIVE', 'GRACE', 'PENDING', 'EXPIRED'] } },
  select: {
    id: true, plan: true, autoRenew: true, status: true,
    startDate: true, expiresAt: true, cohortId: true,
    graceStartedAt: true, gracePeriodEndsAt: true, failedChargeCount: true,
    reminderSent3d: true, reminderSentOnExpiry: true, reminderSentGraceStart: true,
    user: { select: { email: true } },
    payments: { where: { status: 'PAID' }, select: { paidAt: true, amount: true } },
  },
  orderBy: { createdAt: 'asc' },
});
console.log(`\n=== SUBSCRIPTIONS (${subs.length}) ===`);
for (const s of subs) {
  const paid = s.payments.map((p) => `${p.paidAt?.toISOString().slice(0, 10)}(${p.amount}₴)`).join(', ');
  console.log(
    `${s.user?.email} | ${s.plan}${s.autoRenew ? '/auto' : ''} | ${s.status}` +
    ` | cohort=${s.cohortId ? 'yes' : 'NULL'} | expires=${s.expiresAt?.toISOString().slice(0, 10) ?? '—'}` +
    ` | graceEnds=${s.gracePeriodEndsAt?.toISOString().slice(0, 10) ?? '—'} | failed=${s.failedChargeCount ?? 0}` +
    ` | paid: ${paid}`,
  );
}

await prisma.$disconnect();
