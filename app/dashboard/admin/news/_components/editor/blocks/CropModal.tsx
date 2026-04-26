"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ReactCrop, { type Crop, type PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { cropImageToBlob } from "./cropImage";

const ff = "-apple-system, BlinkMacSystemFont, sans-serif";

interface Props {
  imageUrl: string;
  initialAspect?: number; // більше не використовується; залишено щоб не ламати call sites
  onCancel: () => void;
  onCropDone: (blob: Blob, aspect: number) => Promise<void> | void;
}

export default function CropModal({ imageUrl, onCancel, onCropDone }: Props) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [zoom, setZoom] = useState(1); // multiplier для displayed image width
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape" && !saving) onCancel(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel, saving]);

  // Ctrl+wheel = zoom усередині модалки. React onWheel створює passive listener — preventDefault
  // не працює. Тому навішую native addEventListener з { passive: false }.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return; // звичайний скрол — не чіпати
      e.preventDefault();
      const direction = e.deltaY > 0 ? -1 : 1;
      const step = 0.1;
      setZoom((z) => Math.max(0.25, Math.min(4, z + direction * step)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [mounted]);

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    setNaturalSize({ w: naturalWidth, h: naturalHeight });
    // Без default crop — користувач сам малює прямокутник перетягуванням мишки.
  };

  const handleSave = async () => {
    if (!completedCrop || !imgRef.current) return;
    setSaving(true);
    setError("");
    try {
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

  if (!mounted) return null;

  // Базова displayed-ширина — fit by container, потім multiplier через zoom.
  // Реалізую через CSS width на самому <img> (а не transform), щоб ReactCrop координати були в displayed px.
  const containerWidth = 1100; // приблизно скільки є в модалці після padding
  const baseDisplayedWidth = naturalSize ? Math.min(naturalSize.w, containerWidth) : containerWidth;
  const imgStyleWidth = baseDisplayedWidth * zoom;

  return createPortal((
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "#fff",
        display: "flex", flexDirection: "column",
        fontFamily: ff,
      }}
    >
        {/* Header */}
        <div style={{
          padding: "14px 20px",
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
            style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: "20px", padding: "4px 8px", fontWeight: 600 }}
          >✕</button>
        </div>

        {/* Crop area — scrollable. Ctrl+wheel = zoom (через native wheel listener у useEffect). */}
        <div ref={scrollRef} style={{
          flex: 1, overflow: "auto",
          background: "#1a1a1a",
          padding: "16px",
          display: "flex", justifyContent: "center", alignItems: "flex-start",
        }}>
          <ReactCrop
            crop={crop}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            onComplete={(c) => setCompletedCrop(c)}
            ruleOfThirds
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={imageUrl}
              alt="crop source"
              crossOrigin="anonymous"
              onLoad={onImageLoad}
              style={{
                display: "block",
                width: naturalSize ? `${imgStyleWidth}px` : "auto",
                maxWidth: "none",
                height: "auto",
              }}
            />
          </ReactCrop>
        </div>

        {/* Toolbar: zoom + aspect */}
        <div style={{
          padding: "12px 20px",
          borderTop: "1px solid #E8D5B7",
          display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "center",
          background: "#fff",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: "260px" }}>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "#9CA3AF", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Масштаб
            </span>
            <input
              type="range"
              min={0.25}
              max={4}
              step={0.05}
              value={zoom}
              onChange={(e) => {
                const newZoom = Number(e.target.value);
                setZoom(newZoom);
              }}
              style={{ flex: 1, accentColor: "#D4A843" }}
            />
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1C3A2E", minWidth: "44px", textAlign: "right" }}>
              {(zoom * 100).toFixed(0)}%
            </span>
            <button
              onClick={() => setZoom(1)}
              title="Скинути масштаб"
              style={{
                padding: "5px 10px", borderRadius: "6px", border: "1.5px solid #E8D5B7",
                background: "#fff", color: "#1C3A2E", fontSize: "11px", fontWeight: 600,
                cursor: "pointer", fontFamily: ff,
              }}
            >100%</button>
          </div>

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
                Натисни і протягни мишею щоб виділити область. Кути рамки — змінити розмір. Ctrl + колесо = масштаб. Esc = закрити.
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
  ), document.body);
}
