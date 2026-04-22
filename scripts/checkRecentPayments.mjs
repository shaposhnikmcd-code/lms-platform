import prisma from './_db.mjs';

const since = new Date(Date.now() - 36 * 60 * 60 * 1000);

const payments = await prisma.payment.findMany({
  where: { createdAt: { gte: since } },
  orderBy: { createdAt: 'desc' },
  include: { user: { select: { email: true, name: true } } },
});

console.log(`Всього платежів за останні 36 год: ${payments.length}\n`);

const byStatus = payments.reduce((acc, p) => {
  acc[p.status] = (acc[p.status] || 0) + 1;
  return acc;
}, {});
console.log('По статусах:', byStatus);

const byAmount = payments.reduce((acc, p) => {
  const key = `${p.amount} UAH`;
  acc[key] = (acc[key] || 0) + 1;
  return acc;
}, {});
console.log('По сумах:', byAmount);

console.log('\n--- Деталі ---');
for (const p of payments) {
  const kind = p.bundleId ? 'BUNDLE' : p.courseId ? 'COURSE' : '?';
  const id = p.bundleId || p.courseId || '-';
  console.log(
    `[${p.createdAt.toISOString()}] ${p.status.padEnd(8)} ${kind} ${id.padEnd(30)} ${String(p.amount).padStart(6)} UAH  ${p.user?.email || '-'}  ${p.orderReference}`,
  );
}

await prisma.$disconnect();
