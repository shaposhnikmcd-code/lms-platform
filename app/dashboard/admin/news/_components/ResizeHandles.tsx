"use client";

import { useRef, useCallback } from "react";
import { Block } from "./types";

interface Props {
  block: Block;
  isSelected: boolean;
  onResize: (w: number, h?: number) => void;
}

export default function ResizeHandles({ block, isSelected, onResize }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  const startDrag = useCallback((e: React.MouseEvent, dir: "e" | "s" | "se") => {
    e.preventDefault();
    e.stopPropagation();

    const parent = containerRef.current?.parentElement;
    if (!parent) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const startPxW = parent.offsetWidth;
    const startPxH = parent.offsetHeight;
    const startH = block.height || startPxH;
    const row = parent.closest(".resize-row") as HTMLElement;
    const rowW = row?.offsetWidth || 800;

    const onMove = (me: MouseEvent) => {
      const dx = me.clientX - startX;
      const dy = me.clientY - startY;
      let newW = block.width;
      let newH = startH;

      if (dir === "e" || dir === "se") {
        const newPxW = Math.max(80, startPxW + dx);
        newW = Math.max(10, Math.min(100, Math.round((newPxW / rowW) * 100 / 5) * 5));
      }
      if (dir === "s" || dir === "se") {
        newH = Math.max(40, Math.round((startH + dy) / 10) * 10);
      }

      if (dir === "e") onResize(newW, block.height);
      else if (dir === "s") onResize(block.width, newH);
      else onResize(newW, newH);
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [block, onResize]);

  if (!isSelected) return null;

  return (
    <div ref={containerRef} style={{ pointerEvents: "none" }}>
      {/* Права ручка — ширина */}
      <div
        onMouseDown={e => startDrag(e, "e")}
        style={{
          position: "absolute",
          right: "-5px",
          top: "50%",
          transform: "translateY(-50%)",
          width: "10px",
          height: "32px",
          background: "#1C3A2E",
          borderRadius: "0 4px 4px 0",
          cursor: "ew-resize",
          zIndex: 30,
          pointerEvents: "all",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ width: "2px", height: "16px", background: "rgba(255,255,255,0.6)", borderRadius: "1px" }} />
      </div>

      {/* Нижня ручка — висота */}
      <div
        onMouseDown={e => startDrag(e, "s")}
        style={{
          position: "absolute",
          bottom: "-5px",
          left: "50%",
          transform: "translateX(-50%)",
          height: "10px",
          width: "32px",
          background: "#1C3A2E",
          borderRadius: "0 0 4px 4px",
          cursor: "ns-resize",
          zIndex: 30,
          pointerEvents: "all",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ height: "2px", width: "16px", background: "rgba(255,255,255,0.6)", borderRadius: "1px" }} />
      </div>

      {/* Діагональна ручка */}
      <div
        onMouseDown={e => startDrag(e, "se")}
        style={{
          position: "absolute",
          bottom: "-5px",
          right: "-5px",
          width: "14px",
          height: "14px",
          background: "#1C3A2E",
          borderRadius: "0 0 4px 0",
          cursor: "nwse-resize",
          zIndex: 31,
          pointerEvents: "all",
        }}
      />
    </div>
  );
}