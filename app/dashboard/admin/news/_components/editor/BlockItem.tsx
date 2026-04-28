"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
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
  onSetWidthAndData: (id: string, w: BlockWidth, data: Record<string, string>, height?: number) => void;
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
  /** Опційний колбек: дозволяє вкладеним редакторам (ImageEditor → overlay click)
   *  виділити батьківський блок. Використовується щоб при кліку на overlay-текст
   *  слот налаштувань відкривався (бо BlockItemHeader портал-иться лише коли
   *  parent block selected). */
  onSelectBlock?: (id: string) => void;
}

export default function BlockItem({
  block, index, selected = false, canMoveUp, canMoveDown,
  dragAttributes, dragListeners,
  onChange, onMoveUp, onMoveDown, onDuplicate,
  onSetWidth, onSetWidthAndData, onSetAlign, onSetBg,
  onUpload, containerWidthPx, onPreviewWidth, onClearPreview,
  onPreviewHeight, onClearPreviewHeight, previewHeight,
  onReportHeight, getSameRowHeights, snapThreshold,
  onSelectBlock,
}: Props) {
  // Чи активний зараз вкладений overlay (для image-блоків з тестом-на-фото).
  // Коли true — приховуємо BlockItemHeader, у slot видно лише overlay-toolbar.
  const [overlayActive, setOverlayActive] = React.useState(false);
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
    hasAspect,
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

  // Auto-bump висоти для legacy YouTube блоків — драфти, збережені до того,
  // як CSP пускала iframe, могли мати висоту 40px (тільки input). Гарантуємо мінімум.
  React.useEffect(() => {
    if (block.type !== "youtube") return;
    const MIN_YT_H = 360;
    if (!block.height || block.height < 200) {
      onSetWidthAndData(block.id, block.width, block.data, MIN_YT_H);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block.type, block.id]);

  // Авто-висота для нового фото: коли aspectRatio змінився (новий upload),
  // синхронізуємо block.height з ratio × поточна block.width — щоб фото з самого старту
  // виглядало пропорційно (на public objectFit:fill розтягує під block розмір).
  const lastAspectRef = React.useRef<string>("");
  React.useEffect(() => {
    if (block.type !== "image") return;
    const aspectStr = block.data.aspectRatio || "";
    if (!aspectStr || aspectStr === lastAspectRef.current) return;
    const aspect = parseFloat(aspectStr);
    if (!aspect || aspect <= 0) return;
    lastAspectRef.current = aspectStr;
    if (containerWidthPx <= 0) return;
    const wPct = Number(block.width) || 100;
    const blockPxW = (wPct / 100) * containerWidthPx;
    const imgPxW = Math.max(60, blockPxW - 32); // 16px padding × 2
    const newH = Math.max(60, Math.round(imgPxW / aspect));
    if (!block.height || Math.abs(block.height - newH) > 4) {
      // Очищаємо stale data.minHeight — інакше старий збережений minHeight (з попередніх
      // resize до auto-aspect) перевищує block.height і wrapper "виростає" вище за фото:
      // resize-handle опиняється не на куті, а посередині блока.
      const cleanData = { ...block.data };
      delete cleanData.minHeight;
      onSetWidthAndData(block.id, block.width, cleanData, newH);
    }
  }, [block.type, block.data.aspectRatio, block.width, block.height, block.id, block.data, containerWidthPx, onSetWidthAndData]);

  const isSnapping = snapGuideH !== null;
  const textColor = (block.bgColor === "#1C3A2E" || block.bgColor === "#1a1a1a") ? "#FAF6F0" : "#1C3A2E";
  // Червоний "aspectBroken" індикатор прибрано — auto-aspect resize і так тримає
  // пропорції фото, debug-рамка тільки створювала візуальний шум поверх блока.
  const outlineColor = (isSnapping || resizingW || resizingH || resizingD)
    ? "#D4A843"
    : hov ? "#D4A843" : "rgba(232,213,183,0.6)";

  // Принципово: контент тепер ЗАЙМАЄ всю площу wrapper-а. Жодних border/padding у потоці —
  // тільки outline (поза розмірами) та плаваючий header (absolute поверх wrapper-а зі від'ємним top).
  // Це гарантує, що block.width × block.height у білдері = блок на public з тими самими розмірами.

  // wrappedDragListeners більше не потрібний — drag тепер виключно через persistent
  // ⋮⋮ handle зліва від блока. Тіло блока вільне для click/contenteditable/resize
  // без конфліктів з drag.

  // Header налаштувань блока — render-иться через Portal у ліву sidebar (#news-block-settings-slot),
  // НЕ inline над блоком. Так він не перекриває контент, не вилазить на сусідні блоки,
  // і завжди в одному місці (Figma/Webflow pattern).
  const settingsSlot = typeof document !== "undefined" && selected
    ? document.getElementById("news-block-settings-slot")
    : null;

  return (
    <div
      style={{ width: "100%", height: "100%", position: "relative" }}
      ref={node => { blockRef.current = node; }}
      onMouseEnter={() => setHoverWithDelay(true)}
      onMouseLeave={() => setHoverWithDelay(false)}
    >
      {/* Drag-handle ⋮⋮ — гарантована "ручка" для перетягування блока.
          Без нього text/heading/quote блоки майже неможливо взяти, бо весь
          контент — contenteditable і whole-block drag там пригнічується.
          Handle — звичайний <div> (НЕ button), без contenteditable, тож не
          триггерить NO_DRAG_SELECTOR в AbsoluteBlock — pointerdown bubble-ить
          на wrapper і запускає drag.
          Позиція: ззовні зліва від блока (left: -28), щоб не перекривати контент.
          Видимість: hover/selected, плавне fade. */}
      <div
        title="Перетягнути блок"
        aria-label="Перетягнути блок"
        style={{
          position: "absolute",
          left: -28,
          top: 6,
          width: 22,
          height: 26,
          borderRadius: 6,
          background: "rgba(28,58,46,0.92)",
          color: "#D4A843",
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "-0.5px",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "grab",
          userSelect: "none",
          opacity: hov || selected ? 1 : 0,
          pointerEvents: hov || selected ? "auto" : "none",
          transition: "opacity 0.15s",
          boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
          zIndex: 5,
        }}
      >⋮⋮</div>

      {settingsSlot && !overlayActive && createPortal(
        <BlockItemHeader
          blockId={block.id}
          blockType={block.type}
          blockAlign={block.align}
          blockBgColor={block.bgColor}
          displayPct={displayPct}
          hov={false}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
          dragAttributes={{}}
          dragListeners={undefined}
          onSetAlign={onSetAlign}
          onSetBg={onSetBg}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onDuplicate={onDuplicate}
        />,
        settingsSlot,
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
          // overflow:hidden — щоб контент і toolbar-и НЕ вилазили на сусідні блоки.
          // Контекстні toolbar-и (overlay тексту-на-фото, alt-input) винесені у портал
          // у праву sidebar-панель — див. ImageEditor.tsx + NewsEditor.tsx (slot
          // #news-overlay-toolbar-slot). Так нічого не накладається на канвасі.
          overflow: "hidden",
          position: "relative",
          transition: resizingW || resizingH || resizingD ? "none" : "outline-color 0.15s",
        }}
      >
        {isSnapping && snapGuideH !== null && (
          <BlockItemSnapGuide snapGuideH={snapGuideH} />
        )}

        {block.type === "text"    && <TextEditor    block={block} onChange={d => onChange(block.id, d)} selected={selected} />}
        {block.type === "heading" && <HeadingEditor block={block} onChange={d => onChange(block.id, d)} selected={selected} />}
        {block.type === "image"   && <ImageEditor   block={block} onChange={d => onChange(block.id, d)} onUpload={onUpload} previewHeight={previewHeight} selected={selected} onSelectBlock={onSelectBlock} onOverlayActiveChange={setOverlayActive} />}
        {block.type === "youtube" && <YoutubeEditor block={block} onChange={d => onChange(block.id, d)} selected={selected} />}
        {block.type === "quote"   && <QuoteEditor   block={block} onChange={d => onChange(block.id, d)} selected={selected} />}
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
        title={block.type === "image" && hasAspect ? "Пропорційний resize (aspect фото)" : "Пропорційний resize"}
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
