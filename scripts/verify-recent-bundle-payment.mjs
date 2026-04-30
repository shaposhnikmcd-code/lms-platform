import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
config({ path: resolve(root, '.env'), override: true });

const prisma = new PrismaClient();

const user = await prisma.user.findUnique({
  where: { email: 'shaposhnik.mcd@gmail.com' },
  select: { id: true },
});

const payment = await prisma.payment.findFirst({
  where: { userId: user.id, bundleId: { not: null } },
  orderBy: { createdAt: 'desc' },
  select: {
    id: true,
    orderReference: true,
    amount: true,
    status: true,
    createdAt: true,
    paidAt: true,
    enrollmentsCompletedAt: true,
    sendpulseSentAt: true,
    provisionError: true,
    bundleId: true,
    freeSlugs: true,
    bundle: { select: { slug: true, type: true, courses: { select: { courseSlug: true, isFree: true } } } },
  },
});
console.log('Latest bundle Payment:');
console.log(JSON.stringify(payment, null, 2));

if (payment) {
  const logs = await prisma.paymentCallbackLog.findMany({
    where: { orderReference: payment.orderReference },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, createdAt: true, kind: true, transactionStatus: true,
      skipped: true, skipReason: true, actionsTaken: true,
    },
  });
  console.log(`\nPaymentCallbackLog entries: ${logs.length}`);
  for (const l of logs) {
    console.log(`  - ${l.createdAt.toISOString()}  kind=${l.kind}  txStatus=${l.transactionStatus}  skipped=${l.skipped}  actions=${JSON.stringify(l.actionsTaken)}`);
  }

  const expected = payment.bundle.courses.filter((c) => !c.isFree).map((c) => c.courseSlug);
  if (payment.bundle.type === 'CHOICE_FREE') {
    expected.push(...(payment.freeSlugs ?? []));
  } else {
    expected.push(...payment.bundle.courses.filter((c) => c.isFree).map((c) => c.courseSlug));
  }
  console.log(`\nExpected enrollments: [${expected.join(', ')}]`);

  const enrollments = await prisma.enrollment.findMany({
    where: { userId: user.id, courseId: { in: expected } },
    select: { courseId: true, createdAt: true },
  });
  console.log(`Found ${enrollments.length}/${expected.length}:`);
  for (const e of enrollments) {
    console.log(`  - ${e.courseId}  created=${e.createdAt.toISOString()}`);
  }
  const missing = expected.filter((s) => !enrollments.find((e) => e.courseId === s));
  if (missing.length) console.log(`MISSING: ${missing.join(', ')}`);
}

await prisma.$disconnect();
