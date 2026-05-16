"use client";

import React from "react";
import { useDraggable } from "@dnd-kit/core";
import { BlockType } from "./types";

export const PALETTE_BLOCKS: {
  type: BlockType;
  label: string;
  icon: string;
  desc: string;
  color: string;
  colorDim: string;
  bg: string;
}[] = [
  { type: "heading", label: "Заголовок",  icon: "H",  desc: "H1 / H2 / H3", color: "#D4A843", colorDim: "rgba(212,168,67,0.18)", bg: "rgba(212,168,67,0.08)" },
  { type: "text",    label: "Текст",      icon: "¶",  desc: "Параграф",      color: "#7EB8A4", colorDim: "rgba(126,184,164,0.18)", bg: "rgba(126,184,164,0.07)" },
  { type: "quote",   label: "Цитата",     icon: "❝",  desc: "Виділення",     color: "#C4919A", colorDim: "rgba(196,145,154,0.18)", bg: "rgba(196,145,154,0.07)" },
  { type: "divider", label: "Лінія",      icon: "—",  desc: "Роздільник",    color: "#8B9EB0", colorDim: "rgba(139,158,176,0.18)", bg: "rgba(139,158,176,0.07)" },
  { type: "image",   label: "Фото",       icon: "🖼", desc: "Зображення",    color: "#A8C97A", colorDim: "rgba(168,201,122,0.18)", bg: "rgba(168,201,122,0.07)" },
  { type: "youtube", label: "YouTube",    icon: "▶",  desc: "Відео",         color: "#E07B6A", colorDim: "rgba(224,123,106,0.18)", bg: "rgba(224,123,106,0.07)" },
  // Пустий блок — контейнер-хост на який можна класти спецблоки (як на Фото).
  // Реюзаємо тип `cardBody` з системи (вже зареєстрований у render.tsx / GhostBlock).
  { type: "cardBody",label: "Пустий блок",icon: "▢",  desc: "Контейнер",     color: "#A8956C", colorDim: "rgba(168,149,108,0.18)", bg: "rgba(168,149,108,0.07)" },
  // "Картка" (card) прибрана з палітри 2026-04-28 — користувач не хоче її як
  // окремий блок. Тип лишається в системі для backward-compat: старі новини з
  // card-блоками все ще рендеряться через BlockInner.case "card" у render.tsx.
];

// Окрема палітра для конструктора ШАБЛОНІВ — структуровані семантичні слоти
// EVENT/ARTICLE-картки. Не змішується з PALETTE_BLOCKS (palette на /news
// page builder), щоб менеджер сторінки /news НЕ міг випадково кинути
// "Імʼя фахівця" на сторінку, де воно не має сенсу. Перемикається режимом
// у NewsEditor (palette={...}) — у Session 3 додаємо ці блоки до палітри
// тільки коли editor завантажений для template-новини.
export const TEMPLATE_PALETTE_BLOCKS: typeof PALETTE_BLOCKS = [
  { type: "speakerName",   label: "Імʼя фахівця",   icon: "👤", desc: "Імʼя та прізвище",      color: "#D4A843", colorDim: "rgba(212,168,67,0.18)", bg: "rgba(212,168,67,0.08)" },
  { type: "speakerRole",   label: "Посада",         icon: "🎓", desc: "Спеціалізація",         color: "#A8956C", colorDim: "rgba(168,149,108,0.18)", bg: "rgba(168,149,108,0.08)" },
  { type: "tagline",       label: "Tagline",        icon: "✍",  desc: "Підпис 1 рядком",        color: "#7EB8A4", colorDim: "rgba(126,184,164,0.18)", bg: "rgba(126,184,164,0.07)" },
  { type: "price",         label: "Вартість",       icon: "₴",  desc: "Ціна + валюта",          color: "#C4919A", colorDim: "rgba(196,145,154,0.18)", bg: "rgba(196,145,154,0.07)" },
  { type: "duration",      label: "Тривалість",     icon: "⏱",  desc: "Час + одиниця",          color: "#8B9EB0", colorDim: "rgba(139,158,176,0.18)", bg: "rgba(139,158,176,0.07)" },
  { type: "ctaButton",     label: "Кнопка CTA",     icon: "▶",  desc: "Записатись / Купити",   color: "#E07B6A", colorDim: "rgba(224,123,106,0.18)", bg: "rgba(224,123,106,0.07)" },
  { type: "educationItem", label: "Пункт освіти",   icon: "📜", desc: "Назва + диплом",         color: "#A8C97A", colorDim: "rgba(168,201,122,0.18)", bg: "rgba(168,201,122,0.07)" },
];

