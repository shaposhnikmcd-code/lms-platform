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
// Word-style палітра кольорів тексту: grayscale + 8 hue-родин по 3 відтінки
// (темний/середній/світлий). 30 кольорів = ідеальна сітка 6×5. Підходить для
// тексту в новинах: контрастні, читабельні, без "брендових" акцентів UIMP.
export const WORD_TEXT_COLORS = [
  // Row 1: grayscale
  "#000000", "#374151", "#6B7280", "#9CA3AF", "#D1D5DB", "#FFFFFF",
  // Row 2: red / orange / yellow
  "#7F1D1D", "#DC2626", "#F87171", "#9A3412", "#EA580C", "#FB923C",
  // Row 3: yellow / olive / green
  "#A16207", "#EAB308", "#FACC15", "#365314", "#65A30D", "#A3E635",
  // Row 4: green / teal / blue
  "#14532D", "#16A34A", "#4ADE80", "#155E75", "#0891B2", "#22D3EE",
  // Row 5: blue / indigo / purple
  "#1E3A8A", "#2563EB", "#60A5FA", "#581C87", "#9333EA", "#C084FC",
];

// Highlight-палітра (Word-style маркер). Світлі насичені кольори що добре
// читаються поверх текстового foreground.
export const WORD_HIGHLIGHT_COLORS = [
  "#FEF08A", // yellow
  "#FDE68A", // dark yellow
  "#A7F3D0", // light green
  "#86EFAC", // green
  "#67E8F9", // teal
  "#5EEAD4", // turquoise
  "#BFDBFE", // light blue
  "#93C5FD", // blue
  "#C4B5FD", // violet
  "#FBCFE8", // pink
  "#FECACA", // light red
  "#FCA5A5", // red
  "#E5E7EB", // gray
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
