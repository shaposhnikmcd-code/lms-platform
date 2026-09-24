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
import { createTranslator } from 'use-intl/core';
import ukMessages from '../messages/uk.json';
import enMessages from '../messages/en.json';
import plMessages from '../messages/pl.json';
import {
  RENEW_BLOCK_REASONS,
  RENEW_STOPS_AUTOPAY_REASONS,
  renewBlockCopy,
  renewDeadLinkCopy,
  renewStopsAutopayCopy,
  type RenewTranslator,
} from './yearlyProgramRenewCopy';
import { autopayAllowsManualTopUp, resolveRenewState } from './yearlyProgramRenewState';

type Client = Parameters<typeof resolveRenewState>[0]['client'];

/// Тексти панелі живуть у `messages/*.json` (простір `RenewPanel`) — перевіряємо їх тим
/// самим механізмом, яким їх рендерить сторінка (ICU, плюралізація).
const LOCALES = { uk: ukMessages, en: enMessages, pl: plMessages } as const;
function translator(locale: keyof typeof LOCALES): RenewTranslator {
  const t = createTranslator({ locale, messages: LOCALES[locale] as never, namespace: 'RenewPanel' as never });
  return (key, values) => (t as unknown as RenewTranslator)(key, values);
}
const UK = translator('uk');

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

