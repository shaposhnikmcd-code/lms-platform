"use client";

import React, { useState } from "react";
import { BlockAlign, BlockVAlign, UIMP_COLORS } from "./types";
import { requestCrop, requestReplacePhoto } from "./blocks/ImageEditor";
// Section / SectionLabel — ті самі що в OverlayToolbar (Текст на фото).
// Раніше тут були локальні версії з amber-кольором і малим padding-ом — це
// створювало неконсистентність між двома редакторами.
import { Section, SectionLabel, RadiusControl } from "./blocks/_settingsPrimitives";

const ff = "-apple-system, BlinkMacSystemFont, sans-serif";

interface Props {
  blockId: string;
  blockType: string;
  blockAlign: BlockAlign;
  blockVAlign: BlockVAlign;
  blockBgColor: string;
  /** Радіус підкладки блока (undefined = default 8 при bgColor / 0 без). */
  blockBorderRadius?: number;
  displayPct: number;
  hov: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  dragAttributes: React.HTMLAttributes<HTMLElement>;
  dragListeners: React.HTMLAttributes<HTMLElement> | undefined;
  onSetAlign: (id: string, a: BlockAlign) => void;
  onSetVAlign: (id: string, v: BlockVAlign) => void;
  onSetBg: (id: string, c: string) => void;
  onSetBorderRadius: (id: string, v: number | undefined) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onDuplicate: (id: string) => void;
  /** Опціональний content-snippet для другого рядка info-strip-а. Передається з
   *  BlockItem-а (наприклад, для heading/text/quote — перші 30 символів тексту;
   *  для image — alt; для youtube — URL). Якщо не задано — fallback на ширину%. */
  blockSubtitle?: string;
  /** Template-mode: ховаємо контент-стайлинг (Фон блока / Форма підкладки),
   *  бо ці властивості задаються при створенні новини з шаблону, а не у шаблоні. */
  templateMode?: boolean;
  /** Layout lock: ховаємо кнопку «Дублювати» — нові блоки не дозволяємо
   *  створювати у content-fill режимі. */
  lockLayout?: boolean;
  /** Per-corner маска "TL TR BR BL" (4-char 1/0). Дефолт "1111" — всі 4 кути.
   *  Зберігається у block.data.borderRadiusCorners. */
  borderRadiusCorners?: string;
  onSetBorderRadiusCorners?: (corners: string) => void;
}

