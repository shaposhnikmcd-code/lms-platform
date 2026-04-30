// One-off: checks the most recent course Payment for shaposhnik.mcd@gmail.com on PROD DB
// (pre-prod and prod share the same Neon prod branch).
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
  select: { id: true, email: true, role: true },
});
console.log('User:', user);

const payment = await prisma.payment.findFirst({
  where: { userId: user.id, courseId: { not: null } },
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
    courseId: true,
    course: { select: { slug: true, title: true } },
  },
});
console.log('\nLatest course Payment:');
console.log(JSON.stringify(payment, null, 2));

if (payment) {
  const logs = await prisma.paymentCallbackLog.findMany({
    where: { orderReference: payment.orderReference },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, createdAt: true, kind: true, transactionStatus: true,
      skipped: true, skipReason: true, actionsTaken: true, signatureValid: true,
    },
  });
  console.log(`\nPaymentCallbackLog entries for ${payment.orderReference}: ${logs.length}`);
  for (const l of logs) {
    console.log(`  - ${l.createdAt.toISOString()}  kind=${l.kind}  txStatus=${l.transactionStatus}  skipped=${l.skipped}${l.skipReason ? ' ('+l.skipReason+')' : ''}  actions=${JSON.stringify(l.actionsTaken)}`);
  }

  if (payment.courseId) {
    const enroll = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: user.id, courseId: payment.courseId } },
      select: { id: true, createdAt: true, spProgressPercent: true, spProgressCheckedAt: true },
    });
    console.log('\nEnrollment for that course:');
    console.log(JSON.stringify(enroll, null, 2));
  }
}

await prisma.$disconnect();
