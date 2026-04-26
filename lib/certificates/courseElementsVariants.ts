/// 🎨 Course-cert seal variants v4 — на основі поточного production-дизайну
/// (cream disc + thin gold ring + gold UIMP logo center). Кожен варіант додає
/// одну стриману деталь, яка робить його "не таким простим" без втрати
/// мінімалізму.
///
/// MEDALLION variants — поки лишаємо v3 minimalist (8 варіантів) для архіву,
/// але render-course-variants.mjs малюватиме SEAL variants з лого.

import { PDFFont, PDFImage, PDFPage, degrees, rgb } from 'pdf-lib';
import type { FontKey } from './fonts';
import {
  GOLD, GOLD_LIGHT, GOLD_DEEP, GOLD_PALE, CREAM, CREAM_DEEP, c,
} from './elements';
import { SIDEBAR_GREEN, SIDEBAR_GREEN_DEEP, SIDEBAR_GREEN_LIT } from './courseElements';

type Fonts = Record<FontKey, PDFFont>;
type DrawMed = (page: PDFPage, fonts: Fonts, cx: number, cy: number, r: number) => void;
type DrawSeal = (
  page: PDFPage, fonts: Fonts, logoGold: PDFImage,
  cx: number, cy: number, r: number,
) => void;

/* ----- Shared helpers ----- */

function softShadow(page: PDFPage, cx: number, cy: number, r: number, layers = 5, opacity = 0.06) {
  for (let i = 0; i < layers; i++) {
    page.drawCircle({
      x: cx, y: cy - i * 0.7, size: r + 2 - i * 0.4,
      color: rgb(0, 0, 0), borderWidth: 0, opacity,
    });
  }
}

function drawLogo(page: PDFPage, logo: PDFImage, cx: number, cy: number, targetW: number) {
  const aspect = logo.height / logo.width;
  page.drawImage(logo, {
    x: cx - targetW / 2,
    y: cy - (targetW * aspect) / 2,
    width: targetW, height: targetW * aspect,
  });
}

function rotatedRect(
  page: PDFPage, cx: number, cy: number, w: number, h: number, angle: number,
  color: ReturnType<typeof rgb>,
) {
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const blX = cx - (w / 2) * ca + (h / 2) * sa;
  const blY = cy - (w / 2) * sa - (h / 2) * ca;
  page.drawRectangle({
    x: blX, y: blY, width: w, height: h,
    rotate: degrees((angle * 180) / Math.PI),
    color, borderWidth: 0,
  });
}

/* ======================================================================= */
/*                       MEDALLION VARIANTS (legacy v3 — для архіву)       */
/* ======================================================================= */

/// Лишаємо тільки production-варіант медальйона як CM1, для повноти.
const drawMedProduction: DrawMed = (page, fonts, cx, cy, r) => {
  page.drawCircle({
    x: cx, y: cy, size: r,
    color: c(CREAM),
    borderColor: c(GOLD), borderWidth: 1.8,
  });
  /// Маленький "U" placeholder (бо цей draw без logo)
  const font = fonts.cormorantItalic;
  const size = r * 1.0;
  const w = font.widthOfTextAtSize('U', size);
  page.drawText('U', { x: cx - w / 2, y: cy - size * 0.30, size, font, color: c(GOLD) });
};

export const courseMedallionVariants: Array<{
  id: string; name: string; desc: string; draw: DrawMed;
}> = [
  { id: 'CM1', name: 'Production', desc: 'Cream + thin gold + italic U', draw: drawMedProduction },
];

/* ======================================================================= */
/*                       SEAL VARIANTS v4 — base + 7 subtle variants       */
/* ======================================================================= */

/// CS1 — Base (поточний production): cream + thin gold border + gold logo
const drawSealBase: DrawSeal = (page, fonts, logoGold, cx, cy, r) => {
  page.drawCircle({
    x: cx, y: cy, size: r,
    color: c(CREAM),
    borderColor: c(GOLD), borderWidth: 1.8,
  });
  drawLogo(page, logoGold, cx, cy, r * 1.20);
};

