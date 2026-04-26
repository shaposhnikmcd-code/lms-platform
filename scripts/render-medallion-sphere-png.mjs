/// One-off утиліта: растеризує element-course-bottomseal-sphere.svg у high-res PNG
/// для embedding у course-сертифікат через pdf-lib (який не підтримує radial gradient).
///
/// Запуск: `node scripts/render-medallion-sphere-png.mjs`

import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';

const SRC = 'public/Certificates/element-course-bottomseal-sphere.svg';
const DST_PNG = 'public/Certificates/element-course-bottomseal-sphere.png';
const DST_EMBED = 'public/Certificates/element-medallion-sphere.png';
const SIZE = 1024;

const svg = readFileSync(SRC);
const png = await sharp(svg, { density: 600 })
  .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();
writeFileSync(DST_PNG, png);
writeFileSync(DST_EMBED, png);
console.log(`wrote ${DST_PNG} and ${DST_EMBED} (${SIZE}x${SIZE})`);
