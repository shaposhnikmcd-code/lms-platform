/// Декоративні елементи сертифіката UIMP — медальйон і золота печатка.
///
/// `drawMedallion` (M4 — Olive Wreath) рендериться зверху сертифіката над
/// заголовком "UIMP". `drawSeal` (S49 — Senior Designer Polished) — велика
/// зелено-золота печатка по центру-знизу. Обидві функції приймають центр і
/// радіус, тож позиціонує їх drawTemplate.ts.
///
/// Винесено окремо, щоб ітерувати на дизайні через scripts/test-elements.mjs
/// без регенерації цілого сертифіката.

import { PDFFont, PDFImage, PDFPage, degrees, rgb } from 'pdf-lib';
import type { FontKey } from './fonts';

/* ----- Brand tokens ----- */

export const GREEN = { r: 28, g: 58, b: 46 };
export const GREEN_DEEP = { r: 18, g: 44, b: 34 };
export const GOLD = { r: 184, g: 139, b: 60 };
export const GOLD_LIGHT = { r: 218, g: 174, b: 76 };
export const GOLD_DEEP = { r: 142, g: 100, b: 36 };
export const GOLD_PALE = { r: 235, g: 202, b: 128 };
export const CREAM = { r: 250, g: 245, b: 232 };
export const CREAM_DEEP = { r: 244, g: 234, b: 216 };

/// Локальні wax-токени для S49 (темно-зелений віск з beveled edge).
const WAX_GREEN_EDGE = { r: 11, g: 30, b: 23 };
const WAX_GREEN_BODY = { r: 22, g: 50, b: 38 };
const WAX_GREEN_BEVEL_LIT = { r: 50, g: 82, b: 68 };

export function c(col: { r: number; g: number; b: number }) {
  return rgb(col.r / 255, col.g / 255, col.b / 255);
}

/* ======================================================================= */
/*                          MEDALLION — M4 Olive Wreath                    */
/* ======================================================================= */

/// Cream-диск з золотою тонкою рамкою, кільцем з 18 листоподібних "diamond"
/// орнаментів навколо периметру і великим UIMP лого центром.
///
/// @param cx, cy   центр у pt
/// @param radius   зовнішній радіус cream-кола
/// @param logoPng  embed UIMP logo (logo-transparent.png — alpha cleared)
export function drawMedallion(
  page: PDFPage,
  _fonts: Record<FontKey, PDFFont>,
  logoPng: PDFImage,
  cx: number,
  cy: number,
  radius: number,
) {
  /// Cream disc base
  page.drawCircle({ x: cx, y: cy, size: radius, color: c(CREAM), borderWidth: 0 });
  /// Тонка золота рамка по краю
  page.drawCircle({
    x: cx, y: cy, size: radius - 0.5,
    borderColor: c(GOLD), borderWidth: 1.0, color: c(CREAM),
  });

  /// UIMP лого центром (target-розмір трохи менший за вільний внутрішній простір)
  drawLogo(page, logoPng, cx, cy, (radius - radius * 0.255) * 1.5);
}

/* ======================================================================= */
/*                          SEAL — S49 Senior Designer Polished            */
/* ======================================================================= */

