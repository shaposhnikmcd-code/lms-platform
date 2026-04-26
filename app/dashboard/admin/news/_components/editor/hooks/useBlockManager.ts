import { useCallback, useState } from "react";
import { Block, BlockAlign, BlockWidth } from "../types";

export function useBlockManager(initial: Block[], onChange: (blocks: Block[]) => void) {
  const [previewWidths, setPreviewWidths] = useState<Record<string, number>>({});
  const [previewXs, setPreviewXs] = useState<Record<string, number>>({});
  const [previewHeights, setPreviewHeights] = useState<Record<string, number>>({});
  const [blockHeights, setBlockHeights] = useState<Record<string, number>>({});

  const updateBlock = useCallback((id: string, data: Record<string, string>) =>
    onChange(initial.map(b => b.id === id ? { ...b, data } : b)), [initial, onChange]);

  const deleteBlock = useCallback((id: string) =>
    onChange(initial.filter(b => b.id !== id)), [initial, onChange]);

  const moveBlock = useCallback((id: string, dir: "up" | "down") => {
    const idx = initial.findIndex(b => b.id === id);
    if (idx < 0) return;
    const target = dir === "up" ? idx - 1 : idx + 1;
    if (target < 0 || target >= initial.length) return;
    const next = [...initial];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  }, [initial, onChange]);

  const duplicateBlock = useCallback((id: string) => {
    const idx = initial.findIndex(b => b.id === id);
    if (idx < 0) return;
    const b = initial[idx];
    const copy: Block = {
      ...b,
      id: (crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`),
      data: { ...b.data },
      // Зсуваємо копію на 24px вниз, щоб не була ідеально поверх оригіналу
      y: (b.y ?? 0) + 24,
    };
    const next = [...initial];
    next.splice(idx + 1, 0, copy);
    onChange(next);
    return copy.id;
  }, [initial, onChange]);

  const setWidth = useCallback((id: string, w: BlockWidth) => {
    setPreviewWidths(prev => { const n = { ...prev }; delete n[id]; return n; });
    onChange(initial.map(b => b.id === id ? { ...b, width: w } : b));
  }, [initial, onChange]);

  // Атомарний апдейт: одночасно ширина + data + (опційно) висота блока.
  // Використовується для діагонального resize щоб уникнути stale-closure overlap.
  const setWidthAndData = useCallback((id: string, w: BlockWidth, data: Record<string, string>, height?: number) => {
    setPreviewWidths(prev => { const n = { ...prev }; delete n[id]; return n; });
    onChange(initial.map(b => b.id === id
      ? { ...b, width: w, data, ...(height !== undefined ? { height } : {}) }
      : b
    ));
  }, [initial, onChange]);

  const setAlign = useCallback((id: string, a: BlockAlign) =>
    onChange(initial.map(b => b.id === id ? { ...b, align: a } : b)), [initial, onChange]);

  const setBg = useCallback((id: string, c: string) =>
    onChange(initial.map(b => b.id === id ? { ...b, bgColor: c } : b)), [initial, onChange]);

  const setPreview = useCallback((id: string, pct: number) =>
    setPreviewWidths(prev => ({ ...prev, [id]: pct })), []);

  const clearPreview = useCallback((id: string) =>
    setPreviewWidths(prev => { const n = { ...prev }; delete n[id]; return n; }), []);

  const setPreviewX = useCallback((id: string, xPct: number) =>
    setPreviewXs(prev => ({ ...prev, [id]: xPct })), []);

  const clearPreviewX = useCallback((id: string) =>
    setPreviewXs(prev => { const n = { ...prev }; delete n[id]; return n; }), []);

  const setPreviewHeight = useCallback((id: string, h: number) =>
    setPreviewHeights(prev => ({ ...prev, [id]: h })), []);

  const clearPreviewHeight = useCallback((id: string) =>
    setPreviewHeights(prev => { const n = { ...prev }; delete n[id]; return n; }), []);

  const reportHeight = useCallback((id: string, h: number) =>
    setBlockHeights(prev => prev[id] === h ? prev : { ...prev, [id]: h }), []);

  return {
    previewWidths, previewXs, previewHeights, blockHeights,
    updateBlock, deleteBlock, moveBlock, duplicateBlock,
    setWidth, setWidthAndData, setAlign, setBg,
    setPreview, clearPreview, setPreviewX, clearPreviewX,
    setPreviewHeight, clearPreviewHeight, reportHeight,
  };
}