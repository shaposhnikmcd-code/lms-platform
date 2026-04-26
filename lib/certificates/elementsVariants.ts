/// Експериментальні варіанти медальйона і печатки для playground.
/// НЕ використовується в production — лише test-elements.mjs.

import { PDFFont, PDFImage, PDFPage, degrees, rgb } from 'pdf-lib';
import type { FontKey } from './fonts';
import {
  GREEN, GREEN_DEEP, GOLD, GOLD_LIGHT, GOLD_DEEP, GOLD_PALE,
  CREAM, c,
} from './elements';

type Fonts = Record<FontKey, PDFFont>;
type DrawMedallion = (page: PDFPage, fonts: Fonts, logoPng: PDFImage, cx: number, cy: number, r: number) => void;
type DrawSeal = (page: PDFPage, fonts: Fonts, logoPng: PDFImage, cx: number, cy: number, r: number, year?: number) => void;

/* ----- Wax tokens ----- */

/// Темно-зелений віск як на UIMP brand. Деpper edges + light highlight для dome ефекту.
const WAX_GREEN_EDGE = { r: 11, g: 30, b: 23 };       // самий темний — край дискa
const WAX_GREEN_BODY = { r: 22, g: 50, b: 38 };       // основне тіло
const WAX_GREEN_LIT = { r: 56, g: 92, b: 76 };        // highlight (сторона що "освітлена")

/// Бордовий/винний (royal seal)
const WAX_WINE_EDGE = { r: 70, g: 18, b: 22 };
const WAX_WINE_BODY = { r: 105, g: 28, b: 32 };
const WAX_WINE_LIT = { r: 142, g: 50, b: 56 };

/// Античний золотий-олівковий
const WAX_OLIVE_EDGE = { r: 56, g: 44, b: 18 };
const WAX_OLIVE_BODY = { r: 92, g: 72, b: 32 };
const WAX_OLIVE_LIT = { r: 138, g: 110, b: 56 };

/// Вугільно-чорний (formal/legal)
const WAX_CHARCOAL_EDGE = { r: 14, g: 14, b: 18 };
const WAX_CHARCOAL_BODY = { r: 32, g: 34, b: 40 };
const WAX_CHARCOAL_LIT = { r: 70, g: 72, b: 80 };

/// Royal navy (синій тон)
const WAX_NAVY_EDGE = { r: 14, g: 22, b: 56 };
const WAX_NAVY_BODY = { r: 26, g: 40, b: 90 };
const WAX_NAVY_LIT = { r: 60, g: 80, b: 140 };

/// Sage (м'який сіро-зелений матовий)
const WAX_SAGE_EDGE = { r: 56, g: 76, b: 60 };
const WAX_SAGE_BODY = { r: 90, g: 116, b: 96 };
const WAX_SAGE_LIT = { r: 130, g: 154, b: 134 };

/* ======================================================================= */
/*                          MEDALLION VARIANTS                             */
/* ======================================================================= */

/// M1 — Cameo Premium (поточний дефолт)
const drawMedCameo: DrawMedallion = (page, fonts, logoPng, cx, cy, radius) => {
  page.drawCircle({ x: cx, y: cy - 1.5, size: radius + 1, color: c(GOLD_DEEP), borderWidth: 0 });
  page.drawCircle({ x: cx, y: cy + 1.5, size: radius + 1, color: c(GOLD_PALE), borderWidth: 0 });
  page.drawCircle({ x: cx, y: cy, size: radius, color: c(GOLD), borderWidth: 0 });

  const rInner = radius - radius * 0.085;
  page.drawCircle({ x: cx, y: cy, size: rInner, color: c(CREAM), borderWidth: 0 });
  page.drawCircle({
    x: cx, y: cy, size: rInner - 1.5,
    borderColor: c(GOLD_DEEP), borderWidth: 0.6, color: c(CREAM),
  });
  drawLogo(page, logoPng, cx, cy, rInner * 1.45);
};

/// M2 — Solid Green
const drawMedGreenMark: DrawMedallion = (page, fonts, logoPng, cx, cy, radius) => {
  page.drawCircle({ x: cx, y: cy, size: radius, color: c(GOLD), borderWidth: 0 });
  page.drawCircle({ x: cx, y: cy, size: radius - 2, color: c(GREEN), borderWidth: 0 });
  drawLogo(page, logoPng, cx, cy, radius * 1.4);
};

/// M3 — Royal Layered
const drawMedRoyal: DrawMedallion = (page, fonts, logoPng, cx, cy, radius) => {
  page.drawCircle({ x: cx, y: cy, size: radius, color: c(GOLD), borderWidth: 0 });
  page.drawCircle({ x: cx, y: cy, size: radius - 2, color: c(CREAM), borderWidth: 0 });
  page.drawCircle({ x: cx, y: cy, size: radius - 5, color: c(GREEN), borderWidth: 0 });
  page.drawCircle({ x: cx, y: cy, size: radius - 7, color: c(GOLD_LIGHT), borderWidth: 0 });
  page.drawCircle({ x: cx, y: cy, size: radius - 8, color: c(CREAM), borderWidth: 0 });
  drawLogo(page, logoPng, cx, cy, (radius - 8) * 1.5);
};

/// M4 — Olive Wreath
const drawMedWreath: DrawMedallion = (page, fonts, logoPng, cx, cy, radius) => {
  page.drawCircle({ x: cx, y: cy, size: radius, color: c(CREAM), borderWidth: 0 });
  page.drawCircle({
    x: cx, y: cy, size: radius - 0.5,
    borderColor: c(GOLD), borderWidth: 1.0, color: c(CREAM),
  });
  const leaves = 18;
  const ringR = radius - 8;
  for (let i = 0; i < leaves; i++) {
    const a = (i / leaves) * Math.PI * 2;
    const lx = cx + ringR * Math.cos(a);
    const ly = cy + ringR * Math.sin(a);
    drawOrientedDiamond(page, lx, ly, 4, 1.5, a + Math.PI / 2, c(GOLD));
  }
  drawLogo(page, logoPng, cx, cy, (radius - 14) * 1.5);
};

