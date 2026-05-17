"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { DndContext, DragOverlay, useDraggable } from "@dnd-kit/core";
import { PointerSensor, useSensor, useSensors, DragStartEvent, DragEndEvent, DragMoveEvent } from "@dnd-kit/core";
import { Block, BlockType, BlockWidth, CANVAS_WIDTH, uid } from "./types";
import BlockItem from "./BlockItem";
import BlockPalette, { PALETTE_BLOCKS } from "./BlockPalette";
import OverlayItem from "./OverlayItem";
import GhostBlock from "./GhostBlock";
import { useBlockManager } from "./hooks/useBlockManager";
// ⚠️ Реекспорт LEGACY_H із lib/news/render — щоб білдер і public автоматично мали ОДНАКОВІ
// fallback-висоти. Без цього блок без явної .height виглядає по-різному в білдері та на сайті.
import { LEGACY_H as TYPE_HEIGHT } from "@/lib/news/render";

const PAGE_PAD_X = 32;
const PAGE_PAD_Y = 32;
const SNAP = 8;         // px — вертикальний і горизонтальний grid
const DEFAULT_MIN_CANVAS_H = 500;

// Спецблоки шаблону — semantic-слоти, що мають сенс ТІЛЬКИ поверх блока Фото.
// Drop з палітри і drag існуючого блока перевіряють перекриття з image, інакше
// move/drop скасовується. Module-scope щоб обидва шляхи (handleDragEnd для
// palette-drop і для existing-drag) використовували один список без дублювання.
const SPEC_BLOCK_TYPES_SET = new Set<BlockType>([
  "speakerName", "speakerRole", "tagline", "price", "duration", "ctaButton", "educationItem",
]);

// (TYPE_HEIGHT тепер імпортується з @/lib/news/render — див. шапку файла.)

// Мінімально-корисна висота блоку при auto-fit у fixedHeight-режимі.
// Коли drop у тісний канвас (наприклад, превʼю-картка 360×400 з YouTube на 360px),
// новий блок усе одно рендериться, але стискається до найближчого вільного слота.
// Значення підібрані так, щоб блок зберіг візуальну читабельність (один рядок
// тексту, тонка смужка divider тощо).
const MIN_H_BY_TYPE: Record<BlockType, number> = {
  heading: 24,
  text: 30,
  image: 40,
  youtube: 80,
  quote: 30,
  divider: 8,
  card: 80,
  newsCard: 200,
  cardBody: 40,
  speakerName: 24,
  speakerRole: 20,
  tagline: 20,
  price: 50,
  duration: 50,
  ctaButton: 40,
  educationItem: 36,
  templateInstance: 200,
};

interface Props {
  blocks: Block[];
  onBlocksChange: (blocks: Block[]) => void;
  onUpload: (file: File) => Promise<string>;
  pageBgColor?: string;
  // Selection піднято в parent (NewsEditor) — щоб floating settings panel могла
  // слідкувати за позицією вибраного блока поза EditorCanvas.
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  /** Додаткові блоки в палітрі (page-builder сторінки /news або інші режими). */
  extraPaletteBlocks?: typeof PALETTE_BLOCKS;
  extraPaletteBlocksTitle?: string;
  /** Правий сайдбар, що рендериться ВСЕРЕДИНІ DndContext (щоб draggable у ньому
   *  бачили той самий контекст, що й канвас). Для page-mode — NewsLibrarySidebar
   *  з drag-картками новин. Для post-mode — MetaSidebar (статичний; контексту не потребує). */
  rightSidebar?: React.ReactNode;
  /** Ширина канвасу в px. Default = CANVAS_WIDTH (920) для full-page білдерів.
   *  Білдер превʼю-картки використовує PREVIEW_CARD_WIDTH (360). */
  canvasWidth?: number;
  /** Мінімальна висота канвасу в px. Default 500 (full-page). Для card-builder-а
   *  даємо менше (480) щоб порожня картка виглядала card-shaped. */
  minCanvasHeight?: number;
  /** Кастомні підписи на chrome-смужці канвасу (зверху). Default — текст для
   *  сторінкового режиму. Для card-builder-а передаємо «🃏 Превʼю-картка».
   *  Приймає React.ReactNode (а не лише string) — щоб TemplateConstructor міг
   *  винести туди інпути для зміни розміру канвасу. */
  canvasLabel?: { left: React.ReactNode; right: React.ReactNode };
  /** Запас вільного місця під останнім блоком (drop-zone). Default 240px для
   *  full-page; для маленького card-canvas достатньо 80px (інакше canvas
   *  візуально витягнутий значно більше за реальний контент). */
  bottomSlack?: number;
  /** Заблокувати висоту канвасу на `minCanvasHeight` (не росте під контент).
   *  Використовується для card-builder-а — картка має фіксовані розміри.
   *  Контент, що виходить за межі, обрізається через overflow:hidden. */
  fixedHeight?: boolean;
  /** Template-mode: блоки — плейсхолдери, без settings/редакторів усередині. */
  templateMode?: boolean;
  /** Layout lock: drag-and-resize вимкнено. Блоки заморожені у позиціях/розмірах
   *  заданих шаблоном; менеджер тільки наповнює контентом (текст/фото). */
  lockLayout?: boolean;
  /** Live-callback при ресайзі канвасу (corner drag-handle). Викликається з
   *  кінцевими розмірами (snapped, clamped) під час руху. Якщо не задано —
   *  handle не рендериться. Використовується TemplateConstructor-ом. */
  onCanvasResize?: (width: number, height: number) => void;
  /** Межі для ресайзу канвасу. Дефолт min 240×200, max 1200×1600. */
  canvasMinWidth?: number;
  canvasMaxWidth?: number;
  canvasMinHeight?: number;
  canvasMaxHeight?: number;
  /** Toolbar над канвасом (між label-стрічкою і самим канвасом). Використовується
   *  TemplateConstructor-ом для горизонтальної панелі пресет-форм. */
  canvasTopToolbar?: React.ReactNode;
  /** Slot над лівою палітрою (наприклад, «Назва Шаблону» інпут у template-режимі). */
  abovePaletteSlot?: React.ReactNode;
  /** Slot ліворуч від канвасу (вертикальна колонка пресет-форм у template-режимі). */
  canvasLeftToolbar?: React.ReactNode;
  /** Розширена ліва палітра (520px замість 304) — для page-builder /news. */
  paletteWide?: boolean;
  /** «Базова» візуальна ширина канвасу у білдері. Якщо задано — канвас на екрані
   *  тримає фіксований розмір (= displayBaseWidth + padding), а вміст усередині
   *  масштабується через CSS `zoom` до displayBaseWidth / canvasWidth. Логіка
   *  блоків (стор у %) залишається у логічних координатах PAGE_WIDTH, тож на
   *  публічному рендері /news блоки виглядають у натуральному розмірі pageWidth. */
  displayBaseWidth?: number;
}

