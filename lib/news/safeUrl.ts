// Allow-list схем для href-ів, що рендеряться публічно. Блокує javascript:,
// data:, vbscript: тощо — інакше admin/manager-контент (напр. EVENT-шаблон
// ctaHref) стає вектором stored-XSS на публічній сторінці /news/[slug].
// Дозволяємо: http(s), відносні шляхи (/…), mailto:, tel:.
const SAFE_HREF_RE = /^(https?:\/\/|\/|mailto:|tel:)/i;

/** Повертає href якщо схема безпечна, інакше "" (посилання не рендериться). */
export function safeHref(href: string | null | undefined): string {
  const h = (href ?? "").trim();
  return SAFE_HREF_RE.test(h) ? h : "";
}
