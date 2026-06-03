/// Одноразовий фікс: проставити «✓ у каналі» (telegramJoinedAt) для підтверджених
/// учасників TG-каналу, яких баг із webhook-ом не зафіксував. Тільки ці 3.
/// Матч за telegramUsername (case-insensitive, exact). Очікуємо рівно 1 збіг на кожен.
import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '..', '.env'), override: true });
const prisma = new PrismaClient();

const TARGETS = ['@Yuliia_Light', '@valentynakosiuha', '@marynaborysovska'];

for (const handle of TARGETS) {
  const matches = await prisma.yearlyProgramSubscription.findMany({
    where: {
      telegramUsername: { equals: handle, mode: 'insensitive' },
      status: { in: ['ACTIVE', 'GRACE'] },
    },
    select: { id: true, telegramJoinedAt: true, user: { select: { name: true } } },
  });

  if (matches.length !== 1) {
    console.log(`⚠️  ${handle}: знайдено ${matches.length} підписок — ПРОПУСКАЮ (треба рівно 1)`);
    continue;
  }
  const sub = matches[0];
  if (sub.telegramJoinedAt) {
    console.log(`•  ${handle} (${sub.user?.name}): вже joined — пропускаю`);
    continue;
  }

  await prisma.yearlyProgramSubscription.update({
    where: { id: sub.id },
    data: { telegramJoinedAt: new Date(), telegramLeftAt: null },
  });
  await prisma.yearlyProgramSubscriptionEvent.create({
    data: {
      subscriptionId: sub.id,
      type: 'admin_action',
      message: 'Telegram: статус «у каналі» проставлено вручну (звірка зі списком учасників після webhook-фіксу)',
      metadata: { handle, source: 'manual-reconcile' },
    },
  });
  console.log(`✓  ${handle} (${sub.user?.name}): позначено «у каналі»`);
}

await prisma.$disconnect();
