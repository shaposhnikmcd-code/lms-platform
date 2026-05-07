"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Block, UIMP_COLORS } from "../types";
import ImageStudioModal, { buildCornerRadiusCss } from "./ImageStudioModal";

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
  /** Чи цей блок зараз виділений. Overlay-toolbar портал-иться у slot ТІЛЬКИ
   *  коли selected=true — інакше при кліках по overlay-ах різних image-блоків
   *  у slot стекалося б кілька toolbar-ів (один на блок). */
  selected?: boolean;
  /** Прокидається з BlockItem → AbsoluteBlock.onSelect — щоб клік по overlay
   *  автоматично виділяв батьківський image-блок (інакше slot з налаштуваннями
   *  не відкривається, бо BlockItemHeader портал-иться лише коли parent selected). */
  onSelectBlock?: (id: string) => void;
  /** Сповіщає батька (BlockItem) чи зараз обраний якийсь overlay. Коли так,
   *  BlockItem НЕ портал-ить BlockItemHeader — у slot видно лише налаштування
   *  overlay-тексту (без батьківського редактора блока). */
  onOverlayActiveChange?: (active: boolean) => void;
  /** Px-ширина канвасу білдера. Використовується щоб порахувати targetDisplayWidth
   *  для ImageStudioModal — фото у фуллскрін-редакторі рендериться у тих самих
   *  px-розмірах, що в блоці на канвасі. */
  containerWidthPx?: number;
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
  /** Вертикальне вирівнювання тексту в межах overlay-боксу. Спрацьовує лише
   *  коли overlay має фіксовану висоту (hasSize=true). Default "center". */
  vAlign?: "top" | "center" | "bottom";
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

// Реєстр crop-обробників — кожен ImageEditor реєструє свій setCropOpen для свого
// blockId. BlockItemHeader викликає requestCrop(blockId) напряму, без window-event.
const cropHandlers = new Map<string, () => void>();
export function requestCrop(blockId: string) {
  cropHandlers.get(blockId)?.();
}

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

