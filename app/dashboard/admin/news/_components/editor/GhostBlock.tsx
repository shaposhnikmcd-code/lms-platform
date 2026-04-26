"use client";

import React from "react";
import { BlockType } from "./types";

const ff = "-apple-system, BlinkMacSystemFont, sans-serif";

// header ~40px + body padding 28px + content
export const BLOCK_PREVIEW_HEIGHTS: Record<BlockType, number> = {
  heading: 40 + 28 + 52,
  text:    40 + 28 + 120,
  quote:   40 + 28 + 96,
  divider: 40 + 28 + 18,
  image:   40 + 28 + 160,
  youtube: 40 + 28 + 52,
  card:    40 + 28 + 200,
};

export const BLOCK_ICONS: Record<BlockType, string> = {
  heading: "H",
  text:    "¶",
  quote:   "❝",
  divider: "—",
  image:   "🖼",
  youtube: "▶",
  card:    "▭",
};

export const BLOCK_LABELS: Record<BlockType, string> = {
  heading: "Заголовок",
  text:    "Текст",
  quote:   "Цитата",
  divider: "Лінія",
  image:   "Фото",
  youtube: "YouTube",
  card:    "Картка",
};

interface Props {
  type: BlockType;
  isOver: boolean;
}

export default function GhostBlock({ type, isOver }: Props) {
  const h = BLOCK_PREVIEW_HEIGHTS[type];

  return (
    <div style={{
      width: "100%",
      height: `${h}px`,
      borderRadius: "12px",
      borderWidth: "2px",
      borderStyle: "dashed",
      borderColor: isOver ? "#D4A843" : "rgba(212,168,67,0.3)",
      background: isOver ? "rgba(212,168,67,0.06)" : "rgba(212,168,67,0.02)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "8px",
      transition: "all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
      transform: isOver ? "scale(1.01)" : "scale(1)",
      boxShadow: isOver ? "0 0 0 4px rgba(212,168,67,0.1)" : "none",
    }}>
      <div style={{
        width: "36px", height: "36px", borderRadius: "10px",
        background: isOver ? "#D4A843" : "rgba(212,168,67,0.15)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "16px", fontWeight: 700,
        color: isOver ? "#1C3A2E" : "#D4A843",
        transition: "all 0.2s",
      }}>{BLOCK_ICONS[type]}</div>
      <div style={{
        fontSize: "12px", fontWeight: 600,
        color: isOver ? "#D4A843" : "rgba(212,168,67,0.6)",
        fontFamily: ff, transition: "color 0.2s",
      }}>
        {isOver ? `Додати "${BLOCK_LABELS[type]}"` : BLOCK_LABELS[type]}
      </div>
    </div>
  );
}