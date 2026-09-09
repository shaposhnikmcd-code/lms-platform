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
/// 4b. Менеджер не може видати такій підписці персональне посилання: endpoint видачі
///    відмовляє, поки немає жодної оплати (інакше студент отримав би кнопку, яка веде
///    у відмову платіжки).
/// 5. Мертва/жива підписка в тому ж наборі при закритій реєстрації: EXPIRED разова з
///    оплатою — не `registration_closed` (вона чинний студент, далі вирішує сітка).
/// 6. Крос-планові блоки лишились головнішими за рубильник: автоплатіж у GRACE →
///    `monthly_autopay_active`, активна Річна → `yearly_already_purchased`.
/// 7. Студент незавершеного набору 2026 БЕЗ персонального посилання, коли продажі вже
///    йдуть в інший набір → 200, і платіж лягає у ЙОГО набір, а не в продажний.
/// 8. ADMIN/MANAGER при закритій реєстрації → 200: їм треба прогнати новий продаж на pre.
/// 9. Контроль: при ВІДКРИТІЙ реєстрації новий email купує як раніше → 200.
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
// справжній код роуту, а не його копія. Сесія змінна: сценарій «менеджер тестує продаж»
// вимагає роль ADMIN у тому самому процесі.
let fakeSession: { user?: { role?: string; email?: string } } | null = null;
const require_ = createRequire(import.meta.url);
const nextAuthPath = require_.resolve('next-auth');
require_.cache[nextAuthPath] = {
  id: nextAuthPath,
  filename: nextAuthPath,
  loaded: true,
  exports: { getServerSession: async () => fakeSession },
} as unknown as NodeModule;

const { default: prisma } = await import('../lib/prisma');
const { NextRequest } = await import('next/server');
const { signRenewToken, RENEW_COOKIE_NAME } = await import('../lib/yearlyProgramRenew');
const { signInvite } = await import('../lib/yearlyProgramInvite');
const { resolveSellableCohort } = await import('../lib/yearlyProgramCohort');
const { YEARLY_PROGRAM_SETTING_ID } = await import('../lib/yearlyProgramSettings');
const { POST } = await import('../app/api/wayforpay/route');
const { POST: RENEW_LINK_POST } = await import('../app/api/admin/yearly-program/[id]/renew-link/route');

const TAG = 'yr-registration-closed-e2e';
/// Ініціація платежу обмежена 10 запитами / 5 хв на IP (`limiters.payment`), а сценаріїв
/// тут більше. Ліміт лишається справжнім — просто кожен «покупець» приходить зі своєї
/// адреси, як воно й буває насправді.
let ipCounter = Math.floor(Math.random() * 200);
const nextIp = () => `203.0.113.${(ipCounter++ % 254) + 1}`;

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
  await prisma.yearlyProgramCohort.deleteMany({ where: { id: { startsWith: TAG } } });
  if (originalRegistrationOpen !== null) await setRegistrationOpen(originalRegistrationOpen);
  fakeSession = null;
}

