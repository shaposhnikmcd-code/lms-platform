// DRY RUN — listing test payments (amount=1 for course/bundle, amount=2 for yearly)
// and everything that would be deleted along with them. NO mutations.
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
config({ path: resolve(root, '.env'), override: true });

const prisma = new PrismaClient();

console.log('=== TEST PAYMENTS (amount IN (1, 2)) ===\n');

const payments = await prisma.payment.findMany({
  where: { amount: { in: [1, 2] } },
  select: {
    id: true,
    amount: true,
    status: true,
    createdAt: true,
    orderReference: true,
    courseId: true,
    bundleId: true,
    yearlyProgramSubscriptionId: true,
    user: { select: { email: true, role: true, name: true } },
    course: { select: { title: true } },
    bundle: { select: { title: true } },
  },
  orderBy: { createdAt: 'asc' },
});

console.log(`Found ${payments.length} test payments.\n`);
for (const p of payments) {
  const target =
    p.course?.title ?? p.bundle?.title ?? (p.yearlyProgramSubscriptionId ? 'YEARLY-SUB' : '?');
  console.log(
    `- [${p.amount}₴] ${p.status}  ${p.user.email} (${p.user.role})  → ${target}  · ${p.createdAt.toISOString().slice(0, 10)}  ord=${p.orderReference}`,
  );
}

const userIds = [...new Set(payments.map((p) => p.user ? p.user : null).filter(Boolean))];
const userEmails = [...new Set(payments.map((p) => p.user.email))];
const courseIds = [...new Set(payments.map((p) => p.courseId).filter(Boolean))];
const bundleIds = [...new Set(payments.map((p) => p.bundleId).filter(Boolean))];
const subIds = [...new Set(payments.map((p) => p.yearlyProgramSubscriptionId).filter(Boolean))];

// Look up users by email to get IDs
const users = await prisma.user.findMany({
  where: { email: { in: userEmails } },
  select: { id: true, email: true, role: true },
});
const userIdSet = users.map((u) => u.id);

console.log('\n=== AFFECTED USERS ===');
for (const u of users) console.log(`- ${u.email} (${u.role}) id=${u.id}`);

// Enrollments for the courses these test payments touch (limited to test users)
console.log('\n=== ENROLLMENTS to delete (test users × test courses / bundle courses) ===');
let bundleCourses = [];
if (bundleIds.length) {
  const bundles = await prisma.bundle.findMany({
    where: { id: { in: bundleIds } },
    select: { courses: { select: { courseSlug: true } } },
  });
  const bundleSlugs = bundles.flatMap((b) => b.courses.map((c) => c.courseSlug));
  const bundleCourseRows = await prisma.course.findMany({
    where: { slug: { in: bundleSlugs } },
    select: { id: true },
  });
  bundleCourses = bundleCourseRows.map((c) => c.id);
}
const allCourseIds = [...new Set([...courseIds, ...bundleCourses])];

const enrollments = await prisma.enrollment.findMany({
  where: { userId: { in: userIdSet }, courseId: { in: allCourseIds } },
  select: {
    id: true,
    userId: true,
    courseId: true,
    user: { select: { email: true } },
    course: { select: { title: true } },
  },
});
console.log(`Found ${enrollments.length} enrollments.\n`);
for (const e of enrollments) {
  console.log(`- ${e.user.email}  →  ${e.course.title}  (id=${e.id})`);
}

// Yearly subscriptions linked
console.log('\n=== YEARLY SUBSCRIPTIONS to delete ===');
const subs = await prisma.yearlyProgramSubscription.findMany({
  where: { id: { in: subIds } },
  select: {
    id: true,
    plan: true,
    status: true,
    user: { select: { email: true } },
    payments: { select: { id: true } },
    events: { select: { id: true } },
  },
});
console.log(`Found ${subs.length} subscriptions.\n`);
for (const s of subs) {
  console.log(
    `- ${s.user.email}  ${s.plan}/${s.status}  payments=${s.payments.length} events=${s.events.length}  id=${s.id}`,
  );
}

// Certificates issued for these test users on these courses
console.log('\n=== CERTIFICATES on test users (course OR yearly) ===');
const certs = await prisma.certificate.findMany({
  where: {
    userId: { in: userIdSet },
    OR: [
      { courseId: { in: allCourseIds } },
      { subscriptionId: { in: subIds } },
    ],
  },
  select: {
    id: true,
    type: true,
    certNumber: true,
    user: { select: { email: true } },
    course: { select: { title: true } },
    subscriptionId: true,
  },
});
console.log(`Found ${certs.length} certificates.\n`);
for (const c of certs) {
  const what = c.course?.title ?? `YEARLY-SUB ${c.subscriptionId ?? ''}`;
  console.log(`- ${c.certNumber} (${c.type})  ${c.user.email}  → ${what}`);
}

console.log('\n=== SUMMARY ===');
console.log(`Payments:                 ${payments.length}`);
console.log(`Enrollments (test users): ${enrollments.length}`);
console.log(`Yearly subscriptions:     ${subs.length}`);
console.log(`Certificates:             ${certs.length}`);

await prisma.$disconnect();
