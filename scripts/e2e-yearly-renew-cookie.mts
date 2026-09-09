/// E2E-перевірки renew-cookie у РЕАЛЬНОМУ обробнику `/api/wayforpay` (без dev-сервера:
/// POST-хендлер викликається в процесі, як у `e2e-yearly-monthly-schedule.mts`).
/// Запуск (dev-БД): node --import tsx scripts/e2e-yearly-renew-cookie.mts
///
/// Навіщо саме рівень роуту: усі три випадки нижче — про взаємодію cookie, резолву
/// набору й реюзу підписки. Юніт-тест `resolveRenewState` їх не бачить: він відповідає
/// на питання «що показати на сторінці», а тут ідеться про те, з кого і за що знімуть
/// гроші.
///
/// 1. Cookie на завершений набір + звичайна покупка нового → 200 і cookie погашена
///    (а не 409 на кожній спробі, поки cookie жива).
/// 2. Renew без поля `recurring` → 400, і жодного регулярного правила у payload:
///    підписка була б разовою, а WayForPay списував би щомісяця.
/// 3. Токен на EXPIRED-підписку, коли в тому ж наборі є новіша мертва → реюзається
///    саме підписка з токена, а не найсвіжіша.
///
/// Обмеження: сценарії 2 і 3 читають ПОТОЧНИЙ набір dev-БД і мають сенс, поки він
/// триває (в останньому модулі набору спрацює чесний кеп `monthly_fully_paid`).
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
const { POST } = await import('../app/api/wayforpay/route');
const { GET: RENEW_STATE_GET } = await import('../app/api/yearly-program/renew-state/route');

const TAG = 'yr-renew-cookie-e2e';
const OLD_COHORT_ID = `${TAG}-old-cohort`;
/// Унікальна «адреса» прогону — див. коментар у `post()`.
const RUN_IP = `203.0.113.${Math.floor(Math.random() * 254) + 1}`;

let failures = 0;
function check(label: string, ok: boolean, extra = '') {
  console.log(`${ok ? '✔' : '✘'} ${label}${extra ? ` — ${extra}` : ''}`);
  if (!ok) failures++;
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
  await prisma.yearlyProgramCohort.deleteMany({ where: { id: OLD_COHORT_ID } });
}