/// Темно-зелений wax-disc з 2-tone золотою рамкою, монументальним "UIMP"
/// (Cormorant Regular з 12-шаровим 3D extrusion + 32-pass перимет ом для
/// масивності), горизонтальним gold divider-ом з центральною перлиною та
/// stacked CERTIFIED + рік курсивом.
///
/// @param cx, cy    центр печатки
/// @param r         зовнішній радіус (overall size)
/// @param logoPng   не використовується (S49 типографіко-центрична, без лого)
/// @param year      рік курсивом під CERTIFIED (опціонально)
export function drawSeal(
  page: PDFPage,
  fonts: Record<FontKey, PDFFont>,
  _logoPng: PDFImage,
  cx: number,
  cy: number,
  r: number,
  year?: number,
) {
  /// === Disc base (S42-наслідник: green wax + gold rim, без inner highlight) ===

  /// М'яка drop shadow — 7 розпорошених шарів
  for (let i = 0; i < 7; i++) {
    page.drawCircle({
      x: cx, y: cy - i * 0.9, size: r + 4 - i * 0.5,
      color: rgb(0, 0, 0), borderWidth: 0, opacity: 0.045,
    });
  }

  /// 2-tone gold rim (deep знизу + pale зверху + main center)
  page.drawCircle({ x: cx, y: cy - 0.9, size: r + 1.8, color: c(GOLD_DEEP), borderWidth: 0 });
  page.drawCircle({ x: cx, y: cy + 0.9, size: r + 1.8, color: c(GOLD_PALE), borderWidth: 0 });
  page.drawCircle({ x: cx, y: cy, size: r + 1.2, color: c(GOLD), borderWidth: 0 });

  /// 3D bevel — light top edge + dark bottom edge
  page.drawCircle({ x: cx, y: cy - 1.5, size: r, color: c(WAX_GREEN_EDGE), borderWidth: 0 });
  page.drawCircle({ x: cx, y: cy + 1.5, size: r, color: c(WAX_GREEN_BEVEL_LIT), borderWidth: 0 });

  /// Solid green body (НЕ робимо internal highlight — без "circle-in-circle")
  page.drawCircle({ x: cx, y: cy, size: r - 1.8, color: c(WAX_GREEN_BODY), borderWidth: 0 });

  /// === UIMP — Cormorant Regular з 3D extrusion та heavy perimeter ===
  /// Hierarchy: huge UIMP → break → small CERTIFIED → italic year.

  const text = 'UIMP';
  const size = r * 0.62;
  const font = fonts.cormorantRegular;
  const tracking = r * 0.05;

  const widths: number[] = [];
  let totalW = 0;
  for (const ch of text) {
    const w = font.widthOfTextAtSize(ch, size);
    widths.push(w);
    totalW += w + tracking;
  }
  totalW -= tracking;
  const x0 = cx - totalW / 2;
  /// Дещо нижче геометричного центру — лишає простір для CERTIFIED + року нижче
  const baseY = cy - r * 0.07;

  const drawTracked = (offsetX: number, offsetY: number, color: ReturnType<typeof rgb>) => {
    let xc = x0;
    for (let i = 0; i < text.length; i++) {
      page.drawText(text[i], {
        x: xc + offsetX, y: baseY + offsetY,
        size, font, color,
      });
      xc += widths[i] + tracking;
    }
  };

  /// 7-layer 3D extrusion (down-right offset, gradient від GOLD_DEEP до GOLD).
  /// Менший depth + менший зсув на шар → стриманіша глибина без "розмазаності".
  const extrusionDepth = 7;
  for (let i = extrusionDepth; i >= 1; i--) {
    const t = (extrusionDepth - i) / extrusionDepth;
    const layerColor = c({
      r: Math.round(GOLD_DEEP.r + (GOLD.r - GOLD_DEEP.r) * t * 0.7),
      g: Math.round(GOLD_DEEP.g + (GOLD.g - GOLD_DEEP.g) * t * 0.7),
      b: Math.round(GOLD_DEEP.b + (GOLD.b - GOLD_DEEP.b) * t * 0.7),
    });
    drawTracked(i * 0.42, -i * 0.34, layerColor);
  }

  /// Тонкий 16-pass перимет (2 кільця × 8 напрямків, лише 0.45 та 0.20pt) —
  /// дає чисті едж без розмиття. Без тяжких 1.30/0.85pt-кілець.
  const dirs8: Array<[number, number]> = [
    [0, 1], [0.71, 0.71], [1, 0], [0.71, -0.71],
    [0, -1], [-0.71, -0.71], [-1, 0], [-0.71, 0.71],
  ];
  for (const [dx, dy] of dirs8) drawTracked(dx * 0.40, dy * 0.40, c(GOLD));
  for (const [dx, dy] of dirs8) drawTracked(dx * 0.18, dy * 0.18, c(GOLD));

  /// Top-left highlight — pale gold rim-light
  drawTracked(-0.5, 0.6, c(GOLD_PALE));

  /// Final main face (зверху всіх extrusion-шарів)
  drawTracked(0, 0, c(GOLD));

  /// === Ornament — clean horizontal gold divider з end-caps та центральною перлиною ===

  const ornY = cy - r * 0.46;
  page.drawLine({
    start: { x: cx - r * 0.36, y: ornY },
    end: { x: cx + r * 0.36, y: ornY },
    thickness: 0.7, color: c(GOLD), opacity: 0.85,
  });
  page.drawCircle({ x: cx - r * 0.36, y: ornY, size: 1.4, color: c(GOLD), borderWidth: 0 });
  page.drawCircle({ x: cx + r * 0.36, y: ornY, size: 1.4, color: c(GOLD), borderWidth: 0 });

  /// Центральна "перлина" — halo + core + highlight
  page.drawCircle({ x: cx, y: ornY - 0.3, size: 4.5, color: c(GOLD_DEEP), borderWidth: 0, opacity: 0.5 });
  page.drawCircle({ x: cx, y: ornY, size: 3.2, color: c(GOLD), borderWidth: 0 });
  page.drawCircle({ x: cx, y: ornY + 0.4, size: 1.6, color: c(GOLD_PALE), borderWidth: 0 });

  /// === CERTIFIED — Inter Regular tracked small caps ===

  const certText = 'CERTIFIED';
  const certSize = r * 0.085;
  const certFont = fonts.interRegular;
  const certTracking = r * 0.045;
  const certY = cy - r * 0.58;

  const certWidths: number[] = [];
  let certTotalW = 0;
  for (const ch of certText) {
    const w = certFont.widthOfTextAtSize(ch, certSize);
    certWidths.push(w);
    certTotalW += w + certTracking;
  }
  certTotalW -= certTracking;
  let certX = cx - certTotalW / 2;
  for (let i = 0; i < certText.length; i++) {
    page.drawText(certText[i], { x: certX, y: certY, size: certSize, font: certFont, color: c(GOLD) });
    certX += certWidths[i] + certTracking;
  }

  /// === Year — Cormorant Italic numerals, окремий рядок під CERTIFIED ===

  if (year) {
    const yearStr = String(year);
    const yearSize = r * 0.13;
    const yearFont = fonts.cormorantItalic;
    const yearY = cy - r * 0.74;
    const yearW = yearFont.widthOfTextAtSize(yearStr, yearSize);

    /// Subtle 2-pass embossed (тіньовий шар + основний)
    page.drawText(yearStr, {
      x: cx - yearW / 2 + 0.5, y: yearY - 0.4,
      size: yearSize, font: yearFont, color: c(GOLD_DEEP),
    });
    page.drawText(yearStr, {
      x: cx - yearW / 2, y: yearY,
      size: yearSize, font: yearFont, color: c(GOLD),
    });
  }
}

