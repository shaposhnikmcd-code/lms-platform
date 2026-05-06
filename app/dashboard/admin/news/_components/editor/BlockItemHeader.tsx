"use client";

import React, { useState } from "react";
import { BlockAlign, BlockVAlign, UIMP_COLORS } from "./types";
import { requestCrop } from "./blocks/ImageEditor";

const ff = "-apple-system, BlinkMacSystemFont, sans-serif";

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
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

const Section: React.FC<{ children: React.ReactNode; padTop?: number }> = ({ children, padTop = 6 }) => (
  <div style={{ padding: `${padTop}px 10px 6px` }}>{children}</div>
);

interface Props {
  blockId: string;
  blockType: string;
  blockAlign: BlockAlign;
  blockVAlign: BlockVAlign;
  blockBgColor: string;
  displayPct: number;
  hov: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  dragAttributes: React.HTMLAttributes<HTMLElement>;
  dragListeners: React.HTMLAttributes<HTMLElement> | undefined;
  onSetAlign: (id: string, a: BlockAlign) => void;
  onSetVAlign: (id: string, v: BlockVAlign) => void;
  onSetBg: (id: string, c: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onDuplicate: (id: string) => void;
}

const LABELS: Record<string, string> = { text: "Текст", heading: "Заголовок", image: "Фото", youtube: "YouTube", quote: "Цитата", divider: "Роздільник", card: "Картка" };
const ICONS: Record<string, string> = { text: "¶", heading: "H", image: "🖼", youtube: "▶", quote: "❝", divider: "—", card: "▦" };

const ALIGN_GLYPHS: Record<BlockAlign, React.ReactElement> = {
  left: (
    <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
      <rect x="0" y="0" width="14" height="1.6" rx="0.8" fill="currentColor" />
      <rect x="0" y="4.2" width="9" height="1.6" rx="0.8" fill="currentColor" />
      <rect x="0" y="8.4" width="11" height="1.6" rx="0.8" fill="currentColor" />
    </svg>
  ),
  center: (
    <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
      <rect x="0" y="0" width="14" height="1.6" rx="0.8" fill="currentColor" />
      <rect x="2.5" y="4.2" width="9" height="1.6" rx="0.8" fill="currentColor" />
      <rect x="1.5" y="8.4" width="11" height="1.6" rx="0.8" fill="currentColor" />
    </svg>
  ),
  right: (
    <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
      <rect x="0" y="0" width="14" height="1.6" rx="0.8" fill="currentColor" />
      <rect x="5" y="4.2" width="9" height="1.6" rx="0.8" fill="currentColor" />
      <rect x="3" y="8.4" width="11" height="1.6" rx="0.8" fill="currentColor" />
    </svg>
  ),
};

// Гліфи для вертикального вирівнювання — три горизонтальні смужки на висоті 14px,
// що показують positioning тексту в колонці (top / center / bottom).
const VALIGN_GLYPHS: Record<BlockVAlign, React.ReactElement> = {
  top: (
    <svg width="10" height="14" viewBox="0 0 10 14" fill="none">
      <rect x="0" y="0" width="10" height="1.6" rx="0.8" fill="currentColor" />
      <rect x="2" y="2.6" width="6" height="1.6" rx="0.8" fill="currentColor" />
    </svg>
  ),
  center: (
    <svg width="10" height="14" viewBox="0 0 10 14" fill="none">
      <rect x="0" y="5.2" width="10" height="1.6" rx="0.8" fill="currentColor" />
      <rect x="2" y="7.8" width="6" height="1.6" rx="0.8" fill="currentColor" />
    </svg>
  ),
  bottom: (
    <svg width="10" height="14" viewBox="0 0 10 14" fill="none">
      <rect x="2" y="10.4" width="6" height="1.6" rx="0.8" fill="currentColor" />
      <rect x="0" y="13" width="10" height="1.6" rx="0.8" fill="currentColor" />
    </svg>
  ),
};

function AlignBtn({ a, active, onClick }: { a: BlockAlign; active: boolean; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      type="button"
      title={a === "left" ? "Ліворуч" : a === "right" ? "Праворуч" : "По центру"}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        flex: 1,
        height: "22px",
        borderRadius: "5px",
        border: `1px solid ${active ? "#D4A843" : "#E8D5B7"}`,
        background: active ? "#1C3A2E" : hov ? "#FAF6F0" : "#FFFFFF",
        color: active ? "#D4A843" : "#1C3A2E",
        cursor: "pointer",
        padding: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.12s",
      }}
    >{ALIGN_GLYPHS[a]}</button>
  );
}

