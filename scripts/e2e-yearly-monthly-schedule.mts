/// E2E-перевірка сітки модулів у РЕАЛЬНОМУ обробнику `/api/wayforpay` (без dev-сервера:
/// POST-хендлер викликається в процесі). Дивимось те, що піде у WayForPay: `dateNext`
/// (перший день наступного модуля), `dateEnd` і кількість списань.
/// Запуск (dev-БД): node --import tsx scripts/e2e-yearly-monthly-schedule.mts
///
/// Навіщо: `dateNext` — це дата, коли з картки клієнта підуть гроші. Юніт-тести
/// перевіряють формулу, а цей скрипт — що саме її результат доходить до payload-у через
/// увесь роут (guard-и, резолв набору, регулярні прапори).
///
/// «Сьогодні» підмінюється мок-класом Date (не системним годинником), щоб перевірити
/// покупку в межах різних модулів набору.
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
config({ path: resolve(root, '.env.local'), override: true });

// `getServerSession` всередині роуту читає Next-івський request-store, якого поза
// живим сервером немає. Підмінюємо ЕКСПОРТ next-auth (CJS) ДО імпорту роуту — так
// перевіряється справжній код роуту, а не його копія, і жодного другого dev-сервера.
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

const TAG = 'yr-grid-e2e';
const EMAIL = `${TAG}@example.com`;

let failures = 0;
function check(label: string, ok: boolean, extra = '') {
  console.log(`${ok ? '✔' : '✘'} ${label}${extra ? ` — ${extra}` : ''}`);
  if (!ok) failures++;
}

const RealDate = Date;
function freeze(iso: string) {
  const fixed = new RealDate(iso).getTime();
  class FrozenDate extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) super(fixed);
      // @ts-expect-error — прокидаємо аргументи як є, поведінка як у справжнього Date.
      else super(...args);
    }
    static now() { return fixed; }
  }
  (globalThis as unknown as { Date: DateConstructor }).Date = FrozenDate as unknown as DateConstructor;
}
function unfreeze() {
  (globalThis as unknown as { Date: DateConstructor }).Date = RealDate;
}

async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: EMAIL }, select: { id: true } });
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return;
  await prisma.payment.deleteMany({ where: { userId: { in: ids } } });
  await prisma.yearlyProgramSubscriptionEvent.deleteMany({ where: { subscription: { userId: { in: ids } } } });
  await prisma.yearlyProgramSubscription.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

async function purchase(nowIso: string) {
  freeze(nowIso);
  // Роут імпортуємо ПІСЛЯ заморозки — модуль сам по собі дат не кешує, але так
  // гарантовано жодна ініціалізація не встигне взяти справжній «зараз».
  const { POST } = await import('../app/api/wayforpay/route');
  const orderReference = `yearly-program-monthly_${TAG}_${RealDate.now()}`;
  const req = new NextRequest('http://localhost:3000/api/wayforpay', {
    method: 'POST',
    headers: { 'content-type': 'application/json', host: 'localhost:3000' },
    body: JSON.stringify({
      orderReference,
      clientEmail: EMAIL,
      clientName: 'YR Grid E2E',
      clientPhone: '+380670000000',
      recurring: true,
      country: 'UA',
      telegramUsername: 'yrgride2e',
    }),
  });
  const res = await POST(req);
  const body = await res.json();
  unfreeze();
  return { status: res.status, body };
}

async function main() {
  console.log(`[e2e-yearly-monthly-schedule] host: ${(process.env.DATABASE_URL || '').match(/@([^/:?]+)/)?.[1]}`);
  const cohort = await prisma.yearlyProgramCohort.findFirst({ where: { isCurrent: true } });
  console.log(`Набір: ${cohort?.name} · ${cohort?.startDate.toISOString().slice(0, 10)} → ${cohort?.endDate.toISOString().slice(0, 10)}\n`);

  await cleanup();

  // Модуль 1 (вересень) — покупка 06.09.2026.
  const sep = await purchase('2026-09-06T09:00:00.000Z');
  console.log('06.09 →', JSON.stringify({ dateNext: sep.body.dateNext, dateEnd: sep.body.dateEnd, regularOn: sep.body.regularOn }));
  check('06.09: dateNext = 01.10.2026', sep.body.dateNext === '01.10.2026', String(sep.body.dateNext));
  check('06.09: dateEnd = 11.05.2027', sep.body.dateEnd === '11.05.2027', String(sep.body.dateEnd));
  check('06.09: регулярка увімкнена', sep.body.regularOn === '1' && sep.body.regularMode === 'monthly');

  await cleanup();

  // Модуль 2 (жовтень) — покупка 06.10.2026: слотів уже 8, dateNext 01.11.
  const oct = await purchase('2026-10-06T09:00:00.000Z');
  console.log('06.10 →', JSON.stringify({ dateNext: oct.body.dateNext, dateEnd: oct.body.dateEnd, regularOn: oct.body.regularOn }));
  check('06.10: dateNext = 01.11.2026', oct.body.dateNext === '01.11.2026', String(oct.body.dateNext));
  check('06.10: dateEnd = 11.05.2027', oct.body.dateEnd === '11.05.2027', String(oct.body.dateEnd));
  check('06.10: регулярка увімкнена', oct.body.regularOn === '1' && oct.body.regularMode === 'monthly');

  await cleanup();

  // Останній модуль набору (травень 2027): списання лишилось рівно одне — Purchase.
  // Регулярні прапори не чіпляються взагалі, інакше WFP запрограмував би списання
  // після кінця програми.
  const may = await purchase('2027-05-05T09:00:00.000Z');
  console.log('05.05.2027 ->', JSON.stringify({ dateNext: may.body.dateNext, dateEnd: may.body.dateEnd, regularOn: may.body.regularOn }));
  check('05.05.2027: регулярних прапорів немає', may.body.regularOn === undefined && may.body.dateNext === undefined);

  await cleanup();

  console.log(failures === 0 ? '\n✅ Усі перевірки пройдені' : `\n❌ Провалено перевірок: ${failures}`);
  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => {
  unfreeze();
  console.error(e);
  await cleanup().catch(() => {});
  await prisma.$disconnect();
  process.exit(1);
});