/// M5 — Hexagonal (production default)
const drawMedHex: DrawMedallion = (page, fonts, logoPng, cx, cy, radius) => {
  const hex = (r: number) => {
    const points: string[] = [];
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i / 6) * Math.PI * 2;
      const x = cx + r * Math.cos(a);
      const y = cy + r * Math.sin(a);
      points.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`);
    }
    points.push('Z');
    return points.join(' ');
  };
  page.drawSvgPath(hex(radius), { color: c(GOLD), borderWidth: 0 });
  page.drawSvgPath(hex(radius - 3), { color: c(CREAM), borderWidth: 0 });
  page.drawSvgPath(hex(radius - 5), {
    borderColor: c(GOLD_DEEP), borderWidth: 0.5, color: c(CREAM),
  });
  drawLogo(page, logoPng, cx, cy, (radius - 8) * 1.5);
};

/// M6 — Cameo + Cardinal accents
const drawMedCameoStar: DrawMedallion = (page, fonts, logoPng, cx, cy, radius) => {
  page.drawCircle({ x: cx, y: cy - 1.5, size: radius + 1, color: c(GOLD_DEEP), borderWidth: 0 });
  page.drawCircle({ x: cx, y: cy + 1.5, size: radius + 1, color: c(GOLD_PALE), borderWidth: 0 });
  page.drawCircle({ x: cx, y: cy, size: radius, color: c(GOLD), borderWidth: 0 });

  const rInner = radius - radius * 0.085;
  page.drawCircle({ x: cx, y: cy, size: rInner, color: c(CREAM), borderWidth: 0 });
  page.drawCircle({
    x: cx, y: cy, size: rInner - 1.5,
    borderColor: c(GOLD_DEEP), borderWidth: 0.6, color: c(CREAM),
  });

  const positions: Array<[number, number]> = [
    [0, radius], [radius, 0], [0, -radius], [-radius, 0],
  ];
  for (const [dx, dy] of positions) {
    drawDiamond(page, cx + dx, cy + dy, 3.5, c(GREEN));
    drawDiamond(page, cx + dx, cy + dy, 2, c(GOLD_PALE));
  }
  drawLogo(page, logoPng, cx, cy, rInner * 1.4);
};

/// M7 — Coin
const drawMedCoin: DrawMedallion = (page, fonts, logoPng, cx, cy, radius) => {
  const ridges = 32;
  for (let i = 0; i < ridges; i++) {
    const a = (i / ridges) * Math.PI * 2;
    page.drawCircle({
      x: cx + radius * Math.cos(a),
      y: cy + radius * Math.sin(a),
      size: 1.2, color: c(GOLD_DEEP), borderWidth: 0,
    });
  }
  page.drawCircle({ x: cx, y: cy, size: radius - 1.5, color: c(GOLD), borderWidth: 0 });
  page.drawCircle({ x: cx, y: cy, size: radius - 6, color: c(CREAM), borderWidth: 0 });
  drawLogo(page, logoPng, cx, cy, (radius - 6) * 1.5);
};

/// M8 — Minimal
const drawMedMinimal: DrawMedallion = (page, fonts, logoPng, cx, cy, radius) => {
  page.drawCircle({
    x: cx, y: cy, size: radius,
    borderColor: c(GOLD), borderWidth: 1.0, color: c(CREAM),
  });
  page.drawCircle({
    x: cx, y: cy, size: radius - 2.5,
    borderColor: c(GOLD), borderWidth: 0.5, color: c(CREAM),
  });
  drawLogo(page, logoPng, cx, cy, (radius - 6) * 1.55);
};

export const medallionVariants: Array<{ id: string; name: string; desc: string; draw: DrawMedallion }> = [
  { id: 'M1', name: 'Cameo Premium', desc: 'Gold rim + cream inset + logo', draw: drawMedCameo },
  { id: 'M2', name: 'Green Mark', desc: 'Solid green + thin gold + logo', draw: drawMedGreenMark },
  { id: 'M3', name: 'Royal Layered', desc: '5 layers gold/cream/green/gold/cream', draw: drawMedRoyal },
  { id: 'M4', name: 'Olive Wreath', desc: 'Cream + 18 leaf-shapes ring', draw: drawMedWreath },
  { id: 'M5', name: 'Hexagonal ⭐', desc: 'PRODUCTION — hex gold + cream + logo', draw: drawMedHex },
  { id: 'M6', name: 'Cameo + Cardinal', desc: 'Cameo + 4 N/S/E/W diamond accents', draw: drawMedCameoStar },
  { id: 'M7', name: 'Coin', desc: 'Notched gold edge + cream + logo', draw: drawMedCoin },
  { id: 'M8', name: 'Minimal', desc: 'Двa тонких gold ring + великий logo', draw: drawMedMinimal },
];

/* ======================================================================= */
/*                          WAX SEAL VARIANTS — мясисті                    */
/* ======================================================================= */

/// Базовий мясистий wax-disc — solid wax з radial dome gradient.
/// Малює 4 концентричних шари: edge (найтемніший) → body → inner → highlight.
function drawWaxBody(
  page: PDFPage,
  cx: number, cy: number, r: number,
  edge: { r: number; g: number; b: number },
  body: { r: number; g: number; b: number },
  lit: { r: number; g: number; b: number },
) {
  /// Drop shadow під воском (м'яка тінь)
  for (let i = 0; i < 4; i++) {
    page.drawCircle({
      x: cx, y: cy - i * 0.7, size: r + 2 - i * 0.4,
      color: c({ r: 0, g: 0, b: 0 }), borderWidth: 0, opacity: 0.06,
    });
  }
  /// Edge (найтемніший)
  page.drawCircle({ x: cx, y: cy, size: r, color: c(edge), borderWidth: 0 });
  /// Body — основне тіло, відступ ~5%
  page.drawCircle({ x: cx, y: cy, size: r * 0.95, color: c(body), borderWidth: 0 });
  /// Light highlight зміщений угору-ліворуч (як від світла зверху-зліва)
  page.drawCircle({
    x: cx - r * 0.18, y: cy + r * 0.22,
    size: r * 0.55, color: c(lit), borderWidth: 0, opacity: 0.55,
  });
  /// Малий концентрований "блік" зверху
  page.drawCircle({
    x: cx - r * 0.22, y: cy + r * 0.28,
    size: r * 0.20, color: c(lit), borderWidth: 0, opacity: 0.5,
  });
}

/// Embossed (натиснений) логотип/елемент: малюємо темну "тінь" зміщену вниз +
/// основну версію (gold) зміщену трохи вгору. Створює ефект rilievo.
function drawEmbossedLogo(
  page: PDFPage, logoPng: PDFImage, cx: number, cy: number, size: number,
) {
  const aspect = logoPng.height / logoPng.width;
  /// Темна тінь під логотипом (зміщена на 1px вниз-вправо)
  // pdf-lib drawImage не підтримує tint напряму, тому ми використовуємо opacity:
  // drawing the same image twice — once shifted as shadow with low opacity,
  // once as main with full opacity. Якщо логотип вже має gold колір — нам потрібно
  // лише subtle "press into wax" shadow ефект.
  page.drawImage(logoPng, {
    x: cx - size / 2 + 1.2, y: cy - (size * aspect) / 2 - 1.2,
    width: size, height: size * aspect,
    opacity: 0.35,
  });
  /// Основний — gold
  page.drawImage(logoPng, {
    x: cx - size / 2, y: cy - (size * aspect) / 2,
    width: size, height: size * aspect,
  });
}

/// Embossed text — імітує літери що залишилися натиснені у воску.
/// Spec: спочатку shadow зміщений вниз/вправо, потім highlight зміщений вгору/ліворуч,
/// потім main text. Ефект rilievo.
function drawEmbossedText(
  page: PDFPage, text: string, cx: number, y: number,
  size: number, font: PDFFont,
  mainColor: ReturnType<typeof rgb>,
  shadowColor: ReturnType<typeof rgb>,
  highlightColor: ReturnType<typeof rgb>,
  tracking = 0,
) {
  let totalW = 0;
  for (const ch of text) totalW += font.widthOfTextAtSize(ch, size) + tracking;
  totalW -= tracking;
  let x0 = cx - totalW / 2;

  /// Shadow (offset down-right)
  let x = x0;
  for (const ch of text) {
    page.drawText(ch, { x: x + 0.8, y: y - 0.8, size, font, color: shadowColor });
    x += font.widthOfTextAtSize(ch, size) + tracking;
  }
  /// Highlight (offset up-left)
  x = x0;
  for (const ch of text) {
    page.drawText(ch, { x: x - 0.5, y: y + 0.5, size, font, color: highlightColor });
    x += font.widthOfTextAtSize(ch, size) + tracking;
  }
  /// Main
  x = x0;
  for (const ch of text) {
    page.drawText(ch, { x, y, size, font, color: mainColor });
    x += font.widthOfTextAtSize(ch, size) + tracking;
  }
}

/// S1 — Classic Green Wax + Logo (мясистий зелений віск з UIMP лого центром)
const drawSealWaxGreen: DrawSeal = (page, fonts, logoPng, cx, cy, r, year) => {
  drawWaxBody(page, cx, cy, r, WAX_GREEN_EDGE, WAX_GREEN_BODY, WAX_GREEN_LIT);
  drawEmbossedLogo(page, logoPng, cx, cy, r * 1.15);
};

/// S2 — Wax + Thin Gold Rim + Logo
const drawSealWaxRim: DrawSeal = (page, fonts, logoPng, cx, cy, r, year) => {
  /// Shadow
  for (let i = 0; i < 4; i++) {
    page.drawCircle({
      x: cx, y: cy - i * 0.7, size: r + 2 - i * 0.4,
      color: c({ r: 0, g: 0, b: 0 }), borderWidth: 0, opacity: 0.06,
    });
  }
  /// Тонке gold rim ззовні
  page.drawCircle({ x: cx, y: cy, size: r, color: c(GOLD_DEEP), borderWidth: 0 });
  page.drawCircle({ x: cx, y: cy, size: r - 1.5, color: c(GOLD), borderWidth: 0 });
  /// Wax body всередині rim
  page.drawCircle({ x: cx, y: cy, size: r - 3, color: c(WAX_GREEN_EDGE), borderWidth: 0 });
  page.drawCircle({ x: cx, y: cy, size: (r - 3) * 0.95, color: c(WAX_GREEN_BODY), borderWidth: 0 });
  page.drawCircle({
    x: cx - r * 0.18, y: cy + r * 0.22,
    size: r * 0.50, color: c(WAX_GREEN_LIT), borderWidth: 0, opacity: 0.5,
  });
  drawEmbossedLogo(page, logoPng, cx, cy, (r - 3) * 1.1);
};

/// S3 — Wax with Big Italic U
const drawSealWaxU: DrawSeal = (page, fonts, logoPng, cx, cy, r, year) => {
  drawWaxBody(page, cx, cy, r, WAX_GREEN_EDGE, WAX_GREEN_BODY, WAX_GREEN_LIT);

  /// Велика italic "U" embossed золотим
  const text = 'U';
  const fontSize = r * 1.15;
  const font = fonts.cormorantItalic;
  const tw = font.widthOfTextAtSize(text, fontSize);
  const th = font.heightAtSize(fontSize, { descender: false });
  const baseY = cy - th / 2 + r * 0.05;
  /// Shadow press
  page.drawText(text, { x: cx - tw / 2 + 1, y: baseY - 1, size: fontSize, font, color: c(WAX_GREEN_EDGE) });
  /// Highlight up-left
  page.drawText(text, { x: cx - tw / 2 - 0.6, y: baseY + 0.6, size: fontSize, font, color: c(GOLD_PALE) });
  /// Main gold
  page.drawText(text, { x: cx - tw / 2, y: baseY, size: fontSize, font, color: c(GOLD) });
  page.drawText(text, { x: cx - tw / 2 + 0.6, y: baseY, size: fontSize, font, color: c(GOLD) });
};

/// S4 — Wax with Year (великий рік центром)
const drawSealWaxYear: DrawSeal = (page, fonts, logoPng, cx, cy, r, year) => {
  drawWaxBody(page, cx, cy, r, WAX_GREEN_EDGE, WAX_GREEN_BODY, WAX_GREEN_LIT);

  const yearStr = String(year ?? new Date().getUTCFullYear());
  const ySize = r * 0.55;
  const font = fonts.cormorantItalic;
  const tw = font.widthOfTextAtSize(yearStr, ySize);
  const baseY = cy - ySize * 0.3;

  /// Embossed effect: shadow + highlight + main
  page.drawText(yearStr, { x: cx - tw / 2 + 1, y: baseY - 1, size: ySize, font, color: c(WAX_GREEN_EDGE) });
  page.drawText(yearStr, { x: cx - tw / 2 - 0.5, y: baseY + 0.5, size: ySize, font, color: c(GOLD_PALE) });
  page.drawText(yearStr, { x: cx - tw / 2, y: baseY, size: ySize, font, color: c(GOLD) });
  page.drawText(yearStr, { x: cx - tw / 2 + 0.5, y: baseY, size: ySize, font, color: c(GOLD) });

  /// Маленький "UIMP" нижче року, tracked caps
  const sub = 'UIMP';
  const sSize = r * 0.16;
  const sFont = fonts.interSemiBold;
  drawEmbossedText(page, sub, cx, cy - r * 0.55, sSize, sFont,
    c(GOLD), c(WAX_GREEN_EDGE), c(GOLD_PALE), 4);
};

/// S5 — Two-tone Burgundy Wax (винний колір — як королівські печатки)
const drawSealWaxWine: DrawSeal = (page, fonts, logoPng, cx, cy, r, year) => {
  drawWaxBody(page, cx, cy, r, WAX_WINE_EDGE, WAX_WINE_BODY, WAX_WINE_LIT);
  drawEmbossedLogo(page, logoPng, cx, cy, r * 1.15);
};

/// S6 — Antique Olive Wax (теплий золотистий-олівковий тон)
const drawSealWaxOlive: DrawSeal = (page, fonts, logoPng, cx, cy, r, year) => {
  drawWaxBody(page, cx, cy, r, WAX_OLIVE_EDGE, WAX_OLIVE_BODY, WAX_OLIVE_LIT);
  drawEmbossedLogo(page, logoPng, cx, cy, r * 1.15);
};

/// S7 — Wax + UIMP letters (без лого, тільки tracked caps)
const drawSealWaxLetters: DrawSeal = (page, fonts, logoPng, cx, cy, r, year) => {
  drawWaxBody(page, cx, cy, r, WAX_GREEN_EDGE, WAX_GREEN_BODY, WAX_GREEN_LIT);

  const text = 'UIMP';
  const size = r * 0.42;
  const font = fonts.interSemiBold;
  const tracking = r * 0.05;
  drawEmbossedText(page, text, cx, cy - size * 0.3, size, font,
    c(GOLD), c(WAX_GREEN_EDGE), c(GOLD_PALE), tracking);

  /// Тонка decorative лінія під UIMP
  page.drawLine({
    start: { x: cx - r * 0.45, y: cy - size * 0.35 - 6 },
    end: { x: cx + r * 0.45, y: cy - size * 0.35 - 6 },
    thickness: 0.6, color: c(GOLD),
    opacity: 0.7,
  });

  /// Дрібний CERTIFIED + year
  if (year) {
    const sub = `CERTIFIED · ${year}`;
    const sSize = r * 0.13;
    drawEmbossedText(page, sub, cx, cy - size * 0.35 - 18, sSize, font,
      c(GOLD), c(WAX_GREEN_EDGE), c(GOLD_PALE), 1.5);
  }
};

/// S8 — Heavy Wax + Logo + thin top arc text (мінімум тексту)
const drawSealWaxHeavy: DrawSeal = (page, fonts, logoPng, cx, cy, r, year) => {
  /// Глибша тінь для weighty look
  for (let i = 0; i < 6; i++) {
    page.drawCircle({
      x: cx, y: cy - i * 0.9, size: r + 3 - i * 0.3,
      color: c({ r: 0, g: 0, b: 0 }), borderWidth: 0, opacity: 0.05,
    });
  }
  drawWaxBody(page, cx, cy, r, WAX_GREEN_EDGE, WAX_GREEN_BODY, WAX_GREEN_LIT);

  /// Лого ще більший, центром
  drawEmbossedLogo(page, logoPng, cx, cy + r * 0.05, r * 1.25);

  /// Маленький curved year внизу — embossed gold з shadow
  if (year) {
    const yearStr = `· ${year} ·`;
    const ySize = r * 0.13;
    drawTextOnArc(page, yearStr, cx, cy, r * 0.78, -Math.PI / 2, ySize,
      fonts.interSemiBold, c(GOLD), { direction: 'ccw', tracking: 1.5 });
  }
};

/// S9 — Charcoal Wax (формальний чорний/слейтовий тон)
const drawSealWaxCharcoal: DrawSeal = (page, fonts, logoPng, cx, cy, r, year) => {
  drawWaxBody(page, cx, cy, r, WAX_CHARCOAL_EDGE, WAX_CHARCOAL_BODY, WAX_CHARCOAL_LIT);
  drawEmbossedLogo(page, logoPng, cx, cy, r * 1.15);
};

/// S10 — Royal Navy Wax (синій королівський)
const drawSealWaxNavy: DrawSeal = (page, fonts, logoPng, cx, cy, r, year) => {
  drawWaxBody(page, cx, cy, r, WAX_NAVY_EDGE, WAX_NAVY_BODY, WAX_NAVY_LIT);
  drawEmbossedLogo(page, logoPng, cx, cy, r * 1.15);
};

/// S11 — Sage Matte (м'який сіро-зелений, не такий темний як основний green)
const drawSealWaxSage: DrawSeal = (page, fonts, logoPng, cx, cy, r, year) => {
  drawWaxBody(page, cx, cy, r, WAX_SAGE_EDGE, WAX_SAGE_BODY, WAX_SAGE_LIT);
  drawEmbossedLogo(page, logoPng, cx, cy, r * 1.15);
};

/// S12 — Hex Wax (шестикутна форма — cohesion з medallion)
const drawSealWaxHex: DrawSeal = (page, fonts, logoPng, cx, cy, r, year) => {
  /// SVG path для hex
  const hex = (radius: number) => {
    const points: string[] = [];
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i / 6) * Math.PI * 2;
      const x = cx + radius * Math.cos(a);
      const y = cy + radius * Math.sin(a);
      points.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`);
    }
    points.push('Z');
    return points.join(' ');
  };

  /// Drop shadow
  for (let i = 0; i < 4; i++) {
    page.drawSvgPath(hex(r + 2 - i * 0.4), {
      color: c({ r: 0, g: 0, b: 0 }), borderWidth: 0, opacity: 0.06,
    });
  }
  /// Wax edge (darkest hex)
  page.drawSvgPath(hex(r), { color: c(WAX_GREEN_EDGE), borderWidth: 0 });
  /// Wax body (slightly smaller hex)
  page.drawSvgPath(hex(r * 0.93), { color: c(WAX_GREEN_BODY), borderWidth: 0 });
  /// Highlight (circle on top-left)
  page.drawCircle({
    x: cx - r * 0.2, y: cy + r * 0.22,
    size: r * 0.48, color: c(WAX_GREEN_LIT), borderWidth: 0, opacity: 0.55,
  });
  drawEmbossedLogo(page, logoPng, cx, cy, r * 1.15);
};

/// S13 — Octagon Wax (8-кутна)
const drawSealWaxOct: DrawSeal = (page, fonts, logoPng, cx, cy, r, year) => {
  const oct = (radius: number) => {
    const points: string[] = [];
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI / 2 + Math.PI / 8 + (i / 8) * Math.PI * 2;
      const x = cx + radius * Math.cos(a);
      const y = cy + radius * Math.sin(a);
      points.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`);
    }
    points.push('Z');
    return points.join(' ');
  };

  for (let i = 0; i < 4; i++) {
    page.drawSvgPath(oct(r + 2 - i * 0.4), {
      color: c({ r: 0, g: 0, b: 0 }), borderWidth: 0, opacity: 0.06,
    });
  }
  page.drawSvgPath(oct(r), { color: c(WAX_GREEN_EDGE), borderWidth: 0 });
  page.drawSvgPath(oct(r * 0.93), { color: c(WAX_GREEN_BODY), borderWidth: 0 });
  page.drawCircle({
    x: cx - r * 0.2, y: cy + r * 0.22,
    size: r * 0.48, color: c(WAX_GREEN_LIT), borderWidth: 0, opacity: 0.55,
  });
  drawEmbossedLogo(page, logoPng, cx, cy, r * 1.15);
};

/// S14 — Wreath Wax (зелений wax + 16 малих gold leaves як ринг навколо лого)
const drawSealWaxWreath: DrawSeal = (page, fonts, logoPng, cx, cy, r, year) => {
  drawWaxBody(page, cx, cy, r, WAX_GREEN_EDGE, WAX_GREEN_BODY, WAX_GREEN_LIT);

  /// 16 leaves навколо логотипа
  const leaves = 16;
  const ringR = r * 0.72;
  for (let i = 0; i < leaves; i++) {
    const a = (i / leaves) * Math.PI * 2;
    const lx = cx + ringR * Math.cos(a);
    const ly = cy + ringR * Math.sin(a);
    /// Тонкий витягнутий ромб (leaf), орієнтований радіально
    drawOrientedDiamond(page, lx, ly, 4, 1.5, a + Math.PI / 2, c(GOLD));
  }

  /// Лого центром, трохи менший щоб не перекривати ring
  drawEmbossedLogo(page, logoPng, cx, cy, r * 0.9);
};

/// S15 — Cameo Inset (зелений wax з малим cream cameo всередині, лого на cream)
const drawSealWaxCameo: DrawSeal = (page, fonts, logoPng, cx, cy, r, year) => {
  drawWaxBody(page, cx, cy, r, WAX_GREEN_EDGE, WAX_GREEN_BODY, WAX_GREEN_LIT);

  /// Mini cream cameo inside
  const cameoR = r * 0.55;
  /// Cream disc з gold rim
  page.drawCircle({ x: cx, y: cy, size: cameoR + 1, color: c(GOLD), borderWidth: 0 });
  page.drawCircle({ x: cx, y: cy, size: cameoR, color: c(CREAM), borderWidth: 0 });
  page.drawCircle({
    x: cx, y: cy, size: cameoR - 1.5,
    borderColor: c(GOLD_DEEP), borderWidth: 0.4, color: c(CREAM),
  });

  /// Лого на cream cameo
  const aspect = logoPng.height / logoPng.width;
  const logoSize = cameoR * 1.5;
  page.drawImage(logoPng, {
    x: cx - logoSize / 2, y: cy - (logoSize * aspect) / 2,
    width: logoSize, height: logoSize * aspect,
  });
};

/// S16 — Pressed Star (зелений wax + 8-кутна зірка embossed центром, без лого)
const drawSealWaxStar: DrawSeal = (page, fonts, logoPng, cx, cy, r, year) => {
  drawWaxBody(page, cx, cy, r, WAX_GREEN_EDGE, WAX_GREEN_BODY, WAX_GREEN_LIT);

  /// 8-pointed star (16 vertices: 8 outer + 8 inner)
  const starOuter = r * 0.55;
  const starInner = starOuter * 0.42;
  const star = (rO: number, rI: number, offsetY = 0, offsetX = 0) => {
    const points: string[] = [];
    for (let i = 0; i < 16; i++) {
      const a = -Math.PI / 2 + (i / 16) * Math.PI * 2;
      const radius = i % 2 === 0 ? rO : rI;
      const x = cx + radius * Math.cos(a) + offsetX;
      const y = cy + radius * Math.sin(a) + offsetY;
      points.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`);
    }
    points.push('Z');
    return points.join(' ');
  };

  /// Shadow press (down-right offset, dark)
  page.drawSvgPath(star(starOuter, starInner, -1.2, 1.2), {
    color: c(WAX_GREEN_EDGE), borderWidth: 0,
  });
  /// Highlight (up-left offset, light gold)
  page.drawSvgPath(star(starOuter, starInner, 0.6, -0.6), {
    color: c(GOLD_PALE), borderWidth: 0,
  });
  /// Main star (gold)
  page.drawSvgPath(star(starOuter, starInner), {
    color: c(GOLD), borderWidth: 0,
  });

  /// Маленьке "UIMP" tracked нижче зірки
  const txt = 'UIMP';
  const sSize = r * 0.13;
  drawEmbossedText(page, txt, cx, cy - r * 0.62, sSize, fonts.interSemiBold,
    c(GOLD), c(WAX_GREEN_EDGE), c(GOLD_PALE), 3);
};

