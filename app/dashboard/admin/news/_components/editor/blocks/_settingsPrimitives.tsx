"use client";

import React, { useEffect, useRef, useState } from "react";
import { UIMP_COLORS } from "../types";
import { FRAME_STYLES, FRAME_EFFECTS, type FrameStyle, type FrameEffect } from "@/lib/news/render";

// Спільні UI-примітиви для sectioned-панелей Налаштування блока
// (TextEditor, HeadingEditor — використовують ці; OverlayToolbar поки має
// власні локальні копії, бо кадрується з Текст-на-фото). Якщо колись зведемо
// всі три на ці примітиви — OverlayToolbar теж сюди мігрує.

export const ff = "-apple-system, BlinkMacSystemFont, sans-serif";

// Section label — amber/golden, така ж як локальна версія в OverlayToolbar
// (Текст на фото). 9px / 800 / 0.14em / amber #9B7C45. Раніше тут була
// "спокійна" gray-версія — користувач явно попросив дзеркалити стиль
// OverlayToolbar для Текст/Заголовок/Цитата.
export const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    fontSize: "9px",
    fontWeight: 800,
    color: "#9B7C45",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    fontFamily: ff,
    marginBottom: "4px",
  }}>{children}</div>
);

// Section — компактний вертикальний ритм як в OverlayToolbar: padding
// 6px (top default) / 10px (horizontal) / 6px (bottom). padTop=0 для секцій
// які стоять впритул до попередньої.
export const Section: React.FC<{ children: React.ReactNode; padTop?: number }> = ({
  children, padTop = 6,
}) => (
  <div style={{ padding: `${padTop}px 10px 6px`, background: "transparent" }}>{children}</div>
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

// Пресети border-radius для «Форма підкладки». Дзеркало з ImageEditor (overlays),
// щоб поведінка була єдиною між Текст-на-фото і Заголовком шаблону.
export const BLOCK_RADIUS_PRESETS: { label: string; value: number; tooltip: string }[] = [
  { label: "▢", value: 0,   tooltip: "Прямі кути" },
  { label: "▢", value: 6,   tooltip: "Радіус 6 px — легкі" },
  { label: "▢", value: 14,  tooltip: "Радіус 14 px — мʼякі" },
  { label: "▢", value: 24,  tooltip: "Радіус 24 px — дуже округлі" },
  { label: "⬭", value: 999, tooltip: "Pill — повністю округлі краї" },
];

// Composite-контрол для «Форма підкладки»: ряд пресетів (швидкий вибір)
// + плавний слайдер 0..50 px з step 0.5 (тонке налаштування). Pill (999) —
// окремий стан поза діапазоном слайдера; при перетягуванні pill знімається.
//
// Slider clamps value до [0, SLIDER_MAX]; якщо value=pill (999) — стоїть на
// максимумі. Active-preset матчиться рівністю value, тому slider-зміна
// знімає підсвітку з усіх пресетів окрім випадків коли користувач
// "потрапить" точно на preset-значення (0/6/14/24).
//
// UI: gradient-fill зліва до thumb (золотий→крем), thumb 16px з амбер
// фоном і темно-зеленим обідком, soft shadow, hover/active scaling.
// Cross-browser стилізація через class-scope <style> блок.
export function RadiusControl({
  current,
  onChange,
}: {
  current: number;
  onChange: (v: number) => void;
}) {
  const SLIDER_MAX = 50;
  const SLIDER_STEP = 0.5;
  const isPill = current >= 999;
  const sliderValue = isPill ? SLIDER_MAX : Math.min(Math.max(current, 0), SLIDER_MAX);
  // Gradient stop у відсотках — щоб fill-частина візуально співпадала з thumb.
  const fillPct = (sliderValue / SLIDER_MAX) * 100;
  return (
    <div>
      <div style={{ display: "flex", gap: "5px" }}>
        {BLOCK_RADIUS_PRESETS.map((p, i) => {
          const active = current === p.value;
          const previewRadius = p.value >= 999 ? "9999px" : `${Math.min(p.value, 12)}px`;
          return (
            <button
              key={i}
              type="button"
              title={p.tooltip}
              onClick={() => onChange(p.value)}
              style={{
                flex: 1, height: "26px",
                border: `1px solid ${active ? "#D4A843" : "#E8D5B7"}`,
                background: active ? "#1C3A2E" : "#FFFFFF",
                borderRadius: previewRadius,
                cursor: "pointer", padding: 0,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontSize: "11px", color: active ? "#D4A843" : "#1C3A2E",
                transition: "all 0.12s",
                fontFamily: ff,
              }}
            >{p.label}</button>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "10px" }}>
        <input
          className="uimp-radius-slider"
          type="range"
          min={0}
          max={SLIDER_MAX}
          step={SLIDER_STEP}
          value={sliderValue}
          onChange={(e) => onChange(Number(e.target.value))}
          title="Радіус кутів (0..50 px)"
          style={{
            flex: 1,
            cursor: "pointer",
            // Inline-CSS-var керує gradient-fill зліва. Сам gradient заданий
            // у <style>-блоку нижче (cross-browser ::-webkit-/::-moz-).
            ["--fill" as string]: `${fillPct}%`,
          }}
        />
        <span style={{
          fontSize: "11px", fontWeight: 700, color: "#1C3A2E",
          minWidth: "38px", textAlign: "right", fontFamily: ff,
          letterSpacing: "0.02em",
          fontVariantNumeric: "tabular-nums",
        }}>{isPill ? "Pill" : `${sliderValue % 1 === 0 ? sliderValue : sliderValue.toFixed(1)} px`}</span>
      </div>
      <style>{`
        /* UIMP-стилізований range. Native input[type=range] не дає достатнього
           контролю через accent-color — тут повністю кастомний trek + thumb.
           Розділяємо ::-webkit- (Chrome/Edge/Safari) і ::-moz- (Firefox) —
           синтаксис різний, спільного селектора нема. */
        input.uimp-radius-slider {
          appearance: none;
          -webkit-appearance: none;
          width: 100%;
          height: 18px;
          background: transparent;
          outline: none;
          padding: 0;
          margin: 0;
        }
        /* Track — Chrome/Safari/Edge. linear-gradient від золотого до крему
           з cut-off на --fill (% позиції thumb). Це і є "fill"-індикатор. */
        input.uimp-radius-slider::-webkit-slider-runnable-track {
          height: 4px;
          border-radius: 999px;
          background: linear-gradient(to right,
            #D4A843 0%, #D4A843 var(--fill),
            #EFE3CC var(--fill), #EFE3CC 100%);
          border: none;
        }
        /* Thumb — Chrome/Safari/Edge. Кругла амбер кнопка з темно-зеленим
           ring-ом і soft shadow. transform на hover/active даєить плавне
           "відчуття" взаємодії. */
        input.uimp-radius-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #D4A843;
          border: 2px solid #1C3A2E;
          /* margin-top центрує thumb вертикально відносно track-у (16px thumb
             на 4px track-у → ((4-16)/2) = -6px). */
          margin-top: -6px;
          cursor: grab;
          box-shadow: 0 2px 6px rgba(28,58,46,0.25), 0 0 0 0 rgba(212,168,67,0);
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        input.uimp-radius-slider:hover::-webkit-slider-thumb {
          transform: scale(1.12);
          box-shadow: 0 3px 10px rgba(28,58,46,0.3), 0 0 0 5px rgba(212,168,67,0.18);
        }
        input.uimp-radius-slider:active::-webkit-slider-thumb {
          cursor: grabbing;
          transform: scale(1.18);
          box-shadow: 0 3px 12px rgba(28,58,46,0.35), 0 0 0 7px rgba(212,168,67,0.22);
        }
        /* Track — Firefox. Той самий gradient через --fill. */
        input.uimp-radius-slider::-moz-range-track {
          height: 4px;
          border-radius: 999px;
          background: linear-gradient(to right,
            #D4A843 0%, #D4A843 var(--fill),
            #EFE3CC var(--fill), #EFE3CC 100%);
          border: none;
        }
        /* Firefox підтримує ::-moz-range-progress — використаємо як backup,
           але gradient уже дає fill-effect, тому ховаємо щоб не дублювало. */
        input.uimp-radius-slider::-moz-range-progress {
          background: transparent;
          height: 4px;
        }
        input.uimp-radius-slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #D4A843;
          border: 2px solid #1C3A2E;
          cursor: grab;
          box-shadow: 0 2px 6px rgba(28,58,46,0.25);
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        input.uimp-radius-slider:hover::-moz-range-thumb {
          transform: scale(1.12);
          box-shadow: 0 3px 10px rgba(28,58,46,0.3), 0 0 0 5px rgba(212,168,67,0.18);
        }
        input.uimp-radius-slider:active::-moz-range-thumb {
          cursor: grabbing;
          transform: scale(1.18);
          box-shadow: 0 3px 12px rgba(28,58,46,0.35), 0 0 0 7px rgba(212,168,67,0.22);
        }
        /* Keyboard focus — golden glow */
        input.uimp-radius-slider:focus-visible::-webkit-slider-thumb {
          box-shadow: 0 2px 8px rgba(28,58,46,0.3), 0 0 0 4px rgba(212,168,67,0.35);
        }
        input.uimp-radius-slider:focus-visible::-moz-range-thumb {
          box-shadow: 0 2px 8px rgba(28,58,46,0.3), 0 0 0 4px rgba(212,168,67,0.35);
        }
      `}</style>
    </div>
  );
}

// ── FrameControl ───────────────────────────────────────────────────────────
// Контрол секції «Рамка блока». 3 параметри:
//   1) Стиль (solid/dashed/dotted/double/groove/ridge)
//   2) Колір (UIMP-палітра + custom-picker)
//   3) Товщина (1..12 px, слайдер)
//   4) Ефект (none/shadow/glow/inset/double-outline/pulse/marching-ants)
//
// Один callback `onChange(patch)` приймає часткове оновлення (наприклад
// { frameStyle: "dashed" }). Caller мерджить його у block.data.
export function FrameControl({
  style,
  color,
  width,
  effect,
  onChange,
}: {
  style: string;
  color: string;
  width: number;
  effect: string;
  onChange: (patch: { frameStyle?: string; frameColor?: string; frameWidth?: string; frameEffect?: string }) => void;
}) {
  const WIDTH_MAX = 12;
  const enabled = !!style && !!color && width > 0;

  // Quick-reset: «Без рамки» прибирає всі 4 поля (порожні рядки → hasFrame=false).
  const clearFrame = () => onChange({ frameStyle: "", frameColor: "", frameWidth: "0", frameEffect: "" });
  // Quick-enable: якщо menager обирає style / color / збільшує width — і досі
  // нема одного з ключових полів, автоматично виставляємо розумні defaults.
  const enableWithDefaults = (patch: { frameStyle?: string; frameColor?: string; frameWidth?: string; frameEffect?: string }) => {
    const next = {
      frameStyle: patch.frameStyle !== undefined ? patch.frameStyle : (style || "solid"),
      frameColor: patch.frameColor !== undefined ? patch.frameColor : (color || "#1C3A2E"),
      frameWidth: patch.frameWidth !== undefined ? patch.frameWidth : (width > 0 ? String(width) : "2"),
      frameEffect: patch.frameEffect !== undefined ? patch.frameEffect : (effect || "none"),
    };
    onChange(next);
  };

  return (
    <div>
      {/* Style picker — 6 пресетів + «Без рамки» */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4, marginBottom: 8 }}>
        <button
          type="button"
          title="Без рамки"
          onClick={clearFrame}
          style={{
            height: 26,
            border: `1px solid ${!enabled ? "#D4A843" : "#E8D5B7"}`,
            background: !enabled ? "#1C3A2E" : "#FFFFFF",
            color: !enabled ? "#D4A843" : "#6B7280",
            borderRadius: 6, cursor: "pointer", padding: 0,
            fontSize: 10, fontFamily: ff, fontWeight: 700,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}
        >Нема</button>
        {FRAME_STYLES.map(s => {
          const active = enabled && (style as FrameStyle) === s.value;
          // Превʼю-смужка з border тим самим стилем (compact).
          return (
            <button
              key={s.value}
              type="button"
              title={s.label}
              onClick={() => enableWithDefaults({ frameStyle: s.value })}
              style={{
                height: 26,
                border: `1px solid ${active ? "#D4A843" : "#E8D5B7"}`,
                background: active ? "#1C3A2E" : "#FFFFFF",
                borderRadius: 6, cursor: "pointer", padding: 0,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <span style={{
                display: "inline-block",
                width: "70%",
                height: 0,
                borderTop: `3px ${s.value} ${active ? "#D4A843" : "#1C3A2E"}`,
              }} />
            </button>
          );
        })}
      </div>

      {/* Колір рамки — UIMP-палітра + custom */}
      <div style={{ marginBottom: 8 }}>
        <ColorSwatchRow
          current={color}
          onChange={(c) => enableWithDefaults({ frameColor: c })}
          includeTransparent={false}
        />
      </div>

      {/* Товщина — слайдер 1..12 px */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 10, color: "#9B7C45", letterSpacing: "0.08em", fontWeight: 700, minWidth: 60, fontFamily: ff }}>Товщина</span>
        <input
          type="range"
          min={0}
          max={WIDTH_MAX}
          step={1}
          value={Math.min(WIDTH_MAX, Math.max(0, width))}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (v === 0) clearFrame();
            else enableWithDefaults({ frameWidth: String(v) });
          }}
          style={{ flex: 1, cursor: "pointer", accentColor: "#D4A843" }}
        />
        <span style={{ fontSize: 11, fontWeight: 700, color: "#1C3A2E", minWidth: 30, textAlign: "right", fontFamily: ff, fontVariantNumeric: "tabular-nums" }}>
          {width > 0 ? `${width} px` : "—"}
        </span>
      </div>

      {/* Ефект — pill-кнопки в 2 ряди */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 4 }}>
        {FRAME_EFFECTS.map(e => {
          const active = enabled && ((effect as FrameEffect) || "none") === e.value;
          const disabled = !enabled && e.value !== "none";
          return (
            <button
              key={e.value}
              type="button"
              title={e.hint}
              disabled={disabled}
              onClick={() => enableWithDefaults({ frameEffect: e.value })}
              style={{
                height: 22,
                border: `1px solid ${active ? "#D4A843" : "#E8D5B7"}`,
                background: active ? "#1C3A2E" : "#FFFFFF",
                color: active ? "#D4A843" : (disabled ? "#D1D5DB" : "#1C3A2E"),
                borderRadius: 5, cursor: disabled ? "not-allowed" : "pointer", padding: "0 6px",
                fontSize: 10, fontFamily: ff, fontWeight: 600,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                opacity: disabled ? 0.5 : 1,
              }}
            >{e.label}</button>
          );
        })}
      </div>
    </div>
  );
}

// Reusable «шапка» панелі налаштувань блока: info-strip + опційні секції
// «Фон блока» та «Форма підкладки». Викликається з контекстів, де нема
// BlockItem-обгортки навколо редактора (TemplateEditor sidebar). Якщо
// `onSetBg`/`onSetRadius` не передано — відповідна секція не рендериться.
export const BlockPanelHeader: React.FC<{
  icon: React.ReactNode;
  label: string;
  subtitle?: string;
  bgColor?: string;
  onSetBg?: (c: string) => void;
  /** Поточне значення радіусу. Передавай уже з resolved-defaults (без `??`)
   *  щоб UI підсвічував активний preset одразу при відкритті. */
  radius?: number;
  onSetRadius?: (v: number) => void;
}> = ({ icon, label, subtitle, bgColor, onSetBg, radius, onSetRadius }) => (
  <div style={{ background: "#FFFFFF", fontFamily: ff }}>
    <ToolbarHeader icon={icon} label={label} hint={subtitle} />
    {onSetBg && (
      <Section padTop={0}>
        <SectionLabel>Фон блока</SectionLabel>
        <ColorSwatchRow current={bgColor || ""} onChange={onSetBg} includeTransparent />
      </Section>
    )}
    {onSetRadius && (
      <Section padTop={0}>
        <SectionLabel>Форма підкладки</SectionLabel>
        <RadiusControl current={radius ?? 0} onChange={onSetRadius} />
      </Section>
    )}
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

// Custom FontSelect — на native <select> покладатись не можна, бо браузер сам
// обирає напрямок відкриття (вгору, якщо знизу мало місця). Тут — кнопка-тригер
// + absolute-positioned dropdown ЗАВЖДИ під полем, з max-height + scroll.
// Категорії (sans/serif/...) розділяються заголовками всередині списку.
const CATEGORY_LABELS: Record<string, string> = {
  sans: "Sans-serif",
  serif: "Serif",
  display: "Display",
  handwriting: "Рукописні",
  mono: "Monospace",
};
type FontOption = { label: string; value: string; category?: string; variable?: boolean };

export function FontSelect({
  value, onChange, options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: FontOption[];
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Click-outside / Esc — закриваємо dropdown.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = options.find(o => o.value === value);
  const currentLabel = current?.label || "Системний";

  const hasCategories = options.some(o => !!o.category);
  const grouped = (() => {
    if (!hasCategories) return null;
    const groups: Record<string, FontOption[]> = {};
    for (const o of options) {
      const k = o.category || "other";
      (groups[k] = groups[k] || []).push(o);
    }
    return groups;
  })();

  const itemBtn = (o: FontOption): React.ReactElement => {
    const active = o.value === value;
    return (
      <button
        key={o.label}
        type="button"
        onClick={() => { onChange(o.value); setOpen(false); }}
        style={{
          width: "100%",
          padding: "6px 10px",
          border: "none",
          background: active ? "#FAF6F0" : "transparent",
          color: "#1C3A2E",
          fontFamily: o.value || ff,
          fontSize: "13px",
          textAlign: "left",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "6px",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#FAF6F0"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = active ? "#FAF6F0" : "transparent"; }}
      >
        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.label}</span>
        {o.variable && <span title="Variable font — плавна жирність" style={{ fontSize: "10px", color: "#9B7C45", flexShrink: 0 }}>ⓥ</span>}
      </button>
    );
  };

  return (
    <div ref={rootRef} style={{ position: "relative", width: "100%" }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          ...inputBase, padding: "0 8px",
          fontFamily: value || ff, cursor: "pointer", width: "100%",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: "6px",
        }}
      >
        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{currentLabel}</span>
        <span style={{ fontSize: "9px", color: "#9B7C45", flexShrink: 0 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 1000,
            maxHeight: "280px",
            overflowY: "auto",
            background: "#FFFFFF",
            border: "1px solid #E8D5B7",
            borderRadius: "6px",
            boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
            paddingTop: "4px",
            paddingBottom: "4px",
          }}
        >
          {grouped
            ? Object.entries(grouped).map(([cat, list]) => (
                <div key={cat}>
                  <div style={{
                    padding: "6px 10px 2px",
                    fontSize: "9px", fontWeight: 800, color: "#9B7C45",
                    letterSpacing: "0.14em", textTransform: "uppercase",
                    fontFamily: ff,
                  }}>{CATEGORY_LABELS[cat] || cat}</div>
                  {list.map(itemBtn)}
                </div>
              ))
            : options.map(itemBtn)}
        </div>
      )}
    </div>
  );
}
