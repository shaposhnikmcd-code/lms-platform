"use client";

import React from "react";
import { UIMP_COLORS } from "../types";

// Спільні UI-примітиви для sectioned-панелей Налаштування блока
// (TextEditor, HeadingEditor — використовують ці; OverlayToolbar поки має
// власні локальні копії, бо кадрується з Текст-на-фото). Якщо колись зведемо
// всі три на ці примітиви — OverlayToolbar теж сюди мігрує.

export const ff = "-apple-system, BlinkMacSystemFont, sans-serif";

// Section label — спокійна типографіка, не "крикливі" амбер ALL-CAPS:
//   10px / 600 / 0.06em / muted gray. Вистачає щоб читатись як заголовок,
//   не перетягуючи увагу від самих контролів.
export const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    fontSize: "10px",
    fontWeight: 600,
    color: "#6B7280",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    fontFamily: ff,
    marginBottom: "8px",
  }}>{children}</div>
);

// Section — рівномірний вертикальний ритм 14px (top) / 12px (bottom).
// padTop приймається для випадків коли потрібно вручну стиснути перший
// айтем у групі, але дефолт зробить уніформний layout.
export const Section: React.FC<{ children: React.ReactNode; padTop?: number }> = ({
  children, padTop = 14,
}) => (
  <div style={{ padding: `${padTop}px 14px 12px`, background: "transparent" }}>{children}</div>
);

// Тонкий розділювач між групами секцій. Не між кожною — лише там, де це
// логічно (напр. "Типографіка" → "Кольори"). Margin в 4px з обох боків
// дає легке "дихання" замість контрастної межі.
export const GroupDivider: React.FC = () => (
  <div style={{
    height: 1,
    background: "#F0EDE6",
    margin: "4px 14px",
  }} />
);

// Заголовок групи секцій — дрібний, ще приглушеніший за SectionLabel.
// Структурує панель: "Типографіка" / "Кольори" / "Посилання" і т.д.
export const GroupHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    fontSize: "9px",
    fontWeight: 700,
    color: "#9CA3AF",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    fontFamily: ff,
    padding: "16px 14px 4px",
  }}>{children}</div>
);

