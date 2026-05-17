// Preview-рендер block-based шаблону для адмінки (/dashboard/admin/news).
//
// Чому окремий компонент від AbsoluteBlockRender:
// у TemplateConstructor блоки — це КАРКАС (тільки тип + позиція + розмір), data
// порожня. Менеджер бачить їх як «плейсхолдери з міткою типу» (H · Заголовок,
// 🖼 · Фото, ¶ · Текст тощо). Адмін-список має показувати ТЕ Ж САМЕ — інакше
// preview виглядає білим. Звичайний AbsoluteBlockRender для таких блоків
// рендерить порожній контент (немає url, html тощо).

import React from "react";
import type { Block } from "../render";
import { AbsoluteBlockRender } from "../render";

// Кольори синхронізовані 1-в-1 з білдером (BlockItem.tsx → TEMPLATE_PLACEHOLDER_LABELS).
// generic-блоки — кожен має свій акцент; спецблоки — всі один muted-violet.
const SPEC_TINT = "#8B7AB8";
const SPEC_BG = "rgba(139,122,184,0.35)";
const TEMPLATE_PLACEHOLDER_LABELS: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  heading:        { icon: "H",  label: "Заголовок",    color: "#D4A843", bg: "rgba(212,168,67,0.35)" },
  text:           { icon: "¶",  label: "Текст",        color: "#7EB8A4", bg: "rgba(126,184,164,0.35)" },
  image:          { icon: "🖼", label: "Фото",         color: "#A8C97A", bg: "rgba(168,201,122,0.35)" },
  youtube:        { icon: "▶",  label: "YouTube",      color: "#E07B6A", bg: "rgba(224,123,106,0.35)" },
  quote:          { icon: "❝",  label: "Цитата",       color: "#C4919A", bg: "rgba(196,145,154,0.35)" },
  divider:        { icon: "—",  label: "Лінія",        color: "#8B9EB0", bg: "rgba(139,158,176,0.35)" },
  card:           { icon: "▢",  label: "Картка",       color: "#A8956C", bg: "rgba(168,149,108,0.35)" },
  newsCard:       { icon: "📰", label: "Новина",       color: "#A8956C", bg: "rgba(168,149,108,0.35)" },
  cardBody:       { icon: "▢",  label: "Пустий блок",  color: "#A8956C", bg: "rgba(168,149,108,0.35)" },
  speakerName:    { icon: "👤", label: "Імʼя фахівця", color: SPEC_TINT, bg: SPEC_BG },
  speakerRole:    { icon: "🎓", label: "Посада",       color: SPEC_TINT, bg: SPEC_BG },
  tagline:        { icon: "✍",  label: "Tagline",      color: SPEC_TINT, bg: SPEC_BG },
  price:          { icon: "₴",  label: "Вартість",     color: SPEC_TINT, bg: SPEC_BG },
  duration:       { icon: "⏱",  label: "Тривалість",   color: SPEC_TINT, bg: SPEC_BG },
  ctaButton:      { icon: "▶",  label: "Кнопка CTA",   color: SPEC_TINT, bg: SPEC_BG },
  educationItem:  { icon: "📜", label: "Пункт освіти", color: SPEC_TINT, bg: SPEC_BG },
};

const ff = "-apple-system, BlinkMacSystemFont, sans-serif";

interface Props {
  blocks: Block[];
  /** Природний розмір canvas-у шаблону. Блоки позиціонуються в координатах
   *  цього canvas-у (x у %, y/height у px). PreviewCardScale-обгортка зовні
   *  масштабує до фактичної ширини контейнера. */
  width: number;
  height: number;
  background?: string;
  /** "blueprint" (default): рендеримо плейсхолдери (іконка+мітка типу) — для
   *  шаблонів-каркасів, де data порожня. "content": рендеримо РЕАЛЬНИЙ
   *  контент блоків через AbsoluteBlockRender — для новин, наповнених
   *  менеджером (фото, текст, заголовки тощо). */
  mode?: "blueprint" | "content";
}

export default function TemplateBlocksPreview({ blocks, width, height, background, mode = "blueprint" }: Props) {
  if (mode === "content") {
    return (
      <div
        style={{
          position: "relative",
          width,
          height,
          overflow: "hidden",
          background: background || "#FFFFFF",
        }}
      >
        {blocks.map(b => (
          <AbsoluteBlockRender key={b.id} block={b} locale="uk" />
        ))}
      </div>
    );
  }
  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        overflow: "hidden",
        background: background || "#FFFFFF",
      }}
    >
      {blocks.map(b => {
        const x = b.x ?? 0;
        const y = b.y ?? 0;
        const w = Number(b.width) || 100;
        const h = b.height;
        const info = TEMPLATE_PLACEHOLDER_LABELS[b.type] || { icon: "■", label: b.type, color: "#1C3A2E", bg: "rgba(28,58,46,0.04)" };
        const radius =
          typeof b.borderRadius === "number"
            ? (b.borderRadius >= 999 ? 9999 : b.borderRadius)
            : 6;
        // cardBody — порожній блок-host. Як і у білдері (BlockItem.tsx
        // TemplatePlaceholder для cardBody) — тільки маленький корнер-маркер
        // ▢, без центрального лейблу «Пустий блок».
        if (b.type === "cardBody") {
          return (
            <div
              key={b.id}
              style={{
                position: "absolute",
                left: `${x}%`,
                top: `${y}px`,
                width: `${w}%`,
                height: h ? `${h}px` : "auto",
                borderRadius: radius,
                background: b.bgColor || info.bg,
                boxSizing: "border-box",
                overflow: "hidden",
              }}
            >
              <div style={{
                position: "absolute",
                top: 6,
                left: 8,
                fontSize: 11,
                fontWeight: 700,
                color: info.color,
                opacity: 0.6,
                fontFamily: ff,
                letterSpacing: "0.04em",
                lineHeight: 1,
                pointerEvents: "none",
              }}>▢</div>
            </div>
          );
        }
        return (
          <div
            key={b.id}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}px`,
              width: `${w}%`,
              height: h ? `${h}px` : "auto",
              border: "1.5px dashed rgba(28,58,46,0.28)",
              borderRadius: radius,
              background: b.bgColor || info.bg,
              boxSizing: "border-box",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              color: info.color,
              fontFamily: ff,
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: "0.02em",
              padding: "6px 10px",
              textAlign: "center",
              lineHeight: 1.2,
              overflow: "hidden",
            }}
          >
            <span style={{ fontSize: 16 }}>{info.icon}</span>
            <span>{info.label}</span>
          </div>
        );
      })}
    </div>
  );
}
