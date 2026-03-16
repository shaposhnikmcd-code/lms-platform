"use client";

import { Block, BgColor, Align, BlockPos } from "./types";
import { VAlign } from "./types";
import { BG_DOT } from "./constants";

interface Props {
  block: Block;
  onUpdate: (settings: Partial<Pick<Block, "bg" | "align" | "valign" | "padding" | "width" | "height" | "blockPos">>) => void;
}

export default function BlockSettings({ block, onUpdate }: Props) {
  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-gray-500">{"Ширина"}</span>
          <span className="text-sm font-bold text-[#1C3A2E]">{block.width}%</span>
        </div>
        <input
          type="range" min={10} max={100} step={5}
          value={block.width}
          onChange={e => onUpdate({ width: Number(e.target.value) })}
          className="w-full accent-[#1C3A2E]"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-0.5">
          <span>10%</span><span>50%</span><span>100%</span>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-gray-500">{"Висота"}</span>
          <span className="text-sm font-bold text-[#1C3A2E]">
            {block.height ? block.height + "px" : "авто"}
          </span>
        </div>
        <input
          type="range" min={0} max={800} step={10}
          value={block.height || 0}
          onChange={e => onUpdate({ height: Number(e.target.value) || undefined })}
          className="w-full accent-[#1C3A2E]"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-0.5">
          <span>{"авто"}</span><span>400px</span><span>800px</span>
        </div>
        {block.height && (
          <button
            onClick={() => onUpdate({ height: undefined })}
            className="text-xs text-gray-400 hover:text-red-500 mt-1"
          >
            {"скинути висоту"}
          </button>
        )}
      </div>

      <div>
        <div className="text-xs font-medium text-gray-500 mb-2">{"Фон блоку"}</div>
        <div className="flex gap-2">
          {(Object.entries(BG_DOT) as [BgColor, string][]).map(([key, color]) => (
            <button
              key={key}
              onClick={() => onUpdate({ bg: key })}
              style={{ background: color }}
              className={"w-6 h-6 rounded-full border-2 transition-all " + (block.bg === key ? "border-[#1C3A2E] scale-110" : "border-gray-300")}
            />
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs font-medium text-gray-500 mb-2">{"Текст по горизонталі"}</div>
        <div className="flex gap-1">
          {(["left", "center", "right"] as Align[]).map(a => (
            <button
              key={a}
              onClick={() => onUpdate({ align: a })}
              className={"flex-1 py-1 text-xs rounded border transition-all " + (block.align === a ? "border-[#1C3A2E] bg-[#1C3A2E] text-white" : "border-gray-200 text-gray-500 hover:border-[#1C3A2E]")}
            >
              {a === "left" ? "Ліво" : a === "center" ? "Центр" : "Право"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs font-medium text-gray-500 mb-2">{"Текст по вертикалі"}</div>
        <div className="flex gap-1">
          {(["top", "middle", "bottom"] as VAlign[]).map(v => (
            <button
              key={v}
              onClick={() => onUpdate({ valign: v })}
              className={"flex-1 py-1 text-xs rounded border transition-all " + ((block.valign ?? "top") === v ? "border-[#1C3A2E] bg-[#1C3A2E] text-white" : "border-gray-200 text-gray-500 hover:border-[#1C3A2E]")}
            >
              {v === "top" ? "Верх" : v === "middle" ? "Центр" : "Низ"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs font-medium text-gray-500 mb-2">{"Позиція блоку"}</div>
        <div className="flex gap-1">
          {(["left", "center", "right"] as BlockPos[]).map(p => (
            <button
              key={p}
              onClick={() => onUpdate({ blockPos: p })}
              className={"flex-1 py-1 text-xs rounded border transition-all " + (block.blockPos === p ? "border-[#1C3A2E] bg-[#1C3A2E] text-white" : "border-gray-200 text-gray-500 hover:border-[#1C3A2E]")}
            >
              {p === "left" ? "Ліво" : p === "center" ? "Центр" : "Право"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}