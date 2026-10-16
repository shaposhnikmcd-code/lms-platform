/// Юніт-тести вибору акаунта-платника серед дублів пошти (різний регістр).
/// Запуск: `npm run test:payuser` (або `npm test` разом з рештою).
///
/// Випадок з прода: `olena@…` (лише ARCHIVED) і `Olena@…` (MONTHLY EXPIRED, на неї
/// видане персональне посилання) — оплата за посиланням має йти на другий акаунт.
import test from 'node:test';
import assert from 'node:assert/strict';

import { pickPaymentUser, type PaymentUserCandidate } from './paymentUserPick';

const lower: PaymentUserCandidate = { id: 'cmrvxjlbn', createdAt: new Date('2026-05-01'), yearlyStatuses: ['ARCHIVED', 'ARCHIVED'] };
const upper: PaymentUserCandidate = { id: 'cmsoi8qh', createdAt: new Date('2026-04-01'), yearlyStatuses: ['EXPIRED'] };

test('renew-токен: платник — власник підписки з посилання, незалежно від порядку', () => {
  assert.equal(pickPaymentUser([lower, upper], 'cmsoi8qh')?.id, 'cmsoi8qh');
  assert.equal(pickPaymentUser([upper, lower], 'cmsoi8qh')?.id, 'cmsoi8qh');
  assert.equal(pickPaymentUser([upper, lower], 'cmrvxjlbn')?.id, 'cmrvxjlbn');
});

test('renew-токен на акаунт, якого серед кандидатів нема — звичайні правила', () => {
  assert.equal(pickPaymentUser([lower, upper], 'other')?.id, 'cmsoi8qh');
});

test('без токена: не архівна Річна переважає новіший акаунт з архівом', () => {
  assert.equal(pickPaymentUser([lower, upper])?.id, 'cmsoi8qh');
  assert.equal(pickPaymentUser([upper, lower])?.id, 'cmsoi8qh');
});

test('без токена: жива підписка переважає мертву', () => {
  const live: PaymentUserCandidate = { id: 'live', createdAt: new Date('2025-01-01'), yearlyStatuses: ['GRACE'] };
  assert.equal(pickPaymentUser([upper, live])?.id, 'live');
  assert.equal(pickPaymentUser([live, upper])?.id, 'live');
});

test('без Річної взагалі: найновіший акаунт, при рівності дат — детерміновано за id', () => {
  const a: PaymentUserCandidate = { id: 'a', createdAt: new Date('2026-01-01'), yearlyStatuses: [] };
  const b: PaymentUserCandidate = { id: 'b', createdAt: new Date('2026-02-01'), yearlyStatuses: [] };
  assert.equal(pickPaymentUser([a, b])?.id, 'b');
  assert.equal(pickPaymentUser([b, a])?.id, 'b');
  const c: PaymentUserCandidate = { id: 'c', createdAt: new Date('2026-02-01'), yearlyStatuses: [] };
  assert.equal(pickPaymentUser([b, c])?.id, pickPaymentUser([c, b])?.id);
});

test('єдиний акаунт — завжди він; порожньо — null', () => {
  assert.equal(pickPaymentUser([lower])?.id, 'cmrvxjlbn');
  assert.equal(pickPaymentUser([lower], 'zzz')?.id, 'cmrvxjlbn');
  assert.equal(pickPaymentUser([]), null);
});
