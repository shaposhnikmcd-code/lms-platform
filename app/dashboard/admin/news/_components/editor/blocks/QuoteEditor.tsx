"use client";

import { Block } from "../types";

const ff = "-apple-system, BlinkMacSystemFont, sans-serif";

interface Props {
  block: Block;
  onChange: (data: Record<string, string>) => void;
}

export default function QuoteEditor({ block, onChange }: Props) {
  return (
    <div style={{ borderLeftWidth: "4px", borderLeftStyle: "solid", borderLeftColor: "#D4A843", borderRadius: "0 8px 8px 0", padding: "12px 16px", background: "#E8F5E0" }}>
      <textarea
        style={{ width: "100%", padding: "8px", background: "transparent", border: "none", resize: "vertical", minHeight: "80px", fontSize: "14px", color: "#1C3A2E", fontFamily: ff, outline: "none", boxSizing: "border-box", textAlign: block.align }}
        placeholder="Текст цитати..."
        value={block.data.text || ""}
        onChange={e => onChange({ ...block.data, text: e.target.value })}
      />
    </div>
  );
}