export default function ImageEditor({ block, onChange, onUpload, previewHeight, selected = false, onSelectBlock, onOverlayActiveChange, containerWidthPx = 0 }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  // Студія тепер єдина точка входу для crop/radius/chroma. cropOpen ліквідовано.
  const [studioOpen, setStudioOpen] = useState(false);
  // Якщо студія відкривається через ✂ кнопку BlockItemHeader-а — стартуємо одразу в crop mode.
  const [studioInitialCropMode, setStudioInitialCropMode] = useState(false);
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
    // Авто-виділення батьківського блоку — щоб slot з налаштуваннями відкрився
    // (preventDefault блокує bubbling click event який зазвичай це робить).
    onSelectBlock?.(block.id);
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

  // Реєструємо обробник crop у module-level Map — щоб BlockItemHeader міг
  // викликати його напряму. Тепер crop виконується всередині ImageStudioModal,
  // тому requestCrop відкриває студію одразу в crop-режимі.
  useEffect(() => {
    if (!block.data.url) return;
    cropHandlers.set(block.id, () => {
      setStudioInitialCropMode(true);
      setStudioOpen(true);
    });
    return () => { cropHandlers.delete(block.id); };
  }, [block.id, block.data.url]);

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

  // Сповіщаємо батьківський BlockItem чи активний зараз overlay — щоб він
  // приховав свій BlockItemHeader коли користувач редагує overlay-текст
  // (у slot буде лише панель overlay, без батьківського редактора блока).
  useEffect(() => {
    onOverlayActiveChange?.(selectedOverlayId !== null && selected);
  }, [selectedOverlayId, selected, onOverlayActiveChange]);

  // При втраті виділення блока — скидаємо overlay (інакше при наступному кліку
  // на цей же блок одразу відкриється стара overlay-панель замість блок-панелі).
  useEffect(() => {
    if (!selected && selectedOverlayId !== null) {
      setSelectedOverlayId(null);
    }
  }, [selected, selectedOverlayId]);

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
    <div style={{ display: "flex", flexDirection: "column", gap: "10px", height: "100%" }}>
      {block.data.url ? (
        <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
          {(() => {
            const previewH = previewHeight ?? 0;
            const imgRadius = Number(block.data.imgRadius) || 0;
            const radiusCss = buildCornerRadiusCss(imgRadius, block.data.imgRadiusCorners);
            return (
              <div
                ref={imgWrapRef}
                onClick={() => setSelectedOverlayId(null)}
                onPointerMove={handleOverlayPointerMove}
                onPointerUp={handleOverlayPointerUp}
                style={{
                  position: "relative",
                  width: "100%",
                  height: previewH > 0 ? `${previewH}px` : "100%",
                  borderRadius: radiusCss,
                  overflow: "hidden",
                }}
              >
                <img
                  src={block.data.url}
                  alt={block.data.alt || ""}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "fill",
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
                              alignItems: hasSize ? (ov.vAlign === "top" ? "flex-start" : ov.vAlign === "bottom" ? "flex-end" : "center") : undefined,
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
        // Гейт на selected: тільки виділений image-блок портал-ить свій overlay-toolbar.
        // Без цього два image-блоки з обраними overlay-ами стекали б два toolbar-и.
        if (!selected) return null;
        const ov = overlays.find(o => o.id === selectedOverlayId);
        if (!ov) return null;
        const slot = typeof document !== "undefined"
          ? document.getElementById("news-block-settings-slot")
          : null;
        if (!slot) return null;
        const toolbarNode = <OverlayToolbar ov={ov} updateOverlay={updateOverlay} setEditingOverlayId={setEditingOverlayId} removeOverlay={removeOverlay} />;
        return createPortal(toolbarNode, slot);
      })()}
      {(() => {
        // Image-specific trigger (відкрити повноекранний редактор фото).
        // Портал у slot ПІСЛЯ BlockItemHeader. Не показуємо якщо вибрано overlay
        // або фото ще не завантажено.
        if (!selected) return null;
        if (selectedOverlayId !== null) return null;
        if (!block.data.url) return null;
        const slot = typeof document !== "undefined"
          ? document.getElementById("news-block-settings-slot")
          : null;
        if (!slot) return null;
        return createPortal(
          <ImageBlockSettings onOpenStudio={() => { setStudioInitialCropMode(false); setStudioOpen(true); }} />,
          slot,
        );
      })()}
      {/* Alt текст для SEO/доступності — викликається через prompt() з невидимої кнопки.
          Якщо потрібно ввести/змінити alt, юзер може зробити це через спец-команду пізніше.
          UI-плашка прибрана: вилазила за блок або, з overflow:hidden, обрізалась —
          в обох випадках псувала вигляд canvas. data.alt у БД залишається як є. */}
      {showAlt && (
        <input
          style={{ position: "absolute", left: 16, right: 16, bottom: 8, ...inputStyle, zIndex: 5 }}
          placeholder="Alt текст (для SEO)"
          autoFocus
          value={block.data.alt || ""}
          onChange={e => onChange({ ...block.data, alt: e.target.value })}
          onBlur={() => setShowAlt(false)}
        />
      )}
      {studioOpen && block.data.url && (
        <ImageStudioModal
          imageUrl={block.data.url}
          initialRadius={Number(block.data.imgRadius) || 0}
          initialTolerance={Number(block.data.bgRemoveTolerance) || 0}
          initialCorners={block.data.imgRadiusCorners}
          initialCropMode={studioInitialCropMode}
          targetDisplayWidth={
            containerWidthPx > 0
              ? Math.max(60, ((Number(block.width) || 100) * containerWidthPx) / 100 - 32)
              : undefined
          }
          onCancel={() => setStudioOpen(false)}
          onSave={async ({ imgRadius, tolerance, corners, blob, newAspect }) => {
            const next: Record<string, string> = {
              ...block.data,
              imgRadius: String(imgRadius),
              bgRemoveTolerance: String(tolerance),
              imgRadiusCorners: corners,
            };
            if (blob) {
              const ext = blob.type === "image/png" ? "png" : "jpg";
              const file = new File([blob], `edited.${ext}`, { type: blob.type });
              const url = await onUpload(file);
              if (url) {
                next.url = url;
                if (newAspect && Number.isFinite(newAspect)) {
                  next.aspectRatio = String(newAspect);
                }
                // Скидаємо minHeight — нові пропорції перерахують висоту блока
                delete next.minHeight;
              }
            }
            onChange(next);
            setStudioOpen(false);
          }}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// OverlayToolbar — sectioned vertical panel для редагування тексту-на-фото.
// Render-иться у #news-block-settings-slot як одна з секцій спільної settings-картки.
// ────────────────────────────────────────────────────────────────────────────

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    fontSize: "9px",
    fontWeight: 800,
    color: "#9B7C45",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    fontFamily: ff,
    marginBottom: "4px",
  }}>{children}</div>
);

const Section: React.FC<{ children: React.ReactNode; padTop?: number }> = ({ children, padTop = 6 }) => (
  <div style={{ padding: `${padTop}px 10px 6px`, background: "#FFFFFF" }}>{children}</div>
);

function ColorSwatchRow({
  current, onChange, includeTransparent,
}: { current: string; onChange: (c: string) => void; includeTransparent?: boolean }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
      {includeTransparent && (
        <button
          type="button"
          title="Без фону"
          onClick={() => onChange("")}
          style={{
            width: "18px", height: "18px", borderRadius: "5px",
            border: `2px solid ${!current ? "#D4A843" : "#E8D5B7"}`,
            background: "repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%) 50% / 6px 6px",
            cursor: "pointer", padding: 0,
            boxShadow: !current ? "0 0 0 2px rgba(212,168,67,0.25)" : "none",
          }}
        />
      )}
      {UIMP_COLORS.filter(c => c.value).map(c => {
        const active = (current || "").toUpperCase() === c.value.toUpperCase();
        return (
          <button
            key={c.value}
            type="button"
            title={c.label}
            onClick={() => onChange(c.value)}
            style={{
              width: "18px", height: "18px", borderRadius: "5px",
              border: `2px solid ${active ? "#D4A843" : "#E8D5B7"}`,
              background: c.value, cursor: "pointer", padding: 0,
              boxShadow: active ? "0 0 0 2px rgba(212,168,67,0.25)" : "none",
            }}
          />
        );
      })}
      <input
        type="color"
        value={current || "#000000"}
        onChange={(e) => onChange(e.target.value)}
        title="Свій колір"
        style={{
          width: "22px", height: "18px",
          border: "2px solid #E8D5B7",
          borderRadius: "5px", padding: 0,
          background: "none", cursor: "pointer",
        }}
      />
    </div>
  );
}

function ToggleBtn({
  active, onClick, title, children, flex,
}: { active: boolean; onClick: () => void; title: string; children: React.ReactNode; flex?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        ...(flex ? { flex: 1 } : { width: "28px" }),
        height: "26px",
        borderRadius: "6px",
        border: `1px solid ${active ? "#D4A843" : "#E8D5B7"}`,
        background: active ? "#1C3A2E" : "#FFFFFF",
        color: active ? "#D4A843" : "#1C3A2E",
        cursor: "pointer", padding: 0,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontSize: "12px", fontFamily: ff, fontWeight: 600,
      }}
    >{children}</button>
  );
}

