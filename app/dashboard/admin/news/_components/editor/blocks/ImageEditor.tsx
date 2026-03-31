"use client";

import { useRef, useState } from "react";
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
  onUpload: (file: File) => Promise<string>;
}

export default function ImageEditor({ block, onChange, onUpload }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const url = await onUpload(file);
    setUploading(false);
    if (url) onChange({ ...block.data, url });
    e.target.value = "";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {block.data.url ? (
        <div style={{ position: "relative" }}>
          <img src={block.data.url} alt={block.data.alt || ""} style={{ width: "100%", borderRadius: "8px", maxHeight: "280px", objectFit: "cover" }} />
          <button
            onClick={() => onChange({ ...block.data, url: "" })}
            style={{ position: "absolute", top: "8px", right: "8px", background: "#EF4444", color: "#fff", border: "none", borderRadius: "6px", padding: "4px 10px", cursor: "pointer", fontSize: "12px", fontWeight: 600 }}
          >{"✕"}</button>
        </div>
      ) : (
        <div
          onClick={() => ref.current?.click()}
          style={{ borderWidth: "2px", borderStyle: "dashed", borderColor: "#D4A843", borderRadius: "10px", padding: "32px", textAlign: "center", cursor: "pointer", background: "#FAF6F0", color: "#9CA3AF", fontSize: "13px", fontFamily: ff }}
        >{uploading ? "Завантаження..." : "🖼  Натисніть щоб завантажити фото"}</div>
      )}
      <input ref={ref} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
      <input style={inputStyle} placeholder="Alt текст" value={block.data.alt || ""} onChange={e => onChange({ ...block.data, alt: e.target.value })} />
    </div>
  );
}