/* ----- Typography-focused variants (на базі S7) ----- */

/// S17 — Reversed: великий рік центром, маленький UIMP внизу, decorative line зверху
const drawSealTypoReversed: DrawSeal = (page, fonts, logoPng, cx, cy, r, year) => {
  drawWaxBody(page, cx, cy, r, WAX_GREEN_EDGE, WAX_GREEN_BODY, WAX_GREEN_LIT);

  /// Decorative line зверху
  page.drawLine({
    start: { x: cx - r * 0.45, y: cy + r * 0.30 },
    end: { x: cx + r * 0.45, y: cy + r * 0.30 },
    thickness: 0.7, color: c(GOLD), opacity: 0.7,
  });
  drawDiamond(page, cx, cy + r * 0.30, 2, c(GOLD_PALE));

  /// Великий рік italic центром
  const yearStr = String(year ?? 2026);
  const ySize = r * 0.50;
  const font = fonts.cormorantItalic;
  const tw = font.widthOfTextAtSize(yearStr, ySize);
  const baseY = cy - ySize * 0.35;
  page.drawText(yearStr, { x: cx - tw / 2 + 1, y: baseY - 1, size: ySize, font, color: c(WAX_GREEN_EDGE) });
  page.drawText(yearStr, { x: cx - tw / 2 - 0.5, y: baseY + 0.5, size: ySize, font, color: c(GOLD_PALE) });
  page.drawText(yearStr, { x: cx - tw / 2, y: baseY, size: ySize, font, color: c(GOLD) });
  page.drawText(yearStr, { x: cx - tw / 2 + 0.5, y: baseY, size: ySize, font, color: c(GOLD) });

  /// Маленький UIMP внизу
  drawEmbossedText(page, 'UIMP', cx, cy - r * 0.50, r * 0.13, fonts.interSemiBold,
    c(GOLD), c(WAX_GREEN_EDGE), c(GOLD_PALE), 3);
};

/// S18 — Diamond Separator: UIMP top + gold diamond center + CERTIFIED·2026 bottom
const drawSealTypoDiamond: DrawSeal = (page, fonts, logoPng, cx, cy, r, year) => {
  drawWaxBody(page, cx, cy, r, WAX_GREEN_EDGE, WAX_GREEN_BODY, WAX_GREEN_LIT);

  /// UIMP зверху
  const topSize = r * 0.30;
  drawEmbossedText(page, 'UIMP', cx, cy + r * 0.20, topSize, fonts.interSemiBold,
    c(GOLD), c(WAX_GREEN_EDGE), c(GOLD_PALE), r * 0.04);

  /// Diamond центром
  drawDiamond(page, cx, cy + r * 0.02, r * 0.08, c(WAX_GREEN_EDGE));
  drawDiamond(page, cx, cy + r * 0.025, r * 0.07, c(GOLD));
  drawDiamond(page, cx, cy + r * 0.03, r * 0.04, c(GOLD_PALE));

  /// CERTIFIED · year внизу
  const sub = year ? `CERTIFIED · ${year}` : 'CERTIFIED · UKRAINE';
  drawEmbossedText(page, sub, cx, cy - r * 0.30, r * 0.13, fonts.interSemiBold,
    c(GOLD), c(WAX_GREEN_EDGE), c(GOLD_PALE), 1.5);
};

/// S19 — Flanking Lines: UIMP центр + 2 короткі decorative lines обабіч
const drawSealTypoFlank: DrawSeal = (page, fonts, logoPng, cx, cy, r, year) => {
  drawWaxBody(page, cx, cy, r, WAX_GREEN_EDGE, WAX_GREEN_BODY, WAX_GREEN_LIT);

  /// UIMP центром, великий
  const text = 'UIMP';
  const size = r * 0.45;
  const font = fonts.interSemiBold;
  drawEmbossedText(page, text, cx, cy - size * 0.25, size, font,
    c(GOLD), c(WAX_GREEN_EDGE), c(GOLD_PALE), r * 0.06);

  /// 2 короткі лінії обабіч UIMP (на рівні mid-baseline)
  const lineY = cy - size * 0.05;
  const tw = font.widthOfTextAtSize(text, size) + r * 0.06 * 3;
  page.drawLine({
    start: { x: cx - r * 0.85, y: lineY },
    end: { x: cx - tw / 2 - 8, y: lineY },
    thickness: 0.8, color: c(GOLD), opacity: 0.75,
  });
  page.drawLine({
    start: { x: cx + tw / 2 + 8, y: lineY },
    end: { x: cx + r * 0.85, y: lineY },
    thickness: 0.8, color: c(GOLD), opacity: 0.75,
  });

  /// Маленькі точки на кінцях ліній
  page.drawCircle({ x: cx - r * 0.85, y: lineY, size: 1.3, color: c(GOLD), borderWidth: 0 });
  page.drawCircle({ x: cx + r * 0.85, y: lineY, size: 1.3, color: c(GOLD), borderWidth: 0 });

  /// Year внизу
  if (year) {
    drawEmbossedText(page, String(year), cx, cy - r * 0.55, r * 0.13, font,
      c(GOLD), c(WAX_GREEN_EDGE), c(GOLD_PALE), 2);
  }
};

/// S20 — Boxed UIMP: UIMP в gold thin rectangular рамці + year внизу
const drawSealTypoBox: DrawSeal = (page, fonts, logoPng, cx, cy, r, year) => {
  drawWaxBody(page, cx, cy, r, WAX_GREEN_EDGE, WAX_GREEN_BODY, WAX_GREEN_LIT);

  /// UIMP центром
  const text = 'UIMP';
  const size = r * 0.36;
  const font = fonts.interSemiBold;
  const tracking = r * 0.05;
  let tw = 0;
  for (const ch of text) tw += font.widthOfTextAtSize(ch, size) + tracking;
  tw -= tracking;

  /// Gold rectangular frame
  const boxW = tw + r * 0.30;
  const boxH = size * 1.4;
  const boxY = cy - size * 0.5;
  page.drawRectangle({
    x: cx - boxW / 2, y: boxY - boxH * 0.18,
    width: boxW, height: boxH,
    borderColor: c(GOLD), borderWidth: 1.0, color: undefined,
    opacity: 0.85,
  });
  /// Внутрішня тонша лінія
  page.drawRectangle({
    x: cx - boxW / 2 + 2, y: boxY - boxH * 0.18 + 2,
    width: boxW - 4, height: boxH - 4,
    borderColor: c(GOLD_DEEP), borderWidth: 0.4, color: undefined,
    opacity: 0.7,
  });

  drawEmbossedText(page, text, cx, cy - size * 0.25, size, font,
    c(GOLD), c(WAX_GREEN_EDGE), c(GOLD_PALE), tracking);

  /// Year поза рамкою
  if (year) {
    drawEmbossedText(page, String(year), cx, cy - r * 0.55, r * 0.13, font,
      c(GOLD), c(WAX_GREEN_EDGE), c(GOLD_PALE), 2);
  }
};

/// S21 — Vertical UIMP: літери U I M P стекнуті вертикально + year внизу
const drawSealTypoVertical: DrawSeal = (page, fonts, logoPng, cx, cy, r, year) => {
  drawWaxBody(page, cx, cy, r, WAX_GREEN_EDGE, WAX_GREEN_BODY, WAX_GREEN_LIT);

  const letters = ['U', 'I', 'M', 'P'];
  const size = r * 0.21;
  const font = fonts.cormorantItalic;
  const lineGap = size * 1.05;
  const startY = cy + (letters.length - 1) * lineGap / 2 - size * 0.25;

  for (let i = 0; i < letters.length; i++) {
    const ch = letters[i];
    const w = font.widthOfTextAtSize(ch, size);
    const y = startY - i * lineGap;
    /// Embossed effect per letter
    page.drawText(ch, { x: cx - w / 2 + 0.7, y: y - 0.7, size, font, color: c(WAX_GREEN_EDGE) });
    page.drawText(ch, { x: cx - w / 2 - 0.4, y: y + 0.4, size, font, color: c(GOLD_PALE) });
    page.drawText(ch, { x: cx - w / 2, y, size, font, color: c(GOLD) });
  }

  /// Дві decorative лінії з кожного боку від колонки літер
  page.drawLine({
    start: { x: cx - r * 0.40, y: cy - r * 0.10 },
    end: { x: cx - r * 0.20, y: cy - r * 0.10 },
    thickness: 0.7, color: c(GOLD), opacity: 0.7,
  });
  page.drawLine({
    start: { x: cx + r * 0.20, y: cy - r * 0.10 },
    end: { x: cx + r * 0.40, y: cy - r * 0.10 },
    thickness: 0.7, color: c(GOLD), opacity: 0.7,
  });
};

/// S22 — Chevron Crest: маленький gold chevron зверху + UIMP центр + dots
const drawSealTypoChevron: DrawSeal = (page, fonts, logoPng, cx, cy, r, year) => {
  drawWaxBody(page, cx, cy, r, WAX_GREEN_EDGE, WAX_GREEN_BODY, WAX_GREEN_LIT);

  /// Chevron (V-shape) зверху
  const chevH = r * 0.10;
  const chevW = r * 0.32;
  const chevY = cy + r * 0.32;
  page.drawSvgPath(
    `M ${cx - chevW / 2} ${chevY} L ${cx} ${chevY + chevH} L ${cx + chevW / 2} ${chevY} L ${cx + chevW / 2 - 2} ${chevY} L ${cx} ${chevY + chevH - 4} L ${cx - chevW / 2 + 2} ${chevY} Z`,
    { color: c(GOLD), borderWidth: 0 },
  );

  /// UIMP центром
  const text = 'UIMP';
  const size = r * 0.38;
  const font = fonts.interSemiBold;
  drawEmbossedText(page, text, cx, cy - size * 0.25, size, font,
    c(GOLD), c(WAX_GREEN_EDGE), c(GOLD_PALE), r * 0.05);

  /// 3 точки знизу — горизонтально
  const dotY = cy - r * 0.42;
  const dotGap = r * 0.10;
  for (let i = -1; i <= 1; i++) {
    page.drawCircle({
      x: cx + i * dotGap, y: dotY,
      size: i === 0 ? 1.8 : 1.3,
      color: c(GOLD), borderWidth: 0,
    });
  }

  /// Year curved нижче
  if (year) {
    const yearSize = r * 0.11;
    drawEmbossedText(page, String(year), cx, cy - r * 0.62, yearSize, font,
      c(GOLD), c(WAX_GREEN_EDGE), c(GOLD_PALE), 2);
  }
};

/// S23 — 3-line Stamp: "EST." + "UIMP" + year, з horizontal lines між ними
const drawSealTypo3Line: DrawSeal = (page, fonts, logoPng, cx, cy, r, year) => {
  drawWaxBody(page, cx, cy, r, WAX_GREEN_EDGE, WAX_GREEN_BODY, WAX_GREEN_LIT);

  const font = fonts.interSemiBold;

  /// Top: "EST." малий
  const topSize = r * 0.13;
  drawEmbossedText(page, 'ESTABLISHED', cx, cy + r * 0.30, topSize, font,
    c(GOLD), c(WAX_GREEN_EDGE), c(GOLD_PALE), 1.5);

  /// Top decorative line
  page.drawLine({
    start: { x: cx - r * 0.40, y: cy + r * 0.20 },
    end: { x: cx + r * 0.40, y: cy + r * 0.20 },
    thickness: 0.6, color: c(GOLD), opacity: 0.7,
  });

  /// Center: UIMP great
  const midSize = r * 0.40;
  drawEmbossedText(page, 'UIMP', cx, cy - midSize * 0.25, midSize, font,
    c(GOLD), c(WAX_GREEN_EDGE), c(GOLD_PALE), r * 0.06);

  /// Bottom decorative line
  page.drawLine({
    start: { x: cx - r * 0.40, y: cy - r * 0.30 },
    end: { x: cx + r * 0.40, y: cy - r * 0.30 },
    thickness: 0.6, color: c(GOLD), opacity: 0.7,
  });

  /// Bottom: year
  const yearStr = String(year ?? 2026);
  drawEmbossedText(page, yearStr, cx, cy - r * 0.50, r * 0.16, font,
    c(GOLD), c(WAX_GREEN_EDGE), c(GOLD_PALE), 3);
};

