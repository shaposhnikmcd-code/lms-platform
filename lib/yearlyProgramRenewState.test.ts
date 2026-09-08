/// Юніт-тести стану панелі поновлення («Оплата наступного модуля»).
/// Запуск: `npm run test:renewstate` (або `npm test` разом з рештою).
///
/// Головне, що тут стережеться, — ДЕФЕКТ, знайдений живим обходом pre: поновлення
/// звірялося з «набором, у якому зараз ідуть продажі» (`resolveSellableCohort`). Щойно
/// поряд зʼявляється другий набір — весняний 2027 під продажі або просто створений без
/// `isCurrent` — усі персональні посилання чинного набору ставали «недійсними», а панель
/// на такому стані рендерила порожнечу. Тому тести перевіряють дві речі разом:
/// набір беремо з ПІДПИСКИ, і жоден не-payable стан не лишається без тексту.
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NEXTAUTH_SECRET ??= 'test-secret-for-renew-state-unit-tests';

import { signRenewToken } from './yearlyProgramRenew';
import { RENEW_BLOCK_REASONS, RENEW_DEAD_LINK_COPY, renewBlockCopy } from './yearlyProgramRenewCopy';
import { resolveRenewState } from './yearlyProgramRenewState';

type Client = Parameters<typeof resolveRenewState>[0]['client'];

const EMAIL = 'student@example.com';
const NOW = new Date('2026-11-10T09:00:00Z');

/// Набір А — той, у якому людина НАВЧАЄТЬСЯ (01.09.2026 – 31.05.2027, 9 модулів).
const COHORT_A = {
  id: 'cohort_a_2026',
  startDate: new Date('2026-09-01T00:00:00Z'),
  endDate: new Date('2027-05-31T23:59:59.999Z'),
};
/// Набір Б — той, у якому йдуть ПРОДАЖІ (наступного року). Резолвер не має права
/// про нього навіть спитати: у тестовому клієнті таблиці наборів немає взагалі.
const COHORT_B = {
  id: 'cohort_b_2027',
  startDate: new Date('2027-09-01T00:00:00Z'),
  endDate: new Date('2028-05-31T23:59:59.999Z'),
};

function paidPayment(createdAt: string) {
  return {
    amount: 2200,
    status: 'PAID',
    paidAt: new Date(createdAt),
    createdAt: new Date(createdAt),
    excludedFromAccess: false,
    manualMethod: null,
  };
}

/// Мінімальний стенд замість Prisma: рівно два виклики, які робить резолвер.
function makeClient(sub: Record<string, unknown> | null, yearlySub: { id: string } | null = null): Client {
  return {
    yearlyProgramSubscription: {
      findUnique: async () => sub,
      findFirst: async () => yearlySub,
    },
  } as unknown as Client;
}

function subscription(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub_1',
    userId: 'user_1',
    plan: 'MONTHLY',
    status: 'ACTIVE',
    autoRenew: false,
    cohortId: COHORT_A.id,
    phone: '+380671112233',
    country: 'UA',
    telegramUsername: 'student',
    user: { name: 'Оксана', email: EMAIL },
    cohort: COHORT_A,
    // Оплачено вересень і жовтень → наступний неоплачений модуль 3 (листопад 2026).
    payments: [paidPayment('2026-09-14T10:00:00Z'), paidPayment('2026-10-01T08:00:00Z')],
    ...overrides,
  };
}

const tokenFor = (cohortId = COHORT_A.id, subscriptionId = 'sub_1', email = EMAIL) =>
  signRenewToken({ subscriptionId, email, cohortId });

const resolve = (client: Client, token: string, opts: { registrationOpen?: boolean; now?: Date } = {}) =>
  resolveRenewState({
    client,
    token,
    monthlyPrice: 2200,
    registrationOpen: opts.registrationOpen ?? true,
    now: opts.now ?? NOW,
  });

test('підписка набору А оплачує модуль, навіть коли продажі вже йдуть у набір Б', async () => {
  // Стенд взагалі не вміє віддавати «поточний» набір — якщо резолвер до нього піде,
  // тест впаде. Саме так і виглядав дефект: набір Б робив посилання недійсним.
  assert.notEqual(COHORT_A.id, COHORT_B.id);
  const state = await resolve(makeClient(subscription()), tokenFor());

  assert.equal(state.kind, 'payable');
  if (state.kind !== 'payable') return;
  assert.equal(state.email, EMAIL);
  assert.equal(state.price, 2200);
  // Сітка рахується з набору А: два сплачені модулі → наступний третій, листопад 2026.
  assert.equal(state.module.number, 3);
  assert.equal(state.module.total, 9);
  assert.equal(state.module.monthLabel, 'листопад 2026');
  assert.equal(state.prefill.phone, '+380671112233');
});

