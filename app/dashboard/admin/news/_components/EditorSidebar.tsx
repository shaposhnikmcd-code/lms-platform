"use client";

import { Block, BlockType } from "./types";
import { BLOCK_LABELS, BLOCK_ICONS } from "./constants";
import BlockEditor from "./BlockEditor";
import BlockSettings from "./BlockSettings";

interface Props {
  selectedBlock: Block | null;
  onUpdateBlock: (blockId: string, data: Record<string, any>) => void;
  onUpdateBlockSettings: (blockId: string, settings: Partial<Pick<Block, "bg" | "align" | "valign" | "padding" | "width" | "height" | "blockPos">>) => void;
  onUpload: (file: File) => Promise<string>;
  onAddRow: (type: BlockType) => void;
}

const BLOCK_TYPES: BlockType[] = [
  "hero", "heading", "text", "image", "gallery", "video", "quote", "divider", "list", "cta"
];

export default function EditorSidebar({
  selectedBlock, onUpdateBlock, onUpdateBlockSettings, onUpload, onAddRow,
}: Props) {
  if (selectedBlock) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-4">
          {BLOCK_LABELS[selectedBlock.type]}
        </div>
        <BlockEditor
          block={selectedBlock}
          onChange={data => onUpdateBlock(selectedBlock.id, data)}
          onUpload={onUpload}
        />
        <div className="mt-4 pt-4 border-t border-gray-100">
          <BlockSettings
            block={selectedBlock}
            onUpdate={settings => onUpdateBlockSettings(selectedBlock.id, settings)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">{"Додати рядок"}</div>
      <div className="py-1">
        {BLOCK_TYPES.map(type => (
          <button
            key={type}
            onClick={() => onAddRow(type)}
            className="w-full flex items-center gap-3 py-2 hover:bg-[#1C3A2E]/5 hover:text-[#1C3A2E] text-gray-600 transition-all group rounded-lg px-2"
          >
            <div className="w-7 h-7 flex items-center justify-center rounded-md bg-gray-100 group-hover:bg-[#1C3A2E]/10 transition-colors flex-shrink-0 text-sm">
              {BLOCK_ICONS[type]}
            </div>
            <span className="text-sm font-medium">{BLOCK_LABELS[type]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}