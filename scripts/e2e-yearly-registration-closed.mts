/// E2E-перевірки рубильника «Реєстрація відкрита» у РЕАЛЬНОМУ обробнику `/api/wayforpay`
/// (без dev-сервера: POST-хендлер викликається в процесі, як у `e2e-yearly-renew-cookie.mts`).
/// Запуск (dev-БД): node --import tsx scripts/e2e-yearly-registration-closed.mts
///
/// Що стережеться. Рішення власника 09.09.2026: оплата наступного модуля чинним студентом
/// свого живого набору — не новий продаж, і `registrationOpen` її не стосується; нові
/// продажі — стосується. Обидві половини перевіряються тільки на рівні роуту: юніт-тест
/// `resolveRenewState` відповідає на питання «що показати на сторінці», а тут ідеться про
/// те, з кого і за що знімуть гроші.
///
/// 1. Чинний студент (MONTHLY, autoRenew=false, є PAID) при ЗАКРИТІЙ реєстрації:
///    і за персональним посиланням (cookie), і з лендінгового рядка (без cookie) → 200.
/// 2. Новий email при закритій реєстрації без invite → 409 `registration_closed`
///    (до цієї задачі роут прапорця не питав узагалі — нова підписка заводилась).
/// 3. Той самий новий email з invite менеджера → 200: invite обходить прапорець.
/// 4. Абандонована PENDING-спроба без жодної оплати — це не «чинний студент», а той самий
///    новий продаж зі вчорашньої вкладки → 409.
/// 5. Контроль: при ВІДКРИТІЙ реєстрації новий email купує як раніше → 200.
///
/// Скрипт тимчасово перемикає `YearlyProgramSetting.registrationOpen` у dev-БД і повертає
/// початкове значення в кінці (і на будь-якій помилці).
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
config({ path: resolve(root, '.env.local'), override: true });

// `getServerSession` всередині роуту читає Next-івський request-store, якого поза живим
// сервером немає. Підмінюємо ЕКСПОРТ next-auth (CJS) ДО імпорту роуту — так перевіряється
// справжній код роуту, а не його копія.
const require_ = createRequire(import.meta.url);
const nextAuthPath = require_.resolve('next-auth');
require_.cache[nextAuthPath] = {
  id: nextAuthPath,
  filename: nextAuthPath,
  loaded: true,
  exports: { getServerSession: async () => null },
} as unknown as NodeModule;

const { default: prisma } = await import('../lib/prisma');
const { NextRequest } = await import('next/server');
const { signRenewToken, RENEW_COOKIE_NAME } = await import('../lib/yearlyProgramRenew');
const { signInvite } = await import('../lib/yearlyProgramInvite');
const { YEARLY_PROGRAM_SETTING_ID } = await import('../lib/yearlyProgramSettings');
const { POST } = await import('../app/api/wayforpay/route');

const TAG = 'yr-registration-closed-e2e';
/// Унікальна «адреса» прогону — ініціація платежу обмежена 10 запитами / 5 хв на IP.
const RUN_IP = `203.0.113.${Math.floor(Math.random() * 254) + 1}`;

let failures = 0;
function check(label: string, ok: boolean, extra = '') {
  console.log(`${ok ? '✔' : '✘'} ${label}${extra ? ` — ${extra}` : ''}`);
  if (!ok) failures++;
}

/// Початкове значення рубильника — повертаємо його, чим би прогін не скінчився.
let originalRegistrationOpen: boolean | null = null;

async function setRegistrationOpen(open: boolean) {
  await prisma.yearlyProgramSetting.upsert({
    where: { id: YEARLY_PROGRAM_SETTING_ID },
    update: { registrationOpen: open },
    create: { id: YEARLY_PROGRAM_SETTING_ID, registrationOpen: open },
  });
}

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { email: { startsWith: TAG } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  if (ids.length > 0) {
    await prisma.payment.deleteMany({ where: { userId: { in: ids } } });
    await prisma.yearlyProgramSubscriptionEvent.deleteMany({ where: { subscription: { userId: { in: ids } } } });
    await prisma.yearlyProgramSubscription.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
  if (originalRegistrationOpen !== null) await setRegistrationOpen(originalRegistrationOpen);
}

async function post(args: { email: string; cookieToken?: string; invite?: string; recurring?: boolean }) {
  const orderReference = `yearly-program-monthly_${TAG}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    host: 'localhost:3000',
    'x-forwarded-for': RUN_IP,
  };
  if (args.cookieToken) headers.cookie = `${RENEW_COOKIE_NAME}=${args.cookieToken}`;
  const req = new NextRequest('http://localhost:3000/api/wayforpay', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      orderReference,
      clientEmail: args.email,
      clientName: 'Registration Closed E2E',
      clientPhone: '+380670000000',
      country: 'UA',
      telegramUsername: 'regclosede2e',
      recurring: args.recurring ?? false,
      ...(args.invite ? { invite: args.invite } : {}),
    }),
  });
  const res = await POST(req);
  const body = await res.json();
  return { status: res.status, body, orderReference };
}

/// Чинний студент: MONTHLY, autoRenew=false, один зарахований платіж у поточному наборі.
async function makeStudent(email: string, cohortId: string) {
  const user = await prisma.user.create({ data: { email, name: 'Чинний студент' } });
  const sub = await prisma.yearlyProgramSubscription.create({
    data: { userId: user.id, plan: 'MONTHLY', status: 'ACTIVE', autoRenew: false, cohortId },
  });
  await prisma.payment.create({
    data: {
      userId: user.id,
      orderReference: `${TAG}-seed-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      amount: 2200,
      status: 'PAID',
      paidAt: new Date(),
      yearlyProgramSubscriptionId: sub.id,
    },
  });
  return { user, sub };
}