/// CS2 — Soft Drop Shadow: base + м'яка тінь під диском (depth/lift)
const drawSealShadow: DrawSeal = (page, fonts, logoGold, cx, cy, r) => {
  softShadow(page, cx, cy, r, 6, 0.08);
  page.drawCircle({
    x: cx, y: cy, size: r,
    color: c(CREAM),
    borderColor: c(GOLD), borderWidth: 1.8,
  });
  drawLogo(page, logoGold, cx, cy, r * 1.20);
};

/// CS3 — 2-Tone Bevel: base + 2-tone gold rim (carved metallic feel)
const drawSeal2ToneBevel: DrawSeal = (page, fonts, logoGold, cx, cy, r) => {
  /// Bevel: deep gold знизу, pale gold зверху, main gold центром
  page.drawCircle({ x: cx, y: cy - 0.6, size: r + 0.5, color: c(GOLD_DEEP), borderWidth: 0 });
  page.drawCircle({ x: cx, y: cy + 0.6, size: r + 0.5, color: c(GOLD_PALE), borderWidth: 0 });
  page.drawCircle({
    x: cx, y: cy, size: r,
    color: c(CREAM),
    borderColor: c(GOLD), borderWidth: 1.4,
  });
  drawLogo(page, logoGold, cx, cy, r * 1.20);
};

/// CS4 — Inner Hairline: base + ще одна тонша концентрична gold лінія всередині
const drawSealInnerHairline: DrawSeal = (page, fonts, logoGold, cx, cy, r) => {
  page.drawCircle({
    x: cx, y: cy, size: r,
    color: c(CREAM),
    borderColor: c(GOLD), borderWidth: 1.8,
  });
  /// Внутрішня тонша лінія (engraved double-frame)
  page.drawCircle({
    x: cx, y: cy, size: r - r * 0.07,
    borderColor: c(GOLD_DEEP), borderWidth: 0.5,
    color: c(CREAM),
  });
  drawLogo(page, logoGold, cx, cy, r * 1.10);
};

/// CS5 — Top Pearl: base + одна gold "перлинка" у 12 годинах (jewel accent)
const drawSealTopPearl: DrawSeal = (page, fonts, logoGold, cx, cy, r) => {
  page.drawCircle({
    x: cx, y: cy, size: r,
    color: c(CREAM),
    borderColor: c(GOLD), borderWidth: 1.8,
  });
  /// Перлинка зверху на gold ring
  page.drawCircle({ x: cx, y: cy + r, size: r * 0.06, color: c(GOLD_DEEP), borderWidth: 0, opacity: 0.5 });
  page.drawCircle({ x: cx, y: cy + r, size: r * 0.045, color: c(GOLD), borderWidth: 0 });
  page.drawCircle({ x: cx, y: cy + r + 0.3, size: r * 0.018, color: c(GOLD_PALE), borderWidth: 0 });
  drawLogo(page, logoGold, cx, cy, r * 1.20);
};

/// CS6 — Bottom Diamond: base + малий gold rotated diamond у 6 годинах
const drawSealBottomDiamond: DrawSeal = (page, fonts, logoGold, cx, cy, r) => {
  page.drawCircle({
    x: cx, y: cy, size: r,
    color: c(CREAM),
    borderColor: c(GOLD), borderWidth: 1.8,
  });
  /// Diamond знизу на gold ring
  rotatedRect(page, cx, cy - r, r * 0.10, r * 0.10, Math.PI / 4, c(GOLD));
  /// Тонкий highlight всередині (engraved feel)
  rotatedRect(page, cx, cy - r, r * 0.045, r * 0.045, Math.PI / 4, c(GOLD_PALE));
  drawLogo(page, logoGold, cx, cy, r * 1.20);
};

