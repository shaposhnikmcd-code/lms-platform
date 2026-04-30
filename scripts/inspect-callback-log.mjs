import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
config({ path: resolve(root, '.env'), override: true });

const prisma = new PrismaClient();

const logs = await prisma.paymentCallbackLog.findMany({
  where: {
    transactionStatus: 'Approved',
    clientEmail: { in: ['ds.dreamstories@gmail.com', 'krychylskakv@gmail.com', 'dashachuchmay1@gmail.com'] },
  },
  select: {
    createdAt: true,
    clientEmail: true,
    orderReference: true,
    amount: true,
    actionsTaken: true,
    skipped: true,
    skipReason: true,
    prevStatus: true,
    error: true,
    signatureValid: true,
  },
  orderBy: { createdAt: 'desc' },
});

console.log(`Approved callbacks: ${logs.length}\n`);

const byOrderRef = new Map();
for (const l of logs) {
  if (!byOrderRef.has(l.orderReference)) byOrderRef.set(l.orderReference, []);
  byOrderRef.get(l.orderReference).push(l);
}

console.log(`Unique orderReferences: ${byOrderRef.size}\n`);

console.log('=== Group by orderRef (only those with >1 callback) ===');
for (const [ref, group] of byOrderRef.entries()) {
  if (group.length > 1) {
    console.log(`\n• ${group[0].clientEmail}  ${group[0].amount}₴  ${ref}`);
    for (const g of group) {
      console.log(`    ${g.createdAt.toISOString()}  prev=${g.prevStatus}  sig=${g.signatureValid}  skip=${g.skipped}  err=${g.error ?? '-'}  actions=${g.actionsTaken ?? '-'}`);
    }
  }
}

console.log('\n=== Single-callback orderRefs (count by client) ===');
const singleByEmail = new Map();
for (const [_, group] of byOrderRef) {
  if (group.length === 1) {
    const k = group[0].clientEmail;
    singleByEmail.set(k, (singleByEmail.get(k) ?? 0) + 1);
  }
}
for (const [email, count] of singleByEmail) {
  console.log(`  ${email}: ${count} unique orderRefs each fired once`);
}

await prisma.$disconnect();
