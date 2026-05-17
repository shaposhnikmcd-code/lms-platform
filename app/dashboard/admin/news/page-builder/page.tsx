"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { NewsMeta } from "../_components/editor/types";
import { TEMPLATE_PALETTE_BLOCKS } from "../_components/editor/BlockPalette";

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
          setInitialContent(cleaned);
          if (typeof d.pageWidth === "number" && d.pageWidth > 0) {
            setPageWidth(Math.max(MIN_PAGE_WIDTH, Math.min(MAX_PAGE_WIDTH, d.pageWidth)));
          }
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
      const res = await fetch("/api/admin/news/page-content", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, pageBgColor: meta.pageBgColor || null, pageWidth }),
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

  // Кастомний canvasLabel.right — інлайн input для ширини сторінки (850..1450).
  const widthLabel = (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#D4A843" }}>
      <input
        type="number"
        min={MIN_PAGE_WIDTH}
        max={MAX_PAGE_WIDTH}
        step={10}
        value={pageWidth}
        onChange={e => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) setPageWidth(v);
        }}
        onBlur={() => setPageWidth(w => Math.max(MIN_PAGE_WIDTH, Math.min(MAX_PAGE_WIDTH, Math.round(w))))}
        title={`Ширина сторінки /news у px (${MIN_PAGE_WIDTH}..${MAX_PAGE_WIDTH})`}
        style={{
          width: 64,
          padding: "3px 6px",
          fontSize: 11,
          fontWeight: 700,
          fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
          color: "#1C3A2E",
          background: "#FFFFFF",
          border: "1px solid #D4A843",
          borderRadius: 6,
          textAlign: "center",
          letterSpacing: "0.06em",
        }}
      />
      <span>px — ширина сторінки на сайті</span>
    </span>
  );

  return (
    <NewsEditor
      pageTitle={"Білдер сторінки /news"}
      initialMeta={initialMeta}
      initialContent={initialContent}
      newsId="__news_page__"
      mode="page"
      onSave={handleSave}
      onBack={() => router.push("/dashboard/admin/news")}
      saving={saving}
      extraPaletteBlocks={TEMPLATE_PALETTE_BLOCKS}
      extraPaletteBlocksTitle="Спецблоки"
      canvasWidth={pageWidth}
      canvasLabel={{ left: "📄 Сторінка новини", right: widthLabel }}
    />
  );
}
