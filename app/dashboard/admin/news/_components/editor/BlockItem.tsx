"use client";

import React, { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Block, BlockAlign, BlockWidth } from "./types";
import TextEditor from "./blocks/TextEditor";
import HeadingEditor from "./blocks/HeadingEditor";
import ImageEditor from "./blocks/ImageEditor";
import YoutubeEditor from "./blocks/YoutubeEditor";
import QuoteEditor from "./blocks/QuoteEditor";
import BlockItemHeader from "./BlockItemHeader";
import BlockItemSnapGuide from "./BlockItemSnapGuide";
import { useBlockResize } from "./hooks/useBlockResize";

interface Props {
  block: Block;
  onChange: (id: string, data: Record<string, string>) => void;
  onDelete: (id: string) => void;
  onSetWidth: (id: string, w: BlockWidth) => void;
  onSetWidthAndData: (id: string, w: BlockWidth, data: Record<string, string>) => void;
  onSetAlign: (id: string, a: BlockAlign) => void;
  onSetBg: (id: string, c: string) => void;
  onUpload: (file: File) => Promise<string>;
  containerWidthPx: number;
  onPreviewWidth: (id: string, pct: number) => void;
  onClearPreview: (id: string) => void;
  onPreviewHeight: (id: string, h: number) => void;
  onClearPreviewHeight: (id: string) => void;
  previewHeight?: number;
  onReportHeight: (id: string, h: number) => void;
  getSameRowHeights: () => number[];
  snapThreshold: number;
}

