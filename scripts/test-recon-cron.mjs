// Smoke-тест recon cron логіки. Створює "stuck" PAID Payment без enrollmentsCompletedAt,
// перевіряє що cron знайде і догенерує.
import prisma from './_db.mjs';

const TEST_USER_EMAIL = 'shaposhnik.mcd@gmail.com';

const user = await prisma.user.findUnique({ where: { email: TEST_USER_EMAIL } });
const course = await prisma.course.findFirst({
  where: { published: true, price: { gt: 0 } },
});

await prisma.enrollment.deleteMany({ where: { userId: user.id, courseId: course.id } });
await prisma.payment.deleteMany({ where: { orderReference: { startsWith: 'TEST_RECON_' } } });

// "Stuck" payment: PAID but enrollmentsCompletedAt is NULL
const orderRef = `TEST_RECON_${Date.now()}`;
const stuck = await prisma.payment.create({
  data: {
    userId: user.id,
    courseId: course.id,
    orderReference: orderRef,
    amount: 1,
    status: 'PAID',
    paidAt: new Date(),
    provisionError: 'simulated_failure',
  },
});
console.log(`Created stuck Payment: ${stuck.orderReference}`);

// Симулюємо те, що робить recon cron: знаходить stuck і викликає provision
const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
const found = await prisma.payment.findMany({
  where: {
    status: 'PAID',
    yearlyProgramSubscriptionId: null,
    createdAt: { gt: cutoff },
    OR: [
      { enrollmentsCompletedAt: null },
      { sendpulseSentAt: null },
    ],
  },
});

const ourStuck = found.find((p) => p.orderReference === orderRef);
console.log(`Recon would find ${found.length} stuck payments. Our test entry included: ${!!ourStuck}`);

// "Заліковуємо"
await prisma.enrollment.upsert({
  where: { userId_courseId: { userId: user.id, courseId: course.id } },
  create: { userId: user.id, courseId: course.id },
  update: {},
});
await prisma.payment.update({
  where: { id: stuck.id },
  data: {
    enrollmentsCompletedAt: new Date(),
    sendpulseSentAt: new Date(),
    provisionError: null,
  },
});

// Після hеального — Recon повторно НЕ знаходить його
const afterHeal = await prisma.payment.findMany({
  where: {
    status: 'PAID',
    yearlyProgramSubscriptionId: null,
    createdAt: { gt: cutoff },
    OR: [
      { enrollmentsCompletedAt: null },
      { sendpulseSentAt: null },
    ],
  },
});
const stillThere = afterHeal.find((p) => p.orderReference === orderRef);
console.log(`After heal — recon would find: ${afterHeal.length} stuck. Our entry STILL: ${!!stillThere ? '❌ YES (BUG)' : '✅ NO'}`);

// Cleanup
await prisma.enrollment.deleteMany({ where: { userId: user.id, courseId: course.id } });
await prisma.payment.deleteMany({ where: { id: stuck.id } });
console.log('Cleanup OK.');

await prisma.$disconnect();
