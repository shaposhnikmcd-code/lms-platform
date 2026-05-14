// Editorial-шаблон для News (templateKind = ARTICLE).
//
// Дизайн: Medium / Substack-вибірковий long-form. Hero 16:9, центрований
// title H1, italic-лід, divider, секції H2 + body (паралельно опційне фото
// 4:3 з підписом), pullquote, висновки, author-line.
//
// Гнучкість:
// - data.hidden[region] === true → секція не рендериться.
// - data.order — порядок movable-регіонів (sections/pullquote/conclusion/author).
//   Cover і header закріплені зверху (cover-zero/header-one), щоб не ламати
//   ієрархію статті. Validation проходить через resolveArticleOrder.
//
// Сервер-компонент (без 'use client') — render у SSR-пайплайні /news/[slug].

import React from "react";
import type { ArticleData, ArticleRegionKey } from "./types";
import { resolveArticleOrder } from "./types";
import CoverImageBox from "./CoverImageBox";
import { sanitizeHtml } from "@/lib/sanitizeHtml";

/** Чи value виглядає як HTML (містить <тег>). Для backward-compat: plain text
 *  значення з міграції шаблонів все ще працює через paragraphs(). */
function looksLikeHtml(value: string): boolean {
  return /<\w+[^>]*>/.test(value || "");
}

/** Рендерить значення як rich-HTML (через sanitizeHtml + dangerouslySetInnerHTML)
 *  якщо це HTML; інакше — fallback на paragraphs (\n\n → <p>). */
function RichText({ value, style }: { value: string; style: React.CSSProperties }) {
  if (!value) return null;
  if (looksLikeHtml(value)) {
    return <div style={style} dangerouslySetInnerHTML={{ __html: sanitizeHtml(value) }} />;
  }
  return (
    <>
      {paragraphs(value).map((p, i) => (
        <p key={i} style={style}>{p}</p>
      ))}
    </>
  );
}

export type ArticleRegion = ArticleRegionKey;

/** Розрив параграфів за \n\n; trim, фільтр порожніх. */
function paragraphs(text: string): string[] {
  if (!text) return [];
  return text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
}

interface Props {
  data: ArticleData;
  /** Hero показуємо лише в SSR-сторінці /news/[slug]. У newsCard expanded —
   *  ховаємо щоб не дублювати з зовнішнім фоном картки. */
  showHero?: boolean;
  /** Підсвічена зона при фокусі поля у редакторі. null → без підсвітки. */
  highlight?: ArticleRegion | null;
  /** Якщо задано — клік по cover-фото викликає колбек з focal-координатами
   *  у відсотках (0..100). Використовується редактором для focal-point picker. */
  onCoverFocalClick?: (x: number, y: number) => void;
}

/** Маркер точки фокусу — невелике коло на cover-зображенні. Показується лише
 *  в редакторі (коли передано onCoverFocalClick). На SSR-рендері /news/[slug]
 *  не присутнє — це чисто editor-affordance. */