export default function BlockItem({
  block, onChange, onDelete, onSetWidth, onSetWidthAndData, onSetAlign, onSetBg,
  onUpload, containerWidthPx, onPreviewWidth, onClearPreview,
  onPreviewHeight, onClearPreviewHeight, previewHeight,
  onReportHeight, getSameRowHeights, snapThreshold,
}: Props) {
  const [hov, setHov] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });

  const {
    blockRef, resizingW, resizingH, resizingD,
    displayPct, minHeight, snapGuideH,
    aspectMatched, hasAspect,
    startResizeWidth, startResizeHeight, startResizeDiagonal,
  } = useBlockResize({
    blockId: block.id,
    blockData: block.data,
    blockWidth: block.width,
    containerWidthPx,
    onSetWidth,
    onSetWidthAndData,
    onPreviewWidth,
    onClearPreview,
    onPreviewHeight,
    onClearPreviewHeight,
    onChange,
    onReportHeight,
    getSameRowHeights,
    snapThreshold,
  });

  const isSnapping = snapGuideH !== null;
  const textColor = (block.bgColor === "#1C3A2E" || block.bgColor === "#1a1a1a") ? "#FAF6F0" : "#1C3A2E";
  const isImage = block.type === "image";
  // Червоний контур коли пропорції фото зламані (тільки для image-блоків з відомим aspect)
  const aspectBroken = isImage && hasAspect && aspectMatched === false;
  const aspectOk = isImage && hasAspect && aspectMatched === true && minHeight > 0;
  const borderColor = aspectBroken
    ? "#EF4444"
    : (isSnapping || resizingW || resizingH || resizingD || aspectOk)
      ? "#D4A843"
      : hov ? "#D4A843" : "#E8D5B7";
  const shadow = aspectBroken
    ? "0 0 0 3px rgba(239,68,68,0.2)"
    : isSnapping
      ? "0 0 0 3px rgba(212,168,67,0.2)"
      : hov ? "0 4px 20px rgba(28,58,46,0.1)" : "0 1px 4px rgba(0,0,0,0.04)";

  return (
    <div
      style={{
        transform: CSS.Transform.toString(transform),
        transition: resizingW || resizingH ? "none" : transition,
        opacity: isDragging ? 0.25 : 1,
        width: "100%",
        position: "relative",
      }}
      ref={node => { setNodeRef(node); blockRef.current = node; }}
    >
      <div
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          borderRadius: "12px",
          borderWidth: "1.5px", borderStyle: "solid",
          borderColor,
          background: block.bgColor || "#fff",
          boxShadow: shadow,
          transition: resizingW || resizingH || resizingD ? "none" : "all 0.15s",
          minHeight: minHeight > 0 ? `${minHeight}px` : undefined,
          overflow: "visible",
          position: "relative",
        }}
      >
        {isSnapping && snapGuideH !== null && (
          <BlockItemSnapGuide snapGuideH={snapGuideH} />
        )}

        <BlockItemHeader
          blockId={block.id}
          blockType={block.type}
          blockAlign={block.align}
          blockBgColor={block.bgColor}
          displayPct={displayPct}
          hov={hov}
          dragAttributes={attributes}
          dragListeners={listeners}
          onSetAlign={onSetAlign}
          onSetBg={onSetBg}
          onDelete={onDelete}
        />

        {/* Body */}
        <div style={{ padding: "14px 16px", textAlign: block.align, color: textColor }}>
          {block.type === "text"    && <TextEditor    block={block} onChange={d => onChange(block.id, d)} />}
          {block.type === "heading" && <HeadingEditor block={block} onChange={d => onChange(block.id, d)} />}
          {block.type === "image"   && <ImageEditor   block={block} onChange={d => onChange(block.id, d)} onUpload={onUpload} previewHeight={previewHeight} />}
          {block.type === "youtube" && <YoutubeEditor block={block} onChange={d => onChange(block.id, d)} />}
          {block.type === "quote"   && <QuoteEditor   block={block} onChange={d => onChange(block.id, d)} />}
          {block.type === "divider" && <hr style={{ border: "none", borderTopWidth: "2px", borderTopStyle: "solid", borderTopColor: "#D4A843", margin: "8px 0" }} />}
        </div>
      </div>

      {/* Right resize handle */}
      <div
        onMouseDown={startResizeWidth}
        style={{ position: "absolute", right: "-6px", top: "20%", bottom: "20%", width: "12px", cursor: "ew-resize", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10, opacity: hov || resizingW ? 1 : 0, transition: "opacity 0.15s" }}
      >
        <div style={{ width: "4px", height: "32px", borderRadius: "4px", background: resizingW ? "#D4A843" : "#1C3A2E", transition: "background 0.15s" }} />
      </div>

      {/* Bottom resize handle */}
      <div
        onMouseDown={startResizeHeight}
        style={{ position: "absolute", bottom: "-6px", left: "20%", right: "20%", height: "12px", cursor: "ns-resize", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10, opacity: hov || resizingH ? 1 : 0, transition: "opacity 0.15s" }}
      >
        <div style={{ height: "4px", width: "40px", borderRadius: "4px", background: resizingH || isSnapping ? "#D4A843" : "#1C3A2E", transition: "background 0.15s" }} />
      </div>

      {/* Diagonal resize handle (всі блоки — пропорційний resize) */}
      <div
        onMouseDown={startResizeDiagonal}
        title={isImage && hasAspect ? "Пропорційний resize (aspect фото)" : "Пропорційний resize"}
        style={{
          position: "absolute",
          right: "-8px",
          bottom: "-8px",
          width: "22px",
          height: "22px",
          cursor: "nwse-resize",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "flex-end",
          padding: "2px",
          zIndex: 11,
          opacity: hov || resizingD ? 1 : 0,
          transition: "opacity 0.15s",
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          style={{
            filter: resizingD
              ? "drop-shadow(0 1px 3px rgba(212,168,67,0.5))"
              : "drop-shadow(0 1px 2px rgba(0,0,0,0.25))",
            transition: "filter 0.15s",
          }}
        >
          <path d="M13 1 L13 13 L1 13 Z" fill={resizingD ? "#D4A843" : "#1C3A2E"} />
          <line x1="13" y1="5" x2="5" y2="13" stroke="#fff" strokeWidth="1.2" />
          <line x1="13" y1="9" x2="9" y2="13" stroke="#fff" strokeWidth="1.2" />
        </svg>
      </div>
    </div>
  );
}