// Створює мок-дані для адмінки Річної програми, щоб побачити як виглядає форма
// «Запустити розсилку» з реальними одержувачами.
//
// Усі email — плюс-аліаси твого Gmail (shaposhnik.mcd+studentN@gmail.com),
// тому при реальній розсилці всі листи прийдуть до тебе в один інбокс.
//
// Запуск:
//   node scripts/mock-yearly-students.mjs              — створити 12 мок-підписок у поточному cohort-і
//   node scripts/mock-yearly-students.mjs --count=20   — інша кількість
//   node scripts/mock-yearly-students.mjs --clean      — видалити всі мок-дані (за email-патерном +student)
//
// Розподіл за станами:
//   • ~70% PENDING + PAID payment → "буде надіслано" (emerald)
//   • ~15% PENDING + no PAID payment → "не оплачено" (amber)
//   • ~15% PENDING + PAID + launch_email_sent event → "вже отримали" (stone)

import prisma from './_db.mjs';

const REAL_EMAIL = process.env.MOCK_REAL_EMAIL || 'shaposhnik.mcd@gmail.com';
const args = process.argv.slice(2);
const isClean = args.includes('--clean');
const countArg = args.find((a) => a.startsWith('--count='));
const COUNT = countArg ? Math.max(1, parseInt(countArg.split('=')[1] || '12', 10)) : 12;

const NAMES = [
  'Олена Шевченко', 'Андрій Коваленко', 'Марія Петренко', 'Дмитро Мельник',
  'Софія Бойко', 'Юрій Кравченко', 'Анна Шаповал', 'Богдан Гончар',
  'Ірина Литвин', 'Олег Савченко', 'Наталія Пилипенко', 'Тарас Левченко',
  'Катерина Романюк', 'Сергій Дяченко', 'Юлія Степанова', 'Володимир Бондаренко',
  'Оксана Грищенко', 'Артем Поліщук', 'Вікторія Карпенко', 'Микола Тимошенко',
  'Леся Українка', 'Тарас Шевченко', 'Іван Франко', 'Ольга Кобилянська',
];

function aliasEmail(i) {
  const [local, domain] = REAL_EMAIL.split('@');
  return `${local}+student${String(i).padStart(2, '0')}@${domain}`;
}

async function clean() {
  const [local, domain] = REAL_EMAIL.split('@');
  const pattern = `${local}+student%@${domain}`;
  console.log(`Cleaning mock users with pattern ${pattern}…`);

  const users = await prisma.user.findMany({
    where: { email: { contains: '+student' } },
    select: { id: true, email: true },
  });
  if (users.length === 0) {
    console.log('Nothing to clean.');
    return;
  }
  console.log(`Found ${users.length} mock user(s)`);

  const userIds = users.map((u) => u.id);
  const subs = await prisma.yearlyProgramSubscription.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  });
  const subIds = subs.map((s) => s.id);

  // Видаляємо у порядку залежностей: events → payments → subs → users.
  const eventsDel = await prisma.yearlyProgramSubscriptionEvent.deleteMany({
    where: { subscriptionId: { in: subIds } },
  });
  const paymentsDel = await prisma.payment.deleteMany({
    where: { yearlyProgramSubscriptionId: { in: subIds } },
  });
  const subsDel = await prisma.yearlyProgramSubscription.deleteMany({
    where: { userId: { in: userIds } },
  });
  const usersDel = await prisma.user.deleteMany({
    where: { id: { in: userIds } },
  });

  console.log(`✓ removed: ${usersDel.count} users, ${subsDel.count} subs, ${paymentsDel.count} payments, ${eventsDel.count} events`);
}

async function seed() {
  const cohort = await prisma.yearlyProgramCohort.findFirst({
    where: { isCurrent: true },
    select: { id: true, name: true, startDate: true, endDate: true, launchedAt: true },
  });
  if (!cohort) {
    console.error('❌ Немає поточного (isCurrent=true) cohort-у. Створи його у адмінці.');
    process.exit(1);
  }
  console.log(`Cohort: ${cohort.name} (${cohort.id})`);
  console.log(`launchedAt: ${cohort.launchedAt ? cohort.launchedAt.toISOString() : 'null'}`);
  console.log(`Створюю ${COUNT} мок-підписок…\n`);

  // Розподіл по станах (у порядку від найменш цікавих до найважливіших):
  //   індекси 0..unpaidEnd        → unpaid (амбер, не оплачено)
  //   індекси unpaidEnd..sentEnd  → already-sent (stone, вже отримали)
  //   індекси sentEnd..COUNT      → pending paid (emerald, буде надіслано) — найбільший сегмент
  const unpaidCount = Math.max(1, Math.round(COUNT * 0.15));
  const sentCount = Math.max(1, Math.round(COUNT * 0.15));
  const unpaidEnd = unpaidCount;
  const sentEnd = unpaidCount + sentCount;

  let createdCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < COUNT; i++) {
    const name = NAMES[i % NAMES.length];
    const email = aliasEmail(i + 1);
    const isPaid = i >= unpaidEnd;
    const wasAlreadySent = isPaid && i < sentEnd;
    const plan = i % 3 === 0 ? 'YEARLY' : 'MONTHLY';
    const autoRenew = plan === 'MONTHLY' && i % 2 === 0;

    let user = await prisma.user.findFirst({ where: { email, deletedAt: null } });
    if (!user) {
      user = await prisma.user.create({ data: { email, name } });
    }

    const existing = await prisma.yearlyProgramSubscription.findFirst({
      where: { userId: user.id, cohortId: cohort.id },
      select: { id: true },
    });
    if (existing) {
      skippedCount++;
      console.log(`  ⏸  ${email} — підписка вже є, пропускаю`);
      continue;
    }

    const sub = await prisma.yearlyProgramSubscription.create({
      data: {
        userId: user.id,
        plan,
        status: 'PENDING',
        autoRenew,
        cohortId: cohort.id,
      },
    });

    if (isPaid) {
      const orderRef = `mock-${cohort.id.slice(0, 8)}-${Date.now()}-${i}`;
      await prisma.payment.create({
        data: {
          userId: user.id,
          orderReference: orderRef,
          amount: plan === 'YEARLY' ? 15000 : 2200,
          status: 'PAID',
          paidAt: new Date(Date.now() - i * 3600_000),
          yearlyProgramSubscriptionId: sub.id,
        },
      });
    }

    if (wasAlreadySent) {
      await prisma.yearlyProgramSubscriptionEvent.create({
        data: {
          subscriptionId: sub.id,
          type: 'launch_email_sent',
          message: 'Mock previously-sent welcome email',
          metadata: { cohortId: cohort.id, mock: true, messageId: `mock-${i}` },
        },
      });
    }

    const tag = wasAlreadySent ? '✉ отримав' : isPaid ? '✓ буде надіслано' : '⚠ не оплачено';
    console.log(`  +  ${email.padEnd(46)} ${plan}${autoRenew ? '/auto' : '     '} ${tag}`);
    createdCount++;
  }

  console.log(`\n✅ Готово. Створено ${createdCount}, пропущено ${skippedCount} (вже існували).`);
  console.log(`📨 Усі emails — плюс-аліаси ${REAL_EMAIL}, тому реальна розсилка прийде в твій інбокс.`);
}

async function main() {
  if (isClean) await clean();
  else await seed();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
