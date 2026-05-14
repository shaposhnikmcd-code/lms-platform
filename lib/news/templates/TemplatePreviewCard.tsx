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
import { EVENT_CARD_WIDTH_DEFAULT } from "./types";
import EventTemplate, { type EventRegion } from "./EventTemplate";
import CoverImageBox from "./CoverImageBox";

/** Дефолтні preview-розміри для template-карток. Для EVENT width — це лише
 *  fallback, коли немає `data.cardWidth` (старі записи); реальну ширину
 *  передає `getEventPreviewDims(data)`. ARTICLE — фіксована 360×400 портретна. */
export const TEMPLATE_PREVIEW_DIMS: Record<TemplateKind, { width: number; height: number }> = {
  ARTICLE: { width: 360, height: 400 },
  EVENT: { width: EVENT_CARD_WIDTH_DEFAULT, height: 400 },
};

/** Повертає preview-розмір EVENT-картки з урахуванням `data.cardWidth`.
 *  Висота лишається 400 (фіксований feed-aspect); ширина — з даних. */
export function getEventPreviewDims(data: EventData): { width: number; height: number } {
  return {
    width: data.cardWidth || EVENT_CARD_WIDTH_DEFAULT,
    height: TEMPLATE_PREVIEW_DIMS.EVENT.height,
  };
}

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
  /** Якщо задано — клік по cover-фото викликає колбек з focal-координатами 0..100. */
  onCoverFocalClick?: (x: number, y: number) => void;
}

export default function TemplatePreviewCard({ kind, data, href, width, height, disableLinks, highlight, onCoverFocalClick }: Props) {
  // EVENT: native width читаємо з data.cardWidth (якщо props.width не override).
  // ARTICLE: фіксовані dims з TEMPLATE_PREVIEW_DIMS — портретна 360×400.
  const dims = kind === "EVENT" ? getEventPreviewDims(data as EventData) : TEMPLATE_PREVIEW_DIMS[kind];
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
  return <ArticlePreviewCard data={data as ArticleData} href={href} width={w} height={h} onCoverFocalClick={onCoverFocalClick} />;
}

// ─── ARTICLE preview-card ────────────────────────────────────────────────────

function ArticlePreviewCard({ data, href, width, height, onCoverFocalClick }: { data: ArticleData; href?: string; width: number; height: number; onCoverFocalClick?: (x: number, y: number) => void }) {
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
        onClick={
          onCoverFocalClick
            ? (e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 100;
                const y = ((e.clientY - rect.top) / rect.height) * 100;
                onCoverFocalClick(Math.max(0, Math.min(100, x)), Math.max(0, Math.min(100, y)));
              }
            : undefined
        }
        style={{
          width: "100%",
          height: COVER_H,
          background: cover.url ? "#F5F1E8" : "#F5F1E8",
          flexShrink: 0,
          position: "relative",
          overflow: "hidden",
          cursor: onCoverFocalClick ? "crosshair" : undefined,
        }}
      >
        {cover.url ? (
          <>
            <CoverImageBox image={cover} role="preview" />
            {onCoverFocalClick && (
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  left: `${cover.focalX ?? 50}%`,
                  top: `${cover.focalY ?? 50}%`,
                  width: 12,
                  height: 12,
                  marginLeft: -6,
                  marginTop: -6,
                  borderRadius: "50%",
                  background: "#D4A843",
                  border: "2px solid #FFFFFF",
                  boxShadow: "0 0 0 1px rgba(28,58,46,0.5), 0 2px 6px rgba(0,0,0,0.35)",
                  pointerEvents: "none",
                  transition: "left 0.12s, top 0.12s",
                }}
              />
            )}
          </>
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
