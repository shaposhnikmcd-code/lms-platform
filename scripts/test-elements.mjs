/// Playground для пошуку фінального дизайну елементів сертифіката.
/// Рендерить:
///   Page 1 — 8 медальйонів (4×2)
///   Page 2 — Seals S1-S8 (4×2)
///   Page 3 — Seals S9-S16 (4×2)
///
/// Запуск: `npx tsx scripts/test-elements.mjs`

import { PDFDocument } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const variantsUrl = pathToFileURL(path.resolve('lib/certificates/elementsVariants.ts')).href;
const elementsUrl = pathToFileURL(path.resolve('lib/certificates/elements.ts')).href;
const fontsUrl = pathToFileURL(path.resolve('lib/certificates/fonts.ts')).href;
const { medallionVariants, sealVariants } = await import(variantsUrl);
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
const logoPng = await doc.embedPng(loadPublicAsset('logo-transparent.png'));

const CREAM_BG = c({ r: 249, g: 244, b: 232 });
const GREEN = c({ r: 28, g: 58, b: 46 });
const GREY = c({ r: 74, g: 74, b: 66 });

function renderGrid(page, items, drawFn, pageTitle, isSeal = false) {
  const W = page.getWidth();
  const H = page.getHeight();
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: CREAM_BG, borderWidth: 0 });

  page.drawText(pageTitle, {
    x: 50, y: H - 50,
    size: 26, font: fonts.cormorantItalic, color: GREEN,
  });
  page.drawText('Скажи якi V-номери лишити (можна по 2-3 фаворита)', {
    x: 50, y: H - 80,
    size: 12, font: fonts.interMedium, color: GREY,
  });

  const cols = 4;
  const rows = 2;
  const cellW = W / cols;
  const cellH = (H - 130) / rows;
  const elementR = Math.min(cellW, cellH) * 0.32;

  for (let i = 0; i < items.length && i < cols * rows; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = col * cellW + cellW / 2;
    const cy = H - 130 - row * cellH - cellH * 0.42;

    drawFn(items[i].draw, page, cx, cy, elementR);

    /// ID badge ліворуч-зверху клітинки
    const idText = items[i].id;
    const idSize = 16;
    page.drawText(idText, {
      x: cx - cellW / 2 + 14, y: cy + cellH * 0.35,
      size: idSize, font: fonts.cormorantItalic, color: GREEN,
    });

    /// Назва
    const nameText = items[i].name;
    const nameSize = 11;
    const nameW = fonts.interSemiBold.widthOfTextAtSize(nameText, nameSize);
    page.drawText(nameText, {
      x: cx - nameW / 2,
      y: cy - elementR - 18,
      size: nameSize, font: fonts.interSemiBold, color: GREY,
    });

    /// Опис
    const descText = items[i].desc;
    const descSize = 8.5;
    const descW = fonts.interRegular.widthOfTextAtSize(descText, descSize);
    page.drawText(descText, {
      x: cx - descW / 2,
      y: cy - elementR - 32,
      size: descSize, font: fonts.interRegular, color: GREY,
    });
  }
}

/// Page 1: Medallions
const page1 = doc.addPage([1500, 900]);
renderGrid(page1, medallionVariants, (drawFn, p, cx, cy, r) => drawFn(p, fonts, logoPng, cx, cy, r),
  'Medallion variants — UIMP', false);

/// Page 2: Seals S1-S8 (original)
const page2 = doc.addPage([1500, 900]);
renderGrid(page2, sealVariants.slice(0, 8), (drawFn, p, cx, cy, r) => drawFn(p, fonts, logoPng, cx, cy, r, 2026),
  'Seal variants — UIMP (page 1 — S1-S8)', true);

/// Page 3: Seals S9-S16 (color/shape variants)
const page3 = doc.addPage([1500, 900]);
renderGrid(page3, sealVariants.slice(8, 16), (drawFn, p, cx, cy, r) => drawFn(p, fonts, logoPng, cx, cy, r, 2026),
  'Seal variants — UIMP (page 2 — S9-S16)', true);

/// Page 4: Seals S17-S24 (typography/layout variants на базі S7)
const page4 = doc.addPage([1500, 900]);
renderGrid(page4, sealVariants.slice(16, 24), (drawFn, p, cx, cy, r) => drawFn(p, fonts, logoPng, cx, cy, r, 2026),
  'Seal variants — UIMP (page 3 — S17-S24, typography focus)', true);

/// Page 5: Seals S25-S32 (кардинально різні форми/матеріали)
const page5 = doc.addPage([1500, 900]);
renderGrid(page5, sealVariants.slice(24, 32), (drawFn, p, cx, cy, r) => drawFn(p, fonts, logoPng, cx, cy, r, 2026),
  'Seal variants — UIMP (page 4 — S25-S32, кардинально різні форми)', true);

/// Page 6: Seals S33-S40 (geometric / decorative)
const page6 = doc.addPage([1500, 900]);
renderGrid(page6, sealVariants.slice(32, 40), (drawFn, p, cx, cy, r) => drawFn(p, fonts, logoPng, cx, cy, r, 2026),
  'Seal variants — UIMP (page 5 — S33-S40, geometric / decorative)', true);

/// Page 7: Seals S41-S48 (3D solid disc + heavy UIMP, без inner highlight)
const page7 = doc.addPage([1500, 900]);
renderGrid(page7, sealVariants.slice(40, 48), (drawFn, p, cx, cy, r) => drawFn(p, fonts, logoPng, cx, cy, r, 2026),
  'Seal variants — UIMP (page 6 — S41-S48, 3D solid + heavy UIMP)', true);

/// Page 8: HERO — S49 polished, single large render для перегляду деталей
const page8 = doc.addPage([1100, 1100]);
page8.drawRectangle({ x: 0, y: 0, width: 1100, height: 1100, color: CREAM_BG, borderWidth: 0 });
page8.drawText('S49 — Senior Designer Polished', {
  x: 60, y: 1040, size: 28, font: fonts.cormorantItalic, color: GREEN,
});
page8.drawText('Refined S42: heavier UIMP (13-pass perimeter) + diagonal gold sheen', {
  x: 60, y: 1005, size: 13, font: fonts.interMedium, color: GREY,
});
const heroVariant = sealVariants.find((v) => v.id === 'S49');
heroVariant.draw(page8, fonts, logoPng, 550, 530, 380, 2026);

const bytes = await doc.save();
fs.writeFileSync('test-elements.pdf', bytes);
console.log(`wrote test-elements.pdf (${Math.round(bytes.length / 1024)} KB), ${doc.getPageCount()} pages`);
