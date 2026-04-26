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

/// Великий медальйон у центрі sidebar-у — благородна золота куля з теплим
/// градієнтом, drop shadow у бронзовому тоні і темно-зеленим UIMP по центру.
/// Дизайн розроблений у `/Certificates/medallion-playground.html`.
///
/// @param cx, cy       центр у pt
/// @param r            зовнішній радіус кулі
/// @param logoGoldPng  ігнорується (UIMP — текстом, не логотипом)
export function drawSidebarMedallion(
  page: PDFPage,
  fonts: Record<FontKey, PDFFont>,
  cx: number,
  cy: number,
  r: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  logoGoldPng?: PDFImage,
) {
  /// Палітра sphere — refined в playground (з warmer shadow + 6-stop gradient)
  const SP_LIGHT      = { r: 232, g: 194, b: 119 }; // #e8c277
  const SP_LIGHT_MID  = { r: 213, g: 172, b: 85  }; // mix(light, mid, .55)
  const SP_MID        = { r: 198, g: 154, b: 58  }; // #c69a3a
  const SP_MID_DARK   = { r: 150, g: 113, b: 38  }; // mix(mid, dark, .55)
  const SP_DARK       = { r: 110, g: 79,  b: 21  }; // #6e4f15
  const SP_BRIGHT     = { r: 240, g: 212, b: 136 }; // shade(light, +3)
  const SP_SHADOW     = { r: 61,  g: 42,  b: 8   }; // #3d2a08 (warm bronze)

  /// 1. Тепла бронзова drop shadow — 6 шарів імітують Gaussian blur з warm tint
  for (let i = 0; i < 6; i++) {
    page.drawCircle({
      x: cx, y: cy - r * 0.018 * (i + 1),
      size: r + r * 0.045 - i * (r * 0.0075),
      color: c(SP_SHADOW), borderWidth: 0,
      opacity: 0.10,
    });
  }

  /// 2. Концентричні кола симулюють radial gradient (origin зміщений вгору-ліворуч).
  /// Найбільше коло — найтемніше; кожне менше зміщене ближче до highlight-точки
  /// і має світліший тон. Sphere effect виходить з накладання.
  const hlX = -r * 0.24; // ліворуч від центру
  const hlY = +r * 0.30; // вгору в pdf-lib coords (y up)

  page.drawCircle({ x: cx,                     y: cy,                     size: r,         color: c(SP_DARK),      borderWidth: 0 });
  page.drawCircle({ x: cx + hlX * 0.15,        y: cy + hlY * 0.15,        size: r * 0.94,  color: c(SP_MID_DARK),  borderWidth: 0 });
  page.drawCircle({ x: cx + hlX * 0.32,        y: cy + hlY * 0.32,        size: r * 0.82,  color: c(SP_MID),       borderWidth: 0 });
  page.drawCircle({ x: cx + hlX * 0.52,        y: cy + hlY * 0.52,        size: r * 0.64,  color: c(SP_LIGHT_MID), borderWidth: 0 });
  page.drawCircle({ x: cx + hlX * 0.74,        y: cy + hlY * 0.74,        size: r * 0.42,  color: c(SP_LIGHT),     borderWidth: 0 });
  page.drawCircle({ x: cx + hlX * 0.92,        y: cy + hlY * 0.92,        size: r * 0.20,  color: c(SP_BRIGHT),    borderWidth: 0, opacity: 0.7 });

  /// 3. Inner shadow rim — тонке темно-бронзове кільце по краю даs обʼєм.
  page.drawCircle({
    x: cx, y: cy, size: r - 0.5,
    borderColor: c(SP_SHADOW), borderWidth: r * 0.018,
    color: c(SP_DARK), opacity: 0,
  });

  /// 4. Top bevel highlight (тонкий світлий півмісяць по верху) і
  ///    bottom shadow (по низу) — імітують rim-light на кулі.
  page.drawCircle({
    x: cx, y: cy + r * 0.02, size: r,
    borderColor: c({ r: 255, g: 241, b: 196 }), borderWidth: 0.6,
    color: c(SP_DARK), opacity: 0,
  });

  /// 5. UIMP — темно-зеленим cormorant regular з letter-spacing
  const text = 'UIMP';
  const font = fonts.cormorantRegular;
  const size = r * 0.44;
  const tracking = r * 0.05;
  const widths: number[] = [];
  let totalW = 0;
  for (const ch of text) {
    const w = font.widthOfTextAtSize(ch, size);
    widths.push(w);
    totalW += w + tracking;
  }
  totalW -= tracking;
  const baseY = cy - size * 0.32;
  let x = cx - totalW / 2;
  for (let i = 0; i < text.length; i++) {
    page.drawText(text[i], { x, y: baseY, size, font, color: c(SIDEBAR_GREEN) });
    x += widths[i] + tracking;
  }
}

/* ======================================================================= */
/*                       SMALL SEAL (footer)                               */
/* ======================================================================= */

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
