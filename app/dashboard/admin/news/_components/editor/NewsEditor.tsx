"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Block, NewsMeta, blocksToJson, jsonToBlocks } from "./types";
import EditorCanvas from "./EditorCanvas";
import MetaSidebar from "./MetaSidebar";

const ff = "-apple-system, BlinkMacSystemFont, sans-serif";

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
  const def: NewsMeta = { title: "", slug: "", excerpt: "", category: "NEWS", imageUrl: "", published: false };
  const [meta, setMeta] = useState<NewsMeta>({ ...def, ...initialMeta });
  const [blocks, setBlocks] = useState<Block[]>(() => jsonToBlocks(initialContent || ""));
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);

  useEffect(() => {
    if (initialContent) {
      setMeta({ ...def, ...initialMeta });
      setBlocks(jsonToBlocks(initialContent));
    }
  }, [initialContent]);

  const autoSave = useCallback(() => {
    saveDraft(meta, blocks, newsId);
    setDraftSaved(true);
    setTimeout(() => setDraftSaved(false), 2000);
  }, [meta, blocks, newsId]);

  useEffect(() => {
    const t = setTimeout(autoSave, 1500);
    return () => clearTimeout(t);
  }, [meta, blocks]);

  const uploadFile = async (file: File): Promise<string> => {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    setUploading(false);
    if (res.ok) { const { url } = await res.json(); return url; }
    setMessage("Помилка завантаження");
    return "";
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
    <div style={{ minHeight: "100vh", background: "#E8E4DC", fontFamily: ff }}>

      {/* Fixed header */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 300,
        height: "56px",
        background: "#1C3A2E",
        borderBottomWidth: "1px", borderBottomStyle: "solid", borderBottomColor: "rgba(212,168,67,0.2)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 32px",
        boxShadow: "0 2px 24px rgba(0,0,0,0.2)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button onClick={onBack} style={{
            padding: "6px 14px", borderRadius: "8px",
            borderWidth: "1px", borderStyle: "solid", borderColor: "rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.65)",
            fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: ff,
          }}>{"← Назад"}</button>

          <div style={{ width: "1px", height: "20px", background: "rgba(255,255,255,0.08)" }} />

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{
              width: "7px", height: "7px", borderRadius: "50%",
              background: meta.published ? "#4ADE80" : "#FBBF24",
              boxShadow: meta.published ? "0 0 8px rgba(74,222,128,0.5)" : "0 0 8px rgba(251,191,36,0.5)",
            }} />
            <span style={{ fontSize: "14px", fontWeight: 700, color: "#FAF6F0" }}>{pageTitle}</span>
          </div>

          <div style={{ width: "1px", height: "20px", background: "rgba(255,255,255,0.08)" }} />

          <span style={{ fontSize: "11px", color: draftSaved ? "#4ADE80" : "rgba(255,255,255,0.25)", fontWeight: 500, transition: "color 0.4s" }}>
            {draftSaved ? "✓ Збережено" : "Автозбереження"}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {message && <span style={{ fontSize: "12px", color: "#F87171", fontWeight: 500 }}>{message}</span>}
          {uploading && <span style={{ fontSize: "12px", color: "#D4A843", fontWeight: 500 }}>{"Завантаження..."}</span>}

          <div style={{ display: "flex", borderRadius: "10px", overflow: "hidden", borderWidth: "1px", borderStyle: "solid", borderColor: "rgba(255,255,255,0.1)" }}>
            <button onClick={() => handleSave(false)} disabled={saving} style={{
              padding: "8px 20px", background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.75)",
              fontSize: "13px", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer",
              border: "none", fontFamily: ff, opacity: saving ? 0.5 : 1,
            }}>{"Чернетка"}</button>
            <div style={{ width: "1px", background: "rgba(255,255,255,0.1)" }} />
            <button onClick={() => handleSave(true)} disabled={saving} style={{
              padding: "8px 24px", background: "#D4A843", color: "#1C3A2E",
              fontSize: "13px", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer",
              border: "none", fontFamily: ff, opacity: saving ? 0.6 : 1,
            }}>{saving ? "Збереження..." : "Опублікувати"}</button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{
        paddingTop: "80px",
        paddingBottom: "80px",
        paddingLeft: "40px",
        paddingRight: "40px",
        maxWidth: "1480px",
        margin: "0 auto",
        display: "flex",
        gap: "40px",
        alignItems: "flex-start",
      }}>
        {/* Left palette + canvas */}
        <div style={{ flex: 1, minWidth: 0, paddingTop: "24px" }}>
          <EditorCanvas blocks={blocks} onBlocksChange={setBlocks} onUpload={uploadFile} />
        </div>

        {/* Right sidebar */}
        <div style={{ position: "sticky", top: "76px", alignSelf: "flex-start", paddingTop: "24px" }}>
          <MetaSidebar meta={meta} onChange={setMeta} onUpload={uploadFile} />
        </div>
      </div>
    </div>
  );
}