/// Renderer SUPERVISION-сертифіката — унікальна академічна композиція 1280×900.
///
/// Дизайн (HTML-референс: `public/Certificates/supervision-mockups.html`):
///   - Подвійна тонка золота смужка зверху (без medallion-у).
///   - UIMP-знак (Variant 5: Minimalist Modern) — тонкий tracked Cinzel deep-gold
///     з fade-rule фланкерами, у коридорі між назвою інституту та heading. Editorial
///     quiet luxury: жодних декорацій, лише типографіка + лінії що тануть у папір.
///   - Heading «Супервізія» Cormorant Regular non-italic, темно-зелений.
///   - Subtitle «— Сертифікат про участь —» tracked caps, gold-deep.
///   - Diamond-divider (родинна риса UIMP).
///   - Intro «цей сертифікат засвідчує, що» (italic green-mid) — субординативне «що»
///     дозволяє лишити імʼя в Nominative без відмінювання.
///   - Recipient italic name (overlay) + тонка золота rule під ним.
///   - Body: lead «взяв/взяла участь у супервізійному занятті на тему» (інклюзивна
///     слеш-форма) + тема «...» italic green + дата italic gold-deep. Граматично
///     повне речення з імʼям у Nominative.
///   - Footer: signature.png + thin gold rule + non-italic Cormorant name + italic role,
///     центральна печатка (deep green wax + multi-layer gold rim + UIMP логотип),
///     QR справа, cert-номер у самому нижньому-правому куті.
///
/// Динамічні overlay-поля (recipientName, certNumber, QR) задаються у TEMPLATES.SUPERVISION
/// у templateConfig.ts — generatePdf.ts накладає їх поверх цього статичного шару.

import { PDFFont, PDFImage, PDFPage, rgb } from 'pdf-lib';
import type { FontKey } from './fonts';
import {
  GREEN, GREEN_DEEP, GOLD, GOLD_LIGHT, GOLD_DEEP, GOLD_PALE,
  CREAM, CREAM_DEEP, c,
} from './elements';

const GREEN_MID = { r: 45, g: 74, b: 58 };

export type SupervisionTemplateAssets = {
  fonts: Record<FontKey, PDFFont>;
  signaturePng: PDFImage;
  /// UIMP логотип у золотому виконанні (logo-gold.png) — друкується всередині печатки.
  logoGoldPng: PDFImage;
};

export function drawSupervisionTemplate(
  page: PDFPage,
  assets: SupervisionTemplateAssets,
  opts: {
    courseName?: string;       // тема супервізії
    supervisionDate?: string;  // вже відформатована: "12 травня 2026 року"
    recipientName?: string;
  },
) {
  const W = page.getWidth();
  const H = page.getHeight();

  drawCreamBackground(page, W, H);
  drawTopGoldStripes(page, W, H);
  drawInstituteLockup(page, W, H, assets.fonts);
  /// UIMP-знак (minimalist modern): тонкий tracked-Cinzel у gold-deep з fade-rule
  /// фланкерами; чисто розміщений у коридорі між назвою інституту та heading.
  drawUimpMark(page, W, H, assets.fonts);
  drawHeading(page, W, H, assets.fonts);
  drawSubtitle(page, W, H, assets.fonts);
  drawDiamondDivider(page, W, H);
  drawCertificationIntro(page, W, H, assets.fonts);
  drawRecipientUnderline(page, W, H, assets.fonts, opts.recipientName);
  drawBodyProse(page, W, H, assets.fonts, opts.courseName, opts.supervisionDate);
  drawSignatureBlock(page, W, H, assets);
  drawSupervisionSeal(page, W, H, assets.logoGoldPng);
}

/* ----------------------------------------------------------------------- */
/*                          Background + Frame                             */
/* ----------------------------------------------------------------------- */

function drawCreamBackground(page: PDFPage, W: number, H: number) {
  const stripes = 96;
  const stripeW = W / stripes;
  for (let i = 0; i < stripes; i++) {
    const t = i / (stripes - 1);
    const r = CREAM.r + (CREAM_DEEP.r - CREAM.r) * t;
    const g = CREAM.g + (CREAM_DEEP.g - CREAM.g) * t;
    const b = CREAM.b + (CREAM_DEEP.b - CREAM.b) * t;
    page.drawRectangle({
      x: i * stripeW, y: 0,
      width: stripeW + 0.5, height: H,
      color: rgb(r / 255, g / 255, b / 255),
      borderWidth: 0,
    });
  }
}

