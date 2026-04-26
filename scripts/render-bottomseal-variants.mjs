/// Playground для вибору варіантів bottom-center small seal COURSE-сертифіката.
/// Рендерить 1 PDF-сторінку: 8 варіантів (BS1-BS8) на cream BG (4×2 grid).
///
/// BS1 = поточний production drawSmallSeal (gold disc + 2-tone rim + UIMP).
///
/// Запуск: `npx tsx scripts/render-bottomseal-variants.mjs`

import { PDFDocument } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const variantsUrl = pathToFileURL(path.resolve('lib/certificates/courseElementsVariants.ts')).href;
const elementsUrl = pathToFileURL(path.resolve('lib/certificates/elements.ts')).href;
const fontsUrl = pathToFileURL(path.resolve('lib/certificates/fonts.ts')).href;

const { courseBottomSealVariants } = await import(variantsUrl);
const { c } = await import(elementsUrl);
const { loadFont, loadPublicAsset } = await import(fontsUrl);

const doc = await PDFDocument.create();
doc.registerFontkit(fontkit);
const f = async (k) => doc.embedFont(loadFont(k), { subset: false });
const fonts = {
  cormorantItalic: await f('cormorantItalic'),
  cormorantBoldItalic: await f('cormorantBoldItalic'),
  cormorantRegular: await f('cormorantRegular'),
  interRegular: await f('interRegular'),
  interMedium: await f('interMedium'),
  interSemiBold: await f('interSemiBold'),
  russoOne: await f('russoOne'),
  cinzel: await f('cinzel'),
  bebasNeue: await f('bebasNeue'),
  bowlbyOne: await f('bowlbyOne'),
};
const logoGold = await doc.embedPng(loadPublicAsset('logo-gold.png'));

const CREAM_BG = c({ r: 249, g: 244, b: 232 });
const GREEN = c({ r: 28, g: 58, b: 46 });
const GREY = c({ r: 74, g: 74, b: 66 });

const W = 1500, H = 900;
const page = doc.addPage([W, H]);
page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: CREAM_BG, borderWidth: 0 });

page.drawText('Course Bottom Seal v3 — coin disc + 8 варіантів UIMP (font × 3D extrusion)', {
  x: 50, y: H - 50, size: 26, font: fonts.cormorantItalic, color: GREEN,
});
page.drawText('Усі на BS1 disc (rim + double inner ring + curved CERTIFIED · 2026). Скажи фаворита.', {
  x: 50, y: H - 80, size: 12, font: fonts.interMedium, color: GREY,
});

const cols = 4, rows = 2;
const cellW = W / cols;
const cellH = (H - 130) / rows;
const elementR = Math.min(cellW, cellH) * 0.30;

for (let i = 0; i < courseBottomSealVariants.length && i < cols * rows; i++) {
  const item = courseBottomSealVariants[i];
  const col = i % cols;
  const row = Math.floor(i / cols);
  const cx = col * cellW + cellW / 2;
  const cy = H - 130 - row * cellH - cellH * 0.42;

  item.draw(page, fonts, cx, cy, elementR, logoGold);

  page.drawText(item.id, {
    x: cx - cellW / 2 + 14, y: cy + cellH * 0.35,
    size: 18, font: fonts.cormorantItalic, color: GREEN,
  });

  const nameSize = 12;
  const nameW = fonts.interSemiBold.widthOfTextAtSize(item.name, nameSize);
  page.drawText(item.name, {
    x: cx - nameW / 2, y: cy - elementR - 22,
    size: nameSize, font: fonts.interSemiBold, color: GREY,
  });

  const descSize = 9;
  const descW = fonts.interRegular.widthOfTextAtSize(item.desc, descSize);
  page.drawText(item.desc, {
    x: cx - descW / 2, y: cy - elementR - 38,
    size: descSize, font: fonts.interRegular, color: GREY,
  });
}

fs.writeFileSync('bottomseal-variants.pdf', await doc.save());
console.log(`wrote bottomseal-variants.pdf (${doc.getPageCount()} pages)`);