/// S24 — Year Big + Initials: великий italic year + line + UIMP UKRAINE
const drawSealTypoYearBig: DrawSeal = (page, fonts, logoPng, cx, cy, r, year) => {
  drawWaxBody(page, cx, cy, r, WAX_GREEN_EDGE, WAX_GREEN_BODY, WAX_GREEN_LIT);

  /// Великий italic рік зверху
  const yearStr = String(year ?? 2026);
  const yearSize = r * 0.42;
  const yearFont = fonts.cormorantItalic;
  const yw = yearFont.widthOfTextAtSize(yearStr, yearSize);
  const yY = cy + r * 0.05;
  page.drawText(yearStr, { x: cx - yw / 2 + 0.9, y: yY - 0.9, size: yearSize, font: yearFont, color: c(WAX_GREEN_EDGE) });
  page.drawText(yearStr, { x: cx - yw / 2 - 0.5, y: yY + 0.5, size: yearSize, font: yearFont, color: c(GOLD_PALE) });
  page.drawText(yearStr, { x: cx - yw / 2, y: yY, size: yearSize, font: yearFont, color: c(GOLD) });
  page.drawText(yearStr, { x: cx - yw / 2 + 0.5, y: yY, size: yearSize, font: yearFont, color: c(GOLD) });

  /// Decorative double line з diamond центром
  const lineY = cy - r * 0.20;
  page.drawLine({
    start: { x: cx - r * 0.38, y: lineY },
    end: { x: cx - r * 0.06, y: lineY },
    thickness: 0.7, color: c(GOLD), opacity: 0.8,
  });
  page.drawLine({
    start: { x: cx + r * 0.06, y: lineY },
    end: { x: cx + r * 0.38, y: lineY },
    thickness: 0.7, color: c(GOLD), opacity: 0.8,
  });
  drawDiamond(page, cx, lineY, 2.5, c(GOLD_PALE));

  /// UIMP · UKRAINE знизу
  drawEmbossedText(page, 'UIMP · UKRAINE', cx, cy - r * 0.42, r * 0.13, fonts.interSemiBold,
    c(GOLD), c(WAX_GREEN_EDGE), c(GOLD_PALE), 1.8);
};

/* ----- Кардинально різні форми/стилі (без wax dome) ----- */

/// S25 — Postage Stamp: вертикальний прямокутник з perforated edges на cream papers
const drawSealStamp: DrawSeal = (page, fonts, logoPng, cx, cy, r, year) => {
  /// Прямокутник з аспектом 0.78:1 (вертикальний)
  const w = r * 1.55;
  const h = r * 1.95;
  const x = cx - w / 2;
  const y = cy - h / 2;

  /// Drop shadow
  page.drawRectangle({
    x: x + 2, y: y - 2, width: w, height: h,
    color: c({ r: 0, g: 0, b: 0 }), borderWidth: 0, opacity: 0.12,
  });
  /// Cream paper body
  page.drawRectangle({ x, y, width: w, height: h, color: c(CREAM), borderWidth: 0 });
  /// Перфорація — маленькі cream-кольору крапки на cream-фоні створюють перфоровану текстуру
  /// Малюємо їх як пустоти зрізаних кутів — gold dots по периметру
  const perfStep = 7;
  const inset = 4;
  for (let xi = x + inset; xi < x + w; xi += perfStep) {
    page.drawCircle({ x: xi, y: y, size: 1.5, color: c(CREAM_BG_OUTSIDE), borderWidth: 0 });
    page.drawCircle({ x: xi, y: y + h, size: 1.5, color: c(CREAM_BG_OUTSIDE), borderWidth: 0 });
  }
  for (let yi = y + inset; yi < y + h; yi += perfStep) {
    page.drawCircle({ x: x, y: yi, size: 1.5, color: c(CREAM_BG_OUTSIDE), borderWidth: 0 });
    page.drawCircle({ x: x + w, y: yi, size: 1.5, color: c(CREAM_BG_OUTSIDE), borderWidth: 0 });
  }

  /// Внутрішня тонка gold рамка
  page.drawRectangle({
    x: x + 8, y: y + 8, width: w - 16, height: h - 16,
    borderColor: c(GOLD), borderWidth: 0.8, color: undefined, opacity: 0.85,
  });

  /// Логотип у верхній половині
  drawLogo(page, logoPng, cx, cy + h * 0.18, h * 0.40);

  /// "UIMP" по центру
  drawCenteredText(page, 'UIMP', cx, cy - h * 0.13, h * 0.10, fonts.interSemiBold, c(GREEN_DEEP));

  /// Decorative line
  page.drawLine({
    start: { x: x + 18, y: cy - h * 0.20 },
    end: { x: x + w - 18, y: cy - h * 0.20 },
    thickness: 0.5, color: c(GOLD),
  });

  /// Year внизу
  if (year) {
    drawCenteredText(page, String(year), cx, cy - h * 0.30, h * 0.12,
      fonts.cormorantItalic, c(GOLD_DEEP));
  }
};

const CREAM_BG_OUTSIDE = { r: 249, g: 244, b: 232 };

/// S26 — Engraved Metal Plate: horizontal brushed gold rectangle (NO circle)
const drawSealMetalPlate: DrawSeal = (page, fonts, logoPng, cx, cy, r, year) => {
  /// Horizontal aspect 1.8:1
  const w = r * 2.1;
  const h = r * 1.05;
  const x = cx - w / 2;
  const y = cy - h / 2;

  /// Shadow
  page.drawRectangle({
    x: x + 1, y: y - 1.5, width: w, height: h,
    color: c({ r: 0, g: 0, b: 0 }), borderWidth: 0, opacity: 0.18,
  });

  /// Brushed metal — gradient via 5 horizontal bands (top lighter to bottom darker)
  const bands = 8;
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    const r2 = GOLD_PALE.r + (GOLD_DEEP.r - GOLD_PALE.r) * t;
    const g2 = GOLD_PALE.g + (GOLD_DEEP.g - GOLD_PALE.g) * t;
    const b2 = GOLD_PALE.b + (GOLD_DEEP.b - GOLD_PALE.b) * t;
    page.drawRectangle({
      x, y: y + h - (i + 1) * (h / bands),
      width: w, height: h / bands + 0.5,
      color: c({ r: r2, g: g2, b: b2 }), borderWidth: 0,
    });
  }

  /// Inner darker rectangle (engraved area)
  const inset = 5;
  page.drawRectangle({
    x: x + inset, y: y + inset, width: w - 2 * inset, height: h - 2 * inset,
    borderColor: c(GOLD_DEEP), borderWidth: 0.7, color: undefined,
  });
  page.drawRectangle({
    x: x + inset + 2, y: y + inset + 2,
    width: w - 2 * inset - 4, height: h - 2 * inset - 4,
    borderColor: c(GOLD_PALE), borderWidth: 0.4, color: undefined,
  });

  /// Engraved text — UIMP (recessed look = darker color)
  const text = 'UIMP';
  const size = h * 0.32;
  const font = fonts.interSemiBold;
  const tracking = h * 0.05;
  let tw = 0;
  for (const ch of text) tw += font.widthOfTextAtSize(ch, size) + tracking;
  tw -= tracking;
  let tx = cx - tw / 2;
  for (const ch of text) {
    /// Engraved (recessed) — shadow up-left, highlight down-right
    page.drawText(ch, { x: tx - 0.5, y: cy + h * 0.04 + 0.5, size, font, color: c(GOLD_DEEP) });
    page.drawText(ch, { x: tx + 0.5, y: cy + h * 0.04 - 0.5, size, font, color: c(GOLD_PALE) });
    page.drawText(ch, { x: tx, y: cy + h * 0.04, size, font, color: c({ r: 110, g: 78, b: 28 }) });
    tx += font.widthOfTextAtSize(ch, size) + tracking;
  }

  /// Year малим знизу
  if (year) {
    drawCenteredText(page, `· ${year} ·`, cx, cy - h * 0.30, h * 0.14, font, c(GOLD_DEEP));
  }
};

/// S27 — Heraldic Shield: вертикальна форма щита
const drawSealShield: DrawSeal = (page, fonts, logoPng, cx, cy, r, year) => {
  const w = r * 1.5;
  const h = r * 1.85;
  const top = cy + h / 2;
  const bot = cy - h / 2;
  const left = cx - w / 2;
  const right = cx + w / 2;

  /// Shield path: rounded top, pointed bottom (going through center bottom point)
  const shieldPath = (offX = 0, offY = 0) =>
    `M ${left + offX} ${top + offY}
     L ${right + offX} ${top + offY}
     L ${right + offX} ${cy - h * 0.20 + offY}
     Q ${right + offX} ${bot + h * 0.18 + offY} ${cx + offX} ${bot + offY}
     Q ${left + offX} ${bot + h * 0.18 + offY} ${left + offX} ${cy - h * 0.20 + offY}
     L ${left + offX} ${top + offY}
     Z`;

  /// Drop shadow
  page.drawSvgPath(shieldPath(2, -2), { color: c({ r: 0, g: 0, b: 0 }), borderWidth: 0, opacity: 0.18 });

  /// Outer gold border (large shield)
  page.drawSvgPath(shieldPath(), { color: c(GOLD), borderWidth: 0 });

  /// Inner green field (shield slightly smaller)
  const inset = 4;
  const ileft = left + inset, iright = right - inset, itop = top - inset, ibot = bot + inset;
  const innerPath = `M ${ileft} ${itop}
    L ${iright} ${itop}
    L ${iright} ${cy - h * 0.20 + 2}
    Q ${iright} ${ibot + h * 0.16} ${cx} ${ibot}
    Q ${ileft} ${ibot + h * 0.16} ${ileft} ${cy - h * 0.20 + 2}
    L ${ileft} ${itop} Z`;
  page.drawSvgPath(innerPath, { color: c(GREEN_DEEP), borderWidth: 0 });

  /// Logo центром
  drawLogo(page, logoPng, cx, cy + h * 0.05, w * 0.85);

  /// Decorative chevron-line knd мала ornament нижче logo
  page.drawLine({
    start: { x: cx - w * 0.20, y: cy - h * 0.27 },
    end: { x: cx - 4, y: cy - h * 0.32 },
    thickness: 0.8, color: c(GOLD), opacity: 0.85,
  });
  page.drawLine({
    start: { x: cx + 4, y: cy - h * 0.32 },
    end: { x: cx + w * 0.20, y: cy - h * 0.27 },
    thickness: 0.8, color: c(GOLD), opacity: 0.85,
  });
  drawDiamond(page, cx, cy - h * 0.34, 2.5, c(GOLD_PALE));

  /// Year в "ribbon" знизу
  if (year) {
    const yearStr = String(year);
    const ySize = h * 0.075;
    drawCenteredText(page, yearStr, cx, cy - h * 0.42, ySize, fonts.interSemiBold, c(GOLD));
  }
};

/// S28 — Banner Ribbon: horizontal ribbon with notched ends
const drawSealBanner: DrawSeal = (page, fonts, logoPng, cx, cy, r, year) => {
  /// Banner — horizontal rectangle з V-cut на лівому і правому кінцях
  const w = r * 2.2;
  const h = r * 0.85;
  const x = cx - w / 2;
  const y = cy - h / 2;
  const tail = h * 0.4;       // глибина V-cut

  /// Shadow
  const shadowPath = (offX = 0, offY = 0) =>
    `M ${x + offX} ${y + offY}
     L ${x + w + offX} ${y + offY}
     L ${x + w - tail + offX} ${cy + offY}
     L ${x + w + offX} ${y + h + offY}
     L ${x + offX} ${y + h + offY}
     L ${x + tail + offX} ${cy + offY}
     Z`;
  page.drawSvgPath(shadowPath(2, -2), { color: c({ r: 0, g: 0, b: 0 }), borderWidth: 0, opacity: 0.15 });

  /// Banner body — gold з gradient (light top → dark bottom)
  const bands = 6;
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    const r2 = GOLD_PALE.r + (GOLD_DEEP.r - GOLD_PALE.r) * t;
    const g2 = GOLD_PALE.g + (GOLD_DEEP.g - GOLD_PALE.g) * t;
    const b2 = GOLD_PALE.b + (GOLD_DEEP.b - GOLD_PALE.b) * t;
    /// Use clipping by drawing horizontal bands inside ribbon shape — простіше: окрема SVG полоска
    const bandY1 = y + h - (i + 1) * (h / bands);
    const bandY2 = y + h - i * (h / bands);
    /// V-cut adapted per band — спрощено: малюємо звичайний горизонтальний bar
    /// потім накладаємо ribbon shape поверх для clipping... pdf-lib без clipping API,
    /// тому: нехай тіло буде однієї кольорової secondary гладкої.
    if (i === 0) {
      page.drawSvgPath(shadowPath(), { color: c({ r: r2, g: g2, b: b2 }), borderWidth: 0 });
    }
  }
  /// Простіше — solid gold банер
  page.drawSvgPath(shadowPath(), { color: c(GOLD), borderWidth: 0 });

  /// Внутрішня recessed зона (трохи темніший gold)
  page.drawSvgPath(
    `M ${x + 4} ${y + 4}
     L ${x + w - 4} ${y + 4}
     L ${x + w - tail + 1} ${cy}
     L ${x + w - 4} ${y + h - 4}
     L ${x + 4} ${y + h - 4}
     L ${x + tail - 1} ${cy} Z`,
    { color: c(GOLD_DEEP), borderWidth: 0, opacity: 0.4 },
  );

  /// UIMP центром (engraved)
  const text = 'UIMP';
  const size = h * 0.42;
  const font = fonts.interSemiBold;
  const tracking = h * 0.06;
  let tw = 0;
  for (const ch of text) tw += font.widthOfTextAtSize(ch, size) + tracking;
  tw -= tracking;
  let tx = cx - tw / 2;
  for (const ch of text) {
    page.drawText(ch, { x: tx + 0.6, y: cy - size * 0.30 - 0.6, size, font, color: c(GOLD_PALE) });
    page.drawText(ch, { x: tx, y: cy - size * 0.30, size, font, color: c({ r: 102, g: 70, b: 24 }) });
    tx += font.widthOfTextAtSize(ch, size) + tracking;
  }

  /// Year tiny під banner
  if (year) {
    drawCenteredText(page, String(year), cx, y - h * 0.30, h * 0.20,
      fonts.cormorantItalic, c(GOLD_DEEP));
  }
};

