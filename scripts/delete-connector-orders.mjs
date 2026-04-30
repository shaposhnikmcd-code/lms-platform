import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
config({ path: resolve(root, '.env'), override: true });

const prisma = new PrismaClient();

const testEmails = [
  'shaposhnik.mcd@gmail.com',
  'andersen.pm2020@gmail.com',
  'Polandemigrants@gmail.com',
  'Andersen.BestPM@gmail.com',
];

const orders = await prisma.connectorOrder.findMany({
  where: { email: { in: testEmails, mode: 'insensitive' } },
  select: {
    id: true,
    email: true,
    fullName: true,
    amount: true,
    paymentStatus: true,
    orderReference: true,
    createdAt: true,
  },
  orderBy: { createdAt: 'desc' },
});

console.log(`Found ${orders.length} connector orders for test accounts:\n`);
for (const o of orders) {
  console.log(
    `- ${o.amount}₴ ${o.paymentStatus}  ${o.email}  ${o.createdAt.toISOString().slice(0, 10)}  ord=${o.orderReference}`,
  );
}

if (orders.length === 0) {
  console.log('Nothing to delete.');
  await prisma.$disconnect();
  process.exit(0);
}

const del = await prisma.connectorOrder.deleteMany({
  where: { id: { in: orders.map((o) => o.id) } },
});
console.log(`\nDeleted: ${del.count}  (tracking logs cascaded)`);

await prisma.$disconnect();
