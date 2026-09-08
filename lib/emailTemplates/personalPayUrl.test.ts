/// Юніт-тести персоналізації CTA-кнопки в листах-нагадуваннях.
/// Запуск: `npm run test:payurl` (або `npm test` разом з рештою).
///
/// Навіщо: це єдина кнопка, через яку студент на місячній оплаті потрапляє на оплату
/// наступного модуля. Зламана — і людина або йде шукати картку «Місячна» вручну (там
/// губиться більшість оплат), або впирається у биту адресу.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PROGRAM_URL, withPersonalPayUrl } from './personalPayUrl';

/// Персональне посилання починається з того ж домену, що й лендінг — саме через це
/// наївна заміна «по всьому тексту» різала його ще раз.
const PERSONAL = `${PROGRAM_URL}/renew/eyJhIjoxfQ.SIGNATURE`;

const DEFAULT_TEMPLATE = `<p>Вітаю!</p><a href="{payUrl}">Оплатити модуль</a>`;
const DEFAULT_RENDERED = `<p>Вітаю!</p><a href="${PERSONAL}">Оплатити модуль</a>`;

const LEGACY_TEMPLATE = `<p>Вітаю, {name}!</p><a href="${PROGRAM_URL}">Оплатити</a>`;
const LEGACY_RENDERED = `<p>Вітаю, Іван!</p><a href="${PROGRAM_URL}">Оплатити</a>`;

test('дефолтний шаблон із {payUrl}: підставлене посилання лишається недоторканим', () => {
  const html = withPersonalPayUrl(DEFAULT_RENDERED, DEFAULT_TEMPLATE, PERSONAL);
  assert.equal(html, DEFAULT_RENDERED);
  assert.equal(html.split('/renew/').length - 1, 1, 'посилання не має задвоюватись');
});

test('DB-override зі старим HTML: літерал лендінга стає персональним посиланням', () => {
  const html = withPersonalPayUrl(LEGACY_RENDERED, LEGACY_TEMPLATE, PERSONAL);
  assert.equal(html, `<p>Вітаю, Іван!</p><a href="${PERSONAL}">Оплатити</a>`);
});

test('згадка лендінга в тексті листа (не в href) не підміняється', () => {
  const tpl = `<p>Деталі — на сторінці ${PROGRAM_URL}</p><a href="${PROGRAM_URL}">Оплатити</a>`;
  const html = withPersonalPayUrl(tpl, tpl, PERSONAL);
  assert.ok(html.includes(`на сторінці ${PROGRAM_URL}</p>`), 'текстова згадка має лишитись');
  assert.ok(html.includes(`href="${PERSONAL}"`), 'а кнопка — стати персональною');
});

test('без персонального посилання шаблон не змінюється', () => {
  assert.equal(withPersonalPayUrl(LEGACY_RENDERED, LEGACY_TEMPLATE, null), LEGACY_RENDERED);
  assert.equal(withPersonalPayUrl(LEGACY_RENDERED, LEGACY_TEMPLATE, ''), LEGACY_RENDERED);
  assert.equal(withPersonalPayUrl(LEGACY_RENDERED, LEGACY_TEMPLATE, PROGRAM_URL), LEGACY_RENDERED);
});

test('кілька легасі-кнопок в одному листі замінюються всі', () => {
  const tpl = `<a href="${PROGRAM_URL}">Раз</a><a href="${PROGRAM_URL}">Два</a>`;
  const html = withPersonalPayUrl(tpl, tpl, PERSONAL);
  assert.equal(html.split(`href="${PERSONAL}"`).length - 1, 2);
});
