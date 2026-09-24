/// Юніт-тести маршрутизації кредів між ДВОМА мерчантами WayForPay.
/// Запуск: `npm run test:wfp` (або `npm test` разом з рештою).
///
/// Навіщо: з 30.09.2026 нові оплати йдуть на новий мерчант, а вже створені правила
/// автосписання Річної лишаються в кабінеті старого. Якщо callback старого мерчанта
/// перевірити секретом нового — підпис не зійдеться, гроші списані, а доступ не
/// продовжиться; якщо REMOVE/STATUS по старому правилу послати новими кредами — WFP
/// відповість «правила немає», і ми вирішимо, що автосписань більше нема (вони йтимуть).
/// Тому мерчант визначається даними (полем `merchantAccount`), а не поточним env.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';

const NEW_LOGIN = 'www_uimp_com_ua';
const NEW_SECRET = 'new-merchant-secret';
const NEW_PASSWORD = 'new-merchant-password';
const OLD_LOGIN = 'freelance_user_6682b2f59c38a';
const OLD_SECRET = 'old-merchant-secret';
const OLD_PASSWORD = 'old-merchant-password';

// Тест-режим WFP перекриває резолвер (усе підписується тестовим секретом) — на прогоні
// тестів його бути не має, інакше перевіряли б не ту гілку.
delete process.env.WAYFORPAY_TEST_MODE;

import {
  callbackSignatureString,
  getLegacyWayforpayCreds,
  getWayforpayCreds,
  resolveRegularApiCreds,
  resolveWayforpayMerchant,
  verifyCallbackSignature,
} from './wayforpay';

/// Env читається на кожному виклику, тож достатньо переставити змінні перед сценарієм.
function setEnv(opts: { legacy: boolean }) {
  process.env.WAYFORPAY_MERCHANT_LOGIN = NEW_LOGIN;
  process.env.WAYFORPAY_SECRET_KEY = NEW_SECRET;
  process.env.WAYFORPAY_MERCHANT_PASSWORD = NEW_PASSWORD;
  if (opts.legacy) {
    process.env.WAYFORPAY_LEGACY_MERCHANT_LOGIN = OLD_LOGIN;
    process.env.WAYFORPAY_LEGACY_SECRET_KEY = OLD_SECRET;
    process.env.WAYFORPAY_LEGACY_MERCHANT_PASSWORD = OLD_PASSWORD;
  } else {
    delete process.env.WAYFORPAY_LEGACY_MERCHANT_LOGIN;
    delete process.env.WAYFORPAY_LEGACY_SECRET_KEY;
    delete process.env.WAYFORPAY_LEGACY_MERCHANT_PASSWORD;
  }
}

/// Тіло callback-у, підписане секретом заданого мерчанта — як його шле WayForPay.
function signedCallback(merchantAccount: string, secretKey: string): Record<string, unknown> {
  const body: Record<string, unknown> = {
    merchantAccount,
    orderReference: 'yearly-program-monthly_1758700000_WFPREG-3',
    amount: 2200,
    currency: 'UAH',
    authCode: '123456',
    cardPan: '44**44',
    transactionStatus: 'Approved',
    reasonCode: 1100,
  };
  body.merchantSignature = crypto
    .createHmac('md5', secretKey)
    .update(callbackSignatureString(body))
    .digest('hex');
  return body;
}

test('callback нового мерчанта: підпис перевіряється новим секретом', () => {
  setEnv({ legacy: true });
  const body = signedCallback(NEW_LOGIN, NEW_SECRET);
  const merchant = resolveWayforpayMerchant(body.merchantAccount as string);
  assert.equal(merchant?.merchantAccount, NEW_LOGIN);
  assert.equal(merchant?.isLegacy, false);
  assert.equal(verifyCallbackSignature(body, merchant), true);
});

test('callback СТАРОГО мерчанта (рекурентне списання Річної) зараховується старим секретом', () => {
  setEnv({ legacy: true });
  const body = signedCallback(OLD_LOGIN, OLD_SECRET);
  const merchant = resolveWayforpayMerchant(body.merchantAccount as string);
  assert.equal(merchant?.merchantAccount, OLD_LOGIN, 'мерчант береться з тіла callback-у, не з env');
  assert.equal(merchant?.isLegacy, true);
  assert.equal(verifyCallbackSignature(body, merchant), true);
});

test('перехресна перевірка: підпис старого мерчанта НЕ проходить секретом нового', () => {
  setEnv({ legacy: true });
  const body = signedCallback(OLD_LOGIN, OLD_SECRET);
  const wrongMerchant = getWayforpayCreds();
  assert.equal(
    verifyCallbackSignature(body, wrongMerchant),
    false,
    'саме заради цього мерчант визначається даними, а не env',
  );
});

