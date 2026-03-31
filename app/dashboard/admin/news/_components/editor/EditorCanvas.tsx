"use client";

import React, { useRef, useState, useEffect } from "react";
import { DndContext, DragOverlay, rectIntersection } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { Block, BlockType } from "./types";
import BlockItem from "./BlockItem";
import BlockPalette from "./BlockPalette";
import { EmptyDropZone, FilledDropZone } from "./DropZones";
import OverlayItem from "./OverlayItem";
import { useBlockManager } from "./hooks/useBlockManager";
import { useEditorDnd } from "./hooks/useEditorDnd";

const GAP = 12;

interface Props {
  blocks: Block[];
  onBlocksChange: (blocks: Block[]) => void;
  onUpload: (file: File) => Promise<string>;
}

export default function EditorCanvas({ blocks, onBlocksChange, onUpload }: Props) {
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const blockElemsRef = useRef<Record<string, HTMLDivElement | null>>({});

  // Лівий край canvas — передаємо в useEditorDnd для точного визначення threshold
  const canvasLeftRef = useRef<number>(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const update = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerWidth(rect.width);
        canvasLeftRef.current = rect.left;
      }
    };
    const ro = new ResizeObserver(update);
    ro.observe(containerRef.current);
    update();
    window.addEventListener("scroll", update, true);
    return () => { ro.disconnect(); window.removeEventListener("scroll", update, true); };
  }, []);

  useEffect(() => {
    if (!lastAddedId) return;
    const t = setTimeout(() => setLastAddedId(null), 600);
    return () => clearTimeout(t);
  }, [lastAddedId]);

  const {
    previewWidths, blockHeights,
    updateBlock, deleteBlock,
    setWidth, setAlign, setBg,
    setPreview, clearPreview, reportHeight,
  } = useBlockManager(blocks, onBlocksChange);

  const {
    sensors, activeId, isOverCanvas, dropWasSuccessRef,
    paletteBlock, handleDragStart, handleDragMove, handleDragEnd,
  } = useEditorDnd({
    blocks,
    onBlocksChange,
    onLastAdded: setLastAddedId,
    onClearPreview: clearPreview,
    canvasLeftRef,
  });

  const innerWidth = Math.max(100, containerWidth - 64);

  const draggingType: BlockType | null = (activeId?.startsWith("palette:") && isOverCanvas)
    ? activeId.replace("palette:", "") as BlockType
    : null;

  function blockWidthStyle(blockId: string, blockWidth: string): string {
    const livePct = previewWidths[blockId];
    const pct = livePct !== undefined ? livePct : Number(blockWidth);
    if (pct >= 100) return "100%";
    const gapCorrection = GAP * (1 - pct / 100);
    return `calc(${pct}% - ${gapCorrection.toFixed(2)}px)`;
  }

  function getSameRowHeights(blockId: string): number[] {
    const el = blockElemsRef.current[blockId];
    if (!el) return [];
    const myTop = el.getBoundingClientRect().top;
    const result: number[] = [];
    for (const [id, h] of Object.entries(blockHeights)) {
      if (id === blockId) continue;
      const sibling = blockElemsRef.current[id];
      if (!sibling) continue;
      if (Math.abs(sibling.getBoundingClientRect().top - myTop) < 40) result.push(h);
    }
    return result;
  }

  return (
    <>
      <style>{`
        @keyframes block-snap-in {
          0%   { opacity: 0; transform: scale(0.9) translateY(10px); }
          60%  { opacity: 1; transform: scale(1.02) translateY(-3px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .block-just-added {
          animation: block-snap-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
      `}</style>

      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
      >
        <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
          <BlockPalette />

          <div ref={containerRef} style={{ flex: 1, minWidth: 0 }}>
            {blocks.length === 0 ? (
              <EmptyDropZone isOver={isOverCanvas} draggingType={draggingType} />
            ) : (
              <FilledDropZone isOver={isOverCanvas} gap={GAP} draggingType={draggingType}>
                <SortableContext items={blocks.map(b => b.id)} strategy={rectSortingStrategy}>
                  <>
                    {blocks.map(block => (
                      <div
                        key={block.id}
                        className={block.id === lastAddedId ? "block-just-added" : undefined}
                        ref={el => { blockElemsRef.current[block.id] = el; }}
                        style={{
                          width: blockWidthStyle(block.id, block.width),
                          flexShrink: 0,
                          flexGrow: 0,
                          boxSizing: "border-box",
                          transition: previewWidths[block.id] !== undefined ? "none" : "width 0.12s",
                        }}
                      >
                        <BlockItem
                          block={block}
                          onChange={updateBlock}
                          onDelete={deleteBlock}
                          onSetWidth={setWidth}
                          onSetAlign={setAlign}
                          onSetBg={setBg}
                          onUpload={onUpload}
                          containerWidthPx={innerWidth}
                          onPreviewWidth={setPreview}
                          onClearPreview={clearPreview}
                          onReportHeight={reportHeight}
                          getSameRowHeights={() => getSameRowHeights(block.id)}
                          snapThreshold={8}
                        />
                      </div>
                    ))}
                  </>
                </SortableContext>
              </FilledDropZone>
            )}
          </div>
        </div>

        <DragOverlay dropAnimation={
          dropWasSuccessRef.current
            ? null
            : { duration: 280, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
        }>
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