/// S29 — Gold Coin: flat metallic gold disc (NO green wax)
const drawSealCoin: DrawSeal = (page, fonts, logoPng, cx, cy, r, year) => {
  /// Drop shadow
  for (let i = 0; i < 3; i++) {
    page.drawCircle({
      x: cx, y: cy - i * 0.6, size: r + 1.5 - i * 0.4,
      color: c({ r: 0, g: 0, b: 0 }), borderWidth: 0, opacity: 0.10,
    });
  }

  /// Notched edge (32 ridges)
  const ridges = 36;
  for (let i = 0; i < ridges; i++) {
    const a = (i / ridges) * Math.PI * 2;
    page.drawCircle({
      x: cx + r * Math.cos(a), y: cy + r * Math.sin(a),
      size: 1.8, color: c(GOLD_DEEP), borderWidth: 0,
    });
  }

  /// Body — gold coin з subtle dome-light (lighter top)
  page.drawCircle({ x: cx, y: cy, size: r - 1, color: c(GOLD_DEEP), borderWidth: 0 });
  page.drawCircle({ x: cx, y: cy + 0.8, size: r - 1.5, color: c(GOLD), borderWidth: 0 });
  page.drawCircle({
    x: cx, y: cy + r * 0.20, size: r * 0.65,
    color: c(GOLD_LIGHT), borderWidth: 0, opacity: 0.45,
  });

  /// Engraved inner ring
  page.drawCircle({
    x: cx, y: cy, size: r - 6,
    borderColor: c(GOLD_DEEP), borderWidth: 0.7, color: undefined,
  });

  /// Engraved logo (recessed dark gold)
  const aspect = logoPng.height / logoPng.width;
  const logoSize = r * 1.05;
  /// Shadow first (offset)
  page.drawImage(logoPng, {
    x: cx - logoSize / 2 + 1, y: cy - (logoSize * aspect) / 2 - 1,
    width: logoSize, height: logoSize * aspect, opacity: 0.25,
  });
  /// Main — gold logo
  page.drawImage(logoPng, {
    x: cx - logoSize / 2, y: cy - (logoSize * aspect) / 2,
    width: logoSize, height: logoSize * aspect, opacity: 0.85,
  });

  /// Year малий знизу
  if (year) {
    const yearStr = String(year);
    const ySize = r * 0.16;
    drawCenteredText(page, yearStr, cx, cy - r * 0.65, ySize, fonts.interSemiBold, c(GOLD_DEEP));
  }
};

/// S30 — Marble Plaque: flat cream "marble" oval з engraved dark text
const drawSealMarble: DrawSeal = (page, fonts, logoPng, cx, cy, r, year) => {
  /// Cream marble body — solid cream без dome
  page.drawCircle({ x: cx + 1, y: cy - 1, size: r, color: c({ r: 0, g: 0, b: 0 }), borderWidth: 0, opacity: 0.10 });
  page.drawCircle({ x: cx, y: cy, size: r, color: c(CREAM), borderWidth: 0 });

  /// Subtle marble veins — 3 тонких зігнутих лінії (decorative)
  const veins = [
    [-0.4, 0.5, 0.3, 0.2],
    [0.2, -0.3, 0.5, 0.1],
    [-0.5, -0.2, -0.1, -0.5],
  ];
  for (const [x1f, y1f, x2f, y2f] of veins) {
    page.drawLine({
      start: { x: cx + r * x1f, y: cy + r * y1f },
      end: { x: cx + r * x2f, y: cy + r * y2f },
      thickness: 0.4, color: c({ r: 200, g: 192, b: 176 }), opacity: 0.5,
    });
  }

  /// Тонка double gold рамка
  page.drawCircle({
    x: cx, y: cy, size: r - 1,
    borderColor: c(GOLD_DEEP), borderWidth: 0.8, color: undefined,
  });
  page.drawCircle({
    x: cx, y: cy, size: r - 4,
    borderColor: c(GOLD), borderWidth: 0.5, color: undefined,
  });

  /// Engraved UIMP центром (dark green/black, з inner shadow)
  const text = 'UIMP';
  const size = r * 0.36;
  const font = fonts.interSemiBold;
  const tracking = r * 0.05;
  let tw = 0;
  for (const ch of text) tw += font.widthOfTextAtSize(ch, size) + tracking;
  tw -= tracking;
  let tx = cx - tw / 2;
  const baseY = cy - size * 0.20;
  for (const ch of text) {
    /// Engraved: highlight нижче-праворуч + main dark
    page.drawText(ch, { x: tx + 0.5, y: baseY - 0.5, size, font, color: c(CREAM) });
    page.drawText(ch, { x: tx, y: baseY, size, font, color: c(GREEN_DEEP) });
    tx += font.widthOfTextAtSize(ch, size) + tracking;
  }

  /// Decorative line + diamond
  page.drawLine({
    start: { x: cx - r * 0.3, y: baseY - size * 0.30 },
    end: { x: cx + r * 0.3, y: baseY - size * 0.30 },
    thickness: 0.6, color: c(GOLD_DEEP),
  });
  drawDiamond(page, cx, baseY - size * 0.30, 2, c(GOLD));

  /// Year engraved нижче
  if (year) {
    drawCenteredText(page, String(year), cx, cy - r * 0.55, r * 0.13,
      fonts.cormorantItalic, c(GREEN_DEEP));
  }
};

/// S31 — Pendant: vertical ornament з loop зверху (як висячий)
const drawSealPendant: DrawSeal = (page, fonts, logoPng, cx, cy, r, year) => {
  /// Loop ring зверху
  const loopY = cy + r * 1.05;
  page.drawCircle({
    x: cx, y: loopY, size: r * 0.18,
    borderColor: c(GOLD), borderWidth: 2.5, color: undefined,
  });
  page.drawCircle({
    x: cx, y: loopY, size: r * 0.18 - 1,
    borderColor: c(GOLD_DEEP), borderWidth: 0.5, color: undefined,
  });

  /// Vertical short connector (chain link) між loop і body
  page.drawLine({
    start: { x: cx, y: loopY - r * 0.18 - 1 },
    end: { x: cx, y: cy + r * 0.92 },
    thickness: 1.5, color: c(GOLD),
  });

  /// Drop shadow
  for (let i = 0; i < 3; i++) {
    page.drawCircle({
      x: cx, y: cy - i * 0.6, size: r + 1.5 - i * 0.4,
      color: c({ r: 0, g: 0, b: 0 }), borderWidth: 0, opacity: 0.10,
    });
  }

  /// Pendant body — gold rim + green inner
  page.drawCircle({ x: cx, y: cy, size: r, color: c(GOLD), borderWidth: 0 });
  page.drawCircle({ x: cx, y: cy + 0.8, size: r - 0.5, color: c(GOLD_LIGHT), borderWidth: 0, opacity: 0.7 });
  page.drawCircle({ x: cx, y: cy, size: r - 4, color: c(GREEN_DEEP), borderWidth: 0 });
  page.drawCircle({
    x: cx, y: cy, size: r - 5.5,
    borderColor: c(GOLD_LIGHT), borderWidth: 0.6, color: c(GREEN_DEEP),
  });

  /// Лого центром
  drawLogo(page, logoPng, cx, cy + r * 0.04, (r - 5) * 1.3);

  /// Дрібний UIMP/year curved bottom
  if (year) {
    const yearStr = `· ${year} ·`;
    const ySize = r * 0.10;
    drawTextOnArc(page, yearStr, cx, cy, r * 0.78, -Math.PI / 2, ySize,
      fonts.interSemiBold, c(GOLD_LIGHT), { direction: 'ccw', tracking: 1 });
  }
};

/// S32 — Crest + Banner: medallion зверху + scroll banner з roком знизу
const drawSealCrestBanner: DrawSeal = (page, fonts, logoPng, cx, cy, r, year) => {
  /// Medallion (compact wax dome) у верхній частині
  const medCY = cy + r * 0.20;
  const medR = r * 0.78;

  /// Wax body
  drawWaxBody(page, cx, medCY, medR, WAX_GREEN_EDGE, WAX_GREEN_BODY, WAX_GREEN_LIT);
  drawEmbossedLogo(page, logoPng, cx, medCY, medR * 1.10);

  /// Banner внизу — горизонтальна стрічка з V-cut
  const bw = r * 1.7;
  const bh = r * 0.42;
  const bx = cx - bw / 2;
  const by = cy - r * 0.85;
  const tail = bh * 0.35;

  /// Banner shape — overlap трохи з medallion (банер під ним)
  const bannerPath =
    `M ${bx} ${by}
     L ${bx + bw} ${by}
     L ${bx + bw - tail} ${by + bh / 2}
     L ${bx + bw} ${by + bh}
     L ${bx} ${by + bh}
     L ${bx + tail} ${by + bh / 2}
     Z`;

  /// Shadow
  page.drawSvgPath(
    `M ${bx + 1.5} ${by - 1.5}
     L ${bx + bw + 1.5} ${by - 1.5}
     L ${bx + bw - tail + 1.5} ${by + bh / 2 - 1.5}
     L ${bx + bw + 1.5} ${by + bh - 1.5}
     L ${bx + 1.5} ${by + bh - 1.5}
     L ${bx + tail + 1.5} ${by + bh / 2 - 1.5}
     Z`,
    { color: c({ r: 0, g: 0, b: 0 }), borderWidth: 0, opacity: 0.15 },
  );

  /// Banner body — gold
  page.drawSvgPath(bannerPath, { color: c(GOLD), borderWidth: 0 });
  /// Внутрішня recessed зона
  page.drawSvgPath(
    `M ${bx + 3} ${by + 3}
     L ${bx + bw - 3} ${by + 3}
     L ${bx + bw - tail + 1.5} ${by + bh / 2}
     L ${bx + bw - 3} ${by + bh - 3}
     L ${bx + 3} ${by + bh - 3}
     L ${bx + tail - 1.5} ${by + bh / 2} Z`,
    { color: c(GOLD_DEEP), borderWidth: 0, opacity: 0.35 },
  );

  /// Year/UIMP banner text
  const txt = year ? String(year) : 'UIMP';
  const tSize = bh * 0.50;
  const font = fonts.interSemiBold;
  const tw = font.widthOfTextAtSize(txt, tSize);
  page.drawText(txt, {
    x: cx - tw / 2 + 0.4, y: by + bh / 2 - tSize * 0.30 - 0.4,
    size: tSize, font, color: c(GOLD_PALE),
  });
  page.drawText(txt, {
    x: cx - tw / 2, y: by + bh / 2 - tSize * 0.30,
    size: tSize, font, color: c({ r: 92, g: 62, b: 22 }),
  });
};

function drawCenteredText(
  page: PDFPage, text: string, cx: number, y: number,
  size: number, font: PDFFont, color: ReturnType<typeof rgb>,
) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: cx - w / 2, y, size, font, color });
}

/* ----- Solid 3D disc (без inner highlight кола в колі) ----- */

/// Малює суцільний 3D диск БЕЗ внутрішнього освітленого кола.
/// 3D ефект досягається через:
///  - drop shadow під диском (5 шарів з opacity)
///  - 2-tone beveled rim (light зверху + dark знизу) на самому краю
///  - solid uniform body всередині (без gradient/highlight)
function drawSolid3DDisc(
  page: PDFPage,
  cx: number, cy: number, r: number,
  body: { r: number; g: number; b: number },
  rimLight: { r: number; g: number; b: number },
  rimDark: { r: number; g: number; b: number },
  options: { ridges?: boolean; goldRim?: boolean; glossy?: boolean; heavyBevel?: boolean } = {},
) {
  /// Heavy drop shadow для 3D lift (5 шарів з кумулятивною opacity)
  for (let i = 0; i < 5; i++) {
    page.drawCircle({
      x: cx, y: cy - i * 1.0, size: r + 3 - i * 0.5,
      color: c({ r: 0, g: 0, b: 0 }), borderWidth: 0, opacity: 0.07,
    });
  }

  /// Optional gold thin outer rim (для goldRim варіанта)
  if (options.goldRim) {
    page.drawCircle({ x: cx, y: cy - 0.8, size: r + 1.8, color: c(GOLD_DEEP), borderWidth: 0 });
    page.drawCircle({ x: cx, y: cy + 0.8, size: r + 1.8, color: c(GOLD_PALE), borderWidth: 0 });
    page.drawCircle({ x: cx, y: cy, size: r + 1.2, color: c(GOLD), borderWidth: 0 });
  }

  /// 3D rim — 2 offset background discs створюють beveled edge видимий тільки по краю.
  /// Body face перекриває їх центр, лишаючи тонкі смуги lightRim/darkRim на самому краю.
  page.drawCircle({ x: cx, y: cy - 1.4, size: r, color: c(rimDark), borderWidth: 0 });
  page.drawCircle({ x: cx, y: cy + 1.4, size: r, color: c(rimLight), borderWidth: 0 });

  /// Solid body face — uniform color (БЕЗ inner gradient!)
  page.drawCircle({ x: cx, y: cy, size: r - 1.5, color: c(body), borderWidth: 0 });

  /// Heavy bevel — додатковий тонкий dark ring всередині (підкреслює thickness)
  if (options.heavyBevel) {
    page.drawCircle({
      x: cx, y: cy, size: r - 2.5,
      borderColor: c(rimDark), borderWidth: 0.6, color: c(body),
    });
  }

  /// Glossy — субтильний specular highlight зверху (горизонтальна еліптична smudge)
  if (options.glossy) {
    page.drawEllipse({
      x: cx, y: cy + r * 0.55,
      xScale: r * 0.70, yScale: r * 0.10,
      color: c(rimLight), borderWidth: 0, opacity: 0.45,
    });
  }

  /// Ribbed / coin notches на самому краю
  if (options.ridges) {
    const ridges = 36;
    for (let i = 0; i < ridges; i++) {
      const a = (i / ridges) * Math.PI * 2;
      page.drawCircle({
        x: cx + r * Math.cos(a), y: cy + r * Math.sin(a),
        size: 1.0, color: c(rimDark), borderWidth: 0,
      });
    }
  }
}

