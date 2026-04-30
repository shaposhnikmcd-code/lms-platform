// DESTRUCTIVE: deletes test payments (amount IN (1,2)) for 3 specific test accounts.
// Cascades: yearly events auto-cascade with subscription. PaymentCallbackLog left untouched (audit).
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
config({ path: resolve(root, '.env'), override: true });

const prisma = new PrismaClient();

const targetEmails = [
  'andersen.pm2020@gmail.com',
];

const users = await prisma.user.findMany({
  where: { email: { in: targetEmails } },
  select: { id: true, email: true },
});
const userIds = users.map((u) => u.id);
console.log(`Target users: ${users.length}\n`);

// 1) Collect payments
const payments = await prisma.payment.findMany({
  where: { amount: { in: [1, 2] }, userId: { in: userIds } },
  select: {
    id: true,
    amount: true,
    courseId: true,
    bundleId: true,
    yearlyProgramSubscriptionId: true,
    userId: true,
    user: { select: { email: true } },
  },
});
console.log(`Payments to delete: ${payments.length}`);

const subIds = [...new Set(payments.map((p) => p.yearlyProgramSubscriptionId).filter(Boolean))];
const courseIds = [...new Set(payments.map((p) => p.courseId).filter(Boolean))];
const bundleIds = [...new Set(payments.map((p) => p.bundleId).filter(Boolean))];

// Bundle → courseSlug → courseId
let bundleCourseIds = [];
if (bundleIds.length) {
  const bundles = await prisma.bundle.findMany({
    where: { id: { in: bundleIds } },
    select: { courses: { select: { courseSlug: true } } },
  });
  const slugs = [...new Set(bundles.flatMap((b) => b.courses.map((c) => c.courseSlug)))];
  const cs = await prisma.course.findMany({ where: { slug: { in: slugs } }, select: { id: true } });
  bundleCourseIds = cs.map((c) => c.id);
}
const allCourseIds = [...new Set([...courseIds, ...bundleCourseIds])];

// 2) Delete enrollments (test users × those courses)
const delEnrollments = await prisma.enrollment.deleteMany({
  where: { userId: { in: userIds }, courseId: { in: allCourseIds } },
});
console.log(`Enrollments deleted: ${delEnrollments.count}`);

// 3) Delete certificates linked to test users on these courses or subs (defensive — should be 0)
const delCerts = await prisma.certificate.deleteMany({
  where: {
    userId: { in: userIds },
    OR: [
      { courseId: { in: allCourseIds } },
      { subscriptionId: { in: subIds } },
    ],
  },
});
console.log(`Certificates deleted: ${delCerts.count}`);

// 4) Delete payments (must precede subscription delete — no cascade)
const delPayments = await prisma.payment.deleteMany({
  where: { id: { in: payments.map((p) => p.id) } },
});
console.log(`Payments deleted: ${delPayments.count}`);

// 5) Delete yearly subscriptions (events cascade)
const delSubs = await prisma.yearlyProgramSubscription.deleteMany({
  where: { id: { in: subIds } },
});
console.log(`Yearly subscriptions deleted: ${delSubs.count}  (events cascaded)`);

console.log('\nDone.');
await prisma.$disconnect();