// Заголовок-стрічка панелі (іконка + лейбл блока). Опційний правий слот для дій
// (видалити/додаткова кнопка).
export const ToolbarHeader: React.FC<{
  icon: React.ReactNode;
  label: string;
  hint?: string;
  rightSlot?: React.ReactNode;
}> = ({ icon, label, hint, rightSlot }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: "8px",
    padding: "7px 12px", background: "#FAF6F0",
  }}>
    <div style={{
      width: "22px", height: "22px", borderRadius: "6px",
      background: "#D4A843", color: "#1C3A2E",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontSize: "11px", fontWeight: 800, flexShrink: 0,
    }}>{icon}</div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: "11px", fontWeight: 700, color: "#1C3A2E", lineHeight: 1.1 }}>{label}</div>
      {hint && (
        <div style={{
          fontSize: "10px", color: "#9CA3AF", marginTop: "2px", lineHeight: 1,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{hint}</div>
      )}
    </div>
    {rightSlot}
  </div>
);

export const inputBase: React.CSSProperties = {
  height: "26px",
  borderRadius: "6px",
  border: "1px solid #E8D5B7",
  background: "#FFFFFF",
  color: "#1C3A2E",
  fontSize: "12px",
  fontFamily: ff,
  outline: "none",
  boxSizing: "border-box",
};

export function ToggleBtn({
  active, onClick, title, children, flex,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  flex?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={e => e.preventDefault()}
      onClick={onClick}
      style={{
        ...(flex ? { flex: 1 } : { width: "28px" }),
        height: "26px",
        borderRadius: "6px",
        border: `1px solid ${active ? "#D4A843" : "#E8D5B7"}`,
        background: active ? "#1C3A2E" : "#FFFFFF",
        color: active ? "#D4A843" : "#1C3A2E",
        cursor: "pointer", padding: 0,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontSize: "12px", fontFamily: ff, fontWeight: 600,
      }}
    >{children}</button>
  );
}

// ─── Палітри для тексту ────────────────────────────────────────────────────
//
// Структурована Word-/Material-style палітра: РЯД = shade level, СТОВПЕЦЬ =
// hue-родина. Read-однаково в обидва вимірі: вертикально шукаєш потрібний
// колір, горизонтально — потрібну насиченість. 6 cols × 5 rows = 30 swatches.
//
// Cols: Червоний | Оранжевий | Жовтий | Зелений | Синій | Фіолетовий
// Row 1 — Grayscale (6 шейдів від black до white)
// Row 2 — Strong (Tailwind 800): для дуже контрастних акцентів
// Row 3 — Vivid (Tailwind 500): для звичайних акцентів — найвживаніший рядок
// Row 4 — Soft (Tailwind 300): для м'яких підсвічень
// Row 5 — Pale (Tailwind 100): для майже-фонових тонів
//
// Кожен hex — точне значення з Tailwind v3 палітри, тестованої сотнями SaaS-ів.
export const WORD_TEXT_COLORS = [
  // Row 1 — Grayscale ramp
  "#000000", "#1F2937", "#6B7280", "#D1D5DB", "#F3F4F6", "#FFFFFF",
  // Row 2 — Strong / 800
  "#991B1B", "#9A3412", "#854D0E", "#166534", "#1E40AF", "#6B21A8",
  // Row 3 — Vivid / 500
  "#EF4444", "#F97316", "#EAB308", "#22C55E", "#3B82F6", "#A855F7",
  // Row 4 — Soft / 300
  "#FCA5A5", "#FDBA74", "#FDE047", "#86EFAC", "#93C5FD", "#D8B4FE",
  // Row 5 — Pale / 100
  "#FEE2E2", "#FFEDD5", "#FEF9C3", "#DCFCE7", "#DBEAFE", "#F3E8FF",
];

// Highlight-палітра (Word-style маркер). Та сама column-structure що й
// WORD_TEXT_COLORS row 4 (soft / 300) — найкраще читається поверх тексту як
// м'який маркер. 6 cols × 1 row = 6 swatches.
//
// Зменшено до 6 (з 13 раніше) — менше шуму, кожен слот має зрозумілу семантику.
// "Без виділення" автоматично доступний через includeNone=true у SwatchGrid.
export const WORD_HIGHLIGHT_COLORS = [
  "#FCA5A5", // red-300 — для критичного
  "#FDBA74", // orange-300 — для warning
  "#FDE047", // yellow-300 — найкласичніший маркер
  "#86EFAC", // green-300 — для positive
  "#93C5FD", // blue-300 — для info
  "#D8B4FE", // purple-300 — для альтернативних акцентів
];

// Універсальна сітка swatch-ів. Word-style: компактні квадратні комірки в grid.
// Перший слот — "Без кольору" (transparent), останній — custom-picker через
// нативний input[type=color].
export function SwatchGrid({
  current,
  onChange,
  palette,
  cols = 6,
  includeNone = true,
}: {
  current: string;
  onChange: (c: string) => void;
  palette: string[];
  cols?: number;
  includeNone?: boolean;
}) {
  const cellSize = 18;
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
      gap: "4px",
    }}>
      {includeNone && (
        <button
          type="button"
          title="Авто / без кольору"
          onClick={() => onChange("")}
          style={{
            width: `${cellSize}px`, height: `${cellSize}px`, borderRadius: "4px",
            border: `1.5px solid ${!current ? "#D4A843" : "#D1D5DB"}`,
            background: "repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%) 50% / 6px 6px",
            cursor: "pointer", padding: 0,
            boxShadow: !current ? "0 0 0 2px rgba(212,168,67,0.25)" : "none",
            position: "relative",
          }}
        >
          <span style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "10px", color: "#6B7280", lineHeight: 1, fontWeight: 700,
          }}>×</span>
        </button>
      )}
      {palette.map(c => {
        const active = (current || "").toUpperCase() === c.toUpperCase();
        return (
          <button
            key={c}
            type="button"
            title={c}
            onMouseDown={e => e.preventDefault()}
            onClick={() => onChange(c)}
            style={{
              width: `${cellSize}px`, height: `${cellSize}px`, borderRadius: "4px",
              border: `1.5px solid ${active ? "#D4A843" : "#D1D5DB"}`,
              background: c, cursor: "pointer", padding: 0,
              boxShadow: active ? "0 0 0 2px rgba(212,168,67,0.25)" : "none",
            }}
          />
        );
      })}
      <input
        type="color"
        value={/^#[0-9A-Fa-f]{6}$/.test(current) ? current : "#000000"}
        onChange={(e) => onChange(e.target.value)}
        title="Свій колір"
        style={{
          width: `${cellSize + 4}px`, height: `${cellSize}px`,
          border: "1.5px solid #D1D5DB",
          borderRadius: "4px", padding: 0,
          background: "none", cursor: "pointer",
        }}
      />
    </div>
  );
}

