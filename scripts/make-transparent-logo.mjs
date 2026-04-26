/// One-off утиліта: створює logo-transparent.png з logo-white.png прибравши
/// білий фон. Викликається вручну якщо лого змінилось.
///
/// Запуск: `node scripts/make-transparent-logo.mjs`

import sharp from 'sharp';
import fs from 'node:fs';

const SRC = 'public/logo-white.png';
const DST = 'public/logo-transparent.png';

const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const w = info.width;
const h = info.height;
const out = Buffer.from(data);

/// Chromakey: пікселі близькі до білого → alpha 0. Soft threshold для антиаліасингу:
/// чим білішіший піксель, тим прозоріший. Це зберігає згладжені краї букв.
const TH = 250; // повністю прозоро при яскравості ≥250
const FADE = 220; // починаємо знебарвлювати при 220

for (let i = 0; i < out.length; i += 4) {
  const r = out[i];
  const g = out[i + 1];
  const b = out[i + 2];
  const lum = Math.min(r, g, b);
  if (lum >= TH) {
    out[i + 3] = 0;
  } else if (lum >= FADE) {
    /// Soft fade між FADE і TH — alpha від 255 до 0
    const frac = (lum - FADE) / (TH - FADE);
    out[i + 3] = Math.round(255 * (1 - frac));
  }
}

await sharp(out, { raw: { width: w, height: h, channels: 4 } })
  .png()
  .toFile(DST);

console.log(`wrote ${DST}`);
