"use client";

import React, { useState, useEffect, useCallback } from "react";
import { HiOutlineCheckCircle } from "react-icons/hi2";
import { Block, NewsMeta, blocksToJson, jsonToBlocks } from "./types";
import EditorCanvas from "./EditorCanvas";
import MetaSidebar from "./MetaSidebar";

function saveDraft(meta: NewsMeta, blocks: Block[], newsId?: string) {
  try { localStorage.setItem(`uimp_draft_${newsId || "new"}`, JSON.stringify({ meta, blocks })); } catch {}
}
function clearDraft(newsId?: string) {
  try { localStorage.removeItem(`uimp_draft_${newsId || "new"}`); } catch {}
}

export default function NewsEditor({
  pageTitle, initialMeta, initialContent, newsId, onSave, onBack, saving,
}: {
  pageTitle: string;
  initialMeta?: Partial<NewsMeta>;
  initialContent?: string;
  newsId?: string;
  onSave: (meta: NewsMeta, content: string, imageUrl: string) => Promise<void>;
  onBack: () => void;
  saving: boolean;
}) {
  void onBack;
  const def: NewsMeta = { title: "", slug: "", excerpt: "", category: "NEWS", imageUrl: "", published: false };
  const [meta, setMeta] = useState<NewsMeta>({ ...def, ...initialMeta });
  const [blocks, setBlocks] = useState<Block[]>(() => jsonToBlocks(initialContent || ""));
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (initialContent) {
      setMeta({ ...def, ...initialMeta });
      setBlocks(jsonToBlocks(initialContent));
    }
  }, [initialContent]);

  const autoSave = useCallback(() => {
    saveDraft(meta, blocks, newsId);
  }, [meta, blocks, newsId]);

  useEffect(() => {
    const t = setTimeout(autoSave, 1500);
    return () => clearTimeout(t);
  }, [meta, blocks]);

  const uploadFile = async (file: File): Promise<string> => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (res.ok) { const { url } = await res.json(); return url; }
      let detail = `${res.status}`;
      try { const j = await res.json(); if (j?.error) detail = j.error; } catch {}
      setMessage(`Помилка завантаження: ${detail}`);
      return "";
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setMessage(`Помилка завантаження: ${msg}`);
      return "";
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (published: boolean) => {
    if (!meta.title || !meta.slug) { setMessage("Заповніть заголовок і slug"); return; }
    setMessage("");
    const content = blocksToJson(blocks);
    const imageUrl = meta.imageUrl || blocks.find(b => b.type === "image")?.data.url || "";
    await onSave({ ...meta, published }, content, imageUrl);
    clearDraft(newsId);
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-[1480px] mx-auto px-6 py-10">
        {/* Top header — eyebrow + title + buttons (статичні, скролляться разом зі сторінкою) */}
        <div className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-600 mb-1.5">
            Admin · Новини
          </p>
          <div className="flex items-center justify-between gap-4 pr-32">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3 min-w-0">
              <span
                className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                  meta.published
                    ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                    : "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                }`}
              />
              <span className="truncate">{pageTitle}</span>
            </h1>

            <div className="flex items-center gap-2.5 flex-shrink-0">
              <button
                type="button"
                onClick={() => handleSave(false)}
                disabled={saving}
                className="px-7 h-12 text-[15px] font-semibold text-slate-700 bg-white ring-1 ring-slate-200 rounded-xl shadow-sm hover:bg-slate-50 hover:ring-slate-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Чернетка
              </button>
              <button
                type="button"
                onClick={() => handleSave(true)}
                disabled={saving}
                className="group relative inline-flex items-center justify-center gap-2 px-7 h-12 text-[15px] font-semibold text-white bg-gradient-to-br from-violet-600 to-violet-700 rounded-xl shadow-sm hover:shadow-lg hover:shadow-violet-500/25 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none overflow-hidden"
              >
                <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
                <span className="relative inline-flex items-center gap-2">
                  <HiOutlineCheckCircle className="text-lg" />
                  {saving ? "Збереження…" : "Опублікувати"}
                </span>
              </button>
            </div>
          </div>
          {(message || uploading) && (
            <p className="mt-2 text-[12px] font-medium">
              {message && <span className="text-rose-600">{message}</span>}
              {uploading && <span className="text-amber-600">Завантаження…</span>}
            </p>
          )}
        </div>

        {/* Editor row — Palette | Canvas | Sidebar, всі стартують на одному Y */}
        <div className="flex flex-col lg:flex-row gap-10 items-start">
          <div className="flex-1 min-w-0 w-full">
            <EditorCanvas blocks={blocks} onBlocksChange={setBlocks} onUpload={uploadFile} />
          </div>

          <div className="w-full lg:w-auto lg:sticky lg:top-24 lg:self-start">
            <MetaSidebar meta={meta} onChange={setMeta} onUpload={uploadFile} />
          </div>
        </div>
      </div>
    </div>
  );
}
