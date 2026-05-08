"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Block, BlockAlign, BlockVAlign, BlockWidth } from "./types";
import TextEditor from "./blocks/TextEditor";
import HeadingEditor from "./blocks/HeadingEditor";
import ImageEditor from "./blocks/ImageEditor";
import YoutubeEditor from "./blocks/YoutubeEditor";
import QuoteEditor from "./blocks/QuoteEditor";
import CardEditor from "./blocks/CardEditor";
import NewsCardEditor from "./blocks/NewsCardEditor";
import BlockItemHeader from "./BlockItemHeader";
import BlockItemSnapGuide from "./BlockItemSnapGuide";
import { useBlockResize } from "./hooks/useBlockResize";
import { canvasHeight as innerCanvasHeight, parseBlocks as parseInnerBlocks, PREVIEW_CARD_WIDTH, PREVIEW_CARD_HEIGHT } from "@/lib/news/render";

// Мінімально-корисна висота блока в px по типу. Дзеркало MIN_H_BY_TYPE з
// EditorCanvas (узгоджено з auto-fit для нових блоків з палітри). Без цього
// resize-handle стрибав до жорсткого floor 60, перевищуючи реальний слот блока.
const MIN_BLOCK_HEIGHT_BY_TYPE: Record<string, number> = {
  heading: 24, text: 30, image: 40, youtube: 80,
  quote: 30, divider: 8, card: 80, newsCard: 200,
};

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
  onSetVAlign: (id: string, v: BlockVAlign) => void;
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
  /** Максимально дозволена висота блока в px. У card-builder-і (fixedHeight)
   *  передається `canvasHeight - block.y` — щоб image auto-aspect не виставив
   *  block.height більше за вільне місце і блок не вилазив за нижній край. */
  maxBlockHeight?: number;
}