async function post(args: { email: string; cookieToken?: string; invite?: string; recurring?: boolean }) {
  const orderReference = `yearly-program-monthly_${TAG}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    host: 'localhost:3000',
    'x-forwarded-for': nextIp(),
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

/// Чинний студент: за замовчуванням MONTHLY ACTIVE, autoRenew=false, один зарахований
/// платіж «сьогодні» (тобто в поточному модулі — боргу за графіком немає).
async function makeStudent(email: string, cohortId: string, overrides: {
  plan?: 'MONTHLY' | 'YEARLY';
  status?: string;
  autoRenew?: boolean;
  amount?: number;
} = {}) {
  const user = await prisma.user.create({ data: { email, name: 'Чинний студент' } });
  const sub = await prisma.yearlyProgramSubscription.create({
    data: {
      userId: user.id,
      plan: overrides.plan ?? 'MONTHLY',
      status: (overrides.status ?? 'ACTIVE') as never,
      autoRenew: overrides.autoRenew ?? false,
      cohortId,
    },
  });
  await prisma.payment.create({
    data: {
      userId: user.id,
      orderReference: `${TAG}-seed-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      amount: overrides.amount ?? 2200,
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

  // ── 4b. Видача персонального посилання на підписку без оплат ──────────────────────
  // Дзеркало сценарію 4 з боку менеджера: якщо роут таку оплату не пропустить, посилання
  // видавати не можна — інакше менеджер сам надішле студенту глухий кут.
  const renewLink = async (subscriptionId: string) => {
    fakeSession = { user: { role: 'MANAGER', email: 'manager@uimp.com.ua' } };
    const req = new NextRequest(`http://localhost:3000/api/admin/yearly-program/${subscriptionId}/renew-link`, {
      method: 'POST',
      headers: { host: 'localhost:3000' },
    });
    const res = await RENEW_LINK_POST(req, { params: Promise.resolve({ id: subscriptionId }) });
    fakeSession = null;
    return { status: res.status, body: await res.json() };
  };

  const pendingSub = await prisma.yearlyProgramSubscription.findFirst({
    where: { user: { email: emailPending } }, select: { id: true },
  });
  const linkPending = await renewLink(pendingSub!.id);
  check('4b) посилання на підписку без оплат не видається',
    linkPending.status === 409 && !linkPending.body?.url,
    `status=${linkPending.status} url=${linkPending.body?.url ? 'є' : '—'}`);
  const linkStudent = await renewLink(link.sub.id);
  check('4b) чинному студенту посилання видається як раніше',
    linkStudent.status === 200 && typeof linkStudent.body?.url === 'string',
    `status=${linkStudent.status} url=${linkStudent.body?.url ? 'є' : '—'}`);

  // ── 5. Мертва підписка з оплатами в живому наборі ─────────────────────────────────
  // EXPIRED — це не «новий покупець»: людина платила, доступ згорів, і саме нова оплата
  // її оживляє (callback вміє це з 2026-08-04). Рубильник продажів тут ні до чого; далі
  // вирішує сітка модулів (може віддати чесний борг — це інша відповідь, не наша).
  const emailExpired = `${TAG}-expired@example.com`;
  const expired = await makeStudent(emailExpired, sellable.id, { status: 'EXPIRED' });
  const r7 = await post({ email: emailExpired });
  check('5) EXPIRED разова з оплатою при закритій реєстрації — не registration_closed',
    r7.body?.code !== 'registration_closed', `status=${r7.status} code=${r7.body?.code ?? '—'}`);
  if (r7.status === 200) {
    const payExpired = await prisma.payment.findFirst({
      where: { orderReference: r7.orderReference }, select: { yearlyProgramSubscriptionId: true },
    });
    check('5) оплата оживляє ту саму підписку, нової не заводить',
      payExpired?.yearlyProgramSubscriptionId === expired.sub.id && (await subsCount(emailExpired)) === 1);
  }

  // ── 6. Крос-планові блоки лишились головнішими за рубильник ───────────────────────
  // Ці 409-і людині корисніші за «реєстрація закрита»: вони кажуть, що робити далі.
  const emailAutopay = `${TAG}-autopay-grace@example.com`;
  await makeStudent(emailAutopay, sellable.id, { status: 'GRACE', autoRenew: true });
  const r8 = await post({ email: emailAutopay });
  check('6) автоплатіж у GRACE — monthly_autopay_active, а не registration_closed',
    r8.status === 409 && r8.body?.code === 'monthly_autopay_active',
    `status=${r8.status} code=${r8.body?.code ?? '—'}`);

  const emailYearly = `${TAG}-yearly-active@example.com`;
  await makeStudent(emailYearly, sellable.id, { plan: 'YEARLY', amount: 15000 });
  const r9 = await post({ email: emailYearly });
  check('6) активна Річна — yearly_already_purchased, а не registration_closed',
    r9.status === 409 && r9.body?.code === 'yearly_already_purchased',
    `status=${r9.status} code=${r9.body?.code ?? '—'}`);

  // ── 7. Студент СВОГО набору, коли продажі йдуть в інший ───────────────────────────
  // Головний сценарій наступної весни: набір 2026 ще триває, поряд заведено набір під
  // продажі. Без цієї гілки лендінговий рядок вів студента 2026 у чужу сітку або в 409:
  // набір брався з `resolveSellableCohort`, а фільтр реюзу обнуляв підписку іншого набору.
  const ownCohort = await prisma.yearlyProgramCohort.create({
    data: {
      id: `${TAG}-own-cohort`,
      name: `${TAG} власний набір студента`,
      // Ще не завершений (endDate у майбутньому), але вже запущений і не «Поточний» —
      // тож продажним резолвером не вибирається.
      startDate: new Date('2026-03-01T00:00:00.000Z'),
      endDate: new Date('2026-11-30T23:59:59.999Z'),
      isCurrent: false,
      launchedAt: new Date('2026-03-01T00:00:00.000Z'),
    },
  });
  const stillSellable = await resolveSellableCohort(prisma);
  check('7) продажний набір — не набір студента (умова сценарію)',
    stillSellable?.id === sellable.id && sellable.id !== ownCohort.id,
    `sellable=${stillSellable?.id ?? '—'} own=${ownCohort.id}`);

  const emailOwn = `${TAG}-own-cohort-student@example.com`;
  const own = await makeStudent(emailOwn, ownCohort.id);
  const r10 = await post({ email: emailOwn });
  check('7) доплата без посилання при закритій реєстрації — 200',
    r10.status === 200, `status=${r10.status} code=${r10.body?.code ?? '—'}`);
  const payOwn = await prisma.payment.findFirst({
    where: { orderReference: r10.orderReference }, select: { yearlyProgramSubscriptionId: true },
  });
  check('7) платіж ліг у підписку СВОГО набору, нової в продажному не заведено',
    payOwn?.yearlyProgramSubscriptionId === own.sub.id && (await subsCount(emailOwn)) === 1,
    `sub=${payOwn?.yearlyProgramSubscriptionId ?? '—'}`);
  const ownAfter = await prisma.yearlyProgramSubscription.findUnique({
    where: { id: own.sub.id }, select: { cohortId: true },
  });
  check('7) набір підписки не перепризначено на продажний',
    ownAfter?.cohortId === ownCohort.id, `cohort=${ownAfter?.cohortId ?? '—'}`);

  // ── 8. ADMIN/MANAGER при закритій реєстрації ──────────────────────────────────────
  // Роль читається з серверної сесії — та сама, що дає символічну ціну 1 ₴. Менеджеру
  // треба прогнати НОВИЙ продаж наскрізь на pre саме тоді, коли для людей усе закрито.
  fakeSession = { user: { role: 'ADMIN' } };
  const emailStaff = `${TAG}-staff@example.com`;
  const r11 = await post({ email: emailStaff });
  fakeSession = null;
  check('8) ADMIN при закритій реєстрації — 200',
    r11.status === 200, `status=${r11.status} code=${r11.body?.code ?? '—'}`);
  check('8) підписка створена', (await subsCount(emailStaff)) === 1);

  // ── 9. Контроль: відкрита реєстрація нічого не зламала ────────────────────────────
  await setRegistrationOpen(true);
  const emailOpen = `${TAG}-open@example.com`;
  const r12 = await post({ email: emailOpen });
  check('9) відкрита реєстрація: новий email купує як раніше — 200',
    r12.status === 200, `status=${r12.status} code=${r12.body?.code ?? '—'}`);
  check('9) підписка створена', (await subsCount(emailOpen)) === 1);

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
