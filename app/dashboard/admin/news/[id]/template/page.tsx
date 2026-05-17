"use client";

// Template editor route. Працює з News-записами, що мають `templateKind`.
//
// Двозрівневий dispatch:
//
//   1. isTemplate=true (BLUEPRINT — дефолтний або кастомний шаблон):
//      → TemplateConstructor (block-based, Webflow-like палітра + canvas).
//        Зберігає у templateBlocks/templateCanvas. Це новий потік Session 3+.
//
//   2. isTemplate=false (звичайна новина з шаблону, наповнена менеджером):
//      → TemplateEditor (legacy form-based, ArticleForm/EventForm з полями).
//        Зберігає у templateData. До міграції (Session 4) лишається як є.
//
// Поки шаблон НЕ переведений на block-based (templateBlocks=null), constructor
// відкриється з порожнім canvas-ом. Менеджер кидає блоки з палітри й зберігає.
// Legacy templateData для цього blueprint-у ігнорується редактором, але public
// render-у залишається доступним (старі новини рендеряться як раніше).

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

const TemplateEditor = dynamic(
  () => import("../../_components/template-editor/TemplateEditor"),
  {
    ssr: false,
    loading: () => (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
        <div style={{ width: 32, height: 32, border: "3px solid #1C3A2E", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    ),
  },
);

const TemplateConstructor = dynamic(
  () => import("../../_components/template-editor/TemplateConstructor"),
  {
    ssr: false,
    loading: () => (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
        <div style={{ width: 32, height: 32, border: "3px solid #D4A843", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    ),
  },
);

interface NewsRow {
  id: string;
  title: string;
  slug: string;
  isTemplate: boolean;
  templateKind: "ARTICLE" | "EVENT" | null;
  templateBlocks: string | null;
  templateCanvas: string | null;
  pageBgColor: string | null;
}

function defaultCanvasFor(kind: "ARTICLE" | "EVENT"): { width: number; height: number } {
  return kind === "EVENT" ? { width: 600, height: 400 } : { width: 360, height: 400 };
}

function parseCanvas(raw: string | null, kind: "ARTICLE" | "EVENT") {
  if (!raw) return defaultCanvasFor(kind);
  const m = raw.match(/^(\d+)x(\d+)$/);
  if (!m) return defaultCanvasFor(kind);
  const w = Number(m[1]);
  const h = Number(m[2]);
  if (!Number.isFinite(w) || !Number.isFinite(h)) return defaultCanvasFor(kind);
  return { width: w, height: h };
}

export default function TemplateEditorPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : (params.id as string);

  const [row, setRow] = useState<NewsRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!id) return;
    fetch(`/api/admin/news/${id}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: NewsRow) => setRow(d))
      .catch(e => setErr(e instanceof Error ? e.message : "Помилка завантаження"))
      .finally(() => setLoading(false));
  }, [id]);

  if (!id) return null;

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
        <div style={{ width: 32, height: 32, border: "3px solid #1C3A2E", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  if (err || !row) {
    return (
      <div style={{ padding: 24, color: "#B91C1C" }}>
        {err || "Не вдалося завантажити шаблон"}
      </div>
    );
  }

  // Dispatch:
  //   - blueprint (isTemplate=true) → TemplateConstructor у design-режимі
  //     (templateMode=true, плейсхолдери блоків).
  //   - новина з block-based шаблону (isTemplate=false, templateBlocks!=null)
  //     → той самий TemplateConstructor, але isContentMode=true: тi самi
  //     блоки/розмір з шаблону, inline-редактори для наповнення контентом.
  //   - legacy новина без templateBlocks → старий form-editor.
  if (row.templateKind && (row.isTemplate || row.templateBlocks)) {
    const canvas = parseCanvas(row.templateCanvas, row.templateKind);
    return (
      <TemplateConstructor
        newsId={id}
        templateKind={row.templateKind}
        initialTitle={row.title || ""}
        initialSlug={row.slug || ""}
        initialBlocks={row.templateBlocks || ""}
        initialCanvas={canvas}
        pageBgColor={row.pageBgColor || ""}
        isContentMode={!row.isTemplate}
      />
    );
  }

  return <TemplateEditor newsId={id} />;
}
