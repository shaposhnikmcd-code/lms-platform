"use client";

// Редактор блока-шаблону на канвасі сторінки /news.
//
// Поведінка:
//  - Рендериться лейаут шаблону (TemplateBlocksPreview — placeholder-блоки).
//  - Якщо вже наповнено templateData — рендерить реальну картку через TemplatePreviewCard
//    (фінальний WYSIWYG як на /news).
//  - Клік на блок (через BlockItemHeader → onSelectBlock) виділяє його; settings-card
//    у sidebar показує велику кнопку «Редагувати шаблон» що відкриває form-modal
//    з ArticleForm / EventForm — користувач заповнює всі поля одразу.
//  - Internal клики на placeholder-блоки НЕ відкривають індивідуальні редактори:
//    весь блок — це one-piece widget.

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Block } from "../types";
import { parseBlocks } from "@/lib/news/render";
import TemplateBlocksPreview from "@/lib/news/templates/TemplateBlocksPreview";
import TemplatePreviewCard from "@/lib/news/templates/TemplatePreviewCard";
import PreviewCardScale from "@/lib/news/PreviewCardScale";
import { ARTICLE_DEFAULTS, EVENT_DEFAULTS, parseTemplateData, type ArticleData, type EventData, type TemplateKind } from "@/lib/news/templates/types";
import ArticleForm from "../../template-editor/ArticleForm";
import EventForm from "../../template-editor/EventForm";

const ff = "-apple-system, BlinkMacSystemFont, sans-serif";

interface Props {
  block: Block;
  onChange: (data: Record<string, string>) => void;
  selected?: boolean;
}

export default function TemplateInstanceEditor({ block, onChange, selected = false }: Props) {
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

  // Дані форми (ArticleData / EventData). Якщо ще не наповнено — defaults.
  const data: ArticleData | EventData = useMemo(() => {
    if (templateDataRaw) return parseTemplateData(templateKind, templateDataRaw);
    return templateKind === "ARTICLE" ? ARTICLE_DEFAULTS : EVENT_DEFAULTS;
  }, [templateKind, templateDataRaw]);

  const isFilled = !!templateDataRaw;

  // Form-modal стан + локальний state для редагування.
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ArticleData | EventData>(data);
  useEffect(() => { setDraft(data); }, [data, editing]);

  // Esc закриває модалку.
  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setEditing(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing]);

  // Settings-portal (slot у sidebar) — тільки коли блок selected.
  const settingsSlot = typeof document !== "undefined" && selected
    ? document.getElementById("news-block-settings-slot")
    : null;

  const settingsNode = (
    <div style={{ padding: "12px 14px", background: "#FFFFFF", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 9, fontWeight: 800, color: "#9B7C45", letterSpacing: "0.14em", textTransform: "uppercase", fontFamily: ff }}>
        Шаблон
      </div>
      <div style={{ fontSize: 12, color: "#1C3A2E", lineHeight: 1.5, fontFamily: ff }}>
        {isFilled
          ? "Шаблон наповнено. Натисни щоб відкрити редактор і змінити поля."
          : "Шаблон порожній. Відкрий редактор щоб заповнити поля (заголовок, фото, опис тощо)."}
      </div>
      <button
        type="button"
        onClick={() => setEditing(true)}
        style={{
          padding: "10px 14px",
          fontSize: 13,
          fontWeight: 700,
          background: "#1C3A2E",
          color: "#D4A843",
          border: "none",
          borderRadius: 10,
          cursor: "pointer",
          fontFamily: ff,
          letterSpacing: "0.02em",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        <span aria-hidden>✎</span>
        <span>Редагувати шаблон</span>
      </button>
    </div>
  );

  const modal = editing && typeof document !== "undefined" ? createPortal(
    <div
      onClick={() => setEditing(false)}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(28,25,23,0.78)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "min(720px, 100%)",
          maxHeight: "calc(100vh - 48px)",
          overflowY: "auto",
          background: "#FAF6F0",
          borderRadius: 14,
          boxShadow: "0 24px 64px rgba(0,0,0,0.45)",
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#9B7C45", letterSpacing: "0.14em", textTransform: "uppercase", fontFamily: ff }}>
              Редактор шаблону
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#1C3A2E", fontFamily: ff, marginTop: 2 }}>
              {templateKind === "ARTICLE" ? "Стаття / Огляд" : "Подія / Фахівець"}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEditing(false)}
            title="Закрити (Esc)"
            style={{
              width: 36, height: 36, borderRadius: 10,
              border: "1px solid #E8D5B7",
              background: "#FFFFFF",
              color: "#1C3A2E",
              cursor: "pointer",
              fontSize: 16,
              fontFamily: ff,
            }}
          >✕</button>
        </div>

        {templateKind === "ARTICLE" ? (
          <ArticleForm
            data={draft as ArticleData}
            onChange={(next) => setDraft(next)}
          />
        ) : (
          <EventForm
            data={draft as EventData}
            onChange={(next) => setDraft(next)}
          />
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
          <button
            type="button"
            onClick={() => setEditing(false)}
            style={{
              padding: "10px 18px", fontSize: 13, fontWeight: 700,
              background: "#FFFFFF", color: "#1C3A2E",
              border: "1px solid #E8D5B7", borderRadius: 10, cursor: "pointer", fontFamily: ff,
            }}
          >Скасувати</button>
          <button
            type="button"
            onClick={() => {
              onChange({ ...block.data, templateData: JSON.stringify(draft) });
              setEditing(false);
            }}
            style={{
              padding: "10px 22px", fontSize: 13, fontWeight: 700,
              background: "#1C3A2E", color: "#D4A843",
              border: "none", borderRadius: 10, cursor: "pointer", fontFamily: ff,
              letterSpacing: "0.02em",
            }}
          >Зберегти</button>
        </div>
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      {/* Якщо вже наповнено — рендеримо реальну картку (TemplatePreviewCard).
          Інакше — placeholder-каркас. PreviewCardScale масштабує природні
          tplW×tplH до фактичної ширини блока на канвасі. */}
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

      {/* Невидимий overlay щоб всі клики по картці виділяли блок-шаблон як єдине
          ціле і НЕ падали у внутрішні placeholder-блоки. Селект блока → BlockItem
          відкриває settings-slot з кнопкою «Редагувати шаблон». */}
      <div
        aria-hidden
        style={{
          position: "absolute", inset: 0,
          cursor: "pointer",
          background: "transparent",
        }}
        title="Клікніть щоб обрати шаблон, потім натисніть «Редагувати шаблон»"
      />

      {settingsSlot && createPortal(settingsNode, settingsSlot)}
      {modal}
    </div>
  );
}
