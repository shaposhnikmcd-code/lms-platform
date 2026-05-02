import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
config({ path: resolve(root, '.env'), override: true });

const url = process.env.DATABASE_URL || '';
const host = url.match(/@([^/?]+)/)?.[1] || '?';
console.log(`\n=== TARGET DB: ${host} ===\n`);
if (!host.includes('ep-odd-night-alip82dn')) { console.error('not prod'); process.exit(1); }

const EXECUTE = process.argv.includes('--execute');
const prisma = new PrismaClient();

// 1) Логи без email AND без amount (invalid_signature шум)
const noData = await prisma.paymentCallbackLog.count({
  where: {
    AND: [
      { OR: [{ amount: null }, { amount: 0 }] },
      { OR: [{ clientEmail: null }, { clientEmail: '' }] },
    ],
  },
});

// 2) Orphan-логи: orderReference вказує на Payment-а, якого немає в БД (юзер видалений → cascade)
const allRefs = await prisma.paymentCallbackLog.findMany({
  where: { orderReference: { not: null } },
  select: { orderReference: true },
  distinct: ['orderReference'],
});
const refs = allRefs.map(r => r.orderReference).filter(Boolean);
const existingPay = await prisma.payment.findMany({
  where: { orderReference: { in: refs } },
  select: { orderReference: true },
});
const existingCO = await prisma.connectorOrder.findMany({
  where: { orderReference: { in: refs } },
  select: { orderReference: true },
});
const existingSet = new Set([...existingPay.map(p => p.orderReference), ...existingCO.map(o => o.orderReference)]);
const orphanRefs = refs.filter(r => !existingSet.has(r));
const orphanCount = orphanRefs.length
  ? await prisma.paymentCallbackLog.count({ where: { orderReference: { in: orphanRefs } } })
  : 0;

console.log(`Логи без email+amount: ${noData}`);
console.log(`Orphan-логи (orderRef без живого Payment/ConnectorOrder): ${orphanCount} (по ${orphanRefs.length} unique refs)`);

if (!EXECUTE) {
  console.log(`\nDRY-RUN. --execute щоб видалити.`);
  await prisma.$disconnect();
  process.exit(0);
}

await prisma.$transaction(async (tx) => {
  const r1 = await tx.paymentCallbackLog.deleteMany({
    where: {
      AND: [
        { OR: [{ amount: null }, { amount: 0 }] },
        { OR: [{ clientEmail: null }, { clientEmail: '' }] },
      ],
    },
  });
  console.log(`✅ no-email+no-amount deleted: ${r1.count}`);

  if (orphanRefs.length) {
    const r2 = await tx.paymentCallbackLog.deleteMany({ where: { orderReference: { in: orphanRefs } } });
    console.log(`✅ orphan logs deleted: ${r2.count}`);
  }
}, { timeout: 60000 });

await prisma.$disconnect();
