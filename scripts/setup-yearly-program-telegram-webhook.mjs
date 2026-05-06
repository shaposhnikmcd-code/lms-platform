/**
 * Одноразова реєстрація webhook для бота Річної програми (TELEGRAM_BOT_TOKEN).
 *
 * Запускається після того як:
 *   1. Бот доданий в канал/групу як адмін з правом "Додавати учасників".
 *   2. У каналі ввімкнено режим "Заявки на вступ" (Request admin approval).
 *   3. У адмінці UIMP переключено joinRequestMode = ON.
 *
 *   node scripts/setup-yearly-program-telegram-webhook.mjs
 *
 * За замовчуванням реєструє webhook на:
 *   https://uimp.com.ua/api/telegram/yearly-program-webhook
 *
 * Перевизначити URL можна змінною оточення:
 *   $env:YEARLY_TG_WEBHOOK_URL = "https://pre.uimp.com.ua/api/telegram/yearly-program-webhook"
 *   node scripts/setup-yearly-program-telegram-webhook.mjs
 *
 * Скрипт читає TELEGRAM_BOT_TOKEN та TELEGRAM_YEARLY_WEBHOOK_SECRET з .env.local (override) → .env.
 *
 * ⚠️ ОБЕРЕЖНО: setWebhook на бота скасовує попередній webhook (якщо був).
 * Цей бот зараз НЕ має webhook (використовується тільки для getChat/createChatInviteLink),
 * тому ризику немає. Якщо в майбутньому до бота буде додано інший webhook —
 * треба буде об'єднувати allowed_updates.
 */

import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

config({ path: path.join(projectRoot, '.env') });
config({ path: path.join(projectRoot, '.env.local'), override: true });

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SECRET = process.env.TELEGRAM_YEARLY_WEBHOOK_SECRET;
const WEBHOOK_URL = process.env.YEARLY_TG_WEBHOOK_URL || 'https://uimp.com.ua/api/telegram/yearly-program-webhook';

if (!TOKEN || !TOKEN.trim()) {
  console.error('❌ TELEGRAM_BOT_TOKEN не заданий у .env / .env.local');
  process.exit(1);
}
if (!SECRET || !SECRET.trim()) {
  console.error('❌ TELEGRAM_YEARLY_WEBHOOK_SECRET не заданий у .env / .env.local');
  console.error('   Згенеруйте: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  console.error('   Додайте у .env.local І у Vercel env (для прода/pre).');
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
  console.log('🤖 Перевіряю бота Річної програми…');
  const me = await tg('getMe', {});
  console.log(`   ↳ id=${me.id}, username=@${me.username}`);

  console.log(`📡 Реєструю webhook → ${WEBHOOK_URL}`);
  await tg('setWebhook', {
    url: WEBHOOK_URL,
    secret_token: SECRET,
    allowed_updates: ['chat_join_request'],
    drop_pending_updates: true,
  });

  const info = await tg('getWebhookInfo', {});
  console.log('✅ Webhook зареєстровано:');
  console.log(`   URL:               ${info.url}`);
  console.log(`   Allowed updates:   ${(info.allowed_updates || []).join(', ') || '(all)'}`);
  console.log(`   Pending updates:   ${info.pending_update_count}`);
  console.log(`   Last error:        ${info.last_error_message || '—'}`);

  console.log('');
  console.log('Що далі:');
  console.log('  1. Перевір що в каналі ввімкнено "Заявки на вступ" (Request admin approval).');
  console.log('  2. У адмінці UIMP → Річна програма → "Додати в Telegram канал" → увімкни');
  console.log('     обидва чекбокси: "Автоматично додавати" та "Канал у режимі заявок на вступ".');
  console.log('  3. Тестова оплата → клієнт клікає invite → автоматично потрапляє в канал.');
}

main().catch((e) => {
  console.error('❌', e.message || e);
  process.exit(1);
});
