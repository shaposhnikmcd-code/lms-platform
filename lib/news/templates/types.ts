// Типи form-payload-у для template-новин.
//
// Кожен `templateKind` має одну канонічну форму даних. Форма відповідає 1:1
// слотам у renderer-і (lib/news/templates/<Kind>Template.tsx). Менеджер у
// form-редакторі заповнює саме ці поля; render бере значення і кладе у фіксовані
// слоти з `object-fit: cover` для фото — тому ніщо не пересувається/зміщується.
//
// JSON-форма зберігається у `News.templateData` як string. Для серіалізації
// користуйтесь `serializeTemplateData()` / `parseTemplateData()` нижче — вони
// гарантують backward-compat при додаванні нових полів (порожні дефолти).

export type TemplateKind = "ARTICLE" | "EVENT";

// =============================================================================
// ARTICLE — editorial / long-form
// =============================================================================

export interface ArticleSection {
  /** Заголовок розділу. Рендериться як <h2>. Порожній → секція приховується. */
  heading: string;
  /** Тіло розділу. Параграфи розділені \n\n; markdown-зайва — звичайний текст. */
  body: string;
  /** Опціональна ілюстрація під body. */
  image?: ArticleImage;
}

export interface ArticleImage {
  /** Cloudinary URL (або інший absolute URL). Порожній → image слот не рендериться. */
  url: string;
  /** Alt-текст для accessibility. */
  alt?: string;
  /** Підпис під фото (italic, мала). */
  caption?: string;
  /** Як вписувати фото у preview-слот: "cover" заповнює і кропає, "contain"
   *  показує цілком з паддінгом. Default "contain" — щоб фото підгружалось у
   *  реальних пропорціях, користувач явно вмикає crop через «Заповнити». */
  previewFit?: "cover" | "contain";
  /** Як вписувати фото у page-слот (повна сторінка). Default "contain". */
  pageFit?: "cover" | "contain";
  /** Масштаб у preview, 0.5..1.5. CSS transform: scale(...). Default 1. */
  previewScale?: number;
  /** Масштаб на повній сторінці, 0.5..1.5. Default 1. */
  pageScale?: number;
  /** Точка фокусу X у відсотках 0..100. CSS object-position. Default 50 (центр).
   *  LEGACY: спільна focal для обох контекстів. Залишена для backward-compat
   *  старих записів. Нова логіка читає preview/pageFocal окремо; якщо їх нема —
   *  fallback на цю. */
  focalX?: number;
  /** Точка фокусу Y у відсотках 0..100. Default 50 (центр). */
  focalY?: number;
  /** Focal-point для preview-картки (`role="preview"`). Якщо undefined — fallback
   *  на legacy `focalX/Y`, далі на center (50,50). */
  previewFocalX?: number;
  previewFocalY?: number;
  /** Focal-point для повної сторінки (`role="page"`). Аналогічно з fallback. */
  pageFocalX?: number;
  pageFocalY?: number;
  /** Якщо true — зміни у preview-контролах (fit/scale/focal) синхронізуються
   *  на page-контроли (і навпаки). */
  linkScale?: boolean;
  /** Border-radius у px (0..50, або 999 для pill). Застосовується до фото на
   *  preview і public render. Керується з ImageEditor sidebar. */
  imgRadius?: number;
  /** Які кути заокруглювати: "TRBL" з 0/1 — top-left, top-right, bottom-right,
   *  bottom-left. Default "1111" — всі кути. */
  imgRadiusCorners?: string;
  /** Overlays — JSON-масив текстових напісів на фото. Зберігається як stringified
   *  JSON для сумісності з ImageEditor (block.data — Record<string, string>).
   *  Public render парсить і відображає кожен overlay як абсолютно позиціонований
   *  текст з власним стилем. */
  overlays?: string;
  /** Naturalний aspect ratio фото (W/H) — використовується ImageEditor для
   *  paper-canvas у ImageStudioModal. */
  aspectRatio?: number;
  /** Tolerance для chroma-key (видалення білого фону). 0 = вимкнено. */
  bgRemoveTolerance?: number;
}

