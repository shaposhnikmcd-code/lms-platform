"use client";

import { BlockType } from "./types";
import { BLOCK_TYPES, BLOCK_ICONS, BLOCK_LABELS } from "./constants";

interface Props {
  onSelect: (type: BlockType) => void;
  onClose: () => void;
  fullWidth?: boolean;
}

export default function BlockPicker({ onSelect, onClose, fullWidth = false }: Props) {
  return (
    <div
      className="bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden"
      style={fullWidth ? {} : { width: "200px" }}
    >
      <div className="py-1">
        {BLOCK_TYPES.map(type => (
          <button
            key={type}
            onClick={() => onSelect(type)}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-[#1C3A2E]/5 hover:text-[#1C3A2E] text-gray-600 transition-all group"
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