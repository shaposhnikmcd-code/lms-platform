// Швидка діагностика: до якої БД конектимся через поточний env.
// Показує host + ім'я БД + кількість таблиць (sanity-check що БД жива).
// Викликати: `node scripts/whoami-db.mjs`
import prisma from './_db.mjs';

const url = process.env.DATABASE_URL ?? '';
const host = url ? new URL(url).host : '(unset)';
const dbName = url ? new URL(url).pathname.replace(/^\//, '') : '(unset)';

const known = {
  'ep-odd-night-alip82dn': '🔴 PROD',
  'ep-sparkling-wave-alq11hyy': '🟢 DEV (local Neon branch)',
};
const tag = Object.entries(known).find(([h]) => host.includes(h))?.[1] ?? '⚪ UNKNOWN (likely PRE)';

console.log('─────────────────────────────');
console.log('DB host  :', host);
console.log('DB name  :', dbName);
console.log('Tag      :', tag);

try {
  const [{ count }] = await prisma.$queryRaw`SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public'`;
  console.log('Tables   :', count, '(public schema)');
  const userCount = await prisma.user.count();
  console.log('Users    :', userCount);
} catch (e) {
  console.error('❌ Query failed:', e.message);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
console.log('─────────────────────────────');
