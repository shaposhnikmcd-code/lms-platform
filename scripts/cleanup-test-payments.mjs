// Чистка тестових оплат (1 ₴ для course/bundle, 2 ₴ для yearly, 1-2 ₴ для конектора).
// За дефолтом DRY-RUN. Для виконання: node scripts/cleanup-test-payments.mjs --execute
//
// БЕРЕ ПРОД БД (.env, не .env.local). Pre-production і main — той самий Neon.
//
// Скоуп видалення:
//   - Payment.amount IN (1, 2) AND user.role IN ('ADMIN','MANAGER')
//     ├─ caascade: Enrollment(userId, courseId|bundle.courseIds)
//     ├─ caascade: CourseProgress(userId, courseId|bundle.courseIds)
//     ├─ caascade: LessonProgress(userId, lesson.module.courseId)
//     └─ caascade: YearlyProgramSubscription (events каскадом, payments — спочатку null, потім delete)
//   - ConnectorOrder.amount IN (1, 2) — повністю (tracking logs каскадом)
//
// ТАКОЖ ВИДАЛЯЄ: PaymentCallbackLog де amount IN (1, 2) (логи тестових callback-ів).
// НЕ ЧІПАЄ: Certificate, SendPulse доступи.

import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
// ЯВНО прод: .env (НЕ .env.local). override:true гарантує що prisma auto-load не переб'є.
config({ path: resolve(root, '.env'), override: true });

const url = process.env.DATABASE_URL || '';
const host = url.match(/@([^/?]+)/)?.[1] || '?';
console.log(`\n=== TARGET DB: ${host} ===\n`);
if (!host.includes('ep-odd-night-alip82dn')) {
  console.error('❌ Очікувався прод host ep-odd-night-alip82dn. Перерви.');
  process.exit(1);
}

const EXECUTE = process.argv.includes('--execute');
console.log(EXECUTE ? '⚠️  EXECUTE MODE — буду видаляти.\n' : '🔍 DRY-RUN (за дефолтом). Для видалення додай --execute.\n');

const prisma = new PrismaClient();

