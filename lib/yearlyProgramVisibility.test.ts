/// Юніт-тести предиката видимості підписок Річної програми.
/// Запуск: `npm run test:visibility`.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeYearlyPhone,
  normalizeYearlyTelegram,
  buildLiveIdentityIndex,
  matchesLiveIdentity,
  isOrphanPendingDuplicate,
  isVisibleYearlySubscription,
  isYearlyLiveStatus,
  type YearlyVisibilitySubscription,
} from './yearlyProgramVisibility';

const sub = (over: Partial<YearlyVisibilitySubscription> = {}): YearlyVisibilitySubscription => ({
  userId: 'u1',
  status: 'PENDING',
  phone: null,
  telegramUsername: null,
  manuallyAddedAt: null,
  hasPaidPayment: false,
  ...over,
});

test('normalizeYearlyPhone: різні формати того самого номера дають однаковий ключ', () => {
  const expected = '380671234567';
  assert.equal(normalizeYearlyPhone('+380671234567'), expected);
  assert.equal(normalizeYearlyPhone('380 67 123 45 67'), expected);
  assert.equal(normalizeYearlyPhone('+38 (067) 123-45-67'), expected);
});

test('normalizeYearlyPhone: порожнє / закоротке / без цифр → null', () => {
  assert.equal(normalizeYearlyPhone(null), null);
  assert.equal(normalizeYearlyPhone(undefined), null);
  assert.equal(normalizeYearlyPhone(''), null);
  assert.equal(normalizeYearlyPhone('   '), null);
  assert.equal(normalizeYearlyPhone('123456'), null); // 6 цифр — менше порога
  assert.equal(normalizeYearlyPhone('1234567'), '1234567'); // рівно 7 — проходить
  assert.equal(normalizeYearlyPhone('телефон'), null);
});

test('normalizeYearlyTelegram: трим, нижній регістр, зрізаний @', () => {
  assert.equal(normalizeYearlyTelegram('@Ivan_Petrov'), 'ivan_petrov');
  assert.equal(normalizeYearlyTelegram('  IVAN_petrov '), 'ivan_petrov');
  assert.equal(normalizeYearlyTelegram('@@ivan_petrov'), 'ivan_petrov');
  assert.equal(normalizeYearlyTelegram(null), null);
  assert.equal(normalizeYearlyTelegram('@'), null);
  assert.equal(normalizeYearlyTelegram('   '), null);
});

test('isYearlyLiveStatus: живі — тільки ACTIVE і GRACE', () => {
  assert.equal(isYearlyLiveStatus('ACTIVE'), true);
  assert.equal(isYearlyLiveStatus('GRACE'), true);
  for (const st of ['PENDING', 'EXPIRED', 'CANCELLED', 'ARCHIVED']) {
    assert.equal(isYearlyLiveStatus(st), false, st);
  }
});

test('buildLiveIdentityIndex: бере ідентичності лише з ACTIVE/GRACE', () => {
  const index = buildLiveIdentityIndex([
    sub({ userId: 'live-a', status: 'ACTIVE', phone: '+380671234567', telegramUsername: '@Live' }),
    sub({ userId: 'live-g', status: 'GRACE', phone: '380509999999', telegramUsername: 'grace_user' }),
    sub({ userId: 'dead', status: 'EXPIRED', phone: '380500000000', telegramUsername: 'dead_user' }),
    sub({ userId: 'pend', status: 'PENDING', phone: '380501111111', telegramUsername: 'pending_user' }),
  ]);
  assert.deepEqual([...index.userIds].sort(), ['live-a', 'live-g']);
  assert.deepEqual([...index.phones].sort(), ['380509999999', '380671234567']);
  assert.deepEqual([...index.telegrams].sort(), ['grace_user', 'live']);
});

test('buildLiveIdentityIndex: сміттєві телефон/нік не потрапляють в індекс', () => {
  const index = buildLiveIdentityIndex([
    sub({ userId: 'live', status: 'ACTIVE', phone: '12345', telegramUsername: '  ' }),
  ]);
  assert.equal(index.userIds.size, 1);
  assert.equal(index.phones.size, 0);
  assert.equal(index.telegrams.size, 0);
});

