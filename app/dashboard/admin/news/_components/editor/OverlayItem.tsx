"use client";

import React from "react";
import { PALETTE_BLOCKS } from "./BlockPalette";

const ff = "-apple-system, BlinkMacSystemFont, sans-serif";

interface Props {
  activeId: string | null;
  isOverCanvas: boolean;
  paletteBlock: typeof PALETTE_BLOCKS[0] | null;
}

export default function OverlayItem({ activeId, isOverCanvas, paletteBlock }: Props) {
  if (paletteBlock) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "12px 18px",
        borderRadius: "12px",
        background: "#1C3A2E",
        borderWidth: "1.5px",
        borderStyle: "solid",
        borderColor: isOverCanvas ? "#D4A843" : "rgba(212,168,67,0.4)",
        boxShadow: isOverCanvas
          ? "0 16px 48px rgba(0,0,0,0.35), 0 0 0 6px rgba(212,168,67,0.15)"
          : "0 8px 24px rgba(0,0,0,0.2)",
        cursor: "grabbing",
        minWidth: "180px",
        transition: "box-shadow 0.15s, border-color 0.15s",
      }}>
        <div style={{
          width: "36px", height: "36px", borderRadius: "9px",
          background: isOverCanvas ? "#D4A843" : "rgba(212,168,67,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "16px", fontWeight: 700,
          color: isOverCanvas ? "#1C3A2E" : "#D4A843",
          flexShrink: 0, transition: "all 0.15s",
        }}>
          {paletteBlock.icon}
        </div>
        <div>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "#FAF6F0", fontFamily: ff }}>
            {paletteBlock.label}
          </div>
          <div style={{ fontSize: "11px", fontFamily: ff, marginTop: "2px", transition: "color 0.15s", color: isOverCanvas ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.3)" }}>
            {isOverCanvas ? "Відпустіть щоб додати ✓" : "Перетягніть на робочу область"}
          </div>
        </div>
      </div>
    );
  }

  if (activeId) {
    return (
      <div style={{
        padding: "10px 20px", borderRadius: "10px",
        background: "rgba(28,58,46,0.92)",
        borderWidth: "1px", borderStyle: "solid", borderColor: "#D4A843",
        boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
        fontSize: "13px", fontWeight: 700, color: "#D4A843", fontFamily: ff,
        cursor: "grabbing",
      }}>{"⠿ Переміщення"}</div>
    );
  }

  return null;
}