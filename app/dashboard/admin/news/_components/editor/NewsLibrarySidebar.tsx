"use client";

import React, { useEffect, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { NewsMeta, UIMP_COLORS } from "./types";

const ff = "-apple-system, BlinkMacSystemFont, sans-serif";

// Item shape з API /api/admin/news/library
export interface LibraryNewsItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  imageUrl: string | null;
  category: string;
  createdAt: string;
  suspendedAt: string | null;
  resumeAt: string | null;
  author: { name: string | null } | null;
  /** Контент новини у форматі JSON-блоків — для newsCard з displayMode="expanded". */
  content?: string | null;
  /** Кастомний layout превʼю-картки (білдер /news/[id]/preview). */
  previewContent?: string | null;
  pageBgColor?: string | null;
}

const cardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: "14px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "#E8D5B7",
  overflow: "hidden",
  boxShadow: "0 2px 12px rgba(28,58,46,0.06)",
};

const cardHeaderStyle: React.CSSProperties = {
  padding: "7px 12px",
  background: "#1C3A2E",
  fontSize: "9px",
  fontWeight: 800,
  color: "#D4A843",
  letterSpacing: "0.15em",
  textTransform: "uppercase",
  fontFamily: ff,
};

const cardBodyStyle: React.CSSProperties = {
  padding: "10px 12px",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

// Draggable картка-новина. id = `news-card:<mode>:<id>` → handleDragEnd розпізнає
// префікс, читає mode (preview|expanded) і створює newsCard блок з відповідним
// displayMode. preview = клікабельна картка-превʼю → /news/{slug}; expanded =
// інлайн повний контент новини.
function NewsLibraryCard({
  item, isPlaced, mode,
}: {
  item: LibraryNewsItem;
  isPlaced: boolean;
  mode: "preview" | "expanded";
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `news-card:${mode}:${item.id}`,
    data: { fromPalette: true, kind: "news-card", newsId: item.id, mode },
  });
  const [hov, setHov] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      {isDragging ? (
        <div style={{
          height: 84,
          borderRadius: 10,
          borderWidth: 1.5,
          borderStyle: "dashed",
          borderColor: "rgba(212,168,67,0.4)",
          background: "rgba(212,168,67,0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(212,168,67,0.5)" }} />
        </div>
      ) : (
        <div
          onMouseEnter={() => setHov(true)}
          onMouseLeave={() => setHov(false)}
          style={{
            display: "flex",
            gap: 10,
            padding: 8,
            borderRadius: 10,
            border: `1px solid ${hov ? "rgba(212,168,67,0.4)" : "#E8D5B7"}`,
            background: hov ? "rgba(212,168,67,0.04)" : "#fff",
            cursor: "grab",
            userSelect: "none",
            transition: "all 0.15s",
            opacity: isPlaced ? 0.55 : 1,
          }}
          title={isPlaced ? "Вже на канвасі (можна додати ще раз)" : "Перетягніть на канвас"}
        >
          {/* Thumbnail 16:9 */}
          <div style={{ width: 60, height: 34, borderRadius: 6, overflow: "hidden", background: "#F3F0E8", flexShrink: 0 }}>
            {item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            ) : (
              <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#1C3A2E,#2a4f3f)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14 }}>📰</div>
            )}
          </div>
          {/* Title + drag-mode label (Превʼю / Новина) — щоб одразу зрозуміло
              що саме перетягуємо. Категорія новини (NEWS) тут не показується, бо
              менеджеру вже зрозуміло з заголовку секції в сайдбарі. */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 9,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "#9B7C45",
              marginBottom: 3,
            }}>{mode === "preview" ? "Превʼю" : "Новина"}</div>
            <div style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#1C3A2E",
              lineHeight: 1.25,
              fontFamily: ff,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}>{item.title}</div>
            {isPlaced && (
              <div style={{
                marginTop: 4,
                fontSize: 9,
                fontWeight: 700,
                color: "#10B981",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}>✓ На сторінці</div>
            )}
          </div>
        </div>
      )}
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        style={{
          position: "absolute", inset: 0,
          cursor: "grab", borderRadius: 10, background: "transparent",
        }}
      />
    </div>
  );
}

interface Props {
  meta: NewsMeta;
  onChange: (meta: NewsMeta) => void;
  /** Список ID-шників новин, які ВЖЕ розміщені на канвасі — щоб показати галочку. */
  placedNewsIds: Set<string>;
}