/// CS7 — Pearl Quartet: base + 4 малих gold перлини на NSEW (symmetric balance)
const drawSealPearlQuartet: DrawSeal = (page, fonts, logoGold, cx, cy, r) => {
  page.drawCircle({
    x: cx, y: cy, size: r,
    color: c(CREAM),
    borderColor: c(GOLD), borderWidth: 1.8,
  });
  /// 4 перлини на NSEW
  const pos: Array<[number, number]> = [[0, r], [r, 0], [0, -r], [-r, 0]];
  for (const [dx, dy] of pos) {
    page.drawCircle({ x: cx + dx, y: cy + dy, size: r * 0.05, color: c(GOLD_DEEP), borderWidth: 0, opacity: 0.4 });
    page.drawCircle({ x: cx + dx, y: cy + dy, size: r * 0.038, color: c(GOLD), borderWidth: 0 });
  }
  drawLogo(page, logoGold, cx, cy, r * 1.20);
};

/// CS8 — Concentric Whisper: base + 2 ультра-тонкі concentric gold лінії
/// (subtle "engraved" layering, ледве помітні)
const drawSealConcentricWhisper: DrawSeal = (page, fonts, logoGold, cx, cy, r) => {
  page.drawCircle({
    x: cx, y: cy, size: r,
    color: c(CREAM),
    borderColor: c(GOLD), borderWidth: 1.8,
  });
  /// 2 whisper лінії
  page.drawCircle({
    x: cx, y: cy, size: r - r * 0.06,
    borderColor: c(GOLD_PALE), borderWidth: 0.3, color: c(CREAM),
  });
  page.drawCircle({
    x: cx, y: cy, size: r - r * 0.10,
    borderColor: c(GOLD_DEEP), borderWidth: 0.25, color: c(CREAM),
  });
  drawLogo(page, logoGold, cx, cy, r * 1.05);
};

export const courseSealVariants: Array<{
  id: string; name: string; desc: string; draw: DrawSeal;
}> = [
  { id: 'CS1', name: 'Base (production)', desc: 'Cream + thin gold ring + gold logo', draw: drawSealBase },
  { id: 'CS2', name: 'Soft Drop Shadow', desc: 'Base + м\'яка тінь під диском', draw: drawSealShadow },
  { id: 'CS3', name: '2-Tone Bevel', desc: 'Base + 2-tone gold rim (carved)', draw: drawSeal2ToneBevel },
  { id: 'CS4', name: 'Inner Hairline', desc: 'Base + ще одна тонша concentric лінія', draw: drawSealInnerHairline },
  { id: 'CS5', name: 'Top Pearl', desc: 'Base + gold перлинка на 12 годинах', draw: drawSealTopPearl },
  { id: 'CS6', name: 'Bottom Diamond', desc: 'Base + малий gold diamond на 6 годинах', draw: drawSealBottomDiamond },
  { id: 'CS7', name: 'Pearl Quartet', desc: 'Base + 4 перлини на NSEW', draw: drawSealPearlQuartet },
  { id: 'CS8', name: 'Concentric Whisper', desc: 'Base + 2 ультра-тонкі concentric лінії', draw: drawSealConcentricWhisper },
];

/* ======================================================================= */
/*                       BOTTOM-SEAL VARIANTS v6 — 8 different concepts    */
/* ======================================================================= */
/// 8 фундаментально різних концептів — не варіації типографіки, а різні
/// форми/композиції: dome, cameo, rhombus, banner, square stamp, logo seal,
/// notary arc, dark inverse. Усі в брендовій палітрі (gold + brand GREEN + cream).

/// Концепт: solid gold "wax seal" як ті, що королі ставили на листи.
/// Solid gold disc + 3D dome shading (highlight зверху, shadow знизу) +
/// UIMP літери embossed (наче пресовані у віск). Жодних кілець, перлин,
/// циферблатів — тільки "крапля" gold-у з embossed monogram-ом.
///
/// Варіація: typeface + emboss-стиль + tone gold-у.

type DrawBottomSeal = (page: PDFPage, fonts: Fonts, cx: number, cy: number, r: number) => void;

/* ----- Wax-seal helpers ----- */

