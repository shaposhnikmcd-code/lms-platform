import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
config({ path: resolve(root, '.env'), override: true });

const prisma = new PrismaClient();

const emails = [
  'shaposhnik.mcd@gmail.com',
  'Polandemigrants@gmail.com',
  'Andersen.BestPM@gmail.com',
  'andersen.pm2020@gmail.com',
];

const users = await prisma.user.findMany({
  where: { email: { in: emails } },
  select: { id: true, email: true },
});

for (const u of users) {
  const enrollments = await prisma.enrollment.findMany({
    where: { userId: u.id },
    select: { id: true, course: { select: { title: true, price: true } } },
  });
  const payments = await prisma.payment.findMany({
    where: { userId: u.id },
    select: { id: true, amount: true, status: true },
  });
  const subs = await prisma.yearlyProgramSubscription.findMany({
    where: { userId: u.id },
    select: { id: true, plan: true, status: true },
  });
  console.log(`\n=== ${u.email} ===`);
  console.log(`  enrollments: ${enrollments.length}`);
  for (const e of enrollments) console.log(`    - ${e.course.title} (price=${e.course.price})`);
  console.log(`  payments: ${payments.length}`);
  for (const p of payments) console.log(`    - ${p.amount}₴ ${p.status}`);
  console.log(`  yearly subs: ${subs.length}`);
  for (const s of subs) console.log(`    - ${s.plan}/${s.status}`);
}

await prisma.$disconnect();