/** Clamp helper для числових полів (fit/scale). */
function clampNum(v: unknown, min: number, max: number, def: number): number {
  const n = typeof v === "number" && isFinite(v) ? v : def;
  return Math.min(max, Math.max(min, n));
}

/** Нормалізує ArticleImage — гарантує дефолти для нових fit/scale/focal полів. */
export function sanitizeArticleImage(input: unknown): ArticleImage {
  const src = (input && typeof input === "object" ? input : {}) as Partial<ArticleImage>;
  const previewFit: "cover" | "contain" = src.previewFit === "cover" ? "cover" : "contain";
  const pageFit: "cover" | "contain" = src.pageFit === "cover" ? "cover" : "contain";
  return {
    url: typeof src.url === "string" ? src.url : "",
    alt: typeof src.alt === "string" ? src.alt : "",
    caption: typeof src.caption === "string" ? src.caption : "",
    previewFit,
    pageFit,
    previewScale: clampNum(src.previewScale, 0.5, 1.5, 1),
    pageScale: clampNum(src.pageScale, 0.5, 1.5, 1),
    focalX: clampNum(src.focalX, 0, 100, 50),
    focalY: clampNum(src.focalY, 0, 100, 50),
    previewFocalX: typeof src.previewFocalX === "number" ? clampNum(src.previewFocalX, 0, 100, 50) : undefined,
    previewFocalY: typeof src.previewFocalY === "number" ? clampNum(src.previewFocalY, 0, 100, 50) : undefined,
    pageFocalX: typeof src.pageFocalX === "number" ? clampNum(src.pageFocalX, 0, 100, 50) : undefined,
    pageFocalY: typeof src.pageFocalY === "number" ? clampNum(src.pageFocalY, 0, 100, 50) : undefined,
    linkScale: src.linkScale === true,
    imgRadius: typeof src.imgRadius === "number" ? clampNum(src.imgRadius, 0, 999, 0) : undefined,
    imgRadiusCorners: typeof src.imgRadiusCorners === "string" ? src.imgRadiusCorners : undefined,
    overlays: typeof src.overlays === "string" ? src.overlays : undefined,
    aspectRatio: typeof src.aspectRatio === "number" ? src.aspectRatio : undefined,
    bgRemoveTolerance: typeof src.bgRemoveTolerance === "number" ? clampNum(src.bgRemoveTolerance, 0, 100, 0) : undefined,
  };
}

/** Region-id-и ARTICLE, що можна показувати/ховати і впорядковувати у render-і. */
export type ArticleRegionKey = "cover" | "header" | "sections" | "pullquote" | "conclusion" | "author";

/** Усі регіони (для validation + hidden map). */
export const ARTICLE_ALL_REGIONS: ArticleRegionKey[] = [
  "cover", "header", "sections", "pullquote", "conclusion", "author",
];

/** Рухомі регіони (можуть змінювати порядок у формі/render-і). Cover і header
 *  закріплені на місці (структурно зверху статті) — інакше ламається ієрархія. */
export const ARTICLE_MOVABLE_REGIONS: ArticleRegionKey[] = [
  "sections", "pullquote", "conclusion", "author",
];

/** Effective render order = fixed prefix + sanitized movable. */
export function resolveArticleOrder(userOrder: ArticleRegionKey[] | undefined): ArticleRegionKey[] {
  const fixed: ArticleRegionKey[] = ["cover", "header"];
  const movableValid = userOrder?.filter(k => ARTICLE_MOVABLE_REGIONS.includes(k));
  const seen = new Set(movableValid || []);
  const movableFull: ArticleRegionKey[] = [
    ...(movableValid || []),
    ...ARTICLE_MOVABLE_REGIONS.filter(k => !seen.has(k)),
  ];
  return [...fixed, ...movableFull];
}

