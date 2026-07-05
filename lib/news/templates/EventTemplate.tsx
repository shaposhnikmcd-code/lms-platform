// EVENT-шаблон: 2-колонкова картка фахівця/події.
//
// Розкладка (desktop, контейнер ≥640px):
//   - LEFT (≈40%): фото-anonsus вертикальний 3:4 з overlay-шаром.
//     Overlay-вміст в нижній частині фото:
//       • Імʼя фахівця (велике, біле)
//       • Роль / spec (мала caps, gold)
//       • Tagline (мала, white-70)
//       • Card з ВАРТІСТЮ + ТРИВАЛІСТЮ
//       • Кнопка CTA (gold, повна ширина)
//   - RIGHT (≈60%): біла інфо-картка з 2 секціями
//       • «Про фахівця» (paragraphs)
//       • «Освіта та кваліфікація» (список)
//
// Mobile (контейнер <640px) — стек: фото зверху, інфо знизу.

import React from "react";
import type { EventData } from "./types";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import { safeHref } from "@/lib/news/safeUrl";
import CoverImageBox from "./CoverImageBox";
import { parseImageOverlays, renderImageOverlay } from "@/lib/news/render";

function paragraphs(text: string): string[] {
  if (!text) return [];
  return text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
}

/** Чи value виглядає як HTML (містить <тег>). Для backward-compat: plain text
 *  значення з міграції шаблонів все ще працює через paragraphs(). */
function looksLikeHtml(value: string): boolean {
  return /<\w+[^>]*>/.test(value || "");
}

/** Рендер inline-значення: якщо HTML — через sanitizeHtml + dangerouslySetInnerHTML,
 *  інакше — як plain text. Використовується для коротких полів (імʼя, роль, ціна,
 *  CTA, заголовки секцій), де користувач може застосовувати inline-форматування
 *  через ✎ Редактор. Тег-обгортка (span/h2/div) — задає caller. */
function Inline({ value, as: Tag = "span", style, className }: {
  value: string;
  as?: "span" | "div";
  style?: React.CSSProperties;
  className?: string;
}) {
  if (looksLikeHtml(value)) {
    return <Tag style={style} className={className} dangerouslySetInnerHTML={{ __html: sanitizeHtml(value) }} />;
  }
  return <Tag style={style} className={className}>{value}</Tag>;
}

/** Region-id-и для field↔preview-зонування в редакторі. Кожен мапиться на
 *  відповідний section у формі лівого панелю. */
export type EventRegion = "title" | "photo" | "metrics" | "cta" | "specialist" | "about" | "education";

interface Props {
  data: EventData;
  /** Висота контейнера. Якщо передано — фіксує висоту картки (для preview-mode).
   *  Інакше — auto height (для повної сторінки /news/{slug}). */
  fixedHeight?: number;
  /** Якщо true — CTA-кнопка рендериться як `<span>` замість `<a>`. Потрібно
   *  коли вся картка вже обгорнута в зовнішній `<Link>` (admin-thumbnail,
   *  newsCard preview-блок на /news listing) — інакше HTML-нестинг `<a>` у
   *  `<a>` ламає hydration. Сама картка в цьому режимі тригерить навігацію
   *  батьківського Link-у, CTA лише візуально позначає action. */
  disableLinks?: boolean;
  /** Підсвічена зона: коли менеджер фокусує поле в редакторі, відповідний
   *  блок на превʼю отримує amber-ring outline + box-shadow. Допомагає
   *  візуально мапнути field→preview. null = немає підсвітки. */
  highlight?: EventRegion | null;
  /** Якщо передано — обмежує native width картки і центрує її у батьківському
   *  контейнері. Використовується на /news/{slug} (full-page render) — щоб
   *  картка відображалась у тій же ширині, що менеджер обрав у редакторі,
   *  а не розтягувалась на 100% контейнера сторінки. Якщо undefined —
   *  width 100% (картка заповнює довірений батьком слот). */
  maxWidth?: number;
  /** Який набір photo-параметрів використовувати при рендері: preview-fit/scale
   *  для feed-картки і page-fit/scale для повної сторінки. Default — "page". */
  photoRole?: "preview" | "page";
  /** Якщо задано — клік по фото викликає колбек з focal-координатами 0..100.
   *  Активує crosshair cursor + дот-маркер у точці фокусу. Лише для editor. */
  onPhotoFocalClick?: (x: number, y: number) => void;
  /** Editor-mode slot для заголовку-блоку. Якщо передано — рендериться замість
   *  default-рендеру (data.titleHtml/title). Використовується TemplateEditor щоб
   *  підставити HeadingEditor inline. Public-render слот не передає. */
  titleSlot?: React.ReactNode;
  /** Editor-mode slot для фото-блоку. Якщо передано — рендериться замість фото.
   *  Використовується TemplateEditor щоб підставити ImageEditor inline. */
  photoSlot?: React.ReactNode;
  /** Click-handler на заголовок-блок (для selection-state у редакторі). */
  onTitleClick?: () => void;
  /** Click-handler на фото-блок (для selection-state у редакторі). */
  onPhotoClick?: () => void;
  /** Чи виділений заголовок (показуємо amber-ring коли true). */
  titleSelected?: boolean;
  /** Чи виділена фото-секція. */
  photoSelected?: boolean;
  /** Якщо true — heading-блок взагалі не рендериться (повертається лише
   *  article). Використовується редактором, який рендерить heading зовні
   *  у власному resizable-wrapper-і. */
  skipHeading?: boolean;
}