async function post(args: { email: string; cookieToken?: string; recurring?: boolean }) {
  const orderReference = `yearly-program-monthly_${TAG}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  // Свій IP на кожен прогін: ініціація платежу обмежена 10 запитами / 5 хв на IP
  // (`limiters.payment`), і два прогони поспіль інакше впираються у 429 замість того,
  // щоб перевіряти роут. Ліміт при цьому лишається справжнім — просто адреса «інша».
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
      clientName: 'Renew Cookie E2E',
      clientPhone: '+380670000000',
      country: 'UA',
      telegramUsername: 'renewcookiee2e',
      // Поле свідомо ВІДСУТНЄ, коли recurring не передали — саме це перевіряє сценарій 2.
      ...(args.recurring === undefined ? {} : { recurring: args.recurring }),
    }),
  });
  const res = await POST(req);
  const body = await res.json();
  return { status: res.status, body, setCookie: res.headers.get('set-cookie') ?? '', orderReference };
}

/// Cookie вважається погашеною, коли у відповіді є `yr_renew=` з порожнім значенням
/// (NextResponse.cookies.delete ставить порожнє значення й дату в минулому).
function cookieCleared(setCookie: string): boolean {
  return new RegExp(`${RENEW_COOKIE_NAME}=;`).test(setCookie);
}

async function main() {
  console.log(`[${TAG}] host: ${(process.env.DATABASE_URL || '').match(/@([^/:?]+)/)?.[1]}`);
  const sellable = await prisma.yearlyProgramCohort.findFirst({ where: { isCurrent: true } });
  if (!sellable) throw new Error('У dev-БД немає поточного набору — сценарії не мають сенсу');
  console.log(`Набір під продажі: ${sellable.name} · ${sellable.startDate.toISOString().slice(0, 10)} → ${sellable.endDate.toISOString().slice(0, 10)}\n`);

  await cleanup();

  // ── 1. Cookie на завершений набір + покупка нового ────────────────────────────────
  const oldCohort = await prisma.yearlyProgramCohort.create({
    data: {
      id: OLD_COHORT_ID,
      name: `${TAG} завершений набір`,
      startDate: new Date('2024-09-01T00:00:00.000Z'),
      endDate: new Date('2025-05-31T23:59:59.999Z'),
      isCurrent: false,
      launchedAt: new Date('2024-09-01T00:00:00.000Z'),
    },
  });
  const emailA = `${TAG}-finished@example.com`;
  const userA = await prisma.user.create({ data: { email: emailA, name: 'Завершений набір' } });
  const subA = await prisma.yearlyProgramSubscription.create({
    data: { userId: userA.id, plan: 'MONTHLY', status: 'EXPIRED', autoRenew: false, cohortId: oldCohort.id },
  });
  await prisma.payment.create({
    data: {
      userId: userA.id, orderReference: `${TAG}-a-${Date.now()}`, amount: 2200,
      status: 'PAID', paidAt: new Date('2024-09-10T10:00:00.000Z'),
      createdAt: new Date('2024-09-10T10:00:00.000Z'), yearlyProgramSubscriptionId: subA.id,
    },
  });
  const tokenA = signRenewToken({ subscriptionId: subA.id, email: emailA, cohortId: oldCohort.id });

  const a = await post({ email: emailA, cookieToken: tokenA, recurring: false });
  check('1) покупка нового набору з мертвою cookie: 200, а не 409',
    a.status === 200, `status=${a.status} code=${a.body?.code ?? '—'}`);
  check('1) cookie yr_renew погашена у відповіді', cookieCleared(a.setCookie), a.setCookie.slice(0, 60));
  const subsA = await prisma.yearlyProgramSubscription.findMany({
    where: { userId: userA.id }, orderBy: { createdAt: 'asc' }, select: { id: true, cohortId: true, status: true },
  });
  check('1) підписка на новий набір створена, стара лишилась у завершеному',
    subsA.length === 2
      && subsA[0].id === subA.id && subsA[0].cohortId === oldCohort.id
      && subsA[1].cohortId === sellable.id,
    JSON.stringify(subsA.map((s) => ({ cohort: s.cohortId === oldCohort.id ? 'old' : 'new', status: s.status }))));
  const eventsA = await prisma.yearlyProgramSubscriptionEvent.count({
    where: { subscriptionId: subA.id, type: 'renew_link_used' },
  });
  check('1) поновлення не зарахувалось у стару підписку', eventsA === 0, `подій=${eventsA}`);

  // ── 2. Renew без поля `recurring` ─────────────────────────────────────────────────
  const emailB = `${TAG}-norecurring@example.com`;
  const userB = await prisma.user.create({ data: { email: emailB, name: 'Без типу оплати' } });
  const subB = await prisma.yearlyProgramSubscription.create({
    data: { userId: userB.id, plan: 'MONTHLY', status: 'ACTIVE', autoRenew: false, cohortId: sellable.id },
  });
  await prisma.payment.create({
    data: {
      userId: userB.id, orderReference: `${TAG}-b-${Date.now()}`, amount: 2200,
      status: 'PAID', paidAt: new Date(), yearlyProgramSubscriptionId: subB.id,
    },
  });
  const tokenB = signRenewToken({ subscriptionId: subB.id, email: emailB, cohortId: sellable.id });

  const b = await post({ email: emailB, cookieToken: tokenB });
  check('2) renew без поля recurring відхилено', b.status === 400 || b.status === 409,
    `status=${b.status} code=${b.body?.code ?? '—'}`);
  check('2) регулярного правила у відповіді немає',
    b.body?.regularOn === undefined && b.body?.dateNext === undefined,
    `regularOn=${b.body?.regularOn ?? '—'}`);
  const paymentsB = await prisma.payment.count({ where: { userId: userB.id, status: 'PENDING' } });
  check('2) платіж не заведено', paymentsB === 0, `PENDING=${paymentsB}`);

  // Контроль: та сама покупка з явним `recurring: false` проходить.
  const bOk = await post({ email: emailB, cookieToken: tokenB, recurring: false });
  check('2) з явним recurring:false та сама оплата проходить',
    bOk.status === 200 && bOk.body?.regularOn === undefined,
    `status=${bOk.status} code=${bOk.body?.code ?? '—'}`);

  // ── 3. Токен на EXPIRED-підписку, поряд є новіша мертва в тому ж наборі ───────────
  const emailC = `${TAG}-dead@example.com`;
  const userC = await prisma.user.create({ data: { email: emailC, name: 'Мертві підписки' } });
  const subC1 = await prisma.yearlyProgramSubscription.create({
    data: {
      userId: userC.id, plan: 'MONTHLY', status: 'EXPIRED', autoRenew: false, cohortId: sellable.id,
      createdAt: new Date(Date.now() - 60 * 60 * 1000),
    },
  });
  await prisma.payment.create({
    data: {
      userId: userC.id, orderReference: `${TAG}-c-${Date.now()}`, amount: 2200,
      status: 'PAID', paidAt: new Date(), yearlyProgramSubscriptionId: subC1.id,
    },
  });
  // Новіша скасована спроба того ж плану в тому ж наборі — саме її брав dead-lookup.
  const subC2 = await prisma.yearlyProgramSubscription.create({
    data: { userId: userC.id, plan: 'MONTHLY', status: 'CANCELLED', autoRenew: false, cohortId: sellable.id },
  });
  const tokenC = signRenewToken({ subscriptionId: subC1.id, email: emailC, cohortId: sellable.id });

  const c = await post({ email: emailC, cookieToken: tokenC, recurring: false });
  check('3) оплата за посиланням прийнята', c.status === 200, `status=${c.status} code=${c.body?.code ?? '—'}`);
  const payC = await prisma.payment.findFirst({
    where: { orderReference: c.orderReference }, select: { yearlyProgramSubscriptionId: true },
  });
  check('3) платіж прив\'язано до підписки з токена, а не до новішої мертвої',
    payC?.yearlyProgramSubscriptionId === subC1.id,
    payC?.yearlyProgramSubscriptionId === subC2.id ? 'взяло новішу' : String(payC?.yearlyProgramSubscriptionId));
  const eventC = await prisma.yearlyProgramSubscriptionEvent.count({
    where: { subscriptionId: subC1.id, type: 'renew_link_used' },
  });
  check('3) подія renew_link_used лягла на підписку з токена', eventC === 1, `подій=${eventC}`);
  check('3) регулярного правила у payload немає', c.body?.regularOn === undefined, `regularOn=${c.body?.regularOn ?? '—'}`);

  // ── 4. `/api/yearly-program/renew-state` гасить cookie на кінцевих станах ─────────
  // Дзеркало сценарію 1 з боку сторінки: людина відкрила лендінг за мертвим посиланням,
  // прочитала пояснення — і cookie не має тягнутись у наступну покупку.
  const renewState = async (token: string) => {
    const req = new NextRequest('http://localhost:3000/api/yearly-program/renew-state', {
      headers: { cookie: `${RENEW_COOKIE_NAME}=${token}`, host: 'localhost:3000' },
    });
    const res = await RENEW_STATE_GET(req);
    return {
      status: res.status,
      body: res.status === 204 ? null : await res.json(),
      cleared: cookieCleared(res.headers.get('set-cookie') ?? ''),
    };
  };

  const finished = await renewState(tokenA);
  check('4) завершений набір: стан cohort_finished і cookie погашена',
    finished.body?.kind === 'blocked' && finished.body?.reason === 'cohort_finished' && finished.cleared,
    `${finished.body?.kind}/${finished.body?.reason ?? '—'} cleared=${finished.cleared}`);

  const emailD = `${TAG}-archived@example.com`;
  const userD = await prisma.user.create({ data: { email: emailD, name: 'Деактивована' } });
  const subD = await prisma.yearlyProgramSubscription.create({
    data: { userId: userD.id, plan: 'MONTHLY', status: 'ARCHIVED', autoRenew: false, cohortId: sellable.id },
  });
  const archived = await renewState(signRenewToken({ subscriptionId: subD.id, email: emailD, cohortId: sellable.id }));
  check('4) деактивована підписка: стан archived і cookie погашена',
    archived.body?.kind === 'blocked' && archived.body?.reason === 'archived' && archived.cleared,
    `${archived.body?.kind}/${archived.body?.reason ?? '—'} cleared=${archived.cleared}`);

  // Контроль: живе посилання cookie НЕ втрачає — блокування бувають тимчасові
  // (автосписання, борг, закриті продажі), і те саме посилання має спрацювати пізніше.
  const alive = await renewState(tokenB);
  check('4) живе посилання cookie не втрачає',
    alive.body?.kind !== 'invalid' && !alive.cleared,
    `${alive.body?.kind}/${alive.body?.reason ?? '—'} cleared=${alive.cleared}`);

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
