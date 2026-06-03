/// Живий тест webhook Річної: стан + реальний POST на www-endpoint (200 vs 307) + перевірка секрета.
import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '..', '.env') });
config({ path: path.resolve(__dirname, '..', '.env.local'), override: true });

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SECRET = process.env.TELEGRAM_YEARLY_WEBHOOK_SECRET;
const URL = 'https://www.uimp.com.ua/api/telegram/yearly-program-webhook';

function line() { console.log('─'.repeat(60)); }

// 1) Стан webhook у Telegram
const info = (await (await fetch(`https://api.telegram.org/bot${TOKEN}/getWebhookInfo`)).json()).result ?? {};
console.log('1) WEBHOOK STATE (Telegram)');
console.log('   url:           ', info.url);
console.log('   pending:       ', info.pending_update_count);
console.log('   last_error:    ', info.last_error_message || '— (чисто)');
console.log('   allowed:       ', (info.allowed_updates || []).join(', '));
line();

// 2) Реальний POST правильним секретом — синтетичний update, який handler ІГНОРУЄ
//    (без chat_member/chat_join_request → жодних мутацій у БД). Очікуємо HTTP 200 + {ok:true}.
const okRes = await fetch(URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-telegram-bot-api-secret-token': SECRET },
  body: JSON.stringify({ update_id: 999000001 }),
  redirect: 'manual', // ВАЖЛИВО: НЕ слідувати редіректу — щоб зловити 307, якби він був
});
console.log('2) POST з правильним секретом (як шле Telegram)');
console.log('   HTTP status:   ', okRes.status, okRes.status === 200 ? '✅ (не 307 — без редіректу)' : okRes.status >= 300 && okRes.status < 400 ? '❌ РЕДІРЕКТ!' : '');
console.log('   body:          ', (await okRes.text()).slice(0, 80));
line();

// 3) POST з НЕВІРНИМ секретом — handler має відхилити ({ok:false}), доводить що валідація працює.
const badRes = await fetch(URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-telegram-bot-api-secret-token': 'WRONG-SECRET' },
  body: JSON.stringify({ update_id: 999000002 }),
  redirect: 'manual',
});
console.log('3) POST з НЕВІРНИМ секретом');
console.log('   HTTP status:   ', badRes.status);
console.log('   body:          ', (await badRes.text()).slice(0, 80), '  (очікуємо ok:false — секрет відхилено)');
line();
console.log('ВИСНОВОК: якщо (1) url=www + last_error чисто, (2) HTTP 200, (3) ok:false на чужий секрет —');
console.log('          webhook приймає апдейти Telegram і записуватиме приєднання. Без редіректу.');
