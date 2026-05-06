"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ReactCrop, { type Crop, type PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { cropImageToBlob } from "./cropImage";

const ff = "-apple-system, BlinkMacSystemFont, sans-serif";

type PreviewBg = "checker" | "cream" | "white" | "dark";

interface Props {
  imageUrl: string;
  initialRadius: number;
  initialTolerance: number;
  /** 4-char string "TRBL" з 0/1 (дефолт "1111" = всі 4 кути заокруглені).
   *  Якщо undefined — поведінка old-style "all corners". */
  initialCorners?: string;
  /** Якщо true — модалка відкривається одразу в режимі обрізання
   *  (для тригера ✂ з BlockItemHeader). */
  initialCropMode?: boolean;
  /** Cover-режим для обкладинки новини: ховає секцію заокруглення кутів
   *  (cover рендериться у фреймворк-обгортці з власним radius) і форсує
   *  crop aspect 16/9 щоб зберегти єдине співвідношення сторін. */
  coverMode?: boolean;
  onCancel: () => void;
  /** Якщо blob є — потрібно перезавантажити фото (картинка змінилася через crop або chroma).
   *  newAspect — новий aspect ratio після crop, потрібен для перерахунку висоти блока. */
  onSave: (changes: {
    imgRadius: number;
    tolerance: number;
    corners: string;
    blob?: Blob;
    newAspect?: number;
  }) => Promise<void> | void;
}

// Порядок кутів у CSS shorthand border-radius: TL TR BR BL.
type CornerKey = "tl" | "tr" | "br" | "bl";
const CORNER_ORDER: CornerKey[] = ["tl", "tr", "br", "bl"];

function parseCorners(s: string | undefined): Record<CornerKey, boolean> {
  const padded = (s || "1111").padEnd(4, "1");
  return {
    tl: padded[0] === "1",
    tr: padded[1] === "1",
    br: padded[2] === "1",
    bl: padded[3] === "1",
  };
}
function serializeCorners(c: Record<CornerKey, boolean>): string {
  return CORNER_ORDER.map(k => c[k] ? "1" : "0").join("");
}
/** Будує CSS shorthand `Apx Bpx Cpx Dpx` з radius + per-corner active map. */
export function buildCornerRadiusCss(radius: number, cornersStr: string | undefined): string {
  const c = parseCorners(cornersStr);
  return CORNER_ORDER.map(k => `${c[k] ? radius : 0}px`).join(" ");
}