/* ----------------------------------------------------------------------- */
/*                          TOP gold stripes (no medallion)                */
/* ----------------------------------------------------------------------- */

/// Дві дуже тонкі золоті смужки одна над одною — заміна верхньому медальйону.
function drawTopGoldStripes(page: PDFPage, W: number, H: number) {
  const yTop = H * 0.948;
  const yBot = H * 0.940;
  const left = W * 0.06;
  const right = W * 0.94;

  page.drawLine({
    start: { x: left, y: yTop }, end: { x: right, y: yTop },
    thickness: 0.7, color: c(GOLD),
  });
  page.drawLine({
    start: { x: left, y: yBot }, end: { x: right, y: yBot },
    thickness: 0.7, color: c(GOLD_DEEP),
  });
}

/* ----------------------------------------------------------------------- */
/*                          INSTITUTE LOCKUP (brand-блок зверху)           */
/* ----------------------------------------------------------------------- */

/// Дворядкова назва інституту: «Український інститут душеопіки / та психотерапії».
/// Cormorant Regular (non-italic), темно-зелений. Сидить ПОВЕРХ великого UIMP-watermark
/// (drawUimpWatermark, рендериться окремо до цієї функції в orchestrator).
function drawInstituteLockup(
  page: PDFPage,
  W: number,
  H: number,
  fonts: Record<FontKey, PDFFont>,
) {
  const cx = W / 2;
  const size = Math.min(W, H) * 0.044;   // ~40pt
  const font = fonts.cormorantRegular;

  /// Лінія 1
  const line1 = 'Український інститут душеопіки';
  const w1 = font.widthOfTextAtSize(line1, size);
  page.drawText(line1, {
    x: cx - w1 / 2, y: H * 0.870,
    size, font, color: c(GREEN),
  });

  /// Лінія 2: тільки "та психотерапії" — UIMP винесено окремо як брендмарк нижче.
  const line2 = 'та психотерапії';
  const w2 = font.widthOfTextAtSize(line2, size);
  page.drawText(line2, {
    x: cx - w2 / 2, y: H * 0.815,
    size, font, color: c(GREEN),
  });

  /// UIMP-watermark рендериться окремо ДО цього функції (drawUimpWatermark в orchestrator),
  /// тому тут лочкап лише для назви інституту — без UIMP-марки.
}

/// UIMP-знак (Variant 5: Minimalist Modern) — тонкий typographic mark у коридорі між
/// назвою інституту та heading. Editorial / quiet luxury: жодних декорацій, лише
/// широко tracked Cinzel deep-gold + fade-rule фланкери, що тануть у cream-папір.
///
/// Геометрія коридору: y 0.804 (descent line 2) → 0.744 (cap top heading) = 60px зона.
/// UIMP центрований по 0.774, висота літер ~18px → 18px clearance зверху і знизу.
function drawUimpMark(
  page: PDFPage,
  W: number,
  H: number,
  fonts: Record<FontKey, PDFFont>,
) {
  const cx = W / 2;
  const cy = H * 0.774;
  /// Малий, ввічливий розмір — мета mark-а у quiet confidence, не в presence
  const size = Math.min(W, H) * 0.030;
  /// Дуже широкий tracking (0.78) — editorial типографіка, літери розставлено
  const tracking = size * 0.78;
  const font = fonts.cinzel;

  const text = 'UIMP';
  let textW = 0;
  for (const ch of text) textW += font.widthOfTextAtSize(ch, size) + tracking;
  textW -= tracking;

  /// Cinzel сидить нижче власного baseline — піднімаємо щоб візуально центрувати на cy
  const yText = cy - size * 0.34;

  /// UIMP літери — gold-deep (saturated amber), Cinzel Regular. Без faux-bold, без shadow:
  /// мінімалістична чистота. Колір достатньо темний щоб впевнено читатись на cream.
  let x = cx - textW / 2;
  for (const ch of text) {
    const cw = font.widthOfTextAtSize(ch, size);
    page.drawText(ch, { x, y: yText, size, font, color: c(GOLD_DEEP) });
    x += cw + tracking;
  }

  /// Fade-rule фланкери — горизонтальні gold-лінії з обох боків UIMP, що тануть назовні
  /// (від transparent до 0.9 opacity ближче до тексту). Pdf-lib не підтримує градієнт
  /// штриха, тому імітуємо через 14 коротких сегментів з лінійно-зростаючою opacity.
  const rulePadding = size * 1.4;       /// gap від тексту до початку лінії
  const ruleLength = size * 4.0;        /// довжина кожної лінії
  const ruleSegments = 14;
  const ruleSegW = ruleLength / ruleSegments;

  /// LEFT rule: outer (далекий) кінець майже прозорий, inner (близький до тексту) — solid
  const leftOuter = cx - textW / 2 - rulePadding - ruleLength;
  for (let i = 0; i < ruleSegments; i++) {
    const opacity = 0.04 + (i / (ruleSegments - 1)) * 0.86;
    page.drawLine({
      start: { x: leftOuter + ruleSegW * i, y: cy },
      end: { x: leftOuter + ruleSegW * (i + 1), y: cy },
      thickness: 0.6,
      color: c(GOLD),
      opacity,
    });
  }

  /// RIGHT rule: дзеркально, inner solid → outer прозорий
  const rightInner = cx + textW / 2 + rulePadding;
  for (let i = 0; i < ruleSegments; i++) {
    const opacity = 0.90 - (i / (ruleSegments - 1)) * 0.86;
    page.drawLine({
      start: { x: rightInner + ruleSegW * i, y: cy },
      end: { x: rightInner + ruleSegW * (i + 1), y: cy },
      thickness: 0.6,
      color: c(GOLD),
      opacity,
    });
  }
}

