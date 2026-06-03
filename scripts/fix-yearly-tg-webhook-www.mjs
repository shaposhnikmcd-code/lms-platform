/// Перереєстрація webhook Річної на КАНОНІЧНИЙ www-хост (apex робив 307→www, Telegram
/// редіректи не виконує → усі апдейти падали). drop_pending_updates=false — щоб 3 застряглі
/// апдейти (зокрема приєднання студентів) доставились на робочий URL і записались.
import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '..', '.env') });
config({ path: path.resolve(__dirname, '..', '.env.local'), override: true });

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SECRET = process.env.TELEGRAM_YEARLY_WEBHOOK_SECRET;
const URL = 'https://www.uimp.com.ua/api/telegram/yearly-program-webhook';

async function tg(method, params = {}) {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params),
  });
  return r.json();
}

const res = await tg('setWebhook', {
  url: URL,
  secret_token: SECRET,
  allowed_updates: ['chat_join_request', 'chat_member'],
  drop_pending_updates: false,
});
console.log('setWebhook:', res.ok ? 'OK' : `FAIL — ${res.description}`);

const info = (await tg('getWebhookInfo')).result ?? {};
console.log('url:', info.url);
console.log('pending:', info.pending_update_count);
console.log('last_error:', info.last_error_message || '—');
