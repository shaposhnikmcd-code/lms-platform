"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Block } from "../types";
import { BlockInner, type NewsListItemForBlock } from "@/lib/news/render";
import { ff, Section, SectionLabel } from "./_settingsPrimitives";
import type { LibraryNewsItem } from "../NewsLibrarySidebar";

// Редактор-обгортка для блока `newsCard` — конкретна новина на канвасі.
// Сама новина ID в data.newsId; render використовує live дані з library API
// (фетчимо тут і кладемо у newsItems prop, щоб BlockInner показав справжню картку).
//
// Налаштування у портал-сайдбарі: інфо про новину, schedule (visibleFrom/Until),
// замінити новину (drop іншу з правого бару — або через select fallback).

interface Props {
  block: Block;
  onChange: (data: Record<string, string>) => void;
  selected?: boolean;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 10px",
  borderRadius: "6px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "#E8D5B7",
  background: "#FAF6F0",
  fontSize: "12px",
  color: "#1C3A2E",
  fontFamily: ff,
  outline: "none",
  boxSizing: "border-box",
};

// Простий cache на рівні модуля — щоб не фетчити library двічі для кожного блока.
let libCache: { items: LibraryNewsItem[]; ts: number } | null = null;
const LIB_TTL = 30_000;

async function fetchLibrary(): Promise<LibraryNewsItem[]> {
  if (libCache && Date.now() - libCache.ts < LIB_TTL) return libCache.items;
  const r = await fetch("/api/admin/news/library");
  if (!r.ok) return [];
  const d = await r.json();
  libCache = { items: Array.isArray(d) ? d : [], ts: Date.now() };
  return libCache.items;
}

function toNewsListItem(it: LibraryNewsItem): NewsListItemForBlock {
  return {
    id: it.id,
    title: it.title,
    slug: it.slug,
    excerpt: it.excerpt,
    imageUrl: it.imageUrl,
    category: it.category,
    createdAt: it.createdAt,
    authorName: it.author?.name ?? null,
    content: it.content ?? null,
    previewContent: it.previewContent ?? null,
    pageBgColor: it.pageBgColor ?? null,
  };
}

export default function NewsCardEditor({ block, onChange, selected = false }: Props) {
  const data = block.data;
  const newsId = data.newsId || "";
  const [items, setItems] = useState<LibraryNewsItem[] | null>(null);

  useEffect(() => {
    let active = true;
    fetchLibrary().then(d => { if (active) setItems(d); });
    return () => { active = false; };
  }, []);

  const current = items?.find(i => i.id === newsId) || null;
  const newsItemsForRender: NewsListItemForBlock[] | undefined =
    current ? [toNewsListItem(current)] : undefined;

  const settingsSlot = typeof document !== "undefined" && selected
    ? document.getElementById("news-block-settings-slot")
    : null;

  const sidebarPanel = (
    <div style={{ background: "#FFFFFF", fontFamily: ff }}>
      <Section>
        <SectionLabel>Привʼязана новина</SectionLabel>
        {current ? (
          <div style={{
            display: "flex",
            gap: 10,
            padding: 8,
            borderRadius: 8,
            border: "1px solid #E8D5B7",
            background: "#FAF6F0",
          }}>
            <div style={{ width: 56, height: 32, borderRadius: 4, overflow: "hidden", background: "#fff", flexShrink: 0 }}>
              {current.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={current.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              ) : (
                <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#1C3A2E,#2a4f3f)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12 }}>📰</div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: "#9B7C45", marginBottom: 2 }}>{current.category}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#1C3A2E", lineHeight: 1.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{current.title}</div>
            </div>
          </div>
        ) : items ? (
          <div style={{ fontSize: 11, color: "#DC2626", padding: 6 }}>
            Новина не знайдена або не опублікована. Перетягніть іншу з правого бару.
          </div>
        ) : (
          <div style={{ fontSize: 11, color: "#9CA3AF", padding: 6 }}>Завантаження...</div>
        )}
      </Section>

      <Section padTop={0}>
        <SectionLabel>Замінити на</SectionLabel>
        <select
          style={{ ...inputStyle, cursor: "pointer" }}
          value={newsId}
          onChange={(e) => onChange({ ...data, newsId: e.target.value })}
        >
          <option value="">— Виберіть новину —</option>
          {(items ?? []).map(it => (
            <option key={it.id} value={it.id}>{it.title}</option>
          ))}
        </select>
      </Section>

      <Section padTop={0}>
        <SectionLabel>Як показати</SectionLabel>
        <div style={{ display: "flex", gap: 5 }}>
          {([
            { value: "preview", label: "Прев'ю" },
            { value: "expanded", label: "Розгорнута" },
          ] as const).map((opt) => {
            const active = (data.displayMode || "preview") === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ ...data, displayMode: opt.value })}
                style={{
                  flex: 1,
                  height: 28,
                  borderRadius: 6,
                  border: `1px solid ${active ? "#D4A843" : "#E8D5B7"}`,
                  background: active ? "#1C3A2E" : "#FFFFFF",
                  color: active ? "#D4A843" : "#1C3A2E",
                  cursor: "pointer",
                  padding: "0 8px",
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: ff,
                }}
              >{opt.label}</button>
            );
          })}
        </div>
        <div style={{ fontSize: 10, color: "#9CA3AF", lineHeight: 1.5, marginTop: 6 }}>
          Прев'ю — компактна картка з лінком. Розгорнута — повний контент новини інлайн.
        </div>
      </Section>

      <Section padTop={0}>
        <SectionLabel>Зʼявиться (опційно)</SectionLabel>
        <input
          type="datetime-local"
          style={{ ...inputStyle, cursor: "text" }}
          value={data.visibleFrom || ""}
          onChange={(e) => onChange({ ...data, visibleFrom: e.target.value })}
        />
      </Section>

      <Section padTop={0}>
        <SectionLabel>Зникне (опційно)</SectionLabel>
        <input
          type="datetime-local"
          style={{ ...inputStyle, cursor: "text" }}
          value={data.visibleUntil || ""}
          onChange={(e) => onChange({ ...data, visibleUntil: e.target.value })}
        />
      </Section>

      <Section padTop={0}>
        <div style={{ fontSize: "10px", color: "#9CA3AF", lineHeight: 1.5 }}>
          Якщо часи не задано — новина видима одразу після збереження сторінки.
        </div>
      </Section>
    </div>
  );

  return (
    <>
      {settingsSlot && createPortal(sidebarPanel, settingsSlot)}
      {/* У білдері картка новини НЕ має навігувати — користувач клікає щоб
          ВИБРАТИ блок (для resize/edit налаштувань), а не йти на public-сторінку.
          BlockInner рендерить <a href="/news/...">; інтерсептимо click + preventDefault. */}
      <div
        style={{ width: "100%", height: "100%" }}
        onClickCapture={(e) => {
          const t = e.target as HTMLElement;
          if (t.closest("a")) e.preventDefault();
        }}
      >
        <BlockInner block={block} newsItems={newsItemsForRender} locale="uk" />
      </div>
    </>
  );
}