export interface ArticleData {
  /** Cover image (16:9 hero). Завжди object-fit:cover у фіксований слот. */
  cover: ArticleImage;
  /** Eyebrow-категорія: «СТАТТЯ · 5 ХВ ЧИТАННЯ» — мала uppercase лейбл над title. */
  category: string;
  /** Великий заголовок статті. Рендериться як <h1>. */
  title: string;
  /** Лід / підзаголовок. Italic, більший текст під title. */
  lead: string;
  /** Розділи (heading + body, опційно image+caption). Порожній масив дозволено. */
  sections: ArticleSection[];
  /** Pull-quote / акцентна цитата між секціями. Порожнє → не рендериться. */
  pullquote: string;
  /** Висновки — невеликий paragraph під усіма секціями. */
  conclusion: string;
  /** Авторська лінія / контакти / джерела (footer-line, мала). */
  authorLine: string;
  /** Map region→hidden. Якщо `hidden[region] === true` — секція не рендериться.
   *  Відсутність ключа = показано. Default — все показано. */
  hidden?: Partial<Record<ArticleRegionKey, boolean>>;
  /** Порядок секцій у render-і. Якщо відсутнє або частина регіонів пропущена —
   *  fallback на `ARTICLE_DEFAULT_ORDER` для відсутніх. */
  order?: ArticleRegionKey[];
}

export const ARTICLE_DEFAULTS: ArticleData = {
  cover: { url: "", alt: "", caption: "" },
  category: "СТАТТЯ · 5 ХВ ЧИТАННЯ",
  title: "[Заголовок статті]",
  lead: "Короткий лід — 1-2 речення, що задають контекст і інтригу. Розкривають тему до того, як читач піде у деталі.",
  sections: [
    {
      heading: "[Розділ 1 — назва]",
      body:
        "Перший абзац розділу. Розкривайте основну думку: що, чому, для кого. Тримайте речення короткими — 12-18 слів — щоб текст легко читався з екрану.\n\n" +
        "Другий абзац — деталі та приклади. Конкретика робить матеріал переконливим: цифри, кейси, цитати дослідників.",
    },
    {
      heading: "[Розділ 2 — назва]",
      body: "Зміст другого розділу. Розгорніть тезу — поясніть, аргументуйте, наведіть приклади. Якщо є практичний інструмент — опишіть його крок за кроком.",
      image: {
        url: "",
        alt: "",
        caption: "",
      },
    },
  ],
  pullquote: "[Ключова думка статті — цитата, що ловить увагу і резюмує головне]",
  conclusion: "Підсумуйте 2-3 ключові тези статті. Підкажіть читачеві, що робити далі — куди звертатись, що читати, який крок зробити.",
  authorLine: "[Автор · контакт · джерела]",
};

// =============================================================================
// EVENT — 2-колонкова картка фахівця/події. Layout (горизонтальна картка):
//
//   ┌─────────────────────────┬───────────────────────────────────┐
//   │ PHOTO (вертикальний 3:4)│ ── ПРО ФАХІВЦЯ                   │
//   │                         │ {about}                           │
//   │ ── Overlay knee ──      │                                   │
//   │ {specialistName}        │ ── ОСВІТА ТА КВАЛІФІКАЦІЯ         │
//   │ {specialistRole}        │ ▪ {education[].title}             │
//   │ {specialistTagline}     │   {education[].meta}              │
//   │                         │                                   │
//   │ ── Overlay foot ──      │                                   │
//   │ ВАРТІСТЬ {price}        │                                   │
//   │ ТРИВАЛІСТЬ {duration}   │                                   │
//   │ [{ctaLabel}]            │                                   │
//   └─────────────────────────┴───────────────────────────────────┘
//
// На /news розміщується через newsCard preview-блок: 2 цих картки в ряду
// (50% width кожна) під заголовками «Триває реєстрація» / «Придбати запис».
// =============================================================================