/// Малює "тіло" wax-seal: drop shadow + 2-tone bevel rim + solid gold body.
/// БЕЗ внутрішніх концентричних кіл/градієнтів — чистий гладкий gold disc.
function waxBody(
  page: PDFPage, cx: number, cy: number, r: number,
  edge: { r: number; g: number; b: number },
  body: { r: number; g: number; b: number },
  lit: { r: number; g: number; b: number },
) {
  /// М'яка drop shadow (5 шарів)
  for (let i = 0; i < 5; i++) {
    page.drawCircle({
      x: cx, y: cy - i * 0.7, size: r + 2 - i * 0.4,
      color: rgb(0, 0, 0), borderWidth: 0, opacity: 0.06,
    });
  }
  /// 2-tone bevel rim: deep edge знизу + lit зверху + main body
  page.drawCircle({ x: cx, y: cy - 0.7, size: r + 0.5, color: c(edge), borderWidth: 0 });
  page.drawCircle({ x: cx, y: cy + 0.7, size: r + 0.5, color: c(lit), borderWidth: 0 });
  /// Solid gold body — гладкий, без внутрішніх кілець
  page.drawCircle({ x: cx, y: cy, size: r, color: c(body), borderWidth: 0 });
}

/// 3D extruded UIMP — heavy faux-bold + multi-layer extrusion (як S49).
/// Створює monumental "carved/embossed" feel з depth.
function strong3DUIMP(
  page: PDFPage, font: PDFFont, cx: number, cy: number, size: number,
  tracking: number,
  faceColor: ReturnType<typeof rgb>,
  shadowColor: ReturnType<typeof rgb>,
  highlightColor?: ReturnType<typeof rgb>,
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
    let x = cx - totalW / 2;
    for (let i = 0; i < text.length; i++) {
      page.drawText(text[i], { x: x + offX, y: baseY + offY, size, font, color });
      x += widths[i] + tracking;
    }
  };

  /// 12-layer 3D extrusion (down-right offset, shadow color) — depth
  const depth = 12;
  for (let i = depth; i >= 1; i--) {
    drawAt(i * 0.55, -i * 0.45, shadowColor);
  }

  /// 16-pass heavy perimeter (2 кільця × 8 напрямків) — faux-bold "сильність"
  const dirs8: Array<[number, number]> = [
    [0, 1], [0.71, 0.71], [1, 0], [0.71, -0.71],
    [0, -1], [-0.71, -0.71], [-1, 0], [-0.71, 0.71],
  ];
  for (const [dx, dy] of dirs8) drawAt(dx * 0.6, dy * 0.6, faceColor);
  for (const [dx, dy] of dirs8) drawAt(dx * 0.3, dy * 0.3, faceColor);

  /// Top-left highlight (опційно — pale rim-light для metallic feel)
  if (highlightColor) {
    drawAt(-0.5, 0.6, highlightColor);
  }

  /// Main face поверх — гарантує clean solid літери
  drawAt(0, 0, faceColor);
}

/// Backward-compat alias (не зачіпає старі виклики)
const strongUIMP = (
  page: PDFPage, font: PDFFont, cx: number, cy: number, size: number,
  tracking: number, faceColor: ReturnType<typeof rgb>,
) => {
  strong3DUIMP(page, font, cx, cy, size, tracking, faceColor, c({ r: 110, g: 78, b: 24 }));
};

/* ----- Gold tones (wax variations) ----- */

const WAX_GOLD = { r: 184, g: 139, b: 60 };           // brand gold
const WAX_GOLD_EDGE = { r: 110, g: 78, b: 24 };       // dark edge — recessed shadow
const WAX_GOLD_LIT = { r: 235, g: 200, b: 110 };      // dome highlight

const WAX_ANTIQUE = { r: 168, g: 122, b: 50 };        // антична бронза
const WAX_ANTIQUE_EDGE = { r: 88, g: 60, b: 18 };
const WAX_ANTIQUE_LIT = { r: 220, g: 178, b: 92 };

const WAX_BRIGHT = { r: 210, g: 162, b: 70 };         // яскравіший gold
const WAX_BRIGHT_EDGE = { r: 130, g: 92, b: 28 };
const WAX_BRIGHT_LIT = { r: 245, g: 215, b: 130 };

const WAX_SOFT = { r: 178, g: 142, b: 78 };           // м'якший muted gold
const WAX_SOFT_EDGE = { r: 110, g: 84, b: 36 };
const WAX_SOFT_LIT = { r: 218, g: 188, b: 130 };

