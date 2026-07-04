// Перевіряє чи новина (templateData / templateBlocks) містить незаповнені
// плейсхолдери з template-defaults. Дефолти у [lib/news/templates/types.ts]
// мають форму "[Назва події]", "[X грн]" тощо; також heading-блок у пустому
// шаблоні приходить з HTML "<p>Заголовок</p>" / "<p>Текст</p>".
//
// Хочемо запобігти ситуації, коли менеджер створив новину зі шаблону, не
// заповнив поля, і випадково опублікував — на /news ці плейсхолдери видно
// користувачам.

// Шукає [Назва...], [Заголовок], [X грн] — будь-який square-bracket плейсхолдер
// з кириличним або українським текстом всередині. Цифри/латиниця/спецсимволи
// дозволені, але має бути хоча б 1 символ.
const BRACKET_PLACEHOLDER = /\[[^\[\]]{1,}\]/u;

// Дефолтний HTML heading/text блоків template-конструктора. Якщо HTML точно
// дорівнює одному з цих варіантів — значить менеджер не заповнив блок.
const DEFAULT_BLOCK_HTMLS: Record<string, ReadonlySet<string>> = {
  heading: new Set([
    "<p>Заголовок</p>",
    '<p style="text-align: center;">Заголовок</p>',
    '<p style="text-align: left;">Заголовок</p>',
    '<p style="text-align: right;">Заголовок</p>',
  ]),
  text: new Set([
    "<p>Текст</p>",
    '<p style="text-align: center;">Текст</p>',
    '<p style="text-align: left;">Текст</p>',
  ]),
  quote: new Set([
    "<p>Цитата</p>",
    '<p style="text-align: center;">Цитата</p>',
  ]),
};

export interface PlaceholderIssue {
  /** Який саме плейсхолдер знайдено — для повідомлення менеджеру. */
  sample: string;
  /** Де знайдено: "data" — у templateData JSON, "block" — у templateBlocks heading/text. */
  source: "data" | "block";
}

/**
 * Глибокий обхід об'єкта/масиву; повертає перший рядок зі square-bracket
 * плейсхолдером. Достатньо одного для блокування публікації.
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
function parseBlockArray(
  templateBlocks: string | null | undefined
): unknown[] | null {
  if (!templateBlocks) return null;
  try {
    const parsed = JSON.parse(templateBlocks);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

/** Шукає незаповнені (дефолтні) heading/text/quote-блоки у масиві блоків. */
function collectBlockIssues(blocks: unknown[]): PlaceholderIssue[] {
  const issues: PlaceholderIssue[] = [];
  for (const b of blocks) {
    if (!b || typeof b !== "object") continue;
    const type = (b as { type?: string }).type;
    const html = (b as { data?: { html?: string } }).data?.html;
    if (!type || !html) continue;
    const defaults = DEFAULT_BLOCK_HTMLS[type];
    if (defaults?.has(html)) {
      issues.push({ sample: html, source: "block" });
      break; // одного достатньо
    }
  }
  return issues;
}

/**
 * Повертає незаповнені плейсхолдери новини — порожній масив якщо все заповнено.
 *
 * Пріоритет джерела ДЗЕРКАЛИТЬ рендер (lib/news/render.tsx → newsCard, а також
 * app/[locale]/news/[slug]/page.tsx): `templateBlocks` (block-based) > `templateData`
 * (legacy form-based). «Заповненість» новини судимо з ТОГО Ж джерела, що й
 * рендериться:
 *
 *   • Є валідні блоки → новина показується саме з них. Legacy `templateData`
 *     лишається копією placeholder-скелета шаблону (`[Назва події]` тощо) і
 *     конструктором НЕ оновлюється, тож до рендеру не потрапляє — і його
 *     плейсхолдери НЕ мають блокувати публікацію. Судимо виключно по блоках.
 *   • Блоків немає → новина рендериться з `templateData`. Перевіряємо його.
 *
 * Без цього дзеркала валідація розсинхронізована з рендером: заповнена блокова
 * новина вічно вважалася «незаповненою» через рудиментний templateData —
 * не публікувалась (422), ховалась з /news і показувала «⚠ Незаповнено».
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
      if (hit) issues.push({ sample: hit, source: "data" });
    } catch {
      // Невалідний JSON — не наша проблема тут; інший validation його упіймає.
    }
  }
  return issues;
}

/**
 * Чи новина у "draft-content" стані — створена зі шаблону, але хоч одне
 * placeholder-поле не замінене на реальний контент.
 */
export function hasUnfilledPlaceholders(
  templateData: string | null | undefined,
  templateBlocks: string | null | undefined
): boolean {
  return findUnfilledPlaceholders(templateData, templateBlocks).length > 0;
}
