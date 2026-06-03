/// Readonly: чому Ельвіра приєдналась у TG, а статус лишився «⏳ запрошення».
import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '..', '.env.local'), override: true }); // токен
config({ path: path.resolve(__dirname, '..', '.env'), override: true });       // прод DB
const prisma = new PrismaClient();
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

function line() { console.log('─'.repeat(64)); }
async function tg(method, params = {}) {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params),
  });
  return r.json();
}

// 1) Налаштування каналу/групи
const settings = await prisma.yearlyProgramTelegramSetting.findUnique({ where: { id: 'singleton' } });
console.log('TG SETTINGS');
console.log('  chatId:', settings?.chatId, '| title:', settings?.chatTitle, '| type:', settings?.chatType);
console.log('  autoAdd:', settings?.autoAdd, '| joinRequestMode:', settings?.joinRequestMode);
line();

// 2) Підписка Ельвіри
const sub = await prisma.yearlyProgramSubscription.findFirst({
  where: { user: { email: 'shevaelvira17@gmail.com' } },
  orderBy: { createdAt: 'desc' },
  select: {
    id: true, status: true,
    telegramUsername: true, telegramInviteLink: true,
    telegramInvitedAt: true, telegramJoinedAt: true, telegramLeftAt: true, telegramTgUserId: true,
  },
});
console.log('ELVIRA SUB');
console.log(JSON.stringify({ ...sub, telegramTgUserId: sub?.telegramTgUserId?.toString() ?? null }, null, 1));
line();

// 3) Події цієї підписки (чи прилітав webhook)
if (sub) {
  const events = await prisma.yearlyProgramSubscriptionEvent.findMany({
    where: { subscriptionId: sub.id },
    orderBy: { createdAt: 'desc' }, take: 12,
    select: { createdAt: true, type: true, message: true },
  });
  console.log('ПОДІЇ (останні 12):');
  for (const e of events) console.log(`  ${e.createdAt.toISOString().slice(5,16)}  ${e.type.padEnd(22)} ${e.message ?? ''}`);
  line();
}

// 4) Webhook info
if (TOKEN) {
  const info = (await tg('getWebhookInfo')).result ?? {};
  console.log('WEBHOOK');
  console.log('  url:', info.url);
  console.log('  allowed_updates:', (info.allowed_updates || []).join(', ') || '(всі)');
  console.log('  pending:', info.pending_update_count);
  console.log('  last_error:', info.last_error_message || '—', info.last_error_date ? new Date(info.last_error_date*1000).toISOString() : '');
  line();

  // 5) Чи бот адмін у налаштованому чаті + чи увімкнено join-request
  if (settings?.chatId) {
    const me = (await tg('getMe')).result;
    const chat = await tg('getChat', { chat_id: settings.chatId });
    console.log('CHAT (getChat налаштованого chatId)');
    if (chat.ok) {
      console.log('  ok:', chat.result.title, '| type:', chat.result.type, '| id:', chat.result.id);
      console.log('  join_to_send / join_by_request:', chat.result.join_to_send_messages, '/', chat.result.join_by_request);
    } else {
      console.log('  ПОМИЛКА getChat:', chat.description);
    }
    const cm = await tg('getChatMember', { chat_id: settings.chatId, user_id: me.id });
    console.log('  Бот у чаті:', cm.ok ? `${cm.result.status}${cm.result.can_invite_users !== undefined ? ` (can_invite_users=${cm.result.can_invite_users})` : ''}` : `ПОМИЛКА: ${cm.description}`);
  }
}

await prisma.$disconnect();
