/// Декоративні елементи COURSE-сертифіката (двопанельний layout: green sidebar
/// + cream main panel). Винесено окремо від `elements.ts`, бо дизайн
/// принципово інший від yearly (де M4 + S49 на одно-панельному cream).
///
/// Усі функції приймають центр і розмір — позиціонування у `drawCourseTemplate.ts`.

import { PDFFont, PDFImage, PDFPage, rgb } from 'pdf-lib';
import type { FontKey } from './fonts';
import {
  GOLD, GOLD_LIGHT, GOLD_DEEP, GOLD_PALE, CREAM, c,
} from './elements';

/* ----- Sidebar tokens ----- */

/// Темно-зелений основного фону sidebar-у. Темніший за brand GREEN, бо
/// це фон під який ми кладемо світлі gold елементи.
export const SIDEBAR_GREEN = { r: 16, g: 40, b: 32 };
/// На пів-тону темніший — для вертикальної декоративної смуги (depth)
export const SIDEBAR_GREEN_DEEP = { r: 10, g: 28, b: 22 };
/// Хайлайт-смуга sidebar-у — на пів-тону світліший
export const SIDEBAR_GREEN_LIT = { r: 28, g: 56, b: 46 };

/* ======================================================================= */
/*                       SIDEBAR MEDALLION                                 */
/* ======================================================================= */

/// Великий медальйон у центрі sidebar-у — minimalist CS4 "Outline Only":
/// cream диск + тонке gold-кільце + gold-tinted UIMP логотип центром.
///
/// @param cx, cy       центр у pt
/// @param r            зовнішній радіус (overall size)
/// @param logoGoldPng  опційно — gold-tinted PNG логотипа (якщо не передано,
///                     fallback на UIMP caps текстом)
export function drawSidebarMedallion(
  page: PDFPage,
  fonts: Record<FontKey, PDFFont>,
  cx: number,
  cy: number,
  r: number,
  logoGoldPng?: PDFImage,
) {
  /// CS4 "Inner Hairline" — cream + crisp gold stroke + друга тонша concentric
  /// лінія всередині (engraved double-frame).
  page.drawCircle({
    x: cx, y: cy, size: r,
    color: c(CREAM),
    borderColor: c(GOLD), borderWidth: 1.8,
  });
  page.drawCircle({
    x: cx, y: cy, size: r - r * 0.07,
    borderColor: c(GOLD_DEEP), borderWidth: 0.5,
    color: c(CREAM),
  });

  if (logoGoldPng) {
    /// Gold UIMP лого центром (трохи менше — лишає room для inner hairline)
    const targetW = r * 1.10;
    const aspect = logoGoldPng.height / logoGoldPng.width;
    page.drawImage(logoGoldPng, {
      x: cx - targetW / 2,
      y: cy - (targetW * aspect) / 2,
      width: targetW, height: targetW * aspect,
    });
  } else {
    /// Fallback — UIMP tracked caps gold
    const text = 'UIMP';
    const font = fonts.cormorantRegular;
    const size = r * 0.42;
    const tracking = r * 0.04;
    const widths: number[] = [];
    let totalW = 0;
    for (const ch of text) {
      const w = font.widthOfTextAtSize(ch, size);
      widths.push(w);
      totalW += w + tracking;
    }
    totalW -= tracking;
    const baseY = cy - size * 0.30;
    let x = cx - totalW / 2;
    for (let i = 0; i < text.length; i++) {
      page.drawText(text[i], { x, y: baseY, size, font, color: c(GOLD) });
      x += widths[i] + tracking;
    }
  }
}

/* ======================================================================= */
/*                       SMALL SEAL (footer)                               */
/* ======================================================================= */

/// Sphere seal — embedає растерізований SVG медальйон (золота куля з градієнтом
/// + UIMP темно-зеленим). PNG генерується скриптом `render-medallion-sphere-png.mjs`.
/// SVG bbox = 400×400, disc радіус = 180, тому реальний размір медальйона
/// = 90% від bbox. Drop-shadow виходить за межі диска ~5%.
export function drawSphereSeal(
  page: PDFPage,
  medallionSpherePng: PDFImage,
  cx: number,
  cy: number,
  r: number,
) {
  const size = (r / 0.9) * 2;
  page.drawImage(medallionSpherePng, {
    x: cx - size / 2,
    y: cy - size / 2,
    width: size,
    height: size,
  });
}