/* ----- 8 wax-seal variants ----- */

/// Брендовий CREAM (білий-теплий) — як для лого/логотипу та інших accent-текстів.
const UIMP_GREEN = { r: 250, g: 245, b: 232 };  // CREAM (білий)

/// 8 варіантів wax-seal. Однаковий disc-дизайн (gold + 2-tone rim + thin engraved
/// inner ring) як у production drawSmallSeal. Різниця тільки у шрифті UIMP.
/// Усі літери з wax-press emboss (highlight зверху-зліва + shadow знизу-праворуч)
/// для royal-seal feel.

/// Sphere-medallion disc (за reference-картинкою користувача): dark green BG
/// + thin gold border + dotted ring + central gold sphere з 3D bevel.
/// UIMP малюється як ENGRAVED (вирізблений у sphere) — engravedUIMP функція.
export function drawSphereDisc(page: PDFPage, cx: number, cy: number, r: number) {
  /// Soft drop shadow
  for (let i = 0; i < 3; i++) {
    page.drawCircle({
      x: cx, y: cy - i * 0.5, size: r + 1.2 - i * 0.3,
      color: rgb(0, 0, 0), borderWidth: 0, opacity: 0.10,
    });
  }
  /// Dark green disc + thin gold border (як на reference)
  page.drawCircle({
    x: cx, y: cy, size: r,
    color: c({ r: 16, g: 40, b: 32 }),
    borderColor: c(GOLD), borderWidth: 1.2,
  });
  /// Dotted gold ring всередині — N маленьких кружків по колу
  const dotRadius = r * 0.85;
  const numDots = 56;
  for (let i = 0; i < numDots; i++) {
    const angle = (i / numDots) * Math.PI * 2;
    const dx = cx + dotRadius * Math.cos(angle);
    const dy = cy + dotRadius * Math.sin(angle);
    page.drawCircle({ x: dx, y: dy, size: r * 0.011, color: c(GOLD), borderWidth: 0 });
  }
  /// Central gold sphere з 3D dome bevel
  const sphereR = r * 0.62;
  /// Thin gold rim навколо sphere (визначає edge)
  page.drawCircle({
    x: cx, y: cy, size: sphereR + r * 0.012,
    color: c(GOLD_DEEP), borderWidth: 0,
  });
  /// Bottom shadow crescent
  page.drawCircle({
    x: cx, y: cy - r * 0.045, size: sphereR,
    color: c(GOLD_DEEP), borderWidth: 0,
  });
  /// Top highlight crescent
  page.drawCircle({
    x: cx, y: cy + r * 0.035, size: sphereR,
    color: c(GOLD_PALE), borderWidth: 0,
  });
  /// Main sphere face (smaller — щоб crescents лишилися видимі на edge-ах)
  page.drawCircle({
    x: cx, y: cy, size: sphereR * 0.93,
    color: c(GOLD), borderWidth: 0,
  });
  /// Soft specular highlight (top-left) — sphere lit from above
  page.drawCircle({
    x: cx - r * 0.10, y: cy + r * 0.13, size: sphereR * 0.55,
    color: c(GOLD_PALE), borderWidth: 0, opacity: 0.45,
  });
  /// Brightest specular spot
  page.drawCircle({
    x: cx - r * 0.16, y: cy + r * 0.20, size: sphereR * 0.22,
    color: c({ r: 252, g: 232, b: 175 }), borderWidth: 0, opacity: 0.55,
  });
}

/// Engraved UIMP — літери виглядають вирізьблені у gold sphere (не embossed).
/// Інверсія waxPressedUIMP: highlight на BOTTOM-RIGHT (світло заходить у каверну,
/// освітлює нижню стінку грaviure) + shadow на TOP-LEFT (depth into carve).
export function engravedUIMP(
  page: PDFPage, font: PDFFont, cx: number, cy: number, size: number, tracking: number,
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

  /// 1. Bottom-right highlight (light reflecting from carved groove's bottom wall)
  drawAt(0.45, -0.45, c(GOLD_PALE));
  /// 2. Top-left soft shadow (depth into carved engraving)
  drawAt(-0.35, 0.35, c({ r: 8, g: 22, b: 18 }));
  /// 3. Main face — dark green (matches outer ring, "carved" feel)
  drawAt(0, 0, faceColor);
}