/* ----------------------------------------------------------------------- */
/*                          HEADING + SUBTITLE                             */
/* ----------------------------------------------------------------------- */

/// «Супервізія» — Cormorant Regular non-italic, темно-зелений. Faux-bold через triple-draw.
function drawHeading(page: PDFPage, W: number, H: number, fonts: Record<FontKey, PDFFont>) {
  const text = 'Супервізія';
  const size = Math.min(W, H) * 0.086;   // ~77pt
  const font = fonts.cormorantRegular;

  const textW = font.widthOfTextAtSize(text, size);
  const x = W / 2 - textW / 2;
  const y = H * 0.600;

  page.drawText(text, { x, y, size, font, color: c(GREEN) });
  page.drawText(text, { x: x + 0.9, y, size, font, color: c(GREEN) });
  page.drawText(text, { x: x + 0.45, y: y + 0.45, size, font, color: c(GREEN) });
}

function drawSubtitle(page: PDFPage, W: number, H: number, fonts: Record<FontKey, PDFFont>) {
  const text = '— Сертифікат про участь —';
  const size = Math.min(W, H) * 0.013;
  drawCenteredTracked(page, text, W / 2, H * 0.550, size, 4.0, fonts.interSemiBold, c(GOLD_DEEP));
}

/* ----------------------------------------------------------------------- */
/*                          DIAMOND DIVIDER                                */
/* ----------------------------------------------------------------------- */

function drawDiamondDivider(page: PDFPage, W: number, H: number) {
  const cy = H * 0.510;
  const spanHalf = W * 0.18;
  const left = W / 2 - spanHalf;
  const right = W / 2 + spanHalf;

  page.drawLine({
    start: { x: left, y: cy }, end: { x: right, y: cy },
    thickness: 0.7, color: c(GOLD), opacity: 0.55,
  });

  drawDiamond(page, W / 2, cy, 4, c(GOLD));
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

/* ----------------------------------------------------------------------- */
/*                          CERTIFICATION INTRO                            */
/* ----------------------------------------------------------------------- */

/// Інтро-рядок над імʼям: «цей сертифікат засвідчує, що». Граматичне рішення —
/// субординативне «що» вводить підрядну клаузу, в якій імʼя в Nominative і
/// апозиція «учасник(-ця)...» (без дієслова, через zero-copula) — імʼя НЕ
/// потрібно відмінювати під рід чи відмінок, менеджер вписує «Ігор Шапошник»
/// як є, граматика лишається коректною.
function drawCertificationIntro(
  page: PDFPage,
  W: number,
  H: number,
  fonts: Record<FontKey, PDFFont>,
) {
  const cx = W / 2;
  const text = 'цей сертифікат засвідчує, що';
  const size = Math.min(W, H) * 0.020;
  const font = fonts.cormorantItalic;
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: cx - w / 2, y: H * 0.480,
    size, font, color: c(GREEN_MID),
  });
}

/* ----------------------------------------------------------------------- */
/*                          RECIPIENT UNDERLINE                            */
/* ----------------------------------------------------------------------- */

