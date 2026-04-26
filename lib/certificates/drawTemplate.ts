/// Pure-vector renderer шаблону сертифіката UIMP. Жодного baked JPG — усі
/// декоративні елементи (рамка, кутові орнаменти, медальйон, золота печатка,
/// divider) малюються через pdf-lib примітиви. Vector на будь-якому зумі.
///
/// Використовується з generatePdf.ts: drawBaseTemplate малює весь статичний шар
/// (фон → рамка → декор → heading → тіло → підпис → печатка), після чого
/// generatePdf поверх накладає динамічні поля (ім'я, рік, QR, cert#).

import { PDFDocument, PDFFont, PDFImage, PDFPage, rgb } from 'pdf-lib';
import type { FontKey } from './fonts';
import type { TemplateKey } from './templateConfig';
import { drawMedallion as drawMedallionEl, drawSeal as drawSealEl } from './elements';
import { drawCourseTemplate } from './drawCourseTemplate';

/// Витягнуто з template щоб не повторювати API кожен раз — медальйон/печатка
/// винесені в elements.ts і отримують logoPng з assets.

/* ----------------------------------------------------------------------- */
/*                          Design tokens                                  */
/* ----------------------------------------------------------------------- */

/// Cream gradient — subtle horizontal shift, теплий beige тон.
const CREAM_LEFT = { r: 250, g: 245, b: 232 };
const CREAM_RIGHT = { r: 246, g: 238, b: 222 };

/// UIMP брендова палітра.
const GREEN = { r: 28, g: 58, b: 46 };         // primary dark green
const GREEN_DEEP = { r: 18, g: 44, b: 34 };     // seal core, darker
const GREEN_MID = { r: 46, g: 82, b: 66 };      // slightly lighter for text highlights

const GOLD = { r: 184, g: 139, b: 60 };         // primary gold — frame + ornaments
const GOLD_LIGHT = { r: 218, g: 174, b: 76 };   // highlights — diamonds, seal rim
const GOLD_DEEP = { r: 142, g: 100, b: 36 };    // subtitle amber, darker tones
const GOLD_PALE = { r: 235, g: 202, b: 128 };   // highlight reflection on seal

const GREY = { r: 74, g: 74, b: 66 };           // body text
const GREY_LIGHT = { r: 140, g: 140, b: 130 };  // muted labels

function c(col: { r: number; g: number; b: number }) {
  return rgb(col.r / 255, col.g / 255, col.b / 255);
}

/* ----------------------------------------------------------------------- */
/*                          Public API                                     */
/* ----------------------------------------------------------------------- */

export type BaseTemplateAssets = {
  fonts: Record<FontKey, PDFFont>;
  signaturePng: PDFImage;
  logoPng: PDFImage;
  /// Опційно — gold-tinted версія логотипа (legacy, для yearly-cert).
  logoGoldPng?: PDFImage;
  /// Растерізований медальйон-куля для course-cert sidebar.
  medallionSpherePng?: PDFImage;
};

export async function drawBaseTemplate(
  doc: PDFDocument,
  page: PDFPage,
  templateKey: TemplateKey,
  assets: BaseTemplateAssets,
  opts: { courseName?: string; categoryLabel?: string; year?: number } = {},
) {
  /// COURSE-сертифікат має кардинально інший layout (двопанельний sidebar +
  /// main panel) — делегуємо у dedicated renderer.
  if (templateKey === 'COURSE') {
    drawCourseTemplate(page, {
      fonts: assets.fonts,
      signaturePng: assets.signaturePng,
      logoGoldPng: assets.logoGoldPng,
      medallionSpherePng: assets.medallionSpherePng,
    }, {
      courseName: opts.courseName,
      year: opts.year,
    });
    return;
  }

  const W = page.getWidth();
  const H = page.getHeight();

  drawBackground(page, W, H);
  drawFrame(page, W, H);
  drawCornerOrnaments(page, W, H);
  drawMedallion(page, W, H, assets.fonts, assets.logoPng);
  drawBrandLockup(page, W, H, assets.fonts);
  drawDivider(page, W, H);
  drawHeading(page, W, H, assets.fonts);
  drawCategoryLine(page, W, H, templateKey, assets.fonts.interSemiBold, opts.categoryLabel);
  drawBody(page, W, H, templateKey, assets.fonts, opts.courseName);
  drawSignatureBlock(page, W, H, assets);
  drawSeal(page, W, H, assets.fonts, assets.logoPng, opts.year);
  drawYearLabel(page, W, H, assets.fonts.interMedium);
}

