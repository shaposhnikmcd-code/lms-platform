/// Renderer COURSE-сертифіката — двопанельна композиція.
///
/// Layout (page 1280×906):
///   Sidebar (left 25% = 320pt): dark green BG, big medallion з "U" монограмою,
///   "UIMP / INSTITUTE" lockup, vertical hairline divider, footer "EST. 2024 / УКРАЇНА".
///
///   Main panel (right 75% = 960pt): cream BG, thin gold inset frame, "ОФІЦІЙНИЙ
///   СЕРТИФІКАТ" + top rule, "Сертифікат" italic heading, "ОНЛАЙН-КУРСУ" amber
///   subtitle, courseName italic line, diamond divider, intro label "цей сертифікат
///   засвідчує, що", recipient name slot (overlay), body text про успішне завершення
///   курсу, bottom row з signature / small seal / year.
///
/// Динамічні поля (recipientName, year, certNumber, QR) рендеряться overlay-ем у
/// generatePdf.ts через TEMPLATES.COURSE field positions.

import { PDFFont, PDFImage, PDFPage, rgb } from 'pdf-lib';
import type { FontKey } from './fonts';
import { GREEN, GOLD, GOLD_LIGHT, GOLD_DEEP, GOLD_PALE, CREAM, CREAM_DEEP, c } from './elements';
import {
  SIDEBAR_GREEN, SIDEBAR_GREEN_DEEP, SIDEBAR_GREEN_LIT,
  drawSidebarMedallion, drawSmallSeal, drawSphereSeal, drawDiamondDivider, drawTopRule,
  drawSidebarStripe, drawCenteredTracked,
} from './courseElements';

const GREY = { r: 74, g: 74, b: 66 };
const GREY_LIGHT = { r: 140, g: 140, b: 130 };

/// Геометричні константи layout-у. Всі відсотки беруть базою всю сторінку
/// (W=1280, H=906) — sidebar займає від 0 до SIDEBAR_W.
const SIDEBAR_FRAC = 0.290;     // 371pt при W=1280 (cream area 909pt = 71%)

export type CourseTemplateAssets = {
  fonts: Record<FontKey, PDFFont>;
  signaturePng: PDFImage;
  /// Gold-tinted UIMP лого (legacy — більше не використовується для sidebar medallion).
  logoGoldPng?: PDFImage;
  /// Растерізований медальйон-куля для sidebar (1024×1024 PNG з градієнтом).
  /// Генерується через `node scripts/render-medallion-sphere-png.mjs`.
  medallionSpherePng?: PDFImage;
};

export function drawCourseTemplate(
  page: PDFPage,
  assets: CourseTemplateAssets,
  opts: { courseName?: string; year?: number; recipientName?: string },
) {
  const W = page.getWidth();
  const H = page.getHeight();
  const sidebarW = W * SIDEBAR_FRAC;

  drawSidebar(page, sidebarW, H, assets.fonts, assets.logoGoldPng);
  drawMainPanel(page, sidebarW, W - sidebarW, H, assets, opts);
}

/* ======================================================================= */
/*                          SIDEBAR                                        */
/* ======================================================================= */