export default function ImageStudioModal({
  imageUrl, initialRadius, initialTolerance, initialCorners, initialCropMode = false, coverMode = false, onCancel, onSave,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [radius, setRadius] = useState(initialRadius);
  const [tolerance, setTolerance] = useState(initialTolerance);
  const [corners, setCorners] = useState<Record<CornerKey, boolean>>(() => parseCorners(initialCorners));
  const cornerRadiusCss = buildCornerRadiusCss(radius, serializeCorners(corners));
  const toggleCorner = (k: CornerKey) => setCorners(prev => ({ ...prev, [k]: !prev[k] }));
  const [bg, setBg] = useState<PreviewBg>("cream");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [imgLoaded, setImgLoaded] = useState(false);
  // Zoom для preview (canvas + crop img). 1 = auto-fit до контейнера.
  // <1 — менше за fit, >1 — більше, з'являється скрол. Керується Ctrl+wheel.
  const [zoom, setZoom] = useState(1);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [containerW, setContainerW] = useState(0);

  // currentSrcUrl: реальне джерело для canvas/preview. Спочатку = imageUrl,
  // після обрізання → blob: object URL зі свіжо обрізаним зображенням.
  const [currentSrcUrl, setCurrentSrcUrl] = useState(imageUrl);
  const [srcChanged, setSrcChanged] = useState(false);

  // Crop mode стейт
  const [cropMode, setCropMode] = useState(initialCropMode);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceImgRef = useRef<HTMLImageElement | null>(null);
  const cropImgRef = useRef<HTMLImageElement | null>(null);
  const previewAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  // Заблокувати скрол body+html поки модалка відкрита. Без html (documentElement)
  // overflow:hidden браузер все одно скролить root-елемент, якщо в body є фокус
  // або preview-область пропускає wheel-event далі коли досягає своєї межі.
  useEffect(() => {
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || saving) return;
      // Esc у crop mode — вийти з crop mode (а не закрити всю модалку)
      if (cropMode) {
        setCropMode(false);
        setCrop(undefined);
        setCompletedCrop(null);
      } else {
        onCancel();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel, saving, cropMode]);

  // Cleanup створених object URL коли модалка закривається або джерело міняється.
  useEffect(() => {
    return () => {
      if (currentSrcUrl !== imageUrl && currentSrcUrl.startsWith("blob:")) {
        URL.revokeObjectURL(currentSrcUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Завантажити source-фото в offscreen Image коли currentSrcUrl міняється
  useEffect(() => {
    setImgLoaded(false);
    setNaturalSize(null);
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      sourceImgRef.current = img;
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
      setImgLoaded(true);
    };
    img.onerror = () => setError("Не вдалось завантажити фото (можливо, CORS)");
    img.src = currentSrcUrl;
  }, [currentSrcUrl]);

  // Виміряти ширину preview-контейнера (для розрахунку displayWidth).
  // Використовуємо ResizeObserver — викликається відразу при mount + щоразу
  // як контейнер змінює розмір (включно з першим layout після паркуру з null).
  useEffect(() => {
    if (!mounted) return;
    const el = previewAreaRef.current;
    if (!el) return;
    const measure = () => {
      const cs = getComputedStyle(el);
      const padL = parseFloat(cs.paddingLeft) || 0;
      const padR = parseFloat(cs.paddingRight) || 0;
      setContainerW(Math.max(0, el.clientWidth - padL - padR));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => { ro.disconnect(); };
  }, [mounted]);

  // Ctrl+wheel = zoom preview. React onWheel — passive listener, preventDefault не працює,
  // тому навішуємо native listener з { passive: false }. Без preventDefault Ctrl+wheel
  // зумить браузерну сторінку (типова поведінка), а нам треба перехопити.
  useEffect(() => {
    const el = previewAreaRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const direction = e.deltaY > 0 ? -1 : 1;
      const step = 0.1;
      setZoom((z) => Math.max(0.2, Math.min(4, +(z + direction * step).toFixed(2))));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [mounted]);

  // Перерендер canvas-у при зміні tolerance або після перезавантаження source.
  // У crop mode не рендеримо — там ReactCrop працює з сирим <img>.
  useEffect(() => {
    if (cropMode) return;
    const img = sourceImgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas || !imgLoaded) return;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    if (tolerance > 0) {
      try {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        const threshold = 255 - Math.max(0, Math.min(80, tolerance));
        for (let i = 0; i < data.length; i += 4) {
          if (data[i] >= threshold && data[i + 1] >= threshold && data[i + 2] >= threshold) {
            data[i + 3] = 0;
          }
        }
        ctx.putImageData(imgData, 0, 0);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Помилка обробки");
      }
    }
  }, [tolerance, imgLoaded, cropMode]);

  const enterCropMode = () => {
    setCropMode(true);
    setCrop(undefined);
    setCompletedCrop(null);
  };

  const cancelCrop = () => {
    setCropMode(false);
    setCrop(undefined);
    setCompletedCrop(null);
  };

  const applyCrop = async () => {
    if (!completedCrop || !cropImgRef.current) return;
    setError("");
    try {
      const img = cropImgRef.current;
      const scaleX = img.naturalWidth / img.width;
      const scaleY = img.naturalHeight / img.height;
      const naturalCrop = {
        x: completedCrop.x * scaleX,
        y: completedCrop.y * scaleY,
        width: completedCrop.width * scaleX,
        height: completedCrop.height * scaleY,
      };
      // Витягуємо crop у JPEG (без прозорості — chroma застосується пізніше у preview canvas).
      const blob = await cropImageToBlob(currentSrcUrl, naturalCrop, "image/jpeg", 0.95);
      const newUrl = URL.createObjectURL(blob);
      // Cleanup попереднього blob URL
      if (currentSrcUrl !== imageUrl && currentSrcUrl.startsWith("blob:")) {
        URL.revokeObjectURL(currentSrcUrl);
      }
      setCurrentSrcUrl(newUrl);
      setSrcChanged(true);
      setCropMode(false);
      setCrop(undefined);
      setCompletedCrop(null);
    } catch (e) {
      console.error("[ImageStudioModal] crop failed:", e);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      // Якщо ми зараз у crop-режимі і юзер натиснув Save — вийти з нього
      // без застосування crop. Юзер може застосувати crop окремою кнопкою.
      if (cropMode) {
        setCropMode(false);
      }

      const chromaChanged = tolerance > 0 && tolerance !== initialTolerance;
      const needsUpload = srcChanged || chromaChanged;

      const changes: {
        imgRadius: number; tolerance: number; corners: string; blob?: Blob; newAspect?: number;
      } = { imgRadius: radius, tolerance, corners: serializeCorners(corners) };

      if (needsUpload) {
        const img = sourceImgRef.current;
        const canvas = canvasRef.current;
        if (!img || !canvas) throw new Error("Зображення ще не завантажене");
        if (!img.naturalWidth || !img.naturalHeight) {
          throw new Error("Фото ще завантажується — зачекай 1с і повтори");
        }
        // Inline render canvas з актуальним tolerance — щоб не залежати від
        // canvas-render effect (він блокується у cropMode і може не встигнути
        // спрацювати після setCropMode(false) перед toBlob).
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas 2D недоступний");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        if (tolerance > 0) {
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imgData.data;
          const threshold = 255 - Math.max(0, Math.min(80, tolerance));
          for (let i = 0; i < data.length; i += 4) {
            if (data[i] >= threshold && data[i + 1] >= threshold && data[i + 2] >= threshold) {
              data[i + 3] = 0;
            }
          }
          ctx.putImageData(imgData, 0, 0);
        }
        // PNG якщо є прозорість (chroma), JPEG якщо тільки crop
        const useTransparency = tolerance > 0;
        const mime = useTransparency ? "image/png" : "image/jpeg";
        const quality = useTransparency ? undefined : 0.95;
        // Таймаут 15с на toBlob — на випадок якщо canvas tainted або зависло.
        const blob = await Promise.race([
          new Promise<Blob | null>((resolve) =>
            canvas.toBlob((b) => resolve(b), mime, quality),
          ),
          new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error("Генерація фото займає >15с — фото може бути занадто великим або canvas заблокований CORS")), 15000),
          ),
        ]);
        if (!blob) throw new Error("Не вдалось згенерувати фото (canvas може бути tainted через CORS)");
        changes.blob = blob;
        changes.newAspect = canvas.width / canvas.height;
      }
      // Таймаут 60с на onSave (включає upload до Cloudinary). Якщо щось зависає
      // на мережі/Cloudinary, через 60с показуємо помилку замість infinite "Збереження…".
      await Promise.race([
        Promise.resolve(onSave(changes)),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Збереження зайняло >60с — перевір з'єднання і спробуй ще раз")), 60000),
        ),
      ]);
    } catch (e) {
      console.error("[ImageStudioModal] save failed:", e);
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  if (!mounted) return null;

  const bgStyles: Record<PreviewBg, string> = {
    checker: "repeating-conic-gradient(#ECE3D2 0% 25%, #FAF6F0 0% 50%) 50% / 36px 36px",
    cream: "#FAF6F0",
    white: "#FFFFFF",
    dark: "#1a1a1a",
  };

  return createPortal(
    <div
      onWheel={(e) => e.stopPropagation()}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "#fff",
        display: "flex", flexDirection: "column",
        fontFamily: ff,
        overscrollBehavior: "contain",
      }}
    >
      {/* Header */}
      <div style={{
        padding: "14px 20px",
        borderBottom: "1px solid #E8D5B7",
        background: "#FAF6F0",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ fontSize: "15px", fontWeight: 700, color: "#1C3A2E", letterSpacing: "0.04em" }}>
          {cropMode ? "✂️ Обрізання фото" : "🖼 Редактор фото"}
        </div>
        <button
          onClick={onCancel}
          disabled={saving}
          style={{ background: "none", border: "none", cursor: saving ? "not-allowed" : "pointer", color: "#9CA3AF", fontSize: "20px", padding: "4px 8px", fontWeight: 600 }}
        >✕</button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
        {/* Preview area.
            ВАЖЛИВО: alignItems зміннний — у crop-режимі "flex-start" щоб ReactCrop
            міг працювати з повним розміром фото і скрол активувався при потребі.
            "safe center" — flexbox-кейс: при центрованому overflow без safe верх
            фото клипається й недоступний навіть зі скролом; safe → fallback на
            start якщо контент не вміщується. */}
        <div
          ref={previewAreaRef}
          style={{
            flex: 1,
            padding: "32px",
            display: "flex",
            alignItems: cropMode ? "flex-start" : "safe center",
            justifyContent: "safe center",
            background: cropMode ? "#1a1a1a" : bgStyles[bg],
            overflow: "auto",
            overscrollBehavior: "contain",
            minWidth: 0,
          }}>
          {!imgLoaded && !error && (
            <div style={{ fontSize: "13px", color: cropMode || bg === "dark" ? "#E8D5B7" : "#6B7280" }}>
              Завантаження...
            </div>
          )}
          {(() => {
            // displayWidth: ширина рендеру фото (canvas/img) у px.
            // baseFitW = найбільша ширина, що ВЛАЗИТЬ у контейнер (з урахуванням natural).
            // displayedW = baseFitW * zoom (zoom=1 → fit, >1 → overflow зі скролом).
            // Якщо containerW ще не виміряний — використовуємо natural width як fallback,
            // щоб ReactCrop не пропустив mount-у і drag працював одразу.
            if (!naturalSize) return null;
            const safeContainerW = containerW > 0 ? containerW : naturalSize.w;
            const baseFitW = Math.min(naturalSize.w, safeContainerW);
            const displayedW = Math.round(baseFitW * zoom);
            return (
              <>
                {/* Canvas preview (radius + chroma) */}
                <canvas
                  ref={canvasRef}
                  style={{
                    display: imgLoaded && !cropMode ? "block" : "none",
                    width: `${displayedW}px`,
                    height: "auto",
                    borderRadius: cornerRadiusCss,
                    boxShadow: bg === "dark" ? "0 4px 32px rgba(0,0,0,0.5)" : "0 4px 24px rgba(0,0,0,0.12)",
                  }}
                />
                {/* Crop mode: ReactCrop поверх <img>.
                    img отримує ту ж displayedW щоб ReactCrop overlay коректно
                    співпадав з реальним рендерним розміром. */}
                {cropMode && imgLoaded && (
                  <ReactCrop
                    crop={crop}
                    onChange={(_, percentCrop) => setCrop(percentCrop)}
                    onComplete={(c) => setCompletedCrop(c)}
                    ruleOfThirds
                    aspect={coverMode ? 16 / 9 : undefined}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      ref={cropImgRef}
                      src={currentSrcUrl}
                      alt="crop source"
                      crossOrigin="anonymous"
                      style={{
                        display: "block",
                        width: `${displayedW}px`,
                        height: "auto",
                        maxWidth: "none",
                      }}
                    />
                  </ReactCrop>
                )}
              </>
            );
          })()}
        </div>

        {/* Sidebar */}
        <div style={{
          width: "320px",
          borderLeft: "1px solid #E8D5B7",
          background: "#FFFFFF",
          overflow: "auto",
          flexShrink: 0,
        }}>
          {/* Crop section — завжди вгорі для зручного доступу */}
          <Section>
            <Label>Обрізання</Label>
            {!cropMode ? (
              <>
                <button
                  type="button"
                  onClick={enterCropMode}
                  disabled={!imgLoaded}
                  style={primaryBtn(!imgLoaded)}
                >✂️ Обрізати фото</button>
                {srcChanged && (
                  <div style={{ fontSize: "10px", color: "#059669", marginTop: "6px", lineHeight: 1.4 }}>
                    ✓ Обрізано — натисни &quot;Зберегти&quot; внизу щоб застосувати
                  </div>
                )}
              </>
            ) : (
              <>
                <div style={{ fontSize: "11px", color: "#6B7280", lineHeight: 1.5, marginBottom: "10px" }}>
                  Натисни і протягни мишею щоб виділити область. Esc — скасувати.
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    type="button"
                    onClick={cancelCrop}
                    style={secondaryBtn()}
                  >Скасувати</button>
                  <button
                    type="button"
                    onClick={applyCrop}
                    disabled={!completedCrop}
                    style={primaryBtn(!completedCrop)}
                  >Застосувати</button>
                </div>
              </>
            )}
          </Section>

          {/* Background switcher */}
          <Section>
            <Label>Фон попереднього перегляду</Label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px" }}>
              <BgBtn active={bg === "cream"} onClick={() => setBg("cream")} title="Кремовий (як сторінка новини)" style={{ background: bgStyles.cream }} />
              <BgBtn active={bg === "white"} onClick={() => setBg("white")} title="Білий" style={{ background: bgStyles.white }} />
              <BgBtn active={bg === "dark"} onClick={() => setBg("dark")} title="Темний" style={{ background: bgStyles.dark }} />
              <BgBtn active={bg === "checker"} onClick={() => setBg("checker")} title="Шахматка (видно прозорість)" style={{ background: bgStyles.checker }} />
            </div>
            <div style={{ fontSize: "10px", color: "#9CA3AF", lineHeight: 1.4, marginTop: "6px" }}>
              Кремовий = справжній фон сторінки новини
            </div>
          </Section>

          {/* Border radius — приховано у coverMode (cover має власну рамку у listing/page) */}
          {!coverMode && (
          <Section>
            <Label>Заокруглення кутів</Label>
            <div style={{ display: "flex", gap: "5px", marginBottom: "10px" }}>
              {[0, 8, 16, 24, 40, 80].map(v => {
                const active = radius === v;
                const previewR = Math.min(v, 14);
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setRadius(v)}
                    style={{
                      flex: 1, height: "30px",
                      border: `1.5px solid ${active ? "#D4A843" : "#E8D5B7"}`,
                      background: active ? "#1C3A2E" : "#FFFFFF",
                      borderRadius: `${previewR}px`,
                      cursor: "pointer", padding: 0,
                      fontSize: "11px",
                      color: active ? "#D4A843" : "#1C3A2E",
                      fontWeight: 600,
                      transition: "all 0.12s",
                    }}
                  >{v}</button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "12px" }}>
              <input
                type="range"
                min={0}
                max={120}
                step={1}
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                style={{ flex: 1, accentColor: "#D4A843" }}
              />
              <input
                type="text"
                inputMode="numeric"
                value={radius}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9]/g, "");
                  if (v === "") { setRadius(0); return; }
                  setRadius(Math.min(200, Number(v)));
                }}
                style={smallInput}
              />
              <span style={{ fontSize: "11px", color: "#9CA3AF" }}>px</span>
            </div>

            {/* Per-corner picker — компактний міні-прямокутник з 4 кутовими toggle-ами.
                Тицяй у круглу кнопку на куті щоб увімкнути/вимкнути заокруглення там. */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <CornerPicker
                corners={corners}
                radius={radius}
                onToggle={toggleCorner}
              />
              <div style={{ flex: 1, fontSize: "11px", color: "#6B7280", lineHeight: 1.4 }}>
                Натисни на круг біля кута щоб увімкнути або вимкнути заокруглення для нього окремо.
              </div>
            </div>
          </Section>
          )}

          {/* Chroma-key */}
          <Section>
            <Label>Прибрати білий фон</Label>
            <div style={{ fontSize: "11px", color: "#6B7280", lineHeight: 1.5, marginBottom: "10px" }}>
              Робить білі (та майже-білі) пікселі прозорими. Підходить для скрінів з заокругленими картками.
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "11px", color: "#6B7280", minWidth: "70px" }}>Чутливість</span>
              <input
                type="range"
                min={0}
                max={60}
                step={1}
                value={tolerance}
                onChange={(e) => setTolerance(Number(e.target.value))}
                style={{ flex: 1, accentColor: "#D4A843" }}
              />
              <input
                type="text"
                inputMode="numeric"
                value={tolerance}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9]/g, "");
                  if (v === "") { setTolerance(0); return; }
                  setTolerance(Math.min(80, Number(v)));
                }}
                style={smallInput}
              />
            </div>
            <div style={{ fontSize: "10px", color: "#9CA3AF", lineHeight: 1.4 }}>
              {tolerance === 0
                ? "Вимкнено (фото без змін)"
                : `Прозорим стає все, де RGB ≥ ${255 - tolerance}`}
            </div>
          </Section>

        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: "14px 20px",
        borderTop: "1px solid #E8D5B7",
        background: "#FAF6F0",
        display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px",
      }}>
        {/* Zoom indicator + reset (зліва) */}
        <div style={{ marginRight: "auto", display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "11px", color: "#9CA3AF" }}>
            Ctrl+колесо = масштаб preview
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.2, +(z - 0.1).toFixed(2)))}
              style={zoomBtn}
              title="Зменшити"
            >−</button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              style={{ ...zoomBtn, width: "52px", fontSize: "11px", fontWeight: 700 }}
              title="Скинути масштаб"
            >{Math.round(zoom * 100)}%</button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(4, +(z + 0.1).toFixed(2)))}
              style={zoomBtn}
              title="Збільшити"
            >+</button>
          </div>
        </div>
        {error && (
          <div style={{ fontSize: "12px", color: "#EF4444", fontWeight: 500 }}>
            {error}
          </div>
        )}
        <button
          onClick={onCancel}
          disabled={saving}
          style={{
            padding: "9px 18px", borderRadius: "8px",
            border: "1.5px solid #E8D5B7",
            background: "#FFFFFF", color: "#1C3A2E",
            fontSize: "13px", fontWeight: 600,
            cursor: saving ? "not-allowed" : "pointer",
            fontFamily: ff,
          }}
        >Скасувати</button>
        <button
          onClick={handleSave}
          disabled={saving || !imgLoaded}
          title={cropMode ? "Збереження без застосування обрізання" : ""}
          style={{
            padding: "9px 22px", borderRadius: "8px",
            border: "none",
            background: saving || !imgLoaded ? "rgba(28,58,46,0.5)" : "#1C3A2E",
            color: "#D4A843",
            fontSize: "13px", fontWeight: 700,
            cursor: saving || !imgLoaded ? "not-allowed" : "pointer",
            fontFamily: ff,
            display: "inline-flex", alignItems: "center", gap: "8px",
          }}
        >
          {saving ? (<>
            <span className="animate-spin" style={{ display: "inline-block", width: "11px", height: "11px", border: "2px solid #D4A843", borderTopColor: "transparent", borderRadius: "50%" }} />
            Збереження...
          </>) : "Зберегти"}
        </button>
      </div>
    </div>,
    document.body,
  );
}

