/// Юніт-тести чистих детекторів issue-трекера Річної програми.
/// Запуск: `npm run test:issues` (або `npm test` разом з рештою).
///
/// Навіщо: прод-аудит 09.09 знайшов 34 TG_INVITE_FAILED, з яких 31 студент уже реально
/// в каналі (`telegramJoinedAt` заповнений) — issue висів через те, що детектор дивився
/// лише на непорожній `telegramInviteError`, ігноруючи факт приєднання. Ці тести
/// стережуть саме цю умову і сусідній детектор TG_USERNAME_MISSING, щоб регресія не
/// повторилась мовчки.
import test from 'node:test';
import assert from 'node:assert/strict';
import { stateBasedIssues, shouldFlagUsernameMissing, type RawSubscription } from './yearlyProgramIssues';

function makeSub(overrides: Partial<RawSubscription> = {}): RawSubscription {
  return {
    id: 'sub_1',
    plan: 'YEARLY',
    status: 'ACTIVE',
    createdAt: new Date('2026-08-01T00:00:00Z'),
    updatedAt: new Date('2026-08-01T00:00:00Z'),
    telegramInviteError: null,
    telegramUsername: null,
    telegramJoinedAt: null,
    lastChargeError: null,
    failedChargeCount: 0,
    lastChargeAttemptAt: null,
    manuallyAddedAt: null,
    sendpulseAccessOpenedAt: null,
    reminderSent3d: false,
    reminderSentOnExpiry: false,
    reminderSentGraceStart: false,
    reminderSentGraceMid: false,
    reminderSentGraceLast: false,
    reminderSentExpired: false,
    user: { id: 'user_1', name: 'Студент Тестовий', email: 'student@example.com' },
    cohort: { name: 'Набір 2026/27' },
    ...overrides,
  };
}

test('stateBasedIssues: TG_INVITE_FAILED піднімається, коли є помилка і клієнт ще не приєднався', () => {
  const sub = makeSub({ telegramInviteError: 'Bad Request: chat not found' });
  const out = stateBasedIssues(sub, true, undefined);
  assert.equal(out.length, 1);
  assert.equal(out[0]!.kind, 'TG_INVITE_FAILED');
});

test('stateBasedIssues: TG_INVITE_FAILED НЕ піднімається, якщо клієнт приєднався ПІСЛЯ помилки (прод-кейс 09.09)', () => {
  const failedAt = new Date('2026-09-01T10:00:00Z');
  const sub = makeSub({
    telegramInviteError: 'Bad Request: chat not found',
    telegramJoinedAt: new Date('2026-09-02T10:00:00Z'),
  });
  const out = stateBasedIssues(sub, true, { inviteFailedAt: failedAt });
  assert.equal(out.length, 0);
});

test('stateBasedIssues: TG_INVITE_FAILED піднімається знову, якщо нова помилка ПІСЛЯ приєднання (invite протух і перегенерація впала)', () => {
  const sub = makeSub({
    telegramInviteError: 'Bad Request: chat not found',
    telegramJoinedAt: new Date('2026-09-02T10:00:00Z'),
  });
  const out = stateBasedIssues(sub, true, { inviteFailedAt: new Date('2026-09-10T10:00:00Z') });
  assert.equal(out.length, 1);
  assert.equal(out[0]!.kind, 'TG_INVITE_FAILED');
});

test('stateBasedIssues: без події-якоря fallback на createdAt підписки — приєднання пізніше за створення теж гасить issue', () => {
  const sub = makeSub({
    telegramInviteError: 'Bad Request: chat not found',
    createdAt: new Date('2026-08-01T00:00:00Z'),
    telegramJoinedAt: new Date('2026-08-05T00:00:00Z'),
  });
  const out = stateBasedIssues(sub, true, undefined);
  assert.equal(out.length, 0);
});

test('stateBasedIssues: неоплаченому і не-ACTIVE/GRACE клієнту issue не показуємо', () => {
  const sub = makeSub({ status: 'PENDING', telegramInviteError: 'Bad Request: chat not found' });
  const out = stateBasedIssues(sub, false, undefined);
  assert.equal(out.length, 0);
});

test('shouldFlagUsernameMissing: реальний клієнт у наборі, autoAdd ON, без username і без join → true', () => {
  assert.equal(
    shouldFlagUsernameMissing({
      hasCohort: true,
      isRealClient: true,
      autoAddEnabled: true,
      telegramUsername: null,
      telegramJoinedAt: null,
    }),
    true,
  );
});

test('shouldFlagUsernameMissing: є username → false', () => {
  assert.equal(
    shouldFlagUsernameMissing({
      hasCohort: true,
      isRealClient: true,
      autoAddEnabled: true,
      telegramUsername: '@student',
      telegramJoinedAt: null,
    }),
    false,
  );
});

test('shouldFlagUsernameMissing: уже приєднався (join без username, наприклад legacy) → false', () => {
  assert.equal(
    shouldFlagUsernameMissing({
      hasCohort: true,
      isRealClient: true,
      autoAddEnabled: true,
      telegramUsername: null,
      telegramJoinedAt: new Date('2026-08-05T00:00:00Z'),
    }),
    false,
  );
});

test('shouldFlagUsernameMissing: autoAdd вимкнено глобально → false', () => {
  assert.equal(
    shouldFlagUsernameMissing({
      hasCohort: true,
      isRealClient: true,
      autoAddEnabled: false,
      telegramUsername: null,
      telegramJoinedAt: null,
    }),
    false,
  );
});

test('shouldFlagUsernameMissing: без набору → false', () => {
  assert.equal(
    shouldFlagUsernameMissing({
      hasCohort: false,
      isRealClient: true,
      autoAddEnabled: true,
      telegramUsername: null,
      telegramJoinedAt: null,
    }),
    false,
  );
});

test('shouldFlagUsernameMissing: не реальний клієнт (PENDING без оплати) → false', () => {
  assert.equal(
    shouldFlagUsernameMissing({
      hasCohort: true,
      isRealClient: false,
      autoAddEnabled: true,
      telegramUsername: null,
      telegramJoinedAt: null,
    }),
    false,
  );
});