/// Маленька gold печатка з "UIMP" caps усередині. Положення — у нижньому
/// центральному блоці сертифіката, між підписом і роком видачі.
///
/// @param cx, cy   центр у pt
/// @param r        радіус (overall size — typically 18-22pt)
export function drawSmallSeal(
  page: PDFPage,
  fonts: Record<FontKey, PDFFont>,
  cx: number,
  cy: number,
  r: number,
) {
  /// Soft drop shadow
  for (let i = 0; i < 3; i++) {
    page.drawCircle({
      x: cx, y: cy - i * 0.5,
      size: r + 1.2 - i * 0.3,
      color: rgb(0, 0, 0), borderWidth: 0, opacity: 0.08,
    });
  }

  /// 2-tone gold rim
  page.drawCircle({ x: cx, y: cy - 0.6, size: r + 0.7, color: c(GOLD_DEEP), borderWidth: 0 });
  page.drawCircle({ x: cx, y: cy + 0.6, size: r + 0.7, color: c(GOLD_PALE), borderWidth: 0 });
  page.drawCircle({ x: cx, y: cy, size: r, color: c(GOLD), borderWidth: 0 });

  /// Тонке внутрішнє кільце (engraved-look)
  page.drawCircle({
    x: cx, y: cy, size: r - r * 0.14,
    borderColor: c(GOLD_DEEP), borderWidth: 0.5, color: c(GOLD),
  });

  /// "UIMP" caps по центру з wax-press emboss (літери виглядають "пресованими"
  /// у gold поверхню — тонка тінь зверху-зліва + main face).
  drawWaxPressedUIMP(page, fonts.russoOne, cx, cy, r * 0.38, 0.8, c(SIDEBAR_GREEN));
}

/// Wax-pressed UIMP — subtle emboss що імітує літери пресовані у royal-seal
/// wax. Пара pass-ів (внутрішня тінь + main face) дає reliefний вигляд.
export function drawWaxPressedUIMP(
  page: PDFPage,
  font: PDFFont,
  cx: number,
  cy: number,
  size: number,
  tracking: number,
  faceColor: ReturnType<typeof rgb>,
) {
  const text = 'UIMP';
  const widths: number[] = [];
  let totalW = 0;
  for (const ch of text) {
    const w = font.widthOfTextAtSize(ch, size);
    widths.push(w);
    totalW += w + tracking;
  }
  totalW -= tracking;
  const baseY = cy - size * 0.34;

  const drawAt = (offX: number, offY: number, color: ReturnType<typeof rgb>) => {
    let xc = cx - totalW / 2;
    for (let i = 0; i < text.length; i++) {
      page.drawText(text[i], { x: xc + offX, y: baseY + offY, size, font, color });
      xc += widths[i] + tracking;
    }
  };

  /// Highlight (зсув вгору-ліворуч) — pale gold catches light на верхньому краю
  /// embossed літер
  drawAt(-0.4, 0.4, c(GOLD_PALE));
  /// Inner deep shadow (зсув униз-праворуч) — темна тінь під літерою (depth)
  drawAt(0.5, -0.5, c({ r: 6, g: 18, b: 14 }));
  /// Main face — глибокий зелений
  drawAt(0, 0, faceColor);
}

/* ======================================================================= */
/*                       DIAMOND DIVIDER                                   */
/* ======================================================================= */

/// Горизонтальний divider — дві короткі gold-лінії з gold-ромбом центром.
///
/// @param cx       центр divider-а по горизонталі
/// @param y        baseline divider-а
/// @param spanHalf половина повної ширини divider-а
export function drawDiamondDivider(
  page: PDFPage,
  cx: number,
  y: number,
  spanHalf: number,
) {
  const gold = c(GOLD);
  const goldLight = c(GOLD_LIGHT);
  const goldPale = c(GOLD_PALE);
  const diamondR = 5.5;

  /// Лівий і правий сегменти (з відступом від центрального ромба)
  const gap = diamondR + 4;
  page.drawLine({
    start: { x: cx - spanHalf, y },
    end: { x: cx - gap, y },
    thickness: 0.8, color: gold, opacity: 0.85,
  });
  page.drawLine({
    start: { x: cx + gap, y },
    end: { x: cx + spanHalf, y },
    thickness: 0.8, color: gold, opacity: 0.85,
  });

  /// Маленькі сферички на кінцях лінії (subtle end-caps)
  page.drawCircle({ x: cx - spanHalf, y, size: 1.2, color: gold, borderWidth: 0 });
  page.drawCircle({ x: cx + spanHalf, y, size: 1.2, color: gold, borderWidth: 0 });

  /// Центральний ромб — double layer (halo + core)
  drawDiamondShape(page, cx, y, diamondR + 1.5, goldPale);
  drawDiamondShape(page, cx, y, diamondR, goldLight);
  /// Тонкий внутрішній stroke (engraved-look)
  drawDiamondOutline(page, cx, y, diamondR - 1.5, c(GOLD_DEEP), 0.5);
}

