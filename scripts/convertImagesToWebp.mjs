#!/usr/bin/env node
/**
 * One-time script: конвертує великі PNG/JPG у public/ у WebP з якістю 85.
 * Зберігає .webp поряд з оригіналом. Оригінал не чіпаємо — чистить окремо вручну
 * після того як я заміню посилання в коді.
 *
 * Usage: node scripts/convertImagesToWebp.mjs
 */

import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

const PUBLIC_DIR = 'public';
const MIN_SIZE_BYTES = 500 * 1024; // конвертуємо лише > 500 KB

/** Рекурсивний обхід тек. */
async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(full);
    else yield full;
  }
}

const isTargetImage = (file) => {
  const ext = path.extname(file).toLowerCase();
  return ext === '.png' || ext === '.jpg' || ext === '.jpeg';
};

async function main() {
  const results = [];
  for await (const file of walk(PUBLIC_DIR)) {
    if (!isTargetImage(file)) continue;
    const stat = await fs.stat(file);
    if (stat.size < MIN_SIZE_BYTES) continue;

    const webpPath = file.replace(/\.(png|jpe?g)$/i, '.webp');

    // Skip, якщо .webp вже існує та свіжий
    try {
      const webpStat = await fs.stat(webpPath);
      if (webpStat.mtimeMs >= stat.mtimeMs) {
        results.push({ file, skipped: 'already-converted', newSize: webpStat.size });
        continue;
      }
    } catch {
      // .webp не існує — конвертуємо
    }

    try {
      const info = await sharp(file)
        .webp({ quality: 85, effort: 6 })
        .toFile(webpPath);
      results.push({
        file,
        webp: webpPath,
        oldSize: stat.size,
        newSize: info.size,
        ratio: (info.size / stat.size).toFixed(2),
      });
    } catch (e) {
      results.push({ file, error: e.message });
    }
  }

  console.log('\nConversion report:\n');
  let totalOld = 0;
  let totalNew = 0;
  for (const r of results) {
    if (r.error) {
      console.log(`  ❌ ${r.file} — ${r.error}`);
    } else if (r.skipped) {
      console.log(`  ⊘  ${r.file} (${r.skipped})`);
    } else {
      totalOld += r.oldSize;
      totalNew += r.newSize;
      const oldKb = (r.oldSize / 1024).toFixed(0);
      const newKb = (r.newSize / 1024).toFixed(0);
      console.log(`  ✓  ${r.file}  ${oldKb}KB → ${newKb}KB  (${r.ratio}×)`);
    }
  }
  const saved = ((totalOld - totalNew) / 1024 / 1024).toFixed(1);
  const totalOldMb = (totalOld / 1024 / 1024).toFixed(1);
  const totalNewMb = (totalNew / 1024 / 1024).toFixed(1);
  console.log(`\n  Total: ${totalOldMb}MB → ${totalNewMb}MB  (saved ${saved}MB)\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
