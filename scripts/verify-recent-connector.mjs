import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
config({ path: resolve(root, '.env'), override: true });

const prisma = new PrismaClient();

const order = await prisma.connectorOrder.findFirst({
  where: { email: 'shaposhnik.mcd@gmail.com' },
  orderBy: { createdAt: 'desc' },
});
console.log('Latest connector order:');
console.log(JSON.stringify(order, null, 2));

if (order?.orderReference) {
  const logs = await prisma.paymentCallbackLog.findMany({
    where: { orderReference: order.orderReference },
    orderBy: { createdAt: 'asc' },
    select: { id: true, createdAt: true, kind: true, transactionStatus: true, skipped: true, skipReason: true, actionsTaken: true },
  });
  console.log(`\nPaymentCallbackLog entries for ${order.orderReference}: ${logs.length}`);
  for (const l of logs) {
    console.log(`  - ${l.createdAt.toISOString()}  kind=${l.kind}  txStatus=${l.transactionStatus}  skipped=${l.skipped}${l.skipReason ? ' ('+l.skipReason+')' : ''}  actions=${JSON.stringify(l.actionsTaken)}`);
  }
}

await prisma.$disconnect();