/* ======================================================================= */
/*                       TOP RULE (з центральною точкою)                   */
/* ======================================================================= */

/// Тонка декоративна лінія з gold-точкою центром — стоїть над "ОФІЦІЙНИЙ
/// СЕРТИФІКАТ" або під ним. Менш масивний за diamondDivider.
export function drawTopRule(
  page: PDFPage,
  cx: number,
  y: number,
  spanHalf: number,
) {
  const gold = c(GOLD);
  const goldPale = c(GOLD_PALE);
  const dotR = 2.0;
  const gap = dotR + 3;

  page.drawLine({
    start: { x: cx - spanHalf, y },
    end: { x: cx - gap, y },
    thickness: 0.7, color: gold, opacity: 0.85,
  });
  page.drawLine({
    start: { x: cx + gap, y },
    end: { x: cx + spanHalf, y },
    thickness: 0.7, color: gold, opacity: 0.85,
  });

  /// Центральна gold-точка з halo
  page.drawCircle({ x: cx, y, size: dotR + 0.6, color: c(GOLD_DEEP), borderWidth: 0, opacity: 0.5 });
  page.drawCircle({ x: cx, y, size: dotR, color: gold, borderWidth: 0 });
  page.drawCircle({ x: cx, y: y + 0.3, size: dotR * 0.5, color: goldPale, borderWidth: 0 });
}

/* ======================================================================= */
/*                       SIDEBAR STRIPE                                    */
/* ======================================================================= */

/// Вертикальна декоративна смуга у sidebar-і: трохи темніша зелена смужка
/// з тонким золотим hairline вздовж правої кромки. Створює відчуття shadow
/// border між sidebar та main panel.
///
/// @param x      ліва координата смуги
/// @param y      нижня координата
/// @param width  ширина смуги (typically ~14pt)
/// @param height висота смуги
export function drawSidebarStripe(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  /// Темніший зелений stripe
  page.drawRectangle({
    x, y, width, height,
    color: c(SIDEBAR_GREEN_DEEP), borderWidth: 0,
  });
  /// Hairline золотий по правій кромці stripe (subtle separator)
  page.drawRectangle({
    x: x + width - 0.6, y,
    width: 0.6, height,
    color: c(GOLD), borderWidth: 0,
  });
}

/* ----------------------------------------------------------------------- */
/*                          Helpers                                        */
/* ----------------------------------------------------------------------- */

function drawDiamondShape(
  page: PDFPage,
  cx: number,
  cy: number,
  r: number,
  color: ReturnType<typeof rgb>,
) {
  const path = `M ${cx} ${cy + r} L ${cx + r} ${cy} L ${cx} ${cy - r} L ${cx - r} ${cy} Z`;
  page.drawSvgPath(path, { color, borderWidth: 0 });
}

function drawDiamondOutline(
  page: PDFPage,
  cx: number,
  cy: number,
  r: number,
  color: ReturnType<typeof rgb>,
  thickness: number,
) {
  const path = `M ${cx} ${cy + r} L ${cx + r} ${cy} L ${cx} ${cy - r} L ${cx - r} ${cy} Z`;
  page.drawSvgPath(path, {
    borderColor: color,
    borderWidth: thickness,
  });
}

/// Centered tracked text — спільний хелпер для tracked caps у sidebar/main.
export function drawCenteredTracked(
  page: PDFPage,
  text: string,
  cx: number,
  y: number,
  size: number,
  tracking: number,
  font: PDFFont,
  color: ReturnType<typeof rgb>,
) {
  const widths: number[] = [];
  let totalW = 0;
  for (const ch of text) {
    const w = font.widthOfTextAtSize(ch, size);
    widths.push(w);
    totalW += w + tracking;
  }
  totalW -= tracking;
  let x = cx - totalW / 2;
  for (let i = 0; i < text.length; i++) {
    page.drawText(text[i], { x, y, size, font, color });
    x += widths[i] + tracking;
  }
}

/// Suppress unused PDFImage import warning (reserved for future logo-in-medallion use).
export type _PDFImageType = PDFImage;
