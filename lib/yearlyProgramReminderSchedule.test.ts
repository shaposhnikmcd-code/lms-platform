/// Юніт-тести розкладу manual-нагадувань Річної і старту пільгового періоду.
/// Запуск: `npm run test:reminders` (або `npm test` разом з рештою).
///
/// Навіщо: це листи реальним студентам про гроші. Перевіряємо рівно те, що обіцяно Інституту:
/// лист «за 1 день» іде напередодні дня закінчення, за один прохід людина отримує не більше
/// одного листа з ланцюга «3 дні / 1 день / останній день», а при grace в 1 день лист
/// «пільговий період почався» разовій оплаті не йде ніколи.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  autopayGraceReason,
  dueManualReminders,
  graceStartDecision,
  manualBefore1dCutoff,
  manualStepAction,
  pickManualReminder,
} from './yearlyProgramReminderSchedule';

/// Набір 2026: модуль спливає 5-го 00:00 UTC (= 03:00 Київ). Прохід cron-а — 04:00 UTC (07:00 Київ).
const EXPIRES = new Date('2026-10-05T00:00:00Z');
const cronAt = (day: number) => new Date(`2026-10-${String(day).padStart(2, '0')}T04:00:00Z`);

test('розклад набору 2026: 3 дні — 2-го, 1 день — 4-го, останній день — 5-го', () => {
  assert.equal(pickManualReminder(EXPIRES, cronAt(1)), null);
  assert.equal(pickManualReminder(EXPIRES, cronAt(2)), 'before3d');
  assert.equal(pickManualReminder(EXPIRES, cronAt(3)), 'before3d');
  assert.equal(pickManualReminder(EXPIRES, cronAt(4)), 'before1d');
  assert.equal(pickManualReminder(EXPIRES, cronAt(5)), 'onExpiry');
});

test('вікно «за 1 день» — до початку київської доби післязавтра', () => {
  // 4-те 07:00 Київ → межа 6-те 00:00 Київ = 5-те 21:00 UTC (жовтень — ще літній час, UTC+3).
  assert.equal(manualBefore1dCutoff(cronAt(4)).toISOString(), '2026-10-05T21:00:00.000Z');
  // 3-тє: 5-те 00:00 UTC ще НЕ менше за 4-те 21:00 UTC — лист не дозрів.
  assert.deepEqual(dueManualReminders(EXPIRES, cronAt(3)), ['before3d']);
  assert.deepEqual(dueManualReminders(EXPIRES, cronAt(4)), ['before3d', 'before1d']);
});

test('без нижньої межі: пропущені проходи не з\'їдають лист', () => {
  // Cron не працював 2-го–4-го: 5-го дозріли всі три, іде лише «останній день».
  assert.deepEqual(dueManualReminders(EXPIRES, cronAt(5)), ['before3d', 'before1d', 'onExpiry']);
  assert.equal(pickManualReminder(EXPIRES, cronAt(5)), 'onExpiry');
});

test('один лист за прохід: нова підписка з expiresAt = завтра отримує лише «за 1 день»', () => {
  const now = new Date('2026-09-24T09:00:00Z');
  const tomorrow = new Date('2026-09-25T00:00:00Z');
  assert.equal(manualStepAction('before3d', tomorrow, now), 'supersede');
  assert.equal(manualStepAction('before1d', tomorrow, now), 'send');
  assert.equal(manualStepAction('onExpiry', tomorrow, now), 'skip');
  const sends = (['before3d', 'before1d', 'onExpiry'] as const)
    .filter((k) => manualStepAction(k, tomorrow, now) === 'send');
  assert.deepEqual(sends, ['before1d']);
});

test('один лист за прохід: у будь-який момент рівно один крок має «send» або жоден', () => {
  for (let h = 0; h < 24 * 8; h += 1) {
    const now = new Date(Date.UTC(2026, 8, 28, h));
    const sends = (['before3d', 'before1d', 'onExpiry'] as const)
      .filter((k) => manualStepAction(k, EXPIRES, now) === 'send');
    assert.ok(sends.length <= 1, `${now.toISOString()}: ${sends.join(',')}`);
    const picked = pickManualReminder(EXPIRES, now);
    assert.deepEqual(sends, picked ? [picked] : []);
  }
});

test('grace_start: разова оплата з grace 1 день — лист не шлеться ніколи', () => {
  const started = new Date('2026-10-05T04:00:00Z');
  assert.equal(graceStartDecision(1, started, started, true), 'suppress');
  assert.equal(graceStartDecision(1, started, new Date('2026-10-06T04:00:00Z'), true), 'suppress');
});

test('grace_start: автоплатіж із grace 1 день — лист «списання не пройшло» йде одразу', () => {
  const started = new Date('2026-10-05T04:00:00Z');
  assert.equal(graceStartDecision(1, started, started, false), 'send');
});

test('grace_start: 2 дні — одразу, ≥3 дні — наступним добовим проходом', () => {
  const started = new Date('2026-10-05T04:00:00Z');
  assert.equal(graceStartDecision(2, started, started, true), 'send');
  assert.equal(graceStartDecision(3, started, started, true), 'wait');
  assert.equal(graceStartDecision(7, started, new Date('2026-10-06T04:00:00Z'), true), 'send');
  assert.equal(graceStartDecision(7, null, started, true), 'send');
});

test('autopayGraceReason: причина листа автоплатника в GRACE', () => {
  // Відмова банку — найконкретніша причина, навіть якщо WFP після неї зняв правило.
  assert.equal(autopayGraceReason({ failedChargeCount: 1, wfpRegularRef: 'ref' }), 'charge_failed');
  assert.equal(autopayGraceReason({ failedChargeCount: 2, wfpRegularRef: null }), 'charge_failed');
  // Правила немає — спроби списання не було, «не пройшло» було б неправдою.
  assert.equal(autopayGraceReason({ failedChargeCount: 0, wfpRegularRef: null }), 'no_rule');
  assert.equal(autopayGraceReason({ failedChargeCount: null, wfpRegularRef: null }), 'no_rule');
  // Правило є, відмов не було, а оплати нема — графік зсунуто / WFP мовчить. Раніше
  // такий автоплатник не отримував жодного листа до закриття доступу.
  assert.equal(autopayGraceReason({ failedChargeCount: 0, wfpRegularRef: 'ref' }), 'not_charged');
});
