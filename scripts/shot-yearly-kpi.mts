/// Playwright-скріншот + вимір KPI-стрічки Річної програми на різних viewport-ах.
/// Запуск (потрібен npm run dev): npx tsx scripts/shot-yearly-kpi.mts
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
config({ path: resolve(root, '.env.local'), override: true });

const { encode } = await import('next-auth/jwt');
const { chromium } = await import('playwright');
const { default: prisma } = await import('../lib/prisma');

const adminEmail = (process.env.ADMIN_EMAILS ?? '').split(',')[0].trim();
const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
if (!admin) throw new Error(`admin ${adminEmail} not found`);

const token = await encode({
  token: {
    id: admin.id,
    sub: admin.id,
    email: admin.email,
    name: admin.name,
    role: 'ADMIN',
    activeRole: 'ADMIN',
  },
  secret: process.env.NEXTAUTH_SECRET!,
});

const browser = await chromium.launch();
const ctx = await browser.newContext();
await ctx.addCookies([
  { name: 'uimp.session-token', value: token, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' },
]);
const page = await ctx.newPage();

for (const width of [1519, 1366]) {
  await page.setViewportSize({ width, height: 960 });
  await page.goto('http://localhost:3000/dashboard/admin/yearly-program', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  const info = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('[data-kpi-row]')].map((row) => {
      const kids = [...row.children].map((c) => {
        const r = c.getBoundingClientRect();
        return { text: (c.textContent ?? '').trim().slice(0, 30), top: Math.round(r.top), right: Math.round(r.right) };
      });
      const lines = [...new Set(kids.map((k) => k.top))].length;
      const r = row.getBoundingClientRect();
      return { id: row.getAttribute('data-kpi-row'), lines, width: Math.round(r.width), scrollWidth: (row as HTMLElement).scrollWidth, items: kids };
    });
    const row = document.querySelector('[data-kpi-row="status"]') as HTMLElement | null;
    const panel = row?.parentElement as HTMLElement | null;
    const holder = panel?.parentElement as HTMLElement | null;
    return {
      rows: rows.map((r) => ({ id: r.id, lines: r.lines, width: r.width, lastRight: r.items.at(-1)?.right })),
      panelWidth: panel ? Math.round(panel.getBoundingClientRect().width) : null,
      availableWidth: holder ? Math.round(holder.getBoundingClientRect().width) : null,
    };
  });
  console.log(`\n=== ${width}px ===`);
  console.log(JSON.stringify(info, null, 1));

  await page.screenshot({ path: resolve(root, `yearly-kpi-${width}.png`), clip: { x: 0, y: 0, width, height: 560 } });

  // Stress-тест: підставляємо «прод-масштабні» числа (3-значні лічильники + 7-значний дохід)
  // і перевіряємо, що рядок усе одно не переноситься.
  const stressed = await page.evaluate(() => {
    const row = document.querySelector('[data-kpi-row="status"]') as HTMLElement;
    [...row.children].forEach((kid, i) => {
      const span = kid.querySelector('span:nth-of-type(2)');
      if (span) span.textContent = i === 6 ? '1 250 000 ₴' : '128';
    });
    const tops = [...row.children].map((c) => Math.round(c.getBoundingClientRect().top));
    return { lines: [...new Set(tops)].length, width: Math.round(row.getBoundingClientRect().width) };
  });
  console.log('stress (128 × 6 + 1 250 000 ₴):', stressed);
  await page.screenshot({ path: resolve(root, `yearly-kpi-${width}-stress.png`), clip: { x: 0, y: 0, width, height: 560 } });
}

await browser.close();
await prisma.$disconnect();
