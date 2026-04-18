/// Sanitize rich-text HTML (news blocks, admin-authored) перед рендером через
/// dangerouslySetInnerHTML. Блокує <script>, event-handlers, javascript: URLs.
/// Працює і на сервері (SSR), і на клієнті.

import DOMPurify from 'isomorphic-dompurify';

/// Whitelist тегів + атрибутів, що може писати редактор новин (Tiptap).
/// Якщо користувач додасть новий блок — додай тег сюди.
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 's', 'code', 'pre', 'blockquote',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'a', 'img', 'figure', 'figcaption',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'hr', 'span', 'div',
];
const ALLOWED_ATTR = ['href', 'src', 'alt', 'title', 'class', 'id', 'target', 'rel', 'width', 'height', 'loading'];

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // a[href] має бути лише http(s) / mailto / tel; javascript: блокується.
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^:]*$)/i,
    // Забороняємо data-URI (потенційний XSS через iframe/object src).
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'style'],
  });
}
