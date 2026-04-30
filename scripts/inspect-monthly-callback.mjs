import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
config({ path: resolve(root, '.env'), override: true });

const prisma = new PrismaClient();

const log = await prisma.paymentCallbackLog.findFirst({
  where: { orderReference: 'yearly-program-monthly_1777452809473_781bbf38' },
  select: { id: true, rawPayload: true },
});

if (log?.rawPayload) {
  const keys = Object.keys(log.rawPayload).sort();
  console.log('Raw callback keys:', keys);
  console.log('\nFull payload:');
  console.log(JSON.stringify(log.rawPayload, null, 2));
}

await prisma.$disconnect();
