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
 * Шукає плейсхолдери у templateData (JSON string) і templateBlocks (JSON
 * string з масивом блоків). Повертає масив issue'ів — порожній якщо все
 * заповнено.
 */
export function findUnfilledPlaceholders(
  templateData: string | null | undefined,
  templateBlocks: string | null | undefined
): PlaceholderIssue[] {
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

  if (templateBlocks) {
    try {
      const parsed = JSON.parse(templateBlocks);
      if (Array.isArray(parsed)) {
        for (const b of parsed) {
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
      }
    } catch {
      // ignore
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
