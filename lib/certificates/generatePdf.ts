/// Генератор PDF сертифіката UIMP. Працює в Vercel serverless (Node runtime):
/// pdf-lib + @pdf-lib/fontkit + qrcode. Без Chromium, без headless браузера.
///
/// Весь шаблон — pure vector (drawTemplate.ts). На сторінці фіксованого
/// розміру 1280×906 pt (A3-ish) ми малюємо фон, рамку, орнаменти, медальйон,
/// заголовок, підпис, золоту печатку — потім overlay-имо динамічні поля
/// (ім'я, рік, QR, cert#) згідно templateConfig.
///
/// Результат — vector на будь-якому зумі, ~100-200 KB PDF.

import { PDFDocument, PDFFont, PDFPage, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import QRCode from 'qrcode';
import { loadFont, loadPublicAsset, type FontKey } from './fonts';
import { drawBaseTemplate } from './drawTemplate';
import {
  TEMPLATES,
  CATEGORY_LABELS,
  type TemplateKey,
  type TextField,
  type ColorRgb,
} from './templateConfig';

export type CertGenerationInput = {
  templateKey: TemplateKey;
  recipientName: string;
  issueYear: number;
  certNumber: string;
  verificationUrl: string;
  courseName?: string;
  category?: 'LISTENER' | 'PRACTICAL';
};

/// Фіксований розмір сторінки в pt. Vector-незалежний від DPI — crisp на будь-якому зумі.
const PAGE_W = 1280;
const PAGE_H = 906;

export async function generateCertificatePdf(input: CertGenerationInput): Promise<Uint8Array> {
  const config = TEMPLATES[input.templateKey];
  if (!config) throw new Error(`Unknown template: ${input.templateKey}`);

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  const page = doc.addPage([PAGE_W, PAGE_H]);

  /// Ембед шрифтів з кешем. Тепер використовуємо static TTFs (не variable),
  /// тому `subset: true` працює коректно — pdf-lib включає тільки потрібні гліфи,
  /// PDF ~150-250 KB замість ~2 MB з variable fonts + full embed.
  const fontCache = new Map<FontKey, PDFFont>();
  const getFont = async (key: FontKey): Promise<PDFFont> => {
    const cached = fontCache.get(key);
    if (cached) return cached;
    /// subset: false — pdf-lib subsetting ламає гліфи у Google Fonts static TTFs
    /// (ймовірно через CFF outlines). Повний embed ~300KB per font; 6 fonts у
    /// фінальному PDF ~500-700KB після DEFLATE. Прийнятний tradeoff за коректність.
    const font = await doc.embedFont(loadFont(key), { subset: false });
    fontCache.set(key, font);
    return font;
  };

  const fontsAll: Record<FontKey, PDFFont> = {
    cormorantItalic: await getFont('cormorantItalic'),
    cormorantBoldItalic: await getFont('cormorantBoldItalic'),
    cormorantRegular: await getFont('cormorantRegular'),
    interRegular: await getFont('interRegular'),
    interSemiBold: await getFont('interSemiBold'),
    interMedium: await getFont('interMedium'),
    russoOne: await getFont('russoOne'),
  };

  /// Embed PNG assets — підпис президентки + UIMP лого (transparent для yearly,
  /// gold-tint для course sidebar medallion)
  const signaturePng = await doc.embedPng(loadPublicAsset('signature.png'));
  const logoPng = await doc.embedPng(loadPublicAsset('logo-transparent.png'));
  const logoGoldPng = await doc.embedPng(loadPublicAsset('logo-gold.png'));

  /// Малюємо весь статичний шар (фон → рамка → орнаменти → heading → body → seal → signature)
  const categoryLabel = input.category ? CATEGORY_LABELS[input.category] : undefined;
  await drawBaseTemplate(doc, page, input.templateKey, {
    fonts: fontsAll,
    signaturePng,
    logoPng,
    logoGoldPng,
  }, {
    courseName: input.courseName,
    categoryLabel,
    year: input.issueYear,
  });

  /// Overlay динамічних полів (ім'я, рік, cert#)
  const slotValues: Record<string, string> = {
    recipientName: input.recipientName.trim(),
    issueYear: String(input.issueYear),
    courseName: input.courseName?.trim() ?? '',
    certNumber: input.certNumber,
    verifyUrl: input.verificationUrl,
  };

  for (const field of config.fields) {
    const raw = slotValues[field.slot] ?? '';
    if (!raw) continue;
    await drawField(page, field, raw, PAGE_W, PAGE_H, fontsAll);
  }

  /// QR → PNG (512×512) → embed. Кольори у брендовій палітрі (green на cream).
  /// QR веде на публічну сторінку верифікації /uk/certificate/{token} — стандартна
  /// практика для сертифікатів (як у Coursera/LinkedIn/університетів): хто завгодно
  /// може просканувати і переконатися, що сертифікат дійсний (або відкликаний).
  /// Origin примусово прод (www.uimp.com.ua), бо сертифікат шериться/друкується зовні —
  /// localhost/preview-URL не мають сенсу для отримувача QR.
  const verifyPath = new URL(input.verificationUrl).pathname;
  const qrTarget = `https://www.uimp.com.ua${verifyPath}`;
  const qrDataUrl = await QRCode.toDataURL(qrTarget, {
    errorCorrectionLevel: 'M',
    margin: 0,
    width: 512,
    color: { dark: '#1C3A2E', light: '#F8F2E4' },
  });
  const qrBase64 = qrDataUrl.split(',')[1];
  const qrBytes = Uint8Array.from(Buffer.from(qrBase64, 'base64'));
  const qrImg = await doc.embedPng(qrBytes);
  const qrSize = config.qr.sizePct * PAGE_W;
  page.drawImage(qrImg, {
    x: config.qr.xPct * PAGE_W,
    y: config.qr.yPct * PAGE_H,
    width: qrSize,
    height: qrSize,
  });

  return doc.save();
}

/// Малює текстове поле з опційним letter-spacing і auto-fit за максимальною шириною.
async function drawField(
  page: PDFPage,
  field: TextField,
  rawText: string,
  pageW: number,
  pageH: number,
  fonts: Record<FontKey, PDFFont>,
) {
  const font = fonts[field.font];
  const text = field.uppercase ? rawText.toUpperCase() : rawText;
  const color = toRgb(field.color);

  /// Авто-зменшення розміру якщо текст не вміщається у maxWidthPct.
  let fontSize = field.size;
  if (field.maxWidthPct) {
    const maxWidth = field.maxWidthPct * pageW;
    const naturalW = measureWidth(font, text, fontSize, field.letterSpacing ?? 0);
    if (naturalW > maxWidth) {
      fontSize = fontSize * (maxWidth / naturalW);
    }
  }

  const totalWidth = measureWidth(font, text, fontSize, field.letterSpacing ?? 0);
  let xStart = field.xPct * pageW;
  if (field.align === 'center') xStart -= totalWidth / 2;
  else if (field.align === 'right') xStart -= totalWidth;

  const y = field.yPct * pageH;

  if (field.letterSpacing && field.letterSpacing > 0) {
    let x = xStart;
    for (const ch of text) {
      page.drawText(ch, { x, y, size: fontSize, font, color });
      x += font.widthOfTextAtSize(ch, fontSize) + field.letterSpacing;
    }
  } else {
    page.drawText(text, { x: xStart, y, size: fontSize, font, color });
  }
}

function measureWidth(font: PDFFont, text: string, size: number, letterSpacing: number): number {
  if (!letterSpacing) return font.widthOfTextAtSize(text, size);
  let w = 0;
  for (const ch of text) w += font.widthOfTextAtSize(ch, size) + letterSpacing;
  return Math.max(0, w - letterSpacing);
}

function toRgb(c: ColorRgb) {
  return rgb(c.r / 255, c.g / 255, c.b / 255);
}