export interface EventEducationItem {
  title: string;
  meta: string;
}

/** Region-id-и EVENT. У 2-колонному layout-і reorder не передбачено
 *  (зони фіксовані), але hidden map дозволяє приховати окремі регіони. */
export type EventRegionKey = "title" | "photo" | "specialist" | "metrics" | "cta" | "about" | "education";

/** Усі регіони (для validation + hidden map). */
export const EVENT_ALL_REGIONS: EventRegionKey[] = [
  "title", "photo", "specialist", "metrics", "cta", "about", "education",
];

/** Native-розмір картки фахівця у пікселях. Це **внутрішня** ширина рендеру:
 *  на /news/{slug} обмежує контейнер сторінки, у редакторі — задає базу preview,
 *  у feed-блоці page-builder-а слугує `baseWidth` для PreviewCardScale (далі
 *  блок-розмір на канвасі масштабує її до своєї ширини). Висота лишається auto
 *  (контент диктує) на single-page; у preview-режимі — fixed 400px aspect. */
export const EVENT_CARD_WIDTH_MIN = 600;
// MAX = 920 — реальна ширина canvas-а /news (CANVAS_WIDTH у lib/news/render).
// Картка не може бути ширшою за саму сторінку, інакше у редакторі менеджер
// бачить більший розмір ніж на живій /news. Існуючі ширші cardWidth-и
// автоматично клампляться при parseTemplateData (там використовується clampNum).
export const EVENT_CARD_WIDTH_MAX = 920;
export const EVENT_CARD_WIDTH_DEFAULT = 600;
export const EVENT_CARD_HEIGHT_MIN = 320;
export const EVENT_CARD_HEIGHT_MAX = 900;
export const EVENT_CARD_HEIGHT_DEFAULT = 400;
// Heading-блок (заголовок над карткою) — окремі межі. Width успадковує дефолти
// картки. Height — min 40 (одна строка) до 400 (велика декор-плашка).
export const EVENT_TITLE_WIDTH_MIN = 200;
export const EVENT_TITLE_WIDTH_MAX = 1400;
export const EVENT_TITLE_HEIGHT_MIN = 40;
export const EVENT_TITLE_HEIGHT_MAX = 400;

/** Пресети для UI. Числа підібрано під /news layout:
 *  - 600  → 2 картки в ряд на feed-сторінці (компакт)
 *  - 760  → 2 картки в ряд з більшим повітрям (стандарт)
 *  - 900  → 1 картка на ряд, помірно (широка)
 *  - 1100 → банер на всю доступну ширину контенту /news (повна) */
export interface EventCardWidthPreset {
  key: "compact" | "regular" | "wide" | "full";
  label: string;
  px: number;
}
export const EVENT_CARD_WIDTH_PRESETS: EventCardWidthPreset[] = [
  { key: "compact", label: "Компакт", px: 600 },
  { key: "regular", label: "Стандарт", px: 760 },
  { key: "wide", label: "Широка", px: 900 },
  { key: "full", label: "На всю ширину", px: 1100 },
];

