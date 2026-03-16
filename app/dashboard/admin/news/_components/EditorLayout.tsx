"use client";

import Link from "next/link";
import { Row, Block, BlockType } from "./types";
import { PickerState } from "./EditorCanvas";
import EditorCanvas from "./EditorCanvas";
import EditorSidebar from "./EditorSidebar";
import MetaPanel from "./MetaPanel";
import PublishPanel from "./PublishPanel";

interface Meta {
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  published?: boolean;
}

interface Props {
  title: string;
  meta: Meta;
  rows: Row[];
  selectedId: string | null;
  picker: PickerState;
  saving: boolean;
  uploading: boolean;
  message: string;
  isEdit?: boolean;
  onMetaChange: (meta: Meta) => void;
  onSelectBlock: (id: string | null) => void;
  onSetPicker: (p: PickerState) => void;
  onRemoveBlock: (id: string) => void;
  onRemoveRow: (id: string) => void;
  onMoveRow: (id: string, dir: number) => void;
  onAddBlockToRow: (rowId: string, afterBlockId: string, type: BlockType) => void;
  onAddRowAfter: (afterRowId: string, type: BlockType) => void;
  onResizeBlock: (blockId: string, w: number, h?: number) => void;
  onUpdateBlock: (blockId: string, data: Record<string, any>) => void;
  onUpdateBlockSettings: (blockId: string, settings: Partial<Pick<Block, "bg" | "align" | "padding" | "width" | "height" | "blockPos">>) => void;
  onUpload: (file: File) => Promise<string>;
  onAddRow: (type: BlockType) => void;
  onSave: (published: boolean) => void;
}

export default function EditorLayout({
  title, meta, rows, selectedId, picker,
  saving, uploading, message, isEdit = false,
  onMetaChange, onSelectBlock, onSetPicker,
  onRemoveBlock, onRemoveRow, onMoveRow,
  onAddBlockToRow, onAddRowAfter, onResizeBlock,
  onUpdateBlock, onUpdateBlockSettings, onUpload, onAddRow, onSave,
}: Props) {
  const selectedBlock = rows.flatMap(r => r.blocks).find(b => b.id === selectedId) ?? null;

  return (
    <div
      className="flex flex-col"
      style={{ height: "100vh", overflow: "hidden" }}
      onClick={() => onSetPicker(null)}
    >
      {/* Фіксований header */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-100 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/admin/news"
            className="text-sm text-gray-400 hover:text-[#1C3A2E] transition-colors"
          >
            {"← Назад"}
          </Link>
          <h1 className="text-base font-semibold text-[#1C3A2E]">{title}</h1>
          {uploading && <span className="text-xs text-gray-400 animate-pulse">Завантаження...</span>}
        </div>
        <div className="flex items-center gap-2">
          {message && (
            <span className="text-xs text-red-500">{message}</span>
          )}
          <button
            onClick={() => onSave(false)}
            disabled={saving}
            className="px-4 py-1.5 border border-gray-200 text-gray-500 text-sm rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Чернетка
          </button>
          <button
            onClick={() => onSave(isEdit ? (meta.published ?? false) : true)}
            disabled={saving}
            className="px-4 py-1.5 bg-[#1C3A2E] text-white text-sm rounded-lg hover:bg-[#1C3A2E]/80 transition-colors disabled:opacity-50"
          >
            {saving ? "Збереження..." : isEdit ? "Зберегти" : "Опублікувати"}
          </button>
        </div>
      </div>

      {/* Три колонки */}
      <div className="flex flex-1 overflow-hidden">

        {/* Ліва панель — мета */}
        <div
          className="bg-white border-r border-gray-100 flex flex-col overflow-y-auto flex-shrink-0"
          style={{ width: "260px" }}
          onClick={e => e.stopPropagation()}
        >
          <div className="p-4 flex-1">
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
              {"Мета-дані"}
            </div>
            <MetaPanel meta={meta} onChange={onMetaChange} />

            {isEdit && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="published"
                    checked={meta.published ?? false}
                    onChange={e => onMetaChange({ ...meta, published: e.target.checked })}
                    className="w-4 h-4 accent-[#1C3A2E]"
                  />
                  <label htmlFor="published" className="text-sm text-gray-600">Опубліковано</label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Центр — конструктор */}
        <div
          className="flex-1 overflow-y-auto bg-gray-50"
          style={{ padding: "24px" }}
        >
          <EditorCanvas
            rows={rows}
            selectedId={selectedId}
            picker={picker}
            onSelectBlock={onSelectBlock}
            onSetPicker={onSetPicker}
            onRemoveBlock={onRemoveBlock}
            onRemoveRow={onRemoveRow}
            onMoveRow={onMoveRow}
            onAddBlockToRow={onAddBlockToRow}
            onAddRowAfter={onAddRowAfter}
            onResizeBlock={onResizeBlock}
          />
        </div>

        {/* Права панель — інструменти */}
        <div
          className="bg-white border-l border-gray-100 overflow-y-auto flex-shrink-0"
          style={{ width: "280px" }}
          onClick={e => e.stopPropagation()}
        >
          <div className="p-4">
            <EditorSidebar
              selectedBlock={selectedBlock}
              onUpdateBlock={onUpdateBlock}
              onUpdateBlockSettings={onUpdateBlockSettings}
              onUpload={onUpload}
              onAddRow={onAddRow}
            />
          </div>
        </div>
      </div>
    </div>
  );
}