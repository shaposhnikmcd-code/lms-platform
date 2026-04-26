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

const PAGE_WIDTH = CANVAS_WIDTH;
const PAGE_PAD_X = 32;
const PAGE_PAD_Y = 32;
const SNAP = 8;         // px — вертикальний і горизонтальний grid
const MIN_CANVAS_H = 500;

// Type-based дефолт для ще не виміряного блока (fallback, коли DOM offsetHeight ще недоступний).
const TYPE_HEIGHT: Record<BlockType, number> = {
  heading: 80, text: 180, image: 300, youtube: 360, quote: 120, divider: 40, card: 280,
};

interface Props {
  blocks: Block[];
  onBlocksChange: (blocks: Block[]) => void;
  onUpload: (file: File) => Promise<string>;
  pageBgColor?: string;
}

export default function EditorCanvas({ blocks, onBlocksChange, onUpload, pageBgColor }: Props) {
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const canvasRectRef = useRef<DOMRect | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isOverCanvas, setIsOverCanvas] = useState(false);
  const dropPreviewRef = useRef<{ x: number; y: number; width: number } | null>(null);
  const [dropPreview, setDropPreview] = useState<{ x: number; y: number; width: number } | null>(null);
  // Edge-snap: масив — дозволяє одночасно snap по X і Y (наприклад, у куті),
  // показуючи відразу обидва glow.
  type SnapEdge = { blockId: string; edge: "left" | "right" | "top" | "bottom" };
  const [snapTargets, setSnapTargets] = useState<SnapEdge[]>([]);
  const activePaletteRef = useRef<typeof PALETTE_BLOCKS[0] | null>(null);
  const blockHeightsRef = useRef<Record<string, number>>({});
  const [, forceTick] = useState(0);

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
    setWidth, setWidthAndData, setAlign, setBg,
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
  const canvasHeight = Math.max(
    MIN_CANVAS_H,
    ...blocks.map(b => (b.y ?? 0) + measureBlockHeight(b) + 40),
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
        const nx = neighbor.x ?? 0;
        const nw = Number(neighbor.width) || 100;
        const roomToShift = Math.max(0, 100 - (nx + nw));
        const shiftDelta = Math.min(delta, roomToShift);
        const remaining = delta - shiftDelta;
        const maxShrink = Math.max(0, nw - MIN_NEIGHBOR_WIDTH);
        const shrinkDelta = Math.min(remaining, maxShrink);
        const actualDelta = shiftDelta + shrinkDelta;
        const appliedW = oldW + actualDelta;
        onBlocksChange(blocks.map(o => {
          if (o.id === id) return { ...o, width: String(Math.round(appliedW)) };
          if (o.id === neighbor.id) return {
            ...o,
            x: nx + actualDelta,
            width: String(Math.round(nw - shrinkDelta)),
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
    setWidth(id, String(Math.round(clampedW)));
  }, [blocks, onBlocksChange, setWidth, clearPreview, clearPreviewX]);

  const handleSetWidthAndData = useCallback((id: string, w: BlockWidth, data: Record<string, string>) => {
    // Image/diagonal resize: new height приходить у data.minHeight. Після neighbor-shrink
    // перевіряємо чи нові межі блока (включно з висотою) не налазять на блоки НИЖЧЕ —
    // якщо так, викликаємо displaceBlocksAround щоб їх акуратно посунути.
    const b = blocks.find(x => x.id === id);
    if (!b) { setWidthAndData(id, w, data); return; }
    const newW = Number(w);
    const oldW = Number(b.width) || 100;
    const delta = newW - oldW;
    const bx = b.x ?? 0;
    const by = b.y ?? 0;
    const newH = Number(data.minHeight) || measureBlockHeight(b);

    // Крок 1: будуємо новий стан з neighbor-shrink (якщо сусід є і блок росте)
    let appliedW = newW;
    let next: Block[];
    let neighborId: string | null = null;
    if (delta > 0) {
      const neighbor = findRightNeighbor(id);
      if (neighbor) {
        neighborId = neighbor.id;
        const nx = neighbor.x ?? 0;
        const nw = Number(neighbor.width) || 100;
        const roomToShift = Math.max(0, 100 - (nx + nw));
        const shiftDelta = Math.min(delta, roomToShift);
        const remaining = delta - shiftDelta;
        const maxShrink = Math.max(0, nw - MIN_NEIGHBOR_WIDTH);
        const shrinkDelta = Math.min(remaining, maxShrink);
        const actualDelta = shiftDelta + shrinkDelta;
        appliedW = oldW + actualDelta;
        next = blocks.map(o => {
          if (o.id === id) return { ...o, width: String(Math.round(appliedW)), data };
          if (o.id === neighbor.id) return { ...o, x: nx + actualDelta, width: String(Math.round(nw - shrinkDelta)) };
          return o;
        });
      } else {
        appliedW = Math.max(MIN_NEIGHBOR_WIDTH, Math.min(100 - bx, newW));
        next = blocks.map(o => o.id === id ? { ...o, width: String(Math.round(appliedW)), data } : o);
      }
    } else {
      appliedW = Math.max(MIN_NEIGHBOR_WIDTH, Math.min(100 - bx, newW));
      next = blocks.map(o => o.id === id ? { ...o, width: String(Math.round(appliedW)), data } : o);
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

  // Live preview — пушимо в previewWidths і previewXs, щоб сусід рухався плавно під час drag.
  const handlePreviewWidth = useCallback((id: string, pct: number) => {
    const b = blocks.find(x => x.id === id);
    if (!b) { setPreview(id, pct); return; }
    const oldW = Number(b.width) || 100;
    const delta = pct - oldW;

    if (delta > 0) {
      const neighbor = findRightNeighbor(id);
      if (neighbor) {
        const nx = neighbor.x ?? 0;
        const nw = Number(neighbor.width) || 100;
        const roomToShift = Math.max(0, 100 - (nx + nw));
        const shiftDelta = Math.min(delta, roomToShift);
        const remaining = delta - shiftDelta;
        const maxShrink = Math.max(0, nw - MIN_NEIGHBOR_WIDTH);
        const shrinkDelta = Math.min(remaining, maxShrink);
        const actualDelta = shiftDelta + shrinkDelta;
        setPreview(id, oldW + actualDelta);
        setPreviewX(neighbor.id, nx + actualDelta);
        setPreview(neighbor.id, nw - shrinkDelta);
        return;
      }
    }
    const bx = b.x ?? 0;
    const clampedW = Math.max(MIN_NEIGHBOR_WIDTH, Math.min(100 - bx, pct));
    setPreview(id, clampedW);
  }, [blocks, setPreview, setPreviewX]);

  const handleClearPreview = useCallback((id: string) => {
    clearPreview(id);
    // Якщо превʼювали сусіда — чистимо і його
    const neighbor = findRightNeighbor(id);
    if (neighbor) {
      clearPreview(neighbor.id);
      clearPreviewX(neighbor.id);
    }
  }, [clearPreview, clearPreviewX, blocks]);

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
          result[i] = { ...b, width: String(Math.round(leftFitW)) };
          upsertReserved({ x: bx, y: by, w: leftFitW, h: bh, id: b.id });
          changed = true;
          continue;
        }
        // Варіант 2: блок частково справа від reserved — зсуваємо + стискаємо
        const rightStart = hit.x + hit.w;
        const rightFitW = (bx + bw) - rightStart;
        if (rightFitW >= MIN_W && bx + bw > rightStart) {
          result[i] = { ...b, x: rightStart, width: String(Math.round(rightFitW)) };
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
    setSnapTargets([]);
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
        activePaletteRef.current = PALETTE_BLOCKS.find(b => `palette:${b.type}` === idStr) || null;
      }
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
    if (idStr.startsWith("palette:") && over) {
      // Ghost показує реальний slot: Y = cursor Y, width підганяється під вільну
      // горизонтальну прорізку (100% якщо порожньо, менше якщо поруч сусіди).
      const xPx = cursorX - rect.left;
      const yPx = cursorY - rect.top;
      const cursorXPct = (xPx / rect.width) * 100;
      const slot = findDropSlot(null, cursorXPct, yPx, 100);
      const clamped = clampXY(slot.x, slot.y, slot.width);
      const final = { x: clamped.x, y: clamped.y, width: slot.width };
      dropPreviewRef.current = final;
      setDropPreview(final);
    } else if (!idStr.startsWith("palette:")) {
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

        // === Edge snap (magnetic alignment) ===
        const SNAP_X_PCT = 3;
        const SNAP_Y_PX = 10;
        const Y_PROX_PX = 12;
        const X_PROX_PCT = 1.5;
        // Canvas-edge snap — ширший поріг, щоб легко було "примагнітити" блок впритул
        // до лівого/правого/верхнього краю канваса без акуратного прицілу.
        const CANVAS_EDGE_PCT = 4;
        const CANVAS_EDGE_PX = 14;
        const bh = measureBlockHeight(b);
        const snaps: SnapEdge[] = [];

        // 1) Canvas-edge snap — перевіряємо першим, він має пріоритет над block-edge
        let lockedX = false;
        let lockedY = false;
        if (x + wPct >= 100 - CANVAS_EDGE_PCT) {
          x = Math.max(0, 100 - wPct); // правий край
          lockedX = true;
        } else if (x <= CANVAS_EDGE_PCT) {
          x = 0; // лівий край
          lockedX = true;
        }
        if (y <= CANVAS_EDGE_PX) {
          y = 0;
          lockedY = true;
        }

        for (const o of blocks) {
          if (o.id === b.id) continue;
          const ox = o.x ?? 0;
          const oy = o.y ?? 0;
          const ow = Number(o.width) || 100;
          const oh = measureBlockHeight(o);
          const oRight = ox + ow;
          const oBottom = oy + oh;

          // Y-proximity: A вертикально перетинається з B (із буфером)
          const yNear = y < oBottom + Y_PROX_PX && y + bh > oy - Y_PROX_PX;
          // X-proximity: A горизонтально перетинається з B (із буфером)
          const xNear = x < oRight + X_PROX_PCT && x + wPct > ox - X_PROX_PCT;

          // === X-snap (потрібна Y-proximity, і тільки якщо ще не locked на край канваса) ===
          if (yNear && !lockedX) {
            if (Math.abs(x - oRight) <= SNAP_X_PCT) {
              x = oRight;
              snaps.push({ blockId: o.id, edge: "right" });
            } else if (Math.abs((x + wPct) - ox) <= SNAP_X_PCT) {
              x = Math.max(0, ox - wPct);
              snaps.push({ blockId: o.id, edge: "left" });
            } else if (Math.abs(x - ox) <= SNAP_X_PCT) {
              x = ox;
              snaps.push({ blockId: o.id, edge: "left" });
            } else if (Math.abs((x + wPct) - oRight) <= SNAP_X_PCT) {
              x = Math.max(0, oRight - wPct);
              snaps.push({ blockId: o.id, edge: "right" });
            }
          }

          // === Y-snap (потрібна X-proximity, і тільки якщо ще не locked на край канваса) ===
          if (xNear && !lockedY) {
            if (Math.abs(y - oBottom) <= SNAP_Y_PX) {
              y = oBottom;
              snaps.push({ blockId: o.id, edge: "bottom" });
            } else if (Math.abs((y + bh) - oy) <= SNAP_Y_PX) {
              y = Math.max(0, oy - bh);
              snaps.push({ blockId: o.id, edge: "top" });
            } else if (Math.abs(y - oy) <= SNAP_Y_PX) {
              y = oy;
              snaps.push({ blockId: o.id, edge: "top" });
            }
          }
        }

        setSnapTargets(snaps);
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
  }, [blocks, canvasWidthPx, setPreview, setPreviewX, clearPreview, clearPreviewX]);

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
    const preview = dropPreviewRef.current;
    const rect = canvasRectRef.current;

    setActiveId(null);
    setIsOverCanvas(false);
    dropPreviewRef.current = null;
    setDropPreview(null);
    setSnapTargets([]);

    if (isPalette) {
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

      const type = idStr.replace("palette:", "") as BlockType;
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

      const newBlock: Block = {
        id: newId, type, data: {},
        width: String(Math.round(width)), align: "left", bgColor: "",
        x: clamped.x, y: clamped.y,
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

  const paletteBlock = activeId?.startsWith("palette:") ? activePaletteRef.current : null;

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
      >
        <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
          <BlockPalette onAddImageOverlay={() => {
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
                  // Рамка прямо на canvas-області — там, де реально живуть блоки.
                  // Блок з x=0, y=0 торкається рамки впритул (це і є "впритул вліво/вгору").
                  outline: "2px dashed #D4A843",
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

                {/* Ghost — показуємо ТІЛЬКИ при drag з палітри (для existing-block drag достатньо самого блока + snap-glow) */}
                {activeId && activeId.startsWith("palette:") && dropPreview && isOverCanvas && (
                  <DropGhost
                    x={dropPreview.x}
                    y={dropPreview.y}
                    widthPct={dropPreview.width}
                    height={80}
                    paletteColor={paletteBlock?.color}
                  />
                )}

                {/* Snap edge overlays — один на кожне прилипання (X і Y можуть бути одночасно) */}
                {snapTargets.map((s, i) => {
                  const t = blocks.find(b => b.id === s.blockId);
                  if (!t) return null;
                  const tx = t.x ?? 0;
                  const ty = t.y ?? 0;
                  const tw = Number(t.width) || 100;
                  const th = measureBlockHeight(t);
                  return <SnapEdgeOverlay key={`${s.blockId}-${s.edge}-${i}`} x={tx} y={ty} width={tw} height={th} edge={s.edge} />;
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
                      onSetBg={setBg}
                      onUpload={onUpload}
                      onPreviewWidth={handlePreviewWidth}
                      onClearPreview={handleClearPreview}
                      onPreviewHeight={setPreviewHeight}
                      onClearPreviewHeight={clearPreviewHeight}
                      onReportHeight={(id, h) => {
                        blockHeightsRef.current[id] = h;
                        reportHeight(id, h);
                        forceTick(t => (t + 1) % 1024);
                      }}
                      isActive={activeId === block.id}
                      selected={selectedBlockId === block.id}
                      onSelect={(id) => setSelectedBlockId(prev => prev === id ? null : id)}
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

// Snap edge overlay — абсолютно позиціонується на канвасі, zIndex 100, тому glow завжди
// видно поверх dragging-блока. Координати приходять від target-блока (x, y — %, px), і ми
// рендеримо smug 4px на потрібному краю.
function SnapEdgeOverlay({ x, y, width, height, edge }: {
  x: number; y: number; width: number; height: number;
  edge: "left" | "right" | "top" | "bottom";
}) {
  const thick = 4;
  const glow = "0 0 12px 2px rgba(212,168,67,0.95), 0 0 28px 6px rgba(212,168,67,0.55)";
  const base: React.CSSProperties = {
    position: "absolute",
    background: "#D4A843",
    borderRadius: "3px",
    boxShadow: glow,
    pointerEvents: "none",
    zIndex: 100,
    animation: "snap-edge-pulse 0.5s ease-in-out infinite alternate",
  };
  // Обмежуємо довжину glow — центруємо по краю, максимум 140px (щоб на високих блоках
  // не світилась смуга на весь екран)
  const MAX_SIDE = 140;
  if (edge === "left" || edge === "right") {
    const glowH = Math.min(MAX_SIDE, height - 8);
    const glowTop = y + (height - glowH) / 2;
    const leftPx = edge === "left" ? `calc(${x}% - ${thick / 2}px)` : `calc(${x + width}% - ${thick / 2}px)`;
    return <div style={{ ...base, left: leftPx, top: `${glowTop}px`, width: `${thick}px`, height: `${glowH}px` }} />;
  }
  // top / bottom — горизонтальна смужка. Беремо всю ширину блока, але розмір у % → це OK.
  const topPx = edge === "top" ? y - thick / 2 : y + height - thick / 2;
  return <div style={{ ...base, left: `calc(${x}% + 4px)`, top: `${topPx}px`, width: `calc(${width}% - 8px)`, height: `${thick}px` }} />;
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
  onSetWidthAndData: (id: string, w: string, data: Record<string, string>) => void;
  onSetAlign: (id: string, a: "left" | "center" | "right") => void;
  onSetBg: (id: string, c: string) => void;
  onUpload: (file: File) => Promise<string>;
  onPreviewWidth: (id: string, pct: number) => void;
  onClearPreview: (id: string) => void;
  onPreviewHeight: (id: string, h: number) => void;
  onClearPreviewHeight: (id: string) => void;
  onReportHeight: (id: string, h: number) => void;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const { block, x, y, widthPct, lastAddedId, previewHeight, isActive, canvasWidthPx, selected } = props;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: block.id });

  const translate = transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined;

  return (
    <div
      ref={setNodeRef}
      data-block-id={block.id}
      onClick={(e) => {
        e.stopPropagation();
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
        // Висота = block.height (як на public). Це важливо щоб snap edge / drop slot
        // обчислювались за фактичним розміром блока, а не за висотою auto-content.
        height: block.height ? `${block.height}px` : undefined,
        transform: translate,
        zIndex: isActive || isDragging ? 30 : 1,
        opacity: isDragging ? 0.65 : 1,
        transition: isDragging ? "none" : "left 0.12s, top 0.12s, width 0.12s",
        outline: selected ? "2px solid #D4A843" : "none",
        outlineOffset: "2px",
        borderRadius: selected ? "12px" : 0,
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
      />
    </div>
  );
}
