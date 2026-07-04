"use client";

import React from "react";
import { PALETTE_BLOCKS } from "./BlockPalette";

const ff = "-apple-system, BlinkMacSystemFont, sans-serif";

interface Props {
  activeId: string | null;
  isOverCanvas: boolean;
  /** Чи ДІЙСНО спрацює drop у поточній позиції (для спецблоків/«Текст на фото» —
   *  тільки над валідним host-ом). Коли over canvas, але invalid — підказка
   *  показує чесний стан «сюди не можна», а не фальшивий «✓». */
  dropValid?: boolean;
  /** Шаблон-режим: «Текст на фото» лягає на порожнє Фото (плейсхолдер), тож
   *  вимога — просто «Фото», без «з картинкою». */
  templateMode?: boolean;
  paletteBlock: typeof PALETTE_BLOCKS[0] | null;
}

export default function OverlayItem({ activeId, isOverCanvas, dropValid = false, templateMode = false, paletteBlock }: Props) {
  if (paletteBlock) {
    // Три стани: (1) поза канвасом — нейтрально, (2) над канвасом і валідно — золото «✓»,
    // (3) над канвасом, але дроп не спрацює (спецблок не над host-ом) — червоне «✗».
    const invalid = isOverCanvas && !dropValid;
    const active = isOverCanvas && dropValid;
    const accent = invalid ? "#C0392B" : "#D4A843";
    // Причина відмови залежить від типу: «Текст на фото» вимагає Фото (у режимі
    // наповнення/сторінки — із завантаженою картинкою); решта спецблоків — Фото
    // або Пустий блок.
    const invalidReason = activeId === "palette:image-overlay"
      ? (templateMode ? "✗ Сюди не можна — потрібне Фото" : "✗ Сюди не можна — потрібне Фото з картинкою")
      : "✗ Сюди не можна — потрібне Фото або Пустий блок";
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
        borderColor: (active || invalid) ? accent : "rgba(212,168,67,0.4)",
        boxShadow: active
          ? "0 16px 48px rgba(0,0,0,0.35), 0 0 0 6px rgba(212,168,67,0.15)"
          : invalid
          ? "0 16px 48px rgba(0,0,0,0.35), 0 0 0 6px rgba(192,57,43,0.18)"
          : "0 8px 24px rgba(0,0,0,0.2)",
        cursor: "grabbing",
        minWidth: "180px",
        transition: "box-shadow 0.15s, border-color 0.15s",
      }}>
        <div style={{
          width: "36px", height: "36px", borderRadius: "9px",
          background: active ? "#D4A843" : invalid ? "rgba(192,57,43,0.2)" : "rgba(212,168,67,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "16px", fontWeight: 700,
          color: active ? "#1C3A2E" : invalid ? "#E8897E" : "#D4A843",
          flexShrink: 0, transition: "all 0.15s",
        }}>
          {paletteBlock.icon}
        </div>
        <div>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "#FAF6F0", fontFamily: ff }}>
            {paletteBlock.label}
          </div>
          <div style={{ fontSize: "11px", fontFamily: ff, marginTop: "2px", transition: "color 0.15s", color: invalid ? "#E8897E" : isOverCanvas ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.3)" }}>
            {invalid
              ? invalidReason
              : active
              ? "Відпустіть щоб додати ✓"
              : "Перетягніть на робочу область"}
          </div>
        </div>
      </div>
    );
  }

  // Для existing-block drag не показуємо overlay-chip — сам блок вже рухається за курсором.
  void activeId;
  return null;
}
