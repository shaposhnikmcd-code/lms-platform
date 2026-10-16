/// Юніт-тести вибору SP-дії при закритті/відкритті доступу до Річної.
/// Запуск: `npm run test:spaccess` (або `npm test` разом з рештою).
///
/// Навіщо: видалення з курсу SendPulse стирає домашні. Закриття мають іти подією
/// `yearly-program-close`, а повернення закритого подією — `yearly-program-reopen`.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  decideSendpulseAccessAction,
  sendpulseCourseStateFromEvents,
  SP_CLOSE_METHOD_EVENT,
  type SpJournalEvent,
} from './yearlySendpulseAccess';

const t0 = new Date('2026-10-01T04:00:00Z').getTime();
const at = (h: number) => new Date(t0 + h * 3600_000);

const opened = (h: number): SpJournalEvent => ({ type: 'access_opened', metadata: { cohortId: 'c' }, createdAt: at(h) });
const closedByEvent = (h: number): SpJournalEvent => ({
  type: 'access_closed',
  metadata: { spClosed: true, spCloseMethod: SP_CLOSE_METHOD_EVENT },
  createdAt: at(h),
});
const closedLegacyDelete = (h: number): SpJournalEvent => ({ type: 'access_closed', metadata: { spClosed: true }, createdAt: at(h) });
const archived = (h: number): SpJournalEvent => ({ type: 'admin_action', metadata: { sendpulseClosed: true }, createdAt: at(h) });

test('cron GRACE→EXPIRED закриває подією, не DELETE', () => {
  assert.equal(decideSendpulseAccessAction('cron_expire'), 'close_event');
});

test('«Закрити доступ» закриває подією', () => {
  assert.equal(decideSendpulseAccessAction('close_access', 'open'), 'close_event');
});

test('«Видалити» і повний рефанд — свідомий DELETE', () => {
  assert.equal(decideSendpulseAccessAction('delete', 'closed_by_event'), 'delete');
  assert.equal(decideSendpulseAccessAction('full_refund', 'open'), 'delete');
});

test('відкриття після закриття подією → reopen-подія', () => {
  const state = sendpulseCourseStateFromEvents([opened(0), closedByEvent(10)]);
  assert.equal(state, 'closed_by_event');
  assert.equal(decideSendpulseAccessAction('open', state), 'reopen_event');
});

test('перша реєстрація (журнал порожній) → open-подія', () => {
  const state = sendpulseCourseStateFromEvents([]);
  assert.equal(state, 'none');
  assert.equal(decideSendpulseAccessAction('open', state), 'open_event');
});

test('закрито подією, а потім видалено («Видалити») → повторна реєстрація', () => {
  const state = sendpulseCourseStateFromEvents([closedByEvent(1), archived(2)]);
  assert.equal(state, 'removed');
  assert.equal(decideSendpulseAccessAction('open', state), 'open_event');
});

test('старе закриття без мітки = DELETE → повторна реєстрація', () => {
  assert.equal(sendpulseCourseStateFromEvents([opened(0), closedLegacyDelete(5)]), 'removed');
});

test('повний рефанд після закриття подією → видалений', () => {
  const refund: SpJournalEvent = { type: 'refunded', metadata: { subscriptionClosed: true }, createdAt: at(3) };
  assert.equal(sendpulseCourseStateFromEvents([closedByEvent(1), refund]), 'removed');
});

test('локальний EXPIRED без виклику SP не перебиває попередній стан', () => {
  const local: SpJournalEvent = { type: 'access_closed', metadata: { spClosed: false }, createdAt: at(9) };
  assert.equal(sendpulseCourseStateFromEvents([closedByEvent(1), local]), 'closed_by_event');
  assert.equal(sendpulseCourseStateFromEvents([opened(1), local]), 'open');
});

test('закрито подією, потім знову відкрито → стан open; порядок масиву не важливий', () => {
  const reopened: SpJournalEvent = { type: 'reactivated', metadata: {}, createdAt: at(20) };
  assert.equal(sendpulseCourseStateFromEvents([reopened, closedByEvent(10), opened(0)]), 'open');
});
