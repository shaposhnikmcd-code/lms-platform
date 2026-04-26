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

const svgBuf = readFileSync(SRC);

/// Preview PNG — з зеленим фоном (як виглядає у плейграунді)
const pngPreview = await sharp(svgBuf, { density: 600 })
  .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();
writeFileSync(DST_PNG, pngPreview);

/// Embed PNG — БЕЗ фону (буде накладатись на sidebar який і так зелений).
/// Видаляємо <rect ... fill="url(#bg)"/> з SVG перед растером.
const svgNoBg = svgBuf.toString('utf8').replace(/<rect[^>]*fill="url\(#bg\)"[^>]*\/>/, '');
const pngEmbed = await sharp(Buffer.from(svgNoBg), { density: 600 })
  .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();
writeFileSync(DST_EMBED, pngEmbed);

console.log(`wrote ${DST_PNG} (з фоном) і ${DST_EMBED} (transparent) — ${SIZE}x${SIZE}`);