test('matchesLiveIdentity: збіг по userId / телефону / Telegram, інакше false', () => {
  const index = buildLiveIdentityIndex([
    sub({ userId: 'live', status: 'ACTIVE', phone: '+380671234567', telegramUsername: '@Live' }),
  ]);
  assert.equal(matchesLiveIdentity(sub({ userId: 'live' }), index), true);
  assert.equal(matchesLiveIdentity(sub({ userId: 'other', phone: '38 067 123 45 67' }), index), true);
  assert.equal(matchesLiveIdentity(sub({ userId: 'other', telegramUsername: 'LIVE' }), index), true);
  assert.equal(matchesLiveIdentity(sub({ userId: 'other', phone: '380500000000', telegramUsername: 'nobody' }), index), false);
  assert.equal(matchesLiveIdentity(sub({ userId: 'other' }), index), false);
});

test('isOrphanPendingDuplicate: дубль по іншому акаунту, але тому самому телефону — ховаємо', () => {
  const index = buildLiveIdentityIndex([
    sub({ userId: 'paid-account', status: 'ACTIVE', phone: '+380671234567', telegramUsername: '@Ivan' }),
  ]);
  const orphan = sub({ userId: 'typo-account', phone: '380671234567' });
  assert.equal(isOrphanPendingDuplicate(orphan, index), true);
  assert.equal(isVisibleYearlySubscription(orphan, index), false);
});

test('isOrphanPendingDuplicate: самотній PENDING (лід) — видимий', () => {
  const index = buildLiveIdentityIndex([
    sub({ userId: 'someone-else', status: 'ACTIVE', phone: '380509999999' }),
  ]);
  const lead = sub({ userId: 'lead', phone: '380671234567', telegramUsername: 'lead_tg' });
  assert.equal(isOrphanPendingDuplicate(lead, index), false);
  assert.equal(isVisibleYearlySubscription(lead, index), true);
});

test('isOrphanPendingDuplicate: PENDING з PAID-платежем не ховаємо (аномалія має бути видною)', () => {
  const index = buildLiveIdentityIndex([sub({ userId: 'u1', status: 'ACTIVE' })]);
  assert.equal(isOrphanPendingDuplicate(sub({ userId: 'u1', hasPaidPayment: true }), index), false);
});

test('isOrphanPendingDuplicate: ручно доданий менеджером PENDING ніколи не дубль', () => {
  const index = buildLiveIdentityIndex([
    sub({ userId: 'u1', status: 'ACTIVE', phone: '380671234567' }),
  ]);
  const manual = sub({ userId: 'u1', phone: '380671234567', manuallyAddedAt: new Date('2026-07-01') });
  assert.equal(isOrphanPendingDuplicate(manual, index), false);
  assert.equal(isVisibleYearlySubscription(manual, index), true);
});

test('isOrphanPendingDuplicate: не-PENDING статуси завжди видимі', () => {
  const index = buildLiveIdentityIndex([
    sub({ userId: 'u1', status: 'ACTIVE', phone: '380671234567' }),
  ]);
  for (const st of ['ACTIVE', 'GRACE', 'EXPIRED', 'CANCELLED', 'ARCHIVED']) {
    const s = sub({ userId: 'u1', status: st, phone: '380671234567' });
    assert.equal(isOrphanPendingDuplicate(s, index), false, st);
    assert.equal(isVisibleYearlySubscription(s, index), true, st);
  }
});

test('isOrphanPendingDuplicate: збіг лише по Telegram (телефон не вказано) — теж дубль', () => {
  const index = buildLiveIdentityIndex([
    sub({ userId: 'paid', status: 'ACTIVE', telegramUsername: '@Ivan_Petrov' }),
  ]);
  assert.equal(
    isOrphanPendingDuplicate(sub({ userId: 'typo', telegramUsername: 'ivan_petrov' }), index),
    true,
  );
});

test('порожній індекс: жоден PENDING не ховається', () => {
  const index = buildLiveIdentityIndex([]);
  assert.equal(isOrphanPendingDuplicate(sub({ phone: '380671234567' }), index), false);
});