export interface EventData {
  /** Фото фахівця — вертикальний crop 3:4. object-fit:cover у фіксований слот. */
  photo: ArticleImage;
  /** Назва події. Plain-text дзеркало `titleHtml` (без розмітки) — використовується
   *  як fallback для старих записів і як значення по-замовчуванню. Sync-иться з
   *  News.title через TemplateEditor (meta.title). */
  title: string;
  /** Заголовок-блок над карткою — rich HTML з HeadingEditor (TipTap). Може
   *  містити inline-форматування: шрифт, розмір, колір, B/I/U, listing. Рендериться
   *  через sanitizeHtml + dangerouslySetInnerHTML. Backward-compat: якщо
   *  порожній — береться plain `title` обгорнутий в `<p>`. */
  titleHtml?: string;
  /** Підпис над вартістю на overlay. Default — «ВАРТІСТЬ». Менеджер може
   *  змінити (наприклад «ЦІНА», «ВНЕСОК», «AT THE DOOR» тощо) або зробити
   *  порожнім — тоді label не рендериться, лишається тільки значення. */
  priceLabel: string;
  /** Вартість, наприклад «1300 грн». */
  price: string;
  /** Підпис над тривалістю. Default — «ТРИВАЛІСТЬ». Аналогічно до priceLabel. */
  durationLabel: string;
  /** Тривалість, наприклад «50 хвилин». */
  duration: string;
  /** Текст CTA-кнопки: «Записатися на консультацію» або «Придбати запис». */
  ctaLabel: string;
  /** URL CTA — форма реєстрації, чат, або після оплати — лінк на запис. Порожнє → disabled. */
  ctaHref: string;
  /** Імʼя фахівця, напр. «Анна Гудзенко». */
  specialistName: string;
  /** Роль/посада, напр. «Психолог-консультант». */
  specialistRole: string;
  /** Підпис-tagline під роллю, напр. «3+ роки в ментальному здоровʼї». */
  specialistTagline: string;
  /** Заголовок секції «Про фахівця». Менеджер може змінити або зробити порожнім —
   *  тоді label-смужка над текстом не рендериться (сам текст лишається). Default
   *  у EVENT_DEFAULTS — «Про фахівця». */
  aboutHeading: string;
  /** Текст «Про фахівця» — кілька абзаців через \n\n. */
  about: string;
  /** Заголовок секції «Освіта та кваліфікація». Аналогічно до aboutHeading —
   *  порожній → label прихований, список лишається. Default — «Освіта та
   *  кваліфікація». */
  educationHeading: string;
  /** Список освітніх записів. Кожен — title + meta-рядок (роки/тип). */
  education: EventEducationItem[];
  /** Map region→hidden. Якщо `hidden[region] === true` — секція не рендериться. */
  hidden?: Partial<Record<EventRegionKey, boolean>>;
  /** Native-ширина картки в пікселях. Контролює base-розмір рендеру у всіх
   *  точках споживання (single-page /news/{slug}, feed-блок у page-builder-і,
   *  preview у редакторі). Default — EVENT_CARD_WIDTH_DEFAULT (600). */
  cardWidth: number;
  /** Native-висота картки в пікселях. Використовується як `baseHeight` для
   *  preview-карток (feed-блок + редактор-превʼю). На /news/{slug} картка
   *  рендериться з auto-висотою (контент диктує), тому це поле впливає лише
   *  на feed/preview-режим. Default — EVENT_CARD_HEIGHT_DEFAULT (400). */
  cardHeight: number;
  /** Native-ширина заголовкового блоку. Незалежна від cardWidth — менеджер
   *  може зробити заголовок вужчим/ширшим за картку. Default — таке ж як
   *  cardWidth (heading рівний по ширині картці). */
  titleWidth?: number;
  /** Native-висота заголовкового блоку. Default — undefined (auto, по контенту).
   *  Якщо менеджер тягне resize-handle — фіксується. */
  titleHeight?: number;
  /** Фон title-блоку над карткою. Рендериться як `background` обгортки title;
   *  колір тексту автоматично контрастний (на темних UIMP-фонах — крем, інакше
   *  лісовий зелений). Default `undefined` = білий фон (історична поведінка). */
  titleBgColor?: string;
  /** Радіус кутів title-обгортки в px. Пресети `BLOCK_RADIUS_PRESETS`
   *  (0/6/14/24/999=pill). Default `undefined` = 14 (мʼякі, дзеркалить історичне
   *  візуальне відчуття `borderRadius: 18` без розриву з preset-палітрою). */
  titleBorderRadius?: number;
}

