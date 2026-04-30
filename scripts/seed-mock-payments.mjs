// Заповнює dev-БД щільними моковими платежами для перевірки аналітики
// (графік, KPI, Платежі/Логи). Усі orderReference з префіксом MOCK-, тож
// cleanup-mock-payments.mjs стирає їх одним where-фільтром.
//
// Кожен insert обгорнутий у try/catch — одна погана строчка не валить решту.
// У кінці друкуємо зведення помилок (якщо були) з кодами Prisma.
//
// Запуск: node scripts/seed-mock-payments.mjs
import prisma from './_db.mjs';
import { randomBytes } from 'node:crypto';

const PREFIX = 'MOCK-';
const NOW = new Date();
const MONTHS_BACK = 13;

/// Кількість записів — щоб графік виглядав живим (3–4 продажі/день у середньому).
const COUNT = {
  course: 600,
  bundle: 220,
  yearly: 50,
  monthlyOnce: 35,
  autoSubs: 18,         /// підписок з 3–5 авто-списаннями
  connector: 250,
  mockStudents: 30,
};

function rand(min, max) { return Math.random() * (max - min) + min; }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function uid() { return randomBytes(8).toString('hex'); }
function ref() { return PREFIX + uid(); }

/// Рандомна дата за останні MONTHS_BACK місяців з нахилом до недавніх,
/// щоб крива виглядала як зростання, а не плоский шум.
function randomDate() {
  const skew = Math.pow(Math.random(), 0.7);
  const ms = NOW.getTime() - skew * MONTHS_BACK * 30 * 24 * 60 * 60 * 1000;
  const d = new Date(ms);
  d.setUTCHours(randInt(7, 19), randInt(0, 59), randInt(0, 59), 0);
  return d;
}

const FIRST = ['Олена','Марія','Ірина','Юлія','Анна','Тетяна','Наталя','Світлана','Оксана','Катерина','Дмитро','Андрій','Сергій','Микола','Олександр','Богдан','Валерія','Ольга','Лілія','Софія'];
const LAST = ['Шевченко','Коваль','Бойко','Мельник','Ткач','Іваненко','Кравець','Гончар','Кушнір','Поліщук','Кравчук','Лисенко','Петренко','Савчук'];
function fullName() { return `${pick(FIRST)} ${pick(LAST)}`; }

/// === Запуск з підрахунком помилок ===
const errors = new Map();
function recordErr(label, e) {
  const key = `${label}: ${e?.code || (e?.message || 'unknown').slice(0, 90)}`;
  errors.set(key, (errors.get(key) || 0) + 1);
}

console.log('=== SEEDING MOCK PAYMENTS (dev only) ===\n');

/// 1. Mock-студенти. Створюємо рівно COUNT.mockStudents штук з гарантовано
/// унікальним email — щоб не конфліктувати з існуючими і не дублювати на ретраях.
console.log(`Створюю ${COUNT.mockStudents} mock-студентів…`);
const mockStudents = [];
for (let i = 0; i < COUNT.mockStudents; i++) {
  try {
    const u = await prisma.user.create({
      data: {
        name: fullName(),
        email: `${PREFIX.toLowerCase()}student.${uid()}@example.com`,
        role: 'STUDENT',
      },
      select: { id: true },
    });
    mockStudents.push(u);
  } catch (e) {
    recordErr('createMockStudent', e);
  }
}
const existingStudents = await prisma.user.findMany({
  where: { role: 'STUDENT', deletedAt: null },
  select: { id: true },
  take: 50,
});
const allStudents = [...mockStudents, ...existingStudents];
console.log(`Студентів в пулі: ${allStudents.length}`);

if (!allStudents.length) {
  console.error('⚠ Немає жодного студента в БД — зупиняюсь.');
  process.exit(1);
}

