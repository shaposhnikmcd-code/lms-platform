/// Конфіг позицій для overlay поверх vector-шаблону сертифіката.
///
/// Вся декоративна частина малюється кодом (drawTemplate.ts). Тут — лише
/// координати динамічних текстових полів (ім'я, рік, cert#, назва курсу —
/// те, що змінюється per-certificate) і позиція QR-коду.
///
/// Координати — відсотки (0..1) від page size. Page size фіксований в
/// generatePdf (1280×906 pt), відсотки стабілізують конфіг якщо розмір
/// зміниться у майбутньому.

export type Align = 'left' | 'center' | 'right';

export type ColorRgb = { r: number; g: number; b: number };

/// UIMP брендові кольори для динамічних полів (декоративні кольори — у drawTemplate.ts).
export const UIMP_GREEN: ColorRgb = { r: 28, g: 58, b: 46 };
export const UIMP_GREY: ColorRgb = { r: 74, g: 74, b: 66 };
export const UIMP_AMBER_TEXT: ColorRgb = { r: 146, g: 104, b: 36 };

export type TextField = {
  xPct: number;
  /// Baseline від низу (PDF convention).
  yPct: number;
  slot: 'recipientName' | 'issueYear' | 'courseName' | 'certNumber' | 'verifyUrl';
  size: number;
  font: 'cormorantItalic' | 'cormorantBoldItalic' | 'cormorantRegular' | 'interRegular' | 'interSemiBold' | 'interMedium';
  color: ColorRgb;
  align: Align;
  letterSpacing?: number;
  uppercase?: boolean;
  /// Якщо текст не вміщається у maxWidthPct — розмір пропорційно зменшується.
  maxWidthPct?: number;
};

export type TemplateKey = 'COURSE' | 'YEARLY_PRACTICAL' | 'YEARLY_LISTENER' | 'SUPERVISION';

/// Розміри PDF-сторінки для кожного шаблону. Використовується і генератором
/// (`generatePdf`), і публічною сторінкою верифікації (для aspect-ratio iframe).
/// Якщо додаєш новий шаблон — додай йому запис ТУТ, і фронт автоматично підстроїться.
/// SUPERVISION має власну унікальну композицію 1280×900 (трохи коротша за yearly,
/// без medallion-у зверху, з акцентом-блоками "ТЕМА" + "ДАТА ПРОВЕДЕННЯ").
export const PAGE_SIZES: Record<TemplateKey, { w: number; h: number }> = {
  /// A4 landscape (297×210mm у PDF-pt = 842×595) — друкується точно на A4 без скалювання.
  COURSE: { w: 842, h: 595 },
  YEARLY_PRACTICAL: { w: 842, h: 595 },
  YEARLY_LISTENER: { w: 842, h: 595 },
  SUPERVISION: { w: 842, h: 595 },
};

/// Маппінг (type, category) → TemplateKey. Не дублюй цю логіку — імпортуй сюди.
export function templateKeyFor(
  type: 'COURSE' | 'YEARLY_PROGRAM' | 'SUPERVISION',
  category: 'LISTENER' | 'PRACTICAL' | null | undefined,
): TemplateKey {
  if (type === 'COURSE') return 'COURSE';
  if (type === 'SUPERVISION') return 'SUPERVISION';
  return category === 'LISTENER' ? 'YEARLY_LISTENER' : 'YEARLY_PRACTICAL';
}

export type TemplateConfig = {
  fields: TextField[];
  qr: { xPct: number; yPct: number; sizePct: number };
};

