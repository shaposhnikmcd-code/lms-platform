// Швидка діагностика: скільки днів і записів попадає в "1m" series.
import prisma from './_db.mjs';

const now = new Date();
console.log('NOW:', now.toISOString());

const TZ = 'Europe/Kyiv';
const PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric', month: '2-digit', day: '2-digit',
});
const partsOf = (d) => Object.fromEntries(PARTS.formatToParts(d).map(p => [p.type, p.value]));

const p = partsOf(now);
console.log('Today in Kyiv:', p);

// Beginning and end of month Kyiv (approx)
const monthStart = new Date(`${p.year}-${p.month}-01T00:00:00+03:00`);
const monthEnd = new Date(`${p.year}-${Number(p.month) + 1 > 12 ? '01' : String(Number(p.month) + 1).padStart(2, '0')}-01T00:00:00+03:00`);

console.log('Month range:', monthStart.toISOString(), '→', monthEnd.toISOString());

const payments = await prisma.payment.findMany({
  where: {
    status: 'PAID',
    createdAt: { gte: monthStart, lt: monthEnd },
    user: { role: { notIn: ['ADMIN', 'MANAGER'] } },
  },
  select: { createdAt: true, amount: true },
});
const conn = await prisma.connectorOrder.findMany({
  where: {
    paymentStatus: 'PAID',
    amount: { gt: 1 },
    createdAt: { gte: monthStart, lt: monthEnd },
  },
  select: { createdAt: true, amount: true },
});

console.log(`\nPAID Payments (non-admin) у поточному місяці: ${payments.length}`);
console.log(`PAID ConnectorOrders у поточному місяці: ${conn.length}`);

const days = new Map();
for (const r of [...payments, ...conn]) {
  const d = partsOf(r.createdAt);
  const key = `${d.year}-${d.month}-${d.day}`;
  days.set(key, (days.get(key) || 0) + r.amount);
}

console.log(`\nДнів зі продажами в місяці: ${days.size}`);
console.log('Розклад по днях:');
for (const [k, v] of [...days.entries()].sort()) {
  console.log(`  ${k}: ${v.toLocaleString()} ₴`);
}

await prisma.$disconnect();