function FocalDot({ x, y }: { x: number; y: number }) {
  return (
    <span
      aria-hidden
      style={{
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
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
      }}
    />
  );
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

export default function ArticleTemplate({ data, showHero = true, highlight, onCoverFocalClick }: Props) {
  const hidden = data.hidden || {};
  const order = resolveArticleOrder(data.order);
  const h = (region: ArticleRegion) => regionStyle(highlight === region);
  const isHidden = (r: ArticleRegion) => hidden[r] === true;

  // Render-functions кожного регіону — повертають null якщо нема контенту.
  // Усі завжди беруть `h(region)` style — підсвітка стабільна навіть у reorder.
  const renderCover = () => {
    if (isHidden("cover")) return null;
    if (!showHero || !data.cover.url) return null;
    const onClick = onCoverFocalClick
      ? (e: React.MouseEvent<HTMLElement>) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * 100;
          const y = ((e.clientY - rect.top) / rect.height) * 100;
          onCoverFocalClick(Math.max(0, Math.min(100, x)), Math.max(0, Math.min(100, y)));
        }
      : undefined;
    return (
      <figure
        key="cover"
        onClick={onClick}
        style={{
          margin: 0,
          width: "100%",
          aspectRatio: "16 / 9",
          background: "#F5F1E8",
          borderRadius: 16,
          overflow: "hidden",
          cursor: onCoverFocalClick ? "crosshair" : undefined,
          position: "relative",
          ...h("cover"),
        }}
      >
        <CoverImageBox image={data.cover} role="page" />
        {onCoverFocalClick && (
          <FocalDot x={data.cover.focalX ?? 50} y={data.cover.focalY ?? 50} />
        )}
      </figure>
    );
  };

  const renderHeader = () => {
    if (isHidden("header")) return null;
    if (!data.category && !data.title && !data.lead) return null;
    return (
      <header
        key="header"
        style={{
          marginTop: 40,
          marginBottom: 32,
          textAlign: "center",
          maxWidth: 720,
          marginLeft: "auto",
          marginRight: "auto",
          padding: 4,
          ...h("header"),
        }}
      >
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
          <div style={{ fontSize: 19, lineHeight: 1.55, color: "#57534E", fontStyle: "italic", marginTop: 20 }}>
            <RichText value={data.lead} style={{ margin: 0, fontSize: 19, lineHeight: 1.55, color: "#57534E", fontStyle: "italic" }} />
          </div>
        )}
      </header>
    );
  };

  const renderSections = () => {
    if (isHidden("sections")) return null;
    if (!data.sections.length) return null;
    return (
      <div key="sections" style={{ padding: 4, ...h("sections") }}>
        {data.sections.map((section, idx) => (
          <section key={idx} style={{ maxWidth: 720, margin: "0 auto", marginBottom: 56 }}>
            {section.heading && (
              <h2 style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.25, margin: "0 0 20px", color: "#1C1917" }}>
                {section.heading}
              </h2>
            )}
            <RichText
              value={section.body}
              style={{ fontSize: 18, lineHeight: 1.7, color: "#292524", margin: "0 0 18px" }}
            />
            {section.image?.url && (
              <figure style={{ margin: "32px auto 0", width: "100%", maxWidth: 720 }}>
                <div style={{ width: "100%", aspectRatio: "4 / 3", background: "#F5F1E8", borderRadius: 12, overflow: "hidden", position: "relative" }}>
                  <CoverImageBox image={section.image} role="page" />
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
    );
  };

  const renderPullquote = () => {
    if (isHidden("pullquote")) return null;
    if (!data.pullquote) return null;
    return (
      <blockquote
        key="pullquote"
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
        <RichText value={data.pullquote} style={{ margin: 0, fontSize: 22, lineHeight: 1.5, fontStyle: "italic", color: "#1C3A2E" }} />
      </blockquote>
    );
  };

  const renderConclusion = () => {
    if (isHidden("conclusion")) return null;
    if (!data.conclusion) return null;
    return (
      <section key="conclusion" style={{ maxWidth: 720, margin: "0 auto", marginBottom: 40, padding: 4, ...h("conclusion") }}>
        <h2 style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.25, margin: "0 0 20px", color: "#1C1917" }}>
          Висновки
        </h2>
        <RichText
          value={data.conclusion}
          style={{ fontSize: 18, lineHeight: 1.7, color: "#292524", margin: "0 0 18px" }}
        />
      </section>
    );
  };

  const renderAuthor = () => {
    if (isHidden("author")) return null;
    if (!data.authorLine) return null;
    return (
      <p key="author" style={{ textAlign: "center", fontSize: 13, color: "#78716C", margin: 0, paddingBottom: 8, ...h("author") }}>
        {data.authorLine}
      </p>
    );
  };

  const renderers: Record<ArticleRegion, () => React.ReactNode> = {
    cover: renderCover,
    header: renderHeader,
    sections: renderSections,
    pullquote: renderPullquote,
    conclusion: renderConclusion,
    author: renderAuthor,
  };

  // Збираємо ноди, інтерпретуємо divider контекстуально:
  // - divider після header перед першим non-empty body region (sections/pullquote/conclusion)
  // - divider перед author, якщо author присутній і йому передує body region
  const renderedNodes: { key: string; node: React.ReactNode }[] = [];
  for (const region of order) {
    const node = renderers[region]();
    if (node) renderedNodes.push({ key: region, node });
  }

  // Інтерсперс divider'ів. Logic:
  // - між "header" і наступним body — gold-divider.
  // - перед "author" — gold-divider.
  const bodyRegions: ArticleRegion[] = ["sections", "pullquote", "conclusion"];
  const out: React.ReactNode[] = [];
  for (let i = 0; i < renderedNodes.length; i++) {
    const cur = renderedNodes[i];
    const prev = renderedNodes[i - 1];
    if (prev) {
      const prevIsHeader = prev.key === "header";
      const curIsBody = bodyRegions.includes(cur.key as ArticleRegion);
      const curIsAuthor = cur.key === "author";
      if ((prevIsHeader && curIsBody) || curIsAuthor) {
        out.push(<hr key={`div-${i}`} style={{ width: 80, height: 2, border: 0, background: "#D4A843", margin: "32px auto" }} />);
      }
    }
    out.push(cur.node);
  }

  return (
    <article className="article-template" style={{ width: "100%", maxWidth: 920, margin: "0 auto", fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#1C1917" }}>
      {out}
    </article>
  );
}
