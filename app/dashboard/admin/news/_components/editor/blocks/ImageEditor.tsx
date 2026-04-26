"use client";

import { useEffect, useRef, useState } from "react";
import { Block, UIMP_COLORS } from "../types";
import CropModal from "./CropModal";

const ff = "-apple-system, BlinkMacSystemFont, sans-serif";

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: "8px",
  borderWidth: "1.5px", borderStyle: "solid", borderColor: "#E8D5B7",
  background: "#FAF6F0", fontSize: "14px", color: "#1C3A2E",
  fontFamily: ff, outline: "none", boxSizing: "border-box",
};

// Fallback коли `fetch(url)` блокується CORS: завантажуємо через <img crossorigin>,
// малюємо на canvas і повертаємо dataURL.
async function urlToDataUrl(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas not supported")); return; }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error("Не вдалось завантажити фото через <img crossorigin>. CORS налаштування CDN блокує доступ."));
    img.src = src;
  });
}

interface Props {
  block: Block;
  onChange: (data: Record<string, string>) => void;
  onUpload: (file: File) => Promise<string>;
  previewHeight?: number;
}

// Overlay = текст поверх фото. x/y у відсотках (0..100) щоб резистити resize.
// w/h — розмір контейнера у відсотках. Якщо undefined — auto-size за вмістом.
export interface ImageOverlay {
  id: string;
  text: string;
  x: number;        // % від ширини фото (left edge напису)
  y: number;        // % від висоти фото (top edge напису)
  w?: number;       // % ширини контейнера (undefined = auto)
  h?: number;       // % висоти контейнера (undefined = auto)
  fontSize: number; // px
  color: string;    // hex (колір тексту)
  bgColor?: string; // hex (підкладка під текст); "" або undefined → без фону
  weight: number;   // 400 | 700
  radius?: number;  // border-radius у px (0..50). 999 = pill (повний округлий)
  shadow?: boolean; // box-shadow під підкладкою (виразніше виглядає на фото)
  fontFamily?: string;   // CSS font-family (default: системний sans)
  italic?: boolean;
  underline?: boolean;
  align?: "left" | "center" | "right";
  letterSpacing?: number; // px
  lineHeight?: number;    // unitless, default 1.2
  href?: string;          // якщо заданий — overlay стає клікабельним посиланням
}

export const OVERLAY_FONTS: { label: string; value: string }[] = [
  { label: "Системний",      value: "" },
  { label: "Inter",          value: "Inter, system-ui, sans-serif" },
  { label: "Bebas Neue",     value: '"BebasNeue", Impact, sans-serif' },
  { label: "Bowlby One",     value: '"BowlbyOne", Impact, sans-serif' },
  { label: "Cinzel",         value: '"Cinzel", Georgia, serif' },
  { label: "Cormorant",      value: '"CormorantGaramond", Georgia, serif' },
  { label: "Russo One",      value: '"RussoOne", Impact, sans-serif' },
];

const FONT_SIZE_PRESETS = [12, 14, 16, 18, 24, 32, 40, 48, 64, 80, 96, 120];

type ResizeMode = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

const RADIUS_PRESETS: { label: string; value: number }[] = [
  { label: "▢", value: 0 },     // прямі
  { label: "▢", value: 6 },     // легкі
  { label: "▢", value: 14 },    // м'які
  { label: "▢", value: 24 },    // дуже округлі
  { label: "⬭", value: 999 },   // pill
];

function parseOverlays(raw: string | undefined): ImageOverlay[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((o): o is ImageOverlay =>
      o && typeof o.id === "string" && typeof o.text === "string"
    );
  } catch { return []; }
}
function serializeOverlays(arr: ImageOverlay[]): string {
  return JSON.stringify(arr);
}

