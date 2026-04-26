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
  { type: "card",    label: "Картка",     icon: "▦",  desc: "Заголовок + кнопка", color: "#9B7EBF", colorDim: "rgba(155,126,191,0.18)", bg: "rgba(155,126,191,0.07)" },
];

function PaletteItem({ type, label, icon, desc, color, colorDim, bg }: typeof PALETTE_BLOCKS[0]) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette:${type}`,
    data: { type, fromPalette: true },
  });
  const [hov, setHov] = React.useState(false);

  return (
    <div style={{ position: "relative" }}>
      {isDragging && (
        <div style={{
          height: "58px",
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
            gap: "12px",
            padding: "10px 12px",
            borderRadius: "10px",
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: hov ? colorDim : "rgba(255,255,255,0.05)",
            background: hov ? bg : "rgba(255,255,255,0.02)",
            transition: "all 0.15s",
            transform: hov ? "translateX(3px)" : "none",
            userSelect: "none",
          }}
        >
          <div style={{
            width: "34px",
            height: "34px",
            borderRadius: "9px",
            background: hov ? color : colorDim,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: type === "image" ? "16px" : "15px",
            fontWeight: 700,
            color: hov ? "#1C3A2E" : color,
            flexShrink: 0,
            transition: "all 0.15s",
            boxShadow: hov ? `0 2px 8px ${colorDim}` : "none",
          }}>{icon}</div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: "13px",
              fontWeight: 600,
              color: hov ? "#FAF6F0" : "rgba(255,255,255,0.75)",
              fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
              lineHeight: 1.2,
            }}>{label}</div>
            <div style={{
              fontSize: "10px",
              color: hov ? colorDim : "rgba(255,255,255,0.2)",
              fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
              marginTop: "2px",
            }}>{desc}</div>
          </div>

          <div style={{
            fontSize: "12px",
            color: hov ? colorDim : "rgba(255,255,255,0.12)",
            transition: "color 0.15s",
          }}>{"⠿"}</div>
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
}

// Draggable handle для overlay-tool — drop на image-блок створює overlay у точці drop.
// Логіка drop обробляється в EditorCanvas handleDragEnd при id === "palette:image-overlay".
function ImageOverlayPaletteItem({ onAddImageOverlay }: { onAddImageOverlay: () => void }) {
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
          height: "58px",
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
            gap: "12px",
            padding: "10px 12px",
            borderRadius: "10px",
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: hov ? colorDim : "rgba(255,255,255,0.05)",
            background: hov ? bg : "rgba(255,255,255,0.02)",
            transition: "all 0.15s",
            transform: hov ? "translateX(3px)" : "none",
            userSelect: "none",
          }}
        >
          <div style={{
            width: "34px",
            height: "34px",
            borderRadius: "9px",
            background: hov ? color : colorDim,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "15px",
            fontWeight: 700,
            color: hov ? "#1C3A2E" : color,
            flexShrink: 0,
            transition: "all 0.15s",
            boxShadow: hov ? `0 2px 8px ${colorDim}` : "none",
          }}>T</div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: "13px",
              fontWeight: 600,
              color: hov ? "#FAF6F0" : "rgba(255,255,255,0.75)",
              fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
              lineHeight: 1.2,
            }}>{"Текст на фото"}</div>
            <div style={{
              fontSize: "10px",
              color: hov ? colorDim : "rgba(255,255,255,0.2)",
              fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
              marginTop: "2px",
            }}>{"Напис поверх фото"}</div>
          </div>

          <div style={{
            fontSize: "12px",
            color: hov ? colorDim : "rgba(255,255,255,0.12)",
            transition: "color 0.15s",
          }}>{"⠿"}</div>
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

export default function BlockPalette({ onAddImageOverlay }: PaletteProps = {}) {
  return (
    <div style={{
      width: "230px",
      minWidth: "230px",
      background: "linear-gradient(180deg, #162C25 0%, #0F2019 100%)",
      borderRadius: "16px",
      padding: "20px 14px",
      display: "flex",
      flexDirection: "column",
      gap: "5px",
      position: "sticky",
      top: "76px",
      alignSelf: "flex-start",
      boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06), 0 8px 40px rgba(0,0,0,0.2)",
    }}>
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

      {PALETTE_BLOCKS.map(b => <PaletteItem key={b.type} {...b} />)}

      {/* Subgroup — інструменти для існуючого блоку Фото (не самостійні блоки) */}
      {onAddImageOverlay && (
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
  );
}