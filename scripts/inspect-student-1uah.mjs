/// One-shot inspection: переглянути контекст 1₴ платежу студента Polandemigrants@gmail.com
/// перед тим як вирішувати видаляти. Тільки read-only, нічого не змінює.

import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
config({ path: resolve(root, '.env'), override: true });

const prisma = new PrismaClient();

const TARGET = 'yearly-program-monthly_1778092810050_54232c77';

async function main() {
  const payment = await prisma.payment.findUnique({
    where: { orderReference: TARGET },
    include: {
      user: {
        select: {
          id: true, email: true, name: true, role: true, createdAt: true, lastLoginAt: true,
          payments: {
            select: { id: true, orderReference: true, amount: true, status: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
          },
          yearlyProgramSubscriptions: {
            select: {
              id: true, plan: true, status: true, autoRenew: true, createdAt: true,
              startDate: true, expiresAt: true, sendpulseAccessOpenedAt: true, sendpulseAccessClosedAt: true,
              telegramUsername: true, telegramJoinedAt: true,
            },
          },
        },
      },
      yearlyProgramSubscription: true,
    },
  });

  if (!payment) {
    console.log('❌ Payment не знайдено:', TARGET);
    return;
  }

  console.log('\n=== PAYMENT ===');
  console.log('orderReference:', payment.orderReference);
  console.log('amount:', payment.amount, '₴');
  console.log('status:', payment.status);
  console.log('createdAt:', payment.createdAt.toISOString());
  console.log('paidAt:', payment.paidAt?.toISOString() ?? 'null');
  console.log('linked subscription:', payment.yearlyProgramSubscriptionId);

  console.log('\n=== USER ===');
  console.log('id:', payment.user.id);
  console.log('email:', payment.user.email);
  console.log('name:', payment.user.name);
  console.log('role:', payment.user.role);
  console.log('createdAt:', payment.user.createdAt.toISOString());
  console.log('lastLoginAt:', payment.user.lastLoginAt?.toISOString() ?? 'null');

  console.log('\n=== ALL USER PAYMENTS ===');
  for (const p of payment.user.payments) {
    console.log(`  - ${p.orderReference} | ${p.amount}₴ | ${p.status} | ${p.createdAt.toISOString().slice(0,10)}`);
  }

  console.log('\n=== USER YEARLY SUBSCRIPTIONS ===');
  for (const s of payment.user.yearlyProgramSubscriptions) {
    console.log(`  - id=${s.id}`);
    console.log(`    plan=${s.plan} status=${s.status} autoRenew=${s.autoRenew}`);
    console.log(`    expiresAt=${s.expiresAt?.toISOString() ?? 'null'}`);
    console.log(`    SP open=${s.sendpulseAccessOpenedAt?.toISOString() ?? 'null'} close=${s.sendpulseAccessClosedAt?.toISOString() ?? 'null'}`);
    console.log(`    TG username=${s.telegramUsername} joined=${s.telegramJoinedAt?.toISOString() ?? 'null'}`);
  }
}

main().catch(e => { console.error('❌', e); process.exit(1); }).finally(() => prisma.$disconnect());
