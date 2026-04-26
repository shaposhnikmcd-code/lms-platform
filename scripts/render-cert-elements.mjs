/// Standalone preview-renderer для production декоративних елементів сертифікатів.
/// Кожна сторінка PDF містить ОДИН великий "hero" render елемента + назва і
/// опис, з якого сертифіката він використовується.
///
/// Output: cert-elements.pdf (4 сторінки), використовується разом з pdf-to-img
/// для конвертації в окремі PNG: yearly-medallion-M4.png, yearly-seal-S49.png,
/// course-medallion.png, course-seal.png.
///
/// Запуск: `npx tsx scripts/render-cert-elements.mjs`

import { PDFDocument } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const elementsUrl = pathToFileURL(path.resolve('lib/certificates/elements.ts')).href;
const variantsUrl = pathToFileURL(path.resolve('lib/certificates/elementsVariants.ts')).href;
const courseElUrl = pathToFileURL(path.resolve('lib/certificates/courseElements.ts')).href;
const fontsUrl = pathToFileURL(path.resolve('lib/certificates/fonts.ts')).href;

const { c, drawSeal: yearlySeal } = await import(elementsUrl);
/// M4 беремо саме з playground-варіанту (medallionVariants[3]) — щоб standalone
/// виглядав 1:1 як на test-elements-p1.png, де користувач його обирав.
const { medallionVariants } = await import(variantsUrl);
const yearlyMedallionM4 = medallionVariants.find((v) => v.id === 'M4').draw;
const { drawSidebarMedallion, drawSmallSeal, SIDEBAR_GREEN } = await import(courseElUrl);
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
const GREEN_TXT = c({ r: 28, g: 58, b: 46 });
const GREY = c({ r: 74, g: 74, b: 66 });

function addHeroPage({ title, subtitle, draw, bg }) {
  const SIZE = 1100;
  const page = doc.addPage([SIZE, SIZE]);
  page.drawRectangle({ x: 0, y: 0, width: SIZE, height: SIZE, color: bg ?? CREAM_BG, borderWidth: 0 });
  page.drawText(title, { x: 60, y: SIZE - 60, size: 28, font: fonts.cormorantItalic, color: GREEN_TXT });
  page.drawText(subtitle, { x: 60, y: SIZE - 95, size: 13, font: fonts.interMedium, color: GREY });
  draw(page, SIZE / 2, SIZE / 2 - 30);
}

/// Page 1 — Yearly medallion (M4 Olive Wreath) — playground варіант, як на test-elements-p1
addHeroPage({
  title: 'M4 — Olive Wreath',
  subtitle: 'Медальйон сертифіката Річної програми (practical / listener) — cream диск + тонка gold-рамка + UIMP лого',
  draw: (p, cx, cy) => yearlyMedallionM4(p, fonts, logoPng, cx, cy, 380),
});

/// Page 2 — Yearly seal (S49 Senior Designer Polished, refined production)
addHeroPage({
  title: 'S49 — Senior Designer Polished',
  subtitle: 'Печатка сертифіката Річної програми (practical / listener) — green wax + 7-layer 3D extrusion + CERTIFIED · 2026',
  draw: (p, cx, cy) => yearlySeal(p, fonts, logoPng, cx, cy, 380, 2026),
});

/// Page 3 — Course sidebar medallion (U-monogram)
addHeroPage({
  title: 'Sidebar Medallion — U Monogram',
  subtitle: 'Великий медальйон у green sidebar сертифіката Курсу — gold ring + dotted ring + cream "U" Cormorant Italic',
  bg: c(SIDEBAR_GREEN),
  draw: (p, cx, cy) => drawSidebarMedallion(p, fonts, cx, cy, 320),
});

/// Page 4 — Course small seal (UIMP caps)
addHeroPage({
  title: 'Small Seal — UIMP',
  subtitle: 'Маленька gold-печатка у нижньому центрі сертифіката Курсу — gold disc + UIMP caps Inter SemiBold',
  draw: (p, cx, cy) => drawSmallSeal(p, fonts, cx, cy, 200),
});

const bytes = await doc.save();
fs.writeFileSync('cert-elements.pdf', bytes);
console.log(`wrote cert-elements.pdf (${Math.round(bytes.length / 1024)} KB), ${doc.getPageCount()} pages`);
