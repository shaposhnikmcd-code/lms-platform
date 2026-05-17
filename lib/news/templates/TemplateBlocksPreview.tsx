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

const TEMPLATE_PLACEHOLDER_LABELS: Record<string, { icon: string; label: string }> = {
  heading:        { icon: "H",  label: "Заголовок" },
  text:           { icon: "¶",  label: "Текст" },
  image:          { icon: "🖼", label: "Фото" },
  youtube:        { icon: "▶",  label: "YouTube" },
  quote:          { icon: "❝",  label: "Цитата" },
  divider:        { icon: "—",  label: "Лінія" },
  card:           { icon: "▢",  label: "Картка" },
  newsCard:       { icon: "📰", label: "Новина" },
  cardBody:       { icon: "▢",  label: "Пустий блок" },
  speakerName:    { icon: "👤", label: "Імʼя фахівця" },
  speakerRole:    { icon: "🎓", label: "Посада" },
  tagline:        { icon: "✍",  label: "Tagline" },
  price:          { icon: "₴",  label: "Вартість" },
  duration:       { icon: "⏱",  label: "Тривалість" },
  ctaButton:      { icon: "▶",  label: "Кнопка CTA" },
  educationItem:  { icon: "📜", label: "Пункт освіти" },
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
}

export default function TemplateBlocksPreview({ blocks, width, height, background }: Props) {
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
        const info = TEMPLATE_PLACEHOLDER_LABELS[b.type] || { icon: "■", label: b.type };
        const radius =
          typeof b.borderRadius === "number"
            ? (b.borderRadius >= 999 ? 9999 : b.borderRadius)
            : 6;
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
              background: b.bgColor || "rgba(28,58,46,0.04)",
              boxSizing: "border-box",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              color: "rgba(28,58,46,0.7)",
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
