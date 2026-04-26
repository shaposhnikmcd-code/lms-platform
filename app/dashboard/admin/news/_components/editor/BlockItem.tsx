"use client";

import React, { useState } from "react";
import { Block, BlockAlign, BlockWidth } from "./types";
import TextEditor from "./blocks/TextEditor";
import HeadingEditor from "./blocks/HeadingEditor";
import ImageEditor from "./blocks/ImageEditor";
import YoutubeEditor from "./blocks/YoutubeEditor";
import QuoteEditor from "./blocks/QuoteEditor";
import CardEditor from "./blocks/CardEditor";
import BlockItemHeader from "./BlockItemHeader";
import BlockItemSnapGuide from "./BlockItemSnapGuide";
import { useBlockResize } from "./hooks/useBlockResize";

interface Props {
  block: Block;
  index: number;
  selected?: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  dragAttributes: React.HTMLAttributes<HTMLElement>;
  dragListeners: React.HTMLAttributes<HTMLElement> | undefined;
  onChange: (id: string, data: Record<string, string>) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onDuplicate: (id: string) => void;
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
  block, index, selected = false, canMoveUp, canMoveDown,
  dragAttributes, dragListeners,
  onChange, onMoveUp, onMoveDown, onDuplicate,
  onSetWidth, onSetWidthAndData, onSetAlign, onSetBg,
  onUpload, containerWidthPx, onPreviewWidth, onClearPreview,
  onPreviewHeight, onClearPreviewHeight, previewHeight,
  onReportHeight, getSameRowHeights, snapThreshold,
}: Props) {
  void index;
  const [hov, setHov] = useState(false);
  const hovOffTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const setHoverWithDelay = (next: boolean) => {
    if (next) {
      if (hovOffTimerRef.current) { clearTimeout(hovOffTimerRef.current); hovOffTimerRef.current = null; }
      setHov(true);
    } else {
      // Невелика затримка перед приховуванням, щоб користувач встиг дотягтись
      // до floating header-а над блоком (інакше при mouse-up до header блок
      // "тікає" і header зникає).
      if (hovOffTimerRef.current) clearTimeout(hovOffTimerRef.current);
      hovOffTimerRef.current = setTimeout(() => setHov(false), 250);
    }
  };

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
  const aspectBroken = isImage && hasAspect && aspectMatched === false;
  const aspectOk = isImage && hasAspect && aspectMatched === true && minHeight > 0;
  const outlineColor = aspectBroken
    ? "#EF4444"
    : (isSnapping || resizingW || resizingH || resizingD || aspectOk)
      ? "#D4A843"
      : hov ? "#D4A843" : "rgba(232,213,183,0.6)";  // тонка рамка завжди видна

  // Принципово: контент тепер ЗАЙМАЄ всю площу wrapper-а. Жодних border/padding у потоці —
  // тільки outline (поза розмірами) та плаваючий header (absolute поверх wrapper-а зі від'ємним top).
  // Це гарантує, що block.width × block.height у білдері = блок на public з тими самими розмірами.

  // Drag-від-будь-куди: оборачуємо dragListeners, щоб НЕ перехоплювати pointer-down коли
  // юзер взаємодіє з input / textarea / button / contenteditable / resize handle —
  // інакше зламаємо редагування тексту, кнопки тулбару, ресайзи.
  const wrappedDragListeners: React.HTMLAttributes<HTMLElement> = React.useMemo(() => {
    if (!dragListeners) return {};
    const out: Record<string, (e: React.SyntheticEvent) => void> = {};
    for (const k in dragListeners) {
      const fn = (dragListeners as unknown as Record<string, (e: React.SyntheticEvent) => void>)[k];
      out[k] = (e) => {
        const t = e.target as HTMLElement;
        if (t.closest("input, textarea, select, button, [contenteditable=\"true\"], [data-no-block-drag]")) return;
        fn(e);
      };
    }
    return out as React.HTMLAttributes<HTMLElement>;
  }, [dragListeners]);

  return (
    <div
      style={{ width: "100%", height: "100%", position: "relative", cursor: hov ? "grab" : "default" }}
      ref={node => { blockRef.current = node; }}
      onMouseEnter={() => setHoverWithDelay(true)}
      onMouseLeave={() => setHoverWithDelay(false)}
      {...dragAttributes}
      {...wrappedDragListeners}
    >
      {/* Floating header — над блоком, не впливає на розміри.
          paddingBottom: 8 створює "hover bridge" вниз до блока — щоб курсор
          у проміжку не покидав hover-зону. Має свої mouseEnter/Leave. */}
      {(hov || selected) && (
        <div
          onMouseEnter={() => setHoverWithDelay(true)}
          onMouseLeave={() => setHoverWithDelay(false)}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: "100%",
            paddingBottom: "8px",
            zIndex: 20,
            pointerEvents: "auto",
          }}
        >
          <BlockItemHeader
            blockId={block.id}
            blockType={block.type}
            blockAlign={block.align}
            blockBgColor={block.bgColor}
            displayPct={displayPct}
            hov={true}
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
            dragAttributes={dragAttributes}
            dragListeners={dragListeners}
            onSetAlign={onSetAlign}
            onSetBg={onSetBg}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            onDuplicate={onDuplicate}
          />
        </div>
      )}

      {/* Wrapper.
          - background: bgColor (як на public)
          - outline: golden коли hover/snap (поза розмірами, не впливає на layout)
          - padding 0 16px → залишаємо тільки horizontal "поле", щоб контент не торкався країв
            (на public ТАКИЙ САМИЙ padding — тоді content area однакова)
          - position relative для абсолютних дітей */}
      <div
        style={{
          background: block.bgColor || "transparent",
          color: textColor,
          textAlign: block.align,
          outline: `1.5px solid ${outlineColor}`,
          outlineOffset: "0px",
          borderRadius: "8px",
          minHeight: minHeight > 0 ? `${minHeight}px` : undefined,
          height: "100%", // заповнює AbsoluteBlock — щоб візуальні межі блока = block.height
          padding: "0 16px",
          boxSizing: "border-box",
          overflow: "hidden",
          position: "relative",
          transition: resizingW || resizingH || resizingD ? "none" : "outline-color 0.15s",
        }}
      >
        {isSnapping && snapGuideH !== null && (
          <BlockItemSnapGuide snapGuideH={snapGuideH} />
        )}

        {block.type === "text"    && <TextEditor    block={block} onChange={d => onChange(block.id, d)} />}
        {block.type === "heading" && <HeadingEditor block={block} onChange={d => onChange(block.id, d)} />}
        {block.type === "image"   && <ImageEditor   block={block} onChange={d => onChange(block.id, d)} onUpload={onUpload} previewHeight={previewHeight} />}
        {block.type === "youtube" && <YoutubeEditor block={block} onChange={d => onChange(block.id, d)} />}
        {block.type === "quote"   && <QuoteEditor   block={block} onChange={d => onChange(block.id, d)} />}
        {block.type === "card"    && <CardEditor    block={block} onChange={d => onChange(block.id, d)} onUpload={onUpload} />}
        {block.type === "divider" && <hr style={{ border: "none", borderTopWidth: "2px", borderTopStyle: "solid", borderTopColor: "#D4A843", margin: "8px 0" }} />}
      </div>

      {/* Right resize handle */}
      <div
        data-no-block-drag
        onMouseDown={startResizeWidth}
        style={{ position: "absolute", right: "-6px", top: "20%", bottom: "20%", width: "12px", cursor: "ew-resize", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10, opacity: hov || resizingW ? 1 : 0, transition: "opacity 0.15s" }}
      >
        <div style={{ width: "4px", height: "32px", borderRadius: "4px", background: resizingW ? "#D4A843" : "#1C3A2E", transition: "background 0.15s" }} />
      </div>

      {/* Bottom resize handle */}
      <div
        data-no-block-drag
        onMouseDown={startResizeHeight}
        style={{ position: "absolute", bottom: "-6px", left: "20%", right: "20%", height: "12px", cursor: "ns-resize", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10, opacity: hov || resizingH ? 1 : 0, transition: "opacity 0.15s" }}
      >
        <div style={{ height: "4px", width: "40px", borderRadius: "4px", background: resizingH || isSnapping ? "#D4A843" : "#1C3A2E", transition: "background 0.15s" }} />
      </div>

      {/* Diagonal resize handle */}
      <div
        data-no-block-drag
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
