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

const PAGE_WIDTH = CANVAS_WIDTH;
const PAGE_PAD_X = 32;
const PAGE_PAD_Y = 32;
const SNAP = 8;         // px — вертикальний і горизонтальний grid
const MIN_CANVAS_H = 500;

// (TYPE_HEIGHT тепер імпортується з @/lib/news/render — див. шапку файла.)

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
}

export default function EditorCanvas({ blocks, onBlocksChange, onUpload, pageBgColor, selectedBlockId, onSelectBlock, extraPaletteBlocks, extraPaletteBlocksTitle, rightSidebar }: Props) {
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
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isOverCanvas, setIsOverCanvas] = useState(false);
  const dropPreviewRef = useRef<{ x: number; y: number; width: number } | null>(null);
  const [dropPreview, setDropPreview] = useState<{ x: number; y: number; width: number } | null>(null);
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
  useEffect(() => {
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
  }, [selectedBlockId]);

  const {
    previewWidths, previewXs, previewHeights, blockHeights,
    updateBlock, deleteBlock, moveBlock, duplicateBlock,
    setWidth, setWidthAndData, setAlign, setVAlign, setBg,
    setPreview, clearPreview, setPreviewX, clearPreviewX,
    setPreviewHeight, clearPreviewHeight, reportHeight,
  } = useBlockManager(blocks, onBlocksChange);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const canvasWidthPx = canvasRectRef.current?.width ?? PAGE_WIDTH;

  // Реальна висота блока — спершу з DOM (найточніше, враховує актуальний рендер),
  // потім reported-height, потім type-based дефолт.
  function measureBlockHeight(b: Block): number {
    if (typeof b.height === "number") return b.height;
    if (canvasRef.current) {
      const el = canvasRef.current.querySelector<HTMLElement>(`[data-block-id="${b.id}"]`);
      if (el && el.offsetHeight > 0) return el.offsetHeight;
    }
    const measured = blockHeights[b.id] ?? blockHeightsRef.current[b.id];
    if (measured && measured > 20) return measured;
    return TYPE_HEIGHT[b.type] ?? 100;
  }
  // BOTTOM_SLACK — вільний простір під найнижчим блоком, щоб юзер міг легко
  // drop-нути новий блок нижче (без BOTTOM_SLACK канвас закінчується ВПРИТУЛ
  // до останнього блока — нікуди кинути). 240px ≈ висота 1-2 типових блоків.
  const BOTTOM_SLACK = 240;
  const canvasHeight = Math.max(
    MIN_CANVAS_H,
    ...blocks.map(b => (b.y ?? 0) + measureBlockHeight(b) + BOTTOM_SLACK),
    // НЕ розтягувати canvas під dropPreview — це провокує feedback loop:
    // canvas росте → browser скролить → rect.top негативніший → cursorY - rectTop росте
    // → preview Y росте → canvas ще більший. Блок летить у нескінченність.
  );

  function clampXY(xPct: number, yPx: number, wPct: number): { x: number; y: number } {
    const clampedX = Math.max(0, Math.min(100 - wPct, xPct));
    const clampedY = Math.max(0, yPx);
    return { x: clampedX, y: clampedY };
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

    if (delta > 0) {
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
    // Немає сусіда ПРАВОРУЧ — звичайний setWidth, але clamp'емо щоб не вилізти за канвас.
    const bx = b.x ?? 0;
    const clampedW = Math.max(MIN_NEIGHBOR_WIDTH, Math.min(100 - bx, newW));
    setWidth(id, String(roundW(clampedW)));
  }, [blocks, onBlocksChange, setWidth, clearPreview, clearPreviewX]);

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

    // Крок 1: будуємо новий стан з neighbor-shrink (якщо сусід є і блок росте)
    let appliedW = newW;
    let next: Block[];
    let neighborId: string | null = null;
    if (delta > 0) {
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

    // Крок 2: displacement — якщо нові межі блока (x, y, appliedW, newH) перетинаються з іншими
    // блоками (крім уже адаптованого neighbor) → пересуваємо їх.
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

    // Крок 3: commit + очистка previews
    clearPreview(id);
    if (neighborId) {
      clearPreview(neighborId);
      clearPreviewX(neighborId);
    }
    onBlocksChange(next);
  }, [blocks, onBlocksChange, setWidthAndData, clearPreview, clearPreviewX]);

  // Детектор alignment-guides — викликається з drag-move І resize (preview width/height).
  // Перевіряє всі alignments (left-left, right-right, top-top, bottom-bottom, center-center)
  // і виставляє guide-лінії + size-match badges. Допуски TIGHT_X/Y використовуються
  // для постфактумної детекції — блок вже мав би бути на цій позиції після snap-у.
  const detectAlignmentsAt = useCallback((selfId: string, ax: number, ay: number, aw: number, ah: number) => {
    const TIGHT_X = 0.5;
    const TIGHT_Y = 2;
    const SIZE_MATCH_PX = 4;
    const SIZE_MATCH_PCT = 0.6;
    // Proximity для size-match: показуємо "= H" / "= W" лише коли блоки в одному
    // рядку/колонці, інакше badge стає шумним (показує match для далеких блоків).
    const SIZE_PROX_Y_PX = 14;
    const SIZE_PROX_X_PCT = 2;

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
  }, [blocks]);

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
    if (delta > 0) {
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

    // Alignment guides під час resize: поточна позиція + нова ширина.
    const bx = b.x ?? 0;
    const by = b.y ?? 0;
    const bh = Number(b.height) || measureBlockHeight(b);
    detectAlignmentsAt(id, bx, by, appliedW, bh);
  }, [blocks, setPreview, setPreviewX, detectAlignmentsAt]);

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
  const handlePreviewHeight = useCallback((id: string, h: number) => {
    setPreviewHeight(id, h);
    const b = blocks.find(x => x.id === id);
    if (!b) return;
    const bx = b.x ?? 0;
    const by = b.y ?? 0;
    const w = previewWidths[id] ?? (Number(b.width) || 100);
    detectAlignmentsAt(id, bx, by, w, h);
  }, [blocks, previewWidths, setPreviewHeight, detectAlignmentsAt]);

  const handleClearPreviewHeight = useCallback((id: string) => {
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
    // Тільки якщо висота зросла — робимо displacement
    if (newH > oldH + 0.5) {
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
  }, [blocks, onBlocksChange, updateBlock]);

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
        const newY = snapPx(hit.y + hit.h + 8);
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
    const isFromPalette = idStr.startsWith("palette:") || idStr.startsWith("news-card:");
    if (isFromPalette && over) {
      // Ghost показує реальний slot: Y = cursor Y, width підганяється під вільну
      // горизонтальну прорізку (100% якщо порожньо, менше якщо поруч сусіди).
      // Дефолтна ширина для newsCard — 33% (≈1 з 3 у ряду), для решти — 100%.
      const defaultW = idStr.startsWith("news-card:") ? 33 : 100;
      const xPx = cursorX - rect.left;
      const yPx = cursorY - rect.top;
      const cursorXPct = (xPx / rect.width) * 100;
      const slot = findDropSlot(null, cursorXPct, yPx, defaultW);
      const clamped = clampXY(slot.x, slot.y, slot.width);
      const final = { x: clamped.x, y: clamped.y, width: slot.width };
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
        const rawX = snapPct(currentX + deltaXPct);
        const rawY = snapPx(currentY + deltaYPx);
        let { x, y } = clampXY(rawX, rawY, wPct);

        // === Snap + Alignment guides (Figma-style) ===
        // Снап до countra: краї блоків, центри, та краї канваса. Після снапу
        // генеруємо guide-лінії що показують З ким саме A вирівнялась.
        const SNAP_TOL_X = 1.8;     // pct — толеранс снапу по X
        const SNAP_TOL_Y = 8;        // px — толеранс снапу по Y
        const Y_PROX_PX = 14;        // вертикальна "близькість" — лише блоки в межах рахуємо
        const X_PROX_PCT = 2;
        const CANVAS_EDGE_PCT = 4;
        const CANVAS_EDGE_PX = 14;
        const bh = measureBlockHeight(b);

        // 1) Canvas-edge snap — пріоритет над block-edge
        let lockedX = false;
        let lockedY = false;
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

        // 2) Збираємо ВСІ кандидати на snap (по 5 для кожної осі):
        //    edges (4 кейси) + center (1 кейс) на блок. Беремо найближчий.
        type Cand = { newPos: number; dist: number };
        const xCands: Cand[] = [];
        const yCands: Cand[] = [];
        for (const o of blocks) {
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

        // 3) Після снапу — детектимо ВСІ alignments через спільний helper.
        detectAlignmentsAt(b.id, x, y, wPct, bh);
        dropPreviewRef.current = { x, y, width: wPct };
        setDropPreview({ x, y, width: wPct });

        // Live displacement preview: симулюємо displaceBlocksAround для поточної drop-позиції
        // і пушимо результат у previewWidths/previewXs, щоб сусіди звужувались/зсувались
        // плавно ВЖЕ під час drag, а не різко на drop.
        const simRect = { x, y, width: wPct, height: bh };
        const simulated = displaceBlocksAround(simRect, blocks, b.id);
        const changed = new Set<string>();
        for (const sim of simulated) {
          if (sim.id === b.id) continue;
          const orig = blocks.find(o => o.id === sim.id);
          if (!orig) continue;
          const origW = Number(orig.width) || 100;
          const simW = Number(sim.width) || 100;
          const origX = orig.x ?? 0;
          const simX = sim.x ?? 0;
          if (Math.abs(simW - origW) > 0.5) {
            setPreview(sim.id, simW);
            changed.add(sim.id);
          }
          if (Math.abs(simX - origX) > 0.5) {
            setPreviewX(sim.id, simX);
            changed.add(sim.id);
          }
        }
        // Очищуємо preview для блоків, які при цій drop-позиції не зачіпаються —
        // інакше вони "застрягнуть" у попередньому preview-стані з минулого frame.
        for (const o of blocks) {
          if (o.id === b.id || changed.has(o.id)) continue;
          clearPreview(o.id);
          clearPreviewX(o.id);
        }
      }
    }
  }, [blocks, canvasWidthPx, setPreview, setPreviewX, clearPreview, clearPreviewX, detectAlignmentsAt]);

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

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const idStr = String(event.active.id);
    const isPalette = idStr.startsWith("palette:");
    const isNewsCard = idStr.startsWith("news-card:");
    const isFromPalette = isPalette || isNewsCard;
    const preview = dropPreviewRef.current;
    const rect = canvasRectRef.current;

    setActiveId(null);
    setIsOverCanvas(false);
    dropPreviewRef.current = null;
    setDropPreview(null);
    setAlignGuides([]);
    setSizeMatches([]);

    if (isFromPalette) {
      if (!rect) return;
      const ev = event.activatorEvent as MouseEvent;
      const cursorX = ev.clientX + (event.delta?.x || 0);
      const cursorY = ev.clientY + (event.delta?.y || 0);
      if (cursorX < rect.left || cursorX > rect.right || cursorY < rect.top) return;

      // Спецкейс: image-overlay → drop у конкретний image-блок під курсором
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
        if (!target) {
          // fallback — у останнє фото в дефолтну позицію
          target = candidates[candidates.length - 1] || null;
          if (!target) { alert("Спершу додайте блок Фото з картинкою"); return; }
        }
        let arr: Array<Record<string, unknown>> = [];
        try { const p = JSON.parse(target.data.overlays || "[]"); if (Array.isArray(p)) arr = p; } catch { /* ignore */ }
        const newId = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `ov_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        arr.push({ id: newId, text: "", x: 0, y: Math.max(0, Math.min(88, relY - 6)), w: 100, h: 12, fontSize: 32, color: "#FFFFFF", weight: 700, bgColor: "#1C3A2E" });
        const targetId = target.id;
        onBlocksChange(blocks.map(b => b.id === targetId ? { ...b, data: { ...b.data, overlays: JSON.stringify(arr) } } : b));
        return;
      }

      const type: BlockType = isNewsCard ? "newsCard" : (idStr.replace("palette:", "") as BlockType);
      const droppedNewsId = isNewsCard ? idStr.replace("news-card:", "") : "";
      const newId = uid();
      const estH = TYPE_HEIGHT[type] ?? 80;

      // Новий блок сідає ТУДИ, куди ти його кинув (preview) — а існуючі адаптуються.
      // Divider: завжди 100% ширини; решта: використовуємо preview (smart slot).
      let x: number, y: number, width: number;
      if (type === "divider") {
        x = 0; y = snapPx(cursorY - rect.top); width = 100;
      } else {
        x = preview?.x ?? 0; y = preview?.y ?? 0; width = preview?.width ?? 100;
      }
      const clamped = clampXY(x, y, width);

      // Displacement: якщо є overlap — пересуваємо/стискаємо існуючі блоки.
      let finalBlocks = blocks;
      if (hasCollision(clamped.x, clamped.y, width, estH, null)) {
        finalBlocks = displaceBlocksAround(
          { x: clamped.x, y: clamped.y, width, height: estH },
          blocks,
          null,
        );
      }

      // Дефолтні data: для newsCard — ID конкретної новини (з drag-payload з правого бару).
      const defaultData: Record<string, string> =
        type === "newsCard" ? { newsId: droppedNewsId } : {};
      const newBlock: Block = {
        id: newId, type, data: defaultData,
        width: String(roundW(width)), align: "left", bgColor: "",
        x: clamped.x, y: clamped.y,
        // ⚠️ Явна height ОБОВ'ЯЗКОВА: інакше wrapper стає auto, content всередині
        // (наприклад YouTube iframe) рендериться, але block-чи canvasHeight рахується
        // ДО того як content підвантажився → блок вилазить за canvas.
        // Для divider/text/heading/quote — TYPE_HEIGHT теж дає sane default.
        height: estH,
      };
      onBlocksChange([...finalBlocks, newBlock]);
      setLastAddedId(newId);
      return;
    }

    // Existing block drag — block лишається де ти його кинув, сусіди адаптуються.
    if (!preview) return;
    const idx = blocks.findIndex(b => b.id === idStr);
    if (idx < 0) return;
    clearPreview(idStr);
    const b = blocks[idx];
    const bh = measureBlockHeight(b);

    let next = blocks.slice();
    next[idx] = { ...next[idx], x: preview.x, y: preview.y };

    if (hasCollision(preview.x, preview.y, preview.width, bh, b.id)) {
      next = displaceBlocksAround(
        { x: preview.x, y: preview.y, width: preview.width, height: bh },
        next,
        b.id,
      );
    }

    onBlocksChange(next);
  }, [blocks, onBlocksChange, clearPreview, canvasHeight]);

  const paletteBlock = (activeId?.startsWith("palette:") || activeId?.startsWith("news-card:"))
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
        <div style={{ display: "flex", gap: "20px", alignItems: "stretch" }}>
          <BlockPalette
            extraBlocks={extraPaletteBlocks}
            extraBlocksTitle={extraPaletteBlocksTitle}
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

          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{
              width: "100%",
              maxWidth: `${PAGE_WIDTH + PAGE_PAD_X * 2}px`,
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
              <span>{"📄 Сторінка новини"}</span>
              <span style={{ color: "#D4A843" }}>{`${PAGE_WIDTH}px — така ширина на сайті`}</span>
            </div>

            <div
              style={{
                width: "100%",
                maxWidth: `${PAGE_WIDTH + PAGE_PAD_X * 2}px`,
                background: pageBgColor || "#FFFFFF",
                borderRadius: "14px",
                border: "1px solid #E5E7EB",
                boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 12px 40px rgba(15,32,25,0.08)",
                padding: `${PAGE_PAD_Y}px ${PAGE_PAD_X}px`,
                position: "relative",
              }}
            >
              <div
                ref={canvasRef}
                className="canvas-grid"
                style={{
                  position: "relative",
                  width: "100%",
                  minHeight: `${canvasHeight}px`,
                  height: `${canvasHeight}px`,
                  // Канвас — субтильна рамка (це область сторінки, не блок).
                  outline: "1px dashed rgba(28,58,46,0.18)",
                  outlineOffset: "0px",
                  borderRadius: "4px",
                  transition: activeId ? "none" : "height 0.2s",
                }}
                onDragOver={e => e.preventDefault()}
                onClick={(e) => { if (e.target === e.currentTarget) setSelectedBlockId(null); }}
              >
                {blocks.length === 0 && !activeId && (
                  <EmptyHint />
                )}

                {/* Page-width ruler — тонка лінійка зверху канвасу, показує
                    ширину і позицію блока в % від сторінки. Показується для:
                    1) активного resize/drag (блок який зараз пересувають) — режим "active"
                    2) виділеного блока (selected) — режим "selected" (ще тонше)
                    Не показується при hover і коли нічого не виділено. */}
                {(() => {
                  // Пріоритет: resize > drag > selected.
                  const dragId = activeId && !activeId.startsWith("palette:") ? activeId : null;
                  const activeId_ = resizingBlockId ?? dragId;
                  const targetId = activeId_ ?? selectedBlockId;
                  if (!targetId) return null;
                  const b = blocks.find(x => x.id === targetId);
                  if (!b) return null;
                  let liveX = previewXs[targetId] ?? b.x ?? 0;
                  let liveW = previewWidths[targetId] ?? (Number(b.width) || 100);
                  if (dragId === targetId && dropPreview) {
                    liveX = dropPreview.x;
                    liveW = dropPreview.width;
                  }
                  const mode: "active" | "selected" = activeId_ ? "active" : "selected";
                  return (
                    <ResizeRuler
                      blockX={liveX}
                      blockWidthPct={liveW}
                      pxPerPct={canvasWidthPx / 100}
                      mode={mode}
                    />
                  );
                })()}

                {/* Ghost — показуємо ТІЛЬКИ при drag з палітри (для existing-block drag достатньо самого блока + snap-glow).
                    Виняток: palette:image-overlay не створює самостійний блок (drop йде оверлеєм на image),
                    тому "вільний" ghost-слот у канвасі для нього не малюємо. */}
                {activeId && activeId.startsWith("palette:") && activeId !== "palette:image-overlay" && dropPreview && isOverCanvas && (
                  <DropGhost
                    x={dropPreview.x}
                    y={dropPreview.y}
                    widthPct={dropPreview.width}
                    height={80}
                    paletteColor={paletteBlock?.color}
                  />
                )}

                {/* Alignment guides — Figma-style лінії під час drag-у. Edge-snap
                    показується solid, center-alignment — dashed. */}
                {alignGuides.map((g, i) => (
                  <AlignmentGuideLine key={`g-${i}`} guide={g} />
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
                  // Якщо previewX є (сусід під час resize-drag) — використовуємо його, інакше block.x
                  const x = previewXs[block.id] !== undefined ? previewXs[block.id] : (block.x ?? 0);
                  const y = block.y ?? 0;
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
                      onChange={handleUpdateBlock}
                      onMoveUp={id => moveBlock(id, "up")}
                      onMoveDown={id => moveBlock(id, "down")}
                      onDuplicate={id => { const newId = duplicateBlock(id); if (newId) setLastAddedId(newId); }}
                      onSetWidth={handleSetWidth}
                      onSetWidthAndData={handleSetWidthAndData}
                      onSetAlign={setAlign}
                      onSetVAlign={setVAlign}
                      onSetBg={setBg}
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
                      isActive={activeId === block.id}
                      selected={selectedBlockId === block.id}
                      onSelect={(id) => setSelectedBlockId(prev => prev === id ? null : id)}
                      scrollCompensation={activeId === block.id ? scrollCompensation : 0}
                    />
                  );
                })}
              </div>
            </div>

            <div style={{
              marginTop: "10px",
              fontSize: "11px",
              color: "#9CA3AF",
              fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
              textAlign: "center",
              maxWidth: `${PAGE_WIDTH + PAGE_PAD_X * 2}px`,
            }}>
              {"Тягніть блоки за хедер куди завгодно на сторінці. Край → resize. Snap 8px."}
            </div>
          </div>

          {/* Правий сайдбар. ВСЕРЕДИНІ DndContext щоб draggable у ньому (картки новин з
              NewsLibrarySidebar) поділяли той самий контекст з канвасом. Sticky — щоб
              слідував за скролом, як ліва палітра. */}
          {rightSidebar && (
            <div
              className="news-palette-scroll"
              style={{
                position: "sticky",
                top: "80px",
                alignSelf: "flex-start",
                maxHeight: "calc(100vh - 100px)",
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
function AlignmentGuideLine({ guide }: {
  guide: { axis: "x" | "y"; pos: number; start: number; end: number; kind: "edge" | "center" };
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
    const lineStyle: React.CSSProperties = {
      position: "absolute",
      left: `calc(${guide.pos}% - 0.5px)`,
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
        <div style={{ ...dotStyle, left: `calc(${guide.pos}% - 3px)`, top: `${guide.start - 3}px` }} />
        <div style={{ ...dotStyle, left: `calc(${guide.pos}% - 3px)`, top: `${guide.end - 3}px` }} />
      </>
    );
  }
  // axis === "y"
  const lineStyle: React.CSSProperties = {
    position: "absolute",
    left: `${guide.start}%`,
    top: `${guide.pos - 0.5}px`,
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
      <div style={{ ...dotStyle, left: `calc(${guide.start}% - 3px)`, top: `${guide.pos - 3}px` }} />
      <div style={{ ...dotStyle, left: `calc(${guide.end}% - 3px)`, top: `${guide.pos - 3}px` }} />
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
  onUpload: (file: File) => Promise<string>;
  onPreviewWidth: (id: string, pct: number) => void;
  onClearPreview: (id: string) => void;
  onPreviewHeight: (id: string, h: number) => void;
  onClearPreviewHeight: (id: string) => void;
  onReportHeight: (id: string, h: number) => void;
  selected: boolean;
  onSelect: (id: string) => void;
  /** Пікс. компенсація скролу під час drag — додається до transform.y щоб блок
   *  залишався під курсором коли юзер скролить колесом без руху мишки. */
  scrollCompensation?: number;
}) {
  const { block, x, y, widthPct, lastAddedId, previewHeight, isActive, canvasWidthPx, selected, scrollCompensation = 0 } = props;
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
  const wrapperListeners: React.HTMLAttributes<HTMLElement> = listeners ? {
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
        const t = e.target as HTMLElement;
        const insideEditable = !!t.closest("input, textarea, [contenteditable=\"true\"], select, button");
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
        height: (previewHeight && previewHeight > 0)
          ? `${previewHeight}px`
          : (block.height ? `${block.height}px` : undefined),
        transform: translate,
        zIndex: isActive || isDragging ? 30 : 1,
        opacity: isDragging ? 0.65 : 1,
        transition: isDragging ? "none" : "left 0.12s, top 0.12s, width 0.12s",
        outline: selected ? "2px solid #D4A843" : "none",
        outlineOffset: "2px",
        borderRadius: selected ? "12px" : 0,
        // Cursor "grab" як affordance що блок можна тягати з будь-якого місця.
        // Дочірні contenteditable/input/button мають свої cursors → не перекривається.
        cursor: isDragging ? "grabbing" : "grab",
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
        onUpload={props.onUpload}
        containerWidthPx={canvasWidthPx}
        onPreviewWidth={props.onPreviewWidth}
        onClearPreview={props.onClearPreview}
        onPreviewHeight={props.onPreviewHeight}
        onClearPreviewHeight={props.onClearPreviewHeight}
        previewHeight={previewHeight}
        onReportHeight={props.onReportHeight}
        getSameRowHeights={() => []}
        snapThreshold={8}
        onSelectBlock={props.onSelect}
      />
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
