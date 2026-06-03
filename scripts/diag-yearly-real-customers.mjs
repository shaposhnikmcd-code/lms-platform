/// Readonly: підтвердження що реальні платники Річної на місці (не зачеплені чисткою).
import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '..', '.env'), override: true });
const prisma = new PrismaClient();

// Усі підписки з реальним PAID-платежем (>2₴) = справжні клієнти.
const real = await prisma.yearlyProgramSubscription.findMany({
  where: { payments: { some: { status: 'PAID', amount: { gt: 2 } } } },
  orderBy: { createdAt: 'asc' },
  select: {
    status: true, plan: true,
    user: { select: { email: true, name: true } },
    payments: { where: { status: 'PAID', amount: { gt: 2 } }, select: { amount: true } },
  },
});

console.log('РЕАЛЬНІ ПЛАТНИКИ (підписка з PAID >2₴):');
let total = 0;
for (const s of real) {
  const sum = s.payments.reduce((a, p) => a + p.amount, 0);
  total += sum;
  console.log(`  ${s.status.padEnd(9)} ${s.plan.padEnd(8)} ${String(sum).padStart(6)}₴  ${s.user?.name} <${s.user?.email}>`);
}
console.log(`\n  Усього реальних платників: ${real.length}  ·  сума: ${total}₴`);

// Сироти: ACTIVE/GRACE без жодного PAID — потенційні тестові залишки.
const orphans = await prisma.yearlyProgramSubscription.findMany({
  where: { status: { in: ['ACTIVE', 'GRACE'] }, payments: { none: { status: 'PAID' } } },
  select: { status: true, plan: true, autoRenew: true, user: { select: { email: true, name: true } } },
});
console.log(`\nСИРОТИ (ACTIVE/GRACE без жодного PAID-платежу): ${orphans.length}`);
for (const s of orphans) {
  console.log(`  ${s.status} ${s.plan}${s.autoRenew ? '+auto' : ''}  ${s.user?.name} <${s.user?.email}>`);
}

// Контрольна сума: чи лишились де-небудь PAID-платежі 1-2₴ Річної (мали бути видалені)
const leftoverTest = await prisma.payment.count({
  where: { status: 'PAID', amount: { in: [1, 2] }, OR: [{ yearlyProgramSubscriptionId: { not: null } }, { orderReference: { startsWith: 'yearly-program' } }] },
});
console.log(`\nЗалишкові PAID 1-2₴ Річної (мало б бути 0): ${leftoverTest}`);

await prisma.$disconnect();