const LABELS: Record<string, string> = { text: "Текст", heading: "Заголовок", image: "Фото", youtube: "YouTube", quote: "Цитата", divider: "Роздільник", card: "Картка" };
const ICONS: Record<string, string> = { text: "¶", heading: "H", image: "🖼", youtube: "▶", quote: "❝", divider: "—", card: "▦" };

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
  blockId, blockType, blockAlign, blockVAlign, blockBgColor, blockBorderRadius, displayPct,
  onSetAlign, onSetVAlign, onSetBg, onSetBorderRadius, onDuplicate,
  blockSubtitle, templateMode = false, lockLayout = false,
  borderRadiusCorners, onSetBorderRadiusCorners,
}: Props) {
  // "Розміщення блока" прибрано з шапки (рішення 2026-05-14) — дублювало
  // text-align з панелі. onSetAlign залишається в props (caller-cascade), просто
  // не викликається тут.
  void onSetAlign;
  const showVAlign = false;
  // У template-режимі ховаємо стайлинг (Фон / Форма підкладки) — це не шаблонні
  // властивості, а контент-styling, який задається у конкретній новині.
  // Для templateInstance (новина з шаблону на сторінці /news) також ховаємо —
  // блок є read-only widget, контент-styling задається в адмінці новин, а не тут.
  const showBg = !templateMode && blockType !== "divider" && blockType !== "templateInstance";

  // Subtitle для другого рядка info-strip-а: контент-snippet (з blockSubtitle)
  // або ширина% як fallback. Для порожнього text-block-а — "(порожньо)".
  const subtitle = blockSubtitle !== undefined && blockSubtitle !== ""
    ? blockSubtitle
    : blockSubtitle === ""
      ? "(порожньо)"
      : `${displayPct}%`;

  return (
    <div style={{ background: "#FFFFFF", fontFamily: ff }}>
      {/* Block info-strip — overlay-style design (дзеркало OverlayToolbar з ImageEditor):
          amber icon-square 22×22 + 2-line layout (тип блока + content-preview). */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "7px 12px",
        background: "#FAF6F0",
      }}>
        <div style={{
          width: "22px",
          height: "22px",
          borderRadius: "6px",
          background: "#D4A843",
          color: "#1C3A2E",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: blockType === "image" ? "12px" : "11px",
          fontWeight: 800,
          flexShrink: 0,
        }}>{ICONS[blockType]}</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: "11px",
            fontWeight: 700,
            color: "#1C3A2E",
            lineHeight: 1.1,
          }}>{LABELS[blockType]}</div>
          <div style={{
            fontSize: "10px",
            color: "#9CA3AF",
            marginTop: "2px",
            lineHeight: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>{subtitle}</div>
        </div>

        {blockType === "image" && (
          <ActionBtn
            title="Замінити фото"
            onClick={() => requestReplacePhoto(blockId)}
          >🔄</ActionBtn>
        )}
        {blockType === "image" && (
          <ActionBtn
            title="Обрізати фото"
            onClick={() => requestCrop(blockId)}
          >✂</ActionBtn>
        )}
        {!lockLayout && (
          <ActionBtn title="Дублювати блок" onClick={() => onDuplicate(blockId)}>⎘</ActionBtn>
        )}
      </div>

      {showVAlign && (
        <Section padTop={6}>
          <SectionLabel>Вертикаль тексту</SectionLabel>
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
            {/* Свій колір — нативний color-picker. Активний коли поточний bg не
                збігається з жодним preset-ом і не порожній. Клік відкриває
                системну палітру; зміна — миттєвий setBg. */}
            {(() => {
              const v = (blockBgColor || "").toUpperCase();
              const isCustom = !!v && !UIMP_COLORS.some(c => c.value?.toUpperCase() === v);
              return (
                <label
                  title="Свій колір"
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "5px",
                    border: `2px solid ${isCustom ? "#D4A843" : "#E8D5B7"}`,
                    background: isCustom
                      ? blockBgColor
                      : "conic-gradient(from 180deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)",
                    cursor: "pointer",
                    padding: 0,
                    boxShadow: isCustom ? "0 0 0 2px rgba(212,168,67,0.25)" : "none",
                    position: "relative",
                    overflow: "hidden",
                    display: "block",
                  }}
                >
                  <input
                    type="color"
                    value={isCustom ? (blockBgColor || "#FFFFFF") : "#FFFFFF"}
                    onChange={(e) => onSetBg(blockId, e.target.value)}
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      opacity: 0,
                      cursor: "pointer",
                      border: "none",
                      padding: 0,
                    }}
                  />
                </label>
              );
            })()}
          </div>
        </Section>
      )}

      {showBg && (
        <Section padTop={0}>
          <SectionLabel>Форма підкладки</SectionLabel>
          <RadiusControl
            current={blockBorderRadius ?? (blockBgColor ? 8 : 0)}
            onChange={(v) => onSetBorderRadius(blockId, v)}
          />
          {/* Per-corner toggle: вибір яких саме кутів стосується радіус.
              4 кружечки на міні-прямокутнику; клік перемикає окремий кут. */}
          {onSetBorderRadiusCorners && (() => {
            const raw = (borderRadiusCorners || "1111").padEnd(4, "1");
            const c = { tl: raw[0] === "1", tr: raw[1] === "1", br: raw[2] === "1", bl: raw[3] === "1" };
            const set = (k: "tl" | "tr" | "br" | "bl", v: boolean) => {
              const n = { ...c, [k]: v };
              onSetBorderRadiusCorners(
                (n.tl ? "1" : "0") + (n.tr ? "1" : "0") + (n.br ? "1" : "0") + (n.bl ? "1" : "0"),
              );
            };
            const circle = (k: "tl" | "tr" | "br" | "bl", pos: React.CSSProperties, title: string) => (
              <button
                key={k}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); set(k, !c[k]); }}
                title={title}
                style={{
                  position: "absolute",
                  width: 18, height: 18, borderRadius: "50%",
                  border: `2px solid ${c[k] ? "#D4A843" : "#9CA3AF"}`,
                  background: c[k] ? "#D4A843" : "#FFFFFF",
                  cursor: "pointer",
                  padding: 0,
                  zIndex: 2,
                  ...pos,
                }}
              />
            );
            return (
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10 }}>
                <div style={{ position: "relative", width: 98, height: 62, flexShrink: 0 }}>
                  <div style={{
                    position: "absolute", top: 9, left: 9,
                    width: 80, height: 44,
                    border: "1px solid #E5DCC7",
                    borderRadius: 6,
                    background: "#FAF6F0",
                  }} />
                  {circle("tl", { top: 0, left: 0 }, "Лівий верхній кут")}
                  {circle("tr", { top: 0, right: 0 }, "Правий верхній кут")}
                  {circle("br", { bottom: 0, right: 0 }, "Правий нижній кут")}
                  {circle("bl", { bottom: 0, left: 0 }, "Лівий нижній кут")}
                </div>
                <div style={{ fontSize: 10, color: "#6B7280", lineHeight: 1.4 }}>
                  Клікни кружок щоб увімкнути або вимкнути заокруглення для конкретного кута.
                </div>
              </div>
            );
          })()}
        </Section>
      )}
    </div>
  );
}
