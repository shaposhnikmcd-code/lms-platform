// Накочує мок-підписки Річної програми ПОВНОГО спектру (різні плани × статуси × оплати),
// щоб адмінка /dashboard/admin/yearly-program була наповнена для перегляду/демо edit-форми.
//
// Усі email — плюс-аліаси Gmail (shaposhnik.mcd+ydemoN@gmail.com) → реальні листи прийдуть
// до тебе в один інбокс. Дані кладуться у поточний (isCurrent=true) cohort.
//
// Запуск:
//   node scripts/mock-yearly-spread.mjs           — створити набір
//   node scripts/mock-yearly-spread.mjs --clean   — видалити всі +ydemo мок-дані
//
// Кожен запис: User → YearlyProgramSubscription → (опц.) Payment(PAID) → події.

import prisma from './_db.mjs';

const REAL_EMAIL = process.env.MOCK_REAL_EMAIL || 'shaposhnik.mcd@gmail.com';
const args = process.argv.slice(2);
const isClean = args.includes('--clean');

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();

function aliasEmail(slug) {
  const [local, domain] = REAL_EMAIL.split('@');
  return `${local}+ydemo${slug}@${domain}`;
}

// Сценарії — по одному на кожен цікавий тип. price: 15000 (YEARLY) / 2200 (MONTHLY).
const SCENARIOS = [
  {
    slug: '01', name: 'Олена Шевченко', plan: 'YEARLY', autoRenew: false, status: 'ACTIVE',
    paid: true, startDaysAgo: 20, expiresInDays: 345, spOpenDaysAgo: 20,
    country: 'UA', phone: '+380671112233', tg: '@olena_shev',
  },
  {
    slug: '02', name: 'Андрій Коваленко', plan: 'MONTHLY', autoRenew: true, status: 'ACTIVE',
    paid: true, startDaysAgo: 10, expiresInDays: 20, spOpenDaysAgo: 10,
    country: 'PL', phone: '+48555444333', tg: '@andriy_kov',
  },
  {
    slug: '03', name: 'Марія Петренко', plan: 'MONTHLY', autoRenew: false, status: 'ACTIVE',
    paid: true, startDaysAgo: 5, expiresInDays: 25, spOpenDaysAgo: 5,
    country: 'UA', phone: '+380931234567', tg: null,
  },
  {
    slug: '04', name: 'Дмитро Мельник', plan: 'YEARLY', autoRenew: false, status: 'PENDING',
    paid: false, startDaysAgo: null, expiresInDays: null, spOpenDaysAgo: null,
    country: 'DE', phone: null, tg: null,
  },
  {
    slug: '05', name: 'Софія Бойко', plan: 'MONTHLY', autoRenew: true, status: 'GRACE',
    paid: true, startDaysAgo: 35, expiresInDays: -3, spOpenDaysAgo: 35, graceDaysAgo: 3,
    country: 'UA', phone: '+380501009988', tg: '@sofiia_b',
  },
  {
    slug: '06', name: 'Юрій Кравченко', plan: 'YEARLY', autoRenew: false, status: 'EXPIRED',
    paid: true, startDaysAgo: 400, expiresInDays: -35, spOpenDaysAgo: 400, spCloseDaysAgo: 30,
    country: 'UA', phone: null, tg: null,
  },
  {
    slug: '07', name: 'Анна Шаповал', plan: 'MONTHLY', autoRenew: true, status: 'CANCELLED',
    paid: true, startDaysAgo: 60, expiresInDays: 5, spOpenDaysAgo: 60, cancelledDaysAgo: 12,
    country: 'PL', phone: '+48600700800', tg: '@anna_shapoval',
  },
  {
    slug: '08', name: 'Богдан Гончар', plan: 'YEARLY', autoRenew: false, status: 'ACTIVE',
    paid: true, startDaysAgo: 2, expiresInDays: 363, spOpenDaysAgo: 2,
    country: 'UA', phone: '+380672223344', tg: '@bohdan_g', tgJoined: true,
  },
  {
    slug: '09', name: 'Ірина Литвин', plan: 'MONTHLY', autoRenew: false, status: 'PENDING',
    paid: true, startDaysAgo: null, expiresInDays: null, spOpenDaysAgo: null,
    country: 'UA', phone: '+380935556677', tg: null,
  },
];

