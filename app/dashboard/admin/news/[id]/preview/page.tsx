"use client";

import React, { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useParams } from "next/navigation";
import { HiOutlineCheckCircle } from "react-icons/hi2";
import { useAdminTheme } from "../../../_components/adminTheme";
import { AdminShell } from "../../../_components/AdminShell";
import { UIMP_COLORS } from "../../_components/editor/types";

// Білдер «Превʼю картки новини». СВІДОМО без канвасу/блок-білдера —
// картка на /news рендериться авто з мета-полів (title + image + excerpt
// + category) через `lib/news/render.tsx` fallback (коли previewContent
// порожній). Тут менеджер редагує саме ці поля.
//
// `News.previewContent` лишаємо незачепленим у БД (для backward-compat
// існуючих записів з кастомним блок-лейаутом). Цей білдер його не
// створює і не модифікує.

const ImageStudioModal = dynamic(
  () => import("../../_components/editor/blocks/ImageStudioModal"),
  { ssr: false },
);

const ff = "-apple-system, BlinkMacSystemFont, sans-serif";

interface Meta {
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  imageUrl: string;
  pageBgColor: string;
}

const DEFAULT_META: Meta = {
  title: "",
  slug: "",
  excerpt: "",
  category: "NEWS",
  imageUrl: "",
  pageBgColor: "",
};

