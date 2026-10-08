/// Юніт-тести налаштування «Вилучати з каналу при закритті доступу за несплату».
/// Запуск: `npm run test:tgkick` (або `npm test` разом з рештою).
///
/// Навіщо: Інститут попросив, щоб за несплату студента НЕ виганяли з Telegram-каналу.
/// Перевіряємо, що cron-крок `expire_grace` кікає лише за явно увімкненого налаштування,
/// а відсутній рядок чи збій читання БД ніколи не призводить до кіка.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getYearlyTelegramKickOnExpire,
  graceExpireTelegramAction,
  YEARLY_TG_KICK_ON_EXPIRE_SETTING_KEY,
} from './yearlyProgramConfig';

function fakeClient(row: { value: number } | null | 'throw') {
  const seen: string[] = [];
  return {
    seen,
    client: {
      appSetting: {
        findUnique: async (args: { where: { key: string } }) => {
          seen.push(args.where.key);
          if (row === 'throw') throw new Error('db down');
          return row;
        },
      },
    },
  };
}

test('налаштування не задане → не кікаємо (default вимкнено)', async () => {
  const { client, seen } = fakeClient(null);
  const on = await getYearlyTelegramKickOnExpire(client);
  assert.equal(on, false);
  assert.deepEqual(seen, [YEARLY_TG_KICK_ON_EXPIRE_SETTING_KEY]);
  assert.equal(graceExpireTelegramAction(on), 'skip');
});

test('вимкнено (0) → не кікаємо', async () => {
  const on = await getYearlyTelegramKickOnExpire(fakeClient({ value: 0 }).client);
  assert.equal(graceExpireTelegramAction(on), 'skip');
});

test('увімкнено (1) → кікаємо', async () => {
  const on = await getYearlyTelegramKickOnExpire(fakeClient({ value: 1 }).client);
  assert.equal(on, true);
  assert.equal(graceExpireTelegramAction(on), 'kick');
});

test('збій читання БД → не кікаємо', async () => {
  const on = await getYearlyTelegramKickOnExpire(fakeClient('throw').client);
  assert.equal(graceExpireTelegramAction(on), 'skip');
});
