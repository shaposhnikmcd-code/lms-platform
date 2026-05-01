/// Видалення тестових підписок Річної програми перед запуском cohort-системи.
/// Видаляє ВСІ існуючі підписки (4 тестові на dev/прод) разом з пов'язаними подіями.
/// Платежі залишаються (linked через nullable FK), щоб залишилась історія платежів.
///
/// Запуск: node scripts/cleanup-yearly-test-subscriptions.mjs
/// Безпека: спочатку показує що буде видалено, чекає підтвердження через --yes.

import readline from 'node:readline/promises';
import prisma from './_db.mjs';

async function main() {
  const yes = process.argv.includes('--yes');

  const subs = await prisma.yearlyProgramSubscription.findMany({
    include: {
      user: { select: { email: true, name: true } },
      _count: { select: { payments: true, events: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  if (subs.length === 0) {
    console.log('Тестових підписок не знайдено. Виходжу.');
    return;
  }

  console.log(`Знайдено ${subs.length} підписок:`);
  for (const s of subs) {
    console.log(
      `  · ${s.id} [${s.plan}/${s.status}] ${s.user?.email ?? 'no-user'} — payments: ${s._count.payments}, events: ${s._count.events}`,
    );
  }
  console.log('\nЦя дія:');
  console.log('  · Видалить усі підписки (CASCADE → Events).');
  console.log('  · НЕ видаляє Payment-и (вони лишаться для історії).');
  console.log('  · НЕ видаляє користувачів.');

  if (!yes) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ans = await rl.question('\nПродовжити? (yes/no): ');
    rl.close();
    if (ans.trim().toLowerCase() !== 'yes') {
      console.log('Скасовано.');
      return;
    }
  }

  // Спочатку відлінкуємо платежі (set null) — щоб не зачепити PaymentCallbackLog тощо.
  const updPayments = await prisma.payment.updateMany({
    where: { yearlyProgramSubscriptionId: { in: subs.map((s) => s.id) } },
    data: { yearlyProgramSubscriptionId: null },
  });
  console.log(`Відлінковано платежів: ${updPayments.count}`);

  // Видаляємо підписки (events видаляться cascade).
  const del = await prisma.yearlyProgramSubscription.deleteMany({
    where: { id: { in: subs.map((s) => s.id) } },
  });
  console.log(`Видалено підписок: ${del.count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