/// Heavy / thick UIMP letters (5-pass faux-bold) + decorative line + CERTIFIED · year.
/// Layout як S7 але з товстішим шрифтом і параметрами під різні кольорові схеми.
function drawHeavyTypoBlock(
  page: PDFPage,
  fonts: Fonts,
  cx: number, cy: number, r: number,
  year: number | undefined,
  shadowColor: ReturnType<typeof rgb>,
  highlightColor: ReturnType<typeof rgb> = c(GOLD_PALE),
  mainColor: ReturnType<typeof rgb> = c(GOLD),
  decoColor: ReturnType<typeof rgb> = c(GOLD),
) {
  const text = 'UIMP';
  const size = r * 0.50;
  const font = fonts.cormorantItalic;
  const tw = font.widthOfTextAtSize(text, size);
  const x0 = cx - tw / 2;
  const baseY = cy + size * 0.05;

  /// 5-pass faux-bold: shadow + highlight + 3 base passes (left, right, center)
  /// Створює дуже товсту і об'ємну "embossed" типографію.
  /// Pass 1: drop-down shadow
  page.drawText(text, { x: x0 + 1.4, y: baseY - 1.2, size, font, color: shadowColor });
  /// Pass 2: top-left highlight
  page.drawText(text, { x: x0 - 0.7, y: baseY + 0.7, size, font, color: highlightColor });
  /// Pass 3-5: thick body (3 passes для weight)
  page.drawText(text, { x: x0, y: baseY, size, font, color: mainColor });
  page.drawText(text, { x: x0 + 0.6, y: baseY, size, font, color: mainColor });
  page.drawText(text, { x: x0 + 0.3, y: baseY + 0.3, size, font, color: mainColor });

  /// Decorative line + diamond під UIMP
  page.drawLine({
    start: { x: cx - r * 0.42, y: cy - r * 0.18 },
    end: { x: cx - 6, y: cy - r * 0.18 },
    thickness: 0.7, color: decoColor, opacity: 0.75,
  });
  page.drawLine({
    start: { x: cx + 6, y: cy - r * 0.18 },
    end: { x: cx + r * 0.42, y: cy - r * 0.18 },
    thickness: 0.7, color: decoColor, opacity: 0.75,
  });
  drawDiamond(page, cx, cy - r * 0.18, 2.2, highlightColor);

  /// CERTIFIED · year
  if (year) {
    const sub = `CERTIFIED · ${year}`;
    const sSize = r * 0.13;
    const sFont = fonts.interSemiBold;
    /// Embossed effect: shadow + highlight + main
    drawEmbossedText(page, sub, cx, cy - r * 0.36, sSize, sFont,
      mainColor, shadowColor, highlightColor, 1.8);
  }
}

/* ----- 8 нових варіантів S41-S48 на базі S7 ----- */

/// S41 — Classic Green 3D (solid wax disc, no inner circle, heavy UIMP)
const drawSeal3DClassic: DrawSeal = (page, fonts, logoPng, cx, cy, r, year) => {
  drawSolid3DDisc(page, cx, cy, r, WAX_GREEN_BODY, WAX_GREEN_LIT, WAX_GREEN_EDGE);
  drawHeavyTypoBlock(page, fonts, cx, cy, r, year, c(WAX_GREEN_EDGE));
};

/// S42 — + Thin Gold Rim (зовнішня тонка золота рамка)
const drawSeal3DRim: DrawSeal = (page, fonts, logoPng, cx, cy, r, year) => {
  drawSolid3DDisc(page, cx, cy, r, WAX_GREEN_BODY, WAX_GREEN_LIT, WAX_GREEN_EDGE,
    { goldRim: true });
  drawHeavyTypoBlock(page, fonts, cx, cy, r, year, c(WAX_GREEN_EDGE));
};

/// S43 — Heavy Bevel (товстіший beveled edge — додаткове dark ring всередині)
const drawSeal3DBevel: DrawSeal = (page, fonts, logoPng, cx, cy, r, year) => {
  drawSolid3DDisc(page, cx, cy, r, WAX_GREEN_BODY, WAX_GREEN_LIT, WAX_GREEN_EDGE,
    { heavyBevel: true });
  drawHeavyTypoBlock(page, fonts, cx, cy, r, year, c(WAX_GREEN_EDGE));
};

/// S44 — Glossy Top (subtle specular highlight — horizontal ellipse near top)
const drawSeal3DGlossy: DrawSeal = (page, fonts, logoPng, cx, cy, r, year) => {
  drawSolid3DDisc(page, cx, cy, r, WAX_GREEN_BODY, WAX_GREEN_LIT, WAX_GREEN_EDGE,
    { glossy: true });
  drawHeavyTypoBlock(page, fonts, cx, cy, r, year, c(WAX_GREEN_EDGE));
};

/// S45 — Ridged Edge (coin-like notches на periметрі)
const drawSeal3DRidged: DrawSeal = (page, fonts, logoPng, cx, cy, r, year) => {
  drawSolid3DDisc(page, cx, cy, r, WAX_GREEN_BODY, WAX_GREEN_LIT, WAX_GREEN_EDGE,
    { ridges: true });
  drawHeavyTypoBlock(page, fonts, cx, cy, r, year, c(WAX_GREEN_EDGE));
};

/// S46 — Burgundy 3D
const drawSeal3DBurgundy: DrawSeal = (page, fonts, logoPng, cx, cy, r, year) => {
  drawSolid3DDisc(page, cx, cy, r, WAX_WINE_BODY, WAX_WINE_LIT, WAX_WINE_EDGE);
  drawHeavyTypoBlock(page, fonts, cx, cy, r, year, c(WAX_WINE_EDGE));
};

/// S47 — Charcoal 3D
const drawSeal3DCharcoal: DrawSeal = (page, fonts, logoPng, cx, cy, r, year) => {
  drawSolid3DDisc(page, cx, cy, r, WAX_CHARCOAL_BODY, WAX_CHARCOAL_LIT, WAX_CHARCOAL_EDGE);
  drawHeavyTypoBlock(page, fonts, cx, cy, r, year, c(WAX_CHARCOAL_EDGE));
};

/// S48 — Navy 3D
const drawSeal3DNavy: DrawSeal = (page, fonts, logoPng, cx, cy, r, year) => {
  drawSolid3DDisc(page, cx, cy, r, WAX_NAVY_BODY, WAX_NAVY_LIT, WAX_NAVY_EDGE);
  drawHeavyTypoBlock(page, fonts, cx, cy, r, year, c(WAX_NAVY_EDGE));
};

/* ----- S49: Senior-designer polished S42 ----- */

/// S49 — Polished (senior designer): refined S42 з товстішим UIMP + gold sheen.
/// Все деталі вилизані: 13-pass UIMP без розмиття, diagonal gold reflection,
/// thinner refined decorative ornament, proper tracking на CERTIFIED.
const drawSeal3DPolished: DrawSeal = (page, fonts, logoPng, cx, cy, r, year) => {
  /// === Disc base (S42 — green wax + gold rim, без inner highlight) ===

  /// Soft drop shadow — більше шарів, м'якше розпорошений
  for (let i = 0; i < 7; i++) {
    page.drawCircle({
      x: cx, y: cy - i * 0.9, size: r + 4 - i * 0.5,
      color: c({ r: 0, g: 0, b: 0 }), borderWidth: 0, opacity: 0.045,
    });
  }

  /// 2-tone gold rim (зовнішня тонка золота рамка)
  page.drawCircle({ x: cx, y: cy - 0.9, size: r + 1.8, color: c(GOLD_DEEP), borderWidth: 0 });
  page.drawCircle({ x: cx, y: cy + 0.9, size: r + 1.8, color: c(GOLD_PALE), borderWidth: 0 });
  page.drawCircle({ x: cx, y: cy, size: r + 1.2, color: c(GOLD), borderWidth: 0 });

  /// 3D rim — beveled edge (light top + dark bottom)
  page.drawCircle({ x: cx, y: cy - 1.5, size: r, color: c(WAX_GREEN_EDGE), borderWidth: 0 });
  page.drawCircle({ x: cx, y: cy + 1.5, size: r, color: c({ r: 50, g: 82, b: 68 }), borderWidth: 0 });

  /// Solid green body (НІЯКОГО внутрішнього gradient)
  page.drawCircle({ x: cx, y: cy, size: r - 1.8, color: c(WAX_GREEN_BODY), borderWidth: 0 });

  /// === Fundamental UIMP — Cormorant Regular (upright Roman) з 3D extrusion ===
  /// Upright Roman serif (як класичні latin inscriptions) дає монументальний
  /// "rock-solid foundation" feel. Multi-layer extrusion створює видиму глибину.

  /// === Композиція побудована для відчуття "велич":
  ///   • UIMP — монументальний, дещо вище центру (де природньо фокусується око)
  ///   • Substantial ornament — 3 діаманти + 2 фланкуючі лінії (symmetric flourish)
  ///   • CERTIFIED — sans-serif tracked small caps (supporting)
  ///   • 2026 — Italic Cormorant numerals (elegant focal year, окремим рядком)
  /// Hierarchy: huge → break → small support → elegant year ===

  const text = 'UIMP';
  const size = r * 0.62;
  const font = fonts.cormorantRegular;
  const tracking = r * 0.05;

  let totalW = 0;
  const widths: number[] = [];
  for (const ch of text) {
    const w = font.widthOfTextAtSize(ch, size);
    widths.push(w);
    totalW += w + tracking;
  }
  totalW -= tracking;
  const x0 = cx - totalW / 2;
  /// UIMP трохи нижче центру але не низько — лишає місце для stacked CERTIFIED + 2026
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

  /// === 3D EXTRUSION — 12 layers для більшої глибини ===
  const extrusionDepth = 12;
  for (let i = extrusionDepth; i >= 1; i--) {
    const t = (extrusionDepth - i) / extrusionDepth;
    const layerColor = c({
      r: Math.round(GOLD_DEEP.r + (GOLD.r - GOLD_DEEP.r) * t * 0.7),
      g: Math.round(GOLD_DEEP.g + (GOLD.g - GOLD_DEEP.g) * t * 0.7),
      b: Math.round(GOLD_DEEP.b + (GOLD.b - GOLD_DEEP.b) * t * 0.7),
    });
    drawTracked(i * 0.55, -i * 0.45, layerColor);
  }

  /// === Heavy perimeter — 32 passes (4 rings × 8 directions) для масивності ===
  const dirs8: Array<[number, number]> = [
    [0, 1], [0.71, 0.71], [1, 0], [0.71, -0.71],
    [0, -1], [-0.71, -0.71], [-1, 0], [-0.71, 0.71],
  ];
  for (const [dx, dy] of dirs8) drawTracked(dx * 1.30, dy * 1.30, c(GOLD));
  for (const [dx, dy] of dirs8) drawTracked(dx * 0.85, dy * 0.85, c(GOLD));
  for (const [dx, dy] of dirs8) drawTracked(dx * 0.45, dy * 0.45, c(GOLD));
  for (const [dx, dy] of dirs8) drawTracked(dx * 0.20, dy * 0.20, c(GOLD));

  /// === Top highlight — pale gold rim-light ===
  drawTracked(-0.6, 0.7, c(GOLD_PALE));

  /// === MAIN top face ===
  drawTracked(0, 0, c(GOLD));

  /// === Restrained ornament — clean horizontal "title-block" divider ===
  /// Senior designer move: restraint > over-decoration. Симетрично, чисто, благородно.

  const ornY = cy - r * 0.46;
  /// Solid horizontal gold line з end-caps
  page.drawLine({
    start: { x: cx - r * 0.36, y: ornY },
    end: { x: cx + r * 0.36, y: ornY },
    thickness: 0.7, color: c(GOLD), opacity: 0.85,
  });
  /// End caps — маленькі gold сферички
  page.drawCircle({ x: cx - r * 0.36, y: ornY, size: 1.4, color: c(GOLD), borderWidth: 0 });
  page.drawCircle({ x: cx + r * 0.36, y: ornY, size: 1.4, color: c(GOLD), borderWidth: 0 });

  /// Central "пеrlа" — велика gold сфера з halo
  page.drawCircle({ x: cx, y: ornY - 0.3, size: 4.5, color: c(GOLD_DEEP), borderWidth: 0, opacity: 0.5 });
  page.drawCircle({ x: cx, y: ornY, size: 3.2, color: c(GOLD), borderWidth: 0 });
  page.drawCircle({ x: cx, y: ornY + 0.4, size: 1.6, color: c(GOLD_PALE), borderWidth: 0 });

  /// === CERTIFIED — small caps sans-serif tracked ===

  const certText = 'CERTIFIED';
  const certSize = r * 0.085;
  const certFont = fonts.interRegular;
  const certTracking = r * 0.045;
  const certY = cy - r * 0.58;

  let certTotalW = 0;
  const certWidths: number[] = [];
  for (const ch of certText) {
    const w = certFont.widthOfTextAtSize(ch, certSize);
    certWidths.push(w);
    certTotalW += w + certTracking;
  }
  certTotalW -= certTracking;
  let cx0 = cx - certTotalW / 2;
  for (let i = 0; i < certText.length; i++) {
    page.drawText(certText[i], { x: cx0, y: certY, size: certSize, font: certFont, color: c(GOLD) });
    cx0 += certWidths[i] + certTracking;
  }

  /// === Year — Italic Cormorant numerals, окремий рядок під CERTIFIED ===

  if (year) {
    const yearStr = String(year);
    const yearSize = r * 0.13;
    const yearFont = fonts.cormorantItalic;
    const yearY = cy - r * 0.74;
    const yearW = yearFont.widthOfTextAtSize(yearStr, yearSize);

    /// Subtle 2-pass embossed для слabку depth
    page.drawText(yearStr, {
      x: cx - yearW / 2 + 0.5, y: yearY - 0.4,
      size: yearSize, font: yearFont, color: c(GOLD_DEEP),
    });
    page.drawText(yearStr, {
      x: cx - yearW / 2, y: yearY,
      size: yearSize, font: yearFont, color: c(GOLD),
    });
  }
};

