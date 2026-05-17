"use client";

// Редактор блока-шаблону на канвасі сторінки /news.
//
// Поведінка:
//  - Рендериться лейаут шаблону (TemplateBlocksPreview — placeholder-блоки) або
//    наповнена картка (TemplatePreviewCard) якщо templateData вже є.
//  - Це read-only widget на сторінці /news: можна resize/перетягувати, але контент
//    усередині (поля шаблону: заголовок, фото, опис тощо) у білдері сторінки НЕ
//    редагується. Наповнення відбувається в окремому місці (адмінка новин).
//  - onChange лишається у сигнатурі для сумісності з BlockItem, але не викликається.

import React, { useMemo } from "react";
import { Block } from "../types";
import { parseBlocks } from "@/lib/news/render";
import TemplateBlocksPreview from "@/lib/news/templates/TemplateBlocksPreview";
import TemplatePreviewCard from "@/lib/news/templates/TemplatePreviewCard";
import PreviewCardScale from "@/lib/news/PreviewCardScale";
import { ARTICLE_DEFAULTS, EVENT_DEFAULTS, parseTemplateData, type ArticleData, type EventData, type TemplateKind } from "@/lib/news/templates/types";

const ff = "-apple-system, BlinkMacSystemFont, sans-serif";

interface Props {
  block: Block;
  onChange: (data: Record<string, string>) => void;
  selected?: boolean;
}

export default function TemplateInstanceEditor({ block, onChange, selected }: Props) {
  void onChange; void selected; // read-only widget — sidebar-редактор прибрано
  const templateKind = (block.data.templateKind as TemplateKind) || "EVENT";
  const templateBlocksRaw = block.data.templateBlocks || "";
  const templateCanvasRaw = block.data.templateCanvas || "";
  const templateDataRaw = block.data.templateData || "";

  // Розмір canvas-у шаблону (для placeholder-preview render-у).
  let tplW = 600;
  let tplH = 400;
  if (templateCanvasRaw) {
    const m = templateCanvasRaw.match(/^(\d+)x(\d+)$/);
    if (m) { tplW = Number(m[1]) || tplW; tplH = Number(m[2]) || tplH; }
  }

  // Розпарсений шаблонний каркас (для placeholder-preview).
  const tplBlocks = useMemo(() => {
    const p = templateBlocksRaw ? parseBlocks(templateBlocksRaw) : null;
    return p && p.isJson ? p.blocks : [];
  }, [templateBlocksRaw]);

  const data: ArticleData | EventData = useMemo(() => {
    if (templateDataRaw) return parseTemplateData(templateKind, templateDataRaw);
    return templateKind === "ARTICLE" ? ARTICLE_DEFAULTS : EVENT_DEFAULTS;
  }, [templateKind, templateDataRaw]);

  const isFilled = !!templateDataRaw;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      <PreviewCardScale baseWidth={tplW} baseHeight={tplH} initialScale={1}>
        {isFilled ? (
          <TemplatePreviewCard
            kind={templateKind}
            data={data}
            width={tplW}
            height={tplH}
            disableLinks
          />
        ) : tplBlocks.length > 0 ? (
          <TemplateBlocksPreview
            blocks={tplBlocks}
            width={tplW}
            height={tplH}
            background="#FFFFFF"
          />
        ) : (
          <div style={{
            width: "100%", height: "100%",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#9B7C45", fontFamily: ff, fontSize: 13,
          }}>
            Шаблон порожній (без блоків)
          </div>
        )}
      </PreviewCardScale>

      {/* Невидимий overlay — клік по шаблону виділяє блок як єдине ціле
          (BlockItemHeader handle для resize/drag), внутрішні placeholder-блоки
          не клікабельні. */}
      <div
        aria-hidden
        style={{
          position: "absolute", inset: 0,
          cursor: "pointer",
          background: "transparent",
        }}
      />
    </div>
  );
}
