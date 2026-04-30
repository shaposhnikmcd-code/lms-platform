// READONLY діагностика: показує всіх не-видалених юзерів з ролями, відмінними
// від ADMIN/MANAGER (legacy STUDENT/TEACHER), щоб з'ясувати звідки на дашборді
// беруться "зайві" 5 акаунтів. Працює проти ПРОДу через .env (минаючи
// .env.local-override з _db.mjs), бо питання саме про прод-цифри.
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
config({ path: resolve(root, '.env'), override: true });

const prisma = new PrismaClient();

const url = process.env.DATABASE_URL || '';
const host = url.match(/@([^/?]+)/)?.[1] || '?';
console.log(`DB host: ${host}`);
console.log('');

const all = await prisma.user.count();
const notDeleted = await prisma.user.count({ where: { deletedAt: null } });
const adminMgr = await prisma.user.count({
  where: { deletedAt: null, role: { in: ['ADMIN', 'MANAGER'] } },
});
const deleted = await prisma.user.count({ where: { deletedAt: { not: null } } });

console.log(`Усього юзерів у БД:           ${all}`);
console.log(`Не видалених (dashboard):     ${notDeleted}`);
console.log(`ADMIN + MANAGER (users page): ${adminMgr}`);
console.log(`Видалених (deletedAt != null): ${deleted}`);
console.log(`Різниця (legacy STUDENT/TEACHER/інше): ${notDeleted - adminMgr}`);
console.log('');

const legacy = await prisma.user.findMany({
  where: {
    deletedAt: null,
    role: { notIn: ['ADMIN', 'MANAGER'] },
  },
  select: {
    id: true,
    email: true,
    name: true,
    role: true,
    createdAt: true,
    lastLoginAt: true,
    password: true,
    _count: { select: { enrollments: true, accounts: true } },
  },
  orderBy: { createdAt: 'asc' },
});

console.log(`=== Legacy юзери (${legacy.length}) ===`);
for (const u of legacy) {
  console.log(
    `- [${u.role}] ${u.email}  | name=${u.name || '∅'}  | created=${u.createdAt.toISOString().slice(0, 10)}  | lastLogin=${u.lastLoginAt ? u.lastLoginAt.toISOString().slice(0, 10) : '∅'}  | hasPassword=${!!u.password}  | enroll=${u._count.enrollments}  | oauth=${u._count.accounts}`
  );
}

if (deleted > 0) {
  console.log('');
  const dels = await prisma.user.findMany({
    where: { deletedAt: { not: null } },
    select: {
      email: true,
      role: true,
      deletedAt: true,
      deletedByEmail: true,
    },
    orderBy: { deletedAt: 'desc' },
  });
  console.log(`=== Видалені юзери (${dels.length}) ===`);
  for (const u of dels) {
    console.log(
      `- [${u.role}] ${u.email}  | deleted=${u.deletedAt?.toISOString().slice(0, 10)}  | by=${u.deletedByEmail || '∅'}`
    );
  }
}

await prisma.$disconnect();
