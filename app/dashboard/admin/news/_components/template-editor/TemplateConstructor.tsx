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
    { key: "v-3-4",     label: "3:4 mobile",   w: 360, h: 480 },
    { key: "v-2-3",     label: "2:3 стандарт", w: 400, h: 600 },
    { key: "v-9-16",    label: "9:16 story",   w: 360, h: 640 },
    { key: "v-9-16-xl", label: "9:16 hero",    w: 540, h: 960 },
  ],
  horizontal: [
    { key: "h-3-2-s",  label: "3:2 компакт",  w: 480,  h: 320 },
    { key: "h-3-2-m",  label: "3:2 стандарт", w: 600,  h: 400 },
    { key: "h-16-9",   label: "16:9 banner",  w: 800,  h: 450 },
    { key: "h-16-9-l", label: "16:9 large",   w: 960,  h: 540 },
    { key: "h-16-9-xl",label: "16:9 hero",    w: 1200, h: 675 },
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
  // Content mode (isContentMode=true): новина створена з шаблону, менеджер
  // НАПОВНЮЄ блоки контентом (inline editors замість placeholder-ів). Canvas
  // не змінюється (успадковує розмір шаблону). Default=false (blueprint design).
  isContentMode = false,
}: {
  newsId: string;
  templateKind: "ARTICLE" | "EVENT";
  initialTitle: string;
  initialSlug: string;
  initialBlocks: string;
  initialCanvas: { width: number; height: number };
  pageBgColor: string;
  isContentMode?: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Live-стан розмірів канвасу. Змінюється і через corner drag-handle (EditorCanvas),
  // і через інпути W/H у верхньому label-у. Зберігається debounce-нуто 600ms.
  const [canvasSize, setCanvasSize] = useState(initialCanvas);
  // Назва шаблону. Відображається в інпуті над палітрою. Шлеться окремим PATCH
  // debounce-нуто 600ms. Final Save переписує тим, що тут у стейті (а не
  // initialMeta.title, бо meta-сайдбар прихований).
  const [title, setTitle] = useState(initialTitle);

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

  // Debounced persist назви шаблону — окремий PATCH тільки `title`. Без 600ms
  // тиші кожна літера б давала запит. Лишається трекати окремо від canvas-у,
  // щоб два дебаунси не перебивали один одного.
  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistTitle = useCallback((next: string) => {
    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    titleTimerRef.current = setTimeout(() => {
      fetch(`/api/admin/news/${newsId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next }),
      }).catch(e => {
        setError(e instanceof Error ? e.message : "Помилка збереження назви");
      });
    }, 600);
  }, [newsId]);

  const handleTitleChange = useCallback((next: string) => {
    setTitle(next);
    persistTitle(next);
  }, [persistTitle]);

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
  }, []);

  // Header-hide логіка перенесена у NewsEditor (централізовано для всіх білдерів).

  const handleCanvasResize = useCallback((w: number, h: number) => {
    const c = clampCanvas(w, h);
    setCanvasSize(c);
    persistCanvasSize(c.width, c.height);
  }, [persistCanvasSize]);

  const handleSave = useCallback(
    async (_meta: NewsMeta, content: string, imageUrl: string) => {
      setSaving(true);
      setError("");
      // Скасовуємо pending debounced title PATCH — final Save все одно його перепише.
      if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
      try {
        const res = await fetch(`/api/admin/news/${newsId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            // Шаблон: title беремо з нашого окремого input-у над палітрою
            // (meta-сайдбар прихований, тож meta.title — застаріле initialTitle).
            // slug/excerpt/published — не торкаємо (це не публікаційні поля
            // для blueprint-ів). templateBlocks — нове block-based body.
            // templateCanvas — розмір canvas-у "WxH" з поточного state.
            title,
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
    [newsId, canvasSize, title]
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
        pageTitle={isContentMode ? "Новина" : "Шаблон"}
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
        // У content-mode templateMode=false: блоки рендеряться з inline-редакторами
        // (текст, фото, цитати — можна правити прямо на canvas-і). У blueprint-mode
        // templateMode=true: лише плейсхолдери-мітки (дизайн структури).
        templateMode={!isContentMode}
        // У content-mode layout заморожений: drag і resize вимкнено, менеджер
        // тільки наповнює існуючі блоки контентом.
        lockLayout={isContentMode}
        onCanvasResize={isContentMode ? undefined : handleCanvasResize}
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
        abovePaletteSlot={
          <TemplateNameInput value={title} onChange={handleTitleChange} />
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
    width: 62,
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.14)",
    borderRadius: 8,
    color: "#0F172A",
    fontSize: 12.5,
    fontWeight: 600,
    letterSpacing: "0.01em",
    textAlign: "center",
    padding: "6px 8px",
    fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
    outline: "none",
    fontVariantNumeric: "tabular-nums",
    boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
  };

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "#94A3B8", fontSize: 12 }}>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
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
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
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
      <span style={{ color: "#94A3B8", fontSize: 11, fontWeight: 500, letterSpacing: "0.04em" }}>px</span>
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
        background: "#F8FAFC",
        borderRadius: 14,
        padding: "8px 12px",
        height: 52,
        display: "inline-flex",
        alignItems: "center",
        gap: 14,
        border: "1px solid rgba(15,23,42,0.08)",
        fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <PresetGroupHorizontal
        title="Горизонтальні"
        presets={CANVAS_PRESETS.horizontal}
        width={width}
        height={height}
        onPick={onPick}
      />

      <div style={{
        width: 1,
        alignSelf: "stretch",
        background: "rgba(15,23,42,0.08)",
        margin: "6px 0",
      }} />

      <div style={{ flexShrink: 0 }}>
        <CanvasSizeInputs width={width} height={height} onChange={onChangeSize} />
      </div>
    </div>
  );
}

// Вертикальна колонка пресет-форм — тонка смужка ВЗДОВЖ ЛІВОГО КРАЮ канвасу.
// Висота розтягується на висоту канвасу (через alignItems: stretch у обгортці).
// Усі тексти всередині — вертикальні (writingMode), щоб смужка лишалась тонкою.
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
        background: "#F8FAFC",
        borderRadius: 14,
        padding: "12px 8px",
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: 8,
        border: "1px solid rgba(15,23,42,0.08)",
        fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
        width: 52,
        height: "100%",
      }}
    >
      {/* Лейбл «Вертикальні» — вертикальний (читання знизу-вгору). */}
      <div style={{
        fontSize: 11,
        fontWeight: 600,
        color: "#475569",
        letterSpacing: "0.02em",
        writingMode: "vertical-rl",
        transform: "rotate(180deg)",
        textAlign: "center",
        alignSelf: "center",
        lineHeight: 1,
        paddingBottom: 6,
      }}>Вертикальні</div>
      <div style={{
        height: 1,
        alignSelf: "stretch",
        background: "rgba(15,23,42,0.08)",
      }} />
      {/* Картки заповнюють лишок висоти рівномірно (flex:1). Текст dims у кожній —
          вертикальний, як і header. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minHeight: 0 }}>
        {CANVAS_PRESETS.vertical.map(p => (
          <VerticalPresetCard
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

// Card для тонкої вертикальної смужки: thumb-портрет зверху, dims обернені
// на 90° знизу. Сама картка flex:1 — три картки рівномірно ділять висоту.
function VerticalPresetCard({
  preset, active, onPick,
}: {
  preset: CanvasPreset;
  active: boolean;
  onPick: (w: number, h: number) => void;
}) {
  const [hov, setHov] = useState(false);
  const BBOX_W = 22;
  const BBOX_H = 28;
  const aspect = preset.w / preset.h;
  const thumbW = Math.round(BBOX_H * aspect);
  const thumbH = BBOX_H;
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
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: "8px 4px",
        background: active ? "#FEF3C7" : hov ? "#FFFFFF" : "#FFFFFF",
        border: `1px solid ${active ? "#D4A843" : hov ? "rgba(15,23,42,0.18)" : "rgba(15,23,42,0.10)"}`,
        borderRadius: 10,
        cursor: "pointer",
        transition: "all 0.15s",
        fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
        flex: 1,
        minHeight: 0,
        boxShadow: active ? "0 1px 3px rgba(212,168,67,0.18)" : "0 1px 2px rgba(15,23,42,0.04)",
      }}
    >
      <div style={{
        width: BBOX_W,
        height: BBOX_H,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}>
        <div style={{
          width: thumbW,
          height: thumbH,
          border: `1.5px solid ${active ? "#A47A28" : "#94A3B8"}`,
          borderRadius: 3,
          background: active ? "#D4A843" : "#CBD5E1",
          transition: "all 0.15s",
        }} />
      </div>
      <div style={{
        fontSize: 10.5,
        fontWeight: 600,
        color: active ? "#78350F" : "#334155",
        letterSpacing: "0.01em",
        lineHeight: 1,
        fontVariantNumeric: "tabular-nums",
        writingMode: "vertical-rl",
        transform: "rotate(180deg)",
        whiteSpace: "nowrap",
      }}>{preset.w}×{preset.h}</div>
    </button>
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
    <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
      <div style={{
        fontSize: 13,
        fontWeight: 600,
        color: "#475569",
        letterSpacing: "0.01em",
        flexShrink: 0,
        writingMode: "horizontal-tb",
      }}>{title}</div>
      <div style={{ display: "flex", gap: 6, flex: 1, minWidth: 0 }}>
        {presets.map(p => (
          <PresetCard
            key={p.key}
            preset={p}
            active={width === p.w && height === p.h}
            onPick={onPick}
            stretch
          />
        ))}
      </div>
    </div>
  );
}

// Інпут «Назва шаблону» над лівою палітрою. Source of truth для title шаблону:
// meta-сайдбар прихований у template-режимі, тож звичайний title-input недоступний.
// Зміни одразу оновлюють локальний state у TemplateConstructor; реальний PATCH
// летить debounce-нуто 600ms (керує TemplateConstructor).
function TemplateNameInput({
  value, onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div
      style={{
        background: "linear-gradient(180deg, #162C25 0%, #0F2019 100%)",
        borderRadius: 10,
        padding: "10px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06), 0 4px 16px rgba(0,0,0,0.12)",
        fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <label
        htmlFor="template-name-input"
        style={{
          fontSize: 8.5,
          fontWeight: 700,
          color: "rgba(212,168,67,0.55)",
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          lineHeight: 1,
        }}
      >
        Назва шаблону
      </label>
      <input
        id="template-name-input"
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Подія / Фахівець"
        style={{
          background: "rgba(0,0,0,0.25)",
          border: `1px solid ${focused ? "#D4A843" : "rgba(212,168,67,0.25)"}`,
          borderRadius: 7,
          color: "#F4E7C7",
          fontSize: 13,
          fontWeight: 600,
          padding: "8px 10px",
          outline: "none",
          fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
          transition: "border-color 0.15s",
          width: "100%",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}

function PresetCard({
  preset, active, onPick, stretch = false,
}: {
  preset: CanvasPreset;
  active: boolean;
  onPick: (w: number, h: number) => void;
  /** Чи розтягувати картку по доступному простору батьківського ряду
   *  (true у горизонтальному барі — 3 карти ділять width рівномірно).
   *  У вертикальному стаку — false, картки auto-sized по контенту. */
  stretch?: boolean;
}) {
  const [hov, setHov] = useState(false);
  // Компактна мініатюра: BBOX 22×22, thumb малюється по аспекту.
  const BBOX = 22;
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
        padding: "6px 12px 6px 10px",
        background: active ? "#FEF3C7" : "#FFFFFF",
        border: `1px solid ${active ? "#D4A843" : hov ? "rgba(15,23,42,0.18)" : "rgba(15,23,42,0.10)"}`,
        borderRadius: 999,
        cursor: "pointer",
        transition: "all 0.15s",
        fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
        flex: stretch ? "1 1 0" : "0 0 auto",
        minWidth: 0,
        boxShadow: active ? "0 1px 3px rgba(212,168,67,0.18)" : "0 1px 2px rgba(15,23,42,0.04)",
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
          border: `1.5px solid ${active ? "#A47A28" : "#94A3B8"}`,
          borderRadius: 3,
          background: active ? "#D4A843" : "#CBD5E1",
          transition: "all 0.15s",
        }} />
      </div>
      <div style={{
        fontSize: 12,
        fontWeight: 600,
        color: active ? "#78350F" : "#334155",
        letterSpacing: "0.01em",
        lineHeight: 1.1,
        whiteSpace: "nowrap",
        fontVariantNumeric: "tabular-nums",
      }}>{preset.w}×{preset.h}</div>
    </button>
  );
}
