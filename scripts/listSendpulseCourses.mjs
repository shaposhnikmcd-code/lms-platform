/// Друкує всі SendPulse курси з числовими ID. Запуск:
///   node scripts/listSendpulseCourses.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  const path = join(__dirname, '..', '.env.local');
  const content = readFileSync(path, 'utf8');
  const env = {};
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = loadEnvLocal();
const API = 'https://api.sendpulse.com';

/// SendPulse має два режими авторизації:
/// 1) OAuth2: client_credentials → access_token (класичні User ID + Secret з ABI → API)
/// 2) Пряма Bearer-авторизація з API-key (prefix "sp_apikey_...")
/// Пробуємо обидва й використовуємо той, який спрацює.

async function tryOAuth() {
  // Пріоритет 1: OAuth2 creds з вкладки "Облікові дані"
  const id = env.SENDPULSE_OAUTH_CLIENT_ID || env.SENDPULSE_API_KEY;
  const secret = env.SENDPULSE_OAUTH_SECRET || env.SENDPULSE_SECRET_KEY;
  if (!id || !secret) return null;
  const res = await fetch(`${API}/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: id,
      client_secret: secret,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.access_token;
}

async function resolveAuthToken() {
  // 1) Спробувати OAuth2 flow
  const oauthToken = await tryOAuth();
  if (oauthToken) {
    console.log('✅ OAuth2 token ok\n');
    return oauthToken;
  }
  // 2) Якщо OAuth2 не працює — спробувати використати API key напряму
  if (env.SENDPULSE_API_KEY && env.SENDPULSE_API_KEY.startsWith('sp_apikey_')) {
    console.log('ℹ️ OAuth2 не спрацював, пробую прямий Bearer-auth з SENDPULSE_API_KEY\n');
    return env.SENDPULSE_API_KEY;
  }
  console.error('❌ Не вдалось авторизуватися: ні OAuth2, ні direct API key.');
  console.error('   Перевір SENDPULSE_API_KEY / SENDPULSE_SECRET_KEY в .env.local');
  console.error('   або зайди в кабінет SendPulse → Налаштування → API, скопіюй ID + Secret');
  process.exit(1);
}

async function tryEndpoint(token, path, altAuth) {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  const res = await fetch(`${API}${path}`, { headers });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, ok: res.ok, json, text };
}

function extractList(json) {
  if (!json) return null;
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.data)) return json.data;
  if (Array.isArray(json.items)) return json.items;
  if (Array.isArray(json.courses)) return json.courses;
  return null;
}

const token = await resolveAuthToken();

// Edu API живе за префіксом /edu/public/v1 (див. servers з OpenAPI spec)
const candidates = [
  '/edu/public/v1/courses',
  '/edu/public/v1/schools',
];

for (const path of candidates) {
  const { status, ok, json, text } = await tryEndpoint(token, path);
  console.log(`--- ${path} → ${status}`);
  if (ok) {
    const list = extractList(json);
    if (list && list.length > 0) {
      console.log(`  Знайдено ${list.length} записів:`);
      for (const item of list) {
        const id = item.id ?? item.course_id ?? item.school_id ?? '?';
        const name = item.name ?? item.title ?? item.course_name ?? '(no name)';
        console.log(`    ${id}  —  ${name}`);
      }
    } else {
      console.log('  (порожньо або невідомий формат)');
      console.log('  RAW:', JSON.stringify(json).slice(0, 500));
    }
  } else {
    console.log(`  response: ${text.slice(0, 200)}`);
  }
  console.log();
}
