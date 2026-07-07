// Визначає, чи новина (templateData / templateBlocks) містить незаповнені
// плейсхолдери шаблону — блоки, які менеджер не наповнив реальним контентом.
//
// Навіщо: новина створюється зі шаблону (blueprint) з порожніми/плейсхолдер-
// блоками. Якщо менеджер випадково опублікує її не заповнивши — на /news
// користувачі побачать або літерал «Заголовок»/«Текст»/«Цитата», або порожній
// каркас (напр. зелена рамка цитати без тексту). Гард блокує таку публікацію.
//
// ── Чому судимо і по «порожньо», і по «плейсхолдер-токену» ─────────────────
// Редактор (TipTap) серіалізує НЕторкнутий блок недетерміновано: інколи як
// `<p></p>` (порожньо), інколи як `<p style="…">Заголовок</p>` (літерал-токен).
// Обидва стани для менеджера виглядають однаково («Заголовок» на канвасі через
// CSS-placeholder), але рендеряться по-різному й раніше трактувались по-різному
// гардом → та сама новина то блокувалась, то публікувалась. Тому нормалізуємо
// вміст до чистого тексту й трактуємо ОБИДВА стани як «незаповнено» — гард стає
// детермінованим і не залежить від тегів/стилів/варіації серіалізації.
//
// Пріоритет джерела ДЗЕРКАЛИТЬ рендер (lib/news/render.tsx → newsCard, а також
// app/[locale]/news/[slug]/page.tsx): `templateBlocks` (block-based) >
// `templateData` (legacy form-based). «Заповненість» судимо з ТОГО Ж джерела,
// що й рендериться — інакше валідація розсинхронізується з тим, що бачить юзер.

// Текстові блоки, які несуть видимий контент і повинні бути заповнені.
const TEXT_BLOCK_TYPES = new Set(["heading", "text", "quote"]);

// Плейсхолдер-токен для кожного типу (lowercase). Якщо чистий текст блока точно
// дорівнює токену — блок не заповнений (менеджер лишив дефолт). Порівняння
// case-insensitive. Реальний заголовок, що буквально дорівнює слову «Заголовок»,
// — малоймовірний і легко перефразовується; свідомий компроміс.
const PLACEHOLDER_TOKENS: Record<string, string> = {
  heading: "заголовок",
  text: "текст",
  quote: "цитата",
};

// Людські лейбли типів — для повідомлення менеджеру.
const TYPE_LABELS: Record<string, string> = {
  heading: "Заголовок",
  text: "Текст",
  quote: "Цитата",
};

// Square-bracket плейсхолдер: [Назва події], [X грн] тощо. Будь-який непорожній
// вміст у дужках. Використовується і для legacy templateData, і для текстових
// блоків (напр. якщо шаблон містив «[Ім'я фахівця]» у заголовку).
const BRACKET_PLACEHOLDER = /\[[^\[\]]{1,}\]/u;

export interface PlaceholderIssue {
  /** Читабельний зразок для повідомлення — БЕЗ HTML (напр. «Заголовок», «[Назва події]»). */
  sample: string;
  /** Джерело: "block" — блок templateBlocks; "data" — legacy templateData JSON. */
  source: "data" | "block";
  /** Чому незаповнено — для точнішого повідомлення / майбутнього підсвічування. */
  reason: "empty" | "placeholder" | "bracket";
  /** Тип блока ("heading" | "text" | "quote" | …) — лише для source="block". */
  blockType?: string;
  /** id блока — щоб редактор міг підсвітити проблемний блок. Лише source="block". */
  blockId?: string;
}

/**
 * HTML/rich-text → чистий текст: прибирає теги, розкриває базові entity,
 * зрізає zero-width символи та зайві пробіли. Порожній результат ("") означає
 * візуально-порожній блок (у т.ч. `<p></p>`, `<p><br></p>`, `<p>&nbsp;</p>`).
 */