function generateSlug(text: string): string {
  return text.toLowerCase().trim()
    .replace(/[а-яёїієґ]/g, (c) => ({ а:"a",б:"b",в:"v",г:"h",ґ:"g",д:"d",е:"e",є:"ie",ж:"zh",з:"z",и:"y",і:"i",ї:"i",й:"j",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"kh",ц:"ts",ч:"ch",ш:"sh",щ:"shch",ь:"",ю:"iu",я:"ia",ё:"yo" }[c] || c))
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export default function EditNewsPreviewPage() {
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : (params.id as string);
  const { theme, setTheme } = useAdminTheme();
  const dark = theme === "dark";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [meta, setMeta] = useState<Meta>(DEFAULT_META);
  const [studioOpen, setStudioOpen] = useState(false);
  const [studioInitialCropMode, setStudioInitialCropMode] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    fetch("/api/admin/news/" + id)
      .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(d => {
        setMeta({
          title: d.title || "",
          slug: d.slug || "",
          excerpt: d.excerpt || "",
          category: d.category || "NEWS",
          imageUrl: d.imageUrl || "",
          pageBgColor: d.pageBgColor || "",
        });
        setLoading(false);
      })
      .catch(e => { setError("Помилка завантаження: " + e.message); setLoading(false); });
  }, [id]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 4000);
    return () => clearTimeout(t);
  }, [message]);

  const uploadFile = async (file: File): Promise<string> => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (res.ok) { const { url } = await res.json(); return url; }
      let detail = `${res.status}`;
      try { const j = await res.json(); if (j?.error) detail = j.error; } catch { /* ignore */ }
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

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadFile(file);
    if (url) setMeta(m => ({ ...m, imageUrl: url }));
    e.target.value = "";
  };

  const handleTitleChange = (val: string) => {
    setMeta(m => ({ ...m, title: val, slug: m.slug || generateSlug(val) }));
  };

  const handleSave = async () => {
    if (!meta.title || !meta.slug) {
      setMessage("Заповніть заголовок і slug");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/news/" + id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // PATCH тільки meta — content / previewContent / published не торкаємо
        // (UI-toggle публікації прибраний; видимість визначає білдер сторінки).
        body: JSON.stringify({
          title: meta.title,
          slug: meta.slug,
          excerpt: meta.excerpt,
          category: meta.category,
          imageUrl: meta.imageUrl,
          pageBgColor: meta.pageBgColor,
        }),
      });
      if (res.ok) {
        router.push("/dashboard/admin/news");
        return;
      }
      const body = await res.json().catch(() => ({}));
      setMessage(body?.error || `Помилка збереження (HTTP ${res.status})`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Невідома помилка збереження";
      setMessage(msg);
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return (
      <div style={{ padding: "24px" }}>
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "12px", padding: "24px", color: "#DC2626" }}>{error}</div>
      </div>
    );
  }

  // ── Стилі карток (співпадають з MetaSidebar) ─────────────────────────
  const card: React.CSSProperties = {
    background: "#fff",
    borderRadius: "14px",
    border: "1px solid #E8D5B7",
    overflow: "hidden",
    boxShadow: "0 2px 12px rgba(28,58,46,0.06)",
  };
  const cardHeader: React.CSSProperties = {
    padding: "9px 16px",
    background: "#1C3A2E",
    fontSize: "10px",
    fontWeight: 800,
    color: "#D4A843",
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    fontFamily: ff,
  };
  const cardBody: React.CSSProperties = {
    padding: "18px 18px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  };
  const label: React.CSSProperties = {
    display: "block",
    fontSize: "11px",
    fontWeight: 700,
    color: "#1C3A2E",
    marginBottom: "6px",
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    fontFamily: ff,
  };
  const input: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1.5px solid #E8D5B7",
    background: "#FAF6F0",
    fontSize: "14px",
    color: "#1C3A2E",
    fontFamily: ff,
    outline: "none",
    boxSizing: "border-box",
  };

  return (
    <AdminShell
      theme={theme}
      setTheme={setTheme}
      eyebrow="Admin · Новини"
      title="Превʼю картки новини"
      backHref="/dashboard/admin/news"
      maxWidth="max-w-3xl"
      rightSlot={
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || loading}
          className="inline-flex items-center gap-2 h-10 px-5 rounded-full text-[13px] font-semibold text-white shadow-lg transition-all hover:scale-[1.03] active:scale-95 disabled:opacity-60 disabled:hover:scale-100"
          style={{
            backgroundImage: "linear-gradient(135deg, #6D28D9 0%, #7C3AED 40%, #D4A017 100%)",
            boxShadow: "0 6px 20px rgba(109, 40, 217, 0.35), 0 2px 6px rgba(0,0,0,0.12)",
          }}
        >
          <HiOutlineCheckCircle className="text-[18px]" />
          {saving ? "Збереження…" : "Зберегти"}
        </button>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className={`w-10 h-10 border-2 rounded-full animate-spin ${dark ? "border-white/[0.1] border-t-amber-300" : "border-stone-200 border-t-amber-600"}`} />
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* ╭─ ПУБЛІКАЦІЯ ───────────────────────────────────────────────╮ */}
          <div style={card}>
            <div style={cardHeader}>Публікація</div>
            <div style={cardBody}>
              <div>
                <label style={label}>Заголовок</label>
                <input
                  style={input}
                  value={meta.title}
                  onChange={e => handleTitleChange(e.target.value)}
                  placeholder="Назва новини"
                />
              </div>
              <div>
                <label style={label}>Slug (URL)</label>
                <input
                  style={input}
                  value={meta.slug}
                  onChange={e => setMeta(m => ({ ...m, slug: e.target.value }))}
                  placeholder="nazva-novyny"
                />
              </div>
              <div>
                <label style={label}>Короткий опис</label>
                <textarea
                  rows={3}
                  style={{ ...input, resize: "vertical", minHeight: "72px" }}
                  value={meta.excerpt}
                  onChange={e => setMeta(m => ({ ...m, excerpt: e.target.value }))}
                  placeholder="Короткий опис для картки новини"
                />
              </div>
              <div>
                <label style={label}>Категорія</label>
                <select
                  style={{ ...input, cursor: "pointer" }}
                  value={meta.category}
                  onChange={e => setMeta(m => ({ ...m, category: e.target.value }))}
                >
                  <option value="NEWS">Новина</option>
                  <option value="ANNOUNCEMENT">Анонс</option>
                  <option value="ARTICLE">Стаття</option>
                  <option value="EVENT">Подія</option>
                </select>
              </div>
            </div>
          </div>

          {/* ╭─ ОБКЛАДИНКА ───────────────────────────────────────────────╮ */}
          <div style={card}>
            <div style={cardHeader}>Обкладинка</div>
            <div style={cardBody}>
              {meta.imageUrl ? (
                <div className="flex flex-col gap-3">
                  <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", borderRadius: "10px", overflow: "hidden", background: "#F3F0E8" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={meta.imageUrl}
                      alt="cover"
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                    <button
                      type="button"
                      onClick={() => setMeta(m => ({ ...m, imageUrl: "" }))}
                      title="Прибрати обкладинку"
                      style={{ position: "absolute", top: "10px", right: "10px", background: "#EF4444", color: "#fff", border: "none", borderRadius: "6px", padding: "5px 11px", cursor: "pointer", fontSize: "12px", fontWeight: 700 }}
                    >✕</button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setStudioInitialCropMode(true); setStudioOpen(true); }}
                      style={{ flex: 1, padding: "9px 12px", borderRadius: "8px", border: "1px solid #D4A843", background: "#FFFFFF", color: "#1C3A2E", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: ff }}
                    >✂ Обрізати</button>
                    <button
                      type="button"
                      onClick={() => { setStudioInitialCropMode(false); setStudioOpen(true); }}
                      style={{ flex: 1, padding: "9px 12px", borderRadius: "8px", border: "1px solid #D4A843", background: "#1C3A2E", color: "#D4A843", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: ff }}
                    >🖼 Редактор</button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileRef.current?.click()}
                  style={{ border: "1.5px dashed #D4A843", borderRadius: "10px", padding: "32px 16px", textAlign: "center", cursor: "pointer", color: "#9B7C45", fontSize: "13px", background: "#FAF6F0", fontFamily: ff, fontWeight: 600 }}
                >
                  {uploading ? "Завантаження…" : "🖼 Завантажити обкладинку"}
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleCoverUpload} />
            </div>
          </div>

          {/* ╭─ ФОН СТОРІНКИ НОВИНИ ──────────────────────────────────────╮ */}
          <div style={card}>
            <div style={cardHeader}>Фон сторінки новини</div>
            <div style={cardBody}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(9, 1fr)", gap: "6px" }}>
                <button
                  type="button"
                  title="Білий (за замовчуванням)"
                  onClick={() => setMeta(m => ({ ...m, pageBgColor: "" }))}
                  style={{
                    width: "100%", aspectRatio: "1 / 1", borderRadius: "8px",
                    border: `2px solid ${!meta.pageBgColor ? "#D4A843" : "#E8D5B7"}`,
                    background: "#FFFFFF",
                    cursor: "pointer", padding: 0,
                    boxShadow: !meta.pageBgColor ? "0 0 0 2px rgba(212,168,67,0.3)" : "none",
                  }}
                />
                {UIMP_COLORS.filter(c => c.value && c.value !== "#FFFFFF").map(c => {
                  const active = (meta.pageBgColor || "").toUpperCase() === c.value.toUpperCase();
                  return (
                    <button
                      key={c.value}
                      type="button"
                      title={c.label}
                      onClick={() => setMeta(m => ({ ...m, pageBgColor: c.value }))}
                      style={{
                        width: "100%", aspectRatio: "1 / 1", borderRadius: "8px",
                        border: `2px solid ${active ? "#D4A843" : "#E8D5B7"}`,
                        background: c.value, cursor: "pointer", padding: 0,
                        boxShadow: active ? "0 0 0 2px rgba(212,168,67,0.3)" : "none",
                      }}
                    />
                  );
                })}
                <label
                  title="Свій колір"
                  style={{
                    width: "100%", aspectRatio: "1 / 1", borderRadius: "8px",
                    border: "2px solid #E8D5B7",
                    background: "conic-gradient(from 180deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)",
                    cursor: "pointer", padding: 0,
                    position: "relative", overflow: "hidden", display: "block",
                  }}
                >
                  <input
                    type="color"
                    value={meta.pageBgColor || "#FFFFFF"}
                    onChange={e => setMeta(m => ({ ...m, pageBgColor: e.target.value }))}
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", border: "none", padding: 0 }}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {message && (
        <div
          role="alert"
          className="fixed top-[152px] right-[88px] z-40 max-w-[360px] flex items-start gap-2.5 px-4 py-3 rounded-xl bg-rose-50 border border-rose-300 shadow-lg"
          style={{ boxShadow: "0 8px 24px -6px rgba(244, 63, 94, 0.35), 0 2px 6px rgba(0,0,0,0.08)" }}
        >
          <span className="flex-shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-500 text-white text-[12px] font-bold mt-0.5">!</span>
          <p className="text-[13px] font-medium text-rose-900 leading-snug flex-1">{message}</p>
          <button
            type="button"
            onClick={() => setMessage("")}
            aria-label="Закрити"
            className="flex-shrink-0 -mr-1 -mt-1 w-6 h-6 inline-flex items-center justify-center rounded-md text-rose-500 hover:bg-rose-100 transition-colors"
          >✕</button>
        </div>
      )}

      {studioOpen && meta.imageUrl && (
        <ImageStudioModal
          imageUrl={meta.imageUrl}
          initialRadius={0}
          initialTolerance={0}
          initialCropMode={studioInitialCropMode}
          coverMode
          onCancel={() => setStudioOpen(false)}
          onSave={async ({ blob }) => {
            if (blob) {
              const ext = blob.type === "image/png" ? "png" : "jpg";
              const file = new File([blob], `cover.${ext}`, { type: blob.type });
              const url = await uploadFile(file);
              if (url) setMeta(m => ({ ...m, imageUrl: url }));
            }
            setStudioOpen(false);
          }}
        />
      )}
    </AdminShell>
  );
}
