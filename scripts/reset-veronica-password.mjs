// One-off: clear password + lastLoginAt for ogbunujuveronica@gmail.com on PROD,
// so she can re-claim a fresh password on next email login (or use OAuth).
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
config({ path: resolve(root, '.env'), override: true });

const prisma = new PrismaClient();
const email = 'ogbunujuveronica@gmail.com';

const before = await prisma.user.findUnique({
  where: { email },
  select: { id: true, email: true, role: true, password: true, lastLoginAt: true, deletedAt: true },
});
console.log('BEFORE:', before);

if (!before) {
  console.log('User not found — nothing to do.');
  await prisma.$disconnect();
  process.exit(0);
}

const updated = await prisma.user.update({
  where: { email },
  data: { password: null, lastLoginAt: null },
  select: { id: true, email: true, role: true, password: true, lastLoginAt: true },
});
console.log('AFTER:', updated);

await prisma.$disconnect();
