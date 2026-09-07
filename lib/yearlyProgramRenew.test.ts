/// Юніт-тести токена поновлення («Оплатити наступний модуль»).
/// Запуск: `npm run test:renew` (або `npm test` разом з рештою).
///
/// Навіщо: цим токеном студент заходить на оплату 2200 ₴ з підставленими даними чужої
/// (у разі підробки) підписки. Перевіряємо рівно те, на чому тримається безпека:
/// підпис не підробити, прострочений не приймається, email у payload незмінний,
/// і — головне — invite і renew НЕ взаємозамінні (invite має більші повноваження:
/// обходить `registrationOpen` і ставить `manuallyAddedAt`).
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NEXTAUTH_SECRET ??= 'test-secret-for-renew-token-unit-tests';

import { signInvite, verifyInvite } from './yearlyProgramInvite';
import {
  RENEW_TOKEN_TTL_DAYS,
  buildRenewUrl,
  issueRenewLink,
  signRenewToken,
  verifyRenewToken,
} from './yearlyProgramRenew';

const SUB = { subscriptionId: 'sub_123', email: 'student@example.com', cohortId: 'cohort_2026' };

test('підписаний токен читається назад без втрат', () => {
  const payload = verifyRenewToken(signRenewToken(SUB));
  assert.ok(payload, 'валідний токен має верифікуватись');
  assert.equal(payload.purpose, 'renew');
  assert.equal(payload.subscriptionId, 'sub_123');
  assert.equal(payload.email, 'student@example.com');
  assert.equal(payload.cohortId, 'cohort_2026');
});

test('email нормалізується при підписі — регістр не створює другу «особу»', () => {
  const payload = verifyRenewToken(signRenewToken({ ...SUB, email: '  Student@Example.COM ' }));
  assert.equal(payload?.email, 'student@example.com');
});

test('термін дії — рівно RENEW_TOKEN_TTL_DAYS діб', () => {
  const payload = verifyRenewToken(signRenewToken(SUB))!;
  const days = (payload.exp * 1000 - Date.now()) / (24 * 60 * 60 * 1000);
  assert.ok(Math.abs(days - RENEW_TOKEN_TTL_DAYS) < 0.01, `TTL ${days} ≠ ${RENEW_TOKEN_TTL_DAYS}`);
});

test('прострочений токен не приймається', () => {
  const token = signRenewToken(SUB);
  const [data, sig] = token.split('.');
  const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
  payload.exp = Math.floor(Date.now() / 1000) - 60;
  // Підпис лишається від СТАРОГО payload-у — імітуємо і протермінування, і підміну.
  const expired = `${Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')}.${sig}`;
  assert.equal(verifyRenewToken(expired), null);
});

test('підміна email у payload ламає підпис', () => {
  const token = signRenewToken(SUB);
  const [data, sig] = token.split('.');
  const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
  payload.email = 'attacker@example.com';
  const forged = `${Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')}.${sig}`;
  assert.equal(verifyRenewToken(forged), null);
});

test('підміна subscriptionId ламає підпис', () => {
  const token = signRenewToken(SUB);
  const [data, sig] = token.split('.');
  const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
  payload.subscriptionId = 'sub_someone_else';
  const forged = `${Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')}.${sig}`;
  assert.equal(verifyRenewToken(forged), null);
});

test('сміття замість токена не падає, а повертає null', () => {
  for (const junk of ['', 'abc', 'a.b', '....', 'null']) {
    assert.equal(verifyRenewToken(junk), null, `«${junk}» мав дати null`);
  }
});

test('invite-токен НЕ проходить як renew', () => {
  const invite = signInvite({ email: SUB.email, cohortId: SUB.cohortId, invitedBy: 'manager@uimp.com.ua' });
  assert.ok(verifyInvite(invite), 'invite має лишатись валідним як invite');
  assert.equal(verifyRenewToken(invite), null, 'invite не має відкривати renew-флоу');
});

test('renew-токен НЕ проходить як invite — інакше це обхід registrationOpen і manuallyAdded', () => {
  const renew = signRenewToken(SUB);
  assert.ok(verifyRenewToken(renew), 'renew має лишатись валідним як renew');
  assert.equal(verifyInvite(renew), null, 'renew не має відкривати invite-флоу');
});

test('URL збирається без подвійного слеша і з екрануванням токена', () => {
  const url = buildRenewUrl('https://www.uimp.com.ua/', 'a.b+c');
  assert.equal(url, 'https://www.uimp.com.ua/yearly-program?renew=a.b%2Bc#renew');
});

test('issueRenewLink віддає узгоджені токен, URL і дату протермінування', () => {
  const { token, url, expiresAt } = issueRenewLink({ ...SUB, origin: 'http://localhost:3000' });
  assert.ok(url.startsWith('http://localhost:3000/yearly-program?renew='));
  assert.ok(url.endsWith('#renew'), 'посилання має вести в якір блоку поновлення');
  assert.ok(url.includes(encodeURIComponent(token)));
  const payload = verifyRenewToken(token)!;
  assert.ok(Math.abs(expiresAt.getTime() - payload.exp * 1000) < 1000);
});
