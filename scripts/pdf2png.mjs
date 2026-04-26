/// PDF→PNG converter via pdfjs-dist + @napi-rs/canvas (server-side rendering).
/// Usage: node scripts/pdf2png.mjs <pdf-path> <out-png-path>

import fs from 'node:fs';
import path from 'node:path';
import { createCanvas } from '@napi-rs/canvas';

/// pdfjs-dist legacy build для Node.js
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

const [, , pdfPath, outPath] = process.argv;
if (!pdfPath || !outPath) {
  console.error('Usage: node scripts/pdf2png.mjs <pdf> <out.png> [scale]');
  process.exit(1);
}
const scale = Number(process.argv[4] || 2);

const data = new Uint8Array(fs.readFileSync(path.resolve(pdfPath)));
const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
const page = await doc.getPage(1);
const viewport = page.getViewport({ scale });
const canvas = createCanvas(viewport.width, viewport.height);
const ctx = canvas.getContext('2d');
await page.render({ canvasContext: ctx, viewport, canvas }).promise;
fs.writeFileSync(path.resolve(outPath), canvas.toBuffer('image/png'));
console.log(`wrote ${outPath} (${viewport.width}x${viewport.height})`);
