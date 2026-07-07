"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { NewsMeta } from "../_components/editor/types";
import { TEMPLATE_PALETTE_BLOCKS } from "../_components/editor/BlockPalette";
import { bustNewsLibraryCache } from "../_components/editor/blocks/NewsCardEditor";

// Білдер сторінки /news. Reuses NewsEditor у режимі mode="page":
//  - права колонка — NewsLibrarySidebar (драг-картки опублікованих новин)
//  - drag-у на канвас створює newsCard блок з посиланням на конкретну новину
//  - блоки heading/text/image/divider/youtube/quote — для оформлення сторінки
const NewsEditor = dynamic(() => import("../_components/editor/NewsEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-[#D4A843] border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

const DEFAULT_PAGE_WIDTH = 920;
const MIN_PAGE_WIDTH = 850;
const MAX_PAGE_WIDTH = 1450;
// Видима ширина «папера» у білдері — завжди ця константа. Слайдер змінює логічну
// ширину сторінки (PAGE_WIDTH у EditorCanvas), а каркас «папера» у білдері
// тримає сталий розмір — блоки візуально стискаються при зростанні pageWidth
// (через CSS zoom = BUILDER_FRAME_W / pageWidth).
const BUILDER_FRAME_W = 920;

// Конвертуємо блоки між:
//   storage (БД, public-render): width/x в абсолютних пікселях;
//   builder math (EditorCanvas): width/x у % від PAGE_WIDTH=pageWidth.
// Heuristic для legacy %-даних: якщо у JSON-і немає жодного значення > 100 —
// вважаємо що це % і конвертуємо ×9.2 (тобто старе pageWidth=920) лише на load.
// Усі наступні save пишуть pixels.
function blocksDbToBuilder(rawJson: string, pageWidth: number): string {
  let blocks: Array<Record<string, unknown>> = [];
  try {
    const parsed = JSON.parse(rawJson || "[]");
    if (Array.isArray(parsed)) blocks = parsed;
  } catch { return rawJson; }
  if (blocks.length === 0) return rawJson;
  // Якщо найбільший width ≤ 100 — це legacy % формат (стара БД). Інакше — pixels.
  const maxW = Math.max(0, ...blocks.map(b => Number(b.width) || 0));
  const maxX = Math.max(0, ...blocks.map(b => Number(b.x) || 0));
  const isLegacyPct = maxW <= 100 && maxX <= 100;
  const out = blocks.map(b => {
    const wRaw = Number(b.width) || 0;
    const xRaw = typeof b.x === "number" ? b.x : 0;
    const wPct = isLegacyPct ? wRaw : (wRaw / pageWidth) * 100;
    const xPct = isLegacyPct ? xRaw : (xRaw / pageWidth) * 100;
    return {
      ...b,
      width: String(Math.round(wPct * 100) / 100),
      x: Math.round(xPct * 100) / 100,
    };
  });
  return JSON.stringify(out);
}

function blocksBuilderToDb(rawJson: string, pageWidth: number): string {
  let blocks: Array<Record<string, unknown>> = [];
  try {
    const parsed = JSON.parse(rawJson || "[]");
    if (Array.isArray(parsed)) blocks = parsed;
  } catch { return rawJson; }
  if (blocks.length === 0) return rawJson;
  const out = blocks.map(b => {
    const wPct = Number(b.width) || 0;
    const xPct = typeof b.x === "number" ? b.x : 0;
    return {
      ...b,
      width: String(Math.round((wPct / 100) * pageWidth)),
      x: Math.round((xPct / 100) * pageWidth),
    };
  });
  return JSON.stringify(out);
}

// Пресети ширини — як на топ-платформах (Notion/Substack/Medium).
// Менеджер кліком вибирає типовий розмір, слайдер — для точного тюнингу.
const WIDTH_PRESETS = [
  { label: "Вузька", value: 880 },
  { label: "Стандарт", value: 920 },
  { label: "Широка", value: 1100 },
  { label: "Повна", value: 1450 },
];

export default function NewsPageBuilder() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [initialMeta, setInitialMeta] = useState<Partial<NewsMeta>>({});
  const [initialContent, setInitialContent] = useState("");
  // Поточна ширина «папера» сторінки /news. Менеджер редагує інлайн у canvasLabel-у.
  const [pageWidth, setPageWidth] = useState<number>(DEFAULT_PAGE_WIDTH);

  // Header-hide логіка перенесена у NewsEditor (централізовано для всіх білдерів).

  // Повернулись із редактора контенту новини (?refresh=1) — скидаємо module-level
  // кеш бібліотеки, щоб newsCard-блоки перефетчили свіжі дані й одразу показали
  // щойно збережений контент (без 30s TTL-затримки). Робимо ДО mount блоків
  // (page ще у loading-стані), тож перший фетч блока вже піде за свіжими даними.
  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("refresh")) {
      bustNewsLibraryCache();
    }
  }, []);

  useEffect(() => {
    fetch("/api/admin/news/page-content")
      .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(d => {
        // Якщо запис ще не створено (null) — стартуємо з порожнього canvas.
        if (d) {
          setInitialMeta({
            title: "",
            slug: "",
            excerpt: "",
            category: "NEWS",
            imageUrl: "",
            pageBgColor: d.pageBgColor || "",
            published: true,
          });
          // Фільтруємо застарілі блоки newsList (видалений тип). Лишаємо тільки сучасні.
          let cleaned = d.content || "";
          try {
            const parsed = JSON.parse(d.content || "[]");
            if (Array.isArray(parsed)) {
              const filtered = parsed.filter((b: { type?: string }) => b?.type !== "newsList");
              cleaned = JSON.stringify(filtered);
            }
          } catch {
            /* not JSON — лишаємо як є */
          }
          const loadedPageWidth = typeof d.pageWidth === "number" && d.pageWidth > 0
            ? Math.max(MIN_PAGE_WIDTH, Math.min(MAX_PAGE_WIDTH, d.pageWidth))
            : DEFAULT_PAGE_WIDTH;
          setPageWidth(loadedPageWidth);
          // Конвертуємо блоки з px (БД) у % (builder math).
          setInitialContent(blocksDbToBuilder(cleaned, loadedPageWidth));
        } else {
          // Дефолт: пуста сторінка. Користувач починає з drag-карток з правого бару.
          setInitialMeta({ title: "", slug: "", excerpt: "", category: "NEWS", imageUrl: "", pageBgColor: "", published: true });
          setInitialContent("");
        }
        setLoading(false);
      })
      .catch(e => { setError("Помилка завантаження: " + e.message); setLoading(false); });
  }, []);

  const handleSave = async (meta: NewsMeta, content: string) => {
    setSaving(true);
    try {
      // Конвертуємо блоки з % (builder) у px (БД/site).
      const contentPx = blocksBuilderToDb(content, pageWidth);
      const res = await fetch("/api/admin/news/page-content", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: contentPx, pageBgColor: meta.pageBgColor || null, pageWidth }),
      });
      if (res.ok) return;
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error || `Помилка збереження (HTTP ${res.status})`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "256px" }}>
      <div style={{ width: "32px", height: "32px", borderWidth: "4px", borderStyle: "solid", borderColor: "#1C3A2E", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    </div>
  );

  if (error) return (
    <div style={{ padding: "24px" }}>
      <div style={{ background: "#FEF2F2", borderWidth: "1px", borderStyle: "solid", borderColor: "#FECACA", borderRadius: "12px", padding: "24px", color: "#DC2626" }}>{error}</div>
    </div>
  );

  // Сегментований контрол з пресетами (як у Notion/Substack) + слайдер для точного
  // налаштування. Активний пресет підсвічується amber-фоном; слайдер дозволяє
  // тонко скоригувати ширину в межах 850..1450.
  const widthLabel = (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        color: "#1C3A2E",
        textTransform: "none",
        letterSpacing: 0,
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: 2,
          background: "#F3F0E8",
          border: "1px solid #E5DEC9",
          borderRadius: 8,
          gap: 2,
        }}
      >
        {WIDTH_PRESETS.map(p => {
          const active = pageWidth === p.value;
          return (
            <button
              key={p.value}
              type="button"
              onClick={() => setPageWidth(p.value)}
              title={`${p.label} — ${p.value}px`}
              style={{
                appearance: "none",
                border: "none",
                cursor: "pointer",
                padding: "5px 10px",
                fontSize: 11,
                fontWeight: 700,
                fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
                color: active ? "#1C3A2E" : "#6B6760",
                background: active ? "#FFFFFF" : "transparent",
                boxShadow: active ? "0 1px 2px rgba(28,58,46,0.12)" : "none",
                borderRadius: 6,
                letterSpacing: 0,
                transition: "background 120ms ease, color 120ms ease",
              }}
            >
              {p.label}
            </button>
          );
        })}
      </span>
      <input
        type="range"
        min={MIN_PAGE_WIDTH}
        max={MAX_PAGE_WIDTH}
        step={10}
        value={pageWidth}
        onChange={e => setPageWidth(Number(e.target.value))}
        title={`Точна ширина: ${pageWidth}px`}
        style={{
          width: 110,
          accentColor: "#D4A843",
          cursor: "pointer",
        }}
      />
      <span
        style={{
          minWidth: 56,
          padding: "3px 8px",
          fontSize: 11,
          fontWeight: 700,
          fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
          color: "#1C3A2E",
          background: "#FFFFFF",
          border: "1px solid #E5DEC9",
          borderRadius: 6,
          textAlign: "center",
          letterSpacing: 0,
        }}
      >
        {pageWidth} px
      </span>
    </span>
  );

  return (
    <NewsEditor
      pageTitle={"Білдер Сторінки Події та Новини"}
      initialMeta={initialMeta}
      initialContent={initialContent}
      newsId="__news_page__"
      mode="page"
      onSave={handleSave}
      onBack={() => router.push("/dashboard/admin/news")}
      saving={saving}
      extraPaletteBlocks={TEMPLATE_PALETTE_BLOCKS}
      extraPaletteBlocksTitle="Спецблоки"
      // canvasWidth — логічна ширина сторінки (= pageWidth слайдера). У БД
      // зберігається ця ж величина і використовується на /news. displayBaseWidth
      // — видима ширина «папера» в білдері (константа 920); EditorCanvas через
      // CSS zoom стискає логічну ширину у фіксований 920-каркас, тож блоки
      // візуально зменшуються при зростанні pageWidth (зберігаючи свою реальну
      // ширину на сайті).
      canvasWidth={pageWidth}
      displayBaseWidth={BUILDER_FRAME_W}
      canvasLabel={{ left: "📄 Сторінка новини", right: widthLabel }}
    />
  );
}
