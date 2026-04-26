/// One-off утиліта: створює logo-gold.png з logo-transparent.png — фарбує
/// всі непрозорі пікселі у брендовий gold (184, 139, 60), зберігаючи alpha
/// та анти-аліасинг країв.
///
/// Запуск: `node scripts/make-gold-logo.mjs`

import sharp from 'sharp';

const SRC = 'public/logo-transparent.png';
const DST = 'public/logo-gold.png';

const GOLD = { r: 184, g: 139, b: 60 };

const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const w = info.width;
const h = info.height;
const out = Buffer.from(data);

/// Шукаємо bounding box основного лого (де alpha > 0, але виключаючи тонкі
/// вертикальні артефакти у crop-edge області). Ігноруємо лівий 5% і правий 5%
/// при пошуку bbox — потім zero-alpha для всього поза bbox.
const margin = Math.floor(w * 0.05);
let minX = w, maxX = 0, minY = h, maxY = 0;
for (let y = 0; y < h; y++) {
  for (let x = margin; x < w - margin; x++) {
    const i = (y * w + x) * 4;
    if (out[i + 3] > 10) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}

/// Перефарбовуємо в gold і прибираємо все поза bbox (видалить вертикальну
/// риску артефакт у правому краю файлу).
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (x < minX || x > maxX || y < minY || y > maxY) {
      out[i + 3] = 0;
      continue;
    }
    if (out[i + 3] > 0) {
      out[i] = GOLD.r;
      out[i + 1] = GOLD.g;
      out[i + 2] = GOLD.b;
    }
  }
}

await sharp(out, { raw: { width: w, height: h, channels: 4 } })
  .png()
  .toFile(DST);

console.log(`wrote ${DST}`);
