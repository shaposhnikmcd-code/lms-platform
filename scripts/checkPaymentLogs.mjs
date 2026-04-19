import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

try {
  const total = await prisma.paymentCallbackLog.count();
  console.log(`Всього в PaymentCallbackLog: ${total}\n`);

  const byKind = await prisma.paymentCallbackLog.groupBy({
    by: ['kind'],
    _count: { _all: true },
  });
  console.log('По kind:');
  for (const k of byKind) {
    console.log(`  ${k.kind || '(empty)'} → ${k._count._all}`);
  }

  console.log('\nОстанні 15 записів:');
  const recent = await prisma.paymentCallbackLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 15,
    select: {
      id: true, createdAt: true, kind: true, transactionStatus: true,
      orderReference: true, clientEmail: true, amount: true, skipped: true,
    },
  });
  for (const r of recent) {
    console.log(`  ${r.createdAt.toISOString().slice(0,16)}  kind=${r.kind}  ${r.transactionStatus}  ${r.orderReference}  ${r.clientEmail ?? '—'}  ${r.amount}₴  skipped=${r.skipped}`);
  }
} finally {
  await prisma.$disconnect();
}