const Section: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ padding: "14px 16px", borderBottom: "1px solid #F0E6D2" }}>{children}</div>
);

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    fontSize: "10px",
    fontWeight: 800,
    color: "#9B7C45",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    fontFamily: ff,
    marginBottom: "8px",
  }}>{children}</div>
);

function CornerPicker({
  corners, radius, onToggle,
}: {
  corners: Record<CornerKey, boolean>;
  radius: number;
  onToggle: (k: CornerKey) => void;
}) {
  // Live-preview прямокутник з border-radius що віддзеркалює стан кутів.
  // Радіус прев'ю обмежений 14px щоб не "з'їсти" увесь прямокутник на великих значеннях.
  const previewR = Math.min(radius, 14);
  const radiusCss = [
    corners.tl ? previewR : 0,
    corners.tr ? previewR : 0,
    corners.br ? previewR : 0,
    corners.bl ? previewR : 0,
  ].map(v => `${v}px`).join(" ");

  const positions: Record<CornerKey, React.CSSProperties> = {
    tl: { top: -7, left: -7 },
    tr: { top: -7, right: -7 },
    br: { bottom: -7, right: -7 },
    bl: { bottom: -7, left: -7 },
  };

  return (
    <div style={{ position: "relative", width: 78, height: 50, flexShrink: 0 }}>
      {/* Прев'ю прямокутник з live border-radius */}
      <div style={{
        position: "absolute",
        inset: 7,
        border: "2px solid rgba(28,58,46,0.45)",
        borderRadius: radiusCss,
        background: "rgba(212,168,67,0.08)",
        transition: "border-radius 0.15s",
      }} />
      {/* 4 круглі toggle-кнопки на кутах */}
      {CORNER_ORDER.map(k => {
        const active = corners[k];
        return (
          <button
            key={k}
            type="button"
            onClick={() => onToggle(k)}
            title={`${active ? "Вимкнути" : "Увімкнути"} заокруглення цього кута`}
            style={{
              position: "absolute",
              ...positions[k],
              width: 14,
              height: 14,
              borderRadius: "50%",
              border: `2px solid ${active ? "#D4A843" : "#9CA3AF"}`,
              background: active ? "#D4A843" : "#FFFFFF",
              cursor: "pointer",
              padding: 0,
              boxShadow: active ? "0 0 0 2px rgba(212,168,67,0.25)" : "none",
              transition: "all 0.12s",
            }}
          />
        );
      })}
    </div>
  );
}