export default function EditorCanvas({
  blocks,
  onBlocksChange,
  onUpload,
  pageBgColor,
  selectedBlockId,
  onSelectBlock,
  extraPaletteBlocks,
  extraPaletteBlocksTitle,
  rightSidebar,
  canvasWidth,
  minCanvasHeight,
  canvasLabel,
  bottomSlack,
  fixedHeight,
  templateMode,
  lockLayout,
  onCanvasResize,
  canvasMinWidth = 240,
  canvasMaxWidth = 1200,
  canvasMinHeight = 200,
  canvasMaxHeight = 1600,
  canvasTopToolbar,
  abovePaletteSlot,
  canvasLeftToolbar,
  paletteWide,
  displayBaseWidth,
}: Props) {
  // Локальні константи (були module-scope) тепер залежать від props.
  const PAGE_WIDTH = canvasWidth ?? CANVAS_WIDTH;
  // Базова видима ширина «паперу» в білдері. Якщо caller не передав — рендеримо
  // у логічній ширині (легасі-поведінка). Якщо передав — канвас тримає фіксовану
  // ширину DISPLAY_BASE_W, а вміст масштабується через CSS zoom (≤1, тобто
  // при більшій логічній ширині блоки візуально стискаються).
  const DISPLAY_BASE_W = displayBaseWidth ?? PAGE_WIDTH;
  const displayScale = PAGE_WIDTH > 0 ? Math.min(1, DISPLAY_BASE_W / PAGE_WIDTH) : 1;
  const VISIBLE_INNER_W = Math.round(PAGE_WIDTH * displayScale);
  const VISIBLE_WRAPPER_W = VISIBLE_INNER_W + PAGE_PAD_X * 2;
  const MIN_CANVAS_H = minCanvasHeight ?? DEFAULT_MIN_CANVAS_H;
  // У fixedHeight-режимі drop-zone під контентом не потрібен — канвас не росте.
  const BOTTOM_SLACK_PX = fixedHeight ? 0 : (bottomSlack ?? 240);
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const setSelectedBlockId = (next: string | null | ((prev: string | null) => string | null)) => {
    if (typeof next === "function") {
      onSelectBlock(next(selectedBlockId));
    } else {
      onSelectBlock(next);
    }
  };
  const canvasRef = useRef<HTMLDivElement>(null);
  const canvasRectRef = useRef<DOMRect | null>(null);
  const canvasColumnRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isOverCanvas, setIsOverCanvas] = useState(false);
  // dropPreview: позиція та слот, де новий блок з палітри сяде. У fixedHeight-режимі
  // (preview-картка) додатково містить `height`, обчислену через findAvailableFitInColumn —
  // щоб ghost рендерився точно тієї ж висоти, що й майбутній блок (не 80px-default).
  const dropPreviewRef = useRef<{ x: number; y: number; width: number; height?: number } | null>(null);
  // rAF-throttle для важкої displaceBlocksAround сим у handleDragMove —
  // обмежує її одним викликом на frame, інакше mousemove події (60+ Hz)
  // лагають весь drag через каскад re-render-ів.
  const liveSimRafRef = useRef<number | null>(null);
  const liveSimPendingRef = useRef<{ x: number; y: number; wPct: number; bh: number; bId: string } | null>(null);
  const [dropPreview, setDropPreview] = useState<{ x: number; y: number; width: number; height?: number } | null>(null);
  // Alignment guides — Figma-style лінії що тягнуться від блока який тягнемо
  // до тих, з ким він вирівнюється (left-left, right-right, top-top, bottom-bottom,
  // center-center). Дають миттєвий візуальний зв'язок: "А вирівняна з Б".
  type AlignGuide = {
    axis: "x" | "y";          // x — вертикальна лінія, y — горизонтальна
    pos: number;              // xPct (для axis=x) або yPx (для axis=y)
    start: number;            // початок діапазону на ортогональній осі (yPx або xPct)
    end: number;              // кінець діапазону
    kind: "edge" | "center";  // солідна (edge) чи пунктирна (center)
  };
  const [alignGuides, setAlignGuides] = useState<AlignGuide[]>([]);
  type SizeMatch = { blockId: string; dim: "h" | "w" };
  const [sizeMatches, setSizeMatches] = useState<SizeMatch[]>([]);
  const activePaletteRef = useRef<typeof PALETTE_BLOCKS[0] | null>(null);
  const blockHeightsRef = useRef<Record<string, number>>({});
  const [, forceTick] = useState(0);

  // Який блок зараз резайзять по ширині (через handlePreviewWidth/handleClearPreview).
  // Тригер рендеру ResizeRuler — тонкої "лінійки" над блоком зі snap-марками і % бейджем.
  // Не плутати з drag-ом блока: drag-overrides пишуть напряму в setPreview, не через handlePreviewWidth.
  const [resizingBlockId, setResizingBlockId] = useState<string | null>(null);

  // Scroll-компенсація для drag-у. dnd-kit's `transform` рахується з ClientX/Y курсора
  // і НЕ оновлюється коли юзер скролить колесом без руху мишки — тоді блок візуально
  // "тікає" з viewport бо сторінка зміщується а transform залишається старим.
  // Зберігаємо initial scrollY на drag start, на scroll рахуємо delta і додаємо її
  // до translate.y у AbsoluteBlock. dropPreview не чіпаємо — там event.delta scroll-aware.
  const [scrollCompensation, setScrollCompensation] = useState(0);
  const dragStartScrollRef = useRef(0);

  useEffect(() => {
    if (!activeId || activeId.startsWith("palette:")) return;
    dragStartScrollRef.current = window.scrollY;
    setScrollCompensation(0);
    const onScroll = () => {
      setScrollCompensation(window.scrollY - dragStartScrollRef.current);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      setScrollCompensation(0);
    };
  }, [activeId]);

  const updateCanvasRect = useCallback(() => {
    if (canvasRef.current) canvasRectRef.current = canvasRef.current.getBoundingClientRect();
  }, []);

  useEffect(() => {
    updateCanvasRect();
    const ro = new ResizeObserver(updateCanvasRect);
    if (canvasRef.current) ro.observe(canvasRef.current);
    window.addEventListener("scroll", updateCanvasRect, true);
    window.addEventListener("resize", updateCanvasRect);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", updateCanvasRect, true);
      window.removeEventListener("resize", updateCanvasRect);
    };
  }, [updateCanvasRect]);

  useEffect(() => {
    if (!lastAddedId) return;
    const t = setTimeout(() => setLastAddedId(null), 600);
    return () => clearTimeout(t);
  }, [lastAddedId]);

  // Delete / Backspace: видалити вибраний блок. Не чіпаємо коли фокус у input/textarea/contentEditable.
  // Якщо вибраний overlay (Текст на фото) — пропускаємо, щоб не видалити фото; ImageEditor сам обробить.
  // У lockLayout-режимі (content-fill з шаблону) видалення блоків заборонене —
  // layout заморожений, менеджер тільки наповнює блоки контентом.
  useEffect(() => {
    if (lockLayout) return;
    const handler = (e: KeyboardEvent) => {
      if (!selectedBlockId) return;
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (typeof document !== "undefined" && document.querySelector("[data-overlay-selected]")) return;
      e.preventDefault();
      deleteBlock(selectedBlockId);
      setSelectedBlockId(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedBlockId, lockLayout]);

  const {
    previewWidths, previewWidthsRef, previewXs, previewYs, previewHeights, blockHeights,
    updateBlock, deleteBlock, moveBlock, duplicateBlock,
    setWidth, setWidthAndData, setAlign, setVAlign, setBg, setBorderRadius,
    setPreview, clearPreview, setPreviewX, clearPreviewX,
    setPreviewY, clearPreviewY,
    setPreviewHeight, clearPreviewHeight, reportHeight,
  } = useBlockManager(blocks, onBlocksChange);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const canvasWidthPx = canvasRectRef.current?.width ?? PAGE_WIDTH;

  // Реальна висота блока — ПРІОРИТЕТ: DOM (найточніше, враховує CSS aspect-ratio,
  // overflow:visible експандованих шаблонів, тощо), потім block.height,
  // потім reported-height, потім type-based дефолт.
  //
  // ЧОМУ DOM-first: snap-логіка і displaceBlocksAround мають враховувати реальний
  // візуальний bottom-edge, а не stale `block.height`. Для newsCard preview
  // wrapper має `height: auto + aspect-ratio` → block.height не відображає
  // реальний розмір. Для newsCard expanded — block.height (1700) може бути
  // менше за rendered ArticleTemplate. У всіх кейсах DOM-вимір надійніший.
  function measureBlockHeight(b: Block): number {
    if (canvasRef.current) {
      const el = canvasRef.current.querySelector<HTMLElement>(`[data-block-id="${b.id}"]`);
      if (el && el.offsetHeight > 20) return el.offsetHeight;
    }
    if (typeof b.height === "number" && b.height > 0) return b.height;
    const measured = blockHeights[b.id] ?? blockHeightsRef.current[b.id];
    if (measured && measured > 20) return measured;
    // Fallback для newsCard preview: aspect-розрахунок (DOM ще не доступний
    // на перших frame-ах рендеру).
    const isNewsCardPreview = b.type === "newsCard" && (b.data.displayMode || "preview") === "preview";
    if (isNewsCardPreview) {
      const wPct = Number(b.width) || 100;
      const widthPx = (wPct / 100) * (canvasRectRef.current?.width ?? PAGE_WIDTH);
      return Math.round(widthPx * (400 / 360));
    }
    return TYPE_HEIGHT[b.type] ?? 100;
  }
  // BOTTOM_SLACK — вільний простір під найнижчим блоком, щоб юзер міг легко
  // У fixedHeight-режимі канвас завжди MIN_CANVAS_H (не росте під контент).
  // Інакше — росте під blocks + bottomSlack drop-zone.
  const canvasHeight = fixedHeight
    ? MIN_CANVAS_H
    : Math.max(
        MIN_CANVAS_H,
        ...blocks.map(b => (b.y ?? 0) + measureBlockHeight(b) + BOTTOM_SLACK_PX),
        // НЕ розтягувати canvas під dropPreview — це провокує feedback loop:
        // canvas росте → browser скролить → rect.top негативніший → cursorY - rectTop росте
        // → preview Y росте → canvas ще більший. Блок летить у нескінченність.
      );

  function clampXY(xPct: number, yPx: number, wPct: number): { x: number; y: number } {
    const clampedX = Math.max(0, Math.min(100 - wPct, xPct));
    const clampedY = Math.max(0, yPx);
    return { x: clampedX, y: clampedY };
  }

  // У fixedHeight-режимі блок не може стояти так, щоб його низ виходив за canvasHeight.
  // Клампимо Y до [0, canvasHeight - blockHeight]. Якщо блок вищий за canvas — y=0,
  // решта обрізається через overflow:hidden (safety net).
  function clampYBottom(yPx: number, blockHeight: number): number {
    if (!fixedHeight) return Math.max(0, yPx);
    const maxY = Math.max(0, canvasHeight - blockHeight);
    return Math.max(0, Math.min(maxY, yPx));
  }

  // Найближчий блок праворуч у тому ж вертикальному діапазоні (Y-overlap).
  // Використовується для neighbor-aware resize: коли лівий блок росте вправо,
  // правий сусід має зменшуватись синхронно.
  function findRightNeighbor(id: string): Block | null {
    const b = blocks.find(x => x.id === id);
    if (!b) return null;
    const bx = b.x ?? 0;
    const by = b.y ?? 0;
    const bh = measureBlockHeight(b);
    const bRight = bx + (Number(b.width) || 100);
    const candidates = blocks.filter(o => {
      if (o.id === id) return false;
      const oy = o.y ?? 0;
      const oh = measureBlockHeight(o);
      const ox = o.x ?? 0;
      // Y-ranges перетинаються + правіше
      const yOverlap = oy < by + bh - 2 && oy + oh > by + 2;
      const toRight = ox >= bRight - 0.5;
      return yOverlap && toRight;
    });
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => (a.x ?? 0) - (b.x ?? 0));
    return candidates[0];
  }

  const MIN_NEIGHBOR_WIDTH = 10;

  // Округлення ширини блока до 0.1% — узгоджено з snapWidth у useBlockResize.
  // Без цього на release після resize ширина "стрибала" через round-to-int.
  const roundW = (n: number) => Math.round(n * 10) / 10;

  // Розрахунок як ріс блок з урахуванням gap + сусіда.
  // Спочатку growth поглинається gap-ом між self.right і neighbor.left, потім
  // сусід штовхається вправо (доки є місце до канвас-edge), потім стискається.
  // Без врахування gap зростання self відразу штовхало сусіда — навіть коли між
  // ними був вільний простір — і це виглядало як "стискає праве фото попри відстань".
  function computeGrowthWithNeighbor(
    blockX: number, oldW: number, newW: number,
    neighborX: number, neighborW: number,
  ): { appliedW: number; neighborX: number; neighborW: number } {
    const delta = newW - oldW;
    if (delta <= 0) {
      return { appliedW: newW, neighborX, neighborW };
    }
    const oldRight = blockX + oldW;
    const gap = Math.max(0, neighborX - oldRight);
    // delta повністю влазить у gap → сусід не зачіпається
    if (delta <= gap) {
      return { appliedW: newW, neighborX, neighborW };
    }
    const overflow = delta - gap;
    const roomToShift = Math.max(0, 100 - (neighborX + neighborW));
    const shiftDelta = Math.min(overflow, roomToShift);
    const remaining = overflow - shiftDelta;
    const maxShrink = Math.max(0, neighborW - MIN_NEIGHBOR_WIDTH);
    const shrinkDelta = Math.min(remaining, maxShrink);
    return {
      appliedW: oldW + gap + shiftDelta + shrinkDelta,
      neighborX: neighborX + shiftDelta,
      neighborW: neighborW - shrinkDelta,
    };
  }

  // Neighbor-aware ширина (commit). Якщо сусід праворуч — спочатку ЗСУВАЄМО його вправо
  // (доки є місце до правого краю канвасу), і тільки потім починаємо звужувати.
  const handleSetWidth = useCallback((id: string, w: BlockWidth) => {
    const b = blocks.find(x => x.id === id);
    if (!b) return;
    const newW = Number(w);
    const oldW = Number(b.width) || 100;
    const delta = newW - oldW;

    // У template-режимі пропускаємо neighbor-логіку: блоки вільно перекриваються.
    if (!templateMode && delta > 0) {
      const neighbor = findRightNeighbor(id);
      if (neighbor) {
        const result = computeGrowthWithNeighbor(
          b.x ?? 0, oldW, newW,
          neighbor.x ?? 0, Number(neighbor.width) || 100,
        );
        onBlocksChange(blocks.map(o => {
          if (o.id === id) return { ...o, width: String(roundW(result.appliedW)) };
          if (o.id === neighbor.id) return {
            ...o,
            x: result.neighborX,
            width: String(roundW(result.neighborW)),
          };
          return o;
        }));
        clearPreview(id);
        clearPreview(neighbor.id);
        clearPreviewX(neighbor.id);
        return;
      }
    }
    // Немає сусіда ПРАВОРУЧ (або template-режим) — звичайний setWidth, clamp до канвасу.
    const bx = b.x ?? 0;
    const clampedW = Math.max(MIN_NEIGHBOR_WIDTH, Math.min(100 - bx, newW));
    setWidth(id, String(roundW(clampedW)));
  }, [blocks, onBlocksChange, setWidth, clearPreview, clearPreviewX, templateMode]);

  const handleSetWidthAndData = useCallback((id: string, w: BlockWidth, data: Record<string, string>, height?: number) => {
    // Image/diagonal resize: new height приходить як 4-й параметр `height` від
    // useBlockResize (resize-хук). Раніше функція ігнорувала 4-й аргумент → block.height
    // не оновлювався → при resize ширини фото висота "відскакувала" до старої.
    // Якщо height не задано — fallback на data.minHeight (legacy) або поточну висоту.
    const b = blocks.find(x => x.id === id);
    if (!b) { setWidthAndData(id, w, data, height); return; }
    const newW = Number(w);
    const oldW = Number(b.width) || 100;
    const delta = newW - oldW;
    const bx = b.x ?? 0;
    const by = b.y ?? 0;
    const newH = height ?? (Number(data.minHeight) || measureBlockHeight(b));

    // Helper: оновлюємо block з новою width + data + опційно height (якщо передане).
    const applyUpdate = (o: Block, newWidth: number): Block => {
      const updated: Block = { ...o, width: String(roundW(newWidth)), data };
      if (typeof height === "number") updated.height = height;
      return updated;
    };

    // Крок 1: будуємо новий стан з neighbor-shrink (якщо сусід є і блок росте).
    // У template-режимі — пропускаємо: блоки вільно перекриваються.
    let appliedW = newW;
    let next: Block[];
    let neighborId: string | null = null;
    if (!templateMode && delta > 0) {
      const neighbor = findRightNeighbor(id);
      if (neighbor) {
        neighborId = neighbor.id;
        const result = computeGrowthWithNeighbor(
          bx, oldW, newW,
          neighbor.x ?? 0, Number(neighbor.width) || 100,
        );
        appliedW = result.appliedW;
        next = blocks.map(o => {
          if (o.id === id) return applyUpdate(o, appliedW);
          if (o.id === neighbor.id) return { ...o, x: result.neighborX, width: String(roundW(result.neighborW)) };
          return o;
        });
      } else {
        appliedW = Math.max(MIN_NEIGHBOR_WIDTH, Math.min(100 - bx, newW));
        next = blocks.map(o => o.id === id ? applyUpdate(o, appliedW) : o);
      }
    } else {
      appliedW = Math.max(MIN_NEIGHBOR_WIDTH, Math.min(100 - bx, newW));
      next = blocks.map(o => o.id === id ? applyUpdate(o, appliedW) : o);
    }

    // Крок 2: displacement — лише поза template-режимом.
    if (!templateMode) {
      const rect = { x: bx, y: by, width: appliedW, height: newH };
      const needsDisplace = next.some(o => {
        if (o.id === id) return false;
        if (neighborId && o.id === neighborId) return false;
        const ox = o.x ?? 0;
        const oy = o.y ?? 0;
        const ow = Number(o.width) || 100;
        const oh = measureBlockHeight(o);
        const overlapX = ox + ow > rect.x + 0.5 && ox < rect.x + rect.width - 0.5;
        const overlapY = oy + oh > rect.y + 4 && oy < rect.y + rect.height - 4;
        return overlapX && overlapY;
      });
      if (needsDisplace) {
        next = displaceBlocksAround(rect, next, id);
      }
    }

    // Крок 3: commit + очистка previews
    clearPreview(id);
    if (neighborId) {
      clearPreview(neighborId);
      clearPreviewX(neighborId);
    }
    onBlocksChange(next);
  }, [blocks, onBlocksChange, setWidthAndData, clearPreview, clearPreviewX, templateMode]);

  // Детектор alignment-guides — викликається з drag-move І resize (preview width/height).
  // Перевіряє всі alignments (left-left, right-right, top-top, bottom-bottom, center-center)
  // і виставляє guide-лінії + size-match badges. Допуски TIGHT_X/Y використовуються
  // для постфактумної детекції — блок вже мав би бути на цій позиції після snap-у.
  const detectAlignmentsAt = useCallback((selfId: string, ax: number, ay: number, aw: number, ah: number) => {
    // Єдиний px-толеранс для обох осей: snap у drag/resize ↔ guide-line у detector.
    // Якщо ці значення розходяться (наприклад X=0.5% при canvasWidthPx=920 → ~4.6px,
    // а edge-snap у resize фіксує на 8px) — snap фіксує позицію, але guide-line
    // мовчить. TIGHT_X тепер похідний від TIGHT_Y_PX через canvasWidthPx,
    // щоб діапазон спрацювання був ідентичний по обох осях.
    const TIGHT_Y = 8;
    const TIGHT_X = (TIGHT_Y / canvasWidthPx) * 100;
    const SIZE_MATCH_PX = 8;     // Розширено з 4 — менеджеру не треба піксельної точності.
    const SIZE_MATCH_PCT = 0.8;
    // Proximity для size-match: показуємо "= H" / "= W" лише коли блоки в одному
    // рядку/колонці. Розширено з 14/2 — toleranт для блоків розділених невеликим gap-ом.
    const SIZE_PROX_Y_PX = 24;
    const SIZE_PROX_X_PCT = 3;

    const guideMap = new Map<string, AlignGuide>();
    const addGuide = (g: AlignGuide) => {
      const key = `${g.axis}|${g.pos.toFixed(2)}|${g.kind}`;
      const existing = guideMap.get(key);
      if (existing) {
        existing.start = Math.min(existing.start, g.start);
        existing.end = Math.max(existing.end, g.end);
      } else {
        guideMap.set(key, { ...g });
      }
    };

    const aLeft = ax, aRight = ax + aw, aCenterX = ax + aw / 2;
    const aTop = ay, aBottom = ay + ah, aCenterY = ay + ah / 2;
    const matches: SizeMatch[] = [];

    // Canvas-edge guides — Figma показує лінію коли блок впритул до краю фрейма.
    // Без цього у card-builder-і (preview-картка з 1-2 блоками) користувач не бачить
    // фідбеку на snap-to-canvas-edge, хоча snap у handleDragMove працює.
    // Лінії тягнемо на ВСЮ ширину/висоту канвасу — дзеркало "frame edge" патерну Figma.
    const cH = canvasHeight;
    if (Math.abs(aLeft - 0) < TIGHT_X)        addGuide({ axis: "x", pos: 0,   start: 0, end: cH, kind: "edge" });
    if (Math.abs(aRight - 100) < TIGHT_X)     addGuide({ axis: "x", pos: 100, start: 0, end: cH, kind: "edge" });
    if (Math.abs(aCenterX - 50) < TIGHT_X)    addGuide({ axis: "x", pos: 50,  start: 0, end: cH, kind: "center" });
    if (Math.abs(aTop - 0) < TIGHT_Y)         addGuide({ axis: "y", pos: 0,   start: 0, end: 100, kind: "edge" });
    if (Math.abs(aBottom - cH) < TIGHT_Y)     addGuide({ axis: "y", pos: cH,  start: 0, end: 100, kind: "edge" });
    if (Math.abs(aCenterY - cH / 2) < TIGHT_Y) addGuide({ axis: "y", pos: cH / 2, start: 0, end: 100, kind: "center" });

    for (const o of blocks) {
      if (o.id === selfId) continue;
      const ox = o.x ?? 0;
      const oy = o.y ?? 0;
      const ow = Number(o.width) || 100;
      const oh = measureBlockHeight(o);
      const oRight = ox + ow;
      const oCenterX = ox + ow / 2;
      const oBottom = oy + oh;
      const oCenterY = oy + oh / 2;

      // Guides не мають proximity-фільтра — Figma показує лінію між будь-якими
      // блоками з однаковим краєм/центром, навіть якщо вони далеко. Лінія сама
      // тягнеться між ними, "пробігаючи" через gap.
      // X-axis (вертикальні лінії)
      const yMin = Math.min(aTop, oy);
      const yMax = Math.max(aBottom, oBottom);
      if (Math.abs(aLeft - ox) < TIGHT_X)         addGuide({ axis: "x", pos: ox, start: yMin, end: yMax, kind: "edge" });
      if (Math.abs(aLeft - oRight) < TIGHT_X)     addGuide({ axis: "x", pos: oRight, start: yMin, end: yMax, kind: "edge" });
      if (Math.abs(aRight - ox) < TIGHT_X)        addGuide({ axis: "x", pos: ox, start: yMin, end: yMax, kind: "edge" });
      if (Math.abs(aRight - oRight) < TIGHT_X)    addGuide({ axis: "x", pos: oRight, start: yMin, end: yMax, kind: "edge" });
      if (Math.abs(aCenterX - oCenterX) < TIGHT_X) addGuide({ axis: "x", pos: oCenterX, start: yMin, end: yMax, kind: "center" });

      // Y-axis (горизонтальні лінії)
      const xMin = Math.min(aLeft, ox);
      const xMax = Math.max(aRight, oRight);
      if (Math.abs(aTop - oy) < TIGHT_Y)            addGuide({ axis: "y", pos: oy, start: xMin, end: xMax, kind: "edge" });
      if (Math.abs(aTop - oBottom) < TIGHT_Y)       addGuide({ axis: "y", pos: oBottom, start: xMin, end: xMax, kind: "edge" });
      if (Math.abs(aBottom - oy) < TIGHT_Y)         addGuide({ axis: "y", pos: oy, start: xMin, end: xMax, kind: "edge" });
      if (Math.abs(aBottom - oBottom) < TIGHT_Y)    addGuide({ axis: "y", pos: oBottom, start: xMin, end: xMax, kind: "edge" });
      if (Math.abs(aCenterY - oCenterY) < TIGHT_Y)  addGuide({ axis: "y", pos: oCenterY, start: xMin, end: xMax, kind: "center" });

      // Size match — все ж з proximity, щоб badge не стрибав між далекими блоками.
      const yNear = ay < oBottom + SIZE_PROX_Y_PX && ay + ah > oy - SIZE_PROX_Y_PX;
      const xNear = ax < oRight + SIZE_PROX_X_PCT && ax + aw > ox - SIZE_PROX_X_PCT;
      if (yNear && Math.abs(ah - oh) <= SIZE_MATCH_PX) matches.push({ blockId: o.id, dim: "h" });
      if (xNear && Math.abs(aw - ow) <= SIZE_MATCH_PCT) matches.push({ blockId: o.id, dim: "w" });
    }

    setAlignGuides(Array.from(guideMap.values()));
    setSizeMatches(matches);
  }, [blocks, canvasHeight, canvasWidthPx]);

  const clearAlignmentGuides = useCallback(() => {
    setAlignGuides([]);
    setSizeMatches([]);
  }, []);

  // Live preview — пушимо в previewWidths і previewXs, щоб сусід рухався плавно під час drag.
  const handlePreviewWidth = useCallback((id: string, pct: number) => {
    setResizingBlockId(id);
    const b = blocks.find(x => x.id === id);
    if (!b) { setPreview(id, pct); return; }
    const oldW = Number(b.width) || 100;
    const delta = pct - oldW;

    let appliedW = pct;
    // У template-режимі НЕ пушимо сусідів — блоки вільно перекриваються,
    // користувач сам керує позиціями. Це консистентно з drop-логікою
    // (skip-фітa в handleDragEnd).
    if (templateMode) {
      const bx = b.x ?? 0;
      appliedW = Math.max(MIN_NEIGHBOR_WIDTH, Math.min(100 - bx, pct));
      setPreview(id, appliedW);
    } else if (delta > 0) {
      const neighbor = findRightNeighbor(id);
      if (neighbor) {
        const result = computeGrowthWithNeighbor(
          b.x ?? 0, oldW, pct,
          neighbor.x ?? 0, Number(neighbor.width) || 100,
        );
        setPreview(id, result.appliedW);
        setPreviewX(neighbor.id, result.neighborX);
        setPreview(neighbor.id, result.neighborW);
        appliedW = result.appliedW;
      } else {
        const bx = b.x ?? 0;
        appliedW = Math.max(MIN_NEIGHBOR_WIDTH, Math.min(100 - bx, pct));
        setPreview(id, appliedW);
      }
    } else {
      const bx = b.x ?? 0;
      appliedW = Math.max(MIN_NEIGHBOR_WIDTH, Math.min(100 - bx, pct));
      setPreview(id, appliedW);
    }

    // Alignment guides під час resize: позиція + нова ширина + НОВА висота.
    // Для newsCard preview з aspect-ratio 360:400 width-resize змінює height
    // (CSS auto). Рахуємо висоту з нового appliedW заздалегідь — DOM ще не
    // оновився, а stored block.height — stale. Без цього bottom-edge guide
    // ніколи не фіксувався, бо порівнював старий aBottom з новим oBottom.
    const bx = b.x ?? 0;
    const by = b.y ?? 0;
    const isNewsCardPreview = b.type === "newsCard" && (b.data.displayMode || "preview") === "preview";
    let bh: number;
    if (isNewsCardPreview) {
      const widthPx = (appliedW / 100) * (canvasRectRef.current?.width ?? PAGE_WIDTH);
      bh = Math.round(widthPx * (400 / 360));
    } else {
      bh = measureBlockHeight(b);
    }
    detectAlignmentsAt(id, bx, by, appliedW, bh);
  }, [blocks, setPreview, setPreviewX, detectAlignmentsAt, templateMode]);

  const handleClearPreview = useCallback((id: string) => {
    setResizingBlockId(prev => prev === id ? null : prev);
    clearPreview(id);
    // Якщо превʼювали сусіда — чистимо і його
    const neighbor = findRightNeighbor(id);
    if (neighbor) {
      clearPreview(neighbor.id);
      clearPreviewX(neighbor.id);
    }
    clearAlignmentGuides();
  }, [clearPreview, clearPreviewX, blocks, clearAlignmentGuides]);

  // Wrapper над setPreviewHeight — додає alignment-detection під час resize-у висоти.
  // КРИТИЧНО: читаємо previewWidthsRef.current[id] (ref) замість previewWidths[id] (state).
  // Причина: handlePreviewHeight спрацьовує СИНХРОННО після handlePreviewWidth у aspect-locked
  // resize (image / newsCard preview). State через useState ще не оновлений до next-render,
  // closure захоплює stale previewWidths без новопоставленої ширини → detectAlignmentsAt
  // отримує СТАРУ ширину і ОЧИЩАЄ guide-лінії, які щойно поставив попередній виклик.
  const handlePreviewHeight = useCallback((id: string, h: number) => {
    setResizingBlockId(id);
    setPreviewHeight(id, h);
    const b = blocks.find(x => x.id === id);
    if (!b) return;
    const bx = b.x ?? 0;
    const by = b.y ?? 0;
    const w = previewWidthsRef.current[id] ?? (Number(b.width) || 100);
    detectAlignmentsAt(id, bx, by, w, h);
  }, [blocks, previewWidthsRef, setPreviewHeight, detectAlignmentsAt]);

  const handleClearPreviewHeight = useCallback((id: string) => {
    setResizingBlockId(prev => prev === id ? null : prev);
    clearPreviewHeight(id);
    clearAlignmentGuides();
  }, [clearPreviewHeight, clearAlignmentGuides]);

  // Wrapped updateBlock: якщо data.minHeight збільшилось (bottom resize у зображення) —
  // перевіряємо чи нові межі не налазять на нижні блоки і витискаємо їх.
  const handleUpdateBlock = useCallback((id: string, data: Record<string, string>) => {
    const b = blocks.find(x => x.id === id);
    if (!b) { updateBlock(id, data); return; }
    const oldH = Number(b.data.minHeight) || measureBlockHeight(b);
    const newH = Number(data.minHeight) || oldH;
    // Тільки якщо висота зросла — робимо displacement. У template-режимі — пропускаємо.
    if (!templateMode && newH > oldH + 0.5) {
      const bx = b.x ?? 0;
      const by = b.y ?? 0;
      const bw = Number(b.width) || 100;
      const rect = { x: bx, y: by, width: bw, height: newH };
      const next = blocks.map(o => o.id === id ? { ...o, data } : o);
      const needsDisplace = next.some(o => {
        if (o.id === id) return false;
        const ox = o.x ?? 0;
        const oy = o.y ?? 0;
        const ow = Number(o.width) || 100;
        const oh = measureBlockHeight(o);
        const overlapX = ox + ow > rect.x + 0.5 && ox < rect.x + rect.width - 0.5;
        const overlapY = oy + oh > rect.y + 4 && oy < rect.y + rect.height - 4;
        return overlapX && overlapY;
      });
      if (needsDisplace) {
        onBlocksChange(displaceBlocksAround(rect, next, id));
        return;
      }
    }
    updateBlock(id, data);
  }, [blocks, onBlocksChange, updateBlock, templateMode]);

  function snapPx(v: number): number { return Math.round(v / SNAP) * SNAP; }
  function snapPct(pct: number): number {
    const snappedPx = snapPx((pct / 100) * canvasWidthPx);
    return (snappedPx / canvasWidthPx) * 100;
  }

  // Знаходить drop-слот для блока на позиції курсора.
  // Ключове: Y ЗАЛИШАЄМО близько до курсора (щоб блок сідав де цілився),
  // а X+width підбираємо під вільну горизонтальну прорізку на цьому Y.
  function findDropSlot(
    excludeId: string | null,
    cursorXPct: number,
    cursorYPx: number,
    fallbackWidth: number = 100,
    minWidthPct: number = 10,
  ): { x: number; y: number; width: number } {
    const others = blocks.filter(b => b.id !== excludeId);

    // Дивимось які блоки займають вертикальний діапазон, у який попадає курсор Y.
    // Це блоки, з якими буде горизонтальний конфлікт, якщо ми поставимо block на cursor Y.
    const occupying = others.filter(b => {
      const by = b.y ?? 0;
      const bh = measureBlockHeight(b);
      return cursorYPx >= by - 2 && cursorYPx <= by + bh + 2;
    });

    if (occupying.length === 0) {
      // Курсор у пустоті → повна ширина на cursor Y
      const y = Math.max(0, snapPx(cursorYPx));
      const x = clampXY(snapPct(cursorXPct - fallbackWidth / 2), y, fallbackWidth).x;
      return { x, y, width: fallbackWidth };
    }

    // Є сусіди → шукаємо горизонтальні gaps
    const occupied: Array<[number, number]> = occupying
      .map(b => [b.x ?? 0, (b.x ?? 0) + (Number(b.width) || 100)] as [number, number])
      .sort((a, b) => a[0] - b[0]);

    const gaps: Array<[number, number]> = [];
    let prev = 0;
    for (const [s, e] of occupied) {
      if (s > prev + 0.5) gaps.push([prev, s]);
      prev = Math.max(prev, e);
    }
    if (prev < 99.5) gaps.push([prev, 100]);

    // Gap, у який попадає курсор X → використовуємо його (keeping cursor Y!)
    let chosen: [number, number] | null = null;
    for (const g of gaps) {
      if (g[1] - g[0] < minWidthPct) continue;
      if (cursorXPct >= g[0] && cursorXPct <= g[1]) { chosen = g; break; }
    }
    if (!chosen) {
      for (const g of gaps) {
        if (g[1] - g[0] < minWidthPct) continue;
        if (!chosen || (g[1] - g[0]) > (chosen[1] - chosen[0])) chosen = g;
      }
    }

    if (chosen) {
      const width = chosen[1] - chosen[0];
      return { x: chosen[0], y: Math.max(0, snapPx(cursorYPx)), width };
    }

    // Немає підходящого gap → ставимо блок ТАМ ДЕ КУРСОР з повною шириною.
    // Existing блоки адаптуються через displaceBlocksAround у handleDragEnd
    // (стиснуться вбік або зсунуться вниз — як вийде).
    return { x: 0, y: Math.max(0, snapPx(cursorYPx)), width: fallbackWidth };
  }

  // Displacement-режим: новий блок стоїть де треба, а СУСІДНІ блоки адаптуються —
  // стискаються горизонтально якщо це можливо, або опускаються нижче. Cascade по всіх.
  // Кожен reserved-rect тегнутий id блока (або null для нового) — блок ніколи не
  // конфліктує сам із собою через свій же запис у reserved.
  function displaceBlocksAround(
    newRect: { x: number; y: number; width: number; height: number },
    currentBlocks: Block[],
    ignoreId: string | null = null,
  ): Block[] {
    const MIN_W = 12;
    const result: Block[] = currentBlocks.map(b => ({ ...b }));
    const reserved: Array<{ x: number; y: number; w: number; h: number; id: string | null }> = [
      { x: newRect.x, y: newRect.y, w: newRect.width, h: newRect.height, id: null },
    ];

    const upsertReserved = (entry: { x: number; y: number; w: number; h: number; id: string }) => {
      const idx = reserved.findIndex(r => r.id === entry.id);
      if (idx >= 0) reserved[idx] = entry;
      else reserved.push(entry);
    };

    let changed = true;
    let iter = 0;

    while (changed && iter < 30) {
      changed = false;
      iter++;

      for (let i = 0; i < result.length; i++) {
        const b = result[i];
        if (b.id === ignoreId) continue;
        const bx = b.x ?? 0;
        const by = b.y ?? 0;
        const bw = Number(b.width) || 100;
        const bh = measureBlockHeight(b);

        // Конфлікт — з реальним reserved-rect (не з власним записом)
        let hit: { x: number; y: number; w: number; h: number; id: string | null } | null = null;
        for (const r of reserved) {
          if (r.id === b.id) continue; // пропускаємо себе
          const overlapX = bx + bw > r.x + 0.5 && bx < r.x + r.w - 0.5;
          const overlapY = by + bh > r.y + 2 && by < r.y + r.h - 2;
          if (overlapX && overlapY) { hit = r; break; }
        }
        if (!hit) continue;

        // Варіант 1: блок частково зліва від reserved — обрізаємо справа.
        // Стискаємо до MIN_W без додаткових ratio-обмежень — користувач контролює drag-ом.
        const leftFitW = hit.x - bx;
        if (leftFitW >= MIN_W && bx < hit.x) {
          result[i] = { ...b, width: String(roundW(leftFitW)) };
          upsertReserved({ x: bx, y: by, w: leftFitW, h: bh, id: b.id });
          changed = true;
          continue;
        }
        // Варіант 2: блок частково справа від reserved — зсуваємо + стискаємо
        const rightStart = hit.x + hit.w;
        const rightFitW = (bx + bw) - rightStart;
        if (rightFitW >= MIN_W && bx + bw > rightStart) {
          result[i] = { ...b, x: rightStart, width: String(roundW(rightFitW)) };
          upsertReserved({ x: rightStart, y: by, w: rightFitW, h: bh, id: b.id });
          changed = true;
          continue;
        }
        // Варіант 3: не стиснути → опускаємо нижче hit
        const rawNewY = snapPx(hit.y + hit.h + 8);
        // У fixedHeight-режимі канвас не росте — клампимо до canvasHeight - bh,
        // інакше блок виштовхується за нижній край. Допускаємо overlap (бл. в одну
        // позицію), користувач сам вирішує, як їх розставити.
        const newY = fixedHeight
          ? Math.max(0, Math.min(canvasHeight - bh, rawNewY))
          : rawNewY;
        if (newY > by + 0.5) {
          result[i] = { ...b, y: newY };
          upsertReserved({ x: bx, y: newY, w: bw, h: bh, id: b.id });
          changed = true;
          continue;
        }
      }
    }

    return result;
  }

  const handleDragStart = useCallback((event: DragStartEvent) => {
    updateCanvasRect();
    const idStr = String(event.active.id);
    setActiveId(idStr);
    setIsOverCanvas(false);
    dropPreviewRef.current = null;
    setDropPreview(null);
    setAlignGuides([]);
    setSizeMatches([]);
    if (idStr.startsWith("palette:")) {
      if (idStr === "palette:image-overlay") {
        activePaletteRef.current = {
          type: "image" as const,
          label: "Текст на фото",
          icon: "T",
          desc: "Напис поверх фото",
          color: "#D4A843",
          colorDim: "rgba(212,168,67,0.18)",
          bg: "rgba(212,168,67,0.08)",
        };
      } else {
        activePaletteRef.current =
          PALETTE_BLOCKS.find(b => `palette:${b.type}` === idStr) ||
          (extraPaletteBlocks ?? []).find(b => `palette:${b.type}` === idStr) ||
          null;
      }
    } else if (idStr.startsWith("news-card:")) {
      // Drag з NewsLibrarySidebar — перетягуємо існуючу новину на канвас.
      // Ghost-block використовує newsCard метадані для preview.
      activePaletteRef.current = {
        type: "newsCard" as const,
        label: "Новина",
        icon: "📰",
        desc: "Картка зі списку",
        color: "#D4A843",
        colorDim: "rgba(212,168,67,0.18)",
        bg: "rgba(212,168,67,0.08)",
      };
    } else if (idStr.startsWith("template-expand:")) {
      // Drag шаблону з NewsLibrarySidebar — розгортається на канвас як набір
      // блоків. Ghost — узагальнений «Шаблон» бейдж (preview-grid для multi-block
      // drag поки не показуємо).
      activePaletteRef.current = {
        type: "cardBody" as const,
        label: "Шаблон",
        icon: "📐",
        desc: "Розгорнеться як набір блоків",
        color: "#D4A843",
        colorDim: "rgba(212,168,67,0.18)",
        bg: "rgba(212,168,67,0.08)",
      };
    }
  }, [updateCanvasRect]);

  const handleDragMove = useCallback((event: DragMoveEvent) => {
    const rect = canvasRectRef.current;
    if (!rect) return;
    const ev = event.activatorEvent as MouseEvent;
    const cursorX = ev.clientX + (event.delta?.x || 0);
    const cursorY = ev.clientY + (event.delta?.y || 0);
    const over = cursorX >= rect.left && cursorX <= rect.right && cursorY >= rect.top && cursorY <= rect.bottom + 200;
    setIsOverCanvas(over);

    const idStr = String(event.active.id);
    const isFromPalette = idStr.startsWith("palette:") || idStr.startsWith("news-card:") || idStr.startsWith("template-expand:");

    // image-overlay (Текст на фото) — ghost показуємо ТІЛЬКИ коли курсор над
    // image-блоком з url. Інакше drop буде silently відхилений у handleDragEnd,
    // не вводимо менеджера в оману.
    if (isFromPalette && idStr === "palette:image-overlay") {
      const candidates = blocks.filter(b => b.type === "image" && b.data.url);
      const over = candidates.some(b => {
        const el = canvasRef.current?.querySelector<HTMLElement>(`[data-block-id="${b.id}"]`);
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return cursorX >= r.left && cursorX <= r.right && cursorY >= r.top && cursorY <= r.bottom;
      });
      if (!over) {
        dropPreviewRef.current = null;
        setDropPreview(null);
        setAlignGuides([]);
        setSizeMatches([]);
        return;
      }
    }

    // Спецблок (Імʼя/Tagline/CTA…) у template-режимі: ghost показуємо ТІЛЬКИ
    // коли курсор над host-ом (Фото / Пустий блок). Інакше — drop буде відхилений
    // у handleDragEnd, не вводимо менеджера в оману «✓ Відпустіть щоб додати».
    // КРИТИЧНО: ghost має ВІДОБРАЖАТИ реальну позицію drop-у — x/width успадковані
    // від host-а, Y clamped у його вертикальний діапазон. Інакше менеджер бачить
    // ghost на іншому місці ніж дійсний drop position.
    if (isFromPalette && templateMode && idStr.startsWith("palette:")) {
      const t = idStr.replace("palette:", "") as BlockType;
      if (SPEC_BLOCK_TYPES_SET.has(t)) {
        const host = blocks.find(b => {
          if (b.type !== "image" && b.type !== "cardBody") return false;
          const el = canvasRef.current?.querySelector<HTMLElement>(`[data-block-id="${b.id}"]`);
          if (!el) return false;
          const r = el.getBoundingClientRect();
          return cursorX >= r.left && cursorX <= r.right && cursorY >= r.top && cursorY <= r.bottom;
        });
        if (!host) {
          dropPreviewRef.current = null;
          setDropPreview(null);
          setAlignGuides([]);
          setSizeMatches([]);
          return;
        }
        // Host знайдено — ghost preview = x/width host-а, Y у вільному gap-і
        // у межах host-а. Інші spec-блоки на тому ж host-і займають місце:
        // новий spec лягає поруч, а не поверх. findAvailableFitInColumn з
        // ignoreIds={host.id} рахує тільки інші блоки як занятий простір.
        const estH = TYPE_HEIGHT[t] ?? 40;
        const minH = MIN_H_BY_TYPE[t] ?? 20;
        const hostX = host.x ?? 0;
        const hostW = Number(host.width) || 100;
        const hostY = host.y ?? 0;
        const hostH = measureBlockHeight(host);
        const rawY = snapPx(cursorY - rect.top);
        const fit = findAvailableFitInColumn(hostX, hostW, rawY, estH, minH, {
          ignoreIds: new Set([host.id]),
          minY: hostY,
          maxY: hostY + hostH,
        });
        if (!fit) {
          // host повний — ghost ховаємо, drop буде відхилений
          dropPreviewRef.current = null;
          setDropPreview(null);
          setAlignGuides([]);
          setSizeMatches([]);
          return;
        }
        const final = { x: hostX, y: fit.y, width: hostW, height: fit.h };
        dropPreviewRef.current = final;
        setDropPreview(final);
        setAlignGuides([]);
        setSizeMatches([]);
        return;
      }
    }

    if (isFromPalette && over) {
      // Ghost показує реальний slot: Y = cursor Y, width підганяється під вільну
      // горизонтальну прорізку (defaultW якщо порожньо, менше якщо поруч сусіди).
      // Дефолтна ширина:
      //  - newsCard preview — 33% (картка-тизер у ряду по 3),
      //  - newsCard expanded — 100% (повний інлайн-контент новини),
      //  - template-режим — 40% (≈ розмір картки палітри): блок сідає компактним,
      //    менеджер потім розтягує мишкою. Divider — 100% (він і так full-row).
      //  - звичайний news builder — 100%.
      const paletteTypeForW = activePaletteRef.current?.type;
      const defaultW =
        idStr.startsWith("news-card:preview:") ? 33 :
        idStr.startsWith("news-card:") ? 100 :
        (templateMode && paletteTypeForW !== "divider") ? 40 :
        100;
      const xPx = cursorX - rect.left;
      const yPx = cursorY - rect.top;
      const cursorXPct = (xPx / rect.width) * 100;
      const slot = findDropSlot(null, cursorXPct, yPx, defaultW);
      const clamped = clampXY(slot.x, slot.y, slot.width);
      // У fixedHeight-режимі (card-builder) додатково клампимо Y по нижньому
      // краю канвасу за оцінкою висоти палітрового блока — щоб ghost не показував
      // позицію, де блок логічно вилазить за canvasHeight.
      const paletteType = activePaletteRef.current?.type;
      const estH = paletteType ? (TYPE_HEIGHT[paletteType] ?? 80) : 80;
      const clampedY = clampYBottom(clamped.y, estH);
      // У fixedHeight-режимі ghost відображає РЕАЛЬНИЙ слот, у який блок сяде:
      // findAvailableFitInColumn повертає {y, h} з auto-shrunk висотою. Без цього
      // ghost показує 80px, а блок матеріалізується на 40px — користувач плутається.
      let ghostY = clampedY;
      let ghostH: number | undefined = undefined;
      if (fixedHeight && paletteType) {
        const minH = MIN_H_BY_TYPE[paletteType] ?? 24;
        const fit = findAvailableFitInColumn(clamped.x, slot.width, clamped.y, estH, minH);
        if (fit) {
          ghostY = fit.y;
          ghostH = fit.h;
        } else if (templateMode) {
          // У template-режимі немає куди класти (column повний) → ховаємо ghost.
          // Drop і так буде відхилений у handleDragEnd; не показуємо misleading
          // preview на позиції курсора (наприклад, поверх Фото).
          dropPreviewRef.current = null;
          setDropPreview(null);
          setAlignGuides([]);
          setSizeMatches([]);
          return;
        }
      }
      const final = { x: clamped.x, y: ghostY, width: slot.width, height: ghostH };
      dropPreviewRef.current = final;
      setDropPreview(final);
    } else if (!isFromPalette) {
      // Існуючий блок — ghost йде за курсором + edge-snap до сусідніх блоків.
      const b = blocks.find(x => x.id === idStr);
      if (b) {
        const wPct = Number(b.width) || 100;
        const currentX = b.x ?? 0;
        const currentY = b.y ?? 0;
        const deltaXPct = ((event.delta?.x || 0) / rect.width) * 100;
        const deltaYPx = event.delta?.y || 0;
        // Bypass-snap: Alt під час drag-у відключає всю snap-логіку (Figma-стиль).
        // Користувач може поставити блок точно в позицію курсора без магніту до
        // сусідів і канвасу — корисно коли треба precision placement.
        const ev = event.activatorEvent as MouseEvent | undefined;
        // sourceEvent — оригінальний pointer move з dnd-kit; містить актуальний altKey.
        const sourceEvent = (event as unknown as { sourceEvent?: MouseEvent }).sourceEvent;
        const altKey = sourceEvent?.altKey ?? ev?.altKey ?? false;
        const rawX = altKey ? (currentX + deltaXPct) : snapPct(currentX + deltaXPct);
        const rawY = altKey ? (currentY + deltaYPx) : snapPx(currentY + deltaYPx);
        let { x, y } = clampXY(rawX, rawY, wPct);

        // === Snap + Alignment guides (Figma-style) ===
        // Толеранс по Y збільшено до 10px — щоб менеджеру було легше зловити
        // adjacent-snap (top↔bottom). Раніше 3px був занадто вузький для drag-у мишкою.
        // X-вісь і canvas-edge — тонше, бо там менше "магнітних" точок поспіль.
        const SNAP_TOL_X = 0.6;      // pct — толеранс снапу по X
        const SNAP_TOL_Y = 10;       // px — толеранс снапу по Y (touch/edge alignment)
        const Y_PROX_PX = 20;        // вертикальна "близькість" — лише блоки в межах рахуємо
        const X_PROX_PCT = 2;
        const CANVAS_EDGE_PCT = 1.5;
        const CANVAS_EDGE_PX = 6;
        const bh = measureBlockHeight(b);

        // 1) Canvas-edge snap — пріоритет над block-edge. При altKey — пропускаємо.
        let lockedX = false;
        let lockedY = false;
        if (!altKey) {
          if (x + wPct >= 100 - CANVAS_EDGE_PCT) {
            x = Math.max(0, 100 - wPct);
            lockedX = true;
          } else if (x <= CANVAS_EDGE_PCT) {
            x = 0;
            lockedX = true;
          }
          if (y <= CANVAS_EDGE_PX) {
            y = 0;
            lockedY = true;
          }
        }

        // 2) Збираємо ВСІ кандидати на snap (по 5 для кожної осі):
        //    edges (4 кейси) + center (1 кейс) на блок. Беремо найближчий.
        type Cand = { newPos: number; dist: number };
        const xCands: Cand[] = [];
        const yCands: Cand[] = [];
        // Alt — повний bypass snap-у до сусідів (Figma-стиль).
        for (const o of altKey ? [] : blocks) {
          if (o.id === b.id) continue;
          const ox = o.x ?? 0;
          const oy = o.y ?? 0;
          const ow = Number(o.width) || 100;
          const oh = measureBlockHeight(o);
          const oRight = ox + ow;
          const oCenterX = ox + ow / 2;
          const oBottom = oy + oh;
          const oCenterY = oy + oh / 2;

          const yNear = y < oBottom + Y_PROX_PX && y + bh > oy - Y_PROX_PX;
          const xNear = x < oRight + X_PROX_PCT && x + wPct > ox - X_PROX_PCT;

          if (yNear && !lockedX) {
            // edge snaps
            const lr = Math.abs(x - oRight);                  // a.left ↔ o.right (touch)
            if (lr <= SNAP_TOL_X) xCands.push({ newPos: oRight, dist: lr });
            const rl = Math.abs((x + wPct) - ox);             // a.right ↔ o.left (touch)
            if (rl <= SNAP_TOL_X) xCands.push({ newPos: Math.max(0, ox - wPct), dist: rl });
            const ll = Math.abs(x - ox);                      // a.left ↔ o.left
            if (ll <= SNAP_TOL_X) xCands.push({ newPos: ox, dist: ll });
            const rr = Math.abs((x + wPct) - oRight);         // a.right ↔ o.right
            if (rr <= SNAP_TOL_X) xCands.push({ newPos: Math.max(0, oRight - wPct), dist: rr });
            const cc = Math.abs((x + wPct / 2) - oCenterX);   // center ↔ center
            if (cc <= SNAP_TOL_X) xCands.push({ newPos: Math.max(0, oCenterX - wPct / 2), dist: cc });
          }
          if (xNear && !lockedY) {
            const tb = Math.abs(y - oBottom);                 // a.top ↔ o.bottom
            if (tb <= SNAP_TOL_Y) yCands.push({ newPos: oBottom, dist: tb });
            const bt = Math.abs((y + bh) - oy);               // a.bottom ↔ o.top
            if (bt <= SNAP_TOL_Y) yCands.push({ newPos: Math.max(0, oy - bh), dist: bt });
            const tt = Math.abs(y - oy);                      // a.top ↔ o.top
            if (tt <= SNAP_TOL_Y) yCands.push({ newPos: oy, dist: tt });
            const bb = Math.abs((y + bh) - oBottom);          // a.bottom ↔ o.bottom
            if (bb <= SNAP_TOL_Y) yCands.push({ newPos: Math.max(0, oBottom - bh), dist: bb });
            const cy = Math.abs((y + bh / 2) - oCenterY);     // center ↔ center
            if (cy <= SNAP_TOL_Y) yCands.push({ newPos: Math.max(0, oCenterY - bh / 2), dist: cy });
          }
        }
        if (!lockedX && xCands.length > 0) {
          xCands.sort((a, b) => a.dist - b.dist);
          x = xCands[0].newPos;
        }
        if (!lockedY && yCands.length > 0) {
          yCands.sort((a, b) => a.dist - b.dist);
          y = yCands[0].newPos;
        }

        // У fixedHeight-режимі — фінальний clamp Y по нижньому краю канвасу.
        y = clampYBottom(y, bh);

        // У template-режимі спецблок ОБМЕЖЕНИЙ рамками host-а (image/cardBody):
        // ghost має відображати реальну посадку (fit-within-host), а не сире
        // cursor+snap. Без цього ghost показує overlap на іншому spec-блоці,
        // але handleDragEnd зміщує блок у сусідній gap — менеджер плутається.
        if (templateMode && SPEC_BLOCK_TYPES_SET.has(b.type)) {
          const hosts = blocks.filter(o => (o.type === "image" || o.type === "cardBody") && o.id !== b.id);
          const host = hosts.find(h => {
            const ix = h.x ?? 0;
            const iy = h.y ?? 0;
            const iw = Number(h.width) || 100;
            const ih = measureBlockHeight(h);
            const overlapX = x + wPct > ix + 0.5 && x < ix + iw - 0.5;
            const overlapY = y + bh > iy + 4 && y < iy + ih - 4;
            return overlapX && overlapY;
          });
          if (!host) {
            dropPreviewRef.current = null;
            setDropPreview(null);
            setAlignGuides([]);
            setSizeMatches([]);
            return;
          }
          const hostY = host.y ?? 0;
          const hostH = measureBlockHeight(host);
          const minH = MIN_H_BY_TYPE[b.type] ?? 20;
          const fit = findAvailableFitInColumn(x, wPct, y, bh, minH, {
            ignoreIds: new Set([host.id, b.id]),
            minY: hostY,
            maxY: hostY + hostH,
          });
          if (!fit) {
            dropPreviewRef.current = null;
            setDropPreview(null);
            setAlignGuides([]);
            setSizeMatches([]);
            return;
          }
          dropPreviewRef.current = { x, y: fit.y, width: wPct };
          setDropPreview({ x, y: fit.y, width: wPct });
          setAlignGuides([]);
          setSizeMatches([]);
          return;
        }

        // 3) Після снапу — детектимо ВСІ alignments через спільний helper.
        detectAlignmentsAt(b.id, x, y, wPct, bh);
        dropPreviewRef.current = { x, y, width: wPct };
        setDropPreview({ x, y, width: wPct });

        // Live displacement preview: симулюємо displaceBlocksAround для поточної drop-
        // позиції. Виконується через requestAnimationFrame — інакше mousemove (60+ Hz)
        // спамить сим (до 30 iterations × кількість блоків) і весь drag лагає.
        // У template-режимі — пропускаємо: блоки вільно перекриваються, displacement
        // не потрібний.
        if (templateMode) {
          return;
        }
        liveSimPendingRef.current = { x, y, wPct, bh, bId: b.id };
        if (liveSimRafRef.current === null) {
          liveSimRafRef.current = requestAnimationFrame(() => {
            liveSimRafRef.current = null;
            const pending = liveSimPendingRef.current;
            if (!pending) return;
            const simRect = { x: pending.x, y: pending.y, width: pending.wPct, height: pending.bh };
            const simulated = displaceBlocksAround(simRect, blocks, pending.bId);
            const changed = new Set<string>();
            for (const sim of simulated) {
              if (sim.id === pending.bId) continue;
              const orig = blocks.find(o => o.id === sim.id);
              if (!orig) continue;
              const origW = Number(orig.width) || 100;
              const simW = Number(sim.width) || 100;
              const origX = orig.x ?? 0;
              const simX = sim.x ?? 0;
              const origY = orig.y ?? 0;
              const simY = sim.y ?? 0;
              if (Math.abs(simW - origW) > 0.5) {
                setPreview(sim.id, simW);
                changed.add(sim.id);
              }
              if (Math.abs(simX - origX) > 0.5) {
                setPreviewX(sim.id, simX);
                changed.add(sim.id);
              }
              if (Math.abs(simY - origY) > 1) {
                setPreviewY(sim.id, simY);
                changed.add(sim.id);
              }
            }
            // Очищуємо preview для блоків, які при цій drop-позиції не зачіпаються —
            // інакше вони "застрягнуть" у попередньому preview-стані з минулого frame.
            for (const o of blocks) {
              if (o.id === pending.bId || changed.has(o.id)) continue;
              clearPreview(o.id);
              clearPreviewX(o.id);
              clearPreviewY(o.id);
            }
          });
        }
      }
    }
  }, [blocks, canvasWidthPx, setPreview, setPreviewX, setPreviewY, clearPreview, clearPreviewX, clearPreviewY, detectAlignmentsAt, templateMode]);

  // Перевіряє чи позиція x/y/width+height перекриває якийсь блок (крім excludeId).
  function hasCollision(x: number, y: number, width: number, height: number, excludeId: string | null): boolean {
    const others = blocks.filter(b => b.id !== excludeId);
    for (const b of others) {
      const bx = b.x ?? 0;
      const by = b.y ?? 0;
      const bw = Number(b.width) || 100;
      const bh = measureBlockHeight(b);
      const overlapX = x + width > bx + 0.5 && x < bx + bw - 0.5;
      const overlapY = y + height > by + 4 && y < by + bh - 4;
      if (overlapX && overlapY) return true;
    }
    return false;
  }

  // Те ж саме, але проти переданого списку (а не поточного `blocks`). Використовується
  // для перевірки чи displaceBlocksAround РОЗВ'ЯЗАВ overlap (post-displacement).
  function hasCollisionIn(
    x: number, y: number, width: number, height: number,
    list: Block[], excludeId: string | null,
  ): boolean {
    for (const b of list) {
      if (b.id === excludeId) continue;
      const bx = b.x ?? 0;
      const by = b.y ?? 0;
      const bw = Number(b.width) || 100;
      const bh = measureBlockHeight(b);
      const overlapX = x + width > bx + 0.5 && x < bx + bw - 0.5;
      const overlapY = y + height > by + 4 && y < by + bh - 4;
      if (overlapX && overlapY) return true;
    }
    return false;
  }

  // Шукає найкращий вертикальний слот для нового блока у фіксованому канвасі
  // (preview-картка 360×400). Сканує всі вільні Y-інтервали в X-діапазоні
  // [x, x+width], відкидає ті, що менші за minH, повертає найближчий до prefY
  // зі стиснутою до доступного простору висотою.
  // Повертає null якщо в X-діапазоні взагалі немає gap-а >= minH (тоді drop
  // має бути скасований з feedback-ом).
  function findAvailableFitInColumn(
    x: number,
    width: number,
    prefY: number,
    defaultH: number,
    minH: number,
    opts?: { ignoreIds?: Set<string>; minY?: number; maxY?: number },
  ): { y: number; h: number } | null {
    // Опційний скоуп: діапазон Y (для spec-on-host — у межах host-а) +
    // ignoreIds (виключити сам host з occupants, щоб spec міг лягти на нього).
    const rangeStart = opts?.minY ?? 0;
    const rangeEnd = opts?.maxY ?? canvasHeight;
    const ignore = opts?.ignoreIds;
    // Усі блоки, що мають горизонтальне перекриття з потрібним X-діапазоном.
    // occupants підрізаємо до [rangeStart, rangeEnd] — частини блоків поза скоупом
    // не блокують gaps.
    const occupants = blocks
      .filter(b => !ignore?.has(b.id))
      .filter(b => {
        const bx = b.x ?? 0;
        const bw = Number(b.width) || 100;
        return bx < x + width - 0.5 && bx + bw > x + 0.5;
      })
      .map(b => {
        const oy = b.y ?? 0;
        const oh = measureBlockHeight(b);
        const start = Math.max(oy, rangeStart);
        const end = Math.min(oy + oh, rangeEnd);
        return { y: start, h: end - start };
      })
      .filter(o => o.h > 0)
      .sort((a, b) => a.y - b.y);

    // Збираємо вільні інтервали [start, end] у межах [rangeStart, rangeEnd].
    const gaps: Array<{ start: number; end: number }> = [];
    let cursor = rangeStart;
    for (const occ of occupants) {
      if (occ.y > cursor + 0.5) gaps.push({ start: cursor, end: occ.y });
      cursor = Math.max(cursor, occ.y + occ.h);
    }
    if (cursor < rangeEnd - 0.5) gaps.push({ start: cursor, end: rangeEnd });

    const usable = gaps.filter(g => g.end - g.start >= minH);
    if (usable.length === 0) return null;

    // Найближчий gap до prefY (по start). При рівній відстані — вищий пріоритет
    // у того, що включає prefY.
    usable.sort((a, b) => {
      const da = prefY >= a.start && prefY <= a.end ? 0 : Math.min(Math.abs(prefY - a.start), Math.abs(prefY - a.end));
      const db = prefY >= b.start && prefY <= b.end ? 0 : Math.min(Math.abs(prefY - b.start), Math.abs(prefY - b.end));
      return da - db;
    });
    const best = usable[0];
    const slotH = best.end - best.start;
    const h = Math.min(defaultH, slotH);
    // Сідаємо біля prefY у межах gap-а; якщо prefY поза gap-ом — на найближчий край.
    let y = Math.max(best.start, Math.min(best.end - h, prefY));
    y = snapPx(y);
    // Після snap може вилізти за межі gap-а — клампимо.
    y = Math.max(best.start, Math.min(best.end - h, y));
    return { y, h };
  }

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const idStr = String(event.active.id);
    const isPalette = idStr.startsWith("palette:");
    const isNewsCard = idStr.startsWith("news-card:");
    const isTemplateExpand = idStr.startsWith("template-expand:");
    const isFromPalette = isPalette || isNewsCard || isTemplateExpand;
    const preview = dropPreviewRef.current;
    const rect = canvasRectRef.current;

    setActiveId(null);
    setIsOverCanvas(false);
    dropPreviewRef.current = null;
    setDropPreview(null);
    setAlignGuides([]);
    setSizeMatches([]);
    if (liveSimRafRef.current !== null) {
      cancelAnimationFrame(liveSimRafRef.current);
      liveSimRafRef.current = null;
    }
    liveSimPendingRef.current = null;

    if (isFromPalette) {
      if (!rect) return;
      const ev = event.activatorEvent as MouseEvent;
      const cursorX = ev.clientX + (event.delta?.x || 0);
      const cursorY = ev.clientY + (event.delta?.y || 0);
      if (cursorX < rect.left || cursorX > rect.right || cursorY < rect.top) return;

      // Спецкейс: template-expand → створюємо ОДИН блок-шаблон (templateInstance)
      // який рендерить весь лейаут шаблону всередині своїх меж. Менеджер клікає
      // на блок → відкривається загальний редактор-форма (ArticleForm/EventForm),
      // а не редактори окремих блоків. Так шаблон поводиться як єдиний "віджет".
      if (isTemplateExpand) {
        const data = event.active.data?.current as
          | { templateId?: string; templateBlocks?: string; templateCanvas?: string; templateKind?: "ARTICLE" | "EVENT" }
          | undefined;
        const templateId = data?.templateId || "";
        if (!templateId) return;

        // Природний розмір canvas-у шаблону (наприклад "800x448").
        let tplW = 600;
        let tplH = 400;
        if (data?.templateCanvas) {
          const m = data.templateCanvas.match(/^(\d+)x(\d+)$/);
          if (m) { tplW = Number(m[1]) || tplW; tplH = Number(m[2]) || tplH; }
        }

        // Обчислюємо РЕАЛЬНУ bounding-box контенту шаблону (а не повний canvas),
        // щоб блок не мав зайвого порожнього простору. Якщо менеджер залишив
        // canvas з відступами навколо блоків, обрізаємо до фактичних меж.
        let contentW = tplW;
        let contentH = tplH;
        try {
          const parsed = JSON.parse(data?.templateBlocks || "[]");
          if (Array.isArray(parsed) && parsed.length > 0) {
            let maxRightPct = 0;
            let maxBottomPx = 0;
            for (const b of parsed as Array<{ x?: number; y?: number; width?: string | number; height?: number; type?: string }>) {
              const bx = Number(b.x ?? 0);
              const by = Number(b.y ?? 0);
              const bw = Number(b.width ?? 100);
              const bh = Number(b.height ?? 80);
              maxRightPct = Math.max(maxRightPct, bx + bw);
              maxBottomPx = Math.max(maxBottomPx, by + bh);
            }
            if (maxRightPct > 0) contentW = Math.round(tplW * Math.min(maxRightPct, 100) / 100);
            if (maxBottomPx > 0) contentH = Math.min(tplH, maxBottomPx);
          }
        } catch {
          /* fallback на повний canvas */
        }

        // Стискаємо до CANVAS_WIDTH сторінки (920), якщо ширше.
        const widthPct = Math.min(100, Math.round((contentW / CANVAS_WIDTH) * 100));
        const scaledH = Math.round(contentH * (widthPct * CANVAS_WIDTH / 100) / contentW);

        const newId = uid();
        const x = preview?.x ?? 0;
        const y = preview?.y ?? snapPx(cursorY - rect.top);
        const newBlock: Block = {
          id: newId,
          type: "templateInstance",
          data: {
            templateId,
            templateKind: data?.templateKind || "EVENT",
            templateBlocks: data?.templateBlocks || "",
            // Зберігаємо ОБРІЗАНІ розміри canvas для render-у — placeholder-блоки
            // позиціонуються відносно цього canvas-у.
            templateCanvas: `${contentW}x${contentH}`,
            // templateData — JSON ArticleData/EventData, наповнюється у формі-редакторі.
            templateData: "",
          },
          width: String(widthPct),
          align: "left",
          bgColor: "",
          x: Math.max(0, Math.min(100 - widthPct, x)),
          y: Math.max(0, y),
          height: scaledH,
        };
        onBlocksChange([...blocks, newBlock]);
        setLastAddedId(newId);
        return;
      }

      // Спецкейс: image-overlay → drop ТІЛЬКИ у image-блок з url під курсором.
      // Якщо курсор не над таким блоком — drop тихо відхиляється (без alert).
      if (idStr === "palette:image-overlay") {
        const candidates = blocks.filter(b => b.type === "image" && b.data.url);
        let target: Block | null = null;
        let relX = 50, relY = 50;
        for (const b of candidates) {
          const el = canvasRef.current?.querySelector<HTMLElement>(`[data-block-id="${b.id}"]`);
          if (!el) continue;
          const r = el.getBoundingClientRect();
          if (cursorX >= r.left && cursorX <= r.right && cursorY >= r.top && cursorY <= r.bottom) {
            target = b;
            relX = ((cursorX - r.left) / r.width) * 100;
            relY = ((cursorY - r.top) / r.height) * 100;
            break;
          }
        }
        if (!target) return; // не на image-з-url → skip silently
        let arr: Array<Record<string, unknown>> = [];
        try { const p = JSON.parse(target.data.overlays || "[]"); if (Array.isArray(p)) arr = p; } catch { /* ignore */ }
        const newId = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `ov_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        arr.push({ id: newId, text: "", x: 0, y: Math.max(0, Math.min(88, relY - 6)), w: 100, h: 12, fontSize: 32, color: "#FFFFFF", weight: 700, bgColor: "#1C3A2E" });
        const targetId = target.id;
        onBlocksChange(blocks.map(b => b.id === targetId ? { ...b, data: { ...b.data, overlays: JSON.stringify(arr) } } : b));
        return;
      }

      const type: BlockType = isNewsCard ? "newsCard" : (idStr.replace("palette:", "") as BlockType);

      // У template-режимі спецблоки (semantic slots) можна класти ТІЛЬКИ на
      // блок-host: Фото або Пустий блок (cardBody). Drop на порожнє місце
      // або інший блок — скасовується.
      let specImageHost: Block | null = null;
      if (templateMode && SPEC_BLOCK_TYPES_SET.has(type)) {
        const hostUnderCursor = blocks.find(b => {
          if (b.type !== "image" && b.type !== "cardBody") return false;
          const el = canvasRef.current?.querySelector<HTMLElement>(`[data-block-id="${b.id}"]`);
          if (!el) return false;
          const r = el.getBoundingClientRect();
          return cursorX >= r.left && cursorX <= r.right && cursorY >= r.top && cursorY <= r.bottom;
        });
        if (!hostUnderCursor) return; // нема host під курсором — drop відхилено
        specImageHost = hostUnderCursor;
      }
      // news-card id формат: `news-card:<mode>:<newsId>` (mode = preview|expanded).
      // Backward compat: старий формат `news-card:<newsId>` без mode → дефолт preview.
      let droppedNewsId = "";
      let droppedMode: "preview" | "expanded" = "preview";
      if (isNewsCard) {
        const rest = idStr.replace("news-card:", "");
        const firstColon = rest.indexOf(":");
        if (firstColon > 0) {
          const m = rest.slice(0, firstColon);
          if (m === "preview" || m === "expanded") droppedMode = m;
          droppedNewsId = rest.slice(firstColon + 1);
        } else {
          droppedNewsId = rest;
        }
      }
      const newId = uid();
      // Дефолтна висота: для newsCard preview — 400 (= PREVIEW_CARD_HEIGHT канвасу
      // білдера превʼю), expanded — буде підлаштовано auto-effect-ом NewsCardEditor
      // під канвас новини. Для решти — TYPE_HEIGHT.
      const estH =
        type === "newsCard" && droppedMode === "preview"
          ? 400
          : (TYPE_HEIGHT[type] ?? 80);

      // Новий блок сідає ТУДИ, куди ти його кинув (preview) — а існуючі адаптуються.
      // Divider: завжди 100% ширини; решта: використовуємо preview (smart slot).
      let x: number, y: number, width: number;
      // Для spec-on-host фіксуємо вже підраховану висоту (з findAvailableFitInColumn),
      // щоб уникнути повторного fit-у нижче. null = звичайний flow.
      let specFitH: number | null = null;
      if (type === "divider") {
        x = 0; y = snapPx(cursorY - rect.top); width = 100;
      } else if (specImageHost) {
        // Спецблок дропнутий на host (Фото або Пустий блок) — успадковуємо
        // x і width host-а. Y знаходимо у вільному gap-і всередині host-а
        // через findAvailableFitInColumn(ignoreIds={host}). Це гарантує:
        //  - блок повністю всередині host-а вертикально,
        //  - інші spec-блоки на цьому ж host-і трактуються як занятий простір
        //    (нові spec лягають ПОРУЧ, не поверх один одного).
        x = specImageHost.x ?? 0;
        width = Number(specImageHost.width) || 100;
        const hostY = specImageHost.y ?? 0;
        const hostH = measureBlockHeight(specImageHost);
        const rawY = snapPx(cursorY - rect.top);
        const minH = MIN_H_BY_TYPE[type] ?? 20;
        const fit = findAvailableFitInColumn(x, width, rawY, estH, minH, {
          ignoreIds: new Set([specImageHost.id]),
          minY: hostY,
          maxY: hostY + hostH,
        });
        if (!fit) return; // host повний spec-блоками — drop відхиляємо
        y = fit.y;
        specFitH = fit.h;
      } else {
        x = preview?.x ?? 0; y = preview?.y ?? 0; width = preview?.width ?? 100;
      }
      const clamped = clampXY(x, y, width);
      // У fixedHeight-режимі — додатковий clamp Y по нижньому краю канвасу.
      const clampedY = clampYBottom(clamped.y, estH);

      // У fixedHeight-режимі (preview-картка 360×400) канвас не росте, тож
      // авто-фітимо новий блок у найближчий вільний gap у потрібному X-діапазоні —
      // блок сам стискається під доступний простір (heading 80 → 40 коли YouTube
      // на 360px знизу лишив тільки 40px). Тільки якщо взагалі немає gap-а
      // >= MIN_H_BY_TYPE — drop скасовується. Уникає silent-failure-у displacement-у.
      let finalY = clampedY;
      let finalH = specFitH ?? estH;
      let finalBlocks = blocks;
      // У template-режимі ТІЛЬКИ спецблоки (Імʼя/Tagline/CTA…) лягають поверх
      // host-а (Фото / Пустий блок) — це їх задача-слотів. Generic-блоки
      // (Заголовок/Текст/Фото/YouTube/Цитата/Лінія) поводяться як у звичайному
      // page-builder-і: auto-fit у вільний gap, без overlap.
      const isSpecOnHost = templateMode && SPEC_BLOCK_TYPES_SET.has(type);
      if (fixedHeight && !isSpecOnHost) {
        const minH = MIN_H_BY_TYPE[type] ?? 24;
        const fit = findAvailableFitInColumn(clamped.x, width, clamped.y, estH, minH);
        if (!fit) return; // канвас повний у цьому X-діапазоні
        finalY = fit.y;
        finalH = fit.h;
      } else if (isSpecOnHost) {
        // Спецблок поверх host: x/width успадковані від host-а вище (специальний
        // блок ВЖЕ позиційно лежить на ньому). Без collision-check, без fit-у.
      } else if (hasCollision(clamped.x, clampedY, width, estH, null)) {
        // Free-canvas (page-builder): displaceBlocksAround стискає/опускає сусідів.
        finalBlocks = displaceBlocksAround(
          { x: clamped.x, y: clampedY, width, height: estH },
          blocks,
          null,
        );
      }

      // Дефолтні data: для newsCard — ID конкретної новини + displayMode з drag-source
      // (preview = клікабельна превʼю-картка; expanded = повний інлайн-контент).
      const defaultData: Record<string, string> =
        type === "newsCard"
          ? { newsId: droppedNewsId, displayMode: droppedMode }
          : {};
      const newBlock: Block = {
        id: newId, type, data: defaultData,
        width: String(roundW(width)), align: "left", bgColor: "",
        x: clamped.x, y: finalY,
        // ⚠️ Явна height ОБОВ'ЯЗКОВА: інакше wrapper стає auto, content всередині
        // (наприклад YouTube iframe) рендериться, але block-чи canvasHeight рахується
        // ДО того як content підвантажився → блок вилазить за canvas.
        // Для divider/text/heading/quote — TYPE_HEIGHT теж дає sane default.
        // У fixedHeight finalH стиснута під доступний слот (auto-fit).
        height: finalH,
      };
      onBlocksChange([...finalBlocks, newBlock]);
      setLastAddedId(newId);
      return;
    }

    // Existing block drag — block лишається де ти його кинув, сусіди адаптуються.
    const idx = blocks.findIndex(b => b.id === idStr);
    if (idx < 0) return;
    clearPreview(idStr);
    const b = blocks[idx];
    const bh = measureBlockHeight(b);

    // Fallback: якщо handleDragMove не встиг проставити dropPreview (швидкий
    // drag через важкі сусіди, або throw у sim) — обчислюємо позицію з
    // event.delta. Інакше блок «снапить» назад на старе місце, що плутає.
    let resolvedPreview = preview;
    if (!resolvedPreview) {
      const wPct = Number(b.width) || 100;
      const currentX = b.x ?? 0;
      const currentY = b.y ?? 0;
      const deltaXPct = rect ? ((event.delta?.x || 0) / rect.width) * 100 : 0;
      const deltaYPx = event.delta?.y || 0;
      const fbX = Math.max(0, Math.min(100 - wPct, currentX + deltaXPct));
      const fbY = Math.max(0, currentY + deltaYPx);
      resolvedPreview = { x: fbX, y: fbY, width: wPct };
    }

    // У fixedHeight-режимі ще раз клампимо Y по нижньому краю canvas-у —
    // safety net на випадок коли preview не пройшов через clampYBottom.
    let finalY = clampYBottom(resolvedPreview.y, bh);

    // У template-режимі спецблок переміщується ТІЛЬКИ всередині host-а
    // (Фото або Пустий блок), і НЕ повинен перекривати інші spec/generic
    // блоки на цьому ж host-і. Логіка ідентична drop-у з палітри (див.
    // SECTION «specImageHost» вище):
    //   1. знаходимо host, з яким target rect перекривається;
    //   2. через findAvailableFitInColumn(ignoreIds={host, self}) шукаємо
    //      вільне місце у вертикальному діапазоні host-а;
    //   3. якщо host не знайдено АБО fit не існує — move скасовується.
    if (templateMode && SPEC_BLOCK_TYPES_SET.has(b.type)) {
      const hosts = blocks.filter(o => (o.type === "image" || o.type === "cardBody") && o.id !== b.id);
      const host = hosts.find(h => {
        const ix = h.x ?? 0;
        const iy = h.y ?? 0;
        const iw = Number(h.width) || 100;
        const ih = measureBlockHeight(h);
        const overlapX = resolvedPreview.x + resolvedPreview.width > ix + 0.5 && resolvedPreview.x < ix + iw - 0.5;
        const overlapY = finalY + bh > iy + 4 && finalY < iy + ih - 4;
        return overlapX && overlapY;
      });
      if (!host) return; // не на host — скасовуємо move (повертається на місце)
      const hostY = host.y ?? 0;
      const hostH = measureBlockHeight(host);
      const minH = MIN_H_BY_TYPE[b.type] ?? 20;
      const fit = findAvailableFitInColumn(
        resolvedPreview.x, resolvedPreview.width, finalY, bh, minH,
        { ignoreIds: new Set([host.id, b.id]), minY: hostY, maxY: hostY + hostH },
      );
      if (!fit) return; // host повний (інші spec блоки) — скасовуємо
      finalY = fit.y;
    }

    let next = blocks.slice();
    next[idx] = { ...next[idx], x: resolvedPreview.x, y: finalY };

    // У template-режимі спецблоки (Імʼя/Tagline/CTA…) вільно перекривають host
    // (image/cardBody) — це їх задача. Generic-блоки (Заголовок/Текст/Фото…)
    // поводяться як у звичайному page-builder-і: displaceBlocksAround стискає
    // або опускає сусідів, щоб уникнути overlap-у.
    const isSpecBlockMove = templateMode && SPEC_BLOCK_TYPES_SET.has(b.type);
    if (!isSpecBlockMove && hasCollision(resolvedPreview.x, finalY, resolvedPreview.width, bh, b.id)) {
      next = displaceBlocksAround(
        { x: resolvedPreview.x, y: finalY, width: resolvedPreview.width, height: bh },
        next,
        b.id,
      );
      // У card-builder-і — якщо overlap не розв'язано (canvas повний), скасовуємо
      // переміщення: блок повертається на місце.
      if (fixedHeight && hasCollisionIn(resolvedPreview.x, finalY, resolvedPreview.width, bh, next, b.id)) {
        return;
      }
    }

    onBlocksChange(next);
    // Очищаємо всі previewX/Y у сусідів — drag завершено, далі block.x/.y канонічні.
    for (const o of blocks) {
      if (o.id === idStr) continue;
      clearPreviewX(o.id);
      clearPreviewY(o.id);
    }
  }, [blocks, onBlocksChange, clearPreview, clearPreviewX, clearPreviewY, canvasHeight]);

  const paletteBlock = (activeId?.startsWith("palette:") || activeId?.startsWith("news-card:") || activeId?.startsWith("template-expand:"))
    ? activePaletteRef.current
    : null;

  function blockWidthPct(b: Block): number {
    const preview = previewWidths[b.id];
    return preview !== undefined ? preview : Number(b.width) || 100;
  }

  return (
    <>
      <style>{`
        @keyframes block-snap-in {
          0%   { opacity: 0; transform: scale(0.9) translateY(10px); }
          60%  { opacity: 1; transform: scale(1.02) translateY(-3px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .block-just-added { animation: block-snap-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
        @keyframes snap-edge-pulse {
          0%   { opacity: 0.85; transform: scale(1); }
          100% { opacity: 1;    transform: scale(1.05); }
        }
        .canvas-grid {
          background-image:
            linear-gradient(to right, rgba(28,58,46,0.035) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(28,58,46,0.035) 1px, transparent 1px);
          background-size: ${SNAP * 4}px ${SNAP * 4}px;
        }
      `}</style>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        // Агресивніший auto-scroll: трешхолд 25% від краю viewport (було 20%
        // дефолт) і прискорення 25 (дефолт 10). Без цього довгий drag угору
        // "обганяв" auto-scroll і блок зникав за верх viewport-а.
        autoScroll={{
          threshold: { x: 0, y: 0.25 },
          acceleration: 25,
        }}
      >
        <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, alignSelf: "flex-start" }}>
            {abovePaletteSlot}
          <BlockPalette
            extraBlocks={extraPaletteBlocks}
            extraBlocksTitle={extraPaletteBlocksTitle}
            compact={templateMode}
            wide={paletteWide}
            lockLayout={lockLayout}
            selectedBlockY={(() => {
              if (!selectedBlockId) return null;
              const sel = blocks.find(b => b.id === selectedBlockId);
              return sel?.y ?? null;
            })()}
            onAddImageOverlay={() => {
            // Знаходимо ОСТАННІЙ image-блок з url. Якщо нема — нічого не робимо.
            const targets = blocks.filter(b => b.type === "image" && b.data.url);
            if (targets.length === 0) {
              alert("Спершу додайте блок Фото з картинкою");
              return;
            }
            const target = targets[targets.length - 1];
            let arr: Array<Record<string, unknown>> = [];
            try { const p = JSON.parse(target.data.overlays || "[]"); if (Array.isArray(p)) arr = p; } catch { /* ignore */ }
            const id = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `ov_${Date.now()}_${Math.random().toString(36).slice(2)}`;
            arr.push({ id, text: "", x: 0, y: 44, w: 100, h: 12, fontSize: 32, color: "#FFFFFF", weight: 700, bgColor: "#1C3A2E" });
            onBlocksChange(blocks.map(b => b.id === target.id ? { ...b, data: { ...b.data, overlays: JSON.stringify(arr) } } : b));
          }} />
          </div>

          <div
            ref={canvasColumnRef}
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              // alignItems заборонений — використовуємо `marginInline: auto` на дітях
              // (canvas-label / canvas wrapper). Так канвас центрується якщо вміщається,
              // і притискається до лівого краю (з horizontal scroll) якщо ширший за колонку.
              alignItems: "stretch",
              // Канвас завжди рендериться у логічній ширині (PAGE_WIDTH + paddings).
              // Якщо колонка вужча — скрол відбувається ВСЕРЕДИНІ колонки, а палітра
              // і right-sidebar лишаються на місці. Це стандартний паттерн design-tool-ів
              // (Webflow): точні пропорції без CSS-масштабування й без ризику math-багів
              // у dnd-kit при scale<1.
              overflowX: "auto",
              overflowY: "visible",
            }}
            onClick={(e) => { if (e.target === e.currentTarget) setSelectedBlockId(null); }}
          >
            {/* Canvas-label row — лише коли caller дав canvasLabel або немає
                canvasTopToolbar (тобто не template-режим з уніфікованим toolbar-ом).
                marginInline:auto — центрує label коли він вужчий за колонку,
                і притискає до лівого краю коли ширший (синхронно з канвасом). */}
            {(canvasLabel || !canvasTopToolbar) && (
              <div style={{
                width: `${VISIBLE_WRAPPER_W}px`,
                marginInline: "auto",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 4px 10px",
                fontSize: "10px",
                fontWeight: 700,
                color: "#9CA3AF",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
              }}>
                <span>{canvasLabel?.left ?? "📄 Сторінка новини"}</span>
                <span style={{ color: "#D4A843" }}>
                  {canvasLabel?.right ?? `${PAGE_WIDTH}px — така ширина на сайті`}
                </span>
              </div>
            )}

            {/* Якщо є canvasLeftToolbar — рендеримо ліворуч від канвасу у flex-row.
                alignItems: stretch — щоб toolbar тягнувся на висоту канвасу
                (template-режим: вертикальні пресети «вздовж лівого краю»).
                canvasTopToolbar інлайнимо у колонку поруч з канвасом — щоб
                його лівий край збігався з лівим краєм canvas-у. */}
            <div style={{ display: "flex", gap: 8, alignItems: "stretch", width: canvasLeftToolbar ? "100%" : `${VISIBLE_WRAPPER_W}px`, marginInline: "auto", flexShrink: 0 }}>
              {canvasLeftToolbar && (
                <div style={{ flexShrink: 0, display: "flex" }}>{canvasLeftToolbar}</div>
              )}
            <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, alignItems: "flex-start" }}>
            {canvasTopToolbar && (
              <div style={{
                maxWidth: `${VISIBLE_WRAPPER_W}px`,
                marginTop: -18,
                marginBottom: 12,
              }}>
                {canvasTopToolbar}
              </div>
            )}
            <div
              onClick={(e) => { if (e.target === e.currentTarget) setSelectedBlockId(null); }}
              style={{
                // Канвас тримає фіксовану видиму ширину (VISIBLE_WRAPPER_W). У режимі
                // displayBaseWidth каркас «папера» не змінюється коли менеджер збільшує
                // pageWidth — натомість вміст всередині (canvas-grid) масштабується
                // через CSS zoom, тож блоки візуально стискаються. У легасі-режимі
                // (без displayBaseWidth) VISIBLE_WRAPPER_W === PAGE_WIDTH + PAD*2.
                width: `${VISIBLE_WRAPPER_W}px`,
                flexShrink: 0,
                background: pageBgColor || "#FFFFFF",
                borderRadius: templateMode ? 12 : 14,
                // У template-режимі — субтильний амбер-accent border (когезія з палітрою)
                // + легша тінь. У звичайному — як було.
                border: templateMode ? "1px solid rgba(212,168,67,0.18)" : "1px solid #E5E7EB",
                boxShadow: templateMode
                  ? "0 1px 2px rgba(0,0,0,0.03), 0 6px 24px rgba(15,32,25,0.06)"
                  : "0 1px 2px rgba(0,0,0,0.04), 0 12px 40px rgba(15,32,25,0.08)",
                // У template-режимі — менший padding, щоб канвас не "плавав" у
                // зайвій білій зоні. Право-низ лишаємо більше, бо там corner-handle.
                padding: templateMode
                  ? `16px 16px 22px 16px`
                  : `${PAGE_PAD_Y}px ${PAGE_PAD_X}px`,
                position: "relative",
              }}
            >
              {/* Page-width ruler — рендериться ПОЗА canvas-grid (у padding-зоні
                  page-wrapper), щоб у fixedHeight-режимі (overflow:hidden на
                  canvas-grid) лінійка не клипалась. Працює універсально для всіх
                  білдерів (preview/page/content). */}
              {(() => {
                const dragId = activeId && !activeId.startsWith("palette:") ? activeId : null;
                const activeId_ = resizingBlockId ?? dragId;
                const targetId = activeId_ ?? selectedBlockId;
                if (!targetId) return null;
                const b = blocks.find(x => x.id === targetId);
                if (!b) return null;
                // У режимі "selected" (без активного drag/resize) — читаємо ТІЛЬКИ
                // committed block.width/x, бо previewWidths/previewXs могли залишитись
                // від попередньої взаємодії з іншим блоком (stale data).
                let liveX = activeId_ ? (previewXs[targetId] ?? b.x ?? 0) : (b.x ?? 0);
                let liveW = activeId_ ? (previewWidths[targetId] ?? (Number(b.width) || 100)) : (Number(b.width) || 100);
                if (dragId === targetId && dropPreview) {
                  liveX = dropPreview.x;
                  liveW = dropPreview.width;
                }
                const mode: "active" | "selected" = activeId_ ? "active" : "selected";
                // Висота блока — live (preview) або з committed state. Для render-у
                // вертикальної лінійки.
                const liveY = activeId_ ? (previewYs[targetId] ?? b.y ?? 0) : (b.y ?? 0);
                const liveH = activeId_ ? (previewHeights[targetId] ?? measureBlockHeight(b)) : measureBlockHeight(b);
                return (
                  <>
                    <div
                      style={{
                        position: "absolute",
                        // На рівні canvas-grid top edge (PAGE_PAD_Y); ResizeRuler сам
                        // зсувається на top:-22 всередині, тобто візуально малюється
                        // на 22px вище canvas-grid у padding-зоні page-wrapper.
                        top: PAGE_PAD_Y,
                        left: PAGE_PAD_X,
                        right: PAGE_PAD_X,
                        height: 0,
                        pointerEvents: "none",
                        zIndex: 50,
                      }}
                    >
                      <ResizeRuler
                        blockX={liveX}
                        blockWidthPct={liveW}
                        pxPerPct={canvasWidthPx / 100}
                        mode={mode}
                      />
                    </div>
                    {/* Вертикальна лінійка вздовж лівого краю — показує висоту блока. */}
                    <div
                      style={{
                        position: "absolute",
                        top: PAGE_PAD_Y,
                        left: PAGE_PAD_X,
                        width: 0,
                        height: canvasHeight,
                        pointerEvents: "none",
                        zIndex: 50,
                      }}
                    >
                      <VResizeRuler
                        blockY={liveY}
                        blockHeightPx={liveH}
                        canvasHeightPx={canvasHeight}
                        mode={mode}
                      />
                    </div>
                  </>
                );
              })()}

              <div
                ref={canvasRef}
                className="canvas-grid"
                style={{
                  position: "relative",
                  // У логічній ширині PAGE_WIDTH; візуально стискається через CSS zoom
                  // коли displayBaseWidth < PAGE_WIDTH. Без zoom — рендер як раніше.
                  width: `${PAGE_WIDTH}px`,
                  zoom: displayScale !== 1 ? displayScale : undefined,
                  minHeight: `${canvasHeight}px`,
                  height: `${canvasHeight}px`,
                  // Канвас — субтильна рамка (це область сторінки, не блок).
                  outline: "1px dashed rgba(28,58,46,0.18)",
                  outlineOffset: "0px",
                  borderRadius: "4px",
                  // У fixedHeight-режимі обрізаємо контент, що вийшов за межі
                  // канвасу — менеджер бачить «не вмістилось» і пересуває блоки.
                  overflow: fixedHeight ? "hidden" : "visible",
                  transition: activeId ? "none" : "height 0.2s",
                }}
                onDragOver={e => e.preventDefault()}
                onClick={(e) => { if (e.target === e.currentTarget) setSelectedBlockId(null); }}
              >
                {blocks.length === 0 && !activeId && (
                  <EmptyHint />
                )}

                {/* Ghost — показуємо ТІЛЬКИ при drag з палітри (для existing-block drag достатньо самого блока + snap-glow).
                    Виняток: palette:image-overlay не створює самостійний блок (drop йде оверлеєм на image),
                    тому "вільний" ghost-слот у канвасі для нього не малюємо. */}
                {activeId && activeId.startsWith("palette:") && activeId !== "palette:image-overlay" && dropPreview && isOverCanvas && (
                  <DropGhost
                    x={dropPreview.x}
                    y={dropPreview.y}
                    widthPct={dropPreview.width}
                    height={dropPreview.height ?? 80}
                    paletteColor={paletteBlock?.color}
                  />
                )}

                {/* Alignment guides — Figma-style лінії під час drag-у. Edge-snap
                    показується solid, center-alignment — dashed. */}
                {alignGuides.map((g, i) => (
                  <AlignmentGuideLine key={`g-${i}`} guide={g} canvasHeight={canvasHeight} />
                ))}

                {/* Size match badges — мала позначка "= H" / "= W" біля блока з
                    тією ж висотою/шириною, що й перетягуваний. */}
                {sizeMatches.map((m, i) => {
                  const t = blocks.find(b => b.id === m.blockId);
                  if (!t) return null;
                  const tx = t.x ?? 0;
                  const ty = t.y ?? 0;
                  const tw = Number(t.width) || 100;
                  const th = measureBlockHeight(t);
                  return <SizeMatchBadge key={`sm-${i}-${m.dim}`} x={tx} y={ty} width={tw} height={th} dim={m.dim} />;
                })}

                {blocks.map(block => {
                  const wPct = blockWidthPct(block);
                  // Якщо previewX/Y є (сусід під час drag-у когось іншого) — використовуємо його,
                  // інакше block.x/block.y. previewY дає live cascade-down при naвсувaнні нового
                  // блока зверху на існуючий (handleDragMove симулює displaceBlocksAround).
                  const x = previewXs[block.id] !== undefined ? previewXs[block.id] : (block.x ?? 0);
                  const y = previewYs[block.id] !== undefined ? previewYs[block.id] : (block.y ?? 0);
                  return (
                    <AbsoluteBlock
                      key={block.id}
                      block={block}
                      x={x}
                      y={y}
                      widthPct={wPct}
                      canvasWidthPx={canvasWidthPx}
                      lastAddedId={lastAddedId}
                      previewHeight={previewHeights[block.id]}
                      isResizing={resizingBlockId === block.id}
                      onChange={handleUpdateBlock}
                      onMoveUp={id => moveBlock(id, "up")}
                      onMoveDown={id => moveBlock(id, "down")}
                      onDuplicate={id => { const newId = duplicateBlock(id); if (newId) setLastAddedId(newId); }}
                      onSetWidth={handleSetWidth}
                      onSetWidthAndData={handleSetWidthAndData}
                      onSetAlign={setAlign}
                      onSetVAlign={setVAlign}
                      onSetBg={setBg}
                      onSetBorderRadius={setBorderRadius}
                      onUpload={onUpload}
                      onPreviewWidth={handlePreviewWidth}
                      onClearPreview={handleClearPreview}
                      onPreviewHeight={handlePreviewHeight}
                      onClearPreviewHeight={handleClearPreviewHeight}
                      onReportHeight={(id, h) => {
                        blockHeightsRef.current[id] = h;
                        reportHeight(id, h);
                        forceTick(t => (t + 1) % 1024);
                      }}
                      getEdgeSnapTargets={() => {
                        // Figma-style edge-snap під час resize. Збираємо всі краї
                        // (top/bottom/centerY у px; left/right/centerX у %)
                        // усіх інших блоків + краї канвасу. useBlockResize використає їх
                        // щоб магнітити край ресайзованого блока до сусіднього краю —
                        // незалежно від того, чи це height/width/diagonal handle.
                        //
                        // rowHeights — окремо, для legacy "= H" size-match (тільки
                        // блоки у тому ж візуальному ряді).
                        const cH = canvasHeight;
                        const yEdges: number[] = [0, cH];
                        const xEdges: number[] = [0, 100];
                        const rowHeights: number[] = [];

                        const ay = block.y ?? 0;
                        const ah = measureBlockHeight(block);
                        const aBottom = ay + ah;

                        for (const o of blocks) {
                          if (o.id === block.id) continue;
                          const oy = o.y ?? 0;
                          const oh = measureBlockHeight(o);
                          const ox = o.x ?? 0;
                          const ow = Number(o.width) || 100;
                          // Усі краї всіх блоків — резонансна Figma-поведінка.
                          // detectAlignmentsAt сам відфільтрує які guide-лінії показати.
                          yEdges.push(oy, oy + oh, oy + oh / 2);
                          xEdges.push(ox, ox + ow, ox + ow / 2);
                          if (ay < oy + oh && aBottom > oy) rowHeights.push(oh);
                        }
                        return { yEdges, xEdges, rowHeights };
                      }}
                      isActive={activeId === block.id}
                      selected={selectedBlockId === block.id}
                      onSelect={(id) => setSelectedBlockId(id)}
                      scrollCompensation={activeId === block.id ? scrollCompensation : 0}
                      maxBlockHeight={fixedHeight ? Math.max(60, canvasHeight - y) : undefined}
                      fixedHeight={fixedHeight}
                      templateMode={templateMode}
                      lockLayout={lockLayout}
                    />
                  );
                })}
              </div>

              {/* Corner resize handle ВИНЕСЕНИЙ за межі canvas-grid — у білу
                  padding-зону page-wrapper-а. Так блоки всередині канвасу не
                  візуально конкурують з ним. Активний лише коли parent дає
                  onCanvasResize (TemplateConstructor). */}
              {onCanvasResize && (
                <CanvasResizeHandle
                  width={PAGE_WIDTH}
                  height={canvasHeight}
                  minWidth={canvasMinWidth}
                  maxWidth={canvasMaxWidth}
                  minHeight={canvasMinHeight}
                  maxHeight={canvasMaxHeight}
                  onResize={onCanvasResize}
                />
              )}
            </div>
            </div>
            </div>

            {/* Hint-текст під канвасом — лише поза template-режимом
                (у білдері шаблону зайвий шум). */}
            {!templateMode && (
              <div style={{
                marginTop: "10px",
                fontSize: "11px",
                color: "#9CA3AF",
                fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
                textAlign: "center",
                maxWidth: `${VISIBLE_WRAPPER_W}px`,
              }}>
                {"Тягніть блоки за хедер куди завгодно на сторінці. Край → resize. Snap 8px."}
              </div>
            )}
          </div>

          {/* Правий сайдбар. ВСЕРЕДИНІ DndContext щоб draggable у ньому (картки новин з
              NewsLibrarySidebar) поділяли той самий контекст з канвасом. Sticky — щоб
              слідував за скролом, як ліва палітра. top: 152 щоб не перекриватись
              з floating "Зберегти" + back-button (вони на top:80px, висота 56px). */}
          {rightSidebar && (
            <div
              className="news-palette-scroll"
              style={{
                position: "sticky",
                top: "152px",
                alignSelf: "flex-start",
                maxHeight: "calc(100vh - 172px)",
                overflowY: "auto",
                overflowX: "hidden",
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                flexShrink: 0,
              }}
            >
              {rightSidebar}
            </div>
          )}
        </div>

        <DragOverlay dropAnimation={null}>
          <OverlayItem
            activeId={activeId}
            isOverCanvas={isOverCanvas}
            paletteBlock={paletteBlock}
          />
        </DragOverlay>
      </DndContext>
    </>
  );
}

function EmptyHint() {
  return (
    <div style={{
      position: "absolute",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column",
      gap: "12px",
      pointerEvents: "none",
      color: "#B8B0A8",
      fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
    }}>
      <div style={{
        width: "48px", height: "48px", borderRadius: "12px",
        background: "rgba(28,58,46,0.07)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "22px",
      }}>{"✦"}</div>
      <div style={{ fontSize: "13px", fontWeight: 600 }}>{"Перетягніть блок з палітри сюди"}</div>
      <div style={{ fontSize: "11px" }}>{"Потім тягніть його куди завгодно"}</div>
    </div>
  );
}

// AlignmentGuideLine — Figma-style вирівнювання. Тонка лінія pink/magenta що тягнеться
// від перетягуваного блока до того, з ким він вирівнявся. Solid для краю, dashed для центру.
// pos: для axis="x" — xPct (0..100); для axis="y" — yPx.
// start/end: діапазон на ортогональній осі (yPx або xPct відповідно).
function AlignmentGuideLine({ guide, canvasHeight }: {
  guide: { axis: "x" | "y"; pos: number; start: number; end: number; kind: "edge" | "center" };
  canvasHeight: number;
}) {
  const COLOR = guide.kind === "center" ? "#A855F7" : "#EC4899"; // фіолетовий — центр, рожевий — край
  const dotShadow = `0 0 0 2px ${COLOR}33, 0 0 6px ${COLOR}66`;
  const dotStyle: React.CSSProperties = {
    position: "absolute",
    width: "6px", height: "6px", borderRadius: "50%",
    background: "#FFFFFF",
    boxShadow: `0 0 0 1.5px ${COLOR}, ${dotShadow}`,
    pointerEvents: "none",
    zIndex: 51,
  };

  if (guide.axis === "x") {
    // Стандартно лінія центрована на pos: `left: calc(pos% - 0.5px)` (половина по
    // обидва боки). АЛЕ для canvas-edge guides (pos=0 чи 100) це означає, що
    // половина лінії потрапляє ЗА межі канвасу і клипається overflow:hidden →
    // лишається тільки 0.5px візуально (anti-alias-наполовину прозоре). Для краю
    // прив'язуємо лінію В МЕЖАХ канвасу: pos=0 → left:0 (line span 0..1px),
    // pos=100 → left:calc(100% - 1px) (line span W-1..W).
    const isLeftEdge = guide.pos < 0.5;
    const isRightEdge = guide.pos > 99.5;
    const leftStyle = isLeftEdge ? "0" : isRightEdge ? "calc(100% - 1px)" : `calc(${guide.pos}% - 0.5px)`;
    const dotLeft = isLeftEdge ? "-2px" : isRightEdge ? "calc(100% - 4px)" : `calc(${guide.pos}% - 3px)`;
    const lineStyle: React.CSSProperties = {
      position: "absolute",
      left: leftStyle,
      top: `${guide.start}px`,
      width: "1px",
      height: `${Math.max(0, guide.end - guide.start)}px`,
      pointerEvents: "none",
      zIndex: 50,
      ...(guide.kind === "center"
        ? { background: `repeating-linear-gradient(to bottom, ${COLOR} 0 4px, transparent 4px 8px)` }
        : { background: COLOR, boxShadow: `0 0 4px ${COLOR}88` }),
    };
    return (
      <>
        <div style={lineStyle} />
        <div style={{ ...dotStyle, left: dotLeft, top: `${guide.start - 3}px` }} />
        <div style={{ ...dotStyle, left: dotLeft, top: `${guide.end - 3}px` }} />
      </>
    );
  }
  // axis === "y" — те саме для top/bottom canvas-edges.
  const isTopEdge = guide.pos < 0.5;
  const isBottomEdge = guide.pos > canvasHeight - 0.5;
  const topStyle = isTopEdge ? "0px" : isBottomEdge ? `${canvasHeight - 1}px` : `${guide.pos - 0.5}px`;
  const dotTop = isTopEdge ? "-2px" : isBottomEdge ? `${canvasHeight - 4}px` : `${guide.pos - 3}px`;
  const lineStyle: React.CSSProperties = {
    position: "absolute",
    left: `${guide.start}%`,
    top: topStyle,
    width: `${Math.max(0, guide.end - guide.start)}%`,
    height: "1px",
    pointerEvents: "none",
    zIndex: 50,
    ...(guide.kind === "center"
      ? { background: `repeating-linear-gradient(to right, ${COLOR} 0 4px, transparent 4px 8px)` }
      : { background: COLOR, boxShadow: `0 0 4px ${COLOR}88` }),
  };
  return (
    <>
      <div style={lineStyle} />
      <div style={{ ...dotStyle, left: `calc(${guide.start}% - 3px)`, top: dotTop }} />
      <div style={{ ...dotStyle, left: `calc(${guide.end}% - 3px)`, top: dotTop }} />
    </>
  );
}

// SizeMatchBadge — позначка "= H" / "= W" поряд з блоком, що має ту саму
// висоту/ширину що й перетягуваний.
function SizeMatchBadge({ x, y, width, height, dim }: {
  x: number; y: number; width: number; height: number; dim: "h" | "w";
}) {
  const COLOR = "#EC4899";
  const label = dim === "h" ? "= H" : "= W";
  // H — позначка справа від блока, посередині. W — згори, посередині.
  const style: React.CSSProperties = dim === "h"
    ? {
        position: "absolute",
        left: `calc(${x + width}% + 8px)`,
        top: `${y + height / 2 - 10}px`,
      }
    : {
        position: "absolute",
        left: `calc(${x + width / 2}% - 16px)`,
        top: `${y - 24}px`,
      };
  return (
    <div style={{
      ...style,
      background: COLOR,
      color: "#FFFFFF",
      fontSize: "10px",
      fontWeight: 700,
      fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
      padding: "3px 6px",
      borderRadius: "4px",
      pointerEvents: "none",
      zIndex: 52,
      letterSpacing: "0.04em",
      boxShadow: `0 2px 6px ${COLOR}66`,
      whiteSpace: "nowrap",
    }}>{label}</div>
  );
}

function DropGhost({ x, y, widthPct, height, paletteColor }: { x: number; y: number; widthPct: number; height: number; paletteColor?: string }) {
  return (
    <div
      style={{
        position: "absolute",
        left: `${x}%`,
        top: `${y}px`,
        width: `${widthPct}%`,
        height: `${height}px`,
        borderRadius: "12px",
        border: `2px dashed ${paletteColor || "#D4A843"}`,
        background: "rgba(212,168,67,0.08)",
        pointerEvents: "none",
        zIndex: 5,
        transition: "left 0.08s, top 0.08s",
      }}
    />
  );
}

function PageCorners() {
  const c = "#D4A843";
  const size = 18;
  const off = 6;
  const base: React.CSSProperties = {
    position: "absolute", width: `${size}px`, height: `${size}px`, pointerEvents: "none",
  };
  return (
    <>
      <div style={{ ...base, top: off, left: off, borderTop: `2px solid ${c}`, borderLeft: `2px solid ${c}`, borderTopLeftRadius: "4px" }} />
      <div style={{ ...base, top: off, right: off, borderTop: `2px solid ${c}`, borderRight: `2px solid ${c}`, borderTopRightRadius: "4px" }} />
      <div style={{ ...base, bottom: off, left: off, borderBottom: `2px solid ${c}`, borderLeft: `2px solid ${c}`, borderBottomLeftRadius: "4px" }} />
      <div style={{ ...base, bottom: off, right: off, borderBottom: `2px solid ${c}`, borderRight: `2px solid ${c}`, borderBottomRightRadius: "4px" }} />
    </>
  );
}

// AbsoluteBlock — обгортка, яка позиціонує BlockItem абсолютно і підключає useDraggable
function AbsoluteBlock(props: {
  block: Block;
  x: number; y: number; widthPct: number;
  canvasWidthPx: number;
  lastAddedId: string | null;
  previewHeight?: number;
  isActive: boolean;
  onChange: (id: string, data: Record<string, string>) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onDuplicate: (id: string) => void;
  onSetWidth: (id: string, w: string) => void;
  onSetWidthAndData: (id: string, w: string, data: Record<string, string>, height?: number) => void;
  onSetAlign: (id: string, a: "left" | "center" | "right") => void;
  onSetVAlign: (id: string, v: "top" | "center" | "bottom") => void;
  onSetBg: (id: string, c: string) => void;
  onSetBorderRadius: (id: string, v: number | undefined) => void;
  onUpload: (file: File) => Promise<string>;
  onPreviewWidth: (id: string, pct: number) => void;
  onClearPreview: (id: string) => void;
  onPreviewHeight: (id: string, h: number) => void;
  onClearPreviewHeight: (id: string) => void;
  onReportHeight: (id: string, h: number) => void;
  /** Figma-style edge-snap дані: Y-краї (px) і X-краї (%) усіх інших блоків +
   *  країв канвасу. useBlockResize магнітить будь-який край ресайзованого блока
   *  до найближчого краю сусіда. rowHeights — окремо, для legacy "= H" badge. */
  getEdgeSnapTargets: () => { yEdges: number[]; xEdges: number[]; rowHeights: number[] };
  selected: boolean;
  onSelect: (id: string) => void;
  /** Пікс. компенсація скролу під час drag — додається до transform.y щоб блок
   *  залишався під курсором коли юзер скролить колесом без руху мишки. */
  scrollCompensation?: number;
  /** У card-builder-і (fixedHeight) — максимально дозволена висота блока в px
   *  (canvasHeight - block.y). Передається в BlockItem для clamp auto-aspect-у
   *  ТА застосовується як CSS maxHeight на самому AbsoluteBlock — щоб навіть
   *  якщо block.height у БД більший, візуально блок не вилазив за canvas. */
  maxBlockHeight?: number;
  fixedHeight?: boolean;
  /** Чи блок зараз ресайзиться (width/height/diagonal handle активний).
   *  При true — відключаємо CSS width/left/top transition, інакше блок
   *  «їде» за курсором з 120ms лагом і відчувається як «відірваний». */
  isResizing?: boolean;
  /** Template-mode: блок — плейсхолдер без settings/редакторів. */
  templateMode?: boolean;
  /** Layout lock: drag і resize вимкнено; блок заморожений. */
  lockLayout?: boolean;
}) {
  const { block, x, y, widthPct, lastAddedId, previewHeight, isActive, canvasWidthPx, selected, scrollCompensation = 0, maxBlockHeight, fixedHeight, isResizing = false, templateMode = false, lockLayout = false } = props;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: block.id });

  const tx = transform?.x ?? 0;
  const ty = (transform?.y ?? 0) + (isDragging ? scrollCompensation : 0);
  const translate = (transform || isDragging) ? `translate3d(${tx}px, ${ty}px, 0)` : undefined;

  // Whole-block drag: drag-listeners на wrapper, але pointerdown ігнорується якщо
  // користувач почав клік на інтерактивному елементі (resize handles, contenteditable,
  // input, button, overlay тощо). Так weet drag активується ТІЛЬКИ при кліку на
  // "порожніх" зонах блока, не заважаючи редагуванню тексту чи resize-у.
  const NO_DRAG_SELECTOR =
    "[contenteditable=\"true\"], input, textarea, select, button, a, [data-no-block-drag]";
  // У lockLayout-режимі drag-listeners НЕ підключаємо взагалі: блок заморожений
  // у позиції шаблону, менеджер тільки наповнює його контентом.
  const wrapperListeners: React.HTMLAttributes<HTMLElement> = !lockLayout && listeners ? {
    ...listeners,
    onPointerDown: (e: React.PointerEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(NO_DRAG_SELECTOR)) return;
      (listeners as { onPointerDown?: (e: React.PointerEvent) => void }).onPointerDown?.(e);
    },
  } : {};

  return (
    <div
      ref={setNodeRef}
      data-block-id={block.id}
      {...attributes}
      {...wrapperListeners}
      onClick={(e) => {
        e.stopPropagation();
        // КРИТИЧНО: settings-панель блока (BlockItemHeader, OverlayToolbar, TipTap)
        // портал-иться у slot палітри. Кліки там bubble-ять через React-дерево
        // сюди, хоча в DOM event ціль зовсім в іншому місці. Без цієї перевірки
        // toggle-логіка onSelect (prev===id ? null : id) deselect-ить блок при
        // КОЖНОМУ кліку на settings-кнопку, і панель закривається.
        const wrapper = e.currentTarget as HTMLElement;
        const target = e.target as Node;
        if (!wrapper.contains(target)) return;

        // Якщо клік не по input/textarea/contentEditable/button — знімаємо focus з
        // активного інпута, щоб Delete видаляв блок, а не символи.
        // ⚠️ data-news-block-type="heading|text|quote" wrapper-и теж вважаємо
        // editable-зоною: HeadingEditor/TextEditor/QuoteEditor встановлюють
        // editor.focus("end") на click у dead-zone, і AbsoluteBlock-у не можна
        // тут блюрити — інакше фокус скидається ДО того, як ProseMirror отримає
        // input-event, і символи "губляться" до наступного re-focus-у.
        const t = e.target as HTMLElement;
        const insideEditable = !!t.closest(
          "input, textarea, [contenteditable=\"true\"], select, button," +
          " [data-news-block-type=\"heading\"]," +
          " [data-news-block-type=\"text\"]," +
          " [data-news-block-type=\"quote\"]"
        );
        if (!insideEditable && document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        props.onSelect(block.id);
      }}
      className={block.id === lastAddedId ? "block-just-added" : undefined}
      style={{
        position: "absolute",
        left: `${x}%`,
        top: `${y}px`,
        width: `${widthPct}%`,
        // newsCard preview: висота auto через aspect-ratio 360:400. Усі preview-
        // блоки мають однаковий block.width (auto-fit нормалізує) → однаковий
        // розмір на канвасі. Дзеркало AbsoluteBlockRender на /news.
        // newsCard expanded: теж height auto — ArticleTemplate/EventTemplate
        // має власний контент-розмір, а block.height (1700/680) — лише грубий
        // дефолт для canvasHeight() кешу і snap-логіки. Без auto wrapper обрізає
        // довшу статтю → content виглядає як overflow в сусідні блоки.
        height: (block.type === "newsCard" || block.type === "templateInstance")
          ? "auto"
          : ((previewHeight && previewHeight > 0)
              ? `${previewHeight}px`
              : (block.height ? `${block.height}px` : undefined)),
        aspectRatio: (block.type === "newsCard" && (block.data.displayMode || "preview") === "preview")
          ? "360 / 400"
          : block.type === "templateInstance"
            ? (() => {
                // Aspect-ratio з templateCanvas (наприклад "800x448"). Висота
                // блока завжди йде за шириною з пропорціями шаблону, незалежно
                // від block.height — це гарантує що блок не "виростає" вище
                // за реальний контент шаблону.
                const tc = block.data?.templateCanvas || "";
                const m = tc.match(/^(\d+)x(\d+)$/);
                if (m) return `${Number(m[1])} / ${Number(m[2])}`;
                return undefined;
              })()
            : undefined,
        // У card-builder-і — обмежуємо візуальну висоту блока вільним місцем
        // (canvasHeight - y). Це safety net на випадок коли block.height у БД
        // більший за canvas (напр., високе фото з auto-aspect зі старих даних).
        // Контент усередині сквіш-иться, але блок не вилазить за canvas.
        maxHeight: typeof maxBlockHeight === "number" && maxBlockHeight > 0
          ? `${maxBlockHeight}px`
          : undefined,
        // У card-builder-і додаємо overflow:hidden — щоб контент блока (img,
        // text з line-height) не виходив за CSS-межі блока, навіть якщо
        // натуральний розмір більший. Канвас потім ще раз клипить по своєму
        // overflow:hidden — defense in depth.
        overflow: fixedHeight ? "hidden" : undefined,
        transform: translate,
        // zIndex стратегія:
        //   - Спецблоки (label-оверлеї: Імʼя/Посада/Tagline/Вартість/Тривалість/
        //     CTA/освіта) — завжди ПОВЕРХ generic-блоків (Фото/Текст/Заголовок).
        //     Менеджер свідомо ставить їх на Фото у шаблоні; у content-mode
        //     опакове Фото інакше їх закриває. Тому spec baseline = 50.
        //   - Generic-блок baseline = 1.
        //   - Selected — підіймається відносно своєї категорії (+30) — щоб
        //     виділений блок було легко зчепити (resize-handles доступні), при
        //     цьому spec все одно над generic навіть коли generic виділений.
        //   - Active/dragging — найвище (100), щоб під час drag блок видно
        //     зверху всіх інших.
        zIndex: (() => {
          const isSpec = ["speakerName", "speakerRole", "tagline", "price", "duration", "ctaButton", "educationItem"].includes(block.type);
          if (isActive || isDragging) return 100;
          const baseline = isSpec ? 50 : 1;
          return selected ? baseline + 30 : baseline;
        })(),
        opacity: isDragging ? 0.65 : 1,
        transition: (isDragging || isResizing) ? "none" : "left 0.12s, top 0.12s, width 0.12s",
        outline: selected ? "2px solid #D4A843" : "none",
        outlineOffset: "2px",
        borderRadius: selected ? "12px" : 0,
        // Cursor "grab" як affordance що блок можна тягати з будь-якого місця.
        // Дочірні contenteditable/input/button мають свої cursors → не перекривається.
        // У lockLayout-режимі grab cursor НЕ показуємо — drag вимкнено.
        cursor: lockLayout ? "default" : (isDragging ? "grabbing" : "grab"),
        touchAction: "none",
      }}
    >
      <BlockItem
        block={block}
        index={0}
        selected={selected}
        canMoveUp={false}
        canMoveDown={false}
        dragAttributes={attributes}
        dragListeners={listeners}
        onChange={props.onChange}
        onMoveUp={props.onMoveUp}
        onMoveDown={props.onMoveDown}
        onDuplicate={props.onDuplicate}
        onSetWidth={props.onSetWidth}
        onSetWidthAndData={props.onSetWidthAndData}
        onSetAlign={props.onSetAlign}
        onSetVAlign={props.onSetVAlign}
        onSetBg={props.onSetBg}
        onSetBorderRadius={props.onSetBorderRadius}
        onUpload={props.onUpload}
        containerWidthPx={canvasWidthPx}
        onPreviewWidth={props.onPreviewWidth}
        onClearPreview={props.onClearPreview}
        onPreviewHeight={props.onPreviewHeight}
        onClearPreviewHeight={props.onClearPreviewHeight}
        previewHeight={previewHeight}
        onReportHeight={props.onReportHeight}
        getEdgeSnapTargets={props.getEdgeSnapTargets}
        snapThreshold={8}
        onSelectBlock={props.onSelect}
        maxBlockHeight={maxBlockHeight}
        blockX={x}
        blockY={y}
        templateMode={templateMode}
        lockLayout={lockLayout}
      />
    </div>
  );
}

// CanvasResizeHandle — corner-handle у bottom-right канвасу шаблону. Тягнеш —
// канвас живе ресайзиться (через onResize callback у TemplateConstructor),
// snap-иться до 8px, клампиться у заданих межах. Логіка дзеркальна BlockItem
// resize handle (capture pointer, deltas від startCursor + startSize, snap).
function CanvasResizeHandle({
  width, height,
  minWidth, maxWidth, minHeight, maxHeight,
  onResize,
}: {
  width: number;
  height: number;
  minWidth: number; maxWidth: number;
  minHeight: number; maxHeight: number;
  onResize: (w: number, h: number) => void;
}) {
  const SNAP = 8;
  const [resizing, setResizing] = React.useState(false);
  const stateRef = React.useRef<{ cx: number; cy: number; w: number; h: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    stateRef.current = { cx: e.clientX, cy: e.clientY, w: width, h: height };
    setResizing(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!stateRef.current) return;
    const { cx, cy, w, h } = stateRef.current;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const rawW = w + dx;
    const rawH = h + dy;
    const snappedW = Math.round(rawW / SNAP) * SNAP;
    const snappedH = Math.round(rawH / SNAP) * SNAP;
    const clampedW = Math.max(minWidth, Math.min(maxWidth, snappedW));
    const clampedH = Math.max(minHeight, Math.min(maxHeight, snappedH));
    if (clampedW !== width || clampedH !== height) {
      onResize(clampedW, clampedH);
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    }
    stateRef.current = null;
    setResizing(false);
  };

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      title="Перетягніть, щоб змінити розмір канвасу"
      style={{
        position: "absolute",
        right: 8,
        bottom: 8,
        width: 24,
        height: 24,
        cursor: "nwse-resize",
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 6,
        background: resizing ? "rgba(212,168,67,0.18)" : "transparent",
        transition: "background 0.15s",
        touchAction: "none",
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        style={{
          filter: resizing
            ? "drop-shadow(0 1px 4px rgba(212,168,67,0.6))"
            : "drop-shadow(0 1px 2px rgba(0,0,0,0.18))",
          transition: "filter 0.15s",
        }}
      >
        <path d="M13 1 L13 13 L1 13 Z" fill={resizing ? "#D4A843" : "#1C3A2E"} />
        <line x1="13" y1="5" x2="5" y2="13" stroke="#fff" strokeWidth="1.2" />
        <line x1="13" y1="9" x2="9" y2="13" stroke="#fff" strokeWidth="1.2" />
      </svg>
    </div>
  );
}

// VResizeRuler — вертикальний аналог ResizeRuler. Малюється у padding-зоні
// page-wrapper-а (ліворуч від canvas-grid). Показує висоту вибраного блока у px.
function VResizeRuler({
  blockY, blockHeightPx, canvasHeightPx, mode,
}: {
  blockY: number;
  blockHeightPx: number;
  canvasHeightPx: number;
  mode: "active" | "selected";
}) {
  const ff = "-apple-system, BlinkMacSystemFont, sans-serif";
  const isActive = mode === "active";
  const accent = isActive ? "rgba(212,168,67,0.95)" : "rgba(212,168,67,0.55)";
  const trackColor = "rgba(28,58,46,0.08)";
  const tickColor = isActive ? "rgba(28,58,46,0.55)" : "rgba(28,58,46,0.35)";
  const safeCanvasH = Math.max(1, canvasHeightPx);
  const topPct = (blockY / safeCanvasH) * 100;
  const heightPct = (blockHeightPx / safeCanvasH) * 100;
  const centerPct = topPct + heightPct / 2;
  const bottomPct = topPct + heightPct;
  // Chip — фіксуємо у видимих межах [4%..96%] щоб не вилазив за canvas.
  const chipOffsetPct = Math.max(4, Math.min(96, centerPct));

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: -22,
        width: 16,
        pointerEvents: "none",
        zIndex: 50,
        animation: "ruler-fade-in 120ms ease",
      }}
    >
      {/* Hairline track — 1px на всю висоту канвасу */}
      <div style={{
        position: "absolute",
        left: 11,
        top: 0,
        bottom: 0,
        width: 1,
        background: trackColor,
      }} />

      {/* Highlighted span — accent на висоту блока */}
      <div style={{
        position: "absolute",
        left: 11,
        top: `${topPct}%`,
        height: `${heightPct}%`,
        width: isActive ? 2 : 1.5,
        background: accent,
        transform: isActive ? "translateX(-0.5px)" : "translateX(-0.25px)",
        transition: "background 120ms ease, width 120ms ease",
      }} />

      {/* Endpoints — короткі горизонтальні tick-и на top і bottom блока */}
      <div style={{
        position: "absolute",
        left: 7,
        top: `${topPct}%`,
        transform: "translateY(-0.5px)",
        height: 1,
        width: 9,
        background: tickColor,
      }} />
      <div style={{
        position: "absolute",
        left: 7,
        top: `${bottomPct}%`,
        transform: "translateY(-0.5px)",
        height: 1,
        width: 9,
        background: tickColor,
      }} />

      {/* Compact chip — повернутий на 90° проти годинникової. Зменшений у розмірі
          (менший padding/font), щоб після rotate він поміщався у padding-зоні
          ліворуч від canvas-grid і не заїздив на блоки. */}
      <div style={{
        position: "absolute",
        left: -14,
        top: `${chipOffsetPct}%`,
        transform: "translateY(-50%) rotate(-90deg)",
        transformOrigin: "center",
        background: isActive ? "#D4A843" : "#FFFFFF",
        color: isActive ? "#1C3A2E" : "#5C4A1F",
        padding: "2px 7px",
        borderRadius: 999,
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: "0.02em",
        fontFamily: ff,
        fontVariantNumeric: "tabular-nums",
        border: `1px solid ${isActive ? "rgba(28,58,46,0.18)" : "rgba(212,168,67,0.50)"}`,
        boxShadow: isActive
          ? "0 2px 8px rgba(212,168,67,0.40)"
          : "0 1px 3px rgba(28,58,46,0.10)",
        whiteSpace: "nowrap",
        transition: "background 120ms ease, color 120ms ease, box-shadow 120ms ease",
      }}>
        <span>{Math.round(blockHeightPx)}<span style={{ opacity: 0.55, marginLeft: 1 }}>px</span></span>
      </div>
    </div>
  );
}

// ResizeRuler — мінімалістична лінійка по ширині сторінки.
// Дві моди:
//   • "selected" — блок просто виділений. Тонка hairline-лінія + дискретний chip
//     з розміром. Не відволікає увагу від контенту.
//   • "active"   — блок зараз resize-иться або drag-иться. Та сама лінія,
//     трохи насиченіший accent, chip живий (показує live %).
// Дизайн натхненний Figma/Linear — hairline rules, типографічні цифри без
// "паска" чи "браслета".
function ResizeRuler({
  blockX, blockWidthPct, pxPerPct, mode,
}: {
  blockX: number;
  blockWidthPct: number;
  pxPerPct: number;
  mode: "active" | "selected";
}) {
  const ff = "-apple-system, BlinkMacSystemFont, sans-serif";
  const widthPx = Math.round(blockWidthPct * pxPerPct);
  const centerPct = blockX + blockWidthPct / 2;
  const rightPct = blockX + blockWidthPct;
  // Chip залишаємо в межах [6%..94%] щоб не вилазив за canvas.
  const chipOffsetPct = Math.max(6, Math.min(94, centerPct));

  // Кольори для двох модів. selected — приглушений; active — насиченіший accent.
  const isActive = mode === "active";
  const accent = isActive ? "rgba(212,168,67,0.95)" : "rgba(212,168,67,0.55)";
  const trackColor = "rgba(28,58,46,0.08)";
  const tickColor = isActive ? "rgba(28,58,46,0.55)" : "rgba(28,58,46,0.35)";

  return (
    <div
      style={{
        position: "absolute",
        top: -22,
        left: 0,
        right: 0,
        height: 16,
        pointerEvents: "none",
        zIndex: 50,
        animation: "ruler-fade-in 120ms ease",
      }}
    >
      <style>{`
        @keyframes ruler-fade-in {
          from { opacity: 0; transform: translateY(1px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Hairline track — 1px на всю ширину канвасу */}
      <div style={{
        position: "absolute",
        top: 11,
        left: 0,
        right: 0,
        height: 1,
        background: trackColor,
      }} />

      {/* Highlighted span — 1.5px hairline accent на ширину блока */}
      <div style={{
        position: "absolute",
        top: 11,
        left: `${blockX}%`,
        width: `${blockWidthPct}%`,
        height: isActive ? 2 : 1.5,
        background: accent,
        transform: isActive ? "translateY(-0.5px)" : "translateY(-0.25px)",
        transition: "background 120ms ease, height 120ms ease",
      }} />

      {/* Endpoints — короткі вертикальні tick-и на лівому і правому краю блока */}
      <div style={{
        position: "absolute",
        top: 7,
        left: `${blockX}%`,
        transform: "translateX(-0.5px)",
        width: 1,
        height: 9,
        background: tickColor,
      }} />
      <div style={{
        position: "absolute",
        top: 7,
        left: `${rightPct}%`,
        transform: "translateX(-0.5px)",
        width: 1,
        height: 9,
        background: tickColor,
      }} />

      {/* Compact chip — дискретний бейдж з шириною та позицією. Білий з тонкою
          амбер-рамкою; в active-режимі — амбер background. Цифри tabular-nums
          щоб не "стрибали" при resize. */}
      <div style={{
        position: "absolute",
        top: -10,
        left: `${chipOffsetPct}%`,
        transform: "translateX(-50%)",
        background: isActive ? "#D4A843" : "#FFFFFF",
        color: isActive ? "#1C3A2E" : "#5C4A1F",
        padding: "3px 9px",
        borderRadius: 999,
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: "0.02em",
        fontFamily: ff,
        fontVariantNumeric: "tabular-nums",
        border: `1px solid ${isActive ? "rgba(28,58,46,0.18)" : "rgba(212,168,67,0.50)"}`,
        boxShadow: isActive
          ? "0 2px 8px rgba(212,168,67,0.40)"
          : "0 1px 3px rgba(28,58,46,0.10)",
        whiteSpace: "nowrap",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        transition: "background 120ms ease, color 120ms ease, box-shadow 120ms ease",
      }}>
        <span>{widthPx}<span style={{ opacity: 0.55, marginLeft: 1 }}>px</span></span>
        <span style={{ opacity: 0.35 }}>·</span>
        <span>{blockWidthPct.toFixed(0)}<span style={{ opacity: 0.55, marginLeft: 1 }}>%</span></span>
      </div>
    </div>
  );
}
