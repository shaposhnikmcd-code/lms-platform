"use client";

import { useRef, useState } from "react";
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { cropImageToBlob } from "./cropImage";

const ff = "-apple-system, BlinkMacSystemFont, sans-serif";

interface Props {
  imageUrl: string;
  /** Якщо передано — стартова рамка з цим співвідношенням; у режимі «Вільно» поведінка вільна. */
  initialAspect?: number;
  onCancel: () => void;
  onCropDone: (blob: Blob, aspect: number) => Promise<void> | void;
}

const ASPECTS: { label: string; value: number | undefined }[] = [
  { label: "Вільно", value: undefined },
  { label: "1:1",   value: 1 },
  { label: "4:3",   value: 4 / 3 },
  { label: "3:2",   value: 3 / 2 },
  { label: "16:9",  value: 16 / 9 },
  { label: "3:4",   value: 3 / 4 },
];

// Початкова центрована рамка ~80% від картинки.
function buildInitialCrop(imgW: number, imgH: number, aspect?: number): Crop {
  if (aspect) {
    return centerCrop(
      makeAspectCrop({ unit: "%", width: 80 }, aspect, imgW, imgH),
      imgW, imgH,
    );
  }
  return { unit: "%", x: 10, y: 10, width: 80, height: 80 };
}

export default function CropModal({ imageUrl, initialAspect, onCancel, onCropDone }: Props) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [aspect, setAspect] = useState<number | undefined>(initialAspect);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(buildInitialCrop(width, height, aspect));
  };

  const handleAspectChange = (newAspect: number | undefined) => {
    setAspect(newAspect);
    if (imgRef.current) {
      const { width, height } = imgRef.current;
      setCrop(buildInitialCrop(width, height, newAspect));
    }
  };

  const handleSave = async () => {
    if (!completedCrop || !imgRef.current) return;
    setSaving(true);
    setError("");
    try {
      // completedCrop у px ВІДНОСНО ВІДОБРАЖЕНОЇ картинки. Треба перевести в px
      // натуральних розмірів (скаляр scale = naturalWidth / displayWidth).
      const img = imgRef.current;
      const scaleX = img.naturalWidth / img.width;
      const scaleY = img.naturalHeight / img.height;
      const naturalCrop = {
        x: completedCrop.x * scaleX,
        y: completedCrop.y * scaleY,
        width: completedCrop.width * scaleX,
        height: completedCrop.height * scaleY,
      };
      const blob = await cropImageToBlob(imageUrl, naturalCrop);
      const newAspect = naturalCrop.width / naturalCrop.height;
      await onCropDone(blob, newAspect);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  return (
    <div
      onMouseDown={e => { if (e.target === e.currentTarget) onCancel(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(28,58,46,0.55)",
        backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px",
        fontFamily: ff,
      }}
    >
      <div style={{
        background: "#fff", borderRadius: "16px",
        width: "min(900px, 100%)", maxHeight: "90vh",
        display: "flex", flexDirection: "column",
        boxShadow: "0 24px 64px rgba(0,0,0,0.3)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px",
          borderBottom: "1px solid #E8D5B7",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "#FAF6F0",
        }}>
          <div style={{ fontSize: "15px", fontWeight: 700, color: "#1C3A2E", letterSpacing: "0.04em" }}>
            ✂️ Обрізати зображення
          </div>
          <button
            onClick={onCancel}
            disabled={saving}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: "18px", padding: "4px 8px", fontWeight: 600 }}
          >✕</button>
        </div>

        {/* Crop area */}
        <div style={{
          flex: 1, minHeight: "300px", maxHeight: "65vh",
          overflow: "auto", padding: "20px",
          background: "#1a1a1a",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <ReactCrop
            crop={crop}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={aspect}
            keepSelection
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={imageUrl}
              alt="crop source"
              crossOrigin="anonymous"
              onLoad={onImageLoad}
              style={{ maxWidth: "100%", maxHeight: "60vh", display: "block" }}
            />
          </ReactCrop>
        </div>

        {/* Aspect presets */}
        <div style={{
          padding: "12px 20px",
          borderTop: "1px solid #E8D5B7",
          display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center",
        }}>
          <span style={{ fontSize: "11px", fontWeight: 600, color: "#9CA3AF", letterSpacing: "0.08em", textTransform: "uppercase", marginRight: "4px" }}>
            Пропорції:
          </span>
          {ASPECTS.map(a => {
            const active = aspect === a.value;
            return (
              <button
                key={a.label}
                onClick={() => handleAspectChange(a.value)}
                style={{
                  padding: "5px 12px", borderRadius: "6px",
                  border: `1.5px solid ${active ? "#D4A843" : "#E8D5B7"}`,
                  background: active ? "#1C3A2E" : "#fff",
                  color: active ? "#D4A843" : "#1C3A2E",
                  fontSize: "12px", fontWeight: 600, cursor: "pointer",
                  fontFamily: ff,
                  transition: "all 0.12s",
                }}
              >
                {a.label}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{
          padding: "14px 20px",
          borderTop: "1px solid #E8D5B7",
          background: "#FAF6F0",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
        }}>
          {error
            ? <div style={{ fontSize: "12px", color: "#EF4444", fontWeight: 500 }}>{error}</div>
            : <div style={{ fontSize: "11px", color: "#9CA3AF" }}>
                Тягни кути або краї рамки, щоб змінити обріз
              </div>}
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={onCancel}
              disabled={saving}
              style={{
                padding: "9px 18px", borderRadius: "8px", border: "1.5px solid #E8D5B7",
                background: "#fff", color: "#1C3A2E", fontSize: "13px", fontWeight: 600,
                cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.5 : 1,
                fontFamily: ff,
              }}
            >Скасувати</button>
            <button
              onClick={handleSave}
              disabled={saving || !completedCrop}
              style={{
                padding: "9px 22px", borderRadius: "8px", border: "none",
                background: "#1C3A2E", color: "#D4A843",
                fontSize: "13px", fontWeight: 700,
                cursor: saving || !completedCrop ? "not-allowed" : "pointer",
                opacity: saving || !completedCrop ? 0.6 : 1,
                fontFamily: ff,
                boxShadow: "0 2px 8px rgba(28,58,46,0.2)",
              }}
            >{saving ? "Зберігаю…" : "Зберегти"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
