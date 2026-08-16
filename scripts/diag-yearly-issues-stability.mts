/// Акцепт-тест вкладки «Помилки» Річної програми на ЛОКАЛЬНІЙ dev-БД.
///
/// Перевіряє головне: заглушений issue не «оживає» після нічного проходу, який оновлює
/// `updatedAt` усім живим підпискам (саме через це раніше повертались ORPHAN_NO_PAYMENT
/// і TG_INVITE_FAILED).
///
/// Сценарій:
///   1. створюємо підписку без жодного платежу → ORPHAN_NO_PAYMENT з'явився в активних;
///   2. заглушуємо його → переїхав у dismissed;
///   3. імітуємо нічний sync (`spProgressCheckedAt` усім живим, як у syncYearlyProgress)
///      → issue ЛИШИВСЯ у dismissed;
///   4. те саме для TG_INVITE_FAILED (state-based, час береться з події);
///   5. міряємо час `collectAllIssues` (усі набори / один набір);
///   6. прибираємо за собою.
///
/// Запуск: node --import tsx scripts/diag-yearly-issues-stability.ts
import { config } from 'dotenv';

config({ path: '.env.local', override: true });

const { default: prisma } = await import('@/lib/prisma');
const { collectAllIssues, dismissIssue } = await import('@/lib/yearlyProgramIssues');
const { TG_INVITE_FAILED_EVENT_TYPE } = await import('@/lib/yearlyProgramTelegramMarks');

const TEST_EMAIL = 'issues-stability-probe@example.com';

function assert(cond: boolean, label: string): void {
  console.log(`${cond ? '✅' : '❌'} ${label}`);
  if (!cond) process.exitCode = 1;
}

/// Скрипт МУТУЄ дані, тож працює тільки на dev-гілці Neon (`ep-sparkling-wave-…`,
/// креди в `.env.local`). Прод (`ep-odd-night-…`) і pre (`ep-proud-paper-…`) — стоп.
const DEV_ENDPOINT = 'ep-sparkling-wave';
const dbHost = (process.env.DATABASE_URL ?? '').replace(/^.*@/, '').split('/')[0] ?? '';
console.log(`DB: ${dbHost}`);
if (!dbHost.includes(DEV_ENDPOINT)) {
  console.error(`⛔ Це не dev-гілка (очікував ${DEV_ENDPOINT}…). Скрипт мутує дані — зупиняюсь.`);
  process.exit(1);
}

// ── Підготовка: користувач + підписка без платежів ────────────────────────────
const user = await prisma.user.upsert({
  where: { email: TEST_EMAIL },
  update: {},
  create: { email: TEST_EMAIL, name: 'Issues Probe' },
});

const cohort = await prisma.yearlyProgramCohort.findFirst({ orderBy: { startDate: 'desc' } });

const sub = await prisma.yearlyProgramSubscription.create({
  data: {
    userId: user.id,
    plan: 'MONTHLY',
    status: 'ACTIVE',
    autoRenew: false,
    cohortId: cohort?.id ?? null,
    telegramInviteError: 'chat not found (тест стабільності заглушення)',
  },
});
// Час TG-помилки колектор бере з події — саме так пише сервісний шар.
await prisma.yearlyProgramSubscriptionEvent.create({
  data: {
    subscriptionId: sub.id,
    type: TG_INVITE_FAILED_EVENT_TYPE,
    message: 'Telegram invite не згенеровано (probe): chat not found',
    metadata: { error: 'chat not found', triggeredBy: 'probe' },
  },
});
console.log(`\nПідписка-проба: ${sub.id} (набір: ${cohort?.name ?? '—'})\n`);

const kindsOf = (recs: { subscriptionId: string | null; kind: string }[]) =>
  recs.filter((r) => r.subscriptionId === sub.id).map((r) => r.kind).sort();

// ── 1. Issue-и з'явились в активних ───────────────────────────────────────────
let payload = await collectAllIssues();
assert(kindsOf(payload.active).includes('ORPHAN_NO_PAYMENT'), 'ORPHAN_NO_PAYMENT у активних');
assert(kindsOf(payload.active).includes('TG_INVITE_FAILED'), 'TG_INVITE_FAILED у активних');

// ── 2. Заглушуємо обидва ──────────────────────────────────────────────────────
await dismissIssue({ subscriptionId: sub.id, kind: 'ORPHAN_NO_PAYMENT', dismissedBy: 'probe', reason: 'тест' });
await dismissIssue({ subscriptionId: sub.id, kind: 'TG_INVITE_FAILED', dismissedBy: 'probe', reason: 'тест' });