async function clean() {
  const users = await prisma.user.findMany({
    where: { email: { contains: '+ydemo' } },
    select: { id: true },
  });
  if (users.length === 0) { console.log('Нічого чистити (+ydemo).'); return; }
  const userIds = users.map((u) => u.id);
  const subs = await prisma.yearlyProgramSubscription.findMany({
    where: { userId: { in: userIds } }, select: { id: true },
  });
  const subIds = subs.map((s) => s.id);
  const ev = await prisma.yearlyProgramSubscriptionEvent.deleteMany({ where: { subscriptionId: { in: subIds } } });
  const pay = await prisma.payment.deleteMany({ where: { yearlyProgramSubscriptionId: { in: subIds } } });
  const sd = await prisma.yearlyProgramSubscription.deleteMany({ where: { userId: { in: userIds } } });
  const ud = await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  console.log(`✓ видалено: ${ud.count} users, ${sd.count} subs, ${pay.count} payments, ${ev.count} events`);
}

async function seed() {
  const cohort = await prisma.yearlyProgramCohort.findFirst({
    where: { isCurrent: true },
    select: { id: true, name: true },
  });
  if (!cohort) { console.error('❌ Немає поточного cohort-у.'); process.exit(1); }
  console.log(`Cohort: ${cohort.name} (${cohort.id})\n`);

  let created = 0, skipped = 0;
  for (const s of SCENARIOS) {
    const email = aliasEmail(s.slug);
    let user = await prisma.user.findFirst({ where: { email, deletedAt: null } });
    if (!user) user = await prisma.user.create({ data: { email, name: s.name } });

    const existing = await prisma.yearlyProgramSubscription.findFirst({
      where: { userId: user.id, cohortId: cohort.id }, select: { id: true },
    });
    if (existing) { skipped++; console.log(`  ⏸  ${email} — вже є`); continue; }

    const startDate = s.startDaysAgo != null ? new Date(now - s.startDaysAgo * DAY) : null;
    const expiresAt = s.expiresInDays != null ? new Date(now + s.expiresInDays * DAY) : null;

    const sub = await prisma.yearlyProgramSubscription.create({
      data: {
        userId: user.id,
        cohortId: cohort.id,
        plan: s.plan,
        autoRenew: s.autoRenew,
        status: s.status,
        startDate,
        expiresAt,
        country: s.country ?? null,
        phone: s.phone ?? null,
        telegramUsername: s.tg ?? null,
        telegramInviteLink: s.tg ? `https://t.me/+mockInvite${s.slug}` : null,
        telegramInvitedAt: s.tg ? new Date(now - (s.startDaysAgo ?? 1) * DAY) : null,
        telegramJoinedAt: s.tgJoined ? new Date(now - (s.startDaysAgo ?? 1) * DAY + 3600_000) : null,
        sendpulseAccessOpenedAt: s.spOpenDaysAgo != null ? new Date(now - s.spOpenDaysAgo * DAY) : null,
        sendpulseAccessClosedAt: s.spCloseDaysAgo != null ? new Date(now - s.spCloseDaysAgo * DAY) : null,
        graceStartedAt: s.graceDaysAgo != null ? new Date(now - s.graceDaysAgo * DAY) : null,
        gracePeriodEndsAt: s.graceDaysAgo != null ? new Date(now + 4 * DAY) : null,
        cancelledAt: s.cancelledDaysAgo != null ? new Date(now - s.cancelledDaysAgo * DAY) : null,
        cancelledBy: s.cancelledDaysAgo != null ? 'admin' : null,
        cancelledReason: s.cancelledDaysAgo != null ? 'Мок: студент попросив скасувати' : null,
        lastPaymentAt: s.paid ? new Date(now - (s.startDaysAgo ?? 1) * DAY) : null,
      },
    });

    if (s.paid) {
      await prisma.payment.create({
        data: {
          userId: user.id,
          orderReference: `mock-ydemo-${s.slug}-${now}`,
          amount: s.plan === 'YEARLY' ? 15000 : 2200,
          currency: 'UAH',
          status: 'PAID',
          paidAt: new Date(now - (s.startDaysAgo ?? 1) * DAY),
          yearlyProgramSubscriptionId: sub.id,
        },
      });
    }

    await prisma.yearlyProgramSubscriptionEvent.create({
      data: {
        subscriptionId: sub.id,
        type: 'created',
        message: `Mock spread: ${s.plan}${s.autoRenew ? '/auto' : ''} ${s.status}`,
        metadata: { mock: true },
      },
    });

    const tags = `${s.plan}${s.autoRenew ? '/auto' : s.plan === 'MONTHLY' ? '/once' : ''}`.padEnd(14);
    console.log(`  +  ${email.padEnd(44)} ${tags} ${s.status.padEnd(9)} ${s.paid ? '💳PAID' : '—'}`);
    created++;
  }

  console.log(`\n✅ Створено ${created}, пропущено ${skipped}.`);
  console.log('Відкрий: http://localhost:3003/dashboard/admin/yearly-program');
}

(isClean ? clean() : seed())
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