export const EVENT_DEFAULTS: EventData = {
  photo: { url: "", alt: "", caption: "" },
  title: "[Назва події]",
  priceLabel: "ВАРТІСТЬ",
  price: "[X грн]",
  durationLabel: "ТРИВАЛІСТЬ",
  duration: "[N хв]",
  ctaLabel: "Записатися на консультацію",
  ctaHref: "",
  specialistName: "[Імʼя Прізвище]",
  specialistRole: "[Посада / спеціалізація]",
  specialistTagline: "[Tagline — досвід або фокус, 1 рядок]",
  aboutHeading: "Про фахівця",
  about:
    "Опишіть фахівця — підхід, з ким працює, у чому експертний. 2-3 речення, без зайвої теорії — конкретика про користь для клієнта.\n\n" +
    "Можна додати другий абзац: про що клієнти найчастіше звертаються, який формат сесій, очікувані результати.",
  educationHeading: "Освіта та кваліфікація",
  education: [
    { title: "[Назва освіти]", meta: "[Тип / диплом · роки]" },
    { title: "[Друга освіта]", meta: "[Програма · рік завершення]" },
    { title: "[Курс підвищення]", meta: "[Школа · рік]" },
  ],
  cardWidth: EVENT_CARD_WIDTH_DEFAULT,
  cardHeight: EVENT_CARD_HEIGHT_DEFAULT,
};

// =============================================================================
// Discriminated union + helpers
// =============================================================================

export type TemplateData =
  | { kind: "ARTICLE"; data: ArticleData }
  | { kind: "EVENT"; data: EventData };

/** Дефолти за kind (для нової порожньої template-новини). */
export function defaultsFor(kind: TemplateKind): ArticleData | EventData {
  return kind === "ARTICLE" ? ARTICLE_DEFAULTS : EVENT_DEFAULTS;
}

/**
 * Парсить JSON з `News.templateData`, накладає дефолти за kind на відсутні поля.
 * Backward-compat: нові поля у схемі автоматично заповнюються дефолтами при
 * читанні старих записів. Якщо JSON некоректний — повертає чисті дефолти.
 */
export function parseTemplateData(kind: TemplateKind, raw: string | null | undefined): ArticleData | EventData {
  if (!raw) return defaultsFor(kind);
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return mergeDefaults(kind, parsed) as ArticleData | EventData;
    }
  } catch {
    // fallthrough → defaults
  }
  return defaultsFor(kind);
}

/** Validates optional `order` array — keeps only valid keys (with no duplicates).
 *  Гарантує що render не зламається через невалідний user-input. */
function sanitizeOrder<K extends string>(input: unknown, valid: readonly K[]): K[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const validSet = valid as readonly string[];
  const seen = new Set<string>();
  const result: K[] = [];
  for (const k of input) {
    if (typeof k === "string" && validSet.includes(k) && !seen.has(k)) {
      seen.add(k);
      result.push(k as K);
    }
  }
  return result.length > 0 ? result : undefined;
}