/** Стиль region-обводки коли активний. Не міняє layout (outline + box-shadow). */
function regionStyle(active: boolean): React.CSSProperties {
  if (!active) return {};
  return {
    outline: "2px solid #D4A843",
    outlineOffset: 3,
    borderRadius: 6,
    boxShadow: "0 0 0 6px rgba(212,168,67,0.20), 0 8px 24px -4px rgba(212,168,67,0.45)",
    transition: "outline 0.18s, box-shadow 0.18s",
  };
}

export default function EventTemplate({
  data,
  fixedHeight,
  disableLinks,
  highlight,
  maxWidth,
  photoRole = "page",
  onPhotoFocalClick,
  titleSlot,
  photoSlot,
  onTitleClick,
  onPhotoClick,
  titleSelected,
  photoSelected,
  skipHeading,
}: Props) {
  const h = (region: EventRegion) => regionStyle(highlight === region);
  const hidden = data.hidden || {};
  const isHidden = (r: EventRegion) => hidden[r] === true;
  // Якщо photo приховано — колапсимо ліву колонку, info-панель стає full-width.
  // Це професійний fallback: вертикальна 1-col картка без зайвого пустого місця.
  const photoHidden = isHidden("photo");
  const cardStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: photoHidden ? "1fr" : "minmax(0, 0.85fr) minmax(0, 1fr)",
    background: "#fff",
    borderRadius: 18,
    overflow: "hidden",
    boxShadow: "0 10px 30px -12px rgba(28,58,46,0.18), 0 2px 6px rgba(28,58,46,0.06)",
    fontFamily: "Inter, system-ui, -apple-system, sans-serif",
    color: "#1C1917",
    width: "100%",
    maxWidth: maxWidth ? `${maxWidth}px` : undefined,
    marginLeft: maxWidth ? "auto" : undefined,
    marginRight: maxWidth ? "auto" : undefined,
    height: fixedHeight ? `${fixedHeight}px` : undefined,
    minHeight: fixedHeight ? undefined : 460,
    containerType: "inline-size",
  };

  // Title-блок НАД карткою — використовує `data.titleHtml` (rich HTML з
   // HeadingEditor) з fallback на plain `data.title` обгорнутий у <p>.
   // Toggle через hidden.title. Рендериться лише якщо є непорожній контент
   // АБО передано editor-slot. titleSlot завжди має пріоритет.
  const effectiveTitleHtml = (data.titleHtml && data.titleHtml.trim() !== "")
    ? data.titleHtml
    : (data.title && data.title.trim() !== "" ? `<p>${data.title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>` : "");
  const showCardHeading = !skipHeading && (!!titleSlot || (!isHidden("title") && effectiveTitleHtml !== ""));

  const wrapperStyle: React.CSSProperties = maxWidth
    ? { width: "100%", maxWidth: `${maxWidth}px`, marginLeft: "auto", marginRight: "auto" }
    : { width: "100%" };

  // Якщо є heading — wrap-аємо у fragment, інакше — повертаємо тільки article.
  const cardEl = (
    <article style={{ ...cardStyle, marginLeft: undefined, marginRight: undefined, maxWidth: undefined, width: "100%" }} className="event-tpl-card">
      {/* ── LEFT: фото з overlay (приховано якщо hidden.photo) ─────────────── */}
      {!photoHidden && (
      <div
        onClick={
          // Якщо фото ще НЕ виділене, перший клік — selection (для editor-mode
          // з `onPhotoClick`). Якщо вже виділене АБО onPhotoClick відсутній —
          // клік працює як focal-point picker (старий механізм).
          (onPhotoClick && !photoSelected)
            ? () => onPhotoClick()
            : (onPhotoFocalClick && data.photo.url
              ? (e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = ((e.clientX - rect.left) / rect.width) * 100;
                  const y = ((e.clientY - rect.top) / rect.height) * 100;
                  onPhotoFocalClick(Math.max(0, Math.min(100, x)), Math.max(0, Math.min(100, y)));
                }
              : undefined)
        }
        style={{
          position: "relative",
          background: "#1C3A2E",
          minHeight: 360,
          overflow: "hidden",
          cursor: (onPhotoClick && !photoSelected)
            ? "pointer"
            : (onPhotoFocalClick && data.photo.url ? "crosshair" : undefined),
          ...h("photo"),
          ...(photoSelected ? {
            outline: "2px solid #D4A843",
            outlineOffset: -2,
            boxShadow: "inset 0 0 0 4px rgba(212,168,67,0.20)",
          } : {}),
        }}
      >
        {/* Editor-mode: photoSlot повністю замінює default-рендер фото. */}
        {photoSlot ? photoSlot : (<>
          {data.photo.url ? (
            <>
              <CoverImageBox image={data.photo} role={photoRole} />
              {onPhotoFocalClick && (
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: `${(photoRole === "preview" ? data.photo.previewFocalX : data.photo.pageFocalX) ?? data.photo.focalX ?? 50}%`,
                    top: `${(photoRole === "preview" ? data.photo.previewFocalY : data.photo.pageFocalY) ?? data.photo.focalY ?? 50}%`,
                    width: 14,
                    height: 14,
                    marginLeft: -7,
                    marginTop: -7,
                    borderRadius: "50%",
                    background: "#D4A843",
                    border: "2px solid #FFFFFF",
                    boxShadow: "0 0 0 1px rgba(28,58,46,0.5), 0 2px 6px rgba(0,0,0,0.35)",
                    pointerEvents: "none",
                    transition: "left 0.12s, top 0.12s",
                    zIndex: 5,
                  }}
                />
              )}
            </>
          ) : null
          /* Публічний рендер (photoSlot відсутній) БЕЗ фото: показуємо чистий
             темний панель (bg #1C3A2E + gradient + knee-блок), а НЕ editor-only
             плейсхолдер «👤 Фото фахівця». Раніше діагональний бокс-плейсхолдер
             витікав на /news і /news/{slug}. Editor-mode фото не доходить сюди
             (там завжди photoSlot=ImageEditor з власним upload-affordance). */
          }

          {/* Gradient overlay для читабельності тексту в нижній частині */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(28,58,46,0) 35%, rgba(28,58,46,0.55) 70%, rgba(28,58,46,0.92) 100%)",
              pointerEvents: "none",
            }}
          />
        </>)}

        {/* Text overlays («Текст на фото») — render поверх photo з photo.overlays.
            ВАЖЛИВО: тільки на public render (photoSlot=undefined). В editor-mode
            photoSlot це ImageEditor, який сам рендерить overlays інтерактивно
            (drag/resize/edit-in-place). Інакше overlays дублювалися б. */}
        {!photoSlot && data.photo.overlays && parseImageOverlays(data.photo.overlays).map(ov => renderImageOverlay(ov, { linkable: !disableLinks }))}

        {/* Knee block: name+role+tagline ~60% з низу. У editor-mode (photoSlot
            заданий) обʼявляємо `pointer-events: none` — клік проходить крізь
            на ImageEditor (інакше overlay перекривав би drag-handles фото). */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            padding: "0 22px 22px",
            color: "#fff",
            display: "flex",
            flexDirection: "column",
            gap: 2,
            pointerEvents: photoSlot ? "none" : undefined,
            zIndex: photoSlot ? 1 : undefined,
          }}
        >
          {/* Specialist block (name + role + tagline) — region "specialist" */}
          {!isHidden("specialist") && (data.specialistName || data.specialistRole || data.specialistTagline) && (
            <div style={{ ...h("specialist"), padding: highlight === "specialist" ? "4px 8px" : 0, margin: highlight === "specialist" ? "-4px -8px" : 0 }}>
              {data.specialistName && (
                <Inline
                  as="div"
                  value={data.specialistName}
                  style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2, marginBottom: 4 }}
                />
              )}
              {data.specialistRole && (
                <Inline
                  as="div"
                  value={data.specialistRole}
                  style={{ fontSize: 12, fontWeight: 600, color: "#F5E1A4", letterSpacing: "0.04em" }}
                />
              )}
              {data.specialistTagline && (
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.78)", fontWeight: 500, marginTop: 2 }}>
                  ▪ <Inline as="span" value={data.specialistTagline} />
                </div>
              )}
            </div>
          )}

          {/* Price + duration row — region "metrics". Раніше bail-аутили коли
              `data.price` і `data.duration` обидва порожні — тоді включення
              видимості через 👁 у формі не давало візуальних змін (label-only
              випадок не покривали). Тепер показуємо row якщо хоч одне з чотирьох
              полів непорожнє: дає менеджеру feedback одразу після toggle. */}
          {!isHidden("metrics") && (data.price || data.duration || data.priceLabel || data.durationLabel) && (
            <div
              style={{
                display: "flex",
                gap: 24,
                marginTop: 18,
                paddingTop: 14,
                borderTop: "1px solid rgba(245,225,164,0.25)",
                ...h("metrics"),
              }}
            >
              {(data.price || data.priceLabel) && (
                <div>
                  {data.priceLabel && (
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.16em", color: "rgba(245,225,164,0.85)" }}>{data.priceLabel}</div>
                  )}
                  {data.price && (
                    <Inline as="div" value={data.price} style={{ fontSize: 18, fontWeight: 700, marginTop: data.priceLabel ? 2 : 0 }} />
                  )}
                </div>
              )}
              {(data.duration || data.durationLabel) && (
                <div>
                  {data.durationLabel && (
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.16em", color: "rgba(245,225,164,0.85)" }}>{data.durationLabel}</div>
                  )}
                  {data.duration && (
                    <Inline as="div" value={data.duration} style={{ fontSize: 18, fontWeight: 700, marginTop: data.durationLabel ? 2 : 0 }} />
                  )}
                </div>
              )}
            </div>
          )}

          {/* CTA. У disableLinks-режимі (картка вже всередині <Link>) рендеримо
              як <span> зі стилем кнопки — навігація піде через зовнішній <Link>. */}
          {!isHidden("cta") && data.ctaLabel && (
            <div style={{ marginTop: 16, ...h("cta") }}>
              {safeHref(data.ctaHref) && !disableLinks ? (
                <a
                  href={safeHref(data.ctaHref)}
                  target={safeHref(data.ctaHref).startsWith("http") ? "_blank" : undefined}
                  rel={safeHref(data.ctaHref).startsWith("http") ? "noopener noreferrer" : undefined}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "100%",
                    padding: "11px 18px",
                    background: "#D4A843",
                    color: "#1C3A2E",
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.10em",
                    textTransform: "uppercase",
                    textDecoration: "none",
                    borderRadius: 4,
                    boxShadow: "0 4px 12px -4px rgba(212,168,67,0.55)",
                    transition: "background 0.15s",
                  }}
                >
                  <Inline as="span" value={data.ctaLabel} />
                </a>
              ) : disableLinks ? (
                // disableLinks=true — preview/thumbnail контекст: рендеримо нормальну
                // кнопку як <span>. Навіть якщо URL ще не заданий — показуємо нативно
                // (без warning-tag-а), бо менеджер дивиться на shape картки, а не
                // тестує кнопку. Зовнішній <Link> картки веде в редактор.
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "100%",
                    padding: "11px 18px",
                    background: data.ctaHref ? "#D4A843" : "rgba(212,168,67,0.85)",
                    color: "#1C3A2E",
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.10em",
                    textTransform: "uppercase",
                    borderRadius: 4,
                    boxShadow: data.ctaHref ? "0 4px 12px -4px rgba(212,168,67,0.55)" : "none",
                  }}
                >
                  <Inline as="span" value={data.ctaLabel} />
                </span>
              ) : (
                // Editor (full page mode) + порожній URL → subtle warning, щоб
                // менеджер бачив що треба дозаповнити.
                <div
                  style={{
                    width: "100%",
                    padding: "11px 18px",
                    background: "rgba(212,168,67,0.35)",
                    color: "rgba(28,58,46,0.65)",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    textAlign: "center",
                    borderRadius: 4,
                    fontStyle: "italic",
                  }}
                  title="Додай URL у формі ліворуч щоб кнопка стала клікабельною"
                >
                  {data.ctaLabel} · URL не задано
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      )}

      {/* ── RIGHT: інфо-картка ─────────────────────────────────────────────── */}
      {/* В fixedHeight-режимі (preview/thumbnail) інфо-панель може скролитись
          для довгих про-секцій. Використовуємо тонкий стилізований scrollbar
          через CSS (нижче), щоб не виглядав важко. На повній сторінці
          (fixedHeight not set) контент розтягує картку — scroll не потрібен. */}
      <div
        className="event-tpl-info"
        style={{
          padding: "24px 26px 26px",
          display: "flex",
          flexDirection: "column",
          gap: 22,
          background: "#fff",
          minWidth: 0,
          overflowY: fixedHeight ? "auto" : "visible",
        }}
      >
        {/* Про фахівця */}
        {!isHidden("about") && data.about && (
          <section style={h("about")}>
            {data.aboutHeading && <SectionLabel text={data.aboutHeading} />}
            <div
              className="event-tpl-about"
              style={{ marginTop: data.aboutHeading ? 10 : 0 }}
            >
              {looksLikeHtml(data.about) ? (
                <div
                  style={{ fontSize: 13.5, lineHeight: 1.65, color: "#292524" }}
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(data.about) }}
                />
              ) : (
                paragraphs(data.about).map((p, i) => (
                  <p
                    key={i}
                    style={{
                      fontSize: 13.5,
                      lineHeight: 1.65,
                      color: "#292524",
                      margin: i === 0 ? "0" : "10px 0 0",
                    }}
                  >
                    {p}
                  </p>
                ))
              )}
            </div>
          </section>
        )}

        {/* Освіта та кваліфікація */}
        {!isHidden("education") && data.education.length > 0 && (
          <section style={h("education")}>
            {data.educationHeading && <SectionLabel text={data.educationHeading} />}
            <ul style={{ listStyle: "none", padding: 0, margin: `${data.educationHeading ? 10 : 0}px 0 0` }}>
              {data.education.map((edu, i) => (
                <li
                  key={i}
                  style={{
                    paddingLeft: 18,
                    marginBottom: 12,
                    position: "relative",
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 6,
                      width: 6,
                      height: 6,
                      borderRadius: 1,
                      background: "#D4A843",
                    }}
                  />
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1C3A2E", lineHeight: 1.35 }}>
                    {edu.title}
                  </div>
                  {edu.meta && (
                    <div style={{ fontSize: 12, color: "#78716C", marginTop: 2, lineHeight: 1.45 }}>
                      {edu.meta}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* Mobile/narrow stack — container query: коли картка вужче 560px,
          колонки стекаються вертикально. + thin scrollbar для info-панелі. */}
      <style>{`
        @container (max-width: 560px) {
          .event-tpl-card { grid-template-columns: 1fr !important; }
          .event-tpl-card > div:first-child { min-height: 420px; }
        }
        @media (max-width: 480px) {
          .event-tpl-card { grid-template-columns: 1fr !important; }
        }
        .event-tpl-info {
          scrollbar-width: thin;
          scrollbar-color: rgba(28,58,46,0.18) transparent;
        }
        .event-tpl-info::-webkit-scrollbar { width: 6px; height: 6px; }
        .event-tpl-info::-webkit-scrollbar-track { background: transparent; }
        .event-tpl-info::-webkit-scrollbar-thumb {
          background: rgba(28,58,46,0.18);
          border-radius: 3px;
        }
        .event-tpl-info::-webkit-scrollbar-thumb:hover {
          background: rgba(28,58,46,0.32);
        }
        .event-tpl-about p { margin: 0 0 10px; }
        .event-tpl-about p:last-child { margin-bottom: 0; }
        .event-tpl-about a { color: #1C3A2E; text-decoration: underline; }
        .event-tpl-card-heading p { margin: 0 0 6px; }
        .event-tpl-card-heading p:last-child { margin-bottom: 0; }
      `}</style>
    </article>
  );

  // Без heading — обгортаємо article у `wrapperStyle` div щоб maxWidth+центрування
  // спрацювали (article inline-style override-ує cardStyle.maxWidth/margin).
  if (!showCardHeading) return <div style={wrapperStyle}>{cardEl}</div>;

  // Editor-selection ring (amber) для title-блоку. Має пріоритет над region-highlight
  // (вони ніколи не співіснують у тій самій сесії редагування).
  const titleSelectionStyle: React.CSSProperties = titleSelected ? {
    outline: "2px solid #D4A843",
    outlineOffset: 3,
    boxShadow: "0 0 0 6px rgba(212,168,67,0.20), 0 8px 24px -4px rgba(212,168,67,0.45)",
  } : {};

  // Auto-contrast: на темних UIMP-фонах (#1C3A2E лісовий, #1a1a1a/#000000 темний)
  // текст має бути кремовим, інакше — лісовим зеленим. Inline-color з TipTap
  // (TextStyle mark на span/p) перекриває цей default — як і має бути.
  const titleBg = data.titleBgColor || "#FFFFFF";
  const titleAutoColor =
    titleBg === "#1C3A2E" || titleBg === "#1a1a1a" || titleBg === "#000000"
      ? "#FAF6F0"
      : "#1C3A2E";
  // Радіус title-обгортки. Default 14 матчить preset «мʼякі» (BLOCK_RADIUS_PRESETS).
  // 999 трактується як pill → 9999px.
  const titleRadiusRaw = data.titleBorderRadius ?? 14;
  const titleBorderRadius = titleRadiusRaw >= 999 ? 9999 : titleRadiusRaw;

  return (
    <div style={wrapperStyle}>
      <div
        className="event-tpl-card-heading"
        onClick={onTitleClick}
        style={{
          padding: "26px 28px 24px",
          marginBottom: 12,
          background: titleBg,
          borderRadius: titleBorderRadius,
          // Плавне оновлення при drag-у слайдера у редакторі. Не впливає на
          // public render (тут лише один state — без переходу між значеннями).
          transition: "border-radius 0.15s ease, background 0.15s ease",
          boxShadow: "0 6px 20px -10px rgba(28,58,46,0.15)",
          textAlign: "center",
          fontFamily: "Inter, system-ui, -apple-system, sans-serif",
          color: titleAutoColor,
          fontSize: 20,
          fontWeight: 700,
          lineHeight: 1.35,
          cursor: onTitleClick ? "pointer" : undefined,
          ...h("title"),
          ...titleSelectionStyle,
        }}
      >
        {titleSlot
          ? titleSlot
          : <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(effectiveTitleHtml) }} />}
      </div>
      {cardEl}
    </div>
  );
}

function SectionLabel({ text }: { text: string }) {
  return (
    <div>
      <Inline
        as="span"
        value={text}
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "#1C3A2E",
        }}
      />
    </div>
  );
}