function VAlignBtn({ v, active, onClick }: { v: BlockVAlign; active: boolean; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      type="button"
      title={v === "top" ? "По верхньому краю" : v === "bottom" ? "По нижньому краю" : "По центру (вертикально)"}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        flex: 1,
        height: "22px",
        borderRadius: "5px",
        border: `1px solid ${active ? "#D4A843" : "#E8D5B7"}`,
        background: active ? "#1C3A2E" : hov ? "#FAF6F0" : "#FFFFFF",
        color: active ? "#D4A843" : "#1C3A2E",
        cursor: "pointer",
        padding: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.12s",
      }}
    >{VALIGN_GLYPHS[v]}</button>
  );
}

function ActionBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: "22px",
        height: "22px",
        borderRadius: "5px",
        border: `1px solid ${hov ? "#D4A843" : "transparent"}`,
        background: hov ? "rgba(212,168,67,0.10)" : "transparent",
        color: hov ? "#9B7C45" : "#6B7280",
        cursor: "pointer",
        padding: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "12px",
        transition: "all 0.12s",
      }}
    >{children}</button>
  );
}

export default function BlockItemHeader({
  blockId, blockType, blockAlign, blockVAlign, blockBgColor, displayPct,
  onSetAlign, onSetVAlign, onSetBg, onDuplicate,
}: Props) {
  // Прозорий "Без фону" варіант + UIMP кольори. Для divider align не має сенсу — приховаємо.
  const showAlign = blockType !== "divider";
  // Вертикальне вирівнювання має сенс тільки коли блок має фіксовану висоту і простір
  // зверху/знизу від тексту — поки що тільки для heading.
  const showVAlign = blockType === "heading";
  const showBg = blockType !== "divider";

  return (
    <div style={{ background: "#FFFFFF", fontFamily: ff }}>
      {/* Block info strip — компактний рядок з типом блока, шириною та діями */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "7px",
        padding: "5px 10px",
        background: "#FAF6F0",
      }}>
        <div style={{
          width: "20px",
          height: "20px",
          borderRadius: "5px",
          background: "#1C3A2E",
          color: "#D4A843",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: blockType === "image" ? "10px" : "11px",
          fontWeight: 700,
          flexShrink: 0,
        }}>{ICONS[blockType]}</div>

        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "baseline", gap: "6px" }}>
          <span style={{
            fontSize: "11px",
            fontWeight: 700,
            color: "#1C3A2E",
            lineHeight: 1.1,
          }}>{LABELS[blockType]}</span>
          <span style={{
            fontSize: "10px",
            color: "#9CA3AF",
            lineHeight: 1,
          }}>{`${displayPct}%`}</span>
        </div>

        {blockType === "image" && (
          <ActionBtn
            title="Обрізати фото"
            onClick={() => requestCrop(blockId)}
          >✂</ActionBtn>
        )}
        <ActionBtn title="Дублювати блок" onClick={() => onDuplicate(blockId)}>⎘</ActionBtn>
      </div>

      {showAlign && (
        <Section>
          <SectionLabel>Вирівнювання</SectionLabel>
          <div style={{ display: "flex", gap: "5px" }}>
            {(["left", "center", "right"] as BlockAlign[]).map(a => (
              <AlignBtn key={a} a={a} active={blockAlign === a} onClick={() => onSetAlign(blockId, a)} />
            ))}
          </div>
        </Section>
      )}

      {showVAlign && (
        <Section padTop={0}>
          <SectionLabel>Вертикаль</SectionLabel>
          <div style={{ display: "flex", gap: "5px" }}>
            {(["top", "center", "bottom"] as BlockVAlign[]).map(v => (
              <VAlignBtn key={v} v={v} active={blockVAlign === v} onClick={() => onSetVAlign(blockId, v)} />
            ))}
          </div>
        </Section>
      )}

      {showBg && (
        <Section padTop={0}>
          <SectionLabel>Фон блока</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
            <button
              type="button"
              title="Без фону"
              onClick={() => onSetBg(blockId, "")}
              style={{
                width: "20px",
                height: "20px",
                borderRadius: "5px",
                border: `2px solid ${!blockBgColor ? "#D4A843" : "#E8D5B7"}`,
                background: "repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%) 50% / 6px 6px",
                cursor: "pointer",
                padding: 0,
                boxShadow: !blockBgColor ? "0 0 0 2px rgba(212,168,67,0.25)" : "none",
              }}
            />
            {UIMP_COLORS.map(c => {
              if (!c.value) return null;
              const active = (blockBgColor || "").toUpperCase() === c.value.toUpperCase();
              return (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  onClick={() => onSetBg(blockId, c.value)}
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "5px",
                    border: `2px solid ${active ? "#D4A843" : "#E8D5B7"}`,
                    background: c.value,
                    cursor: "pointer",
                    padding: 0,
                    boxShadow: active ? "0 0 0 2px rgba(212,168,67,0.25)" : "none",
                  }}
                />
              );
            })}
          </div>
        </Section>
      )}
    </div>
  );
}
