/// Readonly: чому @veedplug-підписки ACTIVE з 0₴ / 0 платежів.
import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '..', '.env'), override: true });
const prisma = new PrismaClient();

const emails = ['chizobankaru@gmail.com', 'nika_mail@yahoo.com', 'veedplug@yahoo.com', 'veetheplug@yahoo.com', 'nkaruchizoba@gmail.com', 'veronicankaru@gmail.com'];

const subs = await prisma.yearlyProgramSubscription.findMany({
  where: { user: { email: { in: emails } } },
  orderBy: { createdAt: 'asc' },
  select: {
    id: true, status: true, plan: true, autoRenew: true, createdAt: true,
    user: { select: { email: true, role: true } },
    payments: { select: { amount: true, status: true, createdAt: true, orderReference: true } },
  },
});

for (const s of subs) {
  console.log(`\n${s.user?.email}  [${s.user?.role}]  ${s.plan}${s.autoRenew ? '+auto' : ''}  status=${s.status}`);
  console.log(`  sub ${s.id} · created ${s.createdAt.toISOString().slice(0,16)}`);
  if (!s.payments.length) console.log('  ПЛАТЕЖІВ НЕМАЄ (0 рядків)');
  for (const p of s.payments) {
    console.log(`  · ${p.amount}₴ ${p.status.padEnd(8)} ${p.createdAt.toISOString().slice(0,16)} ${p.orderReference}`);
  }
  // Події активації/created
  const ev = await prisma.yearlyProgramSubscriptionEvent.findMany({
    where: { subscriptionId: s.id },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true, type: true, message: true },
  });
  for (const e of ev) console.log(`    ev ${e.createdAt.toISOString().slice(5,16)} ${e.type} ${(e.message??'').slice(0,60)}`);
}

await prisma.$disconnect();
