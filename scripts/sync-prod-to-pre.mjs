// Sync налаштувань з prod-Neon у pre-Neon. Idempotent (upsert по unique keys), без deletes.
// Що копіюємо: каталог курсів (Course), override цін (CoursePriceOverride),
// категорійні промо (CategoryPromoOverride), пакети (Bundle + BundleCourse),
// налаштування спеціалістів (SpecialistOverride), колеги (User role ADMIN/MANAGER,
// без deletedAt) + їх Account (OAuth-зв'язки) + UserAuditLog.
//
// Що НЕ копіюємо: будь-які платежі/логи/enrollments/сертифікати/підписки/news/сесії/токени.
//
// Запуск:
//   1. Створи `.env.sync` (gitignored) у корені проекту:
//      PROD_DATABASE_URL=postgresql://...@ep-odd-night-alip82dn.../neondb?sslmode=require
//      PRE_DATABASE_URL=postgresql://...@ep-proud-paper-aliphx2d.../neondb?sslmode=require
//      (Використовуй DIRECT URL обох — без -pooler. Скрипт-сесія коротка, pooler не потрібен.)
//   2. Dry-run (нічого не пише): `node scripts/sync-prod-to-pre.mjs`
//   3. Реально виконати: `node scripts/sync-prod-to-pre.mjs --execute`

import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

config({ path: resolve(root, '.env.sync'), override: true });

const PROD_URL = process.env.PROD_DATABASE_URL;
const PRE_URL = process.env.PRE_DATABASE_URL;

if (!PROD_URL || !PRE_URL) {
  console.error('❌ Відсутні PROD_DATABASE_URL або PRE_DATABASE_URL у .env.sync');
  process.exit(1);
}

const prodHost = new URL(PROD_URL).host;
const preHost = new URL(PRE_URL).host;

if (!prodHost.includes('ep-odd-night-alip82dn')) {
  console.error(`❌ PROD очікувано ep-odd-night-alip82dn, отримано: ${prodHost}`);
  process.exit(1);
}
if (!preHost.includes('ep-proud-paper-aliphx2d')) {
  console.error(`❌ PRE очікувано ep-proud-paper-aliphx2d, отримано: ${preHost}`);
  process.exit(1);
}

const EXECUTE = process.argv.includes('--execute');

console.log('─'.repeat(70));
console.log(`SOURCE (prod) : ${prodHost}`);
console.log(`TARGET (pre)  : ${preHost}`);
console.log(`Mode          : ${EXECUTE ? '🔴 EXECUTE (запис у pre)' : '🟢 DRY-RUN (тільки читання)'}`);
console.log('─'.repeat(70));

const prod = new PrismaClient({ datasourceUrl: PROD_URL });
const pre = new PrismaClient({ datasourceUrl: PRE_URL });

const stats = {};
function bump(table, action) {
  stats[table] ??= { create: 0, update: 0, skip: 0 };
  stats[table][action]++;
}

async function syncCourse() {
  const rows = await prod.course.findMany();
  for (const r of rows) {
    const exists = await pre.course.findUnique({ where: { id: r.id } });
    bump('Course', exists ? 'update' : 'create');
    if (!EXECUTE) continue;
    await pre.course.upsert({
      where: { id: r.id },
      create: r,
      update: {
        title: r.title,
        description: r.description,
        price: r.price,
        published: r.published,
        imageUrl: r.imageUrl,
        slug: r.slug,
        sendpulseCourseId: r.sendpulseCourseId,
      },
    });
  }
}

async function syncCoursePriceOverride() {
  const rows = await prod.coursePriceOverride.findMany();
  for (const r of rows) {
    const exists = await pre.coursePriceOverride.findUnique({ where: { slug: r.slug } });
    bump('CoursePriceOverride', exists ? 'update' : 'create');
    if (!EXECUTE) continue;
    const { id, createdAt, updatedAt, ...rest } = r;
    await pre.coursePriceOverride.upsert({
      where: { slug: r.slug },
      create: { id, ...rest },
      update: rest,
    });
  }
}

async function syncCategoryPromoOverride() {
  const rows = await prod.categoryPromoOverride.findMany();
  for (const r of rows) {
    const exists = await pre.categoryPromoOverride.findUnique({ where: { category: r.category } });
    bump('CategoryPromoOverride', exists ? 'update' : 'create');
    if (!EXECUTE) continue;
    const { id, createdAt, updatedAt, ...rest } = r;
    await pre.categoryPromoOverride.upsert({
      where: { category: r.category },
      create: { id, ...rest },
      update: rest,
    });
  }
}

