import { useCallback, useState } from "react";
import { Block, BlockAlign, BlockWidth } from "../types";

export function useBlockManager(initial: Block[], onChange: (blocks: Block[]) => void) {
  const [previewWidths, setPreviewWidths] = useState<Record<string, number>>({});
  const [previewHeights, setPreviewHeights] = useState<Record<string, number>>({});
  const [blockHeights, setBlockHeights] = useState<Record<string, number>>({});

  const updateBlock = useCallback((id: string, data: Record<string, string>) =>
    onChange(initial.map(b => b.id === id ? { ...b, data } : b)), [initial, onChange]);

  const deleteBlock = useCallback((id: string) =>
    onChange(initial.filter(b => b.id !== id)), [initial, onChange]);

  const setWidth = useCallback((id: string, w: BlockWidth) => {
    setPreviewWidths(prev => { const n = { ...prev }; delete n[id]; return n; });
    onChange(initial.map(b => b.id === id ? { ...b, width: w } : b));
  }, [initial, onChange]);

  // Атомарний апдейт: одночасно ширина + data. Використовується для діагонального resize,
  // щоб уникнути stale-closure overlap між setWidth і updateBlock при послідовних викликах.
  const setWidthAndData = useCallback((id: string, w: BlockWidth, data: Record<string, string>) => {
    setPreviewWidths(prev => { const n = { ...prev }; delete n[id]; return n; });
    onChange(initial.map(b => b.id === id ? { ...b, width: w, data } : b));
  }, [initial, onChange]);

  const setAlign = useCallback((id: string, a: BlockAlign) =>
    onChange(initial.map(b => b.id === id ? { ...b, align: a } : b)), [initial, onChange]);

  const setBg = useCallback((id: string, c: string) =>
    onChange(initial.map(b => b.id === id ? { ...b, bgColor: c } : b)), [initial, onChange]);

  const setPreview = useCallback((id: string, pct: number) =>
    setPreviewWidths(prev => ({ ...prev, [id]: pct })), []);

  const clearPreview = useCallback((id: string) =>
    setPreviewWidths(prev => { const n = { ...prev }; delete n[id]; return n; }), []);

  const setPreviewHeight = useCallback((id: string, h: number) =>
    setPreviewHeights(prev => ({ ...prev, [id]: h })), []);

  const clearPreviewHeight = useCallback((id: string) =>
    setPreviewHeights(prev => { const n = { ...prev }; delete n[id]; return n; }), []);

  const reportHeight = useCallback((id: string, h: number) =>
    setBlockHeights(prev => prev[id] === h ? prev : { ...prev, [id]: h }), []);

  return {
    previewWidths, previewHeights, blockHeights,
    updateBlock, deleteBlock,
    setWidth, setWidthAndData, setAlign, setBg,
    setPreview, clearPreview, setPreviewHeight, clearPreviewHeight, reportHeight,
  };
}