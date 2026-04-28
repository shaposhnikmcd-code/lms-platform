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
const ALLOWED_ATTR = ["href", "src", "alt", "title", "class", "id", "target", "rel", "width", "height", "loading"];

export function sanitizeHtml(html: string): string {
  return sanitizeHtmlLib(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { "*": ALLOWED_ATTR },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    disallowedTagsMode: "discard",
  });
}
