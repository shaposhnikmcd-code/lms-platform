"use client";

import React, { useState } from "react";
import { BlockAlign, UIMP_COLORS } from "./types";

const ff = "-apple-system, BlinkMacSystemFont, sans-serif";

function TBtn({ active, onClick, children, title, disabled }: { active?: boolean; onClick: () => void; children: React.ReactNode; title?: string; disabled?: boolean }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      title={title}
      disabled={disabled}
      onMouseDown={e => { e.preventDefault(); if (!disabled) onClick(); }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: "3px 8px", borderRadius: "5px", border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: "11px", fontWeight: 700, fontFamily: ff,
        background: disabled ? "rgba(0,0,0,0.04)" : active ? "#1C3A2E" : hov ? "#E8F5E0" : "#EEEAE2",
        color: disabled ? "#C8C0B4" : active ? "#D4A843" : "#1C3A2E",
        transition: "all 0.12s", minWidth: "24px",
        opacity: disabled ? 0.5 : 1,
      }}
    >{children}</button>
  );
}

const Sep = ({ hov }: { hov: boolean }) => (
  <div style={{ width: "1px", height: "14px", background: hov ? "rgba(255,255,255,0.12)" : "#E8D5B7", margin: "0 2px" }} />
);

interface Props {
  blockId: string;
  blockType: string;
  blockAlign: BlockAlign;
  blockBgColor: string;
  displayPct: number;
  hov: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  dragAttributes: React.HTMLAttributes<HTMLElement>;
  dragListeners: React.HTMLAttributes<HTMLElement> | undefined;
  onSetAlign: (id: string, a: BlockAlign) => void;
  onSetBg: (id: string, c: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onDuplicate: (id: string) => void;
}

const LABELS: Record<string, string> = { text: "Текст", heading: "Заголовок", image: "Фото", youtube: "YouTube", quote: "Цитата", divider: "Роздільник", card: "Картка" };
const ICONS: Record<string, string> = { text: "¶", heading: "H", image: "🖼", youtube: "▶", quote: "❝", divider: "—", card: "▦" };

export default function BlockItemHeader({
  blockId, blockType, blockAlign, blockBgColor, displayPct, hov, canMoveUp, canMoveDown,
  dragAttributes, dragListeners, onSetAlign, onSetBg, onMoveUp, onMoveDown, onDuplicate,
}: Props) {
  const [showBg, setShowBg] = useState(false);

  return (
    <div
      {...dragAttributes}
      {...dragListeners}
      title="Тягніть за хедер, щоб перемістити блок"
      style={{
        display: "flex", alignItems: "center", gap: "5px", padding: "7px 10px 7px 6px",
        background: hov ? "#1C3A2E" : "#F7F4EE",
        borderBottomWidth: "1px", borderBottomStyle: "solid",
        borderBottomColor: hov ? "rgba(212,168,67,0.3)" : "#E8D5B7",
        borderRadius: "12px 12px 0 0",
        transition: "all 0.15s", flexWrap: "nowrap", whiteSpace: "nowrap",
        cursor: "grab",
        userSelect: "none", touchAction: "none",
      }}
    >
      {/* Візуальний grip-хінт (не окремий handle — весь хедер draggable) */}
      <div
        style={{
          display: "inline-flex", alignItems: "center", gap: "4px",
          padding: "3px 6px", borderRadius: "5px",
          background: hov ? "rgba(212,168,67,0.18)" : "rgba(28,58,46,0.06)",
          color: hov ? "#D4A843" : "#1C3A2E",
          pointerEvents: "none",
          transition: "background 0.15s",
        }}
      >
        <svg width="10" height="14" viewBox="0 0 10 14" fill="none" style={{ flexShrink: 0 }}>
          <circle cx="2.5" cy="2" r="1.3" fill="currentColor" />
          <circle cx="7.5" cy="2" r="1.3" fill="currentColor" />
          <circle cx="2.5" cy="7" r="1.3" fill="currentColor" />
          <circle cx="7.5" cy="7" r="1.3" fill="currentColor" />
          <circle cx="2.5" cy="12" r="1.3" fill="currentColor" />
          <circle cx="7.5" cy="12" r="1.3" fill="currentColor" />
        </svg>
      </div>

      {/* Block label */}
      <span style={{ fontSize: "10px", fontWeight: 700, color: hov ? "#D4A843" : "#1C3A2E", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: ff }}>
        {ICONS[blockType]} {LABELS[blockType]}
      </span>

      <Sep hov={hov} />

      {/* Align */}
      <div style={{ display: "flex", gap: "2px" }}>
        {(["left", "center", "right"] as BlockAlign[]).map((a, i) => (
          <TBtn key={a} active={blockAlign === a} onClick={() => onSetAlign(blockId, a)} title={a}>
            {["←", "↔", "→"][i]}
          </TBtn>
        ))}
      </div>

      <Sep hov={hov} />

      {/* Background color */}
      <div style={{ position: "relative" }}>
        <button
          onClick={() => setShowBg(v => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            padding: "3px 8px",
            borderRadius: "5px",
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: hov ? "rgba(255,255,255,0.2)" : "#E8D5B7",
            background: hov ? "rgba(255,255,255,0.08)" : "#EEEAE2",
            cursor: "pointer",
            fontFamily: ff,
            fontSize: "10px",
            fontWeight: 600,
            color: hov ? "#FAF6F0" : "#1C3A2E",
            transition: "all 0.12s",
          }}
        >
          <div style={{
            width: "12px",
            height: "12px",
            borderRadius: "3px",
            background: blockBgColor || "#fff",
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: "#D4A843",
            flexShrink: 0,
          }} />
          {"Фон"}
        </button>

        {showBg && (
          <div style={{
            position: "absolute",
            top: "30px",
            left: 0,
            zIndex: 999,
            background: "#fff",
            borderRadius: "12px",
            padding: "12px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: "#E8D5B7",
            minWidth: "200px",
          }}>
            <div style={{ fontSize: "10px", fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: ff, marginBottom: "10px" }}>
              {"Колір фону блоку"}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {UIMP_COLORS.map(c => (
                <div key={c.value} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
                  <button
                    title={c.label}
                    onClick={() => { onSetBg(blockId, c.value); setShowBg(false); }}
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "7px",
                      borderWidth: "2px",
                      borderStyle: "solid",
                      borderColor: blockBgColor === c.value ? "#D4A843" : "#E8D5B7",
                      background: c.value || "#F9F9F9",
                      cursor: "pointer",
                      boxShadow: blockBgColor === c.value ? "0 0 0 2px rgba(212,168,67,0.3)" : "none",
                      transition: "all 0.12s",
                    }}
                  />
                  <span style={{ fontSize: "8px", color: "#9CA3AF", fontFamily: ff, textAlign: "center", maxWidth: "36px", lineHeight: 1.2 }}>
                    {c.label.split(" ")[0]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Width % */}
      <div style={{ marginLeft: "auto", fontSize: "10px", fontWeight: 700, color: hov ? "rgba(255,255,255,0.5)" : "#9CA3AF", fontFamily: ff, minWidth: "32px", textAlign: "right" }}>
        {displayPct}%
      </div>

      {/* Crop — тільки для image */}
      {blockType === "image" && (
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("news-block-crop", { detail: blockId }))}
          title="Обрізати фото"
          style={{
            display: "inline-flex", alignItems: "center", gap: "4px",
            padding: "3px 8px", borderRadius: "5px",
            border: "none", cursor: "pointer",
            fontSize: "11px", fontWeight: 700, fontFamily: ff,
            background: hov ? "rgba(212,168,67,0.18)" : "#EEEAE2",
            color: hov ? "#D4A843" : "#1C3A2E",
            transition: "all 0.12s",
          }}
        >{"✂️ Обрізати"}</button>
      )}

      {/* Duplicate */}
      <button
        onClick={() => onDuplicate(blockId)}
        title="Дублювати блок"
        style={{ background: "none", border: "none", cursor: "pointer", color: hov ? "rgba(255,255,255,0.6)" : "#6B7280", fontSize: "13px", padding: "2px 4px", fontWeight: 700 }}
      >{"⎘"}</button>

    </div>
  );
}
