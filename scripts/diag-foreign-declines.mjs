// READONLY діагностика: відмови по картках з PaymentCallbackLog.
// Групує по issuerBankCountry + reasonCode, щоб відділити іноземні відмови від українських.
// Нічого не мутує. Запуск проти прод-бази (тимчасово закоментувати DATABASE_URL у .env.local).
import prisma from './_db.mjs';

const SINCE_DAYS = 120;
const since = new Date(Date.now() - SINCE_DAYS * 24 * 60 * 60 * 1000);

const logs = await prisma.paymentCallbackLog.findMany({
  where: { source: 'wayforpay', createdAt: { gt: since } },
  select: { rawPayload: true, transactionStatus: true, kind: true, createdAt: true },
  orderBy: { createdAt: 'desc' },
});

console.log(`\nPaymentCallbackLog (wayforpay) за ${SINCE_DAYS} днів: ${logs.length} рядків\n`);

const statusCount = {};
const declineByCountry = {};
const declineByReason = {};
const foreignDeclineSamples = [];
const foreignSuccessCount = {};

const UA = (c) => !c || c === 'UA' || c === 'UKR' || c === 'Ukraine' || c === '804';

for (const l of logs) {
  const p = l.rawPayload || {};
  const status = p.transactionStatus || l.transactionStatus || 'unknown';
  statusCount[status] = (statusCount[status] || 0) + 1;

  const country = p.issuerBankCountry || p.issuerBankCountryIso || null;
  const reason = `${p.reasonCode ?? '?'} ${p.reason ?? ''}`.trim();

  if (status === 'Declined' || status === 'Decline' || status === 'Expired') {
    const ck = country || '(невідомо)';
    declineByCountry[ck] = (declineByCountry[ck] || 0) + 1;
    declineByReason[reason] = (declineByReason[reason] || 0) + 1;
    if (!UA(country) && foreignDeclineSamples.length < 25) {
      foreignDeclineSamples.push({
        date: l.createdAt.toISOString().slice(0, 10),
        country, reason, status,
        bank: p.issuerBankName || '',
        card: p.cardPan || '',
        type: p.cardType || '',
      });
    }
  }
  if (status === 'Approved' && !UA(country)) {
    foreignSuccessCount[country || '(невідомо)'] = (foreignSuccessCount[country || '(невідомо)'] || 0) + 1;
  }
}

const sortObj = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]);

console.log('=== Статуси (всі) ===');
for (const [k, v] of sortObj(statusCount)) console.log(`  ${k}: ${v}`);

console.log('\n=== Відмови/Expired по країні банку ===');
for (const [k, v] of sortObj(declineByCountry)) console.log(`  ${k}: ${v}`);

console.log('\n=== Відмови/Expired по reasonCode ===');
for (const [k, v] of sortObj(declineByReason).slice(0, 15)) console.log(`  ${k}: ${v}`);

console.log('\n=== Успішні ІНОЗЕМНІ оплати по країні ===');
const fs = sortObj(foreignSuccessCount);
if (fs.length === 0) console.log('  (немає або країна не передається)');
for (const [k, v] of fs) console.log(`  ${k}: ${v}`);

console.log('\n=== Приклади ІНОЗЕМНИХ відмов (до 25) ===');
if (foreignDeclineSamples.length === 0) console.log('  (немає — або issuerBankCountry не зберігається в callback)');
for (const s of foreignDeclineSamples) {
  console.log(`  ${s.date} | ${s.country} | ${s.status} | reason=${s.reason} | ${s.bank} | ${s.card} ${s.type}`);
}

// Чи взагалі є поле issuerBankCountry в payload?
const withCountry = logs.filter((l) => (l.rawPayload || {}).issuerBankCountry).length;
console.log(`\nℹ️ Рядків де є issuerBankCountry у payload: ${withCountry}/${logs.length}`);

await prisma.$disconnect();