async function subsCount(email: string) {
  return prisma.yearlyProgramSubscription.count({ where: { user: { email } } });
}

async function main() {
  console.log(`[${TAG}] host: ${(process.env.DATABASE_URL || '').match(/@([^/:?]+)/)?.[1]}`);
  const sellable = await prisma.yearlyProgramCohort.findFirst({ where: { isCurrent: true } });
  if (!sellable) throw new Error('У dev-БД немає поточного набору — сценарії не мають сенсу');
  const settingRow = await prisma.yearlyProgramSetting.findUnique({ where: { id: YEARLY_PROGRAM_SETTING_ID } });
  originalRegistrationOpen = settingRow?.registrationOpen ?? true;
  console.log(`Набір: ${sellable.name} · registrationOpen було = ${originalRegistrationOpen}\n`);

  await cleanup();
  await setRegistrationOpen(false);

  // ── 1. Чинний студент при закритій реєстрації ─────────────────────────────────────
  const emailLink = `${TAG}-student-link@example.com`;
  const link = await makeStudent(emailLink, sellable.id);
  const token = signRenewToken({ subscriptionId: link.sub.id, email: emailLink, cohortId: sellable.id });
  const r1 = await post({ email: emailLink, cookieToken: token });
  check('1) персональне посилання при закритій реєстрації: 200',
    r1.status === 200, `status=${r1.status} code=${r1.body?.code ?? '—'}`);
  check('1) регулярного правила у payload немає (разова оплата модуля)',
    r1.body?.regularOn === undefined, `regularOn=${r1.body?.regularOn ?? '—'}`);
  const payLink = await prisma.payment.findFirst({
    where: { orderReference: r1.orderReference }, select: { yearlyProgramSubscriptionId: true },
  });
  check('1) платіж ліг у ту саму підписку, нової не заведено',
    payLink?.yearlyProgramSubscriptionId === link.sub.id && (await subsCount(emailLink)) === 1);

  const emailRow = `${TAG}-student-row@example.com`;
  const row = await makeStudent(emailRow, sellable.id);
  const r2 = await post({ email: emailRow });
  check('1) лендінговий рядок (без cookie) при закритій реєстрації: 200',
    r2.status === 200, `status=${r2.status} code=${r2.body?.code ?? '—'}`);
  const payRow = await prisma.payment.findFirst({
    where: { orderReference: r2.orderReference }, select: { yearlyProgramSubscriptionId: true },
  });
  check('1) платіж з рядка ліг у наявну підписку',
    payRow?.yearlyProgramSubscriptionId === row.sub.id && (await subsCount(emailRow)) === 1);

  // ── 2. Новий email при закритій реєстрації ────────────────────────────────────────
  const emailNew = `${TAG}-newcomer@example.com`;
  const r3 = await post({ email: emailNew });
  check('2) новий email без invite: 409 registration_closed',
    r3.status === 409 && r3.body?.code === 'registration_closed',
    `status=${r3.status} code=${r3.body?.code ?? '—'}`);
  check('2) підписка не заведена', (await subsCount(emailNew)) === 0);
  check('2) платіж не заведено',
    (await prisma.payment.count({ where: { orderReference: r3.orderReference } })) === 0);

  // ── 3. Той самий новий email, але з invite менеджера ──────────────────────────────
  const invite = signInvite({
    email: emailNew,
    plan: 'MONTHLY',
    autoRenew: false,
    cohortId: sellable.id,
    invitedBy: 'e2e@uimp.com.ua',
  });
  const r4 = await post({ email: emailNew, invite });
  check('3) invite менеджера обходить закриту реєстрацію: 200',
    r4.status === 200, `status=${r4.status} code=${r4.body?.code ?? '—'}`);
  check('3) підписка створена саме через invite', (await subsCount(emailNew)) === 1);

  // ── 4. Абандонована PENDING-спроба без оплат ──────────────────────────────────────
  const emailPending = `${TAG}-abandoned@example.com`;
  const userPending = await prisma.user.create({ data: { email: emailPending, name: 'Абандон' } });
  await prisma.yearlyProgramSubscription.create({
    data: { userId: userPending.id, plan: 'MONTHLY', status: 'PENDING', autoRenew: false, cohortId: sellable.id },
  });
  const r5 = await post({ email: emailPending });
  check('4) PENDING без жодної оплати — не «чинний студент»: 409',
    r5.status === 409 && r5.body?.code === 'registration_closed',
    `status=${r5.status} code=${r5.body?.code ?? '—'}`);

  // ── 5. Контроль: відкрита реєстрація нічого не зламала ────────────────────────────
  await setRegistrationOpen(true);
  const emailOpen = `${TAG}-open@example.com`;
  const r6 = await post({ email: emailOpen });
  check('5) відкрита реєстрація: новий email купує як раніше — 200',
    r6.status === 200, `status=${r6.status} code=${r6.body?.code ?? '—'}`);
  check('5) підписка створена', (await subsCount(emailOpen)) === 1);

  await cleanup();
  console.log(failures === 0 ? '\n✅ Усі перевірки пройдені' : `\n❌ Провалено перевірок: ${failures}`);
  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await cleanup().catch(() => {});
  await prisma.$disconnect();
  process.exit(1);
});