/// Шаблон YEARLY (і PRACTICAL, і LISTENER використовують ту саму лайаут-модель —
/// різниця лише у категорії-subtitle, яку малює drawTemplate.ts).
const YEARLY_TEMPLATE: TemplateConfig = {
  fields: [
    /// Ім'я отримувача — italic caligraphic, центр (масштабовано під A4 595pt)
    {
      xPct: 0.5, yPct: 0.380, slot: 'recipientName',
      size: 29, font: 'cormorantItalic', color: UIMP_GREEN, align: 'center',
      maxWidthPct: 0.55,
    },
    /// Рік видачі — italic над "РІК ВИДАЧІ"
    {
      xPct: 0.795, yPct: 0.195, slot: 'issueYear',
      size: 16, font: 'cormorantItalic', color: UIMP_GREEN, align: 'center',
    },
    /// Cert number — tiny у нижньому-правому куті, прижатий до нижньої лінії inset.
    {
      xPct: 0.965, yPct: 0.050, slot: 'certNumber',
      size: 7, font: 'interRegular', color: UIMP_GREY, align: 'right',
      letterSpacing: 0.4, uppercase: true,
    },
  ],
  /// QR — правий нижній кут. ~32pt margin до правої та нижньої лінії inset
  /// frame (симетрично).
  qr: { xPct: 0.892, yPct: 0.072, sizePct: 0.055 },
};

/// Шаблон COURSE — двопанельний layout (green sidebar + cream main panel).
/// Sidebar займає ліві 25% ширини, тому всі overlay-поля main-panel мають
/// xPct >= 0.25 і центруються по середині main-panel (x ≈ 0.625).
///
/// issueYear малюється статично у drawCourseTemplate.drawBottomRow (не overlay).
const COURSE_TEMPLATE: TemplateConfig = {
  fields: [
    /// Ім'я отримувача — italic Cormorant, центр main-panel,
    /// сидить трохи вище underline (який drawCourseTemplate малює на y=0.355*H).
    /// xPct=0.645 = центр main-panel при SIDEBAR_FRAC=0.290 (sidebar=29% + 35.5%).
    {
      xPct: 0.645, yPct: 0.367, slot: 'recipientName',
      size: 25, font: 'cormorantItalic',
      color: { r: 16, g: 40, b: 32 },     // SIDEBAR_GREEN — глибокий dark green
      align: 'center', maxWidthPct: 0.55,
    },
    /// Cert number — tiny у нижньому-правому куті, прижатий до нижньої лінії inset.
    {
      xPct: 0.965, yPct: 0.055, slot: 'certNumber',
      size: 7, font: 'interRegular',
      color: { r: 140, g: 140, b: 130 },  // GREY_LIGHT
      align: 'right', letterSpacing: 0.4, uppercase: true,
    },
  ],
  /// QR — уніфікована позиція з YEARLY templates
  qr: { xPct: 0.918, yPct: 0.075, sizePct: 0.040 },
};

/// Шаблон SUPERVISION — унікальна композиція 1280×900. Static-частина малюється у
/// drawSupervisionTemplate.ts; ці поля overlay-ються поверх (recipientName italic,
/// certNumber tiny у самому нижньому правому куті, QR у правому-нижньому).
/// Рік видачі НЕ друкується явно — він вшитий у certNumber (UIMP-SUPER-2026-XXXXX).
const SUPERVISION_TEMPLATE: TemplateConfig = {
  fields: [
    /// Ім'я отримувача — italic caligraphic, центр. Auto-shrink якщо довге. (A4: 595pt)
    {
      xPct: 0.5, yPct: 0.420, slot: 'recipientName',
      size: 29, font: 'cormorantItalic', color: UIMP_GREEN, align: 'center',
      maxWidthPct: 0.55,
    },
    /// Cert number — tiny у самому нижньому правому куті (під QR)
    {
      xPct: 0.960, yPct: 0.022, slot: 'certNumber',
      size: 7, font: 'interRegular', color: UIMP_GREY, align: 'right',
      letterSpacing: 0.4, uppercase: true,
    },
  ],
  /// QR — правий нижній кут (cream-фон, не білий — задано у generatePdf через color light)
  qr: { xPct: 0.890, yPct: 0.075, sizePct: 0.052 },
};

export const TEMPLATES: Record<TemplateKey, TemplateConfig> = {
  COURSE: COURSE_TEMPLATE,
  YEARLY_PRACTICAL: YEARLY_TEMPLATE,
  YEARLY_LISTENER: YEARLY_TEMPLATE,
  SUPERVISION: SUPERVISION_TEMPLATE,
};

export const CATEGORY_LABELS: Record<'LISTENER' | 'PRACTICAL', string> = {
  LISTENER: 'СЛУХАЦЬКОЇ УЧАСТІ',
  PRACTICAL: 'ПРАКТИЧНОГО НАВЧАННЯ',
};
