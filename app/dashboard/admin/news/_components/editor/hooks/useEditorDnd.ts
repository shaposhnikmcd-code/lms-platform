import { useCallback, useRef, useState } from "react";
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragMoveEvent,
  DragOverEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates, arrayMove } from "@dnd-kit/sortable";
import { Block, BlockType, uid } from "../types";
import { PALETTE_BLOCKS } from "../BlockPalette";

interface Options {
  blocks: Block[];
  onBlocksChange: (blocks: Block[]) => void;
  onLastAdded: (id: string) => void;
  onClearPreview: (id: string) => void;
  canvasLeftRef: React.RefObject<number>;
}

export function useEditorDnd({ blocks, onBlocksChange, onLastAdded, onClearPreview, canvasLeftRef }: Options) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [isOverCanvas, setIsOverCanvas] = useState(false);
  const dropWasSuccessRef = useRef(false);
  const activePaletteBlockRef = useRef<typeof PALETTE_BLOCKS[0] | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const idStr = String(event.active.id);
    setActiveId(idStr);
    setOverId(null);
    setIsOverCanvas(false);
    dropWasSuccessRef.current = false;
    if (idStr.startsWith("palette:")) {
      activePaletteBlockRef.current = PALETTE_BLOCKS.find(b => `palette:${b.type}` === idStr) || null;
    }
  }, []);

  const handleDragMove = useCallback((event: DragMoveEvent) => {
    if (!String(event.active.id).startsWith("palette:")) return;

    // Отримуємо поточну позицію курсора
    const activatorEvent = event.activatorEvent as MouseEvent;
    const currentX = activatorEvent.clientX + (event.delta?.x || 0);

    // Курсор має бути правіше лівого краю canvas
    const canvasLeft = canvasLeftRef.current ?? 9999;
    const over = currentX >= canvasLeft;

    setIsOverCanvas(over);
  }, [canvasLeftRef]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event;
    if (!over) { setOverId(null); return; }
    const id = String(over.id);
    setOverId(id === "canvas-drop" ? null : id);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    const activeStr = String(active.id);
    const isPaletteDrop = activeStr.startsWith("palette:");

    // Успішний drop тільки якщо курсор був над canvas
    dropWasSuccessRef.current = isPaletteDrop && isOverCanvas;

    setActiveId(null);
    setOverId(null);
    setIsOverCanvas(false);

    // Для palette drop перевіряємо isOverCanvas (не over від dnd-kit)
    if (isPaletteDrop) {
      if (!isOverCanvas) return;
      const type = activeStr.replace("palette:", "") as BlockType;
      const newId = uid();
      const newBlock: Block = { id: newId, type, data: {}, width: "100", align: "left", bgColor: "" };
      if (over && String(over.id) !== "canvas-drop" && blocks.length > 0) {
        const idx = blocks.findIndex(b => b.id === String(over.id));
        const nb = [...blocks];
        nb.splice(idx >= 0 ? idx + 1 : nb.length, 0, newBlock);
        onBlocksChange(nb);
      } else {
        onBlocksChange([...blocks, newBlock]);
      }
      onLastAdded(newId);
      return;
    }

    if (!over) return;
    onClearPreview(activeStr);
    const overStr = String(over.id);
    if (activeStr !== overStr) {
      const oldIdx = blocks.findIndex(b => b.id === activeStr);
      const newIdx = blocks.findIndex(b => b.id === overStr);
      if (oldIdx >= 0 && newIdx >= 0) onBlocksChange(arrayMove(blocks, oldIdx, newIdx));
    }
  }, [blocks, isOverCanvas, onBlocksChange, onLastAdded, onClearPreview]);

  const isPalette = activeId?.startsWith("palette:");
  const paletteBlock = isPalette ? activePaletteBlockRef.current : null;

  return {
    sensors,
    activeId,
    overId,
    isOverCanvas,
    dropWasSuccessRef,
    paletteBlock,
    handleDragStart,
    handleDragMove,
    handleDragOver,
    handleDragEnd,
  };
}
