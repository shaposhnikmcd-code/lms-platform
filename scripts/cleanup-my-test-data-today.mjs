// Видаляє всі мої тестові admin-дані за сьогодні (2026-04-29):
// - Payment + PaymentCallbackLog (по orderReference)
// - Enrollment (за сьогодні)
// - ConnectorOrder + його CallbackLog
// - YearlyProgramSubscription + Events
// Після виконання — чистий стан для повторних тестів.
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
config({ path: resolve(root, '.env'), override: true });

const prisma = new PrismaClient();

const ADMIN_EMAIL = 'shaposhnik.mcd@gmail.com';
const TODAY_START = new Date('2026-04-29T00:00:00.000Z');

const user = await prisma.user.findUnique({
  where: { email: ADMIN_EMAIL },
  select: { id: true },
});
if (!user) { console.error('User not found'); process.exit(1); }

console.log('=== CLEANUP MY TEST DATA — 2026-04-29 ===\n');

// 1) ConnectorOrder за сьогодні (по email)
const connectorOrders = await prisma.connectorOrder.findMany({
  where: { email: ADMIN_EMAIL, createdAt: { gte: TODAY_START } },
  select: { id: true, orderReference: true },
});
console.log(`ConnectorOrders: ${connectorOrders.length}`);
const connectorRefs = connectorOrders.map((o) => o.orderReference);
if (connectorRefs.length) {
  const cl = await prisma.paymentCallbackLog.deleteMany({ where: { orderReference: { in: connectorRefs } } });
  console.log(`  - deleted ${cl.count} CallbackLogs for connector orders`);
  const co = await prisma.connectorOrder.deleteMany({ where: { id: { in: connectorOrders.map((o) => o.id) } } });
  console.log(`  - deleted ${co.count} ConnectorOrders`);
}

// 2) Payment-и за сьогодні
const payments = await prisma.payment.findMany({
  where: { userId: user.id, createdAt: { gte: TODAY_START } },
  select: { id: true, orderReference: true, courseId: true, bundleId: true, yearlyProgramSubscriptionId: true },
});
console.log(`\nPayments: ${payments.length}`);

// 3) Зберемо unique yearly subs з payments + всі активні subs цього юзера
const subIds = new Set(payments.map((p) => p.yearlyProgramSubscriptionId).filter(Boolean));
const remainingSubs = await prisma.yearlyProgramSubscription.findMany({
  where: { userId: user.id },
  select: { id: true },
});
for (const s of remainingSubs) subIds.add(s.id);
console.log(`Yearly subs to clean: ${subIds.size}`);

// 4) Видаляємо CallbackLogs payments
const paymentRefs = payments.map((p) => p.orderReference);
if (paymentRefs.length) {
  const cl = await prisma.paymentCallbackLog.deleteMany({ where: { orderReference: { in: paymentRefs } } });
  console.log(`  - deleted ${cl.count} CallbackLogs for payments`);
}

// 5) Розриваємо Payment.yearlyProgramSubscriptionId перш ніж видалити subs
if (subIds.size) {
  await prisma.payment.updateMany({
    where: { yearlyProgramSubscriptionId: { in: [...subIds] } },
    data: { yearlyProgramSubscriptionId: null },
  });
  // 6) Events
  const ev = await prisma.yearlyProgramSubscriptionEvent.deleteMany({ where: { subscriptionId: { in: [...subIds] } } });
  console.log(`  - deleted ${ev.count} subscription events`);
  // 7) Subs
  const subs = await prisma.yearlyProgramSubscription.deleteMany({ where: { id: { in: [...subIds] } } });
  console.log(`  - deleted ${subs.count} subscriptions`);
}

// 8) Видаляємо Payments
if (payments.length) {
  const pp = await prisma.payment.deleteMany({ where: { id: { in: payments.map((p) => p.id) } } });
  console.log(`  - deleted ${pp.count} Payments`);
}

// 9) Enrollments за сьогодні (юзер цей)
const enrollments = await prisma.enrollment.deleteMany({
  where: { userId: user.id, createdAt: { gte: TODAY_START } },
});
console.log(`\nEnrollments deleted: ${enrollments.count}`);

console.log('\n=== DONE ===');
await prisma.$disconnect();
