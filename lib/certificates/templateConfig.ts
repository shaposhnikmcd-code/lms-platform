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

export type TemplateKey = 'COURSE' | 'YEARLY_PRACTICAL' | 'YEARLY_LISTENER';

export type TemplateConfig = {
  fields: TextField[];
  qr: { xPct: number; yPct: number; sizePct: number };
};

/// Шаблон YEARLY (і PRACTICAL, і LISTENER використовують ту саму лайаут-модель —
/// різниця лише у категорії-subtitle, яку малює drawTemplate.ts).
const YEARLY_TEMPLATE: TemplateConfig = {
  fields: [
    /// Ім'я отримувача — italic caligraphic, центр
    {
      xPct: 0.5, yPct: 0.380, slot: 'recipientName',
      size: 46, font: 'cormorantItalic', color: UIMP_GREEN, align: 'center',
      maxWidthPct: 0.55,
    },
    /// Рік видачі — italic над "РІК ВИДАЧІ"
    {
      xPct: 0.795, yPct: 0.195, slot: 'issueYear',
      size: 26, font: 'cormorantItalic', color: UIMP_GREEN, align: 'center',
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
      size: 46, font: 'cormorantItalic',
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

export const TEMPLATES: Record<TemplateKey, TemplateConfig> = {
  COURSE: COURSE_TEMPLATE,
  YEARLY_PRACTICAL: YEARLY_TEMPLATE,
  YEARLY_LISTENER: YEARLY_TEMPLATE,
};

export const CATEGORY_LABELS: Record<'LISTENER' | 'PRACTICAL', string> = {
  LISTENER: 'СЛУХАЦЬКОЇ УЧАСТІ',
  PRACTICAL: 'ПРАКТИЧНОГО НАВЧАННЯ',
};