/// Класичний coin-style disc: 2-tone outer rim + double-ring inner frame
/// (deep + pale concentric лінії) + decorative side діаманти на 9/3 годинах.
/// Inner double-ring перенесено вглиб (r*0.72/0.68) — звільняє зовнішню стрічку
/// для дугового CERTIFIED · 2026 нижче і balanced flank ornaments по боках.
function drawProdDisc(page: PDFPage, cx: number, cy: number, r: number) {
  /// Soft drop shadow
  for (let i = 0; i < 3; i++) {
    page.drawCircle({
      x: cx, y: cy - i * 0.5, size: r + 1.2 - i * 0.3,
      color: rgb(0, 0, 0), borderWidth: 0, opacity: 0.08,
    });
  }
  /// 2-tone gold rim (subtle bevel)
  page.drawCircle({ x: cx, y: cy - 0.6, size: r + 0.7, color: c(GOLD_DEEP), borderWidth: 0 });
  page.drawCircle({ x: cx, y: cy + 0.6, size: r + 0.7, color: c(GOLD_PALE), borderWidth: 0 });
  page.drawCircle({ x: cx, y: cy, size: r, color: c(GOLD), borderWidth: 0 });
  /// Double engraved inner ring (classic coin frame)
  page.drawCircle({
    x: cx, y: cy, size: r * 0.74,
    borderColor: c(GOLD_DEEP), borderWidth: 0.7, color: c(GOLD),
  });
  page.drawCircle({
    x: cx, y: cy, size: r * 0.70,
    borderColor: c(GOLD_PALE), borderWidth: 0.35, color: c(GOLD),
  });
}

/// Wax-pressed UIMP — embossed letter effect (highlight + shadow + main face).
/// Літери виглядають reliefно "пресовані" у gold поверхню (royal seal feel).
/// `bold=true` додає 8-pass perimeter overdraw — faux-bold для тонких шрифтів.
/// `extrusion=N` додає N-layer 3D shadow stack (down-right) — даst масивність/depth
/// БЕЗ потовщення штрихів (як литий метал, що відкидає тінь у глибину).
function waxPressedUIMP(
  page: PDFPage, font: PDFFont, cx: number, cy: number, size: number, tracking: number,
  faceColor: ReturnType<typeof rgb>,
  bold = false,
  extrusion = 0,
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

  /// Highlight (вгору-ліворуч) — pale gold на верхньому краю літери
  drawAt(-0.4, 0.4, c(GOLD_PALE));
  /// Deep shadow (вниз-праворуч) — green-tinted (не чорна) тінь для depth
  drawAt(0.5, -0.5, c({ r: 10, g: 28, b: 22 }));
  /// 3D extrusion: N-layer shadow stack (drawn back-to-front, down-right offset).
  /// Smaller offset (0.35/0.30) + green-tinted shadow color (SIDEBAR_GREEN_DEEP)
  /// замість чорного — depth feel БЕЗ "blob"-у і чорних кляксів навколо літер.
  if (extrusion > 0) {
    const shadowColor = c({ r: 10, g: 28, b: 22 }); // SIDEBAR_GREEN_DEEP — green-tinted
    for (let i = extrusion; i >= 1; i--) {
      drawAt(i * 0.35, -i * 0.30, shadowColor);
    }
  }
  /// Faux-bold: 8-pass perimeter overdraw для тонких шрифтів
  if (bold) {
    const dirs8: Array<[number, number]> = [
      [0, 1], [0.71, 0.71], [1, 0], [0.71, -0.71],
      [0, -1], [-0.71, -0.71], [-1, 0], [-0.71, 0.71],
    ];
    for (const [dx, dy] of dirs8) drawAt(dx * 0.45, dy * 0.45, faceColor);
    for (const [dx, dy] of dirs8) drawAt(dx * 0.22, dy * 0.22, faceColor);
  }
  /// Main face
  drawAt(0, 0, faceColor);
}