/** Sanitizes hidden map — keeps лише ключі що належать до валідних регіонів. */
function sanitizeHidden<K extends string>(input: unknown, valid: readonly K[]): Partial<Record<K, boolean>> | undefined {
  if (!input || typeof input !== "object") return undefined;
  const validSet = valid as readonly string[];
  const out: Partial<Record<K, boolean>> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (validSet.includes(k) && v === true) out[k as K] = true;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Acceptable for inputs from form: shallow + nested merge для cover/cta/sections. */
function mergeDefaults(kind: TemplateKind, src: Record<string, unknown>): ArticleData | EventData {
  const def = defaultsFor(kind);
  if (kind === "ARTICLE") {
    const d = def as ArticleData;
    const s = src as Partial<ArticleData>;
    return {
      cover: sanitizeArticleImage({ ...d.cover, ...(s.cover || {}) }),
      category: s.category ?? d.category,
      title: s.title ?? d.title,
      lead: s.lead ?? d.lead,
      sections: Array.isArray(s.sections) && s.sections.length > 0
        ? s.sections.map(sec => ({
            heading: sec?.heading ?? "",
            body: sec?.body ?? "",
            image: sec?.image
              ? sanitizeArticleImage(sec.image)
              : undefined,
          }))
        : d.sections,
      pullquote: s.pullquote ?? d.pullquote,
      conclusion: s.conclusion ?? d.conclusion,
      authorLine: s.authorLine ?? d.authorLine,
      hidden: sanitizeHidden(s.hidden, ARTICLE_ALL_REGIONS),
      order: sanitizeOrder(s.order, ARTICLE_MOVABLE_REGIONS),
    };
  }
  const d = def as EventData;
  const s = src as Partial<EventData>;
  return {
    photo: sanitizeArticleImage({ ...d.photo, ...(s.photo || {}) }),
    title: s.title ?? d.title,
    titleHtml: typeof s.titleHtml === "string" ? s.titleHtml : undefined,
    priceLabel: typeof s.priceLabel === "string" ? s.priceLabel : d.priceLabel,
    price: s.price ?? d.price,
    durationLabel: typeof s.durationLabel === "string" ? s.durationLabel : d.durationLabel,
    duration: s.duration ?? d.duration,
    ctaLabel: s.ctaLabel ?? d.ctaLabel,
    ctaHref: s.ctaHref ?? d.ctaHref,
    specialistName: s.specialistName ?? d.specialistName,
    specialistRole: s.specialistRole ?? d.specialistRole,
    specialistTagline: s.specialistTagline ?? d.specialistTagline,
    aboutHeading: typeof s.aboutHeading === "string" ? s.aboutHeading : d.aboutHeading,
    about: s.about ?? d.about,
    educationHeading: typeof s.educationHeading === "string" ? s.educationHeading : d.educationHeading,
    education: Array.isArray(s.education) && s.education.length > 0
      ? s.education.map(e => ({ title: e?.title ?? "", meta: e?.meta ?? "" }))
      : d.education,
    // Title-over-card — opt-in: для backward compat (старі EVENT-записи без
    // hidden.title не повинні раптом показати заголовок над карткою). Якщо
    // в source `hidden` взагалі відсутній — вважаємо що менеджер ще не торкав
    // тогл, тримаємо title прихованим. Якщо `hidden` присутній (хай і без
    // ключа title) — менеджер уже свідомо керував видимістю, не нав'язуємо.
    hidden: (() => {
      const sanitized = sanitizeHidden(s.hidden, EVENT_ALL_REGIONS) || {};
      if (!s.hidden) sanitized.title = true;
      return Object.keys(sanitized).length > 0 ? sanitized : undefined;
    })(),
    cardWidth: clampNum(s.cardWidth, EVENT_CARD_WIDTH_MIN, EVENT_CARD_WIDTH_MAX, EVENT_CARD_WIDTH_DEFAULT),
    cardHeight: clampNum(s.cardHeight, EVENT_CARD_HEIGHT_MIN, EVENT_CARD_HEIGHT_MAX, EVENT_CARD_HEIGHT_DEFAULT),
    titleWidth: typeof s.titleWidth === "number"
      ? clampNum(s.titleWidth, EVENT_TITLE_WIDTH_MIN, EVENT_TITLE_WIDTH_MAX, EVENT_CARD_WIDTH_DEFAULT)
      : undefined,
    titleHeight: typeof s.titleHeight === "number"
      ? clampNum(s.titleHeight, EVENT_TITLE_HEIGHT_MIN, EVENT_TITLE_HEIGHT_MAX, 90)
      : undefined,
    titleBgColor: typeof s.titleBgColor === "string" ? s.titleBgColor : undefined,
    titleBorderRadius: typeof s.titleBorderRadius === "number"
      ? clampNum(s.titleBorderRadius, 0, 999, 14)
      : undefined,
  };
}

/** Рядок-лейбл шаблону для UI. */
export function templateKindLabel(kind: TemplateKind): string {
  return kind === "ARTICLE" ? "Стаття / Огляд" : "Подія / Фахівець";
}