/// 2. Каталог курсів і пакетів.
const courses = await prisma.course.findMany({
  where: { published: true },
  select: { id: true, price: true },
  take: 50,
});
const bundles = await prisma.bundle.findMany({
  where: { published: true, suspendedAt: null },
  select: { id: true, price: true },
  take: 30,
});
console.log(`Курсів: ${courses.length}, пакетів: ${bundles.length}`);
if (!courses.length || !bundles.length) {
  console.error('⚠ Не знайдено курсів або пакетів — створи бодай по одному. Зупиняюсь.');
  process.exit(1);
}

/// === helper: створити Payment + CallbackLog у parallel-safe манері ===
async function createPayment({ user, createdAt, amount, courseId = null, bundleId = null, yearlySubId = null, kind, label }) {
  const orderReference = ref();
  try {
    await prisma.payment.create({
      data: {
        userId: user.id,
        orderReference,
        amount,
        currency: 'UAH',
        status: 'PAID',
        createdAt,
        paidAt: createdAt,
        courseId,
        bundleId,
        yearlyProgramSubscriptionId: yearlySubId,
        source: Math.random() < 0.85 ? 'UIMP' : 'TETYANA',
      },
    });
  } catch (e) {
    recordErr(`payment.${label}`, e);
    return false;
  }
  try {
    await prisma.paymentCallbackLog.create({
      data: {
        source: 'wayforpay',
        kind,
        orderReference,
        transactionStatus: 'Approved',
        amount,
        currency: 'UAH',
        signatureValid: true,
        prevStatus: 'PENDING',
        actionsTaken: 'payment:updated,enrollment:created,sendpulse:sent(1)',
        createdAt,
        rawPayload: { merchantAccount: 'mock', orderReference, amount, transactionStatus: 'Approved' },
      },
    });
  } catch (e) {
    recordErr(`log.${label}`, e);
  }
  return true;
}