function BgBtn({ active, onClick, title, style }: {
  active: boolean; onClick: () => void; title: string; style: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        height: "30px",
        borderRadius: "6px",
        border: `2px solid ${active ? "#D4A843" : "#E8D5B7"}`,
        cursor: "pointer", padding: 0,
        boxShadow: active ? "0 0 0 2px rgba(212,168,67,0.25)" : "none",
        ...style,
      }}
    />
  );
}

const smallInput: React.CSSProperties = {
  width: "52px", height: "26px",
  borderRadius: "6px",
  border: "1px solid #E8D5B7",
  background: "#FFFFFF",
  color: "#1C3A2E",
  fontSize: "12px",
  fontFamily: ff,
  textAlign: "center",
  padding: "0 4px",
  outline: "none",
  boxSizing: "border-box",
};

function primaryBtn(disabled = false): React.CSSProperties {
  return {
    flex: 1,
    height: "32px",
    borderRadius: "6px",
    border: "1px solid #D4A843",
    background: disabled ? "rgba(28,58,46,0.5)" : "#1C3A2E",
    color: "#D4A843",
    fontSize: "12px",
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: ff,
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px",
    width: "100%",
    letterSpacing: "0.04em",
  };
}

const zoomBtn: React.CSSProperties = {
  width: "26px", height: "26px",
  borderRadius: "5px",
  border: "1.5px solid #E8D5B7",
  background: "#FFFFFF",
  color: "#1C3A2E",
  fontSize: "13px", fontWeight: 600,
  cursor: "pointer", padding: 0,
  fontFamily: ff,
  display: "inline-flex", alignItems: "center", justifyContent: "center",
};

function secondaryBtn(): React.CSSProperties {
  return {
    flex: 1,
    height: "32px",
    borderRadius: "6px",
    border: "1.5px solid #E8D5B7",
    background: "#FFFFFF",
    color: "#1C3A2E",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: ff,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
  };
}