/// Curved "CERTIFIED · 2026" вздовж нижньої дуги (як на старовинних монетах).
/// Завжди Cinzel — Roman caps пасують до coin-style. Mid-dot · як decorative
/// розділювач. direction='ccw' з centerAngle=-π/2 → text reads left-to-right
/// при tops pointing UP toward center (правильна орієнтація для читача).
function drawArcSubtitle(
  page: PDFPage, font: PDFFont, cx: number, cy: number, r: number,
  faceColor: ReturnType<typeof rgb>,
) {
  const text = 'CERTIFIED · 2026';
  const size = r * 0.135;
  const tracking = r * 0.06;
  const radius = r * 0.85;
  drawTextOnArc(
    page, text, cx, cy, radius, -Math.PI / 2, size, font, faceColor,
    { direction: 'ccw', tracking },
  );
}

/// Face color для UIMP — наш брендовий SIDEBAR_GREEN.
const FACE_GREEN = c({ r: 16, g: 40, b: 32 });

/// Layout: UIMP суворо по центру disc-у (vertical center).
const UIMP_Y_SHIFT = 0;

/// === 8 варіантів на основі BS1 (coin disc + extrusion 3D) ===
/// Усі шерять однаковий disc (drawProdDisc — outer rim + inner double-ring,
/// без діамантів) + curved "CERTIFIED · 2026" знизу. Різниця тільки у шрифті
/// UIMP, його розмірі/треку, faux-bold (для тонких) і глибині 3D extrusion.

/// BS1 — Cormorant Regular + 3D5 (coin disc base). Classic Roman serif з м'яким
/// depth — тонкі штрихи, читабельний green face, легка масивність без blob-у.
const drawBS_CormorantBase: DrawBottomSeal = (page, fonts, cx, cy, r) => {
  drawProdDisc(page, cx, cy, r);
  waxPressedUIMP(page, fonts.cormorantRegular, cx, cy + r * UIMP_Y_SHIFT, r * 0.46, r * 0.04, FACE_GREEN, false, 5);
  drawArcSubtitle(page, fonts.cinzel, cx, cy, r, FACE_GREEN);
};

/// BS2 — Cormorant Bold (faux-bold) + 3D3. Heavier classic — потовщені штрихи,
/// мінімальний depth, бо faux-bold вже додає ваги.
const drawBS_CormorantBold: DrawBottomSeal = (page, fonts, cx, cy, r) => {
  drawProdDisc(page, cx, cy, r);
  waxPressedUIMP(page, fonts.cormorantRegular, cx, cy + r * UIMP_Y_SHIFT, r * 0.42, r * 0.04, FACE_GREEN, true, 3);
  drawArcSubtitle(page, fonts.cinzel, cx, cy, r, FACE_GREEN);
};

/// BS3 — Cinzel + 3D6. Roman capitals (Trajan-style) з viavle depth —
/// monumental institute feel.
const drawBS_Cinzel: DrawBottomSeal = (page, fonts, cx, cy, r) => {
  drawProdDisc(page, cx, cy, r);
  waxPressedUIMP(page, fonts.cinzel, cx, cy + r * UIMP_Y_SHIFT, r * 0.36, r * 0.05, FACE_GREEN, false, 6);
  drawArcSubtitle(page, fonts.cinzel, cx, cy, r, FACE_GREEN);
};

/// BS4 — Cinzel Bold + 3D4. Faux-bold Roman caps з помірною вагою.
const drawBS_CinzelBold: DrawBottomSeal = (page, fonts, cx, cy, r) => {
  drawProdDisc(page, cx, cy, r);
  waxPressedUIMP(page, fonts.cinzel, cx, cy + r * UIMP_Y_SHIFT, r * 0.34, r * 0.05, FACE_GREEN, true, 4);
  drawArcSubtitle(page, fonts.cinzel, cx, cy, r, FACE_GREEN);
};