async function main() {
  // 1. Знайти кандидатів Payment
  const payments = await prisma.payment.findMany({
    where: { amount: { in: [1, 2] } },
    select: {
      id: true,
      orderReference: true,
      amount: true,
      status: true,
      createdAt: true,
      courseId: true,
      bundleId: true,
      yearlyProgramSubscriptionId: true,
      freeSlugs: true,
      user: { select: { id: true, email: true, role: true } },
      course: { select: { slug: true, title: true } },
      bundle: { select: { slug: true, title: true, courses: { select: { courseSlug: true, isFree: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Safety: тільки ADMIN/MANAGER
  const safe = payments.filter(p => p.user.role === 'ADMIN' || p.user.role === 'MANAGER');
  const unsafe = payments.filter(p => p.user.role !== 'ADMIN' && p.user.role !== 'MANAGER');

  if (unsafe.length) {
    console.log(`⚠️  ${unsafe.length} payments з amount IN (1,2) у НЕ-адмін/менеджер акаунтах — ПРОПУСКАЮ:`);
    for (const p of unsafe) {
      console.log(`   - ${p.orderReference} | ${p.amount}₴ | ${p.user.email} (${p.user.role})`);
    }
    console.log('');
  }

  // Розділити на типи. Yearly визначаємо за префіксом orderReference (включно з orphan-ами без subId)
  const byType = { course: [], bundle: [], yearly: [], unknown: [] };
  for (const p of safe) {
    if (p.yearlyProgramSubscriptionId || /^yearly-program/.test(p.orderReference)) byType.yearly.push(p);
    else if (p.bundleId) byType.bundle.push(p);
    else if (p.courseId) byType.course.push(p);
    else byType.unknown.push(p);
  }

  console.log(`📊 Payments to delete (ADMIN/MANAGER, amount IN [1,2]):`);
  console.log(`   - Курси:           ${byType.course.length}`);
  console.log(`   - Пакети:          ${byType.bundle.length}`);
  console.log(`   - Річна програма:  ${byType.yearly.length}`);
  if (byType.unknown.length) console.log(`   - Невідомий тип:   ${byType.unknown.length}`);
  console.log('');

  // Зібрати потрібні courseSlug-и для bundle-кейсу і резолвити в courseId
  const bundleSlugs = new Set();
  for (const p of byType.bundle) {
    // Платні курси завжди → доставлені
    for (const bc of p.bundle?.courses ?? []) {
      if (!bc.isFree) bundleSlugs.add(bc.courseSlug);
    }
    // CHOICE_FREE: вибрані free-слаги з Payment.freeSlugs
    for (const slug of p.freeSlugs ?? []) bundleSlugs.add(slug);
    // FIXED_FREE: всі вільні автоматично доставлені (теж включаємо)
    for (const bc of p.bundle?.courses ?? []) {
      if (bc.isFree) bundleSlugs.add(bc.courseSlug);
    }
  }
  const slugMap = new Map(); // slug → id
  if (bundleSlugs.size) {
    const courses = await prisma.course.findMany({
      where: { slug: { in: [...bundleSlugs] } },
      select: { id: true, slug: true },
    });
    for (const c of courses) slugMap.set(c.slug, c.id);
  }

  // Зібрати (userId, courseId) пари для каскаду
  const accessPairs = new Set(); // "userId|courseId"
  for (const p of byType.course) {
    if (p.courseId) accessPairs.add(`${p.user.id}|${p.courseId}`);
  }
  for (const p of byType.bundle) {
    const slugs = new Set();
    for (const bc of p.bundle?.courses ?? []) slugs.add(bc.courseSlug);
    for (const s of p.freeSlugs ?? []) slugs.add(s);
    for (const slug of slugs) {
      const cid = slugMap.get(slug);
      if (cid) accessPairs.add(`${p.user.id}|${cid}`);
    }
  }

  console.log(`📊 Course-access pairs (Enrollment+CourseProgress+LessonProgress) to delete: ${accessPairs.size}\n`);

  // YearlyProgramSubscriptions
  const yearlySubIds = [...new Set(byType.yearly.map(p => p.yearlyProgramSubscriptionId).filter(Boolean))];
  // також зачистити підписки де Є тестові payments але цей конкретний Payment не лінкований
  // (захоплено вище через yearlyProgramSubscriptionId)

  // ConnectorOrders
  const connectorOrders = await prisma.connectorOrder.findMany({
    where: { amount: { in: [1, 2] } },
    select: { id: true, orderReference: true, amount: true, email: true, fullName: true, paymentStatus: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`📊 ConnectorOrders to delete (amount IN [1,2]): ${connectorOrders.length}`);
  for (const o of connectorOrders.slice(0, 20)) {
    console.log(`   - ${o.orderReference} | ${o.amount}₴ | ${o.email} | ${o.paymentStatus} | ${o.createdAt.toISOString().slice(0,10)}`);
  }
  if (connectorOrders.length > 20) console.log(`   ... + ще ${connectorOrders.length - 20}`);
  console.log('');

  // PaymentCallbackLog: за amount IN (1,2), плюс по orderReference тестових Payment/ConnectorOrder
  const testRefs = [...safe.map(p => p.orderReference), ...connectorOrders.map(o => o.orderReference)].filter(Boolean);
  const callbackLogsCount = await prisma.paymentCallbackLog.count({
    where: {
      OR: [
        { amount: { in: [1, 2] } },
        ...(testRefs.length ? [{ orderReference: { in: testRefs } }] : []),
      ],
    },
  });
  console.log(`📊 PaymentCallbackLog rows to delete: ${callbackLogsCount}\n`);

  // Розшифрування Payment
  console.log(`📋 Detail (top 30 newest):`);
  for (const p of safe.slice(0, 30)) {
    const kind = p.yearlyProgramSubscriptionId ? 'YEARLY' : p.bundleId ? `BUNDLE(${p.bundle?.slug})` : p.courseId ? `COURSE(${p.course?.slug})` : 'UNKNOWN';
    console.log(`   - ${p.orderReference} | ${p.amount}₴ | ${kind} | ${p.user.email} (${p.user.role}) | ${p.status} | ${p.createdAt.toISOString().slice(0,10)}`);
  }
  if (safe.length > 30) console.log(`   ... + ще ${safe.length - 30}`);
  console.log('');

  if (!EXECUTE) {
    console.log('🔍 DRY-RUN — нічого не видалено. Для запуску: node scripts/cleanup-test-payments.mjs --execute');
    return;
  }

  console.log('⚠️  EXECUTING DELETION...\n');

  await prisma.$transaction(async (tx) => {
    // 1. LessonProgress по парах user+course (через lesson.module.courseId)
    let lpDel = 0;
    for (const pair of accessPairs) {
      const [userId, courseId] = pair.split('|');
      const r = await tx.lessonProgress.deleteMany({
        where: { userId, lesson: { module: { courseId } } },
      });
      lpDel += r.count;
    }
    console.log(`✅ LessonProgress deleted: ${lpDel}`);

    // 2. CourseProgress
    let cpDel = 0;
    for (const pair of accessPairs) {
      const [userId, courseId] = pair.split('|');
      const r = await tx.courseProgress.deleteMany({ where: { userId, courseId } });
      cpDel += r.count;
    }
    console.log(`✅ CourseProgress deleted: ${cpDel}`);

    // 3. Enrollment
    let enrDel = 0;
    for (const pair of accessPairs) {
      const [userId, courseId] = pair.split('|');
      const r = await tx.enrollment.deleteMany({ where: { userId, courseId } });
      enrDel += r.count;
    }
    console.log(`✅ Enrollment deleted: ${enrDel}`);

    // 4. Спочатку відв'язати Payment-и від YearlyProgramSubscription (FK без cascade)
    //    і видалити Payment-и
    const paymentIds = safe.map(p => p.id);
    const payDel = await tx.payment.deleteMany({ where: { id: { in: paymentIds } } });
    console.log(`✅ Payment deleted: ${payDel.count}`);

    // 5. Тепер subscription можна дропати (events — Cascade FK)
    if (yearlySubIds.length) {
      // Перевірити чи на цих subscription-ах не лишилось інших Payment-ів (реальних)
      const remaining = await tx.payment.findMany({
        where: { yearlyProgramSubscriptionId: { in: yearlySubIds } },
        select: { id: true, yearlyProgramSubscriptionId: true, amount: true, orderReference: true },
      });
      if (remaining.length) {
        console.log(`⚠️  ${remaining.length} Payment-ів залишились на тестових підписках (НЕ 1₴/2₴). Subscriptions НЕ видаляю:`);
        for (const r of remaining) console.log(`   - ${r.orderReference} ${r.amount}₴ → sub ${r.yearlyProgramSubscriptionId}`);
        const safeSubIds = yearlySubIds.filter(id => !remaining.some(r => r.yearlyProgramSubscriptionId === id));
        const subDel = await tx.yearlyProgramSubscription.deleteMany({ where: { id: { in: safeSubIds } } });
        console.log(`✅ YearlyProgramSubscription deleted (без тих що з реальними payments): ${subDel.count}`);
      } else {
        const subDel = await tx.yearlyProgramSubscription.deleteMany({ where: { id: { in: yearlySubIds } } });
        console.log(`✅ YearlyProgramSubscription deleted: ${subDel.count}`);
      }
    }

    // 6. ConnectorOrders (tracking logs — Cascade FK)
    const coIds = connectorOrders.map(o => o.id);
    const coDel = await tx.connectorOrder.deleteMany({ where: { id: { in: coIds } } });
    console.log(`✅ ConnectorOrder deleted: ${coDel.count}`);

    // 7. PaymentCallbackLog (тестові)
    const logDel = await tx.paymentCallbackLog.deleteMany({
      where: {
        OR: [
          { amount: { in: [1, 2] } },
          ...(testRefs.length ? [{ orderReference: { in: testRefs } }] : []),
        ],
      },
    });
    console.log(`✅ PaymentCallbackLog deleted: ${logDel.count}`);
  }, { timeout: 60000 });

  console.log('\n✅ DONE.');
}

main()
  .catch(e => { console.error('❌ ERROR:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
