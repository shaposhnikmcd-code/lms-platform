// Readonly-діагностика: чому /yearly-program, /payments, /payment-logs показують різні числа
// для Річної програми. Жодних мутацій. Цілеспрямовано б'є у ПРОД (.env), бо сторінки — прод.
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, '..', '.env'), override: true });
const prisma = new PrismaClient();

function line() { console.log('─'.repeat(64)); }

const dbUrl = process.env.DATABASE_URL ?? '';
const host = dbUrl.match(/@([^/?]+)/)?.[1] ?? 'unknown';
console.log(`DB host: ${host}`);
line();

// 1) Підписки (джерело /yearly-program)
const subsByStatus = await prisma.yearlyProgramSubscription.groupBy({
  by: ['status'],
  _count: { _all: true },
});
const subsByPlan = await prisma.yearlyProgramSubscription.groupBy({
  by: ['plan', 'autoRenew'],
  _count: { _all: true },
});
const subsTotal = await prisma.yearlyProgramSubscription.count();
const subsWithPaid = await prisma.yearlyProgramSubscription.count({
  where: { payments: { some: { status: 'PAID' } } },
});

console.log('SUBSCRIPTIONS (джерело /yearly-program)');
console.log(`  total subscriptions: ${subsTotal}`);
console.log(`  з ≥1 PAID-платежем:  ${subsWithPaid}`);
console.log('  by status:', subsByStatus.map(s => `${s.status}=${s._count._all}`).join('  '));
console.log('  by plan/autoRenew:', subsByPlan.map(s => `${s.plan}${s.autoRenew ? '+auto' : ''}=${s._count._all}`).join('  '));
line();

// 2) Платежі, прив'язані до Річної (джерело /payments)
const payByStatus = await prisma.payment.groupBy({
  by: ['status'],
  where: { yearlyProgramSubscriptionId: { not: null } },
  _count: { _all: true },
  _sum: { amount: true },
});
const payTotal = await prisma.payment.count({ where: { yearlyProgramSubscriptionId: { not: null } } });

console.log('PAYMENTS yearly-linked (джерело /payments)');
console.log(`  total payment-рядків: ${payTotal}`);
for (const p of payByStatus) {
  console.log(`  ${p.status}: count=${p._count._all}  sum=${p._sum.amount ?? 0}₴`);
}
line();

// 3) Callback-логи kind=yearly|monthly (джерело /payment-logs)
const logByKind = await prisma.paymentCallbackLog.groupBy({
  by: ['kind', 'transactionStatus', 'skipped', 'signatureValid'],
  where: { kind: { in: ['yearly', 'monthly'] } },
  _count: { _all: true },
});
const logTotal = await prisma.paymentCallbackLog.count({ where: { kind: { in: ['yearly', 'monthly'] } } });

console.log('CALLBACK LOGS kind=yearly|monthly (джерело /payment-logs)');
console.log(`  total log-рядків: ${logTotal}`);
for (const l of logByKind.sort((a, b) => b._count._all - a._count._all)) {
  const flags = [
    `status=${l.transactionStatus}`,
    l.skipped ? 'SKIPPED' : null,
    !l.signatureValid ? 'BAD-SIG' : null,
  ].filter(Boolean).join(' ');
  console.log(`  ${l.kind.padEnd(8)} ${String(l._count._all).padStart(4)}  ${flags}`);
}
line();

// 4) Кросс-чек цілісності
// 4a) PAID-платежі Річної без підписки (orphan)
const orphanPaid = await prisma.payment.count({
  where: { status: 'PAID', yearlyProgramSubscriptionId: null, orderReference: { startsWith: 'yearly-program' } },
});
// 4b) Підписки без жодного платежу взагалі
const subsNoPay = await prisma.yearlyProgramSubscription.count({
  where: { payments: { none: {} } },
});
// 4c) Approved-логи yearly|monthly, для яких немає Payment з тим orderReference
const approvedLogs = await prisma.paymentCallbackLog.findMany({
  where: { kind: { in: ['yearly', 'monthly'] }, transactionStatus: 'Approved', skipped: false, signatureValid: true },
  select: { orderReference: true },
});
const approvedRefs = [...new Set(approvedLogs.map(l => l.orderReference).filter(Boolean))];
const payRefs = new Set(
  (await prisma.payment.findMany({
    where: { orderReference: { in: approvedRefs } },
    select: { orderReference: true },
  })).map(p => p.orderReference)
);
const logsNoPayment = approvedRefs.filter(r => !payRefs.has(r));

console.log('КРОСС-ЧЕК ЦІЛІСНОСТІ');
console.log(`  PAID yearly-платежі без підписки (orphan): ${orphanPaid}`);
console.log(`  Підписки взагалі без платежів:             ${subsNoPay}`);
console.log(`  Approved-логи без Payment-запису:          ${logsNoPayment.length}`);
if (logsNoPayment.length) console.log('    orderRefs:', logsNoPayment.slice(0, 20).join(', '));
line();

console.log('ПІДСУМОК — очікувані причини розбіжності:');
console.log('  • /yearly-program рахує ПІДПИСКИ, /payments — ПЛАТЕЖІ (autopay → 1 sub = N платежів)');
console.log('  • /payments включає не лише PAID (PENDING/FAILED теж)');
console.log('  • /payment-logs рахує КОЖЕН callback (skipped/bad-sig/duplicate теж)');

await prisma.$disconnect();
