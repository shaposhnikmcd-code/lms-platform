// READ-ONLY one-off для тесту Річної програми на pre-prod.
// Явно вантажить .env (НЕ .env.local), щоб бити в прод-Neon.
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
config({ path: resolve(root, '.env'), override: true });

const prisma = new PrismaClient();

const emails = process.argv.slice(2);
if (emails.length === 0) {
  console.error('usage: node scripts/check-yearly-test.mjs <email1> [email2 ...]');
  process.exit(1);
}

for (const email of emails) {
  console.log(`\n=== ${email} ===`);
  const user = await prisma.user.findFirst({ where: { email, deletedAt: null } });
  if (!user) {
    console.log('  NO USER');
    continue;
  }
  console.log(`user.id=${user.id}  role=${user.role}  name=${user.name}`);

  const subs = await prisma.yearlyProgramSubscription.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      payments: { orderBy: { createdAt: 'asc' }, select: { id: true, orderReference: true, amount: true, status: true, createdAt: true } },
      events: { orderBy: { createdAt: 'asc' }, select: { type: true, message: true, createdAt: true } },
      cohort: { select: { id: true, name: true, isCurrent: true, launchedAt: true, startDate: true, endDate: true } },
    },
  });

  if (subs.length === 0) {
    console.log('  NO SUBSCRIPTIONS');
    continue;
  }

  for (const s of subs) {
    console.log(`\n  sub.id=${s.id}`);
    console.log(`    plan=${s.plan}  status=${s.status}  autoRenew=${s.autoRenew}`);
    console.log(`    createdAt=${s.createdAt?.toISOString()}`);
    console.log(`    expiresAt=${s.expiresAt?.toISOString() ?? 'null'}`);
    console.log(`    graceStartedAt=${s.graceStartedAt?.toISOString() ?? 'null'}`);
    console.log(`    gracePeriodEndsAt=${s.gracePeriodEndsAt?.toISOString() ?? 'null'}`);
    console.log(`    sendpulseStudentId=${s.sendpulseStudentId ?? 'null'}`);
    console.log(`    sendpulseAccessClosedAt=${s.sendpulseAccessClosedAt?.toISOString() ?? 'null'}`);
    console.log(`    recToken=${s.recToken ? 'SET (len=' + s.recToken.length + ')' : 'null'}`);
    console.log(`    failedChargeCount=${s.failedChargeCount ?? 0}`);
    console.log(`    cancelledAt=${s.cancelledAt?.toISOString() ?? 'null'}`);
    console.log(`    manuallyAddedAt=${s.manuallyAddedAt?.toISOString() ?? 'null'}`);
    console.log(`    reminders: 3d=${s.reminderSent3d} onExpiry=${s.reminderSentOnExpiry} graceStart=${s.reminderSentGraceStart} graceMid=${s.reminderSentGraceMid} graceLast=${s.reminderSentGraceLast} expired=${s.reminderSentExpired}`);
    if (s.cohort) {
      console.log(`    cohort: ${s.cohort.name}  isCurrent=${s.cohort.isCurrent}  launchedAt=${s.cohort.launchedAt?.toISOString() ?? 'null'}`);
    } else {
      console.log(`    cohort: null`);
    }
    console.log(`    payments (${s.payments.length}):`);
    for (const p of s.payments) {
      console.log(`      ${p.createdAt.toISOString()}  ${p.orderReference}  ${p.amount}₴  status=${p.status}`);
    }
    console.log(`    events (${s.events.length}):`);
    for (const e of s.events) {
      console.log(`      ${e.createdAt.toISOString()}  ${e.type}  ${e.message ?? ''}`);
    }
  }
}

await prisma.$disconnect();