/// BS5 — Cormorant Italic Bold + 3D5. Elegant italic з faux-bold і м'яким depth.
const drawBS_CormorantItalicBold: DrawBottomSeal = (page, fonts, cx, cy, r) => {
  drawProdDisc(page, cx, cy, r);
  waxPressedUIMP(page, fonts.cormorantItalic, cx, cy + r * UIMP_Y_SHIFT, r * 0.50, 0.3, FACE_GREEN, true, 5);
  drawArcSubtitle(page, fonts.cinzel, cx, cy, r, FACE_GREEN);
};

/// BS6 — Bowlby One + 3D2. Extra-wide bold, вже сам heavy → майже без depth.
const drawBS_Bowlby: DrawBottomSeal = (page, fonts, cx, cy, r) => {
  drawProdDisc(page, cx, cy, r);
  waxPressedUIMP(page, fonts.bowlbyOne, cx, cy + r * UIMP_Y_SHIFT, r * 0.28, 0.6, FACE_GREEN, false, 2);
  drawArcSubtitle(page, fonts.cinzel, cx, cy, r, FACE_GREEN);
};

/// BS7 — Russo One + 3D3. Wide geometric bold sans з мінімальним depth.
const drawBS_Russo: DrawBottomSeal = (page, fonts, cx, cy, r) => {
  drawProdDisc(page, cx, cy, r);
  waxPressedUIMP(page, fonts.russoOne, cx, cy + r * UIMP_Y_SHIFT, r * 0.34, 0.7, FACE_GREEN, false, 3);
  drawArcSubtitle(page, fonts.cinzel, cx, cy, r, FACE_GREEN);
};

/// BS8 — Bebas Neue + 3D5. Tall condensed з помітним depth — editorial vibe.
const drawBS_Bebas: DrawBottomSeal = (page, fonts, cx, cy, r) => {
  drawProdDisc(page, cx, cy, r);
  waxPressedUIMP(page, fonts.bebasNeue, cx, cy + r * UIMP_Y_SHIFT, r * 0.46, r * 0.05, FACE_GREEN, false, 5);
  drawArcSubtitle(page, fonts.cinzel, cx, cy, r, FACE_GREEN);
};

/// Helper для curved text (для notary)
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

export const courseBottomSealVariants: Array<{
  id: string; name: string; desc: string;
  draw: (page: PDFPage, fonts: Fonts, cx: number, cy: number, r: number, logoGold?: PDFImage) => void;
}> = [
  { id: 'BS1', name: 'Cormorant Regular + 3D5 (base)', desc: 'Classic Roman serif + soft depth', draw: drawBS_CormorantBase },
  { id: 'BS2', name: 'Cormorant Bold + 3D3', desc: 'Faux-bold heavier classic', draw: drawBS_CormorantBold },
  { id: 'BS3', name: 'Cinzel + 3D6', desc: 'Roman caps (Trajan) + monumental depth', draw: drawBS_Cinzel },
  { id: 'BS4', name: 'Cinzel Bold + 3D4', desc: 'Faux-bold Roman caps', draw: drawBS_CinzelBold },
  { id: 'BS5', name: 'Cormorant Italic Bold + 3D5', desc: 'Elegant italic + bold', draw: drawBS_CormorantItalicBold },
  { id: 'BS6', name: 'Bowlby One + 3D2', desc: 'Extra-wide heavy display', draw: drawBS_Bowlby },
  { id: 'BS7', name: 'Russo One + 3D3', desc: 'Wide geometric bold', draw: drawBS_Russo },
  { id: 'BS8', name: 'Bebas Neue + 3D5', desc: 'Tall condensed + depth', draw: drawBS_Bebas },
];

/// Suppress unused warnings
export type _PDFImageType = PDFImage;
export const _SIDEBAR_GREEN_REF = SIDEBAR_GREEN;
export const _SIDEBAR_GREEN_DEEP_REF = SIDEBAR_GREEN_DEEP;
export const _SIDEBAR_GREEN_LIT_REF = SIDEBAR_GREEN_LIT;
export const _CREAM_DEEP_REF = CREAM_DEEP;
export const _GOLD_LIGHT_REF = GOLD_LIGHT;
