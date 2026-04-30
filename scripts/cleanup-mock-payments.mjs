// Прибирає мокові дані, посіяні через seed-mock-payments.mjs.
// Працює лише з orderReference, що починається з MOCK-, тож реальні платежі не торкає.
//
// Запуск: node scripts/cleanup-mock-payments.mjs
import prisma from './_db.mjs';

const PREFIX = 'MOCK-';

console.log('=== CLEANUP MOCK PAYMENTS ===\n');

/// 1. PaymentCallbackLog за prefix.
const logs = await prisma.paymentCallbackLog.deleteMany({
  where: { orderReference: { startsWith: PREFIX } },
});
console.log(`PaymentCallbackLog: ${logs.count}`);

/// 2. Знаходимо payment-и (потрібні id-шки і subIds щоб розчепити перед видаленням).
const payments = await prisma.payment.findMany({
  where: { orderReference: { startsWith: PREFIX } },
  select: { id: true, yearlyProgramSubscriptionId: true },
});
console.log(`Payments знайдено: ${payments.length}`);

const subIds = [...new Set(payments.map(p => p.yearlyProgramSubscriptionId).filter(Boolean))];

if (payments.length) {
  /// Розчепити FK перед видаленням підписок.
  await prisma.payment.updateMany({
    where: { id: { in: payments.map(p => p.id) } },
    data: { yearlyProgramSubscriptionId: null },
  });
  const del = await prisma.payment.deleteMany({
    where: { id: { in: payments.map(p => p.id) } },
  });
  console.log(`Payments видалено: ${del.count}`);
}

/// 3. Yearly subscriptions + їхні events.
if (subIds.length) {
  const ev = await prisma.yearlyProgramSubscriptionEvent.deleteMany({
    where: { subscriptionId: { in: subIds } },
  });
  const subs = await prisma.yearlyProgramSubscription.deleteMany({
    where: { id: { in: subIds } },
  });
  console.log(`Subscription events: ${ev.count}, Subscriptions: ${subs.count}`);
}

/// 4. ConnectorOrder за prefix.
const conn = await prisma.connectorOrder.deleteMany({
  where: { orderReference: { startsWith: PREFIX } },
});
console.log(`ConnectorOrders: ${conn.count}`);

/// 5. Mock-юзери (email починається з 'mock-student.'). Захист — лише ті, у кого
/// після кроків 1–4 не лишилось ані payments, ані enrollments.
const mockUsers = await prisma.user.deleteMany({
  where: {
    email: { startsWith: PREFIX.toLowerCase() + 'student.' },
    role: 'STUDENT',
    payments: { none: {} },
    enrollments: { none: {} },
  },
});
console.log(`Mock students: ${mockUsers.count}`);

console.log('\n=== DONE ===');
await prisma.$disconnect();