function OverlayToolbar({
  ov, updateOverlay, setEditingOverlayId, removeOverlay,
}: {
  ov: ImageOverlay;
  updateOverlay: (id: string, patch: Partial<ImageOverlay>) => void;
  setEditingOverlayId: (id: string | null) => void;
  removeOverlay: (id: string) => void;
}) {
  const inputBase: React.CSSProperties = {
    height: "26px",
    borderRadius: "6px",
    border: "1px solid #E8D5B7",
    background: "#FFFFFF",
    color: "#1C3A2E",
    fontSize: "12px",
    fontFamily: ff,
    outline: "none",
    boxSizing: "border-box",
  };

  return (
    <div style={{ background: "#FFFFFF", fontFamily: ff }}>
      {/* Header strip — видно що редагуємо overlay-текст */}
      <div style={{
        display: "flex", alignItems: "center", gap: "8px",
        padding: "7px 12px", background: "#FAF6F0",
      }}>
        <div style={{
          width: "22px", height: "22px", borderRadius: "6px",
          background: "#D4A843", color: "#1C3A2E",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontSize: "11px", fontWeight: 800, flexShrink: 0,
        }}>T</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#1C3A2E", lineHeight: 1.1 }}>{"Текст на фото"}</div>
          <div style={{
            fontSize: "10px", color: "#9CA3AF", marginTop: "2px", lineHeight: 1,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{ov.text || "(порожньо)"}</div>
        </div>
        <button
          type="button"
          title="Видалити"
          onClick={() => removeOverlay(ov.id)}
          style={{
            width: "22px", height: "22px", borderRadius: "5px",
            border: "1px solid transparent",
            background: "transparent", color: "#B91C1C",
            cursor: "pointer", padding: 0, fontSize: "12px",
          }}
        >🗑</button>
      </div>

      <Section>
        <SectionLabel>Колір тексту</SectionLabel>
        <ColorSwatchRow current={ov.color} onChange={(c) => updateOverlay(ov.id, { color: c })} />
      </Section>

      <Section padTop={0}>
        <SectionLabel>Колір фону</SectionLabel>
        <ColorSwatchRow current={ov.bgColor || ""} onChange={(c) => updateOverlay(ov.id, { bgColor: c })} includeTransparent />
      </Section>

      <Section padTop={0}>
        <SectionLabel>Шрифт та розмір</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <select
            value={ov.fontFamily || ""}
            onChange={(e) => updateOverlay(ov.id, { fontFamily: e.target.value })}
            style={{ ...inputBase, padding: "0 6px", fontFamily: ov.fontFamily || ff, cursor: "pointer", width: "100%" }}
          >
            {OVERLAY_FONTS.map(f => (
              <option key={f.label} value={f.value} style={{ fontFamily: f.value || ff }}>{f.label}</option>
            ))}
          </select>
          <div style={{ display: "inline-flex", gap: "5px", alignItems: "center" }}>
            <button
              type="button"
              onClick={() => updateOverlay(ov.id, { fontSize: Math.max(8, ov.fontSize - 1) })}
              title="Менше"
              style={{ ...inputBase, width: "26px", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}
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
              style={{ ...inputBase, width: "44px", textAlign: "center", padding: "0 4px" }}
            />
            <button
              type="button"
              onClick={() => updateOverlay(ov.id, { fontSize: Math.min(400, ov.fontSize + 1) })}
              title="Більше"
              style={{ ...inputBase, width: "26px", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}
            >+</button>
            <span style={{ fontSize: "10px", color: "#9CA3AF" }}>px</span>
          </div>
        </div>
      </Section>

      <Section padTop={0}>
        <SectionLabel>Стиль</SectionLabel>
        <div style={{ display: "flex", gap: "5px" }}>
          <ToggleBtn flex active={ov.weight === 700} onClick={() => updateOverlay(ov.id, { weight: ov.weight === 700 ? 400 : 700 })} title="Жирний">
            <span style={{ fontWeight: 700 }}>B</span>
          </ToggleBtn>
          <ToggleBtn flex active={!!ov.italic} onClick={() => updateOverlay(ov.id, { italic: !ov.italic })} title="Курсив">
            <span style={{ fontStyle: "italic", fontWeight: 600 }}>I</span>
          </ToggleBtn>
          <ToggleBtn flex active={!!ov.underline} onClick={() => updateOverlay(ov.id, { underline: !ov.underline })} title="Підкреслений">
            <span style={{ textDecoration: "underline", fontWeight: 600 }}>U</span>
          </ToggleBtn>
        </div>
      </Section>

      <Section padTop={0}>
        <SectionLabel>Вирівнювання по горизонталі</SectionLabel>
        <div style={{ display: "flex", gap: "5px" }}>
          {(["left", "center", "right"] as const).map(a => {
            const active = (ov.align || "center") === a;
            return (
              <ToggleBtn key={a} flex active={active} onClick={() => updateOverlay(ov.id, { align: a })} title={a === "left" ? "Ліворуч" : a === "right" ? "Праворуч" : "По центру"}>
                {a === "left" ? "⯇" : a === "right" ? "⯈" : "≡"}
              </ToggleBtn>
            );
          })}
        </div>
      </Section>

      <Section padTop={0}>
        <SectionLabel>Вирівнювання по вертикалі</SectionLabel>
        <div style={{ display: "flex", gap: "5px" }}>
          {(["top", "center", "bottom"] as const).map(v => {
            const active = (ov.vAlign || "center") === v;
            return (
              <ToggleBtn key={v} flex active={active} onClick={() => updateOverlay(ov.id, { vAlign: v })} title={v === "top" ? "По верхньому краю" : v === "bottom" ? "По нижньому краю" : "По центру"}>
                {v === "top" ? "⏶" : v === "bottom" ? "⏷" : "≡"}
              </ToggleBtn>
            );
          })}
        </div>
      </Section>

      <Section padTop={0}>
        <SectionLabel>Форма підкладки</SectionLabel>
        <div style={{ display: "flex", gap: "5px" }}>
          {RADIUS_PRESETS.map((p, i) => {
            const cur = ov.radius ?? (ov.bgColor ? 4 : 0);
            const active = cur === p.value;
            const previewRadius = p.value >= 999 ? "9999px" : `${Math.min(p.value, 12)}px`;
            return (
              <button
                key={i}
                type="button"
                title={p.value >= 999 ? "Pill" : `Радіус ${p.value}px`}
                onClick={() => updateOverlay(ov.id, { radius: p.value })}
                style={{
                  flex: 1, height: "26px",
                  border: `1px solid ${active ? "#D4A843" : "#E8D5B7"}`,
                  background: active ? "#1C3A2E" : "#FFFFFF",
                  borderRadius: previewRadius,
                  cursor: "pointer", padding: 0,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  fontSize: "11px", color: active ? "#D4A843" : "#1C3A2E",
                  transition: "all 0.12s",
                }}
              >{p.label}</button>
            );
          })}
        </div>
      </Section>

      <Section padTop={0}>
        <SectionLabel>Ефекти</SectionLabel>
        <div style={{ display: "flex", gap: "5px" }}>
          <ToggleBtn flex active={!!ov.shadow} onClick={() => updateOverlay(ov.id, { shadow: !ov.shadow })} title="Тінь під підкладкою">
            <span style={{ fontSize: "11px", fontWeight: 600 }}>{ov.shadow ? "☁ Тінь увімк" : "☁ Тінь"}</span>
          </ToggleBtn>
          <ToggleBtn flex active={false} onClick={() => setEditingOverlayId(ov.id)} title="Редагувати текст напису">
            <span style={{ fontSize: "11px", fontWeight: 600 }}>{"✎ Текст"}</span>
          </ToggleBtn>
        </div>
      </Section>

      <Section padTop={0}>
        <SectionLabel>Посилання</SectionLabel>
        <div style={{ display: "flex", gap: "5px" }}>
          <input
            type="text"
            value={ov.href || ""}
            onChange={(e) => updateOverlay(ov.id, { href: e.target.value })}
            placeholder="https://..."
            style={{ ...inputBase, flex: 1, padding: "0 8px" }}
          />
          {ov.href && (
            <button
              type="button"
              onClick={() => updateOverlay(ov.id, { href: "" })}
              title="Прибрати посилання"
              style={{ ...inputBase, width: "32px", color: "#6B7280", cursor: "pointer" }}
            >✕</button>
          )}
        </div>
      </Section>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// ImageBlockSettings — image-specific панель (заокруглення кутів + chroma-key).
// Портал-иться у #news-block-settings-slot ПІСЛЯ BlockItemHeader.
// ────────────────────────────────────────────────────────────────────────────

function ImageBlockSettings({
  onOpenStudio,
}: {
  onOpenStudio: () => void;
}) {
  return (
    <div style={{ background: "#FFFFFF", fontFamily: ff, borderTop: "1px solid #F0E6D2" }}>
      <Section>
        <SectionLabel>Редактор фото</SectionLabel>
        <button
          type="button"
          onClick={onOpenStudio}
          style={{
            width: "100%", height: "34px",
            borderRadius: "6px",
            border: "1px solid #D4A843",
            background: "#1C3A2E",
            color: "#D4A843",
            fontSize: "12px",
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: ff,
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px",
            letterSpacing: "0.04em",
          }}
        >🖼 Відкрити на весь екран</button>
        <div style={{ fontSize: "10px", color: "#9CA3AF", lineHeight: 1.5, marginTop: "6px" }}>
          Заокруглення кутів фото та видалення білого фону — у повноекранному редакторі з live-превью.
        </div>
      </Section>
    </div>
  );
}