/* ----------------------------------------------------------------------- */
/*                          Layers                                         */
/* ----------------------------------------------------------------------- */

/// Cream horizontal gradient — 96 вертикальних смуг з невеликим overlap
/// (візуально непомітно). Чистий код, без додаткових embed.
function drawBackground(page: PDFPage, W: number, H: number) {
  const stripes = 96;
  const stripeW = W / stripes;
  for (let i = 0; i < stripes; i++) {
    const t = i / (stripes - 1);
    const r = CREAM_LEFT.r + (CREAM_RIGHT.r - CREAM_LEFT.r) * t;
    const g = CREAM_LEFT.g + (CREAM_RIGHT.g - CREAM_LEFT.g) * t;
    const b = CREAM_LEFT.b + (CREAM_RIGHT.b - CREAM_LEFT.b) * t;
    page.drawRectangle({
      x: i * stripeW,
      y: 0,
      width: stripeW + 0.5,
      height: H,
      color: rgb(r / 255, g / 255, b / 255),
      borderWidth: 0,
    });
  }
}

/// Подвійна золота рамка: зовнішня товща + внутрішня тонша з проміжком.
function drawFrame(page: PDFPage, W: number, H: number) {
  const outerInset = Math.min(W, H) * 0.028;    // ~25px
  const innerInset = Math.min(W, H) * 0.042;    // ~38px
  const gold = c(GOLD);
  const goldDeep = c(GOLD_DEEP);

  /// Зовнішня товста лінія (основна рамка)
  page.drawRectangle({
    x: outerInset, y: outerInset,
    width: W - 2 * outerInset, height: H - 2 * outerInset,
    borderColor: gold, borderWidth: 2.5,
  });
  /// Subtle внутрішня тінь (darker gold) — робить рамку більш об'ємною
  page.drawRectangle({
    x: outerInset + 1.5, y: outerInset + 1.5,
    width: W - 2 * outerInset - 3, height: H - 2 * outerInset - 3,
    borderColor: goldDeep, borderWidth: 0.4,
  });
  /// Внутрішня тонка лінія
  page.drawRectangle({
    x: innerInset, y: innerInset,
    width: W - 2 * innerInset, height: H - 2 * innerInset,
    borderColor: gold, borderWidth: 0.9,
  });
}

