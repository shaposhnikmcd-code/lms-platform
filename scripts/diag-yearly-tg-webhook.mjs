/// Readonly-діагностика: чому в усіх підписок Telegram = "⏳ запрошення".
/// 1) getWebhookInfo бота — чи зареєстровано, які allowed_updates, чи є помилки.
/// 2) Прод-БД — telegram-поля підписок (invited/joined/left + tgUserId).
import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '..', '.env'), override: true });
config({ path: path.resolve(__dirname, '..', '.env.local'), override: true });
// Повертаємо DATABASE_URL на прод (його міг перезаписати .env.local на dev).
config({ path: path.resolve(__dirname, '..', '.env'), override: true });

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const prisma = new PrismaClient();

function line() { console.log('─'.repeat(60)); }

// === 1. Webhook info ===
if (!TOKEN) {
  console.log('❌ TELEGRAM_BOT_TOKEN не знайдено');
} else {
  const me = await (await fetch(`https://api.telegram.org/bot${TOKEN}/getMe`)).json();
  const info = await (await fetch(`https://api.telegram.org/bot${TOKEN}/getWebhookInfo`)).json();
  console.log('WEBHOOK (Telegram getWebhookInfo)');
  console.log('  bot:               @' + (me.result?.username ?? '?'));
  const w = info.result ?? {};
  console.log('  url:               ' + (w.url || '— НЕ ЗАРЕЄСТРОВАНО'));
  console.log('  allowed_updates:   ' + ((w.allowed_updates || []).join(', ') || '(всі за замовч. — БЕЗ chat_member!)'));
  console.log('  pending_updates:   ' + (w.pending_update_count ?? 0));
  console.log('  last_error_date:   ' + (w.last_error_date ? new Date(w.last_error_date * 1000).toISOString() : '—'));
  console.log('  last_error_message:' + (w.last_error_message || '—'));
}
line();

// === 2. DB telegram-поля ===
const host = (process.env.DATABASE_URL || '').match(/@([^/?]+)/)?.[1] ?? '?';
console.log('DB host: ' + host);

const subs = await prisma.yearlyProgramSubscription.findMany({
  where: { status: { in: ['ACTIVE', 'GRACE', 'PENDING'] } },
  orderBy: { createdAt: 'desc' },
  select: {
    id: true,
    telegramUsername: true,
    telegramInviteLink: true,
    telegramInvitedAt: true,
    telegramJoinedAt: true,
    telegramLeftAt: true,
    telegramTgUserId: true,
  },
});

let invited = 0, joined = 0, left = 0, withTgId = 0, noInvite = 0;
for (const s of subs) {
  if (s.telegramInvitedAt) invited++; else noInvite++;
  if (s.telegramJoinedAt) joined++;
  if (s.telegramLeftAt) left++;
  if (s.telegramTgUserId) withTgId++;
}
console.log(`Підписок (ACTIVE/GRACE/PENDING): ${subs.length}`);
console.log(`  invitedAt не null:  ${invited}`);
console.log(`  joinedAt не null:   ${joined}   ← скільки реально "у каналі"`);
console.log(`  leftAt не null:     ${left}`);
console.log(`  tgUserId не null:   ${withTgId}   ← чи webhook колись фіксував join/leave`);
console.log(`  без invite взагалі: ${noInvite}`);
line();
console.log('Останні 12 підписок:');
for (const s of subs.slice(0, 12)) {
  const flag = s.telegramJoinedAt ? '✓joined' : s.telegramInvitedAt ? '⏳invited' : '—';
  console.log(`  ${flag.padEnd(9)} tgUser=${s.telegramTgUserId ?? '—'}  user=${s.telegramUsername ?? '—'}`);
}

await prisma.$disconnect();
