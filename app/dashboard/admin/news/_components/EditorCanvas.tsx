"use client";

import { Row, Block, BlockType } from "./types";
import { BLOCK_LABELS, getBlockPosStyle } from "./constants";
import BlockRenderer from "@/components/news/BlockRenderer";
import BlockPicker from "./BlockPicker";
import ResizeHandles from "./ResizeHandles";

export type PickerState =
  | { kind: "inRow"; rowId: string; afterBlockId: string }
  | { kind: "newRow"; afterRowId: string }
  | null;

interface Props {
  rows: Row[];
  selectedId: string | null;
  picker: PickerState;
  onSelectBlock: (id: string | null) => void;
  onSetPicker: (p: PickerState) => void;
  onRemoveBlock: (id: string) => void;
  onRemoveRow: (id: string) => void;
  onMoveRow: (id: string, dir: number) => void;
  onAddBlockToRow: (rowId: string, afterBlockId: string, type: BlockType) => void;
  onAddRowAfter: (afterRowId: string, type: BlockType) => void;
  onResizeBlock: (blockId: string, w: number, h?: number) => void;
}

export default function EditorCanvas({
  rows, selectedId, picker,
  onSelectBlock, onSetPicker,
  onRemoveBlock, onRemoveRow, onMoveRow,
  onAddBlockToRow, onAddRowAfter, onResizeBlock,
}: Props) {
  const totalUsed = (row: Row) => row.blocks.reduce((s, b) => s + b.width, 0);

  return (
    <div>
      {rows.map((row) => (
        <div key={row.id}>
          <div
            className="relative border-2 border-dashed border-gray-200 rounded-xl p-3 hover:border-gray-300 transition-colors group/row"
            onClick={e => e.stopPropagation()}
          >
            <div className="absolute -top-3 right-2 flex gap-1 z-10 opacity-0 group-hover/row:opacity-100 transition-opacity">
              <button onClick={() => onMoveRow(row.id, -1)} className="bg-white border border-gray-200 rounded px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-50">up</button>
              <button onClick={() => onMoveRow(row.id, 1)} className="bg-white border border-gray-200 rounded px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-50">dn</button>
              <button onClick={() => onRemoveRow(row.id)} className="bg-white border border-red-200 rounded px-1.5 py-0.5 text-xs text-red-400 hover:bg-red-50">x</button>
            </div>

            <div className="flex gap-2 flex-wrap items-stretch pt-2 resize-row">
              {row.blocks.map((block) => {
                const isSelected = selectedId === block.id;
                const isPickerOpen = picker !== null && picker.kind === "inRow" && picker.afterBlockId === block.id;

                return (
                  <div
                    key={block.id}
                    className="relative group/block"
                    style={getBlockPosStyle(block)}
                  >
                    <div
                      onClick={() => {
                        if (isSelected) {
                          onSelectBlock(null);
                        } else {
                          onSelectBlock(block.id);
                          onSetPicker(null);
                        }
                      }}
                      style={{
                        position: "relative",
                        borderRadius: "12px",
                        border: isSelected ? "2px solid #1C3A2E" : "2px solid transparent",
                        boxShadow: isSelected ? "0 4px 12px rgba(0,0,0,0.1)" : "none",
                        cursor: "pointer",
                        height: "100%",
                      }}
                      className="hover:border-gray-300 transition-all"
                    >
                      <div style={{ position: "absolute", top: "4px", left: "8px", fontSize: "10px", color: "rgba(255,255,255,0.7)", fontWeight: 500, zIndex: 10, whiteSpace: "nowrap", textShadow: "0 1px 2px rgba(0,0,0,0.5)", pointerEvents: "none" }}>
                        {BLOCK_LABELS[block.type]} {block.width}%{block.height ? " · " + block.height + "px" : ""}
                      </div>
                      <div style={{ position: "absolute", top: "4px", right: "4px", zIndex: 10 }} className={isSelected ? "opacity-100" : "opacity-0 group-hover/block:opacity-100"}>
                        <button
                          onClick={e => { e.stopPropagation(); onRemoveBlock(block.id); }}
                          className="bg-white border border-red-200 text-red-400 rounded px-1.5 py-0.5 text-xs hover:bg-red-50"
                        >x</button>
                      </div>
                      <div style={{ pointerEvents: "none", userSelect: "none", borderRadius: "12px", overflow: "hidden", height: "100%" }}>
                        <BlockRenderer block={block} editorMode={true} />
                      </div>
                    </div>

                    <ResizeHandles
                      block={block}
                      isSelected={isSelected}
                      onResize={(w, h) => onResizeBlock(block.id, w, h)}
                    />

                    <button
                      onClick={e => {
                        e.stopPropagation();
                        onSetPicker(isPickerOpen ? null : { kind: "inRow", rowId: row.id, afterBlockId: block.id });
                      }}
                      className={
                        "absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-[#1C3A2E] text-white rounded-full text-xs flex items-center justify-center z-20 shadow-md transition-opacity " +
                        (isPickerOpen || !isSelected ? "opacity-0 group-hover/block:opacity-100" : "opacity-100")
                      }
                    >+</button>

                    {isPickerOpen && (
                      <div
                        className="absolute z-30"
                        style={{ bottom: "0", left: "calc(100% + 12px)" }}
                        onClick={e => e.stopPropagation()}
                      >
                        <BlockPicker
                          onSelect={type => onAddBlockToRow(row.id, block.id, type)}
                          onClose={() => onSetPicker(null)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#1C3A2E]/40 rounded-full" style={{ width: Math.min(totalUsed(row), 100) + "%" }} />
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap">{totalUsed(row)}% зайнято</span>
            </div>
          </div>

          <div className="flex items-center gap-3 my-2" onClick={e => e.stopPropagation()}>
            <div className="flex-1 h-px bg-gray-200" />
            <button
              onClick={e => {
                e.stopPropagation();
                const isOpen = picker !== null && picker.kind === "newRow" && picker.afterRowId === row.id;
                onSetPicker(isOpen ? null : { kind: "newRow", afterRowId: row.id });
              }}
              className={
                "text-xs px-3 py-1 rounded-full border transition-all " +
                (picker !== null && picker.kind === "newRow" && picker.afterRowId === row.id
                  ? "border-[#1C3A2E] text-[#1C3A2E] bg-[#1C3A2E]/5"
                  : "border-gray-200 text-gray-400 hover:border-[#1C3A2E] hover:text-[#1C3A2E]")
              }
            >+ новий рядок</button>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {picker !== null && picker.kind === "newRow" && picker.afterRowId === row.id && (
            <div className="flex justify-center mb-2" onClick={e => e.stopPropagation()}>
              <BlockPicker
                onSelect={type => onAddRowAfter(row.id, type)}
                onClose={() => onSetPicker(null)}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}