/* ----- Geometric / decorative variants (S33-S40) ----- */

/// S33 — Sunburst Disc: круг + 16 gold променів, що розходяться від центру
const drawSealSunburst: DrawSeal = (page, fonts, logoPng, cx, cy, r, year) => {
  /// 16 gold променів — трикутники, що йдуть від ядра до зовнішнього радіусу
  const rays = 16;
  const innerR = r * 0.65;
  const outerR = r * 1.0;
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2;
    const halfAngle = (Math.PI * 2 / rays) * 0.30;     // ширина променя
    const a1 = a - halfAngle;
    const a2 = a + halfAngle;
    /// Trапеція: 2 точки внутрішніх + 1 зовнішня
    const path =
      `M ${cx + innerR * Math.cos(a1)} ${cy + innerR * Math.sin(a1)}
       L ${cx + outerR * Math.cos(a)} ${cy + outerR * Math.sin(a)}
       L ${cx + innerR * Math.cos(a2)} ${cy + innerR * Math.sin(a2)} Z`;
    page.drawSvgPath(path, { color: c(GOLD), borderWidth: 0 });
  }

  /// Центральне зелене коло (ядро)
  page.drawCircle({ x: cx, y: cy, size: innerR, color: c(GREEN_DEEP), borderWidth: 0 });
  /// Тонке gold кільце
  page.drawCircle({
    x: cx, y: cy, size: innerR - 1.5,
    borderColor: c(GOLD_LIGHT), borderWidth: 0.7, color: c(GREEN_DEEP),
  });

  /// Лого центром
  drawLogo(page, logoPng, cx, cy, innerR * 1.2);

  /// Year малий внизу
  if (year) {
    drawCenteredText(page, String(year), cx, cy - innerR * 0.62, innerR * 0.14,
      fonts.interSemiBold, c(GOLD_LIGHT));
  }
};

/// S34 — Rosette: 8 пелюсток (overlapping circles) + green core + logo
const drawSealRosette: DrawSeal = (page, fonts, logoPng, cx, cy, r, year) => {
  const petals = 8;
  const petalCenterR = r * 0.55;        // на якому радіусі центри пелюсток
  const petalR = r * 0.42;              // радіус кожної пелюстки

  /// Малюємо пелюстки (золоті)
  /// Drop shadow first
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2;
    page.drawCircle({
      x: cx + petalCenterR * Math.cos(a) + 1,
      y: cy + petalCenterR * Math.sin(a) - 1,
      size: petalR, color: c({ r: 0, g: 0, b: 0 }), borderWidth: 0, opacity: 0.10,
    });
  }
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2;
    page.drawCircle({
      x: cx + petalCenterR * Math.cos(a),
      y: cy + petalCenterR * Math.sin(a),
      size: petalR, color: c(GOLD), borderWidth: 0,
    });
    page.drawCircle({
      x: cx + petalCenterR * Math.cos(a),
      y: cy + petalCenterR * Math.sin(a),
      size: petalR - 1.5,
      borderColor: c(GOLD_DEEP), borderWidth: 0.4, color: c(GOLD),
    });
  }

  /// Центральне зелене коло — закриває overlap пелюсток
  page.drawCircle({ x: cx, y: cy, size: r * 0.55, color: c(GREEN_DEEP), borderWidth: 0 });
  page.drawCircle({
    x: cx, y: cy, size: r * 0.55 - 1.5,
    borderColor: c(GOLD_LIGHT), borderWidth: 0.7, color: c(GREEN_DEEP),
  });

  /// Лого центром
  drawLogo(page, logoPng, cx, cy, r * 0.85);
};

/// S35 — Diamond Square: квадрат повернутий 45° (rhombus shape)
const drawSealDiamond: DrawSeal = (page, fonts, logoPng, cx, cy, r, year) => {
  /// Зовнішній gold ромб
  const outerSide = r * 1.5;
  const goldPath = `M ${cx} ${cy + outerSide / 2}
                    L ${cx + outerSide / 2} ${cy}
                    L ${cx} ${cy - outerSide / 2}
                    L ${cx - outerSide / 2} ${cy} Z`;
  /// Shadow
  page.drawSvgPath(
    `M ${cx + 2} ${cy + outerSide / 2 - 2}
     L ${cx + outerSide / 2 + 2} ${cy - 2}
     L ${cx + 2} ${cy - outerSide / 2 - 2}
     L ${cx - outerSide / 2 + 2} ${cy - 2} Z`,
    { color: c({ r: 0, g: 0, b: 0 }), borderWidth: 0, opacity: 0.15 },
  );
  page.drawSvgPath(goldPath, { color: c(GOLD), borderWidth: 0 });

  /// Внутрішній зелений ромб
  const innerSide = outerSide - 6;
  const greenPath = `M ${cx} ${cy + innerSide / 2}
                     L ${cx + innerSide / 2} ${cy}
                     L ${cx} ${cy - innerSide / 2}
                     L ${cx - innerSide / 2} ${cy} Z`;
  page.drawSvgPath(greenPath, { color: c(GREEN_DEEP), borderWidth: 0 });

  /// Inner gold thin border
  const innerSide2 = innerSide - 4;
  const innerPath2 = `M ${cx} ${cy + innerSide2 / 2}
                      L ${cx + innerSide2 / 2} ${cy}
                      L ${cx} ${cy - innerSide2 / 2}
                      L ${cx - innerSide2 / 2} ${cy} Z`;
  page.drawSvgPath(innerPath2, {
    borderColor: c(GOLD_LIGHT), borderWidth: 0.6, color: c(GREEN_DEEP),
  });

  /// Лого центром (на меншому розмірі бо ромб має менше місця для квадратного зображення)
  drawLogo(page, logoPng, cx, cy, innerSide * 0.55);
};

/// S36 — Maltese Cross: формальний хрест з звуженими плечами
const drawSealMaltese: DrawSeal = (page, fonts, logoPng, cx, cy, r, year) => {
  /// Maltese cross — 4 V-подібні плеча (8 точок на кожне) + центр
  /// Параметри: arm length = r, тонка частина (middle) = r*0.15, широка (tip) = r*0.5
  const armLen = r;
  const midW = r * 0.13;
  const tipW = r * 0.45;

  const malteseArm = (angle: number) => {
    /// 6 точок: внутрішня вузька, вузька назовні, рамена розходяться, зовнішня широка
    const points: Array<[number, number]> = [
      [0, midW], [armLen * 0.55, midW], [armLen, tipW],
      [armLen, -tipW], [armLen * 0.55, -midW], [0, -midW],
    ];
    /// Rotate by angle around (0, 0), then translate to (cx, cy)
    const ca = Math.cos(angle), sa = Math.sin(angle);
    const rotated = points.map(([x, y]) => [x * ca - y * sa + cx, x * sa + y * ca + cy] as [number, number]);
    let path = `M ${rotated[0][0]} ${rotated[0][1]}`;
    for (let i = 1; i < rotated.length; i++) {
      path += ` L ${rotated[i][0]} ${rotated[i][1]}`;
    }
    path += ' Z';
    return path;
  };

  /// Drop shadow для всього хреста
  const shadowOffset = 2;
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    page.drawSvgPath(malteseArm(angle), {
      color: c({ r: 0, g: 0, b: 0 }), borderWidth: 0, opacity: 0.12,
    });
  }

  /// Хрест gold — 4 плеча
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    page.drawSvgPath(malteseArm(angle), { color: c(GOLD), borderWidth: 0 });
  }

  /// Центральне коло (зелене) поверх перетину плечей
  const centerR = r * 0.32;
  page.drawCircle({ x: cx, y: cy, size: centerR, color: c(GREEN_DEEP), borderWidth: 0 });
  page.drawCircle({
    x: cx, y: cy, size: centerR - 1.5,
    borderColor: c(GOLD_LIGHT), borderWidth: 0.6, color: c(GREEN_DEEP),
  });

  /// Лого в центрі (mini)
  drawLogo(page, logoPng, cx, cy, centerR * 1.4);
};

