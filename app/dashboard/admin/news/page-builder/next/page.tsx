"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { NewsMeta } from "../../_components/editor/types";
import { TEMPLATE_PALETTE_BLOCKS } from "../../_components/editor/BlockPalette";

// Білдер "Наступної сторінки" /news. Працює з staged-копією (next* поля
// NewsPage). При відкритті — якщо staged ще нема, /api/admin/news/page-content/next
// віддає live як стартовий стан, щоб менеджер міг внести точкові правки замість
// верстати з нуля. При збереженні зберігається у staged + `nextPublishAt`
// (06:00 Київ обраного дня в UTC). Cron `/api/cron/news-publish` щоранку
// (04:00 UTC = 06:00–07:00 Київ) робить swap; read-time auto-publish
// в `app/[locale]/news/page.tsx` лишається як safety-net.
//
// Функціонально ідентичний до /page-builder (live): ті самі спецблоки, той самий
// слайдер ширини, та сама px↔% конвертація. Різниця тільки в endpoint-і збереження
// (next* поля замість content) і у заголовку.

const NewsEditor = dynamic(() => import("../../_components/editor/NewsEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-[#D4A843] border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

const ff = "-apple-system, BlinkMacSystemFont, sans-serif";

const DEFAULT_PAGE_WIDTH = 920;
const MIN_PAGE_WIDTH = 850;
const MAX_PAGE_WIDTH = 1450;
const BUILDER_FRAME_W = 920;

// Конвертація блоків між storage (px) і builder math (%). Реліз-копія з
// /page-builder/page.tsx — щоб обидва білдери поводились однаково.
function blocksDbToBuilder(rawJson: string, pageWidth: number): string {
  let blocks: Array<Record<string, unknown>> = [];
  try {
    const parsed = JSON.parse(rawJson || "[]");
    if (Array.isArray(parsed)) blocks = parsed;
  } catch { return rawJson; }
  if (blocks.length === 0) return rawJson;
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

const WIDTH_PRESETS = [
  { label: "Вузька", value: 880 },
  { label: "Стандарт", value: 920 },
  { label: "Широка", value: 1100 },
  { label: "Повна", value: 1450 },
];

export default function NewsPageBuilderNext() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [initialMeta, setInitialMeta] = useState<Partial<NewsMeta>>({});
  const [initialContent, setInitialContent] = useState("");
  const [pageWidth, setPageWidth] = useState<number>(DEFAULT_PAGE_WIDTH);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);

  useEffect(() => {
    fetch("/api/admin/news/page-content/next")
      .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(d => {
        if (d) {
          // Сервер — джерело правди. Якщо staged-чернетки нема (щойно очищено
          // або ще ніколи не створювали) — будь-який осиротілий localStorage-draft
          // NewsEditor-а вважаємо невалідним і видаляємо. Інакше editor restore-ить
          // його поверх порожнього API-payload, і канвас не буде чистим.
          if (!d.hasStaged) {
            try { localStorage.removeItem('uimp_draft_page___news_page_next__'); } catch { /* ignore */ }
          }
          setInitialMeta({
            title: "", slug: "", excerpt: "", category: "NEWS", imageUrl: "",
            pageBgColor: d.pageBgColor || "",
            published: true,
          });
          // Очистка legacy newsList.
          let cleaned = d.content || "";
          try {
            const parsed = JSON.parse(d.content || "[]");
            if (Array.isArray(parsed)) {
              const filtered = parsed.filter((b: { type?: string }) => b?.type !== "newsList");
              cleaned = JSON.stringify(filtered);
            }
          } catch {/* not JSON */}
          const loadedPageWidth = typeof d.pageWidth === "number" && d.pageWidth > 0
            ? Math.max(MIN_PAGE_WIDTH, Math.min(MAX_PAGE_WIDTH, d.pageWidth))
            : DEFAULT_PAGE_WIDTH;
          setPageWidth(loadedPageWidth);
          // Конвертуємо блоки з px (БД) у % (builder math) — той самий шлях, що live-білдер.
          setInitialContent(blocksDbToBuilder(cleaned, loadedPageWidth));
        } else {
          setInitialMeta({ title: "", slug: "", excerpt: "", category: "NEWS", imageUrl: "", pageBgColor: "", published: true });
          setInitialContent("");
        }
        setLoading(false);
      })
      .catch(e => { setError("Помилка завантаження: " + e.message); setLoading(false); });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const handleSave = async (meta: NewsMeta, content: string) => {
    setSaving(true);
    try {
      // Конвертуємо % → px перед збереженням (як у live-білдері).
      // НЕ передаємо publishOn — щоб не затерти заплановану дату публікації,
      // виставлену через date-picker у адмінці. Зміни розкладу — окремий PATCH.
      const contentPx = blocksBuilderToDb(content, pageWidth);
      const res = await fetch("/api/admin/news/page-content/next", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: contentPx,
          pageBgColor: meta.pageBgColor || null,
          pageWidth,
        }),
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

  // Сегментований контрол з пресетами + слайдер для точного налаштування ширини.
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
    <>
      {toast && (
        <div style={{
          position: "fixed", top: "76px", right: "24px", zIndex: 50,
          padding: "10px 16px", borderRadius: "12px",
          background: toast.type === "success" ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
          border: `1px solid ${toast.type === "success" ? "rgba(16,185,129,0.35)" : "rgba(239,68,68,0.35)"}`,
          color: toast.type === "success" ? "#065F46" : "#991B1B",
          fontSize: "13px", fontWeight: 600, fontFamily: ff,
          boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
        }}>{toast.message}</div>
      )}

      <NewsEditor
        pageTitle={"Білдер наступної сторінки /news"}
        initialMeta={initialMeta}
        initialContent={initialContent}
        newsId="__news_page_next__"
        mode="page"
        onSave={handleSave}
        onBack={() => router.push("/dashboard/admin/news")}
        saving={saving}
        extraPaletteBlocks={TEMPLATE_PALETTE_BLOCKS}
        extraPaletteBlocksTitle="Спецблоки"
        canvasWidth={pageWidth}
        displayBaseWidth={BUILDER_FRAME_W}
        canvasLabel={{ left: "📄 Наступна сторінка", right: widthLabel }}
        previewSource="next"
      />
    </>
  );
}