const resolve = (client: Client, token: string, opts: { now?: Date } = {}) =>
  resolveRenewState({
    client,
    token,
    monthlyPrice: 2200,
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
  const copy = renewBlockCopy(UK, state.reason);
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
  for (const locale of Object.keys(LOCALES) as (keyof typeof LOCALES)[]) {
    const dead = renewDeadLinkCopy(translator(locale));
    assert.ok(dead.title.length > 0 && dead.body.length > 0 && dead.support.length > 0, locale);
    assert.ok((dead.action ?? '').length > 0, `${locale}: немає кнопки переходу до оплати`);
    // Порада веде в рядок під карткою, а не в неактивну при закритій реєстрації картку.
    assert.doesNotMatch(dead.body, /РАЗОВА/, locale);
  }
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

test('автоплатник, у якого списання не пройшло або підписка в GRACE, може доплатити модуль сам', async () => {
  // Дефект аудиту 24.09: Rule 2 («спочатку скасуйте автосписання») блокував і тих, у кого
  // автосписання вже зламалось — студент у GRACE не мав жодного шляху заплатити.
  const grace = await resolve(
    makeClient(subscription({ autoRenew: true, status: 'GRACE', failedChargeCount: 0 })),
    tokenFor(),
  );
  assert.equal(grace.kind, 'payable');
  if (grace.kind === 'payable') {
    assert.equal(grace.stopsAutopay, true);
    assert.equal(grace.module.number, 3);
  }

  const failed = await resolve(
    makeClient(subscription({ autoRenew: true, status: 'ACTIVE', failedChargeCount: 1 })),
    tokenFor(),
  );
  assert.equal(failed.kind === 'payable' && failed.stopsAutopay, true);
  assert.equal(failed.kind === 'payable' && failed.stopsAutopayReason, 'charge_failed');

  // Причина — з `autopayGraceReason`: «не пройшло» лише для відмови банку.
  const noRule = await resolve(
    makeClient(subscription({ autoRenew: true, status: 'GRACE', failedChargeCount: 0, wfpRegularRef: null })),
    tokenFor(),
  );
  assert.equal(noRule.kind === 'payable' && noRule.stopsAutopayReason, 'no_rule');
  const notCharged = await resolve(
    makeClient(subscription({ autoRenew: true, status: 'GRACE', failedChargeCount: 0, wfpRegularRef: 'ref_1' })),
    tokenFor(),
  );
  assert.equal(notCharged.kind === 'payable' && notCharged.stopsAutopayReason, 'not_charged');

  // Справне автосписання — як і раніше блок: модуль спишеться сам.
  const healthy = await resolve(
    makeClient(subscription({ autoRenew: true, status: 'ACTIVE', failedChargeCount: 0 })),
    tokenFor(),
  );
  assert.equal(healthy.kind === 'blocked' && healthy.reason, 'autopay');

  // Разова підписка в GRACE — звичайна доплата, автосписання вимикати нічого.
  const oneTime = await resolve(makeClient(subscription({ status: 'GRACE' })), tokenFor());
  assert.equal(oneTime.kind === 'payable' && oneTime.stopsAutopay, false);
  assert.equal(oneTime.kind === 'payable' && oneTime.stopsAutopayReason, null);
});

test('autopayAllowsManualTopUp — лише для зламаного автосписання', () => {
  assert.equal(autopayAllowsManualTopUp({ autoRenew: false, status: 'GRACE', failedChargeCount: 3 }), false);
  assert.equal(autopayAllowsManualTopUp({ autoRenew: true, status: 'ACTIVE', failedChargeCount: 0 }), false);
  assert.equal(autopayAllowsManualTopUp({ autoRenew: true, status: 'ACTIVE', failedChargeCount: null }), false);
  assert.equal(autopayAllowsManualTopUp({ autoRenew: true, status: 'ACTIVE', failedChargeCount: 2 }), true);
  assert.equal(autopayAllowsManualTopUp({ autoRenew: true, status: 'GRACE', failedChargeCount: 0 }), true);
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
  assert.match(renewBlockCopy(UK, state.reason, state.missedModules ?? 0).body, /пропущено 1 модуль\./);
  assert.match(renewBlockCopy(UK, 'debt', 3).body, /пропущено 3 модулі\./);
  assert.match(renewBlockCopy(UK, 'debt', 5).body, /пропущено 5 модулів\./);
  assert.match(renewBlockCopy(translator('en'), 'debt', 2).body, /2 modules were missed/);
  assert.match(renewBlockCopy(translator('pl'), 'debt', 2).body, /pominięto 2 moduły/);
});

test('закриті продажі НЕ чіпають доплату модуля чинним студентом', async () => {
  // Рішення власника 09.09.2026. `registrationOpen` вимикає нові продажі — картки
  // тарифів; доплата всередині свого живого набору продажем не є. Раніше стан ставав
  // `registration_closed`, і одразу після запуску набору (менеджер закриває реєстрацію)
  // студент місячної оплати не міг заплатити за наступний модуль увесь навчальний рік.
  //
  // Резолвер більше не має входу для цього прапорця взагалі — перевіряємо це типом:
  // зайве поле в аргументах не скомпілюється, а стан лишається payable.
  const state = await resolveRenewState({
    client: makeClient(subscription()),
    token: tokenFor(),
    monthlyPrice: 2200,
    now: NOW,
  });
  assert.equal(state.kind, 'payable');
  if (state.kind !== 'payable') return;
  assert.equal(state.module.number, 3);
  // Причини `registration_closed` не існує ні в стані, ні в реєстрі текстів.
  assert.ok(!RENEW_BLOCK_REASONS.includes('registration_closed' as never));
});

test('кожен стан блокування має заголовок, пояснення і контакт менеджера — у кожній локалі', () => {
  assert.ok(RENEW_BLOCK_REASONS.length >= 7, 'усі причини мають бути в реєстрі текстів');
  for (const locale of Object.keys(LOCALES) as (keyof typeof LOCALES)[]) {
    const t = translator(locale);
    for (const reason of RENEW_BLOCK_REASONS) {
      const copy = renewBlockCopy(t, reason, 2);
      // Відсутній ключ use-intl повертає як сам шлях («RenewPanel.blocks.x.title»).
      for (const [part, text] of Object.entries(copy)) {
        assert.ok(text && text.trim().length > 0, `${locale}/${reason}: порожнє ${part}`);
        assert.ok(!text.includes('RenewPanel.'), `${locale}/${reason}: немає перекладу ${part}`);
      }
    }
  }
});

test('текст «оплата вимикає автосписання» — для кожної причини, у кожній локалі, чесний щодо моменту', () => {
  assert.deepEqual([...RENEW_STOPS_AUTOPAY_REASONS].sort(), ['charge_failed', 'no_rule', 'not_charged']);
  // Правило у WFP знімається вже при відкритті оплати (downgrade у /api/wayforpay),
  // тож текст має казати «навіть якщо оплату не завершити», а не «після оплати».
  const whenMarker = { uk: 'навіть якщо оплату не завершити', en: 'even if you do not complete the payment', pl: 'nawet jeśli nie dokończysz płatności' };
  for (const locale of Object.keys(LOCALES) as (keyof typeof LOCALES)[]) {
    const t = translator(locale);
    const texts = RENEW_STOPS_AUTOPAY_REASONS.map((r) => renewStopsAutopayCopy(t, r));
    for (const [i, text] of texts.entries()) {
      const r = RENEW_STOPS_AUTOPAY_REASONS[i];
      assert.ok(!text.includes('RenewPanel.'), `${locale}/${r}: немає перекладу`);
      assert.ok(text.includes(whenMarker[locale]), `${locale}/${r}: має казати, що автосписання вимикається одразу`);
    }
    assert.equal(new Set(texts).size, texts.length, `${locale}: тексти причин мають відрізнятись`);
  }
});

test('простір RenewPanel однаковий у uk/en/pl — жодного ключа без перекладу', () => {
  const paths = (o: unknown, pre = ''): string[] =>
    Object.entries(o as Record<string, unknown>).flatMap(([k, v]) =>
      v && typeof v === 'object' ? paths(v, `${pre}${k}.`) : [`${pre}${k}`]).sort();
  const uk = paths(ukMessages.RenewPanel);
  assert.deepEqual(paths(enMessages.RenewPanel), uk);
  assert.deepEqual(paths(plMessages.RenewPanel), uk);
});