/// Кутові орнаменти: L-скоба + decorative inner arrow-line + diamond.
function drawCornerOrnaments(page: PDFPage, W: number, H: number) {
  const inset = Math.min(W, H) * 0.028 + 7;
  const arm = Math.min(W, H) * 0.085;           // довше плече (~77px)
  const thick = 5.5;
  const gold = c(GOLD);
  const goldLight = c(GOLD_LIGHT);
  const goldDeep = c(GOLD_DEEP);

  const corners: Array<{ ax: number; ay: number; dx: number; dy: number }> = [
    { ax: inset,     ay: H - inset, dx: 1,  dy: -1 }, // top-left
    { ax: W - inset, ay: H - inset, dx: -1, dy: -1 }, // top-right
    { ax: inset,     ay: inset,     dx: 1,  dy: 1  }, // bot-left
    { ax: W - inset, ay: inset,     dx: -1, dy: 1  }, // bot-right
  ];

  for (const k of corners) {
    /// Основна L-скоба — товста
    page.drawRectangle({
      x: k.dx > 0 ? k.ax : k.ax - arm,
      y: k.dy > 0 ? k.ay : k.ay - thick,
      width: arm, height: thick,
      color: gold, borderWidth: 0,
    });
    page.drawRectangle({
      x: k.dx > 0 ? k.ax : k.ax - thick,
      y: k.dy > 0 ? k.ay : k.ay - arm,
      width: thick, height: arm,
      color: gold, borderWidth: 0,
    });

    /// Highlight hairline — тонка світла смужка вздовж L (ефект "вигравіровано")
    page.drawRectangle({
      x: k.dx > 0 ? k.ax : k.ax - arm,
      y: k.dy > 0 ? k.ay + thick - 0.8 : k.ay - thick,
      width: arm, height: 0.8,
      color: goldLight, borderWidth: 0,
    });
    page.drawRectangle({
      x: k.dx > 0 ? k.ax + thick - 0.8 : k.ax - thick,
      y: k.dy > 0 ? k.ay : k.ay - arm,
      width: 0.8, height: arm,
      color: goldLight, borderWidth: 0,
    });

    /// Shadow line — тонка темна смужка з протилежного боку
    page.drawRectangle({
      x: k.dx > 0 ? k.ax : k.ax - arm,
      y: k.dy > 0 ? k.ay : k.ay - thick + 0.4,
      width: arm, height: 0.4,
      color: goldDeep, borderWidth: 0,
    });

    /// Внутрішній акцент: diamond на кінці внутрішнього кута
    const cx = k.ax + k.dx * (arm * 0.92);
    const cy = k.ay + k.dy * (arm * 0.92);
    drawDiamond(page, cx, cy, 5.5, goldLight);

    /// Маленький флоріш: короткий діагональний штрих від diamond у напрямку центру
    const dcx = cx + k.dx * 10;
    const dcy = cy + k.dy * 10;
    page.drawLine({
      start: { x: cx + k.dx * 4, y: cy + k.dy * 4 },
      end: { x: dcx, y: dcy },
      thickness: 1, color: gold,
    });
    drawDiamond(page, dcx + k.dx * 3, dcy + k.dy * 3, 2.5, goldLight);
  }
}

function drawDiamond(
  page: PDFPage,
  cx: number,
  cy: number,
  r: number,
  color: ReturnType<typeof rgb>,
) {
  const path = `M ${cx} ${cy + r} L ${cx + r} ${cy} L ${cx} ${cy - r} L ${cx - r} ${cy} Z`;
  page.drawSvgPath(path, { color, borderWidth: 0 });
}

/// UIMP медальйон — дизайн у elements.ts. Тут лише позиція в шаблоні.
function drawMedallion(page: PDFPage, W: number, H: number, fonts: Record<FontKey, PDFFont>, logoPng: PDFImage) {
  const cx = W / 2;
  const cy = H * 0.865;
  const radius = Math.min(W, H) * 0.062;
  drawMedallionEl(page, fonts, logoPng, cx, cy, radius);
}

/// "UIMP" gold caps + subtitle institute line under medallion.
function drawBrandLockup(
  page: PDFPage,
  W: number,
  H: number,
  fonts: Record<FontKey, PDFFont>,
) {
  const cx = W / 2;

  const uimpSize = Math.min(W, H) * 0.023;
  drawCenteredTracked(page, 'UIMP', cx, H * 0.775, uimpSize, 3.4, fonts.interSemiBold, c(GOLD_DEEP));

  const subText = 'УКРАЇНСЬКИЙ ІНСТИТУТ ДУШЕОПІКИ ТА ПСИХОТЕРАПІЇ';
  const subSize = Math.min(W, H) * 0.012;
  drawCenteredTracked(page, subText, cx, H * 0.735, subSize, 1.9, fonts.interMedium, c(GREY));
}

/// Декоративний divider з центральним diamond + 2 бічних + hairline сегменти.
function drawDivider(page: PDFPage, W: number, H: number) {
  const cy = H * 0.690;
  const spanHalf = W * 0.26;
  const left = W / 2 - spanHalf;
  const right = W / 2 + spanHalf;

  const gold = c(GOLD);
  const goldLight = c(GOLD_LIGHT);

  /// Central diamond — double layer (glow effect)
  drawDiamond(page, W / 2, cy, 7, c(GOLD_PALE));
  drawDiamond(page, W / 2, cy, 5.5, goldLight);

  /// Side diamonds
  const sideGap = spanHalf * 0.6;
  drawDiamond(page, W / 2 - sideGap, cy, 3.5, goldLight);
  drawDiamond(page, W / 2 + sideGap, cy, 3.5, goldLight);

  const pad = 14;
  const segs: Array<[number, number]> = [
    [left, W / 2 - sideGap - pad],
    [W / 2 - sideGap + pad, W / 2 - pad],
    [W / 2 + pad, W / 2 + sideGap - pad],
    [W / 2 + sideGap + pad, right],
  ];
  for (const [x1, x2] of segs) {
    page.drawLine({
      start: { x: x1, y: cy },
      end: { x: x2, y: cy },
      thickness: 0.9, color: gold,
    });
  }

  /// Маленькі serif-end точки на крайніх кінцях лінії
  page.drawCircle({ x: left, y: cy, size: 1.2, color: gold, borderWidth: 0 });
  page.drawCircle({ x: right, y: cy, size: 1.2, color: gold, borderWidth: 0 });
}

