/// Повне очищення тестових платіжних даних.
/// DRY RUN за замовчуванням. Для виконання додай --execute.
///
/// Чистить:
///   - Payment                           (всі)
///   - PaymentCallbackLog                (всі)
///   - YearlyProgramSubscription         (всі) + YearlyProgramSubscriptionEvent каскадом
///   - ConnectorOrder                    (всі)
///
/// НЕ чіпає:
///   - User, Course, Bundle, News (контент і акаунти)
///   - Enrollment (щоб не зламати доступ до курсів; додай --with-enrollments якщо треба)
///
/// Використання:
///   node scripts/wipeAllPaymentData.mjs                  # dry-run: показує скільки буде видалено
///   node scripts/wipeAllPaymentData.mjs --execute        # реально видаляє
///   node scripts/wipeAllPaymentData.mjs --execute --with-enrollments   # ще й Enrollments

import prisma from './_db.mjs';

const EXECUTE = process.argv.includes('--execute');
const WITH_ENROLLMENTS = process.argv.includes('--with-enrollments');

try {
  console.log('🔍 Сканую платіжні дані…\n');

  const [
    paymentCount,
    callbackLogCount,
    subCount,
    eventCount,
    connectorCount,
    enrollmentCount,
  ] = await Promise.all([
    prisma.payment.count(),
    prisma.paymentCallbackLog.count(),
    prisma.yearlyProgramSubscription.count(),
    prisma.yearlyProgramSubscriptionEvent.count(),
    prisma.connectorOrder.count(),
    prisma.enrollment.count(),
  ]);

  console.log('Знайдено:');
  console.log(`  Payment:                          ${paymentCount}`);
  console.log(`  PaymentCallbackLog:               ${callbackLogCount}`);
  console.log(`  YearlyProgramSubscription:        ${subCount}`);
  console.log(`  YearlyProgramSubscriptionEvent:   ${eventCount} (cascade при видаленні підписки)`);
  console.log(`  ConnectorOrder:                   ${connectorCount}`);
  console.log(`  Enrollment:                       ${enrollmentCount} ${WITH_ENROLLMENTS ? '(буде видалено)' : '(лишаю — додай --with-enrollments щоб чистити)'}`);

  const dbUrl = process.env.DATABASE_URL ?? '';
  const dbHost = dbUrl.replace(/^.*@/, '').replace(/\/.*$/, '');
  console.log(`\nDB host: ${dbHost || '(не визначено)'}`);

  if (!EXECUTE) {
    console.log('\n⚠️  Це DRY RUN. Нічого не видалено.');
    console.log('   Для виконання: node scripts/wipeAllPaymentData.mjs --execute');
    console.log('   (додай --with-enrollments щоб ще й Enrollment почистити)');
    process.exit(0);
  }

  console.log('\n🗑  Видаляю…');

  // Порядок важливий через FK:
  // 1) Payment має FK → YearlyProgramSubscription (yearlyProgramSubscriptionId).
  //    Отже, Payment видаляємо першим, інакше видалення підписок впаде.
  // 2) YearlyProgramSubscription → каскадно видаляє events (per schema).
  // 3) PaymentCallbackLog — без FK на Payment, видаляємо будь-коли.
  // 4) ConnectorOrder — без FK зовнішнього, видаляємо будь-коли.
  // 5) Enrollment — опційно.

  const delPayments = await prisma.payment.deleteMany({});
  console.log(`  ✓ Payment видалено:                       ${delPayments.count}`);

  const delSubs = await prisma.yearlyProgramSubscription.deleteMany({});
  console.log(`  ✓ YearlyProgramSubscription видалено:     ${delSubs.count} (events каскадно)`);

  const delLogs = await prisma.paymentCallbackLog.deleteMany({});
  console.log(`  ✓ PaymentCallbackLog видалено:            ${delLogs.count}`);

  const delConnector = await prisma.connectorOrder.deleteMany({});
  console.log(`  ✓ ConnectorOrder видалено:                ${delConnector.count}`);

  if (WITH_ENROLLMENTS) {
    const delEnrollments = await prisma.enrollment.deleteMany({});
    console.log(`  ✓ Enrollment видалено:                    ${delEnrollments.count}`);
  } else {
    console.log('  - Enrollment не чіпав (без --with-enrollments)');
  }

  console.log('\n✅ Готово.');
} finally {
  await prisma.$disconnect();
}