test('набір А завершився — не payable, стан із текстом замість кнопки', async () => {
  const finished = {
    id: COHORT_A.id,
    startDate: new Date('2025-09-01T00:00:00Z'),
    endDate: new Date('2026-05-31T23:59:59.999Z'), // раніше за NOW
  };
  const state = await resolve(
    makeClient(subscription({ cohort: finished, payments: [paidPayment('2025-09-10T10:00:00Z')] })),
    tokenFor(),
  );

  assert.equal(state.kind, 'blocked');
  if (state.kind !== 'blocked') return;
  assert.equal(state.reason, 'cohort_finished');
  const copy = renewBlockCopy(state.reason);
  assert.ok(copy.title.length > 0 && copy.body.length > 0 && copy.support.length > 0);
});

test('межа завершення набору — рівно `endDate >= now`, як у решті коду', async () => {
  const client = makeClient(subscription());
  // В останню мілісекунду набору він ще живий: стан рахується по сітці (тут — борг за
  // пропущені модулі), а не «набір завершився».
  const alive = await resolve(client, tokenFor(), { now: COHORT_A.endDate });
  assert.equal(alive.kind === 'blocked' && alive.reason, 'debt');

  const over = await resolve(client, tokenFor(), { now: new Date(COHORT_A.endDate.getTime() + 1) });
  assert.equal(over.kind === 'blocked' && over.reason, 'cohort_finished');
});

test('зіпсований токен дає invalid — і на нього є текст, а не порожній рендер', async () => {
  const state = await resolve(makeClient(subscription()), 'not-a-token');
  assert.equal(state.kind, 'invalid');
  assert.ok(RENEW_DEAD_LINK_COPY.title.length > 0);
  assert.ok(RENEW_DEAD_LINK_COPY.body.length > 0);
  assert.ok(RENEW_DEAD_LINK_COPY.support.length > 0);
});

test('підписку перенесли в інший набір — посилання недійсне', async () => {
  const state = await resolve(makeClient(subscription({ cohortId: COHORT_B.id, cohort: COHORT_B })), tokenFor());
  assert.equal(state.kind, 'invalid');
});

test('чужий email у підписці — посилання недійсне', async () => {
  const state = await resolve(
    makeClient(subscription({ user: { name: 'Інша людина', email: 'other@example.com' } })),
    tokenFor(),
  );
  assert.equal(state.kind, 'invalid');
});

test('деактивована підписка — не invalid, а окремий стан із поясненням', async () => {
  const state = await resolve(makeClient(subscription({ status: 'ARCHIVED' })), tokenFor());
  assert.equal(state.kind, 'blocked');
  if (state.kind !== 'blocked') return;
  assert.equal(state.reason, 'archived');
});

test('автосписання і повна оплата блокують кнопку, а не ведуть у відмову платіжки', async () => {
  const autopay = await resolve(makeClient(subscription({ autoRenew: true })), tokenFor());
  assert.equal(autopay.kind === 'blocked' && autopay.reason, 'autopay');

  const allNine = [
    '2026-09-14', '2026-10-01', '2026-11-01', '2026-12-01', '2027-01-01',
    '2027-02-01', '2027-03-01', '2027-04-01', '2027-05-01',
  ].map((d) => paidPayment(`${d}T10:00:00Z`));
  const paid = await resolve(makeClient(subscription({ payments: allNine })), tokenFor());
  assert.equal(paid.kind === 'blocked' && paid.reason, 'fully_paid');
});

test('пропущені модулі — стан боргу з їх кількістю', async () => {
  // Сплачено лише вересень; NOW = 10.11 → поточний модуль листопад, пропущено жовтень.
  const state = await resolve(
    makeClient(subscription({ payments: [paidPayment('2026-09-14T10:00:00Z')] })),
    tokenFor(),
  );
  assert.equal(state.kind, 'blocked');
  if (state.kind !== 'blocked') return;
  assert.equal(state.reason, 'debt');
  assert.equal(state.missedModules, 1);
  assert.match(renewBlockCopy(state.reason, state.missedModules ?? 0).body, /пропущено 1 модуль/);
});

test('вимкнена реєстрація закриває оплату так само, як картки тарифів', async () => {
  const state = await resolve(makeClient(subscription()), tokenFor(), { registrationOpen: false });
  assert.equal(state.kind === 'blocked' && state.reason, 'registration_closed');
});

test('кожен стан блокування має заголовок, пояснення і контакт менеджера', () => {
  assert.ok(RENEW_BLOCK_REASONS.length >= 8, 'усі причини мають бути в реєстрі текстів');
  for (const reason of RENEW_BLOCK_REASONS) {
    const copy = renewBlockCopy(reason, 2);
    assert.ok(copy.title.trim().length > 0, `${reason}: порожній заголовок`);
    assert.ok(copy.body.trim().length > 0, `${reason}: порожнє пояснення`);
    assert.ok(copy.support.trim().length > 0, `${reason}: немає рядка з менеджером`);
  }
});