/// Виконавець з паралелізмом 10 — щоб семеро Prisma-конекшенів не штурмували Neon.
async function runBatch(label, total, taskFactory, concurrency = 10) {
  let done = 0;
  let ok = 0;
  const queue = Array.from({ length: total }, (_, i) => i);
  async function worker() {
    while (queue.length) {
      const i = queue.shift();
      const success = await taskFactory(i).catch(e => { recordErr(label, e); return false; });
      done++;
      if (success !== false) ok++;
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  console.log(`${label.padEnd(20)} ${ok}/${total}`);
}

/// 3. Курси.
await runBatch('Курси', COUNT.course, async () => {
  const c = pick(courses);
  return createPayment({
    user: pick(allStudents),
    createdAt: randomDate(),
    amount: c.price && c.price > 0 ? c.price : randInt(800, 3200),
    courseId: c.id,
    kind: 'course',
    label: 'course',
  });
});

/// 4. Пакети.
await runBatch('Пакети', COUNT.bundle, async () => {
  const b = pick(bundles);
  return createPayment({
    user: pick(allStudents),
    createdAt: randomDate(),
    amount: b.price && b.price > 0 ? b.price : randInt(2500, 7500),
    bundleId: b.id,
    kind: 'bundle',
    label: 'bundle',
  });
});

/// 5. Yearly · YEARLY (15000) — кожен платіж = окрема підписка.
await runBatch('Річна YEARLY', COUNT.yearly, async () => {
  const user = pick(allStudents);
  const createdAt = randomDate();
  let sub;
  try {
    sub = await prisma.yearlyProgramSubscription.create({
      data: {
        userId: user.id,
        plan: 'YEARLY',
        status: 'ACTIVE',
        autoRenew: false,
        startDate: createdAt,
        expiresAt: new Date(createdAt.getTime() + 365 * 24 * 60 * 60 * 1000),
        lastPaymentAt: createdAt,
      },
      select: { id: true },
    });
  } catch (e) {
    recordErr('subscription.yearly', e);
    return false;
  }
  return createPayment({
    user, createdAt, amount: 15000, yearlySubId: sub.id, kind: 'yearly', label: 'yearly',
  });
}, 5);

/// 6. Yearly · MONTHLY одноразова.
await runBatch('Місячна·одноразова', COUNT.monthlyOnce, async () => {
  const user = pick(allStudents);
  const createdAt = randomDate();
  let sub;
  try {
    sub = await prisma.yearlyProgramSubscription.create({
      data: {
        userId: user.id,
        plan: 'MONTHLY',
        status: 'ACTIVE',
        autoRenew: false,
        startDate: createdAt,
        expiresAt: new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000),
        lastPaymentAt: createdAt,
      },
      select: { id: true },
    });
  } catch (e) {
    recordErr('subscription.monthly_once', e);
    return false;
  }
  return createPayment({
    user, createdAt, amount: 2200, yearlySubId: sub.id, kind: 'yearly', label: 'monthly_once',
  });
}, 5);

/// 7. Yearly · MONTHLY автосписання — підписка + 3–5 послідовних charge-ів.
let autoOk = 0;
for (let i = 0; i < COUNT.autoSubs; i++) {
  const user = pick(allStudents);
  const firstAt = randomDate();
  let sub;
  try {
    sub = await prisma.yearlyProgramSubscription.create({
      data: {
        userId: user.id,
        plan: 'MONTHLY',
        status: 'ACTIVE',
        autoRenew: true,
        startDate: firstAt,
        lastPaymentAt: firstAt,
        recToken: 'mock-rec-' + uid(),
      },
      select: { id: true },
    });
  } catch (e) {
    recordErr('subscription.monthly_auto', e);
    continue;
  }
  const charges = randInt(3, 5);
  for (let j = 0; j < charges; j++) {
    const at = new Date(firstAt.getTime() + j * 30 * 24 * 60 * 60 * 1000);
    if (at.getTime() > NOW.getTime()) break;
    const ok = await createPayment({
      user, createdAt: at, amount: 2200, yearlySubId: sub.id, kind: 'yearly', label: 'monthly_auto',
    });
    if (ok) autoOk++;
  }
}
console.log(`Місячна·автоплатіж     ${autoOk} payments across ${COUNT.autoSubs} subs`);

/// 8. ConnectorOrder + його callback-лог.
await runBatch('Конектор', COUNT.connector, async () => {
  const name = fullName();
  const createdAt = randomDate();
  const orderReference = ref();
  const amount = Math.random() < 0.05 ? randInt(800, 1300) : 1099;
  try {
    await prisma.connectorOrder.create({
      data: {
        email: `${PREFIX.toLowerCase()}${uid()}@example.com`,
        fullName: name,
        phone: '+38050' + randInt(1000000, 9999999),
        city: pick(['Київ','Львів','Одеса','Харків','Дніпро','Вінниця','Полтава','Чернівці']),
        postOffice: 'Відділення №' + randInt(1, 99),
        orderReference,
        amount,
        gamePrice: amount,
        paymentStatus: 'PAID',
        paidAt: createdAt,
        orderStatus: pick(['NEW','PROCESSING','SHIPPED','DELIVERED']),
        createdAt,
        source: Math.random() < 0.7 ? 'UIMP' : 'TETYANA',
      },
    });
  } catch (e) {
    recordErr('connector', e);
    return false;
  }
  try {
    await prisma.paymentCallbackLog.create({
      data: {
        source: 'wayforpay',
        kind: 'connector',
        orderReference,
        transactionStatus: 'Approved',
        amount,
        currency: 'UAH',
        signatureValid: true,
        prevStatus: 'PENDING',
        actionsTaken: 'connector:paid',
        createdAt,
        rawPayload: { merchantAccount: 'mock', orderReference, amount },
      },
    });
  } catch (e) {
    recordErr('log.connector', e);
  }
  return true;
});

console.log('\n=== DONE ===');
if (errors.size === 0) {
  console.log('Помилок: 0 ✓');
} else {
  console.log(`Помилок: ${[...errors.values()].reduce((a, b) => a + b, 0)}`);
  for (const [k, v] of [...errors.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(v).padStart(4)}×  ${k}`);
  }
}
console.log('\nПрибрати: node scripts/cleanup-mock-payments.mjs');
await prisma.$disconnect();