export default function BlockItem({
  block, index, selected = false, canMoveUp, canMoveDown,
  dragAttributes, dragListeners,
  onChange, onMoveUp, onMoveDown, onDuplicate,
  onSetWidth, onSetWidthAndData, onSetAlign, onSetVAlign, onSetBg,
  onUpload, containerWidthPx, onPreviewWidth, onClearPreview,
  onPreviewHeight, onClearPreviewHeight, previewHeight,
  onReportHeight, getSameRowHeights, snapThreshold,
  onSelectBlock, maxBlockHeight,
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
    maxBlockHeight,
    minBlockHeight: MIN_BLOCK_HEIGHT_BY_TYPE[block.type],
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
    let newH = Math.max(60, Math.round(imgPxW / aspect));
    // У card-builder-і (fixedHeight) обмежуємо auto-aspect висоту вільним
    // місцем у канвасі — інакше високі фото (квадрат/портрет) виставляють
    // block.height більше за canvasHeight і блок візуально вилазить за межі.
    if (typeof maxBlockHeight === "number" && maxBlockHeight > 0) {
      newH = Math.min(newH, Math.max(60, maxBlockHeight));
    }
    if (!block.height || Math.abs(block.height - newH) > 4) {
      // Очищаємо stale data.minHeight — інакше старий збережений minHeight (з попередніх
      // resize до auto-aspect) перевищує block.height і wrapper "виростає" вище за фото:
      // resize-handle опиняється не на куті, а посередині блока.
      const cleanData = { ...block.data };
      delete cleanData.minHeight;
      onSetWidthAndData(block.id, block.width, cleanData, newH);
    }
  }, [block.type, block.data.aspectRatio, block.width, block.height, block.id, block.data, containerWidthPx, onSetWidthAndData, maxBlockHeight]);

  // Авто-висота + ширина для newsCard:
  //   - displayMode="expanded": висота = canvasHeight(news.content), ШИРИНА = 100%
  //     (бо контент новини авторовано на повний canvas; вузький блок змалював би
  //     текст/зображення з overlap-ом і неправильним внутрішнім лейаутом).
  //   - displayMode="preview" з кастомним previewContent: висота = canvasHeight(previewContent)
  //   - displayMode="preview" без previewContent: лишаємо auto-card (висота керується вручну)
  const lastNewsExpandedKeyRef = React.useRef<string>("");
  React.useEffect(() => {
    if (block.type !== "newsCard") return;
    const mode = (block.data.displayMode || "preview") as "preview" | "expanded";
    const newsId = block.data.newsId || "";
    if (!newsId) return;
    if (containerWidthPx <= 0) return;

    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/admin/news/library");
        if (!r.ok) return;
        const list = await r.json() as { id: string; content?: string | null; previewContent?: string | null }[];
        if (!Array.isArray(list)) return;
        const it = list.find(x => x.id === newsId);
        if (!it) return;

        let total = 0;
        let targetWidth = block.width;
        if (mode === "expanded") {
          const parsed = parseInnerBlocks(it.content || "");
          const innerH = parsed.isJson ? innerCanvasHeight(parsed.blocks) : 0;
          total = innerH > 0 ? innerH + 20 : 240;
          // Розгорнута новина має займати повну ширину канвасу — інакше абсолютно
          // позиціоновані внутрішні блоки виглядають криво (контент авторовано на
          // 100% canvas-у). Force-set один раз при переключенні в expanded.
          targetWidth = "100";
        } else {
          // mode === "preview" — нормалізуємо ВСІ preview-блоки до однакового
          // block.width % (відповідає 360 px на канвасі 920 = PREVIEW_CARD_WIDTH/CANVAS_WIDTH).
          // CSS aspect-ratio 360:400 (див. AbsoluteBlock/AbsoluteBlockRender)
          // тримає пропорції автоматично — block.height теж проставляємо для
          // canvasHeight() та коли aspect-ratio не активний.
          const widthPct = Math.round((PREVIEW_CARD_WIDTH / 920) * 1000) / 10; // 39.1
          targetWidth = String(widthPct);
          total = Math.round(PREVIEW_CARD_HEIGHT * (widthPct / 100) * (920 / PREVIEW_CARD_WIDTH)); // ≈400
        }
        if (total === 0) return;

        const widthChanged = targetWidth !== block.width;
        const heightChanged = Math.abs((block.height || 0) - total) > 8;
        const key = `${newsId}|${mode}|${targetWidth}|${total}`;
        if (lastNewsExpandedKeyRef.current === key) return;
        if (cancelled) return;
        lastNewsExpandedKeyRef.current = key;

        if (widthChanged || heightChanged) {
          onSetWidthAndData(block.id, targetWidth, block.data, total);
        }
      } catch {
        /* network/parse fail — лишаємо поточну висоту */
      }
    })();

    return () => { cancelled = true; };
  }, [block.type, block.data.displayMode, block.data.newsId, block.width, block.height, block.id, block.data, containerWidthPx, onSetWidthAndData]);

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
          Позиція: ВСЕРЕДИНІ блока, top-left корнер. Раніше handle був за межами
          (`left:-28`), але в card-builder-і AbsoluteBlock має overflow:hidden
          (для clamp-у image auto-aspect), тож зовнішній handle обрізався і
          ставав невидимим. Зсередини — гарантовано не клипається.
          Видимість: hover/selected, плавне fade. */}
      <div
        title="Перетягнути блок"
        aria-label="Перетягнути блок"
        style={{
          position: "absolute",
          left: 4,
          top: 4,
          width: 22,
          height: 22,
          borderRadius: 6,
          background: "rgba(28,58,46,0.92)",
          color: "#D4A843",
          fontSize: 12,
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
          blockVAlign={block.vAlign || "top"}
          blockBgColor={block.bgColor}
          displayPct={displayPct}
          hov={false}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
          dragAttributes={{}}
          dragListeners={undefined}
          onSetAlign={onSetAlign}
          onSetVAlign={onSetVAlign}
          onSetBg={onSetBg}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onDuplicate={onDuplicate}
          blockSubtitle={(() => {
            // Для text-bearing блоків — snippet тексту (перші ~36 знаків).
            // Дзеркало OverlayToolbar.subtitle (де показується ov.text).
            if (block.type === "heading" || block.type === "text" || block.type === "quote") {
              const html = block.data.html || "";
              const plain = html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
              if (!plain) return ""; // explicit empty → "(порожньо)" у BlockItemHeader
              return plain.length > 36 ? `${plain.slice(0, 36)}…` : plain;
            }
            return undefined; // інші блоки → fallback на displayPct%
          })()}
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
          // newsCard preview зберігає aspect 360:400 на outer AbsoluteBlock через
          // aspect-ratio. Знімаємо 16px горизонтальний padding, щоб card-контент
          // (рендериться через PreviewCardScale 360-wide) точно займав весь outer.
          padding: (block.type === "newsCard" && (block.data.displayMode || "preview") === "preview") ? "0" : "0 16px",
          boxSizing: "border-box",
          // overflow:hidden — щоб контент і toolbar-и НЕ вилазили на сусідні блоки.
          // Контекстні toolbar-и (overlay тексту-на-фото, alt-input) винесені у портал
          // у праву sidebar-панель — див. ImageEditor.tsx + NewsEditor.tsx (slot
          // #news-overlay-toolbar-slot). Так нічого не накладається на канвасі.
          // Виняток: newsCard з displayMode="expanded" АБО з displayMode="preview"+
          // кастомним previewContent — там контент може зрости поза block.height,
          // а auto-resize ефект досі не встиг вирівняти — тому дозволяємо visible,
          // щоб користувач бачив весь контент одразу.
          overflow: (block.type === "newsCard" && (block.data.displayMode === "expanded" || block.data.displayMode === "preview")) ? "visible" : "hidden",
          position: "relative",
          transition: resizingW || resizingH || resizingD ? "none" : "outline-color 0.15s",
        }}
      >
        {isSnapping && snapGuideH !== null && (
          <BlockItemSnapGuide snapGuideH={snapGuideH} />
        )}

        {block.type === "text"    && <TextEditor    block={block} onChange={d => onChange(block.id, d)} selected={selected} containerWidthPx={containerWidthPx} />}
        {block.type === "heading" && <HeadingEditor block={block} onChange={d => onChange(block.id, d)} selected={selected} onSetVAlign={v => onSetVAlign(block.id, v)} containerWidthPx={containerWidthPx} />}
        {block.type === "image"   && <ImageEditor   block={block} onChange={d => onChange(block.id, d)} onUpload={onUpload} previewHeight={previewHeight} selected={selected} onSelectBlock={onSelectBlock} onOverlayActiveChange={setOverlayActive} containerWidthPx={containerWidthPx} />}
        {block.type === "youtube" && <YoutubeEditor block={block} onChange={d => onChange(block.id, d)} selected={selected} />}
        {block.type === "quote"   && <QuoteEditor   block={block} onChange={d => onChange(block.id, d)} selected={selected} containerWidthPx={containerWidthPx} />}
        {block.type === "card"    && <CardEditor    block={block} onChange={d => onChange(block.id, d)} onUpload={onUpload} />}
        {block.type === "newsCard"&& <NewsCardEditor block={block} onChange={d => onChange(block.id, d)} selected={selected} />}
        {block.type === "divider" && <hr style={{ border: "none", borderTopWidth: "2px", borderTopStyle: "solid", borderTopColor: "#D4A843", margin: "8px 0" }} />}
      </div>

      {/* Resize handles — приховані для newsCard preview, бо блок завжди 360×400. */}
      {!(block.type === "newsCard" && (block.data.displayMode || "preview") === "preview") && (
      <>
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
      </>
      )}
    </div>
  );
}