function drawRecipientUnderline(
  page: PDFPage,
  W: number,
  H: number,
  fonts: Record<FontKey, PDFFont>,
  recipientName?: string,
) {
  const cx = W / 2;
  let lineW = W * 0.30;
  if (recipientName && recipientName.length > 0) {
    const naturalW = fonts.cormorantItalic.widthOfTextAtSize(recipientName, 46);
    const maxW = W * 0.55;
    const displayedW = Math.min(naturalW, maxW);
    lineW = displayedW + 40;
  }
  page.drawLine({
    start: { x: cx - lineW / 2, y: H * 0.395 },
    end: { x: cx + lineW / 2, y: H * 0.395 },
    thickness: 0.6, color: c(GOLD), opacity: 0.55,
  });
}

/* ----------------------------------------------------------------------- */
/*                          BODY (lead + topic + date)                     */
/* ----------------------------------------------------------------------- */

/// Editorial body: lead-апозиція «учасник(-ця) супервізійного заняття на тему»
/// граматично описує роль імʼя (через zero-copula), потім тема в «лапках» і дата.
/// Гендер маркуємо нейтральним парентетичним «(-ця)» — інклюзивно й коректно.
function drawBodyProse(
  page: PDFPage,
  W: number,
  H: number,
  fonts: Record<FontKey, PDFFont>,
  topic: string | undefined,
  whenDate: string | undefined,
) {
  const cx = W / 2;
  const italic = fonts.cormorantItalic;

  /// Lead — повне речення з дієсловом: «взяв/взяла участь у супервізійному занятті на тему».
  /// Слеш-форма «взяв/взяла» — стандарт сучасної української інклюзивної офіційної мови
  /// (замість парентетики «(-ла)» — компактніше й читабельніше). Імʼя [overlay вище]
  /// в Nominative — менеджеру не потрібно нічого відмінювати.
  /// Звʼязка «на тему» в кінці рядка для smooth flow до topic нижче.
  const leadText = 'взяв/взяла участь у супервізійному занятті на тему';
  const leadSize = Math.min(W, H) * 0.020;
  const leadW = italic.widthOfTextAtSize(leadText, leadSize);
  page.drawText(leadText, {
    x: cx - leadW / 2, y: H * 0.355,
    size: leadSize, font: italic, color: c(GREEN_MID),
  });

  /// Тема в «лапках» — italic Cormorant deep-green, з auto-shrink на 74% ширини cert-у.
  if (topic && topic.trim().length > 0) {
    const topicText = `«${topic.trim()}»`;
    const baseSize = Math.min(W, H) * 0.030;
    const maxW = W * 0.74;
    let size = baseSize;
    const naturalW = italic.widthOfTextAtSize(topicText, baseSize);
    if (naturalW > maxW) size = baseSize * (maxW / naturalW);
    const w = italic.widthOfTextAtSize(topicText, size);
    page.drawText(topicText, {
      x: cx - w / 2, y: H * 0.305,
      size, font: italic, color: c(GREEN),
    });
  }

  /// Дата — italic Cormorant gold-deep, малий кегль. Просто «29 квітня 2026»
  /// без архаїчного «що відбулося ... року». Gold-deep tonally pairs with
  /// gold underline above і gold seal внизу.
  if (whenDate && whenDate.trim().length > 0) {
    const dateSize = Math.min(W, H) * 0.020;
    const dateW = italic.widthOfTextAtSize(whenDate.trim(), dateSize);
    page.drawText(whenDate.trim(), {
      x: cx - dateW / 2, y: H * 0.260,
      size: dateSize, font: italic, color: c(GOLD_DEEP),
    });
  }
}

/* ----------------------------------------------------------------------- */
/*                          SIGNATURE BLOCK                                */
/* ----------------------------------------------------------------------- */

