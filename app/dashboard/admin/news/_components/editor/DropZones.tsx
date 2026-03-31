"use client";

import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { BlockType } from "./types";
import GhostBlock from "./GhostBlock";

const ff = "-apple-system, BlinkMacSystemFont, sans-serif";

export function EmptyDropZone({ isOver, draggingType }: { isOver: boolean; draggingType: BlockType | null }) {
  const { setNodeRef } = useDroppable({ id: "canvas-drop" });

  if (draggingType && isOver) {
    return (
      <div ref={setNodeRef} style={{ padding: "20px 32px 0" }}>
        <GhostBlock type={draggingType} isOver={isOver} />
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={{ padding: "20px 32px 0", display: "flex", alignItems: "flex-start", justifyContent: "center" }}
    >
      <div style={{
        width: "100%",
        padding: "40px 24px",
        borderRadius: "16px",
        borderWidth: "2px",
        borderStyle: "dashed",
        borderColor: isOver ? "#D4A843" : "#C8C0B4",
        background: isOver ? "rgba(212,168,67,0.05)" : "rgba(255,255,255,0.6)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "14px",
        transition: "all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
        transform: isOver ? "scale(1.02)" : "scale(1)",
        boxShadow: isOver ? "0 0 0 4px rgba(212,168,67,0.12)" : "none",
      }}>
        <div style={{
          width: "48px", height: "48px", borderRadius: "12px",
          background: isOver ? "#D4A843" : "rgba(28,58,46,0.07)",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
          transform: isOver ? "rotate(45deg) scale(1.1)" : "rotate(0deg)",
        }}>
          <span style={{ fontSize: "18px", display: "block", transition: "transform 0.2s", transform: isOver ? "rotate(-45deg)" : "none" }}>{"✦"}</span>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: isOver ? "#D4A843" : "#9CA3AF", fontFamily: ff, transition: "color 0.2s" }}>
            {isOver ? "Відпустіть щоб додати" : "Перетягніть блок сюди"}
          </div>
          <div style={{ fontSize: "11px", color: "#B8B0A8", fontFamily: ff, marginTop: "4px" }}>
            {"Оберіть тип зліва і перетягніть"}
          </div>
        </div>
      </div>
    </div>
  );
}

export function FilledDropZone({
  children, isOver, gap, draggingType,
}: {
  children: React.ReactNode;
  isOver: boolean;
  gap: number;
  draggingType: BlockType | null;
}) {
  const { setNodeRef } = useDroppable({ id: "canvas-drop" });

  return (
    <>
      <style>{`
        @keyframes ghost-appear {
          0%   { opacity: 0; transform: scaleY(0.7) translateY(-10px); }
          100% { opacity: 1; transform: scaleY(1) translateY(0); }
        }
      `}</style>
      <div
        ref={setNodeRef}
        style={{
          padding: "0 32px",
          borderRadius: "12px",
          borderWidth: "2px",
          borderStyle: "dashed",
          borderColor: isOver ? "rgba(212,168,67,0.3)" : "transparent",
          background: "transparent",
          transition: "all 0.15s",
        }}
      >
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: `${gap}px`,
          alignItems: "flex-start",
          paddingBottom: "300px",
        }}>
          {children}

          {draggingType && isOver && (
            <div style={{
              width: "100%",
              flexShrink: 0,
              flexGrow: 0,
              animation: "ghost-appear 0.18s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
            }}>
              <GhostBlock type={draggingType} isOver={isOver} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}