export default function NewsLibrarySidebar({ meta, onChange, placedNewsIds }: Props) {
  const [items, setItems] = useState<LibraryNewsItem[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/news/library")
      .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(d => setItems(Array.isArray(d) ? d : []))
      .catch(e => setError("Помилка: " + e.message));
  }, []);

  // Спільний стан списку для обох секцій (Превʼю / Новини). Винесено в окремий
  // компонент — рендериться двічі з різним `mode`. Перетягуючи з секції «Превʼю»,
  // менеджер розміщує клікабельну превʼю-картку (на /news клік → /news/{slug});
  // з секції «Новини» — повний інлайн-контент статті без посилання.
  const renderList = (mode: "preview" | "expanded") => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4, maxHeight: 320, overflowY: "auto" }}>
      {error && (
        <div style={{ fontSize: 11, color: "#DC2626", padding: 6 }}>{error}</div>
      )}
      {!items && !error && (
        <div style={{ fontSize: 11, color: "#9CA3AF", padding: 6 }}>Завантаження...</div>
      )}
      {items && items.length === 0 && !error && (
        <div style={{ fontSize: 11, color: "#9CA3AF", padding: 6, textAlign: "center" }}>
          Немає опублікованих новин
        </div>
      )}
      {(items ?? []).map(item => (
        <NewsLibraryCard
          key={item.id}
          item={item}
          isPlaced={placedNewsIds.has(item.id)}
          mode={mode}
        />
      ))}
    </div>
  );

  return (
    <div style={{ width: "240px", minWidth: "240px", display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={cardStyle}>
        <div style={cardHeaderStyle}>{"Превʼю (з новиною всередині)"}</div>
        <div style={{ ...cardBodyStyle, gap: 8 }}>
          <div style={{ fontSize: 11, color: "#6B7280", lineHeight: 1.5 }}>
            Перетягніть превʼю — на сторінці <strong>/news</strong>{" "}
            зʼявиться картка-превʼю. Клік по ній → перехід на саму новину.
          </div>
          {renderList("preview")}
        </div>
      </div>

      <div style={cardStyle}>
        <div style={cardHeaderStyle}>{"Новини (без Превʼю)"}</div>
        <div style={{ ...cardBodyStyle, gap: 8 }}>
          <div style={{ fontSize: 11, color: "#6B7280", lineHeight: 1.5 }}>
            Перетягніть новину — на сторінці <strong>/news</strong>{" "}
            рендериться повний контент статті інлайн (без посилання).
          </div>
          {renderList("expanded")}
        </div>
      </div>

      <div style={cardStyle}>
        <div style={cardHeaderStyle}>{"Фон сторінки"}</div>
        <div style={cardBodyStyle}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(9, 1fr)", gap: "3px" }}>
            <button
              type="button"
              title="Білий (за замовчуванням)"
              onClick={() => onChange({ ...meta, pageBgColor: "" })}
              style={{
                width: "100%", aspectRatio: "1 / 1", borderRadius: "5px",
                border: `1.5px solid ${!meta.pageBgColor ? "#D4A843" : "#E8D5B7"}`,
                background: "#FFFFFF",
                cursor: "pointer", padding: 0,
                boxShadow: !meta.pageBgColor ? "0 0 0 2px rgba(212,168,67,0.3)" : "none",
              }}
            />
            {UIMP_COLORS.filter(c => c.value && c.value !== "#FFFFFF").map(c => {
              const active = (meta.pageBgColor || "").toUpperCase() === c.value.toUpperCase();
              return (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  onClick={() => onChange({ ...meta, pageBgColor: c.value })}
                  style={{
                    width: "100%", aspectRatio: "1 / 1", borderRadius: "5px",
                    border: `1.5px solid ${active ? "#D4A843" : "#E8D5B7"}`,
                    background: c.value, cursor: "pointer", padding: 0,
                    boxShadow: active ? "0 0 0 2px rgba(212,168,67,0.3)" : "none",
                  }}
                />
              );
            })}
            <label
              title="Свій колір"
              style={{
                width: "100%", aspectRatio: "1 / 1", borderRadius: "5px",
                border: "1.5px solid #E8D5B7",
                background: "conic-gradient(from 180deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)",
                cursor: "pointer", padding: 0,
                position: "relative", overflow: "hidden",
                display: "block",
              }}
            >
              <input
                type="color"
                value={meta.pageBgColor || "#FFFFFF"}
                onChange={(e) => onChange({ ...meta, pageBgColor: e.target.value })}
                style={{
                  position: "absolute", inset: 0,
                  width: "100%", height: "100%",
                  opacity: 0, cursor: "pointer", border: "none", padding: 0,
                }}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