/// Підпис президента: signature.png над тонкою золотою rule + Cormorant non-italic
/// ім'я + Cormorant italic роль (харм онізує з body-прозою).
function drawSignatureBlock(
  page: PDFPage,
  W: number,
  H: number,
  assets: SupervisionTemplateAssets,
) {
  const sig = assets.signaturePng;
  const sigTargetW = W * 0.110;
  const aspect = sig.height / sig.width;
  const sigH = sigTargetW * aspect;
  const sigX = W * 0.110;
  const sigY = H * 0.115;

  page.drawImage(sig, {
    x: sigX, y: sigY,
    width: sigTargetW, height: sigH,
    opacity: 0.95,
  });

  const lineY = H * 0.108;
  const lineHalfW = W * 0.075;
  const nameX = sigX + sigTargetW / 2;

  /// Тонка ЗОЛОТА rule (не зелена) — більш елегантно.
  page.drawLine({
    start: { x: nameX - lineHalfW, y: lineY },
    end: { x: nameX + lineHalfW, y: lineY },
    thickness: 0.4, color: c(GOLD), opacity: 0.65,
  });

  /// Ім'я: Cormorant Regular non-italic (шрифт інституту), темно-зелений.
  const nameFont = assets.fonts.cormorantRegular;
  const nameSize = Math.min(W, H) * 0.028;
  const nameText = 'Тетяна Шапошник';
  const nameW = nameFont.widthOfTextAtSize(nameText, nameSize);
  page.drawText(nameText, {
    x: nameX - nameW / 2, y: lineY - nameSize * 1.05,
    size: nameSize, font: nameFont, color: c(GREEN),
  });

  /// Роль: editorial tracked SmallCaps gold-deep — business-card естетика.
  /// Inter SemiBold, gold-deep tonally pairs з subtitle і date (всі троє у gold-системі);
  /// середня крапка «·» — editorial-розділювач, ритм без зайвих декорацій.
  const roleFont = assets.fonts.interSemiBold;
  const roleSize = Math.min(W, H) * 0.011;
  const roleText = 'ПРЕЗИДЕНТКА · UIMP';
  const roleY = lineY - nameSize * 1.05 - roleSize * 2.2;
  drawCenteredTracked(page, roleText, nameX, roleY, roleSize, 2.8, roleFont, c(GOLD_DEEP));
}

/* ----------------------------------------------------------------------- */
/*                          SUPERVISION SEAL (deep green wax + UIMP logo)  */
/* ----------------------------------------------------------------------- */

/// Покращена печатка: deep-green wax disc, multi-layer gold rim
/// (gold-deep → gold → gold-light → green-deep → wax body), внутрішнє
/// тонке золоте кільце-decal, UIMP лого золотом всередині.
function drawSupervisionSeal(
  page: PDFPage,
  W: number,
  H: number,
  logoGoldPng: PDFImage,
) {
  const cx = W / 2;
  const cy = H * 0.122;
  const rOuter = Math.min(W, H) * 0.072;   // ~65pt радіус → ~130pt діаметр

  /// Drop shadow — 3 розпорошених шари
  for (let i = 0; i < 3; i++) {
    page.drawCircle({
      x: cx, y: cy - 2 - i * 1.5, size: rOuter + 1.2 + i * 0.8,
      color: rgb(0, 0, 0), borderWidth: 0, opacity: 0.10 - i * 0.025,
    });
  }

  /// Зовнішнє gold-deep кільце
  page.drawCircle({ x: cx, y: cy, size: rOuter, color: c(GOLD_DEEP), borderWidth: 0 });
  /// Основне gold кільце
  page.drawCircle({ x: cx, y: cy, size: rOuter - 1.5, color: c(GOLD), borderWidth: 0 });
  /// Highlight gold-light кільце (вузьке, дає об'єм)
  page.drawCircle({ x: cx, y: cy, size: rOuter - 3.0, color: c(GOLD_LIGHT), borderWidth: 0 });
  /// Тонке gold-pale кільце-блік (зверху)
  page.drawCircle({ x: cx, y: cy + 1.0, size: rOuter - 2.2, color: c(GOLD_PALE), borderWidth: 0, opacity: 0.6 });
  /// Темно-зелене відсічення між золотим бордюром та wax body
  page.drawCircle({ x: cx, y: cy, size: rOuter - 4.5, color: c(GREEN_DEEP), borderWidth: 0 });

  /// Wax body (симуляція градієнта концентричними колами)
  page.drawCircle({ x: cx, y: cy, size: rOuter - 5.5, color: c(GREEN_DEEP), borderWidth: 0 });
  page.drawCircle({ x: cx, y: cy + 1.5, size: rOuter - 6.5, color: c(GREEN), borderWidth: 0 });
  page.drawCircle({ x: cx, y: cy + 3.0, size: rOuter - 8.0, color: c(GREEN_MID), borderWidth: 0, opacity: 0.85 });

  /// Внутрішнє тонке gold кільце (decorative inset ring)
  page.drawCircle({
    x: cx, y: cy, size: rOuter * 0.78,
    borderColor: c(GOLD), borderWidth: 0.5, color: undefined, opacity: 0.6,
  });

  /// UIMP лого центром
  const logoSize = rOuter * 1.05;
  page.drawImage(logoGoldPng, {
    x: cx - logoSize / 2, y: cy - logoSize / 2,
    width: logoSize, height: logoSize,
    opacity: 1,
  });
}

/* ----------------------------------------------------------------------- */
/*                          Text helpers                                   */
/* ----------------------------------------------------------------------- */

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
