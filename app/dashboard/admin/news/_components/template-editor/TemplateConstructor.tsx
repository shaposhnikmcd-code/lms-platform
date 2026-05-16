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
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { NewsMeta } from "../editor/types";
import { TEMPLATE_PALETTE_BLOCKS } from "../editor/BlockPalette";

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

  const onBack = useCallback(() => router.push("/dashboard/admin/news"), [router]);

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
            // templateCanvas — розмір canvas-у "WxH".
            title: meta.title,
            imageUrl,
            templateBlocks: content,
            templateCanvas: `${initialCanvas.width}x${initialCanvas.height}`,
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
    [newsId, initialCanvas]
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
        canvasWidth={initialCanvas.width}
        minCanvasHeight={initialCanvas.height}
        fixedHeight
        canvasLabel={{
          left: `Шаблон · ${templateKind}`,
          right: `${initialCanvas.width}×${initialCanvas.height} px`,
        }}
        bottomSlack={0}
        extraPaletteBlocks={TEMPLATE_PALETTE_BLOCKS}
        extraPaletteBlocksTitle="Слоти шаблону"
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