/// "Сертифікат" — великий Cormorant Italic, темно-зелений. Faux-bold через
/// triple-draw з x/y offsets — візуально еквівалентно справжньому BoldItalic
/// (Google Fonts static BoldItalic малформед у pdf-lib, тому альтернативи нема).
function drawHeading(
  page: PDFPage,
  W: number,
  H: number,
  fonts: Record<FontKey, PDFFont>,
) {
  const text = 'Сертифікат';
  const size = Math.min(W, H) * 0.090;
  const font = fonts.cormorantItalic;
  const color = c(GREEN);

  const textW = font.widthOfTextAtSize(text, size);
  const x = W / 2 - textW / 2;
  const y = H * 0.578;

  /// Три draw з малим offset — дає візуальну вагу ~700.
  /// Порядок: base → offset X → offset XY (cover diagonal).
  page.drawText(text, { x, y, size, font, color });
  page.drawText(text, { x: x + 0.9, y, size, font, color });
  page.drawText(text, { x: x + 0.45, y: y + 0.45, size, font, color });
}

/// Підкатегорія: "ПРАКТИЧНОГО НАВЧАННЯ" / "СЛУХАЦЬКОЇ УЧАСТІ". Золото, tracked caps.
function drawCategoryLine(
  page: PDFPage,
  W: number,
  H: number,
  templateKey: TemplateKey,
  interSemiBold: PDFFont,
  categoryLabel?: string,
) {
  let text: string | null = null;
  if (templateKey === 'YEARLY_PRACTICAL') text = 'ПРАКТИЧНОГО НАВЧАННЯ';
  else if (templateKey === 'YEARLY_LISTENER') text = categoryLabel ?? 'СЛУХАЦЬКОЇ УЧАСТІ';

  if (!text) return;

  const size = Math.min(W, H) * 0.027;
  drawCenteredTracked(page, text, W / 2, H * 0.510, size, 4.2, interSemiBold, c(GOLD_DEEP));
}

/// "ЦИМ ЗАСВІДЧУЄТЬСЯ, ЩО" + under-name line + description text.
function drawBody(
  page: PDFPage,
  W: number,
  H: number,
  templateKey: TemplateKey,
  fonts: Record<FontKey, PDFFont>,
  courseName?: string,
) {
  const cx = W / 2;
  const greyCol = c(GREY);

  /// Award phrase — над ім'ям
  const awardText = 'ЦИМ ЗАСВІДЧУЄТЬСЯ, ЩО';
  const awardSize = Math.min(W, H) * 0.0145;
  drawCenteredTracked(page, awardText, cx, H * 0.447, awardSize, 2.4, fonts.interMedium, greyCol);

  /// Underline під іменем
  const lineW = W * 0.30;
  page.drawLine({
    start: { x: cx - lineW / 2, y: H * 0.350 },
    end: { x: cx + lineW / 2, y: H * 0.350 },
    thickness: 0.7,
    color: c(GREY),
  });

  /// Опис — два центрованих рядки
  let line1: string;
  let line2: string;
  if (templateKey === 'COURSE') {
    line1 = 'успішно пройшов(ла) онлайн-курс';
    line2 = courseName && courseName.length > 0
      ? `«${courseName}» в Українському інституті UIMP`
      : 'в Українському інституті UIMP';
  } else if (templateKey === 'YEARLY_LISTENER') {
    line1 = 'взяв(ла) слухацьку участь у річній програмі практичного навчання';
    line2 = 'з душеопіки та психотерапії в Українському інституті UIMP';
  } else {
    line1 = 'успішно пройшов(ла) річну програму практичного навчання';
    line2 = 'з душеопіки та психотерапії в Українському інституті UIMP';
  }
  const descSize = Math.min(W, H) * 0.0165;
  const descColor = c(GREY);
  drawCenteredText(page, line1, cx, H * 0.290, descSize, fonts.interRegular, descColor);
  drawCenteredText(page, line2, cx, H * 0.255, descSize, fonts.interRegular, descColor);
}

