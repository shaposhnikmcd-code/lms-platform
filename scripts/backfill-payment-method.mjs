// Бекфіл Payment.paymentMethod з історичних WFP callback-логів (rawPayload.paymentSystem).
// Запуск: node scripts/backfill-payment-method.mjs [--execute]
// Без --execute — лише показує, що буде оновлено (dry-run).
import prisma from './_db.mjs';

const EXECUTE = process.argv.includes('--execute');

const payments = await prisma.payment.findMany({
  where: { status: 'PAID', paymentMethod: null },
  select: { id: true, orderReference: true },
});

console.log(`PAID-платежів без paymentMethod: ${payments.length}`);

let matched = 0;
const byMethod = {};

for (const p of payments) {
  const log = await prisma.paymentCallbackLog.findFirst({
    where: { orderReference: p.orderReference, source: 'wayforpay', transactionStatus: 'Approved' },
    select: { rawPayload: true },
    orderBy: { createdAt: 'desc' },
  });
  const ps = log?.rawPayload?.paymentSystem;
  if (typeof ps === 'string' && ps) {
    matched++;
    byMethod[ps] = (byMethod[ps] || 0) + 1;
    if (EXECUTE) {
      await prisma.payment.update({ where: { id: p.id }, data: { paymentMethod: ps } });
    }
  }
}

console.log(`Знайдено метод у callback-логах: ${matched}`);
console.log('Розподіл:', byMethod);
console.log(EXECUTE ? '✅ Оновлено в БД.' : 'ℹ️ DRY-RUN. Додай --execute щоб записати.');

await prisma.$disconnect();