function drawSidebar(
  page: PDFPage,
  sidebarW: number,
  H: number,
  fonts: Record<FontKey, PDFFont>,
  logoGoldPng?: PDFImage,
) {
  /// Базовий фон — solid dark green
  page.drawRectangle({
    x: 0, y: 0, width: sidebarW, height: H,
    color: c(SIDEBAR_GREEN), borderWidth: 0,
  });

  /// Subtle warmer-green overlay на ВЕСЬ sidebar (uniform tone — щоб не було
  /// видимого розділення на дві смуги).
  page.drawRectangle({
    x: 0, y: 0, width: sidebarW, height: H,
    color: c(SIDEBAR_GREEN_LIT), borderWidth: 0, opacity: 0.18,
  });

  const cx = sidebarW / 2;

  /// Великий медальйон зверху (приблизно у верхньому третині sidebar-у)
  const medR = sidebarW * 0.16;
  const medCY = H * 0.715;
  drawSidebarMedallion(page, fonts, cx, medCY, medR, logoGoldPng);

  /// "UIMP" — gold caps під медальйоном
  const uimpSize = sidebarW * 0.130;
  drawCenteredTracked(
    page, 'UIMP', cx, medCY - medR - uimpSize * 1.55,
    uimpSize, 4.2, fonts.cormorantRegular, c(GOLD),
  );

  /// "INSTITUTE" — tracked caps small, gold deep
  const instSize = sidebarW * 0.044;
  drawCenteredTracked(
    page, 'INSTITUTE', cx, medCY - medR - uimpSize * 1.55 - instSize * 2.3,
    instSize, 3.0, fonts.interMedium, c(GOLD_DEEP),
  );

  /// Тонка вертикальна gold-лінія посередині (декоративний divider)
  const dividerTop = H * 0.315;
  const dividerBot = H * 0.215;
  page.drawLine({
    start: { x: cx, y: dividerTop },
    end: { x: cx, y: dividerBot },
    thickness: 0.7, color: c(GOLD), opacity: 0.7,
  });
  /// Мала gold-сферичка на верхньому кінці лінії
  page.drawCircle({ x: cx, y: dividerTop, size: 1.3, color: c(GOLD), borderWidth: 0 });
  page.drawCircle({ x: cx, y: dividerBot, size: 1.3, color: c(GOLD), borderWidth: 0 });

  /// Footer: "EST. 2024" + "УКРАЇНА"
  const estSize = sidebarW * 0.034;
  drawCenteredTracked(
    page, 'EST. 2024', cx, H * 0.155,
    estSize, 2.4, fonts.interMedium, c(GOLD),
  );
  const ukrSize = sidebarW * 0.030;
  drawCenteredTracked(
    page, 'УКРАЇНА', cx, H * 0.122,
    ukrSize, 2.8, fonts.interMedium, c(GOLD_DEEP),
  );
}

/* ======================================================================= */
/*                          MAIN PANEL                                     */
/* ======================================================================= */

