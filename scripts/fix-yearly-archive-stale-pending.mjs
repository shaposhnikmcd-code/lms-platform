/// Одноразово: заархівувати поточні зависання Річної — PENDING без жодної успішної
/// оплати, старші за 24 год. Та сама логіка, що й новий cron-крок archiveStalePending.
/// Guard payments.none(PAID) — реальні клієнти не зачіпаються.
import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '..', '.env'), override: true });
const prisma = new PrismaClient();

const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

const subs = await prisma.yearlyProgramSubscription.findMany({
  where: {
    status: 'PENDING',
    createdAt: { lt: cutoff },
    payments: { none: { status: 'PAID' } },
  },
  select: { id: true, createdAt: true, user: { select: { email: true } } },
});

console.log(`PENDING без оплати, старші 24 год: ${subs.length}\n`);
let done = 0;
for (const s of subs) {
  const res = await prisma.yearlyProgramSubscription.updateMany({
    where: { id: s.id, status: 'PENDING', payments: { none: { status: 'PAID' } } },
    data: { status: 'ARCHIVED' },
  });
  if (res.count === 0) {
    console.log(`•  пропуск (встигли оплатити): ${s.user?.email}`);
    continue;
  }
  await prisma.yearlyProgramSubscriptionEvent.create({
    data: {
      subscriptionId: s.id,
      type: 'admin_action',
      message: 'Авто-архів: незавершена спроба оплати без оплати понад 24 год (разова чистка)',
      metadata: { reason: 'stale-pending-autocleanup', oneTime: true },
    },
  });
  done++;
  console.log(`✓  ${s.createdAt.toISOString().slice(0, 10)}  ${s.user?.email} → Архів`);
}
console.log(`\nЗаархівовано: ${done}`);

await prisma.$disconnect();