/* ----------------------------------------------------------------------- */
/*                          Helpers                                        */
/* ----------------------------------------------------------------------- */

function drawLogo(page: PDFPage, logoPng: PDFImage, cx: number, cy: number, targetSize: number) {
  const aspect = logoPng.height / logoPng.width;
  const w = targetSize;
  const h = targetSize * aspect;
  page.drawImage(logoPng, { x: cx - w / 2, y: cy - h / 2, width: w, height: h });
}

/// Орієнтована "leaf"-форма — rotated rectangle (short×long), центр у (cx,cy),
/// повернута на angle (радіани). Використовується в M4 для 18 листочків.
///
/// Реалізовано через drawRectangle (а не drawSvgPath), бо pdf-to-img / PDF.js
/// має баг рендеру drawSvgPath quadrilaterals — у preview-PNG вони не видно
/// (хоча у справжньому Acrobat-вьюері рендеряться). drawRectangle працює всюди.
function drawOrientedDiamond(
  page: PDFPage,
  cx: number,
  cy: number,
  long: number,
  short: number,
  angle: number,
  color: ReturnType<typeof rgb>,
) {
  const w = short * 2;
  const h = long * 2;
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  /// pdf-lib обертає прямокутник навколо його BL-кута. Щоб obernути навколо
  /// центру, обчислюємо BL-кут після rotation+translation:
  ///   BL_rotated = (cx - w/2 · cos(a) + h/2 · sin(a), cy - w/2 · sin(a) - h/2 · cos(a))
  const blX = cx - (w / 2) * ca + (h / 2) * sa;
  const blY = cy - (w / 2) * sa - (h / 2) * ca;
  page.drawRectangle({
    x: blX, y: blY,
    width: w, height: h,
    rotate: degrees((angle * 180) / Math.PI),
    color, borderWidth: 0,
  });
}
