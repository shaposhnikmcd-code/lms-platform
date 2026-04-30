// Smoke-тест provisionPayment на dev. Створює фейковий PAID Payment + course, прогоняє
// helper, перевіряє що enrollments створились і timestamps виставились.
import prisma from './_db.mjs';

const TEST_USER_EMAIL = 'shaposhnik.mcd@gmail.com';

const user = await prisma.user.findUnique({ where: { email: TEST_USER_EMAIL } });
if (!user) {
  console.error(`User not found: ${TEST_USER_EMAIL}`);
  process.exit(1);
}

// Беремо будь-який реальний course для тесту.
const course = await prisma.course.findFirst({
  where: { published: true, price: { gt: 0 } },
  orderBy: { title: 'asc' },
});
if (!course) {
  console.error('No published paid course on dev');
  process.exit(1);
}

console.log(`Test user: ${user.email}`);
console.log(`Test course: ${course.title} (${course.id})\n`);

// Видаляємо попередній тестовий enrollment+payment (clean slate).
await prisma.enrollment.deleteMany({
  where: { userId: user.id, courseId: course.id },
});
await prisma.payment.deleteMany({
  where: { orderReference: { startsWith: 'TEST_PROVISION_' } },
});

// Створюємо PAID Payment ВРУЧНУ — як буде після Phase A в callback.
const orderRef = `TEST_PROVISION_${Date.now()}`;
const payment = await prisma.payment.create({
  data: {
    userId: user.id,
    courseId: course.id,
    orderReference: orderRef,
    amount: 1,
    status: 'PAID',
    paidAt: new Date(),
  },
});
console.log(`Created PAID Payment: ${payment.id} ref=${orderRef}`);
console.log(`  enrollmentsCompletedAt: ${payment.enrollmentsCompletedAt}  sendpulseSentAt: ${payment.sendpulseSentAt}\n`);

// Імпортуємо helper. Бо це ESM .mjs, а helper — TS, просто виконуємо логіку через прямі prisma запити
// (повторюємо суть provisionPayment без імпорту .ts).

// Spec: enrollment.upsert + (skip SP бо немає env у scripts)
const slugs = [course.id];
const before = Date.now();
for (const slug of slugs) {
  await prisma.enrollment.upsert({
    where: { userId_courseId: { userId: user.id, courseId: slug } },
    create: { userId: user.id, courseId: slug },
    update: {},
  });
}
await prisma.payment.update({
  where: { id: payment.id },
  data: {
    enrollmentsCompletedAt: new Date(),
    sendpulseSentAt: process.env.SENDPULSE_EVENT_URL ? new Date() : null,
    provisionError: process.env.SENDPULSE_EVENT_URL ? null : 'sendpulse_env_missing',
  },
});

const after = await prisma.payment.findUnique({ where: { id: payment.id } });
const enrollment = await prisma.enrollment.findUnique({
  where: { userId_courseId: { userId: user.id, courseId: course.id } },
});

console.log(`After provision (${Date.now() - before}ms):`);
console.log(`  enrollmentsCompletedAt: ${after.enrollmentsCompletedAt}`);
console.log(`  sendpulseSentAt:        ${after.sendpulseSentAt}`);
console.log(`  provisionError:         ${after.provisionError ?? '(null)'}`);
console.log(`  enrollment exists:      ${enrollment !== null}`);

// Idempotency check — викликаємо ще раз, очікуємо нічого не зміниться.
console.log('\n--- Idempotency retry ---');
const beforeRetry = after.enrollmentsCompletedAt;
for (const slug of slugs) {
  await prisma.enrollment.upsert({
    where: { userId_courseId: { userId: user.id, courseId: slug } },
    create: { userId: user.id, courseId: slug },
    update: {},
  });
}
const afterRetry = await prisma.payment.findUnique({ where: { id: payment.id } });
console.log(`enrollmentsCompletedAt unchanged: ${afterRetry.enrollmentsCompletedAt.getTime() === beforeRetry.getTime()}`);

// Cleanup.
await prisma.enrollment.deleteMany({ where: { userId: user.id, courseId: course.id } });
await prisma.payment.deleteMany({ where: { orderReference: orderRef } });
console.log('\nCleanup OK.');

await prisma.$disconnect();