test('невідомий merchantAccount — відмова, а не фолбек на основні креди', () => {
  setEnv({ legacy: true });
  const body = signedCallback('someone_elses_merchant', 'whatever-secret');
  const merchant = resolveWayforpayMerchant(body.merchantAccount as string);
  assert.equal(merchant, null);
  assert.equal(verifyCallbackSignature(body, merchant), false);
});

test('regularApi: креди беруться за мерчантом підписки/платежу', () => {
  setEnv({ legacy: true });

  const legacySub = resolveRegularApiCreds(OLD_LOGIN);
  assert.equal(legacySub.ok, true);
  assert.equal(legacySub.ok && legacySub.merchantAccount, OLD_LOGIN);
  assert.equal(legacySub.ok && legacySub.merchantPassword, OLD_PASSWORD);
  assert.equal(legacySub.ok && legacySub.isLegacy, true);

  const freshSub = resolveRegularApiCreds(NEW_LOGIN);
  assert.equal(freshSub.ok && freshSub.merchantAccount, NEW_LOGIN);
  assert.equal(freshSub.ok && freshSub.merchantPassword, NEW_PASSWORD);

  // Порожнє поле = основний мерчант: наявні записи бекфілені міграцією логіном старого,
  // тож null може означати лише рядок, створений уже після переходу.
  const noMerchant = resolveRegularApiCreds(null);
  assert.equal(noMerchant.ok && noMerchant.merchantAccount, NEW_LOGIN);
});

test('regularApi: пароль потрібного мерчанта відсутній — відмова з назвою саме його змінної', () => {
  setEnv({ legacy: true });
  delete process.env.WAYFORPAY_LEGACY_MERCHANT_PASSWORD;
  const res = resolveRegularApiCreds(OLD_LOGIN);
  assert.equal(res.ok, false);
  assert.equal(!res.ok && res.error, 'WAYFORPAY_LEGACY_MERCHANT_PASSWORD не налаштовано');

  // Основний мерчант при цьому працює — одна відсутня змінна не глушить другий кабінет.
  assert.equal(resolveRegularApiCreds(NEW_LOGIN).ok, true);
});

test('без legacy-env — поведінка як до двох мерчантів', () => {
  setEnv({ legacy: false });
  assert.equal(getLegacyWayforpayCreds(), null);

  // Єдиний відомий мерчант — основний: і за логіном, і за порожнім полем.
  assert.equal(resolveWayforpayMerchant(NEW_LOGIN)?.secretKey, NEW_SECRET);
  assert.equal(resolveWayforpayMerchant(null)?.secretKey, NEW_SECRET);
  assert.equal(resolveWayforpayMerchant(undefined)?.secretKey, NEW_SECRET);

  // Його callback перевіряється рівно як раніше…
  const own = signedCallback(NEW_LOGIN, NEW_SECRET);
  assert.equal(verifyCallbackSignature(own, resolveWayforpayMerchant(own.merchantAccount as string)), true);

  // …а чужий відхиляється, як і раніше відхилявся по неспівпадінню підпису.
  const foreign = signedCallback(OLD_LOGIN, OLD_SECRET);
  assert.equal(resolveWayforpayMerchant(foreign.merchantAccount as string), null);
  assert.equal(verifyCallbackSignature(foreign, resolveWayforpayMerchant(OLD_LOGIN)), false);

  const regular = resolveRegularApiCreds(null);
  assert.equal(regular.ok && regular.merchantAccount, NEW_LOGIN);
  assert.equal(regular.ok && regular.merchantPassword, NEW_PASSWORD);

  // Текст помилки без пароля — той самий, що був до двох мерчантів (на нього
  // зав'язані підказки у вкладці «Помилки» адмінки).
  delete process.env.WAYFORPAY_MERCHANT_PASSWORD;
  const noPassword = resolveRegularApiCreds(null);
  assert.equal(noPassword.ok, false);
  assert.equal(!noPassword.ok && noPassword.error, 'WAYFORPAY_MERCHANT_PASSWORD не налаштовано');
});

test('legacy-мерчант без секрета не вважається налаштованим', () => {
  setEnv({ legacy: true });
  delete process.env.WAYFORPAY_LEGACY_SECRET_KEY;
  // Самого логіна замало: перевіряти підпис його callback-ів нічим, тож мерчант
  // лишається невідомим — відмова замість «відомий, але без ключа».
  assert.equal(getLegacyWayforpayCreds(), null);
  assert.equal(resolveWayforpayMerchant(OLD_LOGIN), null);
});
