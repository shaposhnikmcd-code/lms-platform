import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

console.log('\n=== Всі Payment-и з email shaposhnik.mcd, всі статуси ===');
const p = await prisma.payment.findMany({
  where: { user: { email: 'shaposhnik.mcd@gmail.com' } },
  orderBy: { createdAt: 'desc' },
  include: { user: { select: { email: true } }, bundle: { select: { slug: true } } },
  take: 20,
});
for (const r of p) {
  const kind = r.bundleId ? `BUNDLE(${r.bundle?.slug})` : `COURSE(${r.courseId})`;
  const pd = r.paidAt ? r.paidAt.toISOString() : '(не оплачено)';
  console.log(
    `create ${r.createdAt.toISOString()} | paid ${pd} | ${r.status.padEnd(7)} | ${kind.padEnd(30)} | ${String(r.amount).padStart(5)} UAH | ${r.orderReference}`,
  );
}

console.log('\n=== Логи callback з PaymentCallbackLog (усе що є) ===');
const logs = await prisma.paymentCallbackLog.findMany({
  orderBy: { createdAt: 'desc' },
  take: 30,
});
console.log(`Всього записів: ${logs.length}`);
for (const l of logs) {
  console.log(
    `${l.createdAt.toISOString()} | ${l.kind} | ${l.transactionStatus} | sig=${l.signatureValid} | prev=${l.prevStatus} | actions=${l.actionsTaken} | sp=${l.sendpulseSlugs} | ip=${l.ip} | ${l.orderReference}`,
  );
}

await prisma.$disconnect();
