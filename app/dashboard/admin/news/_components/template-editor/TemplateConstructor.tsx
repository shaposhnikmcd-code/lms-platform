"use client";

// Template Constructor — Webflow/Notion-like block-based template editor.
//
// Архітектура: оборотна обгортка над NewsEditor:
//   - canvas: 600×400 (EVENT) або 360×400 (ARTICLE), fixedHeight
//   - palette: PALETTE_BLOCKS (універсальні) + TEMPLATE_PALETTE_BLOCKS (структуровані
//     слоти типу Імʼя фахівця / Tagline / Вартість)
//   - meta sidebar прихований — шаблон редагує дизайн, не вміст конкретної новини
//   - збереження: PATCH /api/admin/news/[id] з полями templateBlocks (JSON) +
//     templateCanvas ("WxH"). Старі поля templateData/title/slug не торкаємо
//     (для backward compat і коректного listing-у на /dashboard/admin/news).
//
// Public render: EventTemplate/ArticleTemplate перевіряють наявність
// templateBlocks; якщо є — рендерять AbsoluteBlockRender у рамках canvas-у,
// інакше fallback на legacy EventData/ArticleData (Session 4 додає цей шлях).

import dynamic from "next/dynamic";
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { NewsMeta } from "../editor/types";
import { TEMPLATE_PALETTE_BLOCKS } from "../editor/BlockPalette";

// Межі ресайзу канвасу шаблону. Min — щоб блоки могли вміститись; max —
// щоб шаблон не виходив за реалістичні розміри картки на сторінці /news.
const CANVAS_MIN_W = 240;
const CANVAS_MAX_W = 1200;
const CANVAS_MIN_H = 200;
const CANVAS_MAX_H = 1600;
const CANVAS_SNAP = 8;

// Пресет-форми канвасу. Менеджер обирає в правій панелі — миттєвий resize.
// Можна одразу підкручувати інпутами або drag-handle після вибору пресету.
type CanvasPreset = { key: string; label: string; w: number; h: number };
const CANVAS_PRESETS: { vertical: CanvasPreset[]; horizontal: CanvasPreset[] } = {
  vertical: [
    { key: "v-3-4",  label: "3:4 mobile",  w: 360, h: 480 },
    { key: "v-2-3",  label: "2:3 стандарт", w: 400, h: 600 },
    { key: "v-9-16", label: "9:16 story",  w: 360, h: 640 },
  ],
  horizontal: [
    { key: "h-3-2-s", label: "3:2 компакт",   w: 480, h: 320 },
    { key: "h-3-2-m", label: "3:2 стандарт",  w: 600, h: 400 },
    { key: "h-16-9",  label: "16:9 banner",   w: 800, h: 450 },
  ],
};

function clampCanvas(w: number, h: number) {
  const snapW = Math.round(w / CANVAS_SNAP) * CANVAS_SNAP;
  const snapH = Math.round(h / CANVAS_SNAP) * CANVAS_SNAP;
  return {
    width: Math.max(CANVAS_MIN_W, Math.min(CANVAS_MAX_W, snapW)),
    height: Math.max(CANVAS_MIN_H, Math.min(CANVAS_MAX_H, snapH)),
  };
}