// Палітра з UIMP-фірмових кольорів + custom picker. Використовується для
// block-level фону (BlockItemHeader, OverlayToolbar) — там брендові кольори
// доречні. Для ТЕКСТУ використовуй SwatchGrid з WORD_TEXT_COLORS.
export function ColorSwatchRow({
  current,
  onChange,
  includeTransparent,
}: {
  current: string;
  onChange: (c: string) => void;
  includeTransparent?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
      {includeTransparent && (
        <button
          type="button"
          title="Без кольору"
          onClick={() => onChange("")}
          style={{
            width: "18px", height: "18px", borderRadius: "5px",
            border: `2px solid ${!current ? "#D4A843" : "#E8D5B7"}`,
            background: "repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%) 50% / 6px 6px",
            cursor: "pointer", padding: 0,
            boxShadow: !current ? "0 0 0 2px rgba(212,168,67,0.25)" : "none",
          }}
        />
      )}
      {UIMP_COLORS.filter(c => c.value).map(c => {
        const active = (current || "").toUpperCase() === c.value.toUpperCase();
        return (
          <button
            key={c.value}
            type="button"
            title={c.label}
            onClick={() => onChange(c.value)}
            style={{
              width: "18px", height: "18px", borderRadius: "5px",
              border: `2px solid ${active ? "#D4A843" : "#E8D5B7"}`,
              background: c.value, cursor: "pointer", padding: 0,
              boxShadow: active ? "0 0 0 2px rgba(212,168,67,0.25)" : "none",
            }}
          />
        );
      })}
      <input
        type="color"
        value={/^#[0-9A-Fa-f]{6}$/.test(current) ? current : "#000000"}
        onChange={(e) => onChange(e.target.value)}
        title="Свій колір"
        style={{
          width: "22px", height: "18px",
          border: "2px solid #E8D5B7",
          borderRadius: "5px", padding: 0,
          background: "none", cursor: "pointer",
        }}
      />
    </div>
  );
}

// Числовий інпут з −/+ кнопками. Якщо value=0 і допустимо — показується як "Авто".
export function Stepper({
  value, onChange, min, max, step = 1, suffix = "px",
  autoLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  /** Якщо передано — value=0 показується як цей лейбл (наприклад "Авто"). */
  autoLabel?: string;
}) {
  const showAuto = autoLabel && value === 0;
  return (
    <div style={{ display: "inline-flex", gap: "5px", alignItems: "center" }}>
      <button
        type="button"
        title="Менше"
        onClick={() => onChange(Math.max(min, value - step))}
        style={{ ...inputBase, width: "26px", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}
      >−</button>
      <input
        type="text"
        inputMode="numeric"
        value={showAuto ? autoLabel : String(value)}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9]/g, "");
          if (raw === "") return onChange(0);
          const n = Number(raw);
          if (Number.isFinite(n) && n >= min && n <= max) onChange(n);
        }}
        style={{
          ...inputBase, width: "60px", textAlign: "center", padding: "0 4px",
          color: showAuto ? "#9CA3AF" : "#1C3A2E",
        }}
      />
      <button
        type="button"
        title="Більше"
        onClick={() => onChange(value === 0 ? min : Math.min(max, value + step))}
        style={{ ...inputBase, width: "26px", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}
      >+</button>
      <span style={{ fontSize: "10px", color: "#9CA3AF" }}>{suffix}</span>
      {autoLabel && value !== 0 && (
        <button
          type="button"
          title="Скинути"
          onClick={() => onChange(0)}
          style={{
            background: "none", border: "none", padding: 0,
            color: "#9CA3AF", fontSize: "10px", cursor: "pointer",
            marginLeft: "auto", textDecoration: "underline",
          }}
        >Авто</button>
      )}
    </div>
  );
}

// Стандартний select для шрифту (preview шрифту в опціях).
export function FontSelect({
  value, onChange, options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        ...inputBase, padding: "0 6px",
        fontFamily: value || ff, cursor: "pointer", width: "100%",
      }}
    >
      {options.map(o => (
        <option key={o.label} value={o.value} style={{ fontFamily: o.value || ff }}>{o.label}</option>
      ))}
    </select>
  );
}
