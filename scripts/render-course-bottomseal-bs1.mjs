/// One-shot: рендерить standalone BS1 bottom-seal медальйона з playground
/// (courseBottomSealVariants[0]) на cream BG (як на main panel COURSE-сертифіката).
/// Запуск: `npx tsx scripts/render-course-bottomseal-bs1.mjs`

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
const { loadFont } = await import(fontsUrl);

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

const bs1 = courseBottomSealVariants.find((v) => v.id === 'BS1');
if (!bs1) throw new Error('BS1 not found in courseBottomSealVariants');

const CREAM_BG = c({ r: 249, g: 244, b: 232 });
const GREEN = c({ r: 28, g: 58, b: 46 });
const GREY = c({ r: 74, g: 74, b: 66 });

const SIZE = 1100;
const page = doc.addPage([SIZE, SIZE]);
page.drawRectangle({ x: 0, y: 0, width: SIZE, height: SIZE, color: CREAM_BG, borderWidth: 0 });

page.drawText('Course Bottom Seal — BS1 (Cormorant Regular base)', {
  x: 60, y: SIZE - 60, size: 28, font: fonts.cormorantItalic, color: GREEN,
});
page.drawText('Coin-style: 2-tone gold rim + double inner ring + side діаманти + curved CERTIFIED · 2026', {
  x: 60, y: SIZE - 95, size: 13, font: fonts.interMedium, color: GREY,
});

/// Hero size — великий медальйон по центру для preview / hi-res asset
bs1.draw(page, fonts, SIZE / 2, SIZE / 2 - 30, 340);

const outPdf = 'public/Certificates/element-course-bottomseal-bs1.pdf';
fs.writeFileSync(outPdf, await doc.save());
console.log(`wrote ${outPdf}`);
