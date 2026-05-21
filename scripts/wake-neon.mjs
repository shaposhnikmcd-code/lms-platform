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

// Діагностика: показуємо до якого host стукаємось (без credentials), щоб у
// разі неуспіху було видно чи DATABASE_URL взагалі попав у build-env.
const dbUrl = process.env.DATABASE_URL ?? "";
let dbHost = "(DATABASE_URL not set)";
try {
  if (dbUrl) dbHost = new URL(dbUrl).host;
} catch {}
console.log(`[wake-neon] target host: ${dbHost}`);

const prisma = new PrismaClient();

function formatError(e) {
  if (!(e instanceof Error)) return String(e);
  const parts = [];
  if (e.name) parts.push(`name=${e.name}`);
  if (e.code) parts.push(`code=${e.code}`);
  if (e.errorCode) parts.push(`errorCode=${e.errorCode}`);
  const msg = (e.message ?? "").trim();
  if (msg) parts.push(`message="${msg.replace(/\s+/g, " ").slice(0, 300)}"`);
  if (e.cause) parts.push(`cause=${String(e.cause).slice(0, 200)}`);
  return parts.length ? parts.join(" | ") : "(empty error — no name/code/message)";
}

async function wake() {
  for (let i = 1; i <= MAX_TRIES; i++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log(`[wake-neon] ✓ DB awake (attempt ${i}/${MAX_TRIES})`);
      await prisma.$disconnect();
      return;
    } catch (e) {
      console.warn(`[wake-neon] attempt ${i}/${MAX_TRIES} failed: ${formatError(e)}`);
      if (i < MAX_TRIES) {
        await new Promise(r => setTimeout(r, DELAY_MS));
      }
    }
  }
  await prisma.$disconnect().catch(() => {});
  console.error(`[wake-neon] ✗ giving up after ${MAX_TRIES} attempts — host=${dbHost}`);
  process.exit(1);
}

wake();
