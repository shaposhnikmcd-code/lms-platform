// Editorial-шаблон для News (templateKind = ARTICLE).
//
// Дизайн: Medium / Substack-вибірковий long-form. Hero 16:9, центрований
// title H1, italic-лід, divider, секції H2 + body (паралельно опційне фото
// 4:3 з підписом), pullquote, висновки, author-line.
//
// Фіксовані слоти:
// - Hero cover: aspect-ratio 16:9, object-fit:cover. Будь-яке фото вписується
//   у 920×518px без витискання сусідніх елементів.
// - Section image: aspect-ratio 4:3, object-fit:cover, ширина 70%.
// - Усі тексти — text wrapping; довжина рядка обмежена max-width на блоці.
//
// Сервер-компонент (без 'use client') — render у SSR-пайплайні /news/[slug].

import React from "react";
import type { ArticleData } from "./types";

/** Розрив параграфів за \n\n; trim, фільтр порожніх. */
function paragraphs(text: string): string[] {
  if (!text) return [];
  return text
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean);
}

/** Region-id-и для field↔preview-зонування в редакторі. Мапляться на секції
 *  ArticleForm-у. */
export type ArticleRegion = "cover" | "header" | "sections" | "pullquote" | "conclusion" | "author";

interface Props {
  data: ArticleData;
  /** Hero показуємо лише в SSR-сторінці /news/[slug]. У newsCard expanded —
   *  ховаємо щоб не дублювати з зовнішнім фоном картки. */
  showHero?: boolean;
  /** Підсвічена зона при фокусі поля у редакторі. null → без підсвітки. */
  highlight?: ArticleRegion | null;
}

/** Стиль region-обводки. Не міняє layout — лише outline + box-shadow. */
function regionStyle(active: boolean): React.CSSProperties {
  if (!active) return {};
  return {
    outline: "2px solid #D4A843",
    outlineOffset: 4,
    borderRadius: 8,
    boxShadow: "0 0 0 6px rgba(212,168,67,0.20), 0 8px 24px -4px rgba(212,168,67,0.45)",
    transition: "outline 0.18s, box-shadow 0.18s",
  };
}

export default function ArticleTemplate({ data, showHero = true, highlight }: Props) {
  const h = (region: ArticleRegion) => regionStyle(highlight === region);
  return (
    <article className="article-template" style={{ width: "100%", maxWidth: 920, margin: "0 auto", fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#1C1917" }}>
      {showHero && data.cover.url && (
        <figure
          style={{
            margin: 0,
            width: "100%",
            aspectRatio: "16 / 9",
            background: "#F5F1E8",
            borderRadius: 16,
            overflow: "hidden",
            ...h("cover"),
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.cover.url}
            alt={data.cover.alt || ""}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            loading="lazy"
          />
        </figure>
      )}

      {/* Header block: eyebrow → H1 → lead. Центрований, обмежений по ширині. */}
      <header style={{ marginTop: showHero && data.cover.url ? 40 : 0, marginBottom: 32, textAlign: "center", maxWidth: 720, marginLeft: "auto", marginRight: "auto", padding: 4, ...h("header") }}>
        {data.category && (
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#B45309", marginBottom: 16 }}>
            {data.category}
          </div>
        )}
        {data.title && (
          <h1 style={{ fontSize: 44, fontWeight: 800, lineHeight: 1.15, margin: 0, color: "#1C1917" }}>
            {data.title}
          </h1>
        )}
        {data.lead && (
          <p style={{ fontSize: 19, lineHeight: 1.55, color: "#57534E", fontStyle: "italic", marginTop: 20, marginBottom: 0 }}>
            {data.lead}
          </p>
        )}
      </header>

      <hr style={{ width: 80, height: 2, border: 0, background: "#D4A843", margin: "32px auto" }} />

      {/* Sections — обгорнуті в один region, підсвічується весь блок коли
          менеджер у формі править будь-який розділ. */}
      {data.sections.length > 0 && (
        <div style={{ padding: 4, ...h("sections") }}>
          {data.sections.map((section, idx) => (
            <section key={idx} style={{ maxWidth: 720, margin: "0 auto", marginBottom: 56 }}>
              {section.heading && (
                <h2 style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.25, margin: "0 0 20px", color: "#1C1917" }}>
                  {section.heading}
                </h2>
              )}
              {paragraphs(section.body).map((p, pi) => (
                <p key={pi} style={{ fontSize: 18, lineHeight: 1.7, color: "#292524", margin: pi === 0 ? "0 0 18px" : "0 0 18px" }}>
                  {p}
                </p>
              ))}
              {section.image?.url && (
                <figure
                  style={{
                    margin: "32px auto 0",
                    width: "100%",
                    maxWidth: 720,
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      aspectRatio: "4 / 3",
                      background: "#F5F1E8",
                      borderRadius: 12,
                      overflow: "hidden",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={section.image.url}
                      alt={section.image.alt || ""}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      loading="lazy"
                    />
                  </div>
                  {section.image.caption && (
                    <figcaption style={{ fontSize: 13, color: "#78716C", fontStyle: "italic", textAlign: "center", marginTop: 10 }}>
                      {section.image.caption}
                    </figcaption>
                  )}
                </figure>
              )}
            </section>
          ))}
        </div>
      )}

      {/* Pullquote */}
      {data.pullquote && (
        <blockquote
          style={{
            maxWidth: 760,
            margin: "0 auto 56px",
            padding: "24px 32px",
            borderLeft: "4px solid #D4A843",
            background: "#FAF6F0",
            borderRadius: "0 12px 12px 0",
            fontSize: 22,
            lineHeight: 1.5,
            fontStyle: "italic",
            color: "#1C3A2E",
            ...h("pullquote"),
          }}
        >
          {data.pullquote}
        </blockquote>
      )}

      {/* Conclusion */}
      {data.conclusion && (
        <section style={{ maxWidth: 720, margin: "0 auto", marginBottom: 40, padding: 4, ...h("conclusion") }}>
          <h2 style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.25, margin: "0 0 20px", color: "#1C1917" }}>
            Висновки
          </h2>
          {paragraphs(data.conclusion).map((p, pi) => (
            <p key={pi} style={{ fontSize: 18, lineHeight: 1.7, color: "#292524", margin: "0 0 18px" }}>
              {p}
            </p>
          ))}
        </section>
      )}

      <hr style={{ width: 80, height: 2, border: 0, background: "#D4A843", margin: "32px auto" }} />

      {/* Author / footer line */}
      {data.authorLine && (
        <p style={{ textAlign: "center", fontSize: 13, color: "#78716C", margin: 0, paddingBottom: 8, ...h("author") }}>
          {data.authorLine}
        </p>
      )}
    </article>
  );
}
