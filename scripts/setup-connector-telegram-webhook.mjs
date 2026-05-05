/**
 * Одноразова реєстрація webhook для бота @connectorgame_bot.
 *
 * Запускається ВРУЧНУ після першого деплою на uimp.com.ua (та повторно тільки якщо
 * URL ендпоінту або секрет змінилися):
 *
 *   node scripts/setup-connector-telegram-webhook.mjs
 *
 * За замовчуванням реєструє webhook на:
 *   https://uimp.com.ua/api/telegram/connector-webhook
 *
 * Перевизначити URL можна змінною оточення:
 *   $env:CONNECTOR_WEBHOOK_URL = "https://pre.uimp.com.ua/api/telegram/connector-webhook"
 *   node scripts/setup-connector-telegram-webhook.mjs
 *
 * Скрипт читає TELEGRAM_CONNECTOR_BOT_TOKEN та TELEGRAM_CONNECTOR_WEBHOOK_SECRET з .env.local
 * (override) → .env (fallback). Обидві змінні мають бути задані.
 */

import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

config({ path: path.join(projectRoot, '.env') });
config({ path: path.join(projectRoot, '.env.local'), override: true });

const TOKEN = process.env.TELEGRAM_CONNECTOR_BOT_TOKEN;
const SECRET = process.env.TELEGRAM_CONNECTOR_WEBHOOK_SECRET;
const WEBHOOK_URL = process.env.CONNECTOR_WEBHOOK_URL || 'https://uimp.com.ua/api/telegram/connector-webhook';

if (!TOKEN || !TOKEN.trim()) {
  console.error('❌ TELEGRAM_CONNECTOR_BOT_TOKEN не заданий у .env / .env.local');
  process.exit(1);
}
if (!SECRET || !SECRET.trim()) {
  console.error('❌ TELEGRAM_CONNECTOR_WEBHOOK_SECRET не заданий у .env / .env.local');
  process.exit(1);
}

async function tg(method, payload) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Telegram API error (${method}): ${data.description}`);
  }
  return data.result;
}

async function main() {
  console.log('🤖 Перевіряю бота…');
  const me = await tg('getMe', {});
  console.log(`   ↳ id=${me.id}, username=@${me.username}`);

  console.log(`📡 Реєструю webhook → ${WEBHOOK_URL}`);
  await tg('setWebhook', {
    url: WEBHOOK_URL,
    secret_token: SECRET,
    allowed_updates: ['message'],
    drop_pending_updates: true,
  });

  const info = await tg('getWebhookInfo', {});
  console.log('✅ Webhook зареєстровано:');
  console.log(`   URL:                  ${info.url}`);
  console.log(`   Pending updates:      ${info.pending_update_count}`);
  console.log(`   Last error:           ${info.last_error_message || '—'}`);
  console.log(`   Has secret_token:     ${info.has_custom_certificate ? 'yes (cert)' : 'sent via secret_token header'}`);

  console.log('');
  console.log(`🔗 Бот: https://t.me/${me.username}`);
  console.log('   Менеджери можуть надіслати йому /start, щоб отримати свій chat_id.');
}

main().catch((e) => {
  console.error('❌', e.message || e);
  process.exit(1);
});
