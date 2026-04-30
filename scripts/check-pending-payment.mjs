import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
config({ path: resolve(root, '.env'), override: true });

const prisma = new PrismaClient();

const payment = await prisma.payment.findFirst({
  where: { user: { email: 'logoslv@gmail.com' }, status: 'PENDING' },
  select: {
    id: true,
    amount: true,
    status: true,
    createdAt: true,
    orderReference: true,
    user: { select: { email: true, name: true } },
  },
  orderBy: { createdAt: 'desc' },
});

if (!payment) {
  console.log('No pending payment for logoslv@gmail.com');
  process.exit(0);
}

console.log(`Payment: ${payment.id}`);
console.log(`  user: ${payment.user.email} (${payment.user.name})`);
console.log(`  amount: ${payment.amount}`);
console.log(`  status: ${payment.status}`);
console.log(`  createdAt: ${payment.createdAt.toISOString()}`);
console.log(`  orderReference: ${payment.orderReference}`);

const logs = await prisma.paymentCallbackLog.findMany({
  where: { orderReference: payment.orderReference },
  orderBy: { createdAt: 'asc' },
});

console.log(`\nCallback logs: ${logs.length}`);
for (const log of logs) {
  console.log(`\n  ${log.createdAt.toISOString()}  ${log.transactionStatus}  sig=${log.signatureValid}`);
  console.log(`    skipped=${log.skipped}  skipReason=${log.skipReason}`);
  console.log(`    actions=${log.actionsTaken ?? '-'}`);
  console.log(`    error=${log.error ? log.error.slice(0, 300) : '-'}`);
}

await prisma.$disconnect();
