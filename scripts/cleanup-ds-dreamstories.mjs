import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
config({ path: resolve(root, '.env'), override: true });

const url = process.env.DATABASE_URL || '';
const host = url.match(/@([^/?]+)/)?.[1] || '?';
console.log(`\n=== TARGET DB: ${host} ===\n`);
if (!host.includes('ep-odd-night-alip82dn')) { console.error('not prod'); process.exit(1); }

const EXECUTE = process.argv.includes('--execute');
const prisma = new PrismaClient();

const cnt = await prisma.paymentCallbackLog.count({ where: { clientEmail: 'ds.dreamstories@gmail.com' } });
console.log(`ds.dreamstories logs: ${cnt}`);

if (EXECUTE) {
  const r = await prisma.paymentCallbackLog.deleteMany({ where: { clientEmail: 'ds.dreamstories@gmail.com' } });
  console.log(`✅ deleted: ${r.count}`);
} else {
  console.log('DRY-RUN. --execute щоб видалити.');
}

await prisma.$disconnect();
