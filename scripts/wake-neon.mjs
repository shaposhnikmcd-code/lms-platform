// Прокидає Neon compute перед `prisma migrate deploy` у Vercel build-фазі.
//
// Чому: Neon scale-to-zero засинає прод-endpoint після ~5хв простою. Перший
// `migrate deploy` стукає у сплячий compute → P1001 (Can't reach database).
// Поки розробник ретраїть push, Neon встигає прокинутись — і другий build
// проходить. Цей скрипт робить SELECT 1 з retry-логікою, щоб «розігріти»
// compute синхронно перед міграціями.
//
// Запуск: автоматично у `npm run build` (Vercel) перед `prisma migrate deploy`.
// Локально нікому не заважає — на dev-branch endpoint майже завжди активний.

import { PrismaClient } from "@prisma/client";

const MAX_TRIES = 6;
const DELAY_MS = 4000;

const prisma = new PrismaClient();

async function wake() {
  for (let i = 1; i <= MAX_TRIES; i++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log(`[wake-neon] ✓ DB awake (attempt ${i}/${MAX_TRIES})`);
      await prisma.$disconnect();
      return;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[wake-neon] attempt ${i}/${MAX_TRIES} failed: ${msg.split("\n")[0]}`);
      if (i < MAX_TRIES) {
        await new Promise(r => setTimeout(r, DELAY_MS));
      }
    }
  }
  await prisma.$disconnect().catch(() => {});
  console.error(`[wake-neon] ✗ giving up after ${MAX_TRIES} attempts — Neon endpoint unreachable`);
  process.exit(1);
}

wake();