export default function ImageEditor({ block, onChange, onUpload, previewHeight }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [bgRemoving, setBgRemoving] = useState(false);
  const [bgError, setBgError] = useState<string>("");
  const [cropOpen, setCropOpen] = useState(false);
  const [emptyMode, setEmptyMode] = useState<"file" | "url">("file");
  const [urlInput, setUrlInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const [editingOverlayId, setEditingOverlayId] = useState<string | null>(null);
  const [showAlt, setShowAlt] = useState(false);
  const imgWrapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const resizeRef = useRef<{
    id: string; mode: ResizeMode;
    initX: number; initY: number; initW: number; initH: number;
    initCursorX: number; initCursorY: number;
  } | null>(null);

  const overlays = parseOverlays(block.data.overlays);

  const updateOverlays = (next: ImageOverlay[]) => {
    onChange({ ...block.data, overlays: serializeOverlays(next) });
  };

  const addOverlay = () => {
    const id = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `ov_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const newOv: ImageOverlay = {
      id,
      text: "",
      x: 0, y: 44, w: 100, h: 12,
      fontSize: 32, color: "#FFFFFF", weight: 700,
      bgColor: "#1C3A2E",
    };
    updateOverlays([...overlays, newOv]);
    setSelectedOverlayId(id);
    setEditingOverlayId(id);
  };

  const updateOverlay = (id: string, patch: Partial<ImageOverlay>) => {
    updateOverlays(overlays.map(o => o.id === id ? { ...o, ...patch } : o));
  };

  const removeOverlay = (id: string) => {
    updateOverlays(overlays.filter(o => o.id !== id));
    if (selectedOverlayId === id) setSelectedOverlayId(null);
    if (editingOverlayId === id) setEditingOverlayId(null);
  };

  const handleOverlayPointerDown = (e: React.PointerEvent, id: string) => {
    if (editingOverlayId === id) return; // якщо в режимі редагування — не drag
    e.stopPropagation();
    e.preventDefault();
    setSelectedOverlayId(id);
    const wrap = imgWrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const ov = overlays.find(o => o.id === id);
    if (!ov) return;
    // Поточна абсолютна позиція напису (px) і offset курсора всередині напису
    const ovLeftPx = (ov.x / 100) * rect.width;
    const ovTopPx = (ov.y / 100) * rect.height;
    dragRef.current = { id, offsetX: e.clientX - rect.left - ovLeftPx, offsetY: e.clientY - rect.top - ovTopPx };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleOverlayPointerMove = (e: React.PointerEvent) => {
    const resize = resizeRef.current;
    if (resize) {
      const wrap = imgWrapRef.current;
      if (!wrap) return;
      const wrapRect = wrap.getBoundingClientRect();
      const dxPct = ((e.clientX - resize.initCursorX) / wrapRect.width) * 100;
      const dyPct = ((e.clientY - resize.initCursorY) / wrapRect.height) * 100;
      let newW = resize.initW;
      let newH = resize.initH;
      let newX = resize.initX;
      let newY = resize.initY;
      const MIN = 2;
      if (resize.mode.includes("e")) newW = Math.max(MIN, resize.initW + dxPct);
      if (resize.mode.includes("w")) {
        newW = Math.max(MIN, resize.initW - dxPct);
        newX = resize.initX + (resize.initW - newW);
      }
      if (resize.mode.includes("s")) newH = Math.max(MIN, resize.initH + dyPct);
      if (resize.mode.includes("n")) {
        newH = Math.max(MIN, resize.initH - dyPct);
        newY = resize.initY + (resize.initH - newH);
      }
      // Clamp щоб не вилазити за межі фото
      newX = Math.max(0, Math.min(100 - newW, newX));
      newY = Math.max(0, Math.min(100 - newH, newY));
      updateOverlay(resize.id, { w: newW, h: newH, x: newX, y: newY });
      return;
    }
    const drag = dragRef.current;
    if (!drag) return;
    const wrap = imgWrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const xPx = e.clientX - rect.left - drag.offsetX;
    const yPx = e.clientY - rect.top - drag.offsetY;
    const x = Math.max(0, Math.min(100, (xPx / rect.width) * 100));
    const y = Math.max(0, Math.min(100, (yPx / rect.height) * 100));
    updateOverlay(drag.id, { x, y });
  };

  const handleOverlayPointerUp = () => {
    dragRef.current = null;
    resizeRef.current = null;
  };

  const handleResizeStart = (e: React.PointerEvent, id: string, mode: ResizeMode) => {
    e.stopPropagation();
    e.preventDefault();
    const ov = overlays.find(o => o.id === id);
    if (!ov) return;
    setSelectedOverlayId(id);
    const wrap = imgWrapRef.current;
    if (!wrap) return;
    const wrapRect = wrap.getBoundingClientRect();
    // Якщо w/h ще не задані — фіксуємо поточний DOM-розмір як старт.
    let initW: number, initH: number;
    if (typeof ov.w === "number" && typeof ov.h === "number") {
      initW = ov.w;
      initH = ov.h;
    } else {
      const handleEl = e.currentTarget as HTMLElement;
      const span = handleEl.parentElement?.querySelector("[data-overlay-content]") as HTMLElement | null;
      if (span) {
        const r = span.getBoundingClientRect();
        initW = (r.width / wrapRect.width) * 100;
        initH = (r.height / wrapRect.height) * 100;
      } else {
        initW = 30; initH = 10;
      }
    }
    resizeRef.current = {
      id, mode,
      initX: ov.x, initY: ov.y, initW, initH,
      initCursorX: e.clientX, initCursorY: e.clientY,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleRemoveBg = async () => {
    if (!block.data.url || bgRemoving) return;
    setBgRemoving(true);
    setBgError("");
    // originalUrl фіксує фото ДО першого AI — щоб ⟲ Оригінал працював навіть після кількох ітерацій
    const sourceUrl = block.data.url;
    const originalUrl = block.data.originalUrl || sourceUrl;
    try {
      const { removeBackground } = await import("@imgly/background-removal");

      let input: Blob | string;
      try {
        const resp = await fetch(sourceUrl, { mode: "cors" });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        input = await resp.blob();
      } catch (fetchErr) {
        console.warn("[removeBg] fetch failed, trying canvas fallback:", fetchErr);
        input = await urlToDataUrl(sourceUrl);
      }

      const outputBlob = await removeBackground(input, {
        progress: (key, current, total) => {
          // eslint-disable-next-line no-console
          console.log(`[removeBg] ${key}: ${current}/${total}`);
        },
      });

      const file = new File([outputBlob], "bg-removed.png", { type: "image/png" });
      const url = await onUpload(file);
      if (url) {
        const img = new window.Image();
        img.onload = () => {
          onChange({
            ...block.data,
            url,
            originalUrl,
            aspectRatio: String(img.naturalWidth / img.naturalHeight),
          });
        };
        img.onerror = () => onChange({ ...block.data, url, originalUrl });
        img.src = url;
      } else {
        setBgError("Не вдалось завантажити оброблене фото на сервер");
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[removeBg] failed:", e);
      const msg = e instanceof Error ? e.message : String(e);
      setBgError(`Помилка: ${msg}. Дивись консоль (F12) для деталей.`);
    } finally {
      setBgRemoving(false);
    }
  };

  const applyUrlChange = (url: string, mutate?: (next: Record<string, string>) => void) => {
    const img = new window.Image();
    img.onload = () => {
      const next: Record<string, string> = {
        ...block.data,
        url,
        aspectRatio: String(img.naturalWidth / img.naturalHeight),
      };
      delete next.minHeight; // нові пропорції — скидаємо forced height
      mutate?.(next);
      onChange(next);
    };
    img.onerror = () => {
      const next: Record<string, string> = { ...block.data, url };
      delete next.minHeight;
      mutate?.(next);
      onChange(next);
    };
    img.src = url;
  };

  const handleRevertOriginal = () => {
    if (!block.data.originalUrl) return;
    applyUrlChange(block.data.originalUrl, (next) => { delete next.originalUrl; });
  };

  // Escape / Delete / Backspace: якщо є вибраний overlay (і не в режимі редагування) — видалити його.
  // Якщо в editing режимі — Escape вже обробляється onKeyDown в input (вихід з editing).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape" && e.key !== "Delete" && e.key !== "Backspace") return;
      if (editingOverlayId) return; // не чіпаємо коли user в input
      if (!selectedOverlayId) return;
      const target = e.target as HTMLElement | null;
      // Якщо фокус на input/textarea/contentEditable — не видаляємо
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      e.preventDefault();
      removeOverlay(selectedOverlayId);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedOverlayId, editingOverlayId, overlays]);

  // Підтягнути aspectRatio для старих фото без поля
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

  const handleGenerateFromUrl = async () => {
    const url = urlInput.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      setGenError("URL має починатись з http:// або https://");
      return;
    }
    setGenerating(true);
    setGenError("");
    try {
      const resp = await fetch("/api/page-screenshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, viewportWidth: 1440, waitMs: 800 }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
      const imgUrl: string = data.url;
      const w = Number(data.width);
      const h = Number(data.height);
      onChange({
        ...block.data,
        url: imgUrl,
        aspectRatio: w && h ? String(w / h) : "",
      });
      setUrlInput("");
    } catch (e) {
      setGenError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const url = await onUpload(file);
    setUploading(false);
    if (url) {
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
              <div
                ref={imgWrapRef}
                onClick={() => setSelectedOverlayId(null)}
                onPointerMove={handleOverlayPointerMove}
                onPointerUp={handleOverlayPointerUp}
                style={{
                  position: "relative",
                  width: "100%",
                  height: effectiveH > 0 ? `${effectiveH}px` : "auto",
                  borderRadius: "8px",
                  overflow: "hidden",
                }}
              >
                <img
                  src={block.data.url}
                  alt={block.data.alt || ""}
                  style={{
                    width: "100%",
                    height: effectiveH > 0 ? `${effectiveH}px` : "auto",
                    objectFit: effectiveH > 0 ? "fill" : "contain",
                    display: "block",
                    pointerEvents: "none",
                  }}
                />
                {overlays.map(ov => {
                  const isSelected = selectedOverlayId === ov.id;
                  const isEditing = editingOverlayId === ov.id;
                  const hasSize = typeof ov.w === "number" && typeof ov.h === "number";
                  return (
                    <div
                      key={ov.id}
                      data-overlay-selected={isSelected ? "true" : undefined}
                      onPointerDown={(e) => handleOverlayPointerDown(e, ov.id)}
                      onDoubleClick={(e) => { e.stopPropagation(); setEditingOverlayId(ov.id); setSelectedOverlayId(ov.id); }}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        position: "absolute",
                        left: `${ov.x}%`,
                        top: `${ov.y}%`,
                        width: hasSize ? `${ov.w}%` : "auto",
                        height: hasSize ? `${ov.h}%` : "auto",
                        cursor: isEditing ? "text" : "move",
                        userSelect: isEditing ? "text" : "none",
                        outline: isSelected ? "2px dashed #D4A843" : "none",
                        outlineOffset: "2px",
                        maxWidth: hasSize ? undefined : "calc(100% - 12px)",
                        boxSizing: "border-box",
                      }}
                    >
                      {(() => {
                        const r = ov.radius ?? (ov.bgColor ? 4 : 0);
                        const radiusCss = r >= 999 ? "9999px" : `${r}px`;
                        const shadowCss = ov.shadow ? "0 4px 16px rgba(0,0,0,0.35)" : "none";
                        const padX = ov.bgColor ? Math.max(10, Math.round(ov.fontSize * 0.5)) : 0;
                        const padY = ov.bgColor ? Math.max(4, Math.round(ov.fontSize * 0.2)) : 0;
                        if (isEditing) {
                          return (
                            <input
                              data-overlay-content
                              autoFocus
                              value={ov.text}
                              onChange={(e) => updateOverlay(ov.id, { text: e.target.value })}
                              onBlur={() => setEditingOverlayId(null)}
                              onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setEditingOverlayId(null); }}
                              style={{
                                background: ov.bgColor || "rgba(0,0,0,0.4)",
                                border: "none", outline: "none",
                                color: ov.color,
                                fontSize: `${ov.fontSize}px`, fontWeight: ov.weight, fontFamily: ov.fontFamily || ff,
                                fontStyle: ov.italic ? "italic" : "normal",
                                textDecoration: ov.underline ? "underline" : "none",
                                letterSpacing: ov.letterSpacing ? `${ov.letterSpacing}px` : "normal",
                                lineHeight: ov.lineHeight || 1.2,
                                padding: `${padY}px ${padX}px`,
                                borderRadius: radiusCss,
                                boxShadow: shadowCss,
                                width: hasSize ? "100%" : "auto",
                                height: hasSize ? "100%" : "auto",
                                minWidth: hasSize ? undefined : "120px",
                                textAlign: ov.align || "center",
                                boxSizing: "border-box",
                                display: "block",
                              }}
                            />
                          );
                        }
                        return (
                          <span
                            data-overlay-content
                            style={{
                              color: ov.color,
                              background: ov.bgColor || "transparent",
                              fontSize: `${ov.fontSize}px`, fontWeight: ov.weight, fontFamily: ov.fontFamily || ff,
                              fontStyle: ov.italic ? "italic" : "normal",
                              textDecoration: ov.underline ? "underline" : "none",
                              letterSpacing: ov.letterSpacing ? `${ov.letterSpacing}px` : "normal",
                              lineHeight: ov.lineHeight || 1.2,
                              textAlign: ov.align || "center",
                              textShadow: ov.bgColor ? "none" : "0 2px 8px rgba(0,0,0,0.5)",
                              whiteSpace: "pre-wrap",
                              display: hasSize ? "flex" : "inline-block",
                              alignItems: hasSize ? "center" : undefined,
                              justifyContent: hasSize ? (ov.align === "left" ? "flex-start" : ov.align === "right" ? "flex-end" : "center") : undefined,
                              width: hasSize ? "100%" : undefined,
                              height: hasSize ? "100%" : undefined,
                              padding: `${padY}px ${padX}px`,
                              borderRadius: radiusCss,
                              boxShadow: shadowCss,
                              boxSizing: "border-box",
                              overflow: "hidden",
                            }}
                          >{ov.text || " "}</span>
                        );
                      })()}
                      {isSelected && !isEditing && (() => {
                        const dot: React.CSSProperties = {
                          position: "absolute", width: "12px", height: "12px",
                          background: "#fff", border: "2px solid #D4A843",
                          borderRadius: "50%", zIndex: 5,
                        };
                        const edge: React.CSSProperties = {
                          position: "absolute", background: "transparent", zIndex: 4,
                        };
                        const make = (mode: ResizeMode, style: React.CSSProperties) => (
                          <div
                            onPointerDown={(e) => handleResizeStart(e, ov.id, mode)}
                            onPointerMove={handleOverlayPointerMove}
                            onPointerUp={handleOverlayPointerUp}
                            style={style}
                          />
                        );
                        return (
                          <>
                            {/* edges (тонкі смужки по периметру) */}
                            {make("n", { ...edge, top: "-4px", left: "8px", right: "8px", height: "8px", cursor: "ns-resize" })}
                            {make("s", { ...edge, bottom: "-4px", left: "8px", right: "8px", height: "8px", cursor: "ns-resize" })}
                            {make("w", { ...edge, top: "8px", bottom: "8px", left: "-4px", width: "8px", cursor: "ew-resize" })}
                            {make("e", { ...edge, top: "8px", bottom: "8px", right: "-4px", width: "8px", cursor: "ew-resize" })}
                            {/* corners */}
                            {make("nw", { ...dot, top: "-6px", left: "-6px", cursor: "nwse-resize" })}
                            {make("ne", { ...dot, top: "-6px", right: "-6px", cursor: "nesw-resize" })}
                            {make("sw", { ...dot, bottom: "-6px", left: "-6px", cursor: "nesw-resize" })}
                            {make("se", { ...dot, bottom: "-6px", right: "-6px", cursor: "nwse-resize" })}
                          </>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            );
          })()}
          <div style={{ position: "absolute", top: "8px", right: "8px", display: "flex", gap: "6px" }}>
            <button
              onClick={() => setCropOpen(true)}
              title="Обрізати фото"
              style={{
                background: "rgba(28,58,46,0.85)", color: "#D4A843",
                border: "none", borderRadius: "6px",
                padding: "4px 10px", cursor: "pointer", fontSize: "12px",
                fontWeight: 600, backdropFilter: "blur(4px)",
              }}
            >{"✂️ Обрізати"}</button>
            <button
              onClick={handleRemoveBg}
              disabled={bgRemoving}
              title={bgRemoving ? "Обробка… модель завантажується" : "Видалити фон AI (краще для фото з людьми)"}
              style={{
                background: bgRemoving ? "rgba(124,58,237,0.65)" : "rgba(124,58,237,0.88)",
                color: "#fff", border: "none", borderRadius: "6px",
                padding: "4px 10px",
                cursor: bgRemoving ? "wait" : "pointer",
                fontSize: "12px", fontWeight: 600,
                backdropFilter: "blur(4px)",
                display: "inline-flex", alignItems: "center", gap: "4px",
              }}
            >
              {bgRemoving ? (<>
                <span className="animate-spin" style={{ display: "inline-block", width: "10px", height: "10px", border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%" }} />
                Обробка…
              </>) : "🪄 Прибрати фон"}
            </button>
            {block.data.originalUrl && (
              <button
                onClick={handleRevertOriginal}
                title="Повернути оригінальне фото (відкотити AI видалення фону)"
                style={{
                  background: "rgba(75,85,99,0.85)",
                  color: "#fff", border: "none", borderRadius: "6px",
                  padding: "4px 10px", cursor: "pointer", fontSize: "12px",
                  fontWeight: 600, backdropFilter: "blur(4px)",
                }}
              >{"⟲ Оригінал"}</button>
            )}
          </div>
          {bgError && (
            <div style={{ position: "absolute", bottom: "8px", left: "8px", right: "8px", background: "rgba(239,68,68,0.92)", color: "#fff", padding: "6px 10px", borderRadius: "6px", fontSize: "11px", fontFamily: ff }}>
              {bgError}
            </div>
          )}
        </div>
      ) : (
        <div style={{ borderWidth: "2px", borderStyle: "dashed", borderColor: "#D4A843", borderRadius: "10px", padding: "16px", background: "#FAF6F0", fontFamily: ff }}>
          {/* Tab switcher */}
          <div style={{ display: "flex", gap: "4px", marginBottom: "12px", borderBottom: "1px solid #E8D5B7", paddingBottom: "8px" }}>
            <button
              type="button"
              onClick={() => setEmptyMode("file")}
              style={{
                flex: 1, padding: "8px 12px", borderRadius: "6px",
                background: emptyMode === "file" ? "#1C3A2E" : "transparent",
                color: emptyMode === "file" ? "#D4A843" : "#1C3A2E",
                border: "none", cursor: "pointer", fontSize: "12px", fontWeight: 600, fontFamily: ff,
              }}
            >🖼  З диска</button>
            <button
              type="button"
              onClick={() => setEmptyMode("url")}
              style={{
                flex: 1, padding: "8px 12px", borderRadius: "6px",
                background: emptyMode === "url" ? "#1C3A2E" : "transparent",
                color: emptyMode === "url" ? "#D4A843" : "#1C3A2E",
                border: "none", cursor: "pointer", fontSize: "12px", fontWeight: 600, fontFamily: ff,
              }}
            >🌐 Скрін з сайту</button>
          </div>

          {emptyMode === "file" ? (
            <div
              onClick={() => ref.current?.click()}
              style={{ padding: "20px", textAlign: "center", cursor: "pointer", color: "#9CA3AF", fontSize: "13px" }}
            >{uploading ? "Завантаження..." : "Натисніть щоб обрати файл"}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <input
                style={inputStyle}
                placeholder="https://uimp.com.ua/uk/consultations"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !generating) handleGenerateFromUrl(); }}
                disabled={generating}
              />
              <button
                type="button"
                onClick={handleGenerateFromUrl}
                disabled={generating || !urlInput.trim()}
                style={{
                  padding: "10px 16px", borderRadius: "8px", border: "none",
                  background: generating ? "rgba(28,58,46,0.5)" : "#1C3A2E",
                  color: "#D4A843", fontSize: "13px", fontWeight: 700,
                  cursor: generating || !urlInput.trim() ? "not-allowed" : "pointer",
                  opacity: generating || !urlInput.trim() ? 0.6 : 1,
                  fontFamily: ff,
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px",
                }}
              >
                {generating ? (<>
                  <span className="animate-spin" style={{ display: "inline-block", width: "12px", height: "12px", border: "2px solid #D4A843", borderTopColor: "transparent", borderRadius: "50%" }} />
                  Генерую (5-15 с)…
                </>) : "Згенерувати скрін"}
              </button>
              <div style={{ fontSize: "11px", color: "#9CA3AF", lineHeight: 1.5 }}>
                Сервер відкриє сторінку в headless браузері і зробить чистий скрін. Далі обрізай ✂️ до потрібного блоку.
              </div>
              {genError && (
                <div style={{ background: "rgba(239,68,68,0.1)", color: "#B91C1C", padding: "8px 10px", borderRadius: "6px", fontSize: "12px" }}>
                  {genError}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      <input ref={ref} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
      {(() => {
        const ov = overlays.find(o => o.id === selectedOverlayId);
        if (!ov) return null;
        return (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center", padding: "10px 12px", background: "#FAF6F0", border: "1.5px solid #E8D5B7", borderRadius: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "10px", color: "#6B7280" }}>Текст</span>
              <div style={{ display: "inline-flex", gap: "3px" }}>
                {UIMP_COLORS.filter(c => c.value).map(c => {
                  const active = ov.color.toUpperCase() === c.value.toUpperCase();
                  return (
                    <button
                      key={c.value}
                      title={c.label}
                      onClick={() => updateOverlay(ov.id, { color: c.value })}
                      style={{
                        width: "22px", height: "22px", borderRadius: "5px",
                        border: `1.5px solid ${active ? "#D4A843" : "#E8D5B7"}`,
                        background: c.value, cursor: "pointer", padding: 0,
                        boxShadow: active ? "0 0 0 2px rgba(212,168,67,0.3)" : "none",
                      }}
                    />
                  );
                })}
              </div>
              <input
                type="color" value={ov.color}
                onChange={(e) => updateOverlay(ov.id, { color: e.target.value })}
                title="Свій колір тексту"
                style={{ width: "26px", height: "22px", border: "1.5px solid #E8D5B7", borderRadius: "5px", padding: 0, background: "none", cursor: "pointer" }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "10px", color: "#6B7280" }}>Фон</span>
              <div style={{ display: "inline-flex", gap: "3px" }}>
                {/* "Без фону" = пустий рядок (прозорий) */}
                <button
                  title="Без фону"
                  onClick={() => updateOverlay(ov.id, { bgColor: "" })}
                  style={{
                    width: "22px", height: "22px", borderRadius: "5px",
                    border: `1.5px solid ${!ov.bgColor ? "#D4A843" : "#E8D5B7"}`,
                    background: "repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%) 50% / 8px 8px",
                    cursor: "pointer", padding: 0,
                    boxShadow: !ov.bgColor ? "0 0 0 2px rgba(212,168,67,0.3)" : "none",
                  }}
                />
                {UIMP_COLORS.filter(c => c.value).map(c => {
                  const active = (ov.bgColor || "").toUpperCase() === c.value.toUpperCase();
                  return (
                    <button
                      key={c.value}
                      title={c.label}
                      onClick={() => updateOverlay(ov.id, { bgColor: c.value })}
                      style={{
                        width: "22px", height: "22px", borderRadius: "5px",
                        border: `1.5px solid ${active ? "#D4A843" : "#E8D5B7"}`,
                        background: c.value, cursor: "pointer", padding: 0,
                        boxShadow: active ? "0 0 0 2px rgba(212,168,67,0.3)" : "none",
                      }}
                    />
                  );
                })}
              </div>
              <input
                type="color" value={ov.bgColor || "#000000"}
                onChange={(e) => updateOverlay(ov.id, { bgColor: e.target.value })}
                title="Свій колір фону"
                style={{ width: "26px", height: "22px", border: "1.5px solid #E8D5B7", borderRadius: "5px", padding: 0, background: "none", cursor: "pointer" }}
              />
            </div>

            {/* Шрифт */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "10px", color: "#6B7280" }}>Шрифт</span>
              <select
                value={ov.fontFamily || ""}
                onChange={(e) => updateOverlay(ov.id, { fontFamily: e.target.value })}
                style={{
                  padding: "4px 6px", borderRadius: "6px",
                  border: "1.5px solid #E8D5B7", background: "#fff",
                  color: "#1C3A2E", fontSize: "12px", cursor: "pointer",
                  fontFamily: ov.fontFamily || ff,
                }}
              >
                {OVERLAY_FONTS.map(f => (
                  <option key={f.label} value={f.value} style={{ fontFamily: f.value || ff }}>{f.label}</option>
                ))}
              </select>
            </div>

            {/* Розмір */}
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span style={{ fontSize: "10px", color: "#6B7280" }}>Розмір</span>
              <button
                onClick={() => updateOverlay(ov.id, { fontSize: Math.max(8, ov.fontSize - 1) })}
                title="Менше"
                style={{ width: "24px", height: "26px", borderRadius: "5px", border: "1.5px solid #E8D5B7", background: "#fff", color: "#1C3A2E", fontSize: "14px", fontWeight: 700, cursor: "pointer", padding: 0 }}
              >−</button>
              <input
                type="text"
                inputMode="numeric"
                value={ov.fontSize}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9]/g, "");
                  if (v === "") return;
                  const n = Number(v);
                  if (Number.isFinite(n) && n >= 8 && n <= 400) updateOverlay(ov.id, { fontSize: n });
                }}
                style={{ width: "40px", padding: "3px 4px", borderRadius: "5px", border: "1.5px solid #E8D5B7", background: "#fff", color: "#1C3A2E", fontSize: "13px", textAlign: "center", outline: "none" }}
              />
              <button
                onClick={() => updateOverlay(ov.id, { fontSize: Math.min(400, ov.fontSize + 1) })}
                title="Більше"
                style={{ width: "24px", height: "26px", borderRadius: "5px", border: "1.5px solid #E8D5B7", background: "#fff", color: "#1C3A2E", fontSize: "14px", fontWeight: 700, cursor: "pointer", padding: 0 }}
              >+</button>
            </div>

            {/* B / I / U */}
            <div style={{ display: "inline-flex", gap: "3px" }}>
              <button
                onClick={() => updateOverlay(ov.id, { weight: ov.weight === 700 ? 400 : 700 })}
                title="Жирний"
                style={{
                  width: "28px", height: "26px", borderRadius: "6px",
                  border: `1.5px solid ${ov.weight === 700 ? "#D4A843" : "#E8D5B7"}`,
                  background: ov.weight === 700 ? "#1C3A2E" : "#fff",
                  color: ov.weight === 700 ? "#D4A843" : "#1C3A2E",
                  fontSize: "13px", fontWeight: 700, cursor: "pointer", padding: 0,
                }}
              >B</button>
              <button
                onClick={() => updateOverlay(ov.id, { italic: !ov.italic })}
                title="Курсив"
                style={{
                  width: "28px", height: "26px", borderRadius: "6px",
                  border: `1.5px solid ${ov.italic ? "#D4A843" : "#E8D5B7"}`,
                  background: ov.italic ? "#1C3A2E" : "#fff",
                  color: ov.italic ? "#D4A843" : "#1C3A2E",
                  fontSize: "13px", fontStyle: "italic", fontWeight: 600, cursor: "pointer", padding: 0,
                }}
              >I</button>
              <button
                onClick={() => updateOverlay(ov.id, { underline: !ov.underline })}
                title="Підкреслений"
                style={{
                  width: "28px", height: "26px", borderRadius: "6px",
                  border: `1.5px solid ${ov.underline ? "#D4A843" : "#E8D5B7"}`,
                  background: ov.underline ? "#1C3A2E" : "#fff",
                  color: ov.underline ? "#D4A843" : "#1C3A2E",
                  fontSize: "13px", fontWeight: 600, textDecoration: "underline", cursor: "pointer", padding: 0,
                }}
              >U</button>
            </div>

            {/* Вирівнювання */}
            <div style={{ display: "inline-flex", gap: "3px" }}>
              {([
                { v: "left",   l: "⬅" },
                { v: "center", l: "⬌" },
                { v: "right",  l: "➡" },
              ] as const).map(a => {
                const active = (ov.align || "center") === a.v;
                return (
                  <button
                    key={a.v}
                    onClick={() => updateOverlay(ov.id, { align: a.v })}
                    title={`Вирівняти ${a.v === "left" ? "ліворуч" : a.v === "right" ? "праворуч" : "по центру"}`}
                    style={{
                      width: "28px", height: "26px", borderRadius: "6px",
                      border: `1.5px solid ${active ? "#D4A843" : "#E8D5B7"}`,
                      background: active ? "#1C3A2E" : "#fff",
                      color: active ? "#D4A843" : "#1C3A2E",
                      fontSize: "12px", cursor: "pointer", padding: 0,
                    }}
                  >{a.l}</button>
                );
              })}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span style={{ fontSize: "10px", color: "#6B7280" }}>Форма</span>
              {RADIUS_PRESETS.map((p, i) => {
                const cur = ov.radius ?? (ov.bgColor ? 4 : 0);
                const active = cur === p.value;
                const previewRadius = p.value >= 999 ? "9999px" : `${Math.min(p.value, 12)}px`;
                return (
                  <button
                    key={i}
                    title={p.value >= 999 ? "Pill" : `Радіус ${p.value}px`}
                    onClick={() => updateOverlay(ov.id, { radius: p.value })}
                    style={{
                      width: "28px", height: "22px",
                      border: `1.5px solid ${active ? "#D4A843" : "#E8D5B7"}`,
                      background: active ? "#1C3A2E" : "#FAF6F0",
                      borderRadius: previewRadius,
                      cursor: "pointer", padding: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "11px", color: active ? "#D4A843" : "#1C3A2E",
                    }}
                  >{p.label}</button>
                );
              })}
            </div>

            <button
              onClick={() => updateOverlay(ov.id, { shadow: !ov.shadow })}
              title="Тінь під підкладкою"
              style={{
                padding: "5px 10px", borderRadius: "6px",
                border: `1.5px solid ${ov.shadow ? "#D4A843" : "#E8D5B7"}`,
                background: ov.shadow ? "#1C3A2E" : "#fff",
                color: ov.shadow ? "#D4A843" : "#1C3A2E",
                fontSize: "11px", fontWeight: 600, cursor: "pointer",
              }}
            >☁ Тінь</button>

            <button
              onClick={() => setEditingOverlayId(ov.id)}
              style={{
                padding: "5px 10px", borderRadius: "6px",
                border: "1.5px solid #E8D5B7", background: "#fff", color: "#1C3A2E",
                fontSize: "11px", fontWeight: 600, cursor: "pointer",
              }}
            >✎ Редагувати</button>

            {/* URL — робить overlay клікабельним посиланням */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: "1 1 220px", minWidth: "200px" }}>
              <span style={{ fontSize: "10px", color: "#6B7280" }} title="Якщо заповнено — overlay стає клікабельним посиланням">🔗 URL</span>
              <input
                type="text"
                value={ov.href || ""}
                onChange={(e) => updateOverlay(ov.id, { href: e.target.value })}
                placeholder="https://t.me/... або https://..."
                style={{ flex: 1, padding: "4px 8px", borderRadius: "5px", border: "1.5px solid #E8D5B7", background: "#fff", color: "#1C3A2E", fontSize: "12px", outline: "none", fontFamily: ff }}
              />
              {ov.href && (
                <button
                  onClick={() => updateOverlay(ov.id, { href: "" })}
                  title="Прибрати посилання"
                  style={{ padding: "3px 6px", borderRadius: "5px", border: "1.5px solid #E8D5B7", background: "#fff", color: "#6B7280", fontSize: "11px", cursor: "pointer" }}
                >✕</button>
              )}
            </div>
          </div>
        );
      })()}
      {(showAlt || block.data.alt) ? (
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <input
            style={inputStyle}
            placeholder="Alt текст (для SEO та доступності)"
            autoFocus={showAlt && !block.data.alt}
            value={block.data.alt || ""}
            onChange={e => onChange({ ...block.data, alt: e.target.value })}
          />
          <button
            type="button"
            onClick={() => { onChange({ ...block.data, alt: "" }); setShowAlt(false); }}
            title="Прибрати alt текст"
            style={{ padding: "6px 10px", borderRadius: "6px", border: "1.5px solid #E8D5B7", background: "#fff", color: "#6B7280", fontSize: "12px", cursor: "pointer", flexShrink: 0 }}
          >✕</button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowAlt(true)}
          style={{ alignSelf: "flex-start", padding: "5px 10px", borderRadius: "6px", border: "1.5px dashed #E8D5B7", background: "transparent", color: "#9CA3AF", fontSize: "11px", cursor: "pointer", fontFamily: ff }}
        >+ Alt текст</button>
      )}
      {cropOpen && block.data.url && (
        <CropModal
          imageUrl={block.data.url}
          initialAspect={Number(block.data.aspectRatio) || undefined}
          onCancel={() => setCropOpen(false)}
          onCropDone={async (blob, newAspect) => {
            const file = new File([blob], "cropped.jpg", { type: blob.type });
            const url = await onUpload(file);
            if (url) {
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
