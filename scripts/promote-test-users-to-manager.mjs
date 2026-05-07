// Одноразово: підняти 2 тестові акаунти до MANAGER, щоб cleanup-test-payments.mjs їх захопив.
// Прод БД (.env). Запуск: node scripts/promote-test-users-to-manager.mjs

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
if (!host.includes('ep-odd-night-alip82dn')) {
  console.error('❌ Очікувався прод host ep-odd-night-alip82dn. Перерви.');
  process.exit(1);
}

const EMAILS = ['andersen.pm2020@gmail.com', 'Polandemigrants@gmail.com'];

const prisma = new PrismaClient();
try {
  for (const email of EMAILS) {
    const u = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
    if (!u) {
      console.log(`⚠️  not found: ${email}`);
      continue;
    }
    if (u.role === 'MANAGER' || u.role === 'ADMIN') {
      console.log(`✓ already ${u.role}: ${email}`);
      continue;
    }
    await prisma.user.update({ where: { id: u.id }, data: { role: 'MANAGER' } });
    console.log(`✅ ${email}: ${u.role} → MANAGER`);
  }
} finally {
  await prisma.$disconnect();
}