const NewsEditor = dynamic(() => import("../editor/NewsEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-[#D4A843] border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

// Дефолтні розміри canvas-у залежно від templateKind.
function defaultCanvasFor(kind: "ARTICLE" | "EVENT"): { width: number; height: number } {
  return kind === "EVENT" ? { width: 600, height: 400 } : { width: 360, height: 400 };
}

// Парсимо "600x400" → { width, height }. Fallback на default-и якщо рядок невалідний.
function parseTemplateCanvas(raw: string | null | undefined, kind: "ARTICLE" | "EVENT"): { width: number; height: number } {
  if (!raw) return defaultCanvasFor(kind);
  const m = raw.match(/^(\d+)x(\d+)$/);
  if (!m) return defaultCanvasFor(kind);
  const width = Number(m[1]);
  const height = Number(m[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 60 || height < 60) {
    return defaultCanvasFor(kind);
  }
  return { width, height };
}

export default function TemplateConstructor({
  newsId,
  templateKind,
  initialTitle,
  initialSlug,
  initialBlocks,
  initialCanvas,
  pageBgColor,
}: {
  newsId: string;
  templateKind: "ARTICLE" | "EVENT";
  initialTitle: string;
  initialSlug: string;
  initialBlocks: string;
  initialCanvas: { width: number; height: number };
  pageBgColor: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Live-стан розмірів канвасу. Змінюється і через corner drag-handle (EditorCanvas),
  // і через інпути W/H у верхньому label-у. Зберігається debounce-нуто 600ms.
  const [canvasSize, setCanvasSize] = useState(initialCanvas);

  const onBack = useCallback(() => router.push("/dashboard/admin/news"), [router]);

  // Debounced persist розміру канвасу — окремий PATCH тільки `templateCanvas`.
  // Запит шлеться лише через 600ms тиші, щоб live drag не спамив сервер.
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistCanvasSize = useCallback((w: number, h: number) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      fetch(`/api/admin/news/${newsId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateCanvas: `${w}x${h}` }),
      }).catch(e => {
        setError(e instanceof Error ? e.message : "Помилка збереження розміру");
      });
    }, 600);
  }, [newsId]);

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
  }, []);

  // Ховаємо глобальний "UIMP Dashboard" header у білдері шаблону — він займає
  // 64px зверху і не потрібен у full-screen editor-режимі. Відновлюємо при
  // unmount, щоб інші /dashboard/* сторінки бачили хедер як зазвичай.
  useEffect(() => {
    const header = document.querySelector<HTMLElement>("header.sticky.z-30");
    if (!header) return;
    const prevDisplay = header.style.display;
    header.style.display = "none";
    return () => { header.style.display = prevDisplay; };
  }, []);

  const handleCanvasResize = useCallback((w: number, h: number) => {
    const c = clampCanvas(w, h);
    setCanvasSize(c);
    persistCanvasSize(c.width, c.height);
  }, [persistCanvasSize]);

  const handleSave = useCallback(
    async (meta: NewsMeta, content: string, imageUrl: string) => {
      setSaving(true);
      setError("");
      try {
        const res = await fetch(`/api/admin/news/${newsId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            // Шаблон: title зберігаємо (для listing-у на /dashboard/admin/news),
            // але slug/excerpt/published — не торкаємо (це не публікаційні поля
            // для blueprint-ів). templateBlocks — нове block-based body.
            // templateCanvas — розмір canvas-у "WxH" з поточного state.
            title: meta.title,
            imageUrl,
            templateBlocks: content,
            templateCanvas: `${canvasSize.width}x${canvasSize.height}`,
          }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error || `HTTP ${res.status}`);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Помилка збереження");
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [newsId, canvasSize]
  );

  return (
    <>
      {error && (
        <div
          style={{
            position: "fixed",
            top: 80,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 50,
            padding: "10px 16px",
            background: "#B91C1C",
            color: "#FFFFFF",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
          }}
          role="alert"
        >
          {error}
        </div>
      )}
      <NewsEditor
        pageTitle={`Шаблон · ${templateKind === "EVENT" ? "Подія / Фахівець" : "Стаття / Огляд"}`}
        newsId={newsId}
        onBack={onBack}
        saving={saving}
        mode="preview"
        metaSidebar={false}
        hideMetaSidebar
        canvasWidth={canvasSize.width}
        minCanvasHeight={canvasSize.height}
        fixedHeight
        // У template-режимі canvasLabel НЕ передаємо — все винесене в єдиний
        // canvasTopToolbar (label + presets + inputs одним темним рядом).
        bottomSlack={0}
        extraPaletteBlocks={TEMPLATE_PALETTE_BLOCKS}
        extraPaletteBlocksTitle="Спецблоки"
        templateMode
        onCanvasResize={handleCanvasResize}
        canvasMinWidth={CANVAS_MIN_W}
        canvasMaxWidth={CANVAS_MAX_W}
        canvasMinHeight={CANVAS_MIN_H}
        canvasMaxHeight={CANVAS_MAX_H}
        canvasTopToolbar={
          <CanvasHorizontalPresetsBar
            width={canvasSize.width}
            height={canvasSize.height}
            onPick={handleCanvasResize}
            onChangeSize={handleCanvasResize}
          />
        }
        canvasLeftToolbar={
          <CanvasVerticalPresetsColumn
            width={canvasSize.width}
            height={canvasSize.height}
            onPick={handleCanvasResize}
          />
        }
        initialMeta={{
          title: initialTitle,
          slug: initialSlug,
          excerpt: "",
          category: templateKind === "EVENT" ? "EVENT" : "ARTICLE",
          imageUrl: "",
          pageBgColor,
          published: false,
        }}
        initialContent={initialBlocks}
        onSave={handleSave}
      />
    </>
  );
}

// Інлайн-інпути для точної зміни ширини/висоти канвасу шаблону.
// Розташовуються справа у label-смужці канвасу замість статичного "WxH px".
// onChange викликається ТІЛЬКИ після blur/Enter (а не на кожен keystroke) —
// так менеджер може допечатати ціле число, не пострибує канвас на пів-цифри.
function CanvasSizeInputs({
  width, height,
  onChange,
}: {
  width: number;
  height: number;
  onChange: (w: number, h: number) => void;
}) {
  const [draftW, setDraftW] = useState(String(width));
  const [draftH, setDraftH] = useState(String(height));

  // Якщо ширина/висота прийшли ззовні (drag-handle підкрутив) — синхронізуємо.
  useEffect(() => { setDraftW(String(width)); }, [width]);
  useEffect(() => { setDraftH(String(height)); }, [height]);

  const commit = (axis: "w" | "h", raw: string) => {
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n)) {
      // Невалідний ввід — повертаємо попереднє.
      if (axis === "w") setDraftW(String(width));
      else setDraftH(String(height));
      return;
    }
    if (axis === "w") onChange(n, height);
    else onChange(width, n);
  };

  const inputStyle: React.CSSProperties = {
    width: 56,
    background: "rgba(212,168,67,0.08)",
    border: "1px solid rgba(212,168,67,0.25)",
    borderRadius: 6,
    color: "#D4A843",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.04em",
    textAlign: "center",
    padding: "4px 6px",
    fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
    outline: "none",
  };

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#D4A843" }}>
      <input
        type="number"
        value={draftW}
        onChange={e => setDraftW(e.target.value)}
        onBlur={e => commit("w", e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") { setDraftW(String(width)); (e.target as HTMLInputElement).blur(); }
        }}
        min={CANVAS_MIN_W}
        max={CANVAS_MAX_W}
        step={CANVAS_SNAP}
        aria-label="Ширина канвасу, px"
        style={inputStyle}
      />
      <span style={{ opacity: 0.6 }}>×</span>
      <input
        type="number"
        value={draftH}
        onChange={e => setDraftH(e.target.value)}
        onBlur={e => commit("h", e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") { setDraftH(String(height)); (e.target as HTMLInputElement).blur(); }
        }}
        min={CANVAS_MIN_H}
        max={CANVAS_MAX_H}
        step={CANVAS_SNAP}
        aria-label="Висота канвасу, px"
        style={inputStyle}
      />
      <span style={{ opacity: 0.6, fontSize: 10 }}>PX</span>
    </span>
  );
}

// Горизонтальна смужка над канвасом: горизонтальні пресет-форми + W×H інпути.
// Вертикальні пресети винесені в окрему ліву колонку (CanvasVerticalPresetsColumn).
function CanvasHorizontalPresetsBar({
  width, height, onPick, onChangeSize,
}: {
  width: number;
  height: number;
  onPick: (w: number, h: number) => void;
  onChangeSize: (w: number, h: number) => void;
}) {
  return (
    <div
      style={{
        background: "linear-gradient(180deg, #162C25 0%, #0F2019 100%)",
        borderRadius: 10,
        padding: "8px 12px",
        display: "inline-flex",
        alignItems: "center",
        gap: 14,
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06), 0 4px 16px rgba(0,0,0,0.12)",
        fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <PresetGroupHorizontal
        title="Горизонт."
        presets={CANVAS_PRESETS.horizontal}
        width={width}
        height={height}
        onPick={onPick}
      />

      <div style={{
        width: 1,
        alignSelf: "stretch",
        background: "rgba(255,255,255,0.08)",
        margin: "2px 0",
      }} />

      <div style={{ flexShrink: 0 }}>
        <CanvasSizeInputs width={width} height={height} onChange={onChangeSize} />
      </div>
    </div>
  );
}

// Вертикальна колонка пресет-форм — ліворуч від канвасу. Стак з 3 карточок.
function CanvasVerticalPresetsColumn({
  width, height, onPick,
}: {
  width: number;
  height: number;
  onPick: (w: number, h: number) => void;
}) {
  return (
    <div
      style={{
        background: "linear-gradient(180deg, #162C25 0%, #0F2019 100%)",
        borderRadius: 10,
        padding: "10px 8px",
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: 8,
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06), 0 4px 16px rgba(0,0,0,0.12)",
        fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
        width: 92,
      }}
    >
      <div style={{
        fontSize: 8.5,
        fontWeight: 700,
        color: "rgba(212,168,67,0.55)",
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        textAlign: "center",
        lineHeight: 1,
        marginBottom: 2,
      }}>{"Вертик."}</div>
      {CANVAS_PRESETS.vertical.map(p => (
        <PresetCard
          key={p.key}
          preset={p}
          active={width === p.w && height === p.h}
          onPick={onPick}
        />
      ))}
    </div>
  );
}

function PresetGroupHorizontal({
  title, presets, width, height, onPick,
}: {
  title: string;
  presets: CanvasPreset[];
  width: number;
  height: number;
  onPick: (w: number, h: number) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
      <div style={{
        fontSize: 8.5,
        fontWeight: 700,
        color: "rgba(212,168,67,0.55)",
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        flexShrink: 0,
        writingMode: "horizontal-tb",
      }}>{title}</div>
      <div style={{ display: "flex", gap: 5, flex: 1, minWidth: 0 }}>
        {presets.map(p => (
          <PresetCard
            key={p.key}
            preset={p}
            active={width === p.w && height === p.h}
            onPick={onPick}
          />
        ))}
      </div>
    </div>
  );
}

function PresetCard({
  preset, active, onPick,
}: {
  preset: CanvasPreset;
  active: boolean;
  onPick: (w: number, h: number) => void;
}) {
  const [hov, setHov] = useState(false);
  // Розрахунок мініатюри: фіксований bounding-box. Більша сторона = BBOX,
  // менша — пропорційно. Так горизонтальні пресети не виглядають тонкими,
  // а вертикальні не вибиваються по висоті.
  const BBOX = 30;
  const ratio = preset.w / preset.h;
  const thumbW = ratio >= 1 ? BBOX : Math.round(BBOX * ratio);
  const thumbH = ratio >= 1 ? Math.round(BBOX / ratio) : BBOX;
  return (
    <button
      type="button"
      onClick={() => onPick(preset.w, preset.h)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={`${preset.label} · ${preset.w}×${preset.h}`}
      aria-label={`${preset.label}, ${preset.w} на ${preset.h} пікселів`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "5px 9px 5px 7px",
        background: active ? "rgba(212,168,67,0.14)" : hov ? "rgba(255,255,255,0.04)" : "transparent",
        border: `1px solid ${active ? "#D4A843" : hov ? "rgba(212,168,67,0.25)" : "rgba(255,255,255,0.05)"}`,
        borderRadius: 7,
        cursor: "pointer",
        transition: "all 0.15s",
        fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
        flex: "1 1 0",
        minWidth: 0,
      }}
    >
      <div style={{
        width: BBOX,
        height: BBOX,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}>
        <div style={{
          width: thumbW,
          height: thumbH,
          border: `1.5px ${active ? "solid" : "dashed"} ${active ? "#D4A843" : "rgba(212,168,67,0.55)"}`,
          borderRadius: 2,
          background: active ? "rgba(212,168,67,0.10)" : "transparent",
          transition: "all 0.15s",
        }} />
      </div>
      <div style={{
        fontSize: 9.5,
        fontWeight: 700,
        color: active ? "#D4A843" : "rgba(255,255,255,0.6)",
        letterSpacing: "0.02em",
        lineHeight: 1.1,
        whiteSpace: "nowrap",
      }}>{preset.w}×{preset.h}</div>
    </button>
  );
}