function PaletteItem({ type, label, icon, desc, color, colorDim, bg, compact = false }: typeof PALETTE_BLOCKS[0] & { compact?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette:${type}`,
    data: { type, fromPalette: true },
  });
  const [hov, setHov] = React.useState(false);

  return (
    <div style={{ position: "relative" }}>
      {isDragging && (
        <div style={{
          height: compact ? "44px" : "58px",
          borderRadius: "10px",
          borderWidth: "1.5px",
          borderStyle: "dashed",
          borderColor: colorDim,
          background: bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: colorDim }} />
        </div>
      )}

      {!isDragging && (
        <div
          onMouseEnter={() => setHov(true)}
          onMouseLeave={() => setHov(false)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: compact ? "12px" : "12px",
            padding: compact ? "17px 13px" : "10px 12px",
            borderRadius: "10px",
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: hov ? colorDim : "rgba(255,255,255,0.05)",
            background: hov ? bg : "rgba(255,255,255,0.02)",
            transition: "all 0.15s",
            transform: hov ? "translateX(2px)" : "none",
            userSelect: "none",
          }}
        >
          <div style={{
            width: compact ? "36px" : "34px",
            height: compact ? "36px" : "34px",
            borderRadius: compact ? "9px" : "9px",
            background: hov ? color : colorDim,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: type === "image" ? (compact ? "17px" : "16px") : (compact ? "16px" : "15px"),
            fontWeight: 700,
            color: hov ? "#1C3A2E" : color,
            flexShrink: 0,
            transition: "all 0.15s",
            boxShadow: hov ? `0 2px 8px ${colorDim}` : "none",
          }}>{icon}</div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: compact ? "14px" : "13px",
              fontWeight: 600,
              color: hov ? "#FAF6F0" : "rgba(255,255,255,0.78)",
              fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
              lineHeight: 1.15,
              whiteSpace: compact ? "nowrap" : undefined,
              overflow: compact ? "hidden" : undefined,
              textOverflow: compact ? "ellipsis" : undefined,
            }}>{label}</div>
            {!compact && (
              <div style={{
                fontSize: "10px",
                color: hov ? colorDim : "rgba(255,255,255,0.2)",
                fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
                marginTop: "2px",
              }}>{desc}</div>
            )}
          </div>

          {!compact && (
            <div style={{
              fontSize: "12px",
              color: hov ? colorDim : "rgba(255,255,255,0.12)",
              transition: "color 0.15s",
            }}>{"⠿"}</div>
          )}
        </div>
      )}

      {!isDragging && (
        <div
          ref={setNodeRef}
          {...listeners}
          {...attributes}
          style={{
            position: "absolute", inset: 0,
            cursor: "grab", borderRadius: "10px", background: "transparent",
          }}
        />
      )}
    </div>
  );
}

interface PaletteProps {
  onAddImageOverlay?: () => void;
  /** Y-координата вибраного блока (px відносно canvas-top). Settings-секція
   *  vertically вирівнюється сюди — щоб "відкривалась" поряд з блоком. */
  selectedBlockY?: number | null;
  /** Додаткові блоки палітри для контексту "page-builder" (наприклад, newsList). */
  extraBlocks?: typeof PALETTE_BLOCKS;
  /** Заголовок секції під додатковими блоками. */
  extraBlocksTitle?: string;
  /** Compact 2-col layout: Блоки + Спецблоки поряд (template-режим). */
  compact?: boolean;
}

// Draggable handle для overlay-tool — drop на image-блок створює overlay у точці drop.
// Логіка drop обробляється в EditorCanvas handleDragEnd при id === "palette:image-overlay".
function ImageOverlayPaletteItem({ onAddImageOverlay, compact = false }: { onAddImageOverlay: () => void; compact?: boolean }) {
  const color = "#D4A843";
  const colorDim = "rgba(212,168,67,0.18)";
  const bg = "rgba(212,168,67,0.08)";
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: "palette:image-overlay",
    data: { fromPalette: true, kind: "image-overlay" },
  });
  const [hov, setHov] = React.useState(false);

  return (
    <div style={{ position: "relative" }}>
      {isDragging && (
        <div style={{
          height: compact ? "44px" : "58px",
          borderRadius: "10px",
          borderWidth: "1.5px",
          borderStyle: "dashed",
          borderColor: colorDim,
          background: bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: colorDim }} />
        </div>
      )}

      {!isDragging && (
        <div
          onMouseEnter={() => setHov(true)}
          onMouseLeave={() => setHov(false)}
          title="Клацни щоб додати на останнє фото, або перетягни на конкретне"
          style={{
            display: "flex",
            alignItems: "center",
            gap: compact ? "12px" : "12px",
            padding: compact ? "17px 13px" : "10px 12px",
            borderRadius: "10px",
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: hov ? colorDim : "rgba(255,255,255,0.05)",
            background: hov ? bg : "rgba(255,255,255,0.02)",
            transition: "all 0.15s",
            transform: hov ? "translateX(2px)" : "none",
            userSelect: "none",
          }}
        >
          <div style={{
            width: compact ? "36px" : "34px",
            height: compact ? "36px" : "34px",
            borderRadius: "9px",
            background: hov ? color : colorDim,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: compact ? "16px" : "15px",
            fontWeight: 700,
            color: hov ? "#1C3A2E" : color,
            flexShrink: 0,
            transition: "all 0.15s",
            boxShadow: hov ? `0 2px 8px ${colorDim}` : "none",
          }}>T</div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: compact ? "14px" : "13px",
              fontWeight: 600,
              color: hov ? "#FAF6F0" : "rgba(255,255,255,0.78)",
              fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
              lineHeight: 1.15,
              whiteSpace: compact ? "nowrap" : undefined,
              overflow: compact ? "hidden" : undefined,
              textOverflow: compact ? "ellipsis" : undefined,
            }}>{"Текст на фото"}</div>
            {!compact && (
              <div style={{
                fontSize: "10px",
                color: hov ? colorDim : "rgba(255,255,255,0.2)",
                fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
                marginTop: "2px",
              }}>{"Напис поверх фото"}</div>
            )}
          </div>

          {!compact && (
            <div style={{
              fontSize: "12px",
              color: hov ? colorDim : "rgba(255,255,255,0.12)",
              transition: "color 0.15s",
            }}>{"⠿"}</div>
          )}
        </div>
      )}

      {!isDragging && (
        <div
          ref={setNodeRef}
          {...listeners}
          {...attributes}
          onClick={onAddImageOverlay}
          style={{
            position: "absolute", inset: 0,
            cursor: "grab", borderRadius: "10px", background: "transparent",
          }}
        />
      )}
    </div>
  );
}

export default function BlockPalette({ onAddImageOverlay, selectedBlockY, extraBlocks, extraBlocksTitle, compact = false }: PaletteProps = {}) {
  // selectedBlockY більше не потрібний для геометрії — settings завжди на верху palette
  // (стандартний Figma/Webflow паттерн). Зберігаємо параметр для майбутньої сумісності.
  void selectedBlockY;
  const isSelected = selectedBlockY !== null && selectedBlockY !== undefined;

  // У compact (template) режимі — ширша палітра, бо 2 колонки блоків поряд.
  const paletteWidth = compact ? 520 : 304;

  return (
    <div className="news-palette-scroll" style={{
      width: `${paletteWidth}px`,
      minWidth: `${paletteWidth}px`,
      background: "linear-gradient(180deg, #162C25 0%, #0F2019 100%)",
      borderRadius: "16px",
      padding: "20px 14px",
      // У template-режимі — невелика верхня відбивка від хедера сторінки.
      marginTop: compact ? 16 : 0,
      display: "flex",
      flexDirection: "column",
      // Sticky-палітра — фіксована у viewport, внутрішній скрол. Без цього palette
      // ріс/стискався разом з canvas і провокував вертикальний стрибок сторінки
      // при зміні selection.
      position: "sticky",
      top: compact ? "96px" : "80px",
      alignSelf: "flex-start",
      maxHeight: "calc(100vh - 100px)",
      overflowY: "auto",
      // scrollbarWidth/-ms-overflow-style/-webkit-scrollbar — приховуємо візуальну
      // смугу прокрутки, але scroll-функція залишається (на колесі / трекпаді).
      scrollbarWidth: "none",
      msOverflowStyle: "none",
      boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06), 0 8px 40px rgba(0,0,0,0.2)",
    }}>
      {/* Налаштування вибраного блока — flex-item з marginTop=blockY+offset.
          Стає vertically напроти блока на канвасі. Коли блок вибраний, цей секція
          "штовхає" статичні блоки нижче (вони flexible слайдять вниз).
          BlockItem/TextEditor/ImageEditor portal-ять контролі через createPortal
          у #news-block-settings-slot. */}
      <div className="news-settings-wrapper" style={{ marginBottom: "20px" }}>
        <div className="news-settings-title" style={{
          fontSize: "9px",
          fontWeight: 800,
          color: "#D4A843",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
          paddingLeft: "4px",
          marginBottom: "8px",
        }}>{"Налаштування блока"}</div>
        <div
          id="news-block-settings-slot"
          style={{
            display: "flex",
            flexDirection: "column",
            background: "#FFFFFF",
            borderRadius: "10px",
            boxShadow: "inset 0 0 0 1px rgba(212,168,67,0.18), 0 4px 14px rgba(0,0,0,0.08)",
            overflow: "hidden",
          }}
        />
        {/* Видимість керується через :empty: коли slot не має портал-дітей,
            ховаємо весь wrapper. Так overlay-toolbar (без selected парент-блока)
            теж стане видимим, бо ImageEditor портал-ить туди свою панель і :empty
            перестає матчитись. */}
        <style>{`
          .news-palette-scroll::-webkit-scrollbar { display: none; }
          #news-block-settings-slot > * + * {
            border-top: 1px solid #EEEAE2;
          }
          .news-settings-wrapper:has(#news-block-settings-slot:empty) {
            display: none;
          }
        `}</style>
      </div>

      {compact && extraBlocks && extraBlocks.length > 0 ? (
        // 2-col layout: ліворуч Блоки, праворуч Спецблоки (з ImageOverlay усередині).
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <div style={{
              fontSize: "14px",
              fontWeight: 800,
              color: "#D4A843",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
              paddingLeft: "4px",
              marginBottom: "12px",
            }}>{"Блоки"}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {PALETTE_BLOCKS.map(b => <PaletteItem key={b.type} {...b} compact />)}
            </div>
          </div>

          <div>
            <div style={{
              fontSize: "14px",
              fontWeight: 800,
              color: "#D4A843",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
              paddingLeft: "4px",
              marginBottom: "12px",
            }}>{extraBlocksTitle || "Спецблоки"}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {extraBlocks.map(b => <PaletteItem key={b.type} {...b} compact />)}
              {onAddImageOverlay && <ImageOverlayPaletteItem onAddImageOverlay={onAddImageOverlay} compact />}
            </div>
          </div>
        </div>
      ) : (
        // Стандартний 1-col layout (page-builder /news).
        <>
          <div style={{
            fontSize: "9px",
            fontWeight: 800,
            color: "#D4A843",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
            paddingLeft: "4px",
            marginBottom: "2px",
          }}>{"Блоки"}</div>

          <div style={{
            fontSize: "10px",
            color: "rgba(255,255,255,0.2)",
            fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
            paddingLeft: "4px",
            marginBottom: "10px",
            lineHeight: 1.5,
          }}>{"Перетягніть блок у робочу область"}</div>

          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            {PALETTE_BLOCKS.map(b => <PaletteItem key={b.type} {...b} />)}

            {extraBlocks && extraBlocks.length > 0 && (
              <>
                <div style={{
                  height: "1px",
                  background: "rgba(255,255,255,0.08)",
                  margin: "10px 4px 8px",
                }} />
                <div style={{
                  fontSize: "9px",
                  fontWeight: 700,
                  color: "rgba(212,168,67,0.6)",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
                  paddingLeft: "4px",
                  marginBottom: "6px",
                }}>{extraBlocksTitle || "Динамічні"}</div>
                {extraBlocks.map(b => <PaletteItem key={b.type} {...b} />)}
                {onAddImageOverlay && <ImageOverlayPaletteItem onAddImageOverlay={onAddImageOverlay} />}
              </>
            )}

            {onAddImageOverlay && (!extraBlocks || extraBlocks.length === 0) && (
              <>
                <div style={{
                  height: "1px",
                  background: "rgba(255,255,255,0.08)",
                  margin: "10px 4px 8px",
                }} />
                <div style={{
                  fontSize: "9px",
                  fontWeight: 700,
                  color: "rgba(212,168,67,0.6)",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
                  paddingLeft: "4px",
                  marginBottom: "6px",
                }}>{"Поверх фото"}</div>
                <ImageOverlayPaletteItem onAddImageOverlay={onAddImageOverlay} />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}