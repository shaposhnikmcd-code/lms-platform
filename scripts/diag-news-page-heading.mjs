// Друкує всі heading-блоки з NewsPage (сторінки /news) — щоб побачити чи є <a>
// в data.html. Використовує локальний Neon dev-branch.

import prisma from './_db.mjs';

const page = await prisma.newsPage.findFirst();
if (!page) {
  console.log('NewsPage row не знайдено.');
  process.exit(0);
}

let blocks = [];
try { blocks = JSON.parse(page.content || '[]'); } catch { /* */ }

const headings = blocks.filter(b => b?.type === 'heading');
console.log(`Headings знайдено: ${headings.length}\n`);
for (const h of headings) {
  console.log(`--- id=${h.id} level=${h.data?.level} bgColor=${h.bgColor} ---`);
  console.log(`html: ${JSON.stringify(h.data?.html ?? null)}`);
  console.log('');
}

await prisma.$disconnect();
