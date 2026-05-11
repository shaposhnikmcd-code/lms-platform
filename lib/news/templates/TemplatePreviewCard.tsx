// Preview-картка для template-новин на /news listing і в адмінці.
//
// АВТОГЕНЕРУЄТЬСЯ з templateData — ніяких окремих JSON-блоків.
//
// ARTICLE — портретна картка 360×400 (cover + eyebrow + title + lead + CTA-line).
// EVENT   — горизонтальна 2-колонкова картка з фото фахівця (left) + інфо
//           (right). Reuse EventTemplate з compact-режимом — картка ідентична
//           тому, що менеджер бачить у редакторі.
//
// Розмір canvas: за замовчуванням ARTICLE = 360×400, EVENT = 600×400 — щоб
// 2 EVENT-картки лізли в ряд /news (canvas 920px при 50% width = 460px,
// PreviewCardScale auto-fit масштабує).

import React from "react";
import type { ArticleData, EventData, TemplateKind } from "./types";
import EventTemplate, { type EventRegion } from "./EventTemplate";

export const TEMPLATE_PREVIEW_DIMS: Record<TemplateKind, { width: number; height: number }> = {
  ARTICLE: { width: 360, height: 400 },
  EVENT: { width: 600, height: 400 },
};

interface Props {
  kind: TemplateKind;
  data: ArticleData | EventData;
  /** Якщо передано — обгортає у <a href={href}>, всю картку клікабельну. */
  href?: string;
  /** За замовчуванням беруться з TEMPLATE_PREVIEW_DIMS[kind]. */
  width?: number;
  height?: number;
  /** Передається в EventTemplate щоб вимкнути внутрішні `<a>` (CTA-кнопка)
   *  коли preview-картка вже всередині зовнішнього `<Link>` (admin-thumbnail
   *  або newsCard preview-блок на /news). Інакше HTML-нестинг ламає hydration. */
  disableLinks?: boolean;
  /** Опційно: підсвічена зона на превʼю — для field↔region live-zoning у редакторі. */
  highlight?: EventRegion | null;
}

export default function TemplatePreviewCard({ kind, data, href, width, height, disableLinks, highlight }: Props) {
  const dims = TEMPLATE_PREVIEW_DIMS[kind];
  const w = width ?? dims.width;
  const h = height ?? dims.height;
  // Якщо є зовнішній href — автоматично глушимо внутрішні links (інакше <a> у <a>).
  const noInnerLinks = disableLinks ?? !!href;

  if (kind === "EVENT") {
    const inner = (
      <div style={{ width: w, height: h, display: "flex" }}>
        <EventTemplate data={data as EventData} fixedHeight={h} disableLinks={noInnerLinks} highlight={highlight} />
      </div>
    );
    if (href) {
      return (
        <a href={href} style={{ display: "block", textDecoration: "none", color: "inherit" }}>
          {inner}
        </a>
      );
    }
    return inner;
  }

  // ARTICLE — портретна картка
  return <ArticlePreviewCard data={data as ArticleData} href={href} width={w} height={h} />;
}

// ─── ARTICLE preview-card ────────────────────────────────────────────────────

function ArticlePreviewCard({ data, href, width, height }: { data: ArticleData; href?: string; width: number; height: number }) {
  const cover = data.cover;
  const COVER_H = Math.round(height * 0.5);

  const inner = (
    <div
      style={{
        width,
        height,
        background: "#FFFFFF",
        borderRadius: 14,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
        color: "#1C1917",
        textDecoration: "none",
        boxShadow: "0 2px 12px -4px rgba(28,58,46,0.10)",
      }}
    >
      <div
        style={{
          width: "100%",
          height: COVER_H,
          background: cover.url ? "#F5F1E8" : "#F5F1E8",
          flexShrink: 0,
          position: "relative",
        }}
      >
        {cover.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover.url}
            alt={cover.alt || ""}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            loading="lazy"
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#9B7C45",
              fontSize: 28,
            }}
            aria-hidden
          >
            📰
          </div>
        )}
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          padding: "14px 16px 16px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {data.category && (
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#B45309",
              marginBottom: 8,
              flexShrink: 0,
            }}
          >
            {data.category}
          </div>
        )}

        <h3
          style={{
            fontSize: 18,
            fontWeight: 700,
            lineHeight: 1.25,
            margin: 0,
            color: "#1C1917",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {data.title}
        </h3>

        <p
          style={{
            fontSize: 13,
            lineHeight: 1.45,
            color: "#57534E",
            margin: "8px 0 0",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            flex: 1,
            minHeight: 0,
          }}
        >
          {data.lead}
        </p>

        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#B45309",
            marginTop: 10,
            flexShrink: 0,
          }}
        >
          Читати далі →
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <a href={href} style={{ display: "block", textDecoration: "none", color: "inherit" }}>
        {inner}
      </a>
    );
  }
  return inner;
}
