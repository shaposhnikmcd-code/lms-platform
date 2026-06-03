/// Readonly: список активних підписок з telegram-полями для ручної звірки зі списком
/// учасників каналу (фото). Нічого не мутує.
import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '..', '.env'), override: true });
const prisma = new PrismaClient();

const subs = await prisma.yearlyProgramSubscription.findMany({
  where: { status: { in: ['ACTIVE', 'GRACE', 'PENDING'] } },
  orderBy: { createdAt: 'desc' },
  select: {
    id: true,
    status: true,
    telegramUsername: true,
    telegramInvitedAt: true,
    telegramJoinedAt: true,
    user: { select: { name: true, email: true } },
  },
});

console.log(`Активних/grace/pending підписок: ${subs.length}\n`);
console.log('STATUS    JOINED  TG-USERNAME            IM\'Я (UIMP)              EMAIL');
console.log('─'.repeat(92));
for (const s of subs) {
  const joined = s.telegramJoinedAt ? '✓' : '·';
  console.log(
    `${s.status.padEnd(9)} ${joined.padEnd(6)} ${(s.telegramUsername ?? '—').padEnd(22)} ${(s.user?.name ?? '—').padEnd(24)} ${s.user?.email ?? '—'}`
  );
}

await prisma.$disconnect();
