/// One-shot: рендерить standalone hero CS4 медальйона з production-коду
/// (drawSidebarMedallion + gold logo) на dark green BG (як у sidebar-і).
/// Запуск: `npx tsx scripts/render-course-medallion.mjs`

import { PDFDocument } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const courseElUrl = pathToFileURL(path.resolve('lib/certificates/courseElements.ts')).href;
const elementsUrl = pathToFileURL(path.resolve('lib/certificates/elements.ts')).href;
const fontsUrl = pathToFileURL(path.resolve('lib/certificates/fonts.ts')).href;

const { drawSidebarMedallion } = await import(courseElUrl);
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
};
const logoGold = await doc.embedPng(loadPublicAsset('logo-gold.png'));

const SIZE = 1100;
const page = doc.addPage([SIZE, SIZE]);
/// Dark green BG (як у sidebar-і — щоб точно показати як медальйон виглядає в контексті)
page.drawRectangle({ x: 0, y: 0, width: SIZE, height: SIZE, color: c({ r: 18, g: 43, b: 34 }), borderWidth: 0 });

page.drawText('Course Medallion — CS4 Inner Hairline', {
  x: 60, y: SIZE - 60, size: 28, font: fonts.cormorantItalic, color: c({ r: 235, g: 202, b: 128 }),
});
page.drawText('Sidebar medallion сертифіката Курсу — cream диск + thin gold ring + inner hairline + gold UIMP лого', {
  x: 60, y: SIZE - 95, size: 13, font: fonts.interMedium, color: c({ r: 200, g: 200, b: 190 }),
});

drawSidebarMedallion(page, fonts, SIZE / 2, SIZE / 2 - 30, 320, logoGold);

fs.writeFileSync('course-medallion.pdf', await doc.save());
console.log('wrote course-medallion.pdf');