/// Підпис (PNG з transparent bg) + "Тетяна Шапошник" + посада.
function drawSignatureBlock(
  page: PDFPage,
  W: number,
  H: number,
  assets: BaseTemplateAssets,
) {
  const sig = assets.signaturePng;
  const sigTargetW = W * 0.135;
  const aspect = sig.height / sig.width;
  const sigH = sigTargetW * aspect;
  const sigX = W * 0.122;
  const sigY = H * 0.155;

  page.drawImage(sig, {
    x: sigX, y: sigY,
    width: sigTargetW, height: sigH,
  });

  const lineY = H * 0.148;
  const lineStart = sigX;
  const lineEnd = sigX + sigTargetW;
  page.drawLine({
    start: { x: lineStart, y: lineY },
    end: { x: lineEnd, y: lineY },
    thickness: 0.6,
    color: c(GREY),
  });

  const nameSize = Math.min(W, H) * 0.019;
  const nameX = sigX + sigTargetW / 2;
  drawCenteredText(
    page, 'Тетяна Шапошник',
    nameX, lineY - nameSize * 1.15,
    nameSize, assets.fonts.cormorantItalic, c(GREEN),
  );

  const titleSize = Math.min(W, H) * 0.0115;
  drawCenteredTracked(
    page, 'ПРЕЗИДЕНТКА UIMP',
    nameX, lineY - nameSize * 1.15 - titleSize * 1.7,
    titleSize, 2.0, assets.fonts.interMedium, c(GREY),
  );
}

/// Золота печатка — дизайн у elements.ts. Тут лише позиція в шаблоні.
function drawSeal(page: PDFPage, W: number, H: number, fonts: Record<FontKey, PDFFont>, logoPng: PDFImage, year?: number) {
  const cx = W / 2;
  const cy = H * 0.165;
  const rOuter = Math.min(W, H) * 0.075;
  drawSealEl(page, fonts, logoPng, cx, cy, rOuter, year);
}

/// "РІК ВИДАЧІ" label + underline (сам рік рендериться у generatePdf).
function drawYearLabel(page: PDFPage, W: number, H: number, interMedium: PDFFont) {
  const cx = W * 0.795;
  const yLine = H * 0.175;
  const lineW = W * 0.090;

  page.drawLine({
    start: { x: cx - lineW / 2, y: yLine },
    end: { x: cx + lineW / 2, y: yLine },
    thickness: 0.6,
    color: c(GREY),
  });

  const labelSize = Math.min(W, H) * 0.0115;
  drawCenteredTracked(page, 'РІК ВИДАЧІ', cx, yLine - labelSize * 1.8, labelSize, 1.9, interMedium, c(GREY));
}

/* ----------------------------------------------------------------------- */
/*                          Text helpers                                   */
/* ----------------------------------------------------------------------- */

function drawCenteredText(
  page: PDFPage,
  text: string,
  cx: number,
  y: number,
  size: number,
  font: PDFFont,
  color: ReturnType<typeof rgb>,
) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: cx - w / 2, y, size, font, color });
}

function drawCenteredTracked(
  page: PDFPage,
  text: string,
  cx: number,
  y: number,
  size: number,
  letterSpacing: number,
  font: PDFFont,
  color: ReturnType<typeof rgb>,
) {
  let total = 0;
  for (const ch of text) total += font.widthOfTextAtSize(ch, size) + letterSpacing;
  total -= letterSpacing;
  let x = cx - total / 2;
  for (const ch of text) {
    page.drawText(ch, { x, y, size, font, color });
    x += font.widthOfTextAtSize(ch, size) + letterSpacing;
  }
}
