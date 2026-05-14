/// Sanitize rich-text HTML (news blocks, admin-authored) перед рендером через
/// dangerouslySetInnerHTML. Блокує <script>, event-handlers, javascript: URLs.
/// Працює і на сервері (SSR), і на клієнті — sanitize-html не тягне jsdom,
/// чим уникає Vercel Lambda issue з require(ESM) в html-encoding-sniffer.

import sanitizeHtmlLib from "sanitize-html";

/// Whitelist тегів + атрибутів, що може писати редактор новин (Tiptap).
/// Якщо користувач додасть новий блок — додай тег сюди.
const ALLOWED_TAGS = [
  "p", "br", "strong", "em", "u", "s", "code", "pre", "blockquote",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li",
  "a", "img", "figure", "figcaption",
  "table", "thead", "tbody", "tr", "th", "td",
  "hr", "span", "div",
];
const ALLOWED_ATTR = ["href", "src", "alt", "title", "class", "id", "target", "rel", "width", "height", "loading", "style", "data-bgfill"];

/// Whitelist style properties — потрібен щоб inline-кольори/шрифти/розмір з
/// TipTap TextStyle/Color/FontFamily/FontSize не стрипались на публіці. Без
/// цього builder показує одне (там style лишається на live-DOM редактора), а
/// SSR-render — інше (sanitize видирає style повністю → fallback на wrapper).
const ALLOWED_STYLES: Record<string, Record<string, RegExp[]>> = {
  "*": {
    color: [/^.+$/],
    "background-color": [/^.+$/],
    "font-size": [/^\d+(?:\.\d+)?(?:px|em|rem|%|pt)$/],
    "font-family": [/^[\w\s,'"-]+$/],
    "font-weight": [/^(?:normal|bold|\d{3})$/],
    "font-style": [/^(?:normal|italic|oblique)$/],
    "text-align": [/^(?:left|center|right|justify|start|end)$/],
    "text-decoration": [/^[\w\s-]+$/],
    // FontWeight extension (плавна жирність) — пропускаємо variation-settings,
    // text-shadow та -webkit-text-stroke. Sanitize дозволяє лише визначені CSS —
    // без цих regex стилі стрипались би і fake-bold не працював на public.
    "font-variation-settings": [/^[\w\s,'"-.()]+$/],
    "text-shadow": [/^[\w\s,.()#-]+$/],
    "-webkit-text-stroke": [/^[\w\s,.()#-]+$/],
    "-webkit-text-stroke-width": [/^[\d.]+(?:px|em|%)$/],
    "-webkit-text-stroke-color": [/^[\w\s,.()#-]+$/],
    // BackgroundFill mark (підкладка під написом) у news editor: span з
    // background-color (вище) + border-radius + box-shadow + padding +
    // box-decoration-break. Без цього sanitize стирає радіус/тінь.
    "border-radius": [/^\d+(?:\.\d+)?(?:px|em|%)$/],
    "box-shadow": [/^[\w\s,.()#-]+$/],
    padding: [/^[\w\s.%-]+$/],
    margin: [/^[\w\s.%-]+$/],
    "letter-spacing": [/^-?\d+(?:\.\d+)?(?:px|em|rem|%)$/],
    "line-height": [/^[\d.]+(?:px|em|rem|%)?$/],
    border: [/^[\w\s,.()#-]+$/],
    "border-left": [/^[\w\s,.()#-]+$/],
    "border-right": [/^[\w\s,.()#-]+$/],
    "border-top": [/^[\w\s,.()#-]+$/],
    "border-bottom": [/^[\w\s,.()#-]+$/],
    "box-decoration-break": [/^(?:clone|slice)$/],
    "-webkit-box-decoration-break": [/^(?:clone|slice)$/],
  },
};

export function sanitizeHtml(html: string): string {
  return sanitizeHtmlLib(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { "*": ALLOWED_ATTR },
    allowedStyles: ALLOWED_STYLES,
    allowedSchemes: ["http", "https", "mailto", "tel"],
    disallowedTagsMode: "discard",
  });
}
