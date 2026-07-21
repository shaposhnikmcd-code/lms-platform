/// E2E-перевірка авто-архіву дублів PENDING + збіжності KPI з таблицею.
/// Запуск (dev-БД): npx tsx scripts/e2e-yearly-dedup.mts
///
/// Сценарій: клієнт зробив невдалу спробу з одного email, оплатив успішно з іншого,
/// але з тим самим телефоном/Telegram. Перевіряємо, що дубль архівується одразу,
/// а ручний і самотній PENDING — виживають.
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
config({ path: resolve(root, '.env.local'), override: true });

// Динамічні імпорти — щоб PrismaClient створився ПІСЛЯ підстановки dev-URL.
const { default: prisma } = await import('../lib/prisma');
const { archiveDuplicatePendingSubscriptions } = await import('../lib/yearlyProgramDedup');
const { buildLiveIdentityIndex, isVisibleYearlySubscription } = await import(
  '../lib/yearlyProgramVisibility'
);

const TAG = 'dedup-e2e';
const EMAILS = [`${TAG}-a@test.local`, `${TAG}-b@test.local`, `${TAG}-c@test.local`, `${TAG}-d@test.local`];
const PHONE_TYPED = '+38 (067) 000-11-22';
const PHONE_CLEAN = '380670001122';
const TG_TYPED = '@DedupE2E';
const TG_CLEAN = 'dedupe2e';

let failures = 0;
function check(label: string, ok: boolean, extra = '') {
  console.log(`${ok ? '✔' : '✘'} ${label}${extra ? ` — ${extra}` : ''}`);
  if (!ok) failures++;
}

async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { in: EMAILS } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return;
  await prisma.payment.deleteMany({ where: { userId: { in: ids } } });
  await prisma.yearlyProgramSubscription.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

async function mkUser(email: string) {
  return prisma.user.create({ data: { email, name: `E2E ${email}` } });
}

async function summarize() {
  const all = await prisma.yearlyProgramSubscription.findMany({
    select: {
      id: true, userId: true, status: true, phone: true, telegramUsername: true, manuallyAddedAt: true,
      payments: { where: { status: 'PAID' }, select: { id: true }, take: 1 },
    },
  });
  const shape = all.map((s) => ({
    userId: s.userId,
    status: s.status,
    phone: s.phone,
    telegramUsername: s.telegramUsername,
    manuallyAddedAt: s.manuallyAddedAt,
    hasPaidPayment: s.payments.length > 0,
  }));
  const index = buildLiveIdentityIndex(shape);
  const visible = all.filter((_, i) => isVisibleYearlySubscription(shape[i], index));
  return {
    total: visible.filter((s) => s.status !== 'ARCHIVED').length,
    pending: visible.filter((s) => s.status === 'PENDING').length,
    // Те, що адмін бачить у дефолтному вигляді таблиці: видимі й не в архіві.
    visibleIds: new Set(visible.filter((s) => s.status !== 'ARCHIVED').map((s) => s.id)),
  };
}

await cleanup();

const [uA, uB, uC, uD] = await Promise.all(EMAILS.map(mkUser));

// A — невдала спроба (PENDING + FAILED payment), телефон/TG у «людському» форматі.
const subA = await prisma.yearlyProgramSubscription.create({
  data: { userId: uA.id, plan: 'YEARLY', status: 'PENDING', phone: PHONE_TYPED, telegramUsername: TG_TYPED },
});
await prisma.payment.create({
  data: { userId: uA.id, orderReference: `${TAG}-a-${Date.now()}`, amount: 15000, status: 'FAILED', yearlyProgramSubscriptionId: subA.id },
});

// C — ручно доданий менеджером, той самий телефон. НЕ можна архівувати.
const subC = await prisma.yearlyProgramSubscription.create({
  data: { userId: uC.id, plan: 'YEARLY', status: 'PENDING', phone: PHONE_CLEAN, telegramUsername: TG_CLEAN, manuallyAddedAt: new Date(), manuallyAddedBy: 'e2e' },
});

// D — самотній лід, інший телефон. Має лишитись видимим.
const subD = await prisma.yearlyProgramSubscription.create({
  data: { userId: uD.id, plan: 'YEARLY', status: 'PENDING', phone: '380509998877', telegramUsername: 'lonely_lead_e2e' },
});

const before = await summarize();

// B — успішна оплата з іншого акаунту, телефон той самий у «чистому» форматі.
const subB = await prisma.yearlyProgramSubscription.create({
  data: { userId: uB.id, plan: 'YEARLY', status: 'ACTIVE', phone: PHONE_CLEAN, telegramUsername: TG_CLEAN, startDate: new Date(), expiresAt: new Date(Date.now() + 365 * 864e5) },
});
await prisma.payment.create({
  data: { userId: uB.id, orderReference: `${TAG}-b-${Date.now()}`, amount: 15000, status: 'PAID', paidAt: new Date(), yearlyProgramSubscriptionId: subB.id },
});

const res = await archiveDuplicatePendingSubscriptions({
  id: subB.id, userId: subB.userId, phone: subB.phone, telegramUsername: subB.telegramUsername,
});

console.log('\n— Результат авто-архіву —');
console.log(res);

const [a, c, d] = await Promise.all([
  prisma.yearlyProgramSubscription.findUnique({ where: { id: subA.id }, select: { status: true } }),
  prisma.yearlyProgramSubscription.findUnique({ where: { id: subC.id }, select: { status: true } }),
  prisma.yearlyProgramSubscription.findUnique({ where: { id: subD.id }, select: { status: true } }),
]);
const events = await prisma.yearlyProgramSubscriptionEvent.findMany({ where: { subscriptionId: subA.id } });

check('дубль-спроба (інший email, той самий телефон/TG) → ARCHIVED', a?.status === 'ARCHIVED', `status=${a?.status}`);
check('ручно доданий PENDING не заархівовано', c?.status === 'PENDING', `status=${c?.status}`);
check('самотній лід PENDING не заархівовано', d?.status === 'PENDING', `status=${d?.status}`);
check('на дублі є подія авто-архіву', events.some((e) => (e.message ?? '').startsWith('Авто-архів: дубль')), events.map((e) => e.message).join(' | '));
check('errors порожні', res.errors.length === 0, res.errors.join('; '));

const after = await summarize();
console.log('\n— KPI —');
console.log('до оплати :', { total: before.total, pending: before.pending });
console.log('після     :', { total: after.total, pending: after.pending });

check('дубль зник з видимих', !after.visibleIds.has(subA.id));
check('ACTIVE-підписка видима', after.visibleIds.has(subB.id));
check('KPI «В очікуванні» не змінилось (мінус дубль, плюс нічого)', after.pending === before.pending - 1, `${before.pending} → ${after.pending}`);
check('KPI «Всього» не змінилось (дубль пішов, з`явилась ACTIVE)', after.total === before.total, `${before.total} → ${after.total}`);

// Друга перевірка: ідемпотентність (повторний виклик нічого не архівує).
const again = await archiveDuplicatePendingSubscriptions({
  id: subB.id, userId: subB.userId, phone: subB.phone, telegramUsername: subB.telegramUsername,
});
check('повторний виклик ідемпотентний', again.archived.length === 0 && again.errors.length === 0);

await cleanup();
console.log(`\n${failures === 0 ? '✅ E2E пройдено' : `❌ провалено перевірок: ${failures}`}`);
await prisma.$disconnect();
process.exit(failures === 0 ? 0 : 1);