async function syncBundles() {
  const bundles = await prod.bundle.findMany({ include: { courses: true } });
  for (const b of bundles) {
    const exists = await pre.bundle.findUnique({ where: { id: b.id } });
    bump('Bundle', exists ? 'update' : 'create');
    if (EXECUTE) {
      const { courses, ...bundleData } = b;
      await pre.bundle.upsert({
        where: { id: b.id },
        create: bundleData,
        update: bundleData,
      });
      // BundleCourse: чистимо стару link-таблицю цього бандла на pre і заливаємо знову.
      await pre.bundleCourse.deleteMany({ where: { bundleId: b.id } });
      for (const bc of courses) {
        await pre.bundleCourse.create({ data: bc });
        bump('BundleCourse', 'create');
      }
    } else {
      for (const bc of b.courses) {
        const exists = await pre.bundleCourse.findUnique({
          where: { bundleId_courseSlug: { bundleId: bc.bundleId, courseSlug: bc.courseSlug } },
        });
        bump('BundleCourse', exists ? 'update' : 'create');
      }
    }
  }
}

async function syncSpecialistOverride() {
  const rows = await prod.specialistOverride.findMany();
  for (const r of rows) {
    const exists = await pre.specialistOverride.findUnique({ where: { slug: r.slug } });
    bump('SpecialistOverride', exists ? 'update' : 'create');
    if (!EXECUTE) continue;
    const { id, createdAt, updatedAt, ...rest } = r;
    await pre.specialistOverride.upsert({
      where: { slug: r.slug },
      create: { id, ...rest },
      update: rest,
    });
  }
}

async function syncUsers() {
  const users = await prod.user.findMany({
    where: { role: { in: ['ADMIN', 'MANAGER'] }, deletedAt: null },
  });
  const userIds = new Set(users.map((u) => u.id));

  for (const u of users) {
    const exists = await pre.user.findUnique({ where: { id: u.id } });
    bump('User', exists ? 'update' : 'create');
    if (!EXECUTE) continue;
    await pre.user.upsert({
      where: { id: u.id },
      create: u,
      update: {
        name: u.name,
        email: u.email,
        emailVerified: u.emailVerified,
        password: u.password,
        image: u.image,
        role: u.role,
        lastLoginAt: u.lastLoginAt,
        deletedAt: u.deletedAt,
      },
    });
  }

  // Account для тих самих юзерів (OAuth Google links).
  const accounts = await prod.account.findMany({ where: { userId: { in: [...userIds] } } });
  for (const a of accounts) {
    const exists = await pre.account.findUnique({
      where: { provider_providerAccountId: { provider: a.provider, providerAccountId: a.providerAccountId } },
    });
    bump('Account', exists ? 'update' : 'create');
    if (!EXECUTE) continue;
    await pre.account.upsert({
      where: { provider_providerAccountId: { provider: a.provider, providerAccountId: a.providerAccountId } },
      create: a,
      update: a,
    });
  }

  // UserAuditLog для скопійованих юзерів.
  const logs = await prod.userAuditLog.findMany({ where: { userId: { in: [...userIds] } } });
  for (const l of logs) {
    const exists = await pre.userAuditLog.findUnique({ where: { id: l.id } });
    bump('UserAuditLog', exists ? 'update' : 'create');
    if (!EXECUTE) continue;
    await pre.userAuditLog.upsert({
      where: { id: l.id },
      create: l,
      update: l,
    });
  }
}

try {
  await syncCourse();
  await syncCoursePriceOverride();
  await syncCategoryPromoOverride();
  await syncBundles();
  await syncSpecialistOverride();
  await syncUsers();

  console.log('\nРезультат:');
  for (const [table, s] of Object.entries(stats)) {
    console.log(`  ${table.padEnd(24)} create=${s.create}  update=${s.update}`);
  }
  console.log('─'.repeat(70));
  console.log(EXECUTE ? '✅ Sync завершено.' : '🟢 Dry-run завершено. Додай --execute щоб справді виконати.');
} catch (e) {
  console.error('\n❌ Помилка:', e.message);
  console.error(e.stack);
  process.exit(1);
} finally {
  await prod.$disconnect();
  await pre.$disconnect();
}
