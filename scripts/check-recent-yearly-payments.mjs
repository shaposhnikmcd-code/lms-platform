import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
config({ path: resolve(root, '.env'), override: true });

const prisma = new PrismaClient();

const since = new Date(Date.now() - 2 * 60 * 60 * 1000);
const payments = await prisma.payment.findMany({
  where: {
    createdAt: { gte: since },
    OR: [
      { orderReference: { startsWith: 'yearly-program' } },
    ],
  },
  orderBy: { createdAt: 'desc' },
  include: {
    user: { select: { email: true, name: true, role: true } },
    yearlyProgramSubscription: { select: { id: true, plan: true, status: true, autoRenew: true, recToken: true, expiresAt: true } },
  },
});

console.log(`Found ${payments.length} yearly-program payments since ${since.toISOString()}`);
for (const p of payments) {
  console.log(`\n  ${p.createdAt.toISOString()}  ${p.orderReference}  ${p.amount}₴  status=${p.status}`);
  console.log(`    user: ${p.user?.email} (${p.user?.role})`);
  if (p.yearlyProgramSubscription) {
    const s = p.yearlyProgramSubscription;
    console.log(`    sub: ${s.id}  ${s.plan}/${s.status}  autoRenew=${s.autoRenew}  recToken=${s.recToken ? 'SET' : 'null'}  expires=${s.expiresAt?.toISOString()}`);
  } else {
    console.log(`    sub: null`);
  }
}

await prisma.$disconnect();
