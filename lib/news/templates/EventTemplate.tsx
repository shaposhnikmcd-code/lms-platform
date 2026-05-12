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

function paragraphs(text: string): string[] {
  if (!text) return [];
  return text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
}

/** Region-id-и для field↔preview-зонування в редакторі. Кожен мапиться на
 *  відповідний section у формі лівого панелю. */
export type EventRegion = "photo" | "metrics" | "cta" | "specialist" | "about" | "education";

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

export default function EventTemplate({ data, fixedHeight, disableLinks, highlight }: Props) {
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
    height: fixedHeight ? `${fixedHeight}px` : undefined,
    minHeight: fixedHeight ? undefined : 460,
    containerType: "inline-size",
  };

  return (
    <article style={cardStyle} className="event-tpl-card">
      {/* ── LEFT: фото з overlay (приховано якщо hidden.photo) ─────────────── */}
      {!photoHidden && (
      <div
        style={{
          position: "relative",
          background: "#1C3A2E",
          minHeight: 360,
          overflow: "hidden",
          ...h("photo"),
        }}
      >
        {data.photo.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.photo.url}
            alt={data.photo.alt || data.specialistName || ""}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
            loading="lazy"
          />
        ) : (
          // Soft "no photo yet" стан — diagonal pinstripe + центрований icon.
          // Не різкий емоджі на пустому темному фоні, а делікатний placeholder.
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "repeating-linear-gradient(135deg, rgba(212,168,67,0.05) 0 12px, rgba(212,168,67,0) 12px 24px)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
            aria-hidden
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                border: "1.5px dashed rgba(245,225,164,0.45)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "rgba(245,225,164,0.6)",
                fontSize: 24,
              }}
            >
              👤
            </div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "rgba(245,225,164,0.55)",
              }}
            >
              Фото фахівця
            </div>
          </div>
        )}

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

        {/* Knee block: name+role+tagline ~60% з низу */}
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
          }}
        >
          {/* Specialist block (name + role + tagline) — region "specialist" */}
          {!isHidden("specialist") && (data.specialistName || data.specialistRole || data.specialistTagline) && (
            <div style={{ ...h("specialist"), padding: highlight === "specialist" ? "4px 8px" : 0, margin: highlight === "specialist" ? "-4px -8px" : 0 }}>
              {data.specialistName && (
                <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2, marginBottom: 4 }}>
                  {data.specialistName}
                </div>
              )}
              {data.specialistRole && (
                <div style={{ fontSize: 12, fontWeight: 600, color: "#F5E1A4", letterSpacing: "0.04em" }}>
                  {data.specialistRole}
                </div>
              )}
              {data.specialistTagline && (
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.78)", fontWeight: 500, marginTop: 2 }}>
                  ▪ {data.specialistTagline}
                </div>
              )}
            </div>
          )}

          {/* Price + duration row — region "metrics" */}
          {!isHidden("metrics") && (data.price || data.duration) && (
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
              {data.price && (
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.16em", color: "rgba(245,225,164,0.85)" }}>ВАРТІСТЬ</div>
                  <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{data.price}</div>
                </div>
              )}
              {data.duration && (
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.16em", color: "rgba(245,225,164,0.85)" }}>ТРИВАЛІСТЬ</div>
                  <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{data.duration}</div>
                </div>
              )}
            </div>
          )}

          {/* CTA. У disableLinks-режимі (картка вже всередині <Link>) рендеримо
              як <span> зі стилем кнопки — навігація піде через зовнішній <Link>. */}
          {!isHidden("cta") && data.ctaLabel && (
            <div style={{ marginTop: 16, ...h("cta") }}>
              {data.ctaHref && !disableLinks ? (
                <a
                  href={data.ctaHref}
                  target={data.ctaHref.startsWith("http") ? "_blank" : undefined}
                  rel={data.ctaHref.startsWith("http") ? "noopener noreferrer" : undefined}
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
                  {data.ctaLabel}
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
                  {data.ctaLabel}
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
            <SectionLabel text="Про фахівця" />
            <div style={{ marginTop: 10 }}>
              {paragraphs(data.about).map((p, i) => (
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
              ))}
            </div>
          </section>
        )}

        {/* Освіта та кваліфікація */}
        {!isHidden("education") && data.education.length > 0 && (
          <section style={h("education")}>
            <SectionLabel text="Освіта та кваліфікація" />
            <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0" }}>
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
      `}</style>
    </article>
  );
}

function SectionLabel({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ width: 14, height: 2, background: "#1C3A2E", flexShrink: 0 }} aria-hidden />
      <span
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "#1C3A2E",
        }}
      >
        {text}
      </span>
    </div>
  );
}
