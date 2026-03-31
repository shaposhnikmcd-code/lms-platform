"use client";

import { Block } from "../types";

const ff = "-apple-system, BlinkMacSystemFont, sans-serif";

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: "8px",
  borderWidth: "1.5px", borderStyle: "solid", borderColor: "#E8D5B7",
  background: "#FAF6F0", fontSize: "14px", color: "#1C3A2E",
  fontFamily: ff, outline: "none", boxSizing: "border-box",
};

interface Props {
  block: Block;
  onChange: (data: Record<string, string>) => void;
}

export default function YoutubeEditor({ block, onChange }: Props) {
  const getEmbed = (url: string) => {
    const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([a-zA-Z0-9_-]{11})/);
    return m ? `https://www.youtube.com/embed/${m[1]}` : "";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <input
        style={inputStyle}
        placeholder="https://youtube.com/watch?v=..."
        value={block.data.url || ""}
        onChange={e => onChange({ ...block.data, url: e.target.value })}
      />
      {block.data.url && getEmbed(block.data.url) && (
        <iframe src={getEmbed(block.data.url)} style={{ width: "100%", height: "260px", borderRadius: "8px", border: "none" }} allowFullScreen />
      )}
    </div>
  );
}