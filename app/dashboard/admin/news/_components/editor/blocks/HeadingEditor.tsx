"use client";

import { useState } from "react";
import { Block } from "../types";

const ff = "-apple-system, BlinkMacSystemFont, sans-serif";

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: "8px",
  borderWidth: "1.5px", borderStyle: "solid", borderColor: "#E8D5B7",
  background: "#FAF6F0", color: "#1C3A2E", fontFamily: ff,
  outline: "none", boxSizing: "border-box",
};

interface Props {
  block: Block;
  onChange: (data: Record<string, string>) => void;
}

export default function HeadingEditor({ block, onChange }: Props) {
  const level = block.data.level || "2";
  const [hov, setHov] = useState<string | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ display: "flex", gap: "4px" }}>
        {["1", "2", "3"].map(l => (
          <button
            key={l}
            onClick={() => onChange({ ...block.data, level: l })}
            onMouseEnter={() => setHov(l)}
            onMouseLeave={() => setHov(null)}
            style={{
              padding: "3px 10px", borderRadius: "5px", border: "none", cursor: "pointer",
              fontSize: "11px", fontWeight: 700, fontFamily: ff,
              background: level === l ? "#1C3A2E" : hov === l ? "#E8F5E0" : "#EEEAE2",
              color: level === l ? "#D4A843" : "#1C3A2E",
              transition: "all 0.12s",
            }}
          >{`H${l}`}</button>
        ))}
      </div>
      <input
        style={{ ...inputStyle, fontSize: level === "1" ? "22px" : level === "2" ? "18px" : "15px", fontWeight: 700 }}
        placeholder={`Заголовок ${level} рівня`}
        value={block.data.text || ""}
        onChange={e => onChange({ ...block.data, text: e.target.value })}
      />
    </div>
  );
}