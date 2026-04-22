import prisma from './_db.mjs';

const EXECUTE = process.argv.includes('--execute');

try {
  console.log('🔍 Сканую тестові дані Річної програми…\n');

  const subs = await prisma.yearlyProgramSubscription.findMany({
    select: { id: true, plan: true, status: true, user: { select: { email: true } } },
  });
  const subIds = subs.map((s) => s.id);

  const eventsCount = await prisma.yearlyProgramSubscriptionEvent.count({
    where: { subscriptionId: { in: subIds } },
  });

  const yearlyPayments = await prisma.payment.findMany({
    where: {
      OR: [
        { yearlyProgramSubscriptionId: { in: subIds } },
        { orderReference: { startsWith: 'yearly-program' } },
      ],
    },
    select: { id: true, orderReference: true, amount: true, status: true },
  });

  const callbackLogs = await prisma.paymentCallbackLog.count({
    where: {
      OR: [
        { kind: { in: ['yearly', 'monthly'] } },
        { orderReference: { startsWith: 'yearly-program' } },
      ],
    },
  });

  console.log('Знайдено:');
  console.log(`  YearlyProgramSubscription:        ${subs.length}`);
  console.log(`  YearlyProgramSubscriptionEvent:   ${eventsCount} (cascade при видаленні підписки)`);
  console.log(`  Payment (yearly-program*):        ${yearlyPayments.length}`);
  console.log(`  PaymentCallbackLog (yearly/monthly): ${callbackLogs}`);

  if (subs.length > 0) {
    console.log('\nПідписки до видалення:');
    for (const s of subs) {
      console.log(`  - ${s.id}  ${s.plan}/${s.status}  ${s.user?.email ?? '—'}`);
    }
  }
  if (yearlyPayments.length > 0) {
    console.log('\nПлатежі до видалення:');
    for (const p of yearlyPayments) {
      console.log(`  - ${p.orderReference}  ${p.status}  ${p.amount}₴`);
    }
  }

  if (!EXECUTE) {
    console.log('\n⚠️  Це DRY RUN. Нічого не видалено.');
    console.log('   Для виконання: node scripts/wipeYearlyTestData.mjs --execute');
    process.exit(0);
  }

  console.log('\n🗑  Видаляю…');

  // 1) Payments спершу (FK на subscription, не cascade)
  const delPayments = await prisma.payment.deleteMany({
    where: {
      OR: [
        { yearlyProgramSubscriptionId: { in: subIds } },
        { orderReference: { startsWith: 'yearly-program' } },
      ],
    },
  });
  console.log(`  ✓ Payment видалено: ${delPayments.count}`);

  // 2) Subscriptions (events каскадно через onDelete: Cascade)
  const delSubs = await prisma.yearlyProgramSubscription.deleteMany({});
  console.log(`  ✓ YearlyProgramSubscription видалено: ${delSubs.count} (events каскадно)`);

  // 3) PaymentCallbackLog
  const delLogs = await prisma.paymentCallbackLog.deleteMany({
    where: {
      OR: [
        { kind: { in: ['yearly', 'monthly'] } },
        { orderReference: { startsWith: 'yearly-program' } },
      ],
    },
  });
  console.log(`  ✓ PaymentCallbackLog видалено: ${delLogs.count}`);

  console.log('\n✅ Готово.');
} finally {
  await prisma.$disconnect();
}
