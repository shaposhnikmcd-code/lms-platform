"use client";

import { useState } from "react";
import { Row, Block, BlockType } from "../_components/types";
import { emptyBlock, emptyRow } from "../_components/constants";
import { PickerState } from "../_components/EditorCanvas";

export interface EditorMeta {
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  published?: boolean;
}

export function useEditorState(initialRows: Row[] = []) {
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [picker, setPicker] = useState<PickerState>(null);

  const addBlockToRow = (rowId: string, afterBlockId: string, type: BlockType) => {
    setRows(prev => prev.map(row => {
      if (row.id !== rowId) return row;
      const idx = row.blocks.findIndex(b => b.id === afterBlockId);
      const rowHeight = row.blocks.find(b => b.height)?.height;
      const nb = emptyBlock(type, 30);
      if (rowHeight) nb.height = rowHeight;
      const copy = [...row.blocks];
      copy.splice(idx + 1, 0, nb);
      return { ...row, blocks: copy };
    }));
    setPicker(null);
  };

  const addRowAfter = (afterRowId: string, type: BlockType) => {
    setRows(prev => {
      const idx = prev.findIndex(r => r.id === afterRowId);
      const nr = emptyRow(type);
      const copy = [...prev];
      copy.splice(idx + 1, 0, nr);
      setSelectedId(nr.blocks[0].id);
      return copy;
    });
    setPicker(null);
  };

  const addRow = (type: BlockType) => {
    const nr = emptyRow(type);
    setRows(prev => [...prev, nr]);
    setSelectedId(nr.blocks[0].id);
  };

  const removeBlock = (blockId: string) => {
    setRows(prev =>
      prev.map(row => ({ ...row, blocks: row.blocks.filter(b => b.id !== blockId) }))
         .filter(row => row.blocks.length > 0)
    );
    if (selectedId === blockId) setSelectedId(null);
  };

  const removeRow = (rowId: string) => {
    setRows(prev => prev.filter(r => r.id !== rowId));
    setSelectedId(null);
  };

  const moveRow = (rowId: string, dir: number) => {
    setRows(prev => {
      const idx = prev.findIndex(r => r.id === rowId);
      const next = idx + dir;
      if (next < 0 || next >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[next]] = [copy[next], copy[idx]];
      return copy;
    });
  };

  const updateBlock = (blockId: string, data: Record<string, any>) => {
    setRows(prev => prev.map(row => ({
      ...row,
      blocks: row.blocks.map(b => b.id === blockId ? { ...b, data } : b)
    })));
  };

  const updateBlockSettings = (blockId: string, settings: Partial<Pick<Block, "bg" | "align" | "valign" | "padding" | "width" | "height" | "blockPos">>) => {
    setRows(prev => prev.map(row => ({
      ...row,
      blocks: row.blocks.map(b => b.id === blockId ? { ...b, ...settings } : b)
    })));
  };

  return {
    rows, setRows,
    selectedId, setSelectedId,
    picker, setPicker,
    addBlockToRow, addRowAfter, addRow,
    removeBlock, removeRow, moveRow,
    updateBlock, updateBlockSettings,
  };
}