function plainText(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Глибокий обхід — повертає перший рядок зі square-bracket плейсхолдером.
 * Для legacy templateData (довільний JSON-скелет шаблону).
 */
function findBracketInValue(v: unknown): string | null {
  if (typeof v === "string") {
    const m = v.match(BRACKET_PLACEHOLDER);
    return m ? m[0] : null;
  }
  if (Array.isArray(v)) {
    for (const item of v) {
      const hit = findBracketInValue(item);
      if (hit) return hit;
    }
    return null;
  }
  if (v && typeof v === "object") {
    for (const item of Object.values(v as Record<string, unknown>)) {
      const hit = findBracketInValue(item);
      if (hit) return hit;
    }
  }
  return null;
}

/**
 * Парсить templateBlocks у непорожній масив блоків або повертає null.
 * Дзеркалить умову рендера (lib/news/render.tsx → newsCard: `tplBlocks.isJson &&
 * tplBlocks.blocks.length > 0`) — саме за неї новина показується з блоків.
 */
function parseBlockArray(templateBlocks: string | null | undefined): unknown[] | null {
  if (!templateBlocks) return null;
  try {
    const parsed = JSON.parse(templateBlocks);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

/** Незаповнені текстові блоки (heading/text/quote) у масиві блоків. */
function collectBlockIssues(blocks: unknown[]): PlaceholderIssue[] {
  const issues: PlaceholderIssue[] = [];
  for (const b of blocks) {
    if (!b || typeof b !== "object") continue;
    const type = (b as { type?: string }).type;
    if (!type || !TEXT_BLOCK_TYPES.has(type)) continue;
    const data = (b as { data?: Record<string, unknown> }).data || {};
    const blockId = (b as { id?: string }).id;

    // Контент блока: новий формат data.html (rich), fallback data.text (legacy).
    const text = plainText(data.html ?? data.text ?? "");

    if (text === "") {
      issues.push({ sample: TYPE_LABELS[type] || type, source: "block", reason: "empty", blockType: type, blockId });
      continue;
    }
    if (text.toLowerCase() === PLACEHOLDER_TOKENS[type]) {
      issues.push({ sample: TYPE_LABELS[type] || type, source: "block", reason: "placeholder", blockType: type, blockId });
      continue;
    }
    const bracket = text.match(BRACKET_PLACEHOLDER);
    if (bracket) {
      issues.push({ sample: bracket[0], source: "block", reason: "bracket", blockType: type, blockId });
    }
  }
  return issues;
}

/**
 * Повертає ВСІ незаповнені плейсхолдери новини — порожній масив якщо все ок.
 *
 *   • Є валідні блоки → судимо виключно по них (legacy templateData лишається
 *     рудиментним placeholder-скелетом, який конструктор не оновлює й рендер не
 *     показує — його дужки НЕ мають блокувати публікацію).
 *   • Блоків немає → новина рендериться з templateData → перевіряємо його.
 */
export function findUnfilledPlaceholders(
  templateData: string | null | undefined,
  templateBlocks: string | null | undefined
): PlaceholderIssue[] {
  const blocks = parseBlockArray(templateBlocks);
  if (blocks) {
    return collectBlockIssues(blocks);
  }

  const issues: PlaceholderIssue[] = [];
  if (templateData) {
    try {
      const parsed = JSON.parse(templateData);
      const hit = findBracketInValue(parsed);
      if (hit) issues.push({ sample: hit, source: "data", reason: "bracket" });
    } catch {
      // Невалідний JSON — не наша проблема тут; інший validation його упіймає.
    }
  }
  return issues;
}

/**
 * Чи новина у "draft-content" стані — хоч один блок не заповнений.
 */
export function hasUnfilledPlaceholders(
  templateData: string | null | undefined,
  templateBlocks: string | null | undefined
): boolean {
  return findUnfilledPlaceholders(templateData, templateBlocks).length > 0;
}

/**
 * Людський опис незаповнених блоків для повідомлення менеджеру — БЕЗ HTML.
 * Групує блокові issues за типом з підрахунком («2 «Заголовок», 1 «Цитата»»),
 * bracket-issues з templateData показує зразком. Єдине джерело тексту помилки —
 * і для API-відповіді, і (в майбутньому) для клієнтського підсвічування.
 */
export function describeUnfilled(issues: PlaceholderIssue[]): string {
  const parts: string[] = [];

  // Групуємо блокові issues за типом.
  const byType = new Map<string, number>();
  const brackets: string[] = [];
  for (const i of issues) {
    if (i.source === "block" && i.blockType && i.reason !== "bracket") {
      byType.set(i.blockType, (byType.get(i.blockType) || 0) + 1);
    } else {
      brackets.push(i.sample);
    }
  }
  for (const [type, count] of byType) {
    parts.push(`${count} «${TYPE_LABELS[type] || type}»`);
  }
  for (const sample of brackets.slice(0, 3)) {
    parts.push(`«${sample}»`);
  }
  return parts.join(", ");
}
