/// Playground для вибору варіантів small-печатки COURSE-сертифіката.
/// Рендерить 1 PDF-сторінку: 8 seal variants (CS1-CS8) на cream BG (4×2 grid).
///
/// CS1 = поточний production (cream disc + thin gold + gold logo).
/// CS2-CS8 = stained додавання stримання детале́й до base.
///
/// Запуск: `npx tsx scripts/render-course-variants.mjs`

import { PDFDocument } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const variantsUrl = pathToFileURL(path.resolve('lib/certificates/courseElementsVariants.ts')).href;
const elementsUrl = pathToFileURL(path.resolve('lib/certificates/elements.ts')).href;
const fontsUrl = pathToFileURL(path.resolve('lib/certificates/fonts.ts')).href;

const { courseSealVariants } = await import(variantsUrl);
const { c } = await import(elementsUrl);
const { loadFont, loadPublicAsset } = await import(fontsUrl);

const doc = await PDFDocument.create();
doc.registerFontkit(fontkit);

const getFont = async (key) => doc.embedFont(loadFont(key), { subset: false });
const fonts = {
  cormorantItalic: await getFont('cormorantItalic'),
  cormorantBoldItalic: await getFont('cormorantBoldItalic'),
  cormorantRegular: await getFont('cormorantRegular'),
  interRegular: await getFont('interRegular'),
  interMedium: await getFont('interMedium'),
  interSemiBold: await getFont('interSemiBold'),
};
const logoGold = await doc.embedPng(loadPublicAsset('logo-gold.png'));

const CREAM_BG = c({ r: 249, g: 244, b: 232 });
const GREEN = c({ r: 28, g: 58, b: 46 });
const GREY = c({ r: 74, g: 74, b: 66 });

function renderGrid({ items, drawCb, title }) {
  const W = 1500, H = 900;
  const page = doc.addPage([W, H]);
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: CREAM_BG, borderWidth: 0 });

  page.drawText(title, { x: 50, y: H - 50, size: 26, font: fonts.cormorantItalic, color: GREEN });
  page.drawText('Скажи які 1-2 фаворита залишити', {
    x: 50, y: H - 80, size: 12, font: fonts.interMedium, color: GREY,
  });

  const cols = 4, rows = 2;
  const cellW = W / cols;
  const cellH = (H - 130) / rows;
  const elementR = Math.min(cellW, cellH) * 0.30;

  for (let i = 0; i < items.length && i < cols * rows; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = col * cellW + cellW / 2;
    const cy = H - 130 - row * cellH - cellH * 0.42;

    drawCb(items[i].draw, page, cx, cy, elementR);

    page.drawText(items[i].id, {
      x: cx - cellW / 2 + 14, y: cy + cellH * 0.35,
      size: 18, font: fonts.cormorantItalic, color: GREEN,
    });

    const nameSize = 12;
    const nameW = fonts.interSemiBold.widthOfTextAtSize(items[i].name, nameSize);
    page.drawText(items[i].name, {
      x: cx - nameW / 2, y: cy - elementR - 22,
      size: nameSize, font: fonts.interSemiBold, color: GREY,
    });

    const descSize = 9;
    const descW = fonts.interRegular.widthOfTextAtSize(items[i].desc, descSize);
    page.drawText(items[i].desc, {
      x: cx - descW / 2, y: cy - elementR - 38,
      size: descSize, font: fonts.interRegular, color: GREY,
    });
  }
}

renderGrid({
  items: courseSealVariants,
  drawCb: (draw, p, cx, cy, r) => draw(p, fonts, logoGold, cx, cy, r),
  title: 'Course Seal — варіанти CS1-CS8 (на основі CS1 production)',
});

const bytes = await doc.save();
fs.writeFileSync('course-variants.pdf', bytes);
console.log(`wrote course-variants.pdf (${Math.round(bytes.length / 1024)} KB), ${doc.getPageCount()} pages`);
