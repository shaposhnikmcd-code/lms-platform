/// Readonly: зависання PENDING у Річній — старші за 2 дні, з розбивкою
/// «намагався платити (є FAILED-платіж)» vs «покинув до оплати (платежу нема)».
import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '..', '.env'), override: true });
const prisma = new PrismaClient();

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
const cutoff = new Date(Date.now() - TWO_DAYS_MS);

const subs = await prisma.yearlyProgramSubscription.findMany({
  where: { status: 'PENDING', createdAt: { lt: cutoff } },
  orderBy: { createdAt: 'asc' },
  select: {
    id: true,
    createdAt: true,
    user: { select: { email: true, name: true } },
    payments: { select: { status: true } },
  },
});

let tried = 0, abandoned = 0, paidAnomaly = 0;
console.log(`PENDING старші за 2 дні (cutoff ${cutoff.toISOString().slice(0,10)}): ${subs.length}\n`);
for (const s of subs) {
  const hasPaid = s.payments.some((p) => p.status === 'PAID');
  const hasFailed = s.payments.some((p) => p.status === 'FAILED');
  const kind = hasPaid ? 'PAID(!)' : hasFailed ? 'намагався (FAILED)' : 'покинув (без платежу)';
  if (hasPaid) paidAnomaly++; else if (hasFailed) tried++; else abandoned++;
  console.log(`  ${s.createdAt.toISOString().slice(0,10)}  ${kind.padEnd(22)} ${s.user?.email ?? '—'}`);
}
console.log(`\nРазом: намагався=${tried}  покинув=${abandoned}  з PAID(не чіпати!)=${paidAnomaly}`);

await prisma.$disconnect();
