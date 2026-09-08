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

test('URL веде на route handler, а не на сторінку — токена в query бути не має', () => {
  const url = buildRenewUrl('https://www.uimp.com.ua/', 'a.b+c');
  assert.equal(url, 'https://www.uimp.com.ua/yearly-program/renew/a.b%2Bc');
  assert.ok(!url.includes('?'), 'токен у query потрапляв би в GA page_view і в ключ ISR-кешу');
});

test('не-дефолтна локаль отримує свій префікс', () => {
  assert.equal(
    buildRenewUrl('https://www.uimp.com.ua', 'tok', 'pl'),
    'https://www.uimp.com.ua/pl/yearly-program/renew/tok',
  );
});

test('issueRenewLink віддає узгоджені токен, URL і дату протермінування', () => {
  const { token, url, expiresAt } = issueRenewLink({ ...SUB, origin: 'http://localhost:3000' });
  assert.equal(url, `http://localhost:3000/yearly-program/renew/${encodeURIComponent(token)}`);
  const payload = verifyRenewToken(token)!;
  assert.ok(Math.abs(expiresAt.getTime() - payload.exp * 1000) < 1000);
});

/// Сторож сумісності. Токен нижче підписаний КОДОМ ДО рефакторингу на `lib/signedToken.ts`
/// (`git show 46ea343:lib/yearlyProgramInvite.ts`) тим самим тестовим секретом, що вгорі
/// файлу. `exp` навмисно зсунутий у 2099 рік — інакше фікстура протухла б за 7 днів і
/// тест почав би падати сам по собі, без жодної зміни в коді.
///
/// Якщо цей тест впав — щось у форматі підпису (base64url, порядок полів, алгоритм HMAC)
/// змінилось, і всі invite-посилання, які менеджери вже роздали студентам, мертві.
const LEGACY_INVITE_TOKEN =
  'eyJlbWFpbCI6ImxlZ2FjeUBleGFtcGxlLmNvbSIsImNvaG9ydElkIjoiY29ob3J0X2xlZ2FjeSIsImludml0ZWRCeSI6Im1hbmFnZXJAdWltcC5jb20udWEiLCJleHAiOjQwNzE1MTM2MDAsIm5vbmNlIjoiNjIwOTcyYzk5MzNjZDE3ZSJ9'
  + '.Zg1X20PAlJ4UcIlimnzNRTNK0EuU27snExSW4VY7BnU';

test('invite-токен, підписаний ДО рефакторингу, досі приймається', () => {
  const payload = verifyInvite(LEGACY_INVITE_TOKEN);
  assert.ok(payload, 'старий формат підпису має лишатись сумісним');
  assert.equal(payload.email, 'legacy@example.com');
  assert.equal(payload.cohortId, 'cohort_legacy');
  assert.equal(payload.invitedBy, 'manager@uimp.com.ua');
});

test('старий invite-токен НЕ проходить як renew — гард по purpose не залежить від віку токена', () => {
  assert.equal(verifyRenewToken(LEGACY_INVITE_TOKEN), null);
});
