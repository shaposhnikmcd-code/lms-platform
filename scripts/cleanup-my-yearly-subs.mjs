// Видаляє ВСІ yearly program subscriptions для shaposhnik.mcd@gmail.com
// (адмінські тестові). Розриває payment lin, видаляє events, потім subscription.
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

const subs = await prisma.yearlyProgramSubscription.findMany({
  where: { userId: user.id },
  select: { id: true, plan: true, status: true, autoRenew: true },
});
console.log(`Found ${subs.length} subs to clean:`);
for (const s of subs) console.log('  -', s);

for (const s of subs) {
  // 1) Розриваємо posilannya: Payment.yearlyProgramSubscriptionId = null
  const unlinked = await prisma.payment.updateMany({
    where: { yearlyProgramSubscriptionId: s.id },
    data: { yearlyProgramSubscriptionId: null },
  });
  console.log(`  sub ${s.id}: unlinked ${unlinked.count} payments`);

  // 2) Видаляємо events (FK NO CASCADE)
  const eventsDeleted = await prisma.yearlyProgramSubscriptionEvent.deleteMany({
    where: { subscriptionId: s.id },
  });
  console.log(`  sub ${s.id}: deleted ${eventsDeleted.count} events`);

  // 3) Видаляємо subscription
  await prisma.yearlyProgramSubscription.delete({ where: { id: s.id } });
  console.log(`  sub ${s.id}: DELETED`);
}

console.log('\nDone.');
await prisma.$disconnect();