function drawMainPanel(
  page: PDFPage,
  panelX: number,
  panelW: number,
  H: number,
  assets: CourseTemplateAssets,
  opts: { courseName?: string; year?: number; recipientName?: string },
) {
  const cx = panelX + panelW / 2;

  /// Cream BG (горизонтальний субтильний gradient — як у yearly template)
  drawCreamBackground(page, panelX, panelW, H);

  /// Тонка золота inset-рамка — двошарова (товста зовнішня + волосна внутрішня)
  drawInsetFrame(page, panelX, panelW, H);

  /// (Pretitle «ОФІЦІЙНИЙ СЕРТИФІКАТ» + top rule прибрано — дублювало «Сертифікат» нижче)

  /// === Heading: "Сертифікат" big italic ===
  const headingSize = H * 0.085;
  const headingFont = assets.fonts.cormorantItalic;
  const headingText = 'Сертифікат';
  const headingW = headingFont.widthOfTextAtSize(headingText, headingSize);
  const headingY = H * 0.760;
  /// Faux-bold через triple-draw з x-offset (BoldItalic недоступний у pdf-lib)
  page.drawText(headingText, {
    x: cx - headingW / 2 + 0.4, y: headingY,
    size: headingSize, font: headingFont, color: c(GREEN),
  });
  page.drawText(headingText, {
    x: cx - headingW / 2, y: headingY,
    size: headingSize, font: headingFont, color: c(GREEN),
  });
  page.drawText(headingText, {
    x: cx - headingW / 2 - 0.4, y: headingY,
    size: headingSize, font: headingFont, color: c(GREEN),
  });

  /// === Eyebrow: ОНЛАЙН-КУРСУ amber tracked caps (прямо над назвою курсу) ===
  const subSize = H * 0.0171;
  drawCenteredTracked(
    page, 'ОНЛАЙН-КУРСУ', cx, H * 0.580,
    subSize, 5.2, assets.fonts.cormorantRegular, c(GOLD_DEEP),
  );

  /// === Course name (dynamic) — Cormorant Regular non-italic + faux-bold ===
  /// Senior-designer rationale: «Сертифікат» (italic, hero) і «Тетяна Шапошник»
  /// (italic, калігр. honoree) обидва italic. Якщо назва курсу теж italic у тому
  /// ж кольорі — ієрархія розмивається. Non-italic Regular з faux-bold чітко
  /// маркує «об'єкт/тему» сертифіката, ламає italic-монотонію без зміни палітри.
  if (opts.courseName) {
    const courseFont = assets.fonts.cormorantRegular;
    const courseSize = H * 0.0473;
    const courseText = opts.courseName.trim();
    const maxW = panelW * 0.92;
    const naturalW = courseFont.widthOfTextAtSize(courseText, courseSize);
    const finalSize = naturalW > maxW ? courseSize * (maxW / naturalW) : courseSize;
    const finalW = courseFont.widthOfTextAtSize(courseText, finalSize);
    const courseY = H * 0.545;
    /// Faux-bold через triple-draw з x-offset
    for (const dx of [-0.35, 0, 0.35]) {
      page.drawText(courseText, {
        x: cx - finalW / 2 + dx, y: courseY,
        size: finalSize, font: courseFont, color: c(SIDEBAR_GREEN),
      });
    }
  }

  /// === Diamond divider ===
  drawDiamondDivider(page, cx, H * 0.525, panelW * 0.165);

  /// === Intro label ===
  drawCenteredTracked(
    page, 'цей сертифікат засвідчує, що', cx, H * 0.455,
    H * 0.0125, 0.5, assets.fonts.interMedium, c(GREY),
  );

  /// === Recipient name — overlay field малюється у generatePdf через TEMPLATES.COURSE ===
  /// Underline під ім'я — піджимаємо до ширини імені (з урахуванням auto-shrink
  /// на maxWidthPct=0.55 з templateConfig). Якщо recipientName не передано —
  /// fallback на 32% ширини панелі.
  const nameLineY = H * 0.355;
  let nameLineSpan = panelW * 0.18;
  if (opts.recipientName) {
    const pageW = panelX + panelW;
    /// Розмір тут має збігатися з COURSE_TEMPLATE.recipientName.size у templateConfig.ts
    const recipientFontSize = 25;
    const naturalW = assets.fonts.cormorantItalic.widthOfTextAtSize(opts.recipientName, recipientFontSize);
    const maxW = pageW * 0.55;
    const displayedW = Math.min(naturalW, maxW);
    nameLineSpan = displayedW / 2 + 8;
  }
  /// Tapered gold fade-rule (та сама мова, що під назвою курсу)
  {
    const segments = 14;
    const segLen = nameLineSpan / segments;
    const drawFade = (dir: 1 | -1) => {
      for (let i = 0; i < segments; i++) {
        const opacity = 0.85 - (i / (segments - 1)) * 0.78;
        const x0 = cx + dir * (i * segLen);
        const x1 = cx + dir * ((i + 1) * segLen);
        page.drawLine({
          start: { x: x0, y: nameLineY },
          end: { x: x1, y: nameLineY },
          thickness: 0.55, color: c(GOLD_DEEP), opacity,
        });
      }
    };
    drawFade(1);
    drawFade(-1);
  }

  /// === Body: 2 рядки тексту про завершення курсу ===
  const bodyFont = assets.fonts.interRegular;
  const bodySize = H * 0.0155;
  const bodyColor = c(GREY);
  drawCenteredTracked(
    page, 'успішно завершив(ла) онлайн-курс в',
    cx, H * 0.315, bodySize, 0.5, bodyFont, bodyColor,
  );
  drawCenteredTracked(
    page, 'Українському інституті Душеопіки та Психотерапії (UIMP)',
    cx, H * 0.285, bodySize, 0.5, bodyFont, bodyColor,
  );

  /// === Bottom row: signature (left) | small seal (center) | year (right) ===
  drawBottomRow(page, panelX, panelW, H, assets, opts.year);
}

/* ----------------------------------------------------------------------- */
/*                          Helpers                                        */
/* ----------------------------------------------------------------------- */

function drawCreamBackground(page: PDFPage, panelX: number, panelW: number, H: number) {
  const stripes = 64;
  const stripeW = panelW / stripes;
  for (let i = 0; i < stripes; i++) {
    const t = i / (stripes - 1);
    const r = CREAM.r + (CREAM_DEEP.r - CREAM.r) * t;
    const g = CREAM.g + (CREAM_DEEP.g - CREAM.g) * t;
    const b = CREAM.b + (CREAM_DEEP.b - CREAM.b) * t;
    page.drawRectangle({
      x: panelX + i * stripeW, y: 0,
      width: stripeW + 0.5, height: H,
      color: rgb(r / 255, g / 255, b / 255), borderWidth: 0,
    });
  }
}