payload = await collectAllIssues();
assert(kindsOf(payload.dismissed).includes('ORPHAN_NO_PAYMENT'), 'ORPHAN_NO_PAYMENT переїхав у заглушені');
assert(kindsOf(payload.dismissed).includes('TG_INVITE_FAILED'), 'TG_INVITE_FAILED переїхав у заглушені');
assert(!kindsOf(payload.active).includes('ORPHAN_NO_PAYMENT'), 'ORPHAN_NO_PAYMENT зник з активних');
assert(!kindsOf(payload.active).includes('TG_INVITE_FAILED'), 'TG_INVITE_FAILED зник з активних');

// ── 3. Імітація нічного sync: updatedAt зсувається всім живим підпискам ───────
const live = await prisma.yearlyProgramSubscription.findMany({
  where: { status: { not: 'CANCELLED' } },
  select: { id: true },
});
await prisma.yearlyProgramSubscription.updateMany({
  where: { id: { in: live.map((s) => s.id) } },
  data: { spProgressCheckedAt: new Date() },
});
const after = await prisma.yearlyProgramSubscription.findUnique({
  where: { id: sub.id },
  select: { createdAt: true, updatedAt: true },
});
assert(!!after && after.updatedAt > after.createdAt, 'нічний sync справді зсунув updatedAt підписки');

payload = await collectAllIssues();
assert(kindsOf(payload.dismissed).includes('ORPHAN_NO_PAYMENT'), 'ПІСЛЯ нічного sync: ORPHAN_NO_PAYMENT лишився заглушеним');
assert(kindsOf(payload.dismissed).includes('TG_INVITE_FAILED'), 'ПІСЛЯ нічного sync: TG_INVITE_FAILED лишився заглушеним');
assert(kindsOf(payload.active).length === 0, 'ПІСЛЯ нічного sync: у активних по цій підписці порожньо');

// ── 4. Нова помилка після заглушення — issue має ожити ────────────────────────
await prisma.yearlyProgramSubscriptionEvent.create({
  data: {
    subscriptionId: sub.id,
    type: TG_INVITE_FAILED_EVENT_TYPE,
    message: 'Telegram invite не згенеровано (probe-2): bot is not a member',
    metadata: { error: 'bot is not a member', triggeredBy: 'probe' },
  },
});
payload = await collectAllIssues();
assert(kindsOf(payload.active).includes('TG_INVITE_FAILED'), 'нова TG-помилка після заглушення повернула issue в активні');

// ── 5. Три ситуації Telegram у одному полі → три різні issue ──────────────────
const { TG_JOIN_DECLINED_MARK, TG_PENDING_JOIN_MARK, TG_ERROR_SEGMENT_SEPARATOR } =
  await import('@/lib/yearlyProgramTelegramMarks');
await prisma.yearlyProgramSubscription.update({
  where: { id: sub.id },
  data: {
    telegramInviteError: [
      'chat not found',
      `${TG_JOIN_DECLINED_MARK} — від @someone: username не збігається`,
      `${TG_PENDING_JOIN_MARK} від @other — перевірте вручну в каналі`,
    ].join(TG_ERROR_SEGMENT_SEPARATOR),
  },
});
payload = await collectAllIssues();
const tgKinds = kindsOf(payload.active).concat(kindsOf(payload.dismissed));
assert(tgKinds.includes('TG_JOIN_DECLINED'), 'відхилена заявка → окремий issue TG_JOIN_DECLINED');
assert(tgKinds.includes('TG_JOIN_PENDING'), 'висяча заявка → окремий issue TG_JOIN_PENDING');

// ── 6. Час збору ──────────────────────────────────────────────────────────────
const measure = async (label: string, fn: () => Promise<unknown>) => {
  const runs: number[] = [];
  for (let i = 0; i < 3; i += 1) {
    const t0 = performance.now();
    await fn();
    runs.push(performance.now() - t0);
  }
  console.log(`⏱  ${label}: ${runs.map((r) => `${Math.round(r)}ms`).join(' / ')}`);
};
console.log('');
await measure('collectAllIssues() — усі набори', () => collectAllIssues());
if (cohort) {
  await measure(`collectAllIssues({cohortId}) — «${cohort.name}»`, () => collectAllIssues({ cohortId: cohort.id }));
}
const eventsTotal = await prisma.yearlyProgramSubscriptionEvent.count();
const adminActions = await prisma.yearlyProgramSubscriptionEvent.count({ where: { type: 'admin_action' } });
console.log(`   (подій у БД: ${eventsTotal}, з них admin_action: ${adminActions})`);

// ── Прибирання ────────────────────────────────────────────────────────────────
await prisma.yearlyProgramIssueDismissal.deleteMany({ where: { subscriptionId: sub.id } });
await prisma.yearlyProgramSubscriptionEvent.deleteMany({ where: { subscriptionId: sub.id } });
await prisma.yearlyProgramSubscription.delete({ where: { id: sub.id } });
await prisma.user.delete({ where: { id: user.id } });
console.log('\n🧹 Прибрано (підписка, події, заглушення, тестовий користувач).');

await prisma.$disconnect();
