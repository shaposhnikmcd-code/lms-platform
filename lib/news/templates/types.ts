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

/** Acceptable for inputs from form: shallow + nested merge для cover/cta/sections. */
function mergeDefaults(kind: TemplateKind, src: Record<string, unknown>): ArticleData | EventData {
  const def = defaultsFor(kind);
  if (kind === "ARTICLE") {
    const d = def as ArticleData;
    const s = src as Partial<ArticleData>;
    return {
      cover: { ...d.cover, ...(s.cover || {}) },
      category: s.category ?? d.category,
      title: s.title ?? d.title,
      lead: s.lead ?? d.lead,
      sections: Array.isArray(s.sections) && s.sections.length > 0
        ? s.sections.map(sec => ({
            heading: sec?.heading ?? "",
            body: sec?.body ?? "",
            image: sec?.image
              ? { url: sec.image.url ?? "", alt: sec.image.alt ?? "", caption: sec.image.caption ?? "" }
              : undefined,
          }))
        : d.sections,
      pullquote: s.pullquote ?? d.pullquote,
      conclusion: s.conclusion ?? d.conclusion,
      authorLine: s.authorLine ?? d.authorLine,
    };
  }
  const d = def as EventData;
  const s = src as Partial<EventData>;
  return {
    photo: { ...d.photo, ...(s.photo || {}) },
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
  };
}

/** Рядок-лейбл шаблону для UI. */
export function templateKindLabel(kind: TemplateKind): string {
  return kind === "ARTICLE" ? "Стаття / Огляд" : "Подія / Фахівець";
}
