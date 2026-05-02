// Засіває демо PaymentCallbackLog на dev-branch до існуючого PENDING платежу
// з clientEmail що відрізняється від user.email — щоб побачити "WFP: …" рядок.
import prisma from './_db.mjs';

const url = process.env.DATABASE_URL || '';
const host = url.match(/@([^/?]+)/)?.[1] || '?';
console.log(`TARGET DB: ${host}`);
if (!host.includes('ep-sparkling-wave')) {
  console.error('❌ Очікувався dev branch ep-sparkling-wave. Перерви.');
  process.exit(1);
}

const payment = await prisma.payment.findFirst({
  where: { status: 'PENDING' },
  select: { orderReference: true, amount: true, currency: true, courseId: true, bundleId: true, user: { select: { email: true, name: true } } },
  orderBy: { createdAt: 'desc' },
});

if (!payment) {
  console.error('❌ Немає PENDING платежу на dev');
  process.exit(1);
}

console.log(`Found payment: ${payment.orderReference} | ${payment.user.name} <${payment.user.email}>`);

const kind = payment.bundleId ? 'bundle' : payment.courseId ? 'course' : 'unknown';
const fakeWalletEmail = 'demo.icloud.user@icloud.com';

// 1) Pending callback (signature OK)
const log1 = await prisma.paymentCallbackLog.create({
  data: {
    source: 'wayforpay',
    kind,
    orderReference: payment.orderReference,
    transactionStatus: 'Pending',
    amount: payment.amount,
    currency: payment.currency,
    clientEmail: fakeWalletEmail,
    ip: '88.85.72.203',
    userAgent: 'Mozilla/5.0 (demo)',
    signatureValid: true,
    skipped: false,
    actionsTaken: 'status:Pending',
    rawPayload: { demo: true, status: 'Pending' },
  },
});
console.log(`✅ Pending log: ${log1.id}`);

// 2) Approved callback
const log2 = await prisma.paymentCallbackLog.create({
  data: {
    source: 'wayforpay',
    kind,
    orderReference: payment.orderReference,
    transactionStatus: 'Approved',
    amount: payment.amount,
    currency: payment.currency,
    clientEmail: fakeWalletEmail,
    ip: '88.85.72.203',
    userAgent: 'Mozilla/5.0 (demo)',
    signatureValid: true,
    skipped: false,
    prevStatus: 'PENDING',
    actionsTaken: 'payment:updated,enrollment:created,sendpulse:sent(1)',
    sendpulseSlugs: 'demo-slug',
    rawPayload: { demo: true, status: 'Approved' },
  },
});
console.log(`✅ Approved log: ${log2.id}`);

console.log(`\nГо в /dashboard/admin/payment-logs — побачиш ${payment.user.name} (${payment.user.email}) + WFP: ${fakeWalletEmail}`);

await prisma.$disconnect();
