/// One-shot: рендерить standalone GOLD SPHERE — просто золотий шар з 3D bevel
/// (highlight зверху-зліва, shadow знизу). Без BG-диску, без dotted ring, без UIMP.
/// Запуск: `npx tsx scripts/render-course-bottomseal-sphere.mjs`

import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const elementsUrl = pathToFileURL(path.resolve('lib/certificates/elements.ts')).href;
const fontsUrl = pathToFileURL(path.resolve('lib/certificates/fonts.ts')).href;

const { c, GOLD, GOLD_PALE, GOLD_DEEP } = await import(elementsUrl);
const { loadFont } = await import(fontsUrl);

const doc = await PDFDocument.create();
doc.registerFontkit(fontkit);
const f = async (k) => doc.embedFont(loadFont(k), { subset: false });
const fonts = {
  cormorantItalic: await f('cormorantItalic'),
  interMedium: await f('interMedium'),
};

const CREAM_BG = c({ r: 249, g: 244, b: 232 });
const GREEN = c({ r: 28, g: 58, b: 46 });
const GREY = c({ r: 74, g: 74, b: 66 });

const SIZE = 1100;
const page = doc.addPage([SIZE, SIZE]);
page.drawRectangle({ x: 0, y: 0, width: SIZE, height: SIZE, color: CREAM_BG, borderWidth: 0 });

page.drawText('Course Bottom Seal — Gold Sphere', {
  x: 60, y: SIZE - 60, size: 28, font: fonts.cormorantItalic, color: GREEN,
});
page.drawText('Просто золотий шар з 3D bevel (highlight зверху-зліва, shadow знизу)', {
  x: 60, y: SIZE - 95, size: 13, font: fonts.interMedium, color: GREY,
});

const cx = SIZE / 2;
const cy = SIZE / 2 - 30;
const r = 280;

/// Soft drop shadow (3 шари)
for (let i = 0; i < 3; i++) {
  page.drawCircle({
    x: cx, y: cy - i * 1.2, size: r + 3 - i * 0.8,
    color: rgb(0, 0, 0), borderWidth: 0, opacity: 0.10,
  });
}
/// Thin dark outer rim — defines edge of sphere
page.drawCircle({
  x: cx, y: cy, size: r + r * 0.012,
  color: c(GOLD_DEEP), borderWidth: 0,
});
/// Bottom shadow crescent — sphere bottom in shadow
page.drawCircle({
  x: cx, y: cy - r * 0.045, size: r,
  color: c(GOLD_DEEP), borderWidth: 0,
});
/// Top highlight crescent — sphere top catches light
page.drawCircle({
  x: cx, y: cy + r * 0.035, size: r,
  color: c(GOLD_PALE), borderWidth: 0,
});
/// Main sphere face (smaller — щоб crescents лишилися видимі на edge-ах)
page.drawCircle({
  x: cx, y: cy, size: r * 0.93,
  color: c(GOLD), borderWidth: 0,
});
/// Soft specular highlight (top-left) — sphere lit from above
page.drawCircle({
  x: cx - r * 0.10, y: cy + r * 0.13, size: r * 0.55,
  color: c(GOLD_PALE), borderWidth: 0, opacity: 0.45,
});
/// Brightest specular spot
page.drawCircle({
  x: cx - r * 0.16, y: cy + r * 0.20, size: r * 0.22,
  color: c({ r: 252, g: 232, b: 175 }), borderWidth: 0, opacity: 0.55,
});

const outPdf = 'public/Certificates/element-course-bottomseal-sphere.pdf';
fs.writeFileSync(outPdf, await doc.save());
console.log(`wrote ${outPdf}`);
