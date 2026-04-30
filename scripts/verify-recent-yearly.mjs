import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
config({ path: resolve(root, '.env'), override: true });

const prisma = new PrismaClient();

const user = await prisma.user.findUnique({
  where: { email: 'shaposhnik.mcd@gmail.com' },
  select: { id: true },
});

const sub = await prisma.yearlyProgramSubscription.findFirst({
  where: { userId: user.id },
  orderBy: { createdAt: 'desc' },
  include: {
    payments: {
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: {
        id: true, orderReference: true, amount: true, status: true,
        paidAt: true, enrollmentsCompletedAt: true, sendpulseSentAt: true, provisionError: true,
      },
    },
    events: {
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { type: true, createdAt: true, message: true, metadata: true },
    },
  },
});
console.log('Latest YearlyProgramSubscription:');
console.log(JSON.stringify(sub, null, 2));

if (sub?.payments?.length) {
  const p = sub.payments[0];
  const logs = await prisma.paymentCallbackLog.findMany({
    where: { orderReference: p.orderReference },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, createdAt: true, kind: true, transactionStatus: true,
      skipped: true, skipReason: true, actionsTaken: true,
    },
  });
  console.log(`\nPaymentCallbackLog entries for ${p.orderReference}: ${logs.length}`);
  for (const l of logs) {
    console.log(`  - ${l.createdAt.toISOString()}  kind=${l.kind}  txStatus=${l.transactionStatus}  skipped=${l.skipped}  actions=${JSON.stringify(l.actionsTaken)}`);
  }
}

await prisma.$disconnect();
