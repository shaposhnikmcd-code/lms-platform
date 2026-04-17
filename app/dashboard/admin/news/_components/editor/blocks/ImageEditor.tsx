"use client";

import { useEffect, useRef, useState } from "react";
import { Block } from "../types";
import CropModal from "./CropModal";

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
  previewHeight?: number;
}

export default function ImageEditor({ block, onChange, onUpload, previewHeight }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);

  // Підтягнути aspectRatio для старих фото, де поле ще не збережене
  useEffect(() => {
    if (!block.data.url) return;
    if (block.data.aspectRatio) return;
    const img = new window.Image();
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) {
        onChange({
          ...block.data,
          aspectRatio: String(img.naturalWidth / img.naturalHeight),
        });
      }
    };
    img.src = block.data.url;
  }, [block.data.url]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const url = await onUpload(file);
    setUploading(false);
    if (url) {
      // Дізнаємося природні пропорції фото, щоб resize міг їх дотримуватися
      const img = new window.Image();
      img.onload = () => {
        onChange({
          ...block.data,
          url,
          aspectRatio: String(img.naturalWidth / img.naturalHeight),
        });
      };
      img.onerror = () => onChange({ ...block.data, url });
      img.src = url;
    }
    e.target.value = "";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {block.data.url ? (
        <div style={{ position: "relative" }}>
          {(() => {
            const effectiveH = previewHeight ?? (block.data.minHeight ? Number(block.data.minHeight) : 0);
            return (
              <img
                src={block.data.url}
                alt={block.data.alt || ""}
                style={{
                  width: "100%",
                  height: effectiveH > 0 ? `${effectiveH}px` : "auto",
                  objectFit: effectiveH > 0 ? "fill" : "contain",
                  borderRadius: "8px",
                  display: "block",
                }}
              />
            );
          })()}
          <div style={{ position: "absolute", top: "8px", right: "8px", display: "flex", gap: "6px" }}>
            <button
              onClick={() => setCropOpen(true)}
              title="Обрізати"
              style={{ background: "rgba(28,58,46,0.85)", color: "#D4A843", border: "none", borderRadius: "6px", padding: "4px 10px", cursor: "pointer", fontSize: "12px", fontWeight: 600, backdropFilter: "blur(4px)" }}
            >{"✂️ Обрізати"}</button>
            <button
              onClick={() => onChange({ ...block.data, url: "" })}
              title="Видалити фото"
              style={{ background: "#EF4444", color: "#fff", border: "none", borderRadius: "6px", padding: "4px 10px", cursor: "pointer", fontSize: "12px", fontWeight: 600 }}
            >{"✕"}</button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => ref.current?.click()}
          style={{ borderWidth: "2px", borderStyle: "dashed", borderColor: "#D4A843", borderRadius: "10px", padding: "32px", textAlign: "center", cursor: "pointer", background: "#FAF6F0", color: "#9CA3AF", fontSize: "13px", fontFamily: ff }}
        >{uploading ? "Завантаження..." : "🖼  Натисніть щоб завантажити фото"}</div>
      )}
      <input ref={ref} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
      <input style={inputStyle} placeholder="Alt текст" value={block.data.alt || ""} onChange={e => onChange({ ...block.data, alt: e.target.value })} />
      {cropOpen && block.data.url && (
        <CropModal
          imageUrl={block.data.url}
          initialAspect={Number(block.data.aspectRatio) || undefined}
          onCancel={() => setCropOpen(false)}
          onCropDone={async (blob, newAspect) => {
            // Заливаємо обрізаний blob як новий файл — отримуємо нову URL з Cloudinary.
            const file = new File([blob], "cropped.jpg", { type: blob.type });
            const url = await onUpload(file);
            if (url) {
              // Скидаємо minHeight, бо нові пропорції; aspectRatio оновлюємо новим.
              const next: Record<string, string> = {
                ...block.data,
                url,
                aspectRatio: String(newAspect),
              };
              delete next.minHeight;
              onChange(next);
            }
            setCropOpen(false);
          }}
        />
      )}
    </div>
  );
}