// Responsive audit: краулить публічні маршрути на кількох viewport-ах і
// рапортує реальний горизонтальний overflow + елементи-винуватці.
// Запуск: node scripts/responsive-audit.mjs [baseUrl]
// Потребує запущеного dev-сервера (default http://localhost:3000).
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:3000';
const WIDTHS = [320, 414, 768, 1024, 1440];

const ROUTES = [
  '/',
  '/courses',
  '/courses/psychology-basics',
  '/courses/psychiatry-basics',
  '/courses/military-psychology',
  '/courses/emotional-intelligence',
  '/courses/mentorship',
  '/courses/sex-education',
  '/courses/psychotherapy-of-biblical-heroes',
  '/courses/Fundamentals-of-Christian-Psychology-2.0',
  '/yearly-program',
  '/games',
  '/news',
  '/partners',
  '/charity',
  '/consultations',
  '/contacts',
  '/additional-materials',
  '/accessibility',
  '/privacy',
  '/terms',
  '/delete-data',
  '/links',
  '/links/connector',
  '/links/consultation',
  '/login',
  '/forgot-password',
  '/payment/thank-you',
];

// Вимірювання всередині сторінки: повертає overflow + елементи що реально
// розширюють документ (виключаючи position:fixed/sticky та декоративні blur/shimmer).
const MEASURE = () => {
  const winW = window.innerWidth;
  const scrollW = document.documentElement.scrollWidth;
  const overflow = scrollW - winW;
  const offenders = [];
  if (overflow > 1) {
    document.querySelectorAll('body *').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed' || cs.position === 'sticky') return; // не розширюють scroll
      const cls = (el.className || '').toString();
      if (/blur-3xl|-translate-x-full/.test(cls)) return; // декоративні/hover-shimmer
      // елемент, чий правий край виходить за viewport, але сам він починається в межах
      if (r.right > winW + 1 && r.left >= -1 && r.left < winW) {
        offenders.push({
          tag: el.tagName,
          cls: cls.slice(0, 55),
          txt: (el.textContent || '').trim().slice(0, 30),
          L: Math.round(r.left),
          R: Math.round(r.right),
          w: Math.round(r.width),
        });
      }
    });
  }
  // dedup за (tag+cls+R) — лишаємо найширші
  const seen = new Set();
  const uniq = offenders
    .sort((a, b) => b.R - a.R)
    .filter((o) => {
      const k = o.tag + o.cls + o.R;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 6);
  return { winW, scrollW, overflow, offenders: uniq };
};

const report = [];
const browser = await chromium.launch();
try {
  for (const route of ROUTES) {
    const url = BASE + route;
    const row = { route, widths: {} };
    for (const w of WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
      const page = await ctx.newPage();
      let status = 'ok';
      try {
        const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 25000 });
        const code = resp ? resp.status() : 0;
        if (code >= 400) status = 'http' + code;
        await page.waitForTimeout(400);
        const m = await page.evaluate(MEASURE);
        row.widths[w] = { ...m, status };
      } catch (e) {
        row.widths[w] = { error: String(e).slice(0, 80), status: 'err' };
      }
      await ctx.close();
    }
    report.push(row);
    // друк рядка одразу
    const flags = WIDTHS.map((w) => {
      const d = row.widths[w];
      if (!d) return `${w}:?`;
      if (d.error) return `${w}:ERR`;
      if (d.status && d.status !== 'ok') return `${w}:${d.status}`;
      return d.overflow > 1 ? `${w}:OVERFLOW+${d.overflow}` : `${w}:ok`;
    }).join('  ');
    console.log(`${route.padEnd(48)} ${flags}`);
    // деталі винуватців
    for (const w of WIDTHS) {
      const d = row.widths[w];
      if (d && d.overflow > 1 && d.offenders.length) {
        for (const o of d.offenders) {
          console.log(`      [${w}] ${o.tag} .${o.cls} | "${o.txt}" L${o.L} R${o.R} w${o.w}`);
        }
      }
    }
  }
} finally {
  await browser.close();
}

const bad = report.filter((r) =>
  WIDTHS.some((w) => r.widths[w] && (r.widths[w].overflow > 1 || r.widths[w].error))
);
console.log(`\n==== SUMMARY: ${bad.length}/${report.length} routes with issues ====`);
for (const r of bad) {
  const ws = WIDTHS.filter((w) => r.widths[w] && (r.widths[w].overflow > 1 || r.widths[w].error));
  console.log(`  ${r.route}  →  ${ws.join(', ')}`);
}
