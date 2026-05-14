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
  /** Точка фокусу X у відсотках 0..100. CSS object-position. Default 50 (центр). */
  focalX?: number;
  /** Точка фокусу Y у відсотках 0..100. Default 50 (центр). */
  focalY?: number;
  /** Якщо true — зміни у preview-контролах синхронізуються на page-контроли. */
  linkScale?: boolean;
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
    linkScale: src.linkScale === true,
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
export type EventRegionKey = "photo" | "specialist" | "metrics" | "cta" | "about" | "education";

/** Усі регіони (для validation + hidden map). */
export const EVENT_ALL_REGIONS: EventRegionKey[] = [
  "photo", "specialist", "metrics", "cta", "about", "education",
];

/** Native-розмір картки фахівця у пікселях. Це **внутрішня** ширина рендеру:
 *  на /news/{slug} обмежує контейнер сторінки, у редакторі — задає базу preview,
 *  у feed-блоці page-builder-а слугує `baseWidth` для PreviewCardScale (далі
 *  блок-розмір на канвасі масштабує її до своєї ширини). Висота лишається auto
 *  (контент диктує) на single-page; у preview-режимі — fixed 400px aspect. */
export const EVENT_CARD_WIDTH_MIN = 600;
export const EVENT_CARD_WIDTH_MAX = 1200;
export const EVENT_CARD_WIDTH_DEFAULT = 600;

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
  /** Назва події (overlay на фото зверху або підпис). */
  title: string;
  /** Вартість, наприклад «1300 грн». */
  price: string;
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
  /** Текст «Про фахівця» — кілька абзаців через \n\n. */
  about: string;
  /** Список освітніх записів. Кожен — title + meta-рядок (роки/тип). */
  education: EventEducationItem[];
  /** Map region→hidden. Якщо `hidden[region] === true` — секція не рендериться. */
  hidden?: Partial<Record<EventRegionKey, boolean>>;
  /** Native-ширина картки в пікселях. Контролює base-розмір рендеру у всіх
   *  точках споживання (single-page /news/{slug}, feed-блок у page-builder-і,
   *  preview у редакторі). Default — EVENT_CARD_WIDTH_DEFAULT (600). */
  cardWidth: number;
}

export const EVENT_DEFAULTS: EventData = {
  photo: { url: "", alt: "", caption: "" },
  title: "[Назва події]",
  price: "[X грн]",
  duration: "[N хв]",
  ctaLabel: "Записатися на консультацію",
  ctaHref: "",
  specialistName: "[Імʼя Прізвище]",
  specialistRole: "[Посада / спеціалізація]",
  specialistTagline: "[Tagline — досвід або фокус, 1 рядок]",
  about:
    "Опишіть фахівця — підхід, з ким працює, у чому експертний. 2-3 речення, без зайвої теорії — конкретика про користь для клієнта.\n\n" +
    "Можна додати другий абзац: про що клієнти найчастіше звертаються, який формат сесій, очікувані результати.",
  education: [
    { title: "[Назва освіти]", meta: "[Тип / диплом · роки]" },
    { title: "[Друга освіта]", meta: "[Програма · рік завершення]" },
    { title: "[Курс підвищення]", meta: "[Школа · рік]" },
  ],
  cardWidth: EVENT_CARD_WIDTH_DEFAULT,
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
    price: s.price ?? d.price,
    duration: s.duration ?? d.duration,
    ctaLabel: s.ctaLabel ?? d.ctaLabel,
    ctaHref: s.ctaHref ?? d.ctaHref,
    specialistName: s.specialistName ?? d.specialistName,
    specialistRole: s.specialistRole ?? d.specialistRole,
    specialistTagline: s.specialistTagline ?? d.specialistTagline,
    about: s.about ?? d.about,
    education: Array.isArray(s.education) && s.education.length > 0
      ? s.education.map(e => ({ title: e?.title ?? "", meta: e?.meta ?? "" }))
      : d.education,
    hidden: sanitizeHidden(s.hidden, EVENT_ALL_REGIONS),
    cardWidth: clampNum(s.cardWidth, EVENT_CARD_WIDTH_MIN, EVENT_CARD_WIDTH_MAX, EVENT_CARD_WIDTH_DEFAULT),
  };
}

/** Рядок-лейбл шаблону для UI. */
export function templateKindLabel(kind: TemplateKind): string {
  return kind === "ARTICLE" ? "Стаття / Огляд" : "Подія / Фахівець";
}
