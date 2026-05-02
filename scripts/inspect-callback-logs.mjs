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

const prisma = new PrismaClient();

// 1) Логи без email/amount
const noData = await prisma.paymentCallbackLog.findMany({
  where: {
    AND: [
      { OR: [{ amount: null }, { amount: 0 }] },
      { OR: [{ clientEmail: null }, { clientEmail: '' }] },
    ],
  },
  orderBy: { createdAt: 'desc' },
});
console.log(`\n--- Логи БЕЗ email AND БЕЗ amount: ${noData.length} ---`);
for (const l of noData) {
  console.log(`\n[${l.id}] ${l.createdAt.toISOString()}`);
  console.log(`  source=${l.source} kind=${l.kind} status=${l.transactionStatus} signatureValid=${l.signatureValid}`);
  console.log(`  orderRef=${l.orderReference} amount=${l.amount} email=${l.clientEmail}`);
  console.log(`  ip=${l.ip} ua=${(l.userAgent || '').slice(0, 80)}`);
  console.log(`  skipped=${l.skipped} skipReason=${l.skipReason}`);
  console.log(`  actionsTaken=${l.actionsTaken}`);
  console.log(`  error=${l.error}`);
  console.log(`  rawPayload=${JSON.stringify(l.rawPayload).slice(0, 300)}`);
}

// 2) Все по email ds.dreamstories@gmail.com
const dsLogs = await prisma.paymentCallbackLog.findMany({
  where: { clientEmail: 'ds.dreamstories@gmail.com' },
  orderBy: { createdAt: 'desc' },
});
console.log(`\n\n--- Callback logs для ds.dreamstories@gmail.com: ${dsLogs.length} ---`);
for (const l of dsLogs) {
  console.log(`\n[${l.id}] ${l.createdAt.toISOString()}`);
  console.log(`  source=${l.source} kind=${l.kind} status=${l.transactionStatus} amount=${l.amount}`);
  console.log(`  orderRef=${l.orderReference}`);
  console.log(`  signatureValid=${l.signatureValid} skipped=${l.skipped} skipReason=${l.skipReason}`);
  console.log(`  prevStatus=${l.prevStatus} actionsTaken=${l.actionsTaken}`);
  console.log(`  error=${l.error}`);
}

const dsPayments = await prisma.payment.findMany({
  where: { user: { email: 'ds.dreamstories@gmail.com' } },
  select: { id: true, orderReference: true, amount: true, status: true, createdAt: true, courseId: true, bundleId: true, yearlyProgramSubscriptionId: true },
  orderBy: { createdAt: 'desc' },
});
console.log(`\n\n--- Payment-и для ds.dreamstories@gmail.com: ${dsPayments.length} ---`);
for (const p of dsPayments) {
  console.log(`  ${p.orderReference} | ${p.amount}₴ | ${p.status} | ${p.createdAt.toISOString().slice(0, 10)}`);
}

const dsUser = await prisma.user.findFirst({
  where: { email: 'ds.dreamstories@gmail.com' },
  select: { id: true, email: true, role: true, createdAt: true, name: true },
});
console.log(`\n\n--- User ds.dreamstories@gmail.com:`, dsUser);

await prisma.$disconnect();
