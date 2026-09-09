/// Юніт-тест retry-обгортки над `createChatInviteLink` (Bot API rate-limit 429).
/// Запуск: `npm run test:telegram-retry` (або `npm test` разом з рештою).
///
/// Навіщо: масова генерація invite-ів (heal-крок, розсилка по набору) б'є в rate-limit
/// Telegram пачками по 40/ніч — без повтору кожна відмова 429 назавжди лишає студента
/// без запрошення, поки менеджер не натисне «Спробувати ще» вручну.
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.TELEGRAM_BOT_TOKEN ??= 'test-bot-token';
// isReadOnlyEnv() читає VERCEL_ENV — на тестовому прогоні (як і на localhost) його бути
// не має, інакше мутуючі виклики підмінюються заглушкою і фейковий fetch нижче не викличеться.
delete process.env.VERCEL_ENV;

import { createChatInviteLinkWithRetry, TelegramApiError } from './telegram';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

test('createChatInviteLinkWithRetry: 429 з retry_after → чекає (retry_after+1)с і повторює один раз, другий виклик успішний', async () => {
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string) => {
    calls.push(String(url));
    if (calls.length === 1) {
      return jsonResponse({ ok: false, error_code: 429, description: 'Too Many Requests: retry after 3', parameters: { retry_after: 3 } });
    }
    return jsonResponse({ ok: true, result: { invite_link: 'https://t.me/+realinvite' } });
  }) as typeof fetch;

  const waits: number[] = [];
  const fakeWait = async (ms: number) => { waits.push(ms); };

  try {
    const result = await createChatInviteLinkWithRetry({ chatId: '-100123', name: 'UIMP test' }, fakeWait);
    assert.equal(result.invite_link, 'https://t.me/+realinvite');
    assert.equal(calls.length, 2, 'мав бути рівно один повтор — два HTTP-виклики');
    assert.deepEqual(waits, [4000], 'чекає (retry_after=3 + 1) * 1000 мс');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('createChatInviteLinkWithRetry: друга 429 поспіль вже НЕ ретраїться — кидає помилку одразу', async () => {
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string) => {
    calls.push(String(url));
    return jsonResponse({ ok: false, error_code: 429, description: 'Too Many Requests: retry after 5', parameters: { retry_after: 5 } });
  }) as typeof fetch;

  const waits: number[] = [];
  const fakeWait = async (ms: number) => { waits.push(ms); };

  try {
    await assert.rejects(
      () => createChatInviteLinkWithRetry({ chatId: '-100123', name: 'UIMP test' }, fakeWait),
      (e: unknown) => e instanceof TelegramApiError && e.errorCode === 429,
    );
    assert.equal(calls.length, 2, 'один оригінальний виклик + один повтор, без третього');
    assert.deepEqual(waits, [6000]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('createChatInviteLinkWithRetry: помилка без retry_after (не 429) не ретраїться взагалі', async () => {
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string) => {
    calls.push(String(url));
    return jsonResponse({ ok: false, error_code: 400, description: 'Bad Request: chat not found' });
  }) as typeof fetch;

  const waits: number[] = [];
  const fakeWait = async (ms: number) => { waits.push(ms); };

  try {
    await assert.rejects(
      () => createChatInviteLinkWithRetry({ chatId: '-100123', name: 'UIMP test' }, fakeWait),
      (e: unknown) => e instanceof TelegramApiError && e.errorCode === 400,
    );
    assert.equal(calls.length, 1);
    assert.deepEqual(waits, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('createChatInviteLinkWithRetry: перший виклик успішний → жодного повтору й очікування', async () => {
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string) => {
    calls.push(String(url));
    return jsonResponse({ ok: true, result: { invite_link: 'https://t.me/+onefetch' } });
  }) as typeof fetch;

  const waits: number[] = [];
  const fakeWait = async (ms: number) => { waits.push(ms); };

  try {
    const result = await createChatInviteLinkWithRetry({ chatId: '-100123', name: 'UIMP test' }, fakeWait);
    assert.equal(result.invite_link, 'https://t.me/+onefetch');
    assert.equal(calls.length, 1);
    assert.deepEqual(waits, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
