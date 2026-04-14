// Виявляє дублікати угод в SendPulse CRM.
// Спочатку перевіряємо, нічого не видаляємо. Для видалення — окремий скрипт.
//
// Запуск: node scripts/findSendPulseDuplicates.mjs
// (читає SENDPULSE_API_KEY та SENDPULSE_SECRET_KEY з .env.local)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
  }
}

const CLIENT_ID = process.env.SENDPULSE_API_KEY;
const CLIENT_SECRET = process.env.SENDPULSE_SECRET_KEY;
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ SENDPULSE_API_KEY/SECRET_KEY не знайдено в .env.local');
  process.exit(1);
}

const API = 'https://api.sendpulse.com';

async function getToken() {
  // Спроба 1 — sp_apikey_* використовується як Bearer напряму (новий формат SendPulse)
  if (CLIENT_ID.startsWith('sp_apikey_')) {
    return CLIENT_ID;
  }

  // Спроба 2 — OAuth2 client_credentials
  const res = await fetch(`${API}/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Auth failed: ' + JSON.stringify(data));
  return data.access_token;
}

async function fetchAllDeals(token) {
  const all = [];
  let offset = 0;
  const limit = 100;
  while (true) {
    const url = `${API}/crm/v1/deals`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit, offset }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`POST ${url} → ${res.status} ${text.slice(0, 300)}`);
    }
    const data = await res.json();
    const items = data.data || data.list || data.items || data.deals || [];
    if (!Array.isArray(items) || items.length === 0) break;
    all.push(...items);
    if (items.length < limit) break;
    offset += limit;
    if (all.length > 2000) break; // safety
  }
  return all;
}

function dealKey(d) {
  // Витягнути email з contacts, назву з name/title, дату YYYY-MM-DD з createdAt
  const contact = Array.isArray(d.contacts) ? d.contacts[0] : d.contact || null;
  const email =
    (contact && (contact.email || (contact.emails && contact.emails[0]))) ||
    d.email ||
    d.customer_email ||
    '?';
  const title = d.name || d.title || d.product_name || '?';
  const created = d.created_at || d.createdAt || d.date_create || d.created || '?';
  const day = typeof created === 'string' ? created.slice(0, 10) : '?';
  return { email, title, day, id: d.id, created };
}

const token = await getToken();
console.log('✅ Авторизовано в SendPulse');

const deals = await fetchAllDeals(token);
console.log(`📦 Отримано угод: ${deals.length}\n`);

if (deals.length === 0) {
  console.log('Нема угод або ендпоінт повернув пусто. Збережу сирий payload для debug:');
  process.exit(0);
}

// Подивитись структуру першої угоди
console.log('--- Структура першої угоди (для debug) ---');
console.log(JSON.stringify(deals[0], null, 2).slice(0, 800));
console.log('---\n');

// Групування
const groups = new Map();
for (const d of deals) {
  const k = dealKey(d);
  const key = `${k.email}|${k.title}|${k.day}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(k);
}

const duplicateGroups = [...groups.entries()].filter(([, v]) => v.length > 1);
duplicateGroups.sort((a, b) => b[1].length - a[1].length);

let totalDupes = 0;
let totalToDelete = 0;
console.log(`🔍 Груп з дублікатами: ${duplicateGroups.length}\n`);

const toDelete = [];
for (const [key, items] of duplicateGroups) {
  totalDupes += items.length;
  items.sort((a, b) => String(a.created).localeCompare(String(b.created)));
  const keep = items[0];
  const del = items.slice(1);
  totalToDelete += del.length;
  console.log(`📍 ${key}`);
  console.log(`   Залишаємо: ${keep.id} (${keep.created})`);
  for (const d of del) {
    console.log(`   Видалити:  ${d.id} (${d.created})`);
    toDelete.push(d.id);
  }
  console.log('');
}

console.log(`\n=== ПІДСУМОК ===`);
console.log(`Всього угод: ${deals.length}`);
console.log(`Унікальних комбінацій (email+product+day): ${groups.size}`);
console.log(`Груп з дублікатами: ${duplicateGroups.length}`);
console.log(`Дублікатів загалом: ${totalDupes}`);
console.log(`Угод на видалення: ${totalToDelete}`);

// Зберегти список ID на видалення
const outPath = path.join(__dirname, 'sendpulse_duplicates_to_delete.json');
fs.writeFileSync(outPath, JSON.stringify(toDelete, null, 2));
console.log(`\n💾 Список ID збережено: ${outPath}`);
console.log('Запусти scripts/deleteSendPulseDuplicates.mjs щоб видалити (з --confirm).');