function drawInsetFrame(page: PDFPage, panelX: number, panelW: number, H: number) {
  const inset = Math.min(panelW, H) * 0.038;
  page.drawRectangle({
    x: panelX + inset, y: inset,
    width: panelW - 2 * inset, height: H - 2 * inset,
    borderColor: c(GOLD), borderWidth: 1.0,
  });
  /// Внутрішня волосна тонша лінія (subtle double-frame)
  const innerInset = inset + 4;
  page.drawRectangle({
    x: panelX + innerInset, y: innerInset,
    width: panelW - 2 * innerInset, height: H - 2 * innerInset,
    borderColor: c(GOLD_DEEP), borderWidth: 0.3,
  });
}

function drawBottomRow(
  page: PDFPage,
  panelX: number,
  panelW: number,
  H: number,
  assets: CourseTemplateAssets,
  year?: number,
) {
  const rowY = H * 0.155;        // baseline для центрального seal-а
  const cx = panelX + panelW / 2;
  const colOffset = panelW * 0.27;

  /// === LEFT: signature image + president line ===
  const sigCX = cx - colOffset;
  const sigImg = assets.signaturePng;
  const sigH = H * 0.078;
  const sigW = sigH * (sigImg.width / sigImg.height);
  page.drawImage(sigImg, {
    x: sigCX - sigW / 2,
    y: rowY + 12,
    width: sigW, height: sigH,
  });
  /// "Тетяна Шапошник" — italic під підписом
  const nameSize = Math.min(panelW, H) * 0.030;
  const nameFont = assets.fonts.cormorantItalic;
  const nameText = 'Тетяна Шапошник';
  const nameW = nameFont.widthOfTextAtSize(nameText, nameSize);
  page.drawText(nameText, {
    x: sigCX - nameW / 2, y: rowY - 10,
    size: nameSize, font: nameFont, color: c(SIDEBAR_GREEN),
  });
  /// Underline під ім'я — піджимаємо до ширини контенту (name + sig PNG).
  const sigLineHalf = Math.max(nameW, sigW) / 2 + 8;
  page.drawLine({
    start: { x: sigCX - sigLineHalf, y: rowY - 16 },
    end: { x: sigCX + sigLineHalf, y: rowY - 16 },
    thickness: 0.4, color: c(GREY_LIGHT),
  });
  /// "ПРЕЗИДЕНТКА · UIMP" tracked caps (узгоджено зі SUPERVISION шаблоном)
  drawCenteredTracked(
    page, 'ПРЕЗИДЕНТКА · UIMP', sigCX, rowY - 32,
    H * 0.011, 2.8, assets.fonts.interSemiBold, c(GOLD_DEEP),
  );

  /// === CENTER: sphere seal (растерізований медальйон-куля) ===
  const sealR = H * 0.072;
  if (assets.medallionSpherePng) {
    drawSphereSeal(page, assets.medallionSpherePng, cx, rowY, sealR);
  } else {
    drawSmallSeal(page, assets.fonts, cx, rowY, sealR);
  }

  /// === RIGHT: year + line + "РІК ВИДАЧІ" ===
  const yearCX = cx + colOffset;
  if (year) {
    const yearSize = H * 0.034;
    const yearFont = assets.fonts.cormorantItalic;
    const yearText = String(year);
    const yearW = yearFont.widthOfTextAtSize(yearText, yearSize);
    page.drawText(yearText, {
      x: yearCX - yearW / 2, y: rowY + 6,
      size: yearSize, font: yearFont, color: c(SIDEBAR_GREEN),
    });
  }
  /// Underline під роком — піджимаємо до ширини "2026" + невелике padding.
  const yearTextSize = H * 0.034;
  const yearMeasureW = assets.fonts.cormorantItalic.widthOfTextAtSize('2026', yearTextSize);
  const yrLineHalf = yearMeasureW / 2 + 12;
  page.drawLine({
    start: { x: yearCX - yrLineHalf, y: rowY - 4 },
    end: { x: yearCX + yrLineHalf, y: rowY - 4 },
    thickness: 0.5, color: c(GREY_LIGHT),
  });
  /// "РІК ВИДАЧІ" tracked caps
  drawCenteredTracked(
    page, 'РІК ВИДАЧІ', yearCX, rowY - 18,
    H * 0.0115, 2.4, assets.fonts.interMedium, c(GREY),
  );
}