/// S37 — Pentagram Star: 5-кутна зірка (gold) + green inner core + logo
const drawSealPentagram: DrawSeal = (page, fonts, logoPng, cx, cy, r, year) => {
  const points = 5;
  const outerR = r;
  const innerR = r * 0.42;
  const star = (rO: number, rI: number) => {
    const pts: string[] = [];
    for (let i = 0; i < points * 2; i++) {
      const a = -Math.PI / 2 + (i / (points * 2)) * Math.PI * 2;
      const radius = i % 2 === 0 ? rO : rI;
      const x = cx + radius * Math.cos(a);
      const y = cy + radius * Math.sin(a);
      pts.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`);
    }
    pts.push('Z');
    return pts.join(' ');
  };

  /// Drop shadow
  page.drawSvgPath(star(outerR + 1, innerR + 1), {
    color: c({ r: 0, g: 0, b: 0 }), borderWidth: 0, opacity: 0.15,
  });
  /// Star body — gold (з gradient illusion)
  page.drawSvgPath(star(outerR, innerR), { color: c(GOLD_DEEP), borderWidth: 0 });
  page.drawSvgPath(star(outerR - 1, innerR - 0.5), { color: c(GOLD), borderWidth: 0 });
  page.drawSvgPath(star(outerR - 3, innerR - 1.5), { color: c(GOLD_LIGHT), borderWidth: 0, opacity: 0.7 });

  /// Зелене коло — поверх центру зірки, закриває перетини
  const coreR = r * 0.35;
  page.drawCircle({ x: cx, y: cy, size: coreR, color: c(GREEN_DEEP), borderWidth: 0 });
  page.drawCircle({
    x: cx, y: cy, size: coreR - 1.5,
    borderColor: c(GOLD_LIGHT), borderWidth: 0.6, color: c(GREEN_DEEP),
  });

  /// Лого центром
  drawLogo(page, logoPng, cx, cy, coreR * 1.4);
};

/// S38 — Filigree Frame: круг з ornate scrollwork навколо (4 декоративних завитки на N/S/E/W)
const drawSealFiligree: DrawSeal = (page, fonts, logoPng, cx, cy, r, year) => {
  /// Drop shadow
  for (let i = 0; i < 3; i++) {
    page.drawCircle({
      x: cx, y: cy - i * 0.5, size: r + 1.5 - i * 0.4,
      color: c({ r: 0, g: 0, b: 0 }), borderWidth: 0, opacity: 0.10,
    });
  }

  /// Wax body
  drawWaxBody(page, cx, cy, r * 0.78, WAX_GREEN_EDGE, WAX_GREEN_BODY, WAX_GREEN_LIT);

  /// Filigree scrollwork — 4 декоративних спіралі на сторонах
  const drawScroll = (cx0: number, cy0: number, scale: number, angle: number) => {
    /// Маленька спіраль через Bezier — імітує scrollwork
    const ca = Math.cos(angle), sa = Math.sin(angle);
    const tx = (x: number, y: number) => [cx0 + (x * ca - y * sa) * scale, cy0 + (x * sa + y * ca) * scale];

    const [s0x, s0y] = tx(0, 0);
    const [c1x, c1y] = tx(8, 6);
    const [c2x, c2y] = tx(8, -6);
    const [s1x, s1y] = tx(0, -3);
    page.drawSvgPath(
      `M ${s0x} ${s0y}
       C ${c1x} ${c1y}, ${c2x} ${c2y}, ${s1x} ${s1y}`,
      { borderColor: c(GOLD), borderWidth: 1.2, color: undefined },
    );
    /// Маленька крапка-acent на кінці
    const [dx, dy] = tx(0, -3);
    page.drawCircle({ x: dx, y: dy, size: 1.3, color: c(GOLD_PALE), borderWidth: 0 });
  };

  /// 4 scrolls на cardinal points (виходять з-за wax body)
  const scrollR = r * 0.85;
  drawScroll(cx, cy + scrollR, 0.8, Math.PI / 2);    // top
  drawScroll(cx + scrollR, cy, 0.8, 0);              // right
  drawScroll(cx, cy - scrollR, 0.8, -Math.PI / 2);   // bottom
  drawScroll(cx - scrollR, cy, 0.8, Math.PI);        // left

  /// Лого центром
  drawEmbossedLogo(page, logoPng, cx, cy, r * 0.85);
};

/// S39 — Hot Foil: плоский золотий диск (luxury foil-stamped стиль)
const drawSealHotFoil: DrawSeal = (page, fonts, logoPng, cx, cy, r, year) => {
  /// Soft drop shadow
  for (let i = 0; i < 4; i++) {
    page.drawCircle({
      x: cx, y: cy - i * 0.6, size: r + 1 - i * 0.3,
      color: c({ r: 0, g: 0, b: 0 }), borderWidth: 0, opacity: 0.07,
    });
  }
  /// Foil disc — 2-tone metallic via 2 layers offset
  page.drawCircle({ x: cx, y: cy - 1, size: r, color: c(GOLD_DEEP), borderWidth: 0 });
  page.drawCircle({ x: cx, y: cy + 1, size: r, color: c(GOLD_PALE), borderWidth: 0 });
  page.drawCircle({ x: cx, y: cy, size: r - 0.5, color: c(GOLD), borderWidth: 0 });

  /// Subtle inner ring (engraved hairline)
  page.drawCircle({
    x: cx, y: cy, size: r - 4,
    borderColor: c(GOLD_DEEP), borderWidth: 0.4, color: undefined,
  });

  /// Embossed UIMP letters в центрі (raised look — light highlight + dark shadow)
  const text = 'UIMP';
  const size = r * 0.42;
  const font = fonts.interSemiBold;
  const tracking = r * 0.05;
  let tw = 0;
  for (const ch of text) tw += font.widthOfTextAtSize(ch, size) + tracking;
  tw -= tracking;
  let tx = cx - tw / 2;
  const baseY = cy - size * 0.25;
  for (const ch of text) {
    /// Press-up effect: dark below + light above + main mid-tone
    page.drawText(ch, { x: tx + 0.6, y: baseY - 0.6, size, font, color: c(GOLD_DEEP) });
    page.drawText(ch, { x: tx - 0.4, y: baseY + 0.4, size, font, color: c(GOLD_PALE) });
    page.drawText(ch, { x: tx, y: baseY, size, font, color: c({ r: 165, g: 122, b: 48 }) });
    tx += font.widthOfTextAtSize(ch, size) + tracking;
  }

  /// Year embossed нижче
  if (year) {
    const ySize = r * 0.13;
    const yw = font.widthOfTextAtSize(String(year), ySize);
    const yY = cy - r * 0.40;
    page.drawText(String(year), { x: cx - yw / 2 + 0.4, y: yY - 0.4, size: ySize, font, color: c(GOLD_DEEP) });
    page.drawText(String(year), { x: cx - yw / 2, y: yY, size: ySize, font, color: c({ r: 165, g: 122, b: 48 }) });
  }
};

/// S40 — Embroidered Patch: круг з вишитою perimeter (dotted "stitches")
const drawSealEmbroidered: DrawSeal = (page, fonts, logoPng, cx, cy, r, year) => {
  /// Drop shadow
  for (let i = 0; i < 3; i++) {
    page.drawCircle({
      x: cx, y: cy - i * 0.5, size: r + 1.5 - i * 0.4,
      color: c({ r: 0, g: 0, b: 0 }), borderWidth: 0, opacity: 0.10,
    });
  }

  /// Cloth-like body (deeper green з matte feel — без highlight гладкого)
  page.drawCircle({ x: cx, y: cy, size: r, color: c(WAX_GREEN_EDGE), borderWidth: 0 });
  page.drawCircle({ x: cx, y: cy, size: r - 1, color: c(GREEN), borderWidth: 0 });

  /// Subtle texture — багато маленьких крапок (cloth weave imitation)
  const dots = 80;
  for (let i = 0; i < dots; i++) {
    const ang = Math.random() * Math.PI * 2;
    const rad = Math.sqrt(Math.random()) * (r - 8);
    page.drawCircle({
      x: cx + rad * Math.cos(ang),
      y: cy + rad * Math.sin(ang),
      size: 0.4, color: c(WAX_GREEN_EDGE), borderWidth: 0, opacity: 0.5,
    });
  }

  /// Stitched edge — 48 маленьких dashes по периметру (золоті стіжки)
  const stitches = 48;
  const stitchR = r - 3;
  for (let i = 0; i < stitches; i++) {
    const a = (i / stitches) * Math.PI * 2;
    const dashHalfLen = 1.5;
    /// Кожен стіжок — коротка дуже тонка лінія, орієнтована перпендикулярно радіусу
    const tx = -Math.sin(a), ty = Math.cos(a);  // tangent
    const x1 = cx + stitchR * Math.cos(a) + tx * dashHalfLen;
    const y1 = cy + stitchR * Math.sin(a) + ty * dashHalfLen;
    const x2 = cx + stitchR * Math.cos(a) - tx * dashHalfLen;
    const y2 = cy + stitchR * Math.sin(a) - ty * dashHalfLen;
    page.drawLine({
      start: { x: x1, y: y1 }, end: { x: x2, y: y2 },
      thickness: 0.9, color: c(GOLD), opacity: 0.85,
    });
  }

  /// Внутрішня тонка stitched line (другий ряд стіжків)
  const stitches2 = 36;
  const stitchR2 = r - 9;
  for (let i = 0; i < stitches2; i++) {
    const a = (i / stitches2) * Math.PI * 2 + Math.PI / stitches2; // offset для шахматки
    const dashHalfLen = 1.0;
    const tx = -Math.sin(a), ty = Math.cos(a);
    const x1 = cx + stitchR2 * Math.cos(a) + tx * dashHalfLen;
    const y1 = cy + stitchR2 * Math.sin(a) + ty * dashHalfLen;
    const x2 = cx + stitchR2 * Math.cos(a) - tx * dashHalfLen;
    const y2 = cy + stitchR2 * Math.sin(a) - ty * dashHalfLen;
    page.drawLine({
      start: { x: x1, y: y1 }, end: { x: x2, y: y2 },
      thickness: 0.6, color: c(GOLD_LIGHT), opacity: 0.6,
    });
  }

  /// Лого центром
  drawLogo(page, logoPng, cx, cy, r * 1.0);

  /// Year embroidered внизу
  if (year) {
    const ySize = r * 0.13;
    drawCenteredText(page, String(year), cx, cy - r * 0.55, ySize,
      fonts.interSemiBold, c(GOLD_LIGHT));
  }
};

export const sealVariants: Array<{ id: string; name: string; desc: string; draw: DrawSeal }> = [
  { id: 'S1', name: 'Wax Green + Logo', desc: 'Solid wax dome + embossed UIMP logo', draw: drawSealWaxGreen },
  { id: 'S2', name: 'Wax + Gold Rim', desc: 'Wax + thin gold border + logo', draw: drawSealWaxRim },
  { id: 'S3', name: 'Wax + Big U', desc: 'Wax + huge italic U embossed', draw: drawSealWaxU },
  { id: 'S4', name: 'Wax + Year', desc: 'Wax + великий рік центром + UIMP', draw: drawSealWaxYear },
  { id: 'S5', name: 'Burgundy Wax', desc: 'Винний восковий + logo (royal seal)', draw: drawSealWaxWine },
  { id: 'S6', name: 'Olive Wax', desc: 'Античний олівковий + logo', draw: drawSealWaxOlive },
  { id: 'S7', name: 'Wax + UIMP letters', desc: 'Wax + UIMP tracked caps + decorative line', draw: drawSealWaxLetters },
  { id: 'S8', name: 'Heavy Wax', desc: 'Глибша тінь + великий logo + curved year', draw: drawSealWaxHeavy },
  { id: 'S9', name: 'Charcoal Wax', desc: 'Чорний/слейт + logo (formal)', draw: drawSealWaxCharcoal },
  { id: 'S10', name: 'Royal Navy Wax', desc: 'Синій королівський + logo', draw: drawSealWaxNavy },
  { id: 'S11', name: 'Sage Matte', desc: 'М\'який сіро-зелений + logo', draw: drawSealWaxSage },
  { id: 'S12', name: 'Hex Wax', desc: 'Шестикутна форма (matches medallion)', draw: drawSealWaxHex },
  { id: 'S13', name: 'Octagon Wax', desc: '8-кутна форма + logo', draw: drawSealWaxOct },
  { id: 'S14', name: 'Wreath Wax', desc: 'Wax + 16 gold leaves як wreath', draw: drawSealWaxWreath },
  { id: 'S15', name: 'Cameo Inset', desc: 'Wax + малий cream cameo з лого всередині', draw: drawSealWaxCameo },
  { id: 'S16', name: 'Pressed Star', desc: 'Wax + 8-кутна gold star + UIMP', draw: drawSealWaxStar },
  { id: 'S17', name: 'Year Focus', desc: 'Великий рік italic + line + UIMP внизу', draw: drawSealTypoReversed },
  { id: 'S18', name: 'Diamond Sep.', desc: 'UIMP top + gold diamond + CERTIFIED bot', draw: drawSealTypoDiamond },
  { id: 'S19', name: 'Flanking Lines', desc: 'UIMP center + 2 короткі lines обабіч', draw: drawSealTypoFlank },
  { id: 'S20', name: 'Boxed UIMP', desc: 'UIMP в gold rectangular рамці + year', draw: drawSealTypoBox },
  { id: 'S21', name: 'Vertical UIMP', desc: 'Літери U I M P стекнуті вертикально', draw: drawSealTypoVertical },
  { id: 'S22', name: 'Chevron Crest', desc: 'Chevron зверху + UIMP + 3 dots + year', draw: drawSealTypoChevron },
  { id: 'S23', name: '3-line Stamp', desc: 'EST + UIMP + year з 2 lines між', draw: drawSealTypo3Line },
  { id: 'S24', name: 'Year + Initials', desc: 'Великий italic рік + line + UIMP UKRAINE', draw: drawSealTypoYearBig },
  { id: 'S25', name: 'Postage Stamp', desc: 'Перфорований папір-марка + logo + UIMP + year', draw: drawSealStamp },
  { id: 'S26', name: 'Metal Plate', desc: 'Brushed gold horizontal plate + engraved UIMP', draw: drawSealMetalPlate },
  { id: 'S27', name: 'Heraldic Shield', desc: 'Shield-shape щит з зеленим полем + logo', draw: drawSealShield },
  { id: 'S28', name: 'Banner Ribbon', desc: 'Gold banner з V-cut кінцями + UIMP центром', draw: drawSealBanner },
  { id: 'S29', name: 'Gold Coin', desc: 'Flat gold disc з notched edge + engraved logo', draw: drawSealCoin },
  { id: 'S30', name: 'Marble Plaque', desc: 'Cream marble + engraved dark UIMP', draw: drawSealMarble },
  { id: 'S31', name: 'Pendant', desc: 'Vertical pendant з loop + green inset', draw: drawSealPendant },
  { id: 'S32', name: 'Crest + Banner', desc: 'Medallion зверху + ribbon banner з year знизу', draw: drawSealCrestBanner },
  { id: 'S33', name: 'Sunburst', desc: 'Зелений центр + 16 gold променів навколо', draw: drawSealSunburst },
  { id: 'S34', name: 'Rosette', desc: '8-пелюсткова квітка (overlapping circles) + logo', draw: drawSealRosette },
  { id: 'S35', name: 'Diamond Square', desc: 'Ромб (rotated square) + green + logo', draw: drawSealDiamond },
  { id: 'S36', name: 'Maltese Cross', desc: 'Формальний хрест з звуженими плечами + logo', draw: drawSealMaltese },
  { id: 'S37', name: 'Pentagram Star', desc: '5-кутна зірка + green core + logo', draw: drawSealPentagram },
  { id: 'S38', name: 'Filigree', desc: 'Wax + 4 ornate scroll-завитки на сторонах', draw: drawSealFiligree },
  { id: 'S39', name: 'Hot Foil', desc: 'Foil-stamped плоский gold disc + raised UIMP', draw: drawSealHotFoil },
  { id: 'S40', name: 'Embroidered Patch', desc: 'Cloth з gold стіжками по периметру + logo', draw: drawSealEmbroidered },
  { id: 'S41', name: '3D Classic Green', desc: 'Solid 3D disc, no inner circle, heavy UIMP', draw: drawSeal3DClassic },
  { id: 'S42', name: '3D + Gold Rim', desc: '3D disc + thin gold outer rim + heavy UIMP', draw: drawSeal3DRim },
  { id: 'S43', name: '3D Heavy Bevel', desc: '3D з додатковою inner dark ring (thick edge)', draw: drawSeal3DBevel },
  { id: 'S44', name: '3D Glossy Top', desc: '3D + specular highlight зверху диска', draw: drawSeal3DGlossy },
  { id: 'S45', name: '3D Ridged Edge', desc: '3D + coin-style notches по периметру', draw: drawSeal3DRidged },
  { id: 'S46', name: '3D Burgundy', desc: 'Винний 3D wax + heavy UIMP', draw: drawSeal3DBurgundy },
  { id: 'S47', name: '3D Charcoal', desc: 'Чорний/слейт 3D + heavy UIMP', draw: drawSeal3DCharcoal },
  { id: 'S48', name: '3D Navy', desc: 'Темно-синій 3D + heavy UIMP', draw: drawSeal3DNavy },
  { id: 'S49', name: 'Polished ⭐', desc: 'S42 polished — товстий UIMP + золотий відблиск', draw: drawSeal3DPolished },
];

/* ----------------------------------------------------------------------- */
/*                          Helpers                                        */
/* ----------------------------------------------------------------------- */

function drawLogo(page: PDFPage, logoPng: PDFImage, cx: number, cy: number, targetSize: number) {
  const aspect = logoPng.height / logoPng.width;
  const w = targetSize;
  const h = targetSize * aspect;
  page.drawImage(logoPng, { x: cx - w / 2, y: cy - h / 2, width: w, height: h });
}

function drawDiamond(page: PDFPage, cx: number, cy: number, r: number, color: ReturnType<typeof rgb>) {
  const path = `M ${cx} ${cy + r} L ${cx + r} ${cy} L ${cx} ${cy - r} L ${cx - r} ${cy} Z`;
  page.drawSvgPath(path, { color, borderWidth: 0 });
}

function drawOrientedDiamond(
  page: PDFPage, cx: number, cy: number,
  long: number, short: number, angle: number,
  color: ReturnType<typeof rgb>,
) {
  const pts: Array<[number, number]> = [
    [0, long], [short, 0], [0, -long], [-short, 0],
  ];
  const ca = Math.cos(angle), sa = Math.sin(angle);
  const rotated = pts.map(([x, y]) => [x * ca - y * sa + cx, x * sa + y * ca + cy] as [number, number]);
  const path = `M ${rotated[0][0]} ${rotated[0][1]} L ${rotated[1][0]} ${rotated[1][1]} L ${rotated[2][0]} ${rotated[2][1]} L ${rotated[3][0]} ${rotated[3][1]} Z`;
  page.drawSvgPath(path, { color, borderWidth: 0 });
}

function drawTextOnArc(
  page: PDFPage, text: string, cx: number, cy: number, radius: number,
  centerAngle: number, fontSize: number, font: PDFFont, color: ReturnType<typeof rgb>,
  opts: { direction: 'cw' | 'ccw'; tracking: number },
) {
  const widths: number[] = [];
  let totalW = 0;
  for (const ch of text) {
    const w = font.widthOfTextAtSize(ch, fontSize);
    widths.push(w);
    totalW += w + opts.tracking;
  }
  totalW -= opts.tracking;
  const sign = opts.direction === 'cw' ? -1 : 1;
  let cursorAngle = centerAngle - sign * (totalW / radius) / 2;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const chWidth = widths[i];
    const glyphAngle = cursorAngle + sign * (chWidth / 2) / radius;
    const rotateRad = opts.direction === 'cw'
      ? glyphAngle - Math.PI / 2
      : glyphAngle + Math.PI / 2;
    const px = cx + radius * Math.cos(glyphAngle) - (chWidth / 2) * Math.cos(rotateRad);
    const py = cy + radius * Math.sin(glyphAngle) - (chWidth / 2) * Math.sin(rotateRad);
    page.drawText(ch, {
      x: px, y: py, size: fontSize, font, color,
      rotate: degrees((rotateRad * 180) / Math.PI),
    });
    cursorAngle += sign * (chWidth + opts.tracking) / radius;
  }
}
