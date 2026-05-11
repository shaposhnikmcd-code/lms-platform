"use client";

// Form-based template editor.
// Розкладка: 2-колонкова. Зліва — форма (40%), справа — live preview (60%).
// Зверху — header з title + slug + back-link + save + publish toggle.
//
// Дані: завантаження GET /api/admin/news/[id] → templateKind + templateData (JSON).
// Save: PATCH /api/admin/news/[id] з { title, slug, excerpt, templateData,
// imageUrl=cover.url, published }.

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ARTICLE_DEFAULTS,
  EVENT_DEFAULTS,
  parseTemplateData,
  templateKindLabel,
  type ArticleData,
  type EventData,
  type TemplateKind,
} from "@/lib/news/templates/types";
import ArticleTemplate from "@/lib/news/templates/ArticleTemplate";
// EventTemplate більше не імпортуємо напряму — для EVENT preview використовується
// TemplatePreviewCard (який всередині рендерить EventTemplate). Для ARTICLE
// page-mode використовується ArticleTemplate.
import TemplatePreviewCard from "@/lib/news/templates/TemplatePreviewCard";
import type { EventRegion } from "@/lib/news/templates/EventTemplate";
import ArticleForm from "./ArticleForm";
import EventForm from "./EventForm";
import { TextInput, TextAreaInput } from "./Inputs";
import { slugifyNewsTitle } from "@/lib/news/slug";

const ff = "Inter, system-ui, -apple-system, sans-serif";

interface Props {
  newsId: string;
}

interface Meta {
  title: string;
  slug: string;
  excerpt: string;
  published: boolean;
  isTemplate: boolean;
}

export default function TemplateEditor({ newsId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  // Час останнього успішного save — для inline-стану кнопки «✓ Збережено».
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  // Підсвічена зона на preview-картці. Виставляється при фокусі поля у формі,
  // скидається на blur. Tip: focus-events bubble через wrapper-divs у формі.
  const [focusedRegion, setFocusedRegion] = useState<EventRegion | null>(null);

  const [kind, setKind] = useState<TemplateKind | null>(null);
  const [data, setData] = useState<ArticleData | EventData | null>(null);
  const [meta, setMeta] = useState<Meta>({ title: "", slug: "", excerpt: "", published: false, isTemplate: false });

  // Auto-dismiss toast.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  // Тримаємо «✓ Збережено» на кнопці 2.5с після успішного save — щоб UX-фідбек
  // був помітний навіть якщо менеджер не дивиться на toast у кутку.
  const showSavedFlash = lastSavedAt !== null && Date.now() - lastSavedAt < 2500;
  useEffect(() => {
    if (lastSavedAt === null) return;
    const t = setTimeout(() => setLastSavedAt(null), 2500);
    return () => clearTimeout(t);
  }, [lastSavedAt]);

  // Auto-sync slug з заголовка — поки менеджер сам не правив slug руками.
  // Як детектимо «правлений руками»: запам'ятовуємо ostannje авто-згенероване
  // значення; якщо поточний meta.slug == lastAutoSlug → ще авто-mode, можна
  // оновлювати. Якщо ні (відрізняється) → менеджер кастомізував, не чіпаємо.
  const lastAutoSlugRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (!meta.title) return;
    const auto = slugifyNewsTitle(meta.title);
    if (!auto) return;
    // Якщо slug порожній або дорівнює попередньо-авто-згенерованому → автооновити.
    if (meta.slug === "" || meta.slug === lastAutoSlugRef.current) {
      lastAutoSlugRef.current = auto;
      setMeta(m => ({ ...m, slug: auto }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.title]);

  // Load.
  useEffect(() => {
    fetch(`/api/admin/news/${newsId}`)
      .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(d => {
        if (!d.templateKind) {
          setError("Ця новина не базується на шаблоні (templateKind не задано). Відкрий через звичайний редактор.");
          setLoading(false);
          return;
        }
        const k = d.templateKind as TemplateKind;
        setKind(k);
        setData(parseTemplateData(k, d.templateData));
        setMeta({
          title: d.title || "",
          slug: d.slug || "",
          excerpt: d.excerpt || "",
          published: !!d.published,
          isTemplate: !!d.isTemplate,
        });
        setLoading(false);
      })
      .catch(e => { setError("Помилка завантаження: " + e.message); setLoading(false); });
  }, [newsId]);

  // Auto-sync excerpt: для ARTICLE — з lead, для EVENT — з first paragraph
  // about-блоку (бо lead-у в новій EventData нема). Менеджер може override-ити.
  useEffect(() => {
    if (!data) return;
    const auto = kind === "ARTICLE"
      ? (data as ArticleData).lead
      : (data as EventData).about.split(/\n{2,}/)[0]?.trim() || "";
    setMeta(m => (m.excerpt === "" || !m.excerpt ? { ...m, excerpt: auto } : m));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind === "ARTICLE" ? (data as ArticleData | null)?.lead : (data as EventData | null)?.about]);

  const save = async (publishOverride?: boolean) => {
    if (!data || !kind) return;
    // Client-side guard — щоб PATCH не вилетів з 500 від Prisma unique-null-violation.
    if (!meta.title.trim()) {
      setToast({ message: "Введи заголовок", type: "error" });
      return;
    }
    if (!meta.slug.trim()) {
      setToast({ message: "Slug не може бути порожнім (URL новини)", type: "error" });
      return;
    }
    setSaving(true);
    try {
      // Cover URL для News.imageUrl — використовується в SEO/OG-теги, related-картках,
      // тощо. ARTICLE → cover; EVENT → photo (у новій формі немає cover).
      const coverUrl = kind === "ARTICLE"
        ? (data as ArticleData).cover.url
        : (data as EventData).photo.url;
      // Save = одразу publish. Чернетки немає: якщо менеджер зберіг шаблонну
      // новину, вона готова жити на /news. Прибрати з /news можна окремою
      // кнопкою «Прибрати з /news» (publishOverride=false).
      const nextPublished = typeof publishOverride === "boolean" ? publishOverride : true;
      const payload = {
        title: meta.title,
        slug: meta.slug,
        excerpt: meta.excerpt,
        templateData: JSON.stringify(data),
        imageUrl: coverUrl || null,
        published: nextPublished,
      };
      const res = await fetch(`/api/admin/news/${newsId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setLastSavedAt(Date.now());
        setMeta(m => ({ ...m, published: nextPublished }));
        if (typeof publishOverride === "boolean") {
          // Toggle public/unpublic — лишаємось у редакторі, бо менеджер може
          // ще щось доправити після зміни видимості.
          setToast({ message: publishOverride ? "Опубліковано на /news" : "Знято з публікації", type: "success" });
        } else {
          // Звичайний save = одразу publish + повернення у список новин.
          setToast({ message: "Збережено · опубліковано на /news", type: "success" });
          setTimeout(() => router.push("/dashboard/admin/news"), 600);
        }
      } else {
        const j = await res.json().catch(() => ({}));
        setToast({ message: j?.error || `Помилка збереження (HTTP ${res.status})`, type: "error" });
      }
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : "Помилка мережі", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  // Live preview pane state.
  const [previewMode, setPreviewMode] = useState<"card" | "page">("card");

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
        <div style={{ width: 32, height: 32, border: "3px solid #1C3A2E", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: 20, color: "#DC2626", fontFamily: ff }}>{error}</div>
      </div>
    );
  }
  if (!data || !kind) return null;

  const isBlueprint = meta.isTemplate;

  return (
    <div style={{ minHeight: "100vh", background: "#FCFAF5", fontFamily: ff }}>
      {/* Sticky header: title + meta + actions */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          background: "#FFFFFF",
          borderBottom: "1px solid #E8D5B7",
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
          boxShadow: "0 2px 8px rgba(28,58,46,0.04)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              borderRadius: 999,
              background: kind === "ARTICLE" ? "#FAF6F0" : "#F0F4F1",
              border: `1px solid ${kind === "ARTICLE" ? "#D4A843" : "#1C3A2E"}40`,
              fontSize: 11,
              fontWeight: 700,
              color: kind === "ARTICLE" ? "#9B7C45" : "#1C3A2E",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            {kind === "ARTICLE" ? "📰" : "🎟"}
            <span>Шаблон · {templateKindLabel(kind)}</span>
          </span>
          {isBlueprint && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#9B7C45",
                fontStyle: "italic",
              }}
            >
              · Blueprint (зразок)
            </span>
          )}
        </div>

        <div style={{ flex: 1 }} />

        {/* Publish-toggle прибрано: save = одразу опубліковано на /news, окрема
            кнопка зайва. Якщо потрібно сховати — менеджер видаляє новину
            кнопкою Trash на /dashboard/admin/news. */}

        <button
          type="button"
          onClick={() => save()}
          disabled={saving}
          style={{
            padding: "10px 18px",
            fontSize: 13,
            fontWeight: 700,
            background: showSavedFlash ? "#10B981" : "#1C3A2E",
            color: showSavedFlash ? "#FFFFFF" : "#D4A843",
            border: "none",
            borderRadius: 10,
            cursor: saving ? "wait" : "pointer",
            fontFamily: ff,
            opacity: saving ? 0.7 : 1,
            boxShadow: showSavedFlash
              ? "0 4px 14px -4px rgba(16,185,129,0.55)"
              : "0 4px 12px -4px rgba(28,58,46,0.4)",
            transition: "background 0.2s, color 0.2s, box-shadow 0.2s",
            minWidth: 130,
          }}
        >
          {saving
            ? "Збереження..."
            : showSavedFlash
              ? "✓ Збережено"
              : "💾 Зберегти"}
        </button>
      </div>

      {/* Toast — bottom-right, solid colors, animated entry. Не вгорі, щоб не
          конкурувати з floating DashboardBackButton. */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            bottom: 28,
            right: 28,
            zIndex: 60,
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 18px",
            borderRadius: 12,
            background: toast.type === "success" ? "#10B981" : "#DC2626",
            color: "#FFFFFF",
            fontSize: 14,
            fontWeight: 700,
            fontFamily: ff,
            boxShadow: toast.type === "success"
              ? "0 12px 32px -8px rgba(16,185,129,0.55), 0 4px 12px rgba(16,185,129,0.25)"
              : "0 12px 32px -8px rgba(220,38,38,0.55), 0 4px 12px rgba(220,38,38,0.25)",
            animation: "tplToastIn 0.25s ease-out",
          }}
        >
          <span aria-hidden style={{ fontSize: 18, lineHeight: 1 }}>
            {toast.type === "success" ? "✓" : "⚠"}
          </span>
          <span>{toast.message}</span>
          <style>{`
            @keyframes tplToastIn {
              from { opacity: 0; transform: translateY(8px) scale(0.97); }
              to   { opacity: 1; transform: translateY(0)   scale(1);    }
            }
          `}</style>
        </div>
      )}

      {/* Body: 2-column layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(360px, 480px) 1fr",
          gap: 0,
          alignItems: "start",
          minHeight: "calc(100vh - 60px)",
        }}
      >
        {/* ── LEFT: form ────────────────────────────────────────────────────── */}
        <aside
          style={{
            padding: "24px 24px 80px",
            borderRight: "1px solid #E8D5B7",
            background: "#FFFFFF",
            position: "sticky",
            top: 60,
            maxHeight: "calc(100vh - 60px)",
            overflowY: "auto",
          }}
        >
          {/* ── Зверху: TITLE only — внутрішня назва ───────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 18 }}>
            <TextInput
              label="Заголовок"
              value={meta.title}
              onChange={v => setMeta({ ...meta, title: v })}
              hint="для адмінки, пошуку, SEO-title. На самій картці не показується."
            />
          </div>

          {/* ── Чіткий розділювач — ЗМІСТ ───────────────────────────────────
              Менеджер мав плутанину: писав у SEO-excerpt і не бачив на картці.
              Цей баннер однозначно каже: «нижче — те, що видно на картці». */}
          <div
            style={{
              padding: "10px 14px",
              marginBottom: 14,
              borderRadius: 10,
              background: "linear-gradient(90deg, #1C3A2E 0%, #2a4f3f 100%)",
              color: "#F5E1A4",
              fontFamily: ff,
              display: "flex",
              alignItems: "center",
              gap: 10,
              boxShadow: "0 2px 8px rgba(28,58,46,0.18)",
            }}
          >
            <span aria-hidden style={{ fontSize: 16 }}>{kind === "ARTICLE" ? "📰" : "🎟"}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase" }}>
                Зміст картки
              </div>
              <div style={{ fontSize: 11, color: "rgba(245,225,164,0.75)", marginTop: 2 }}>
                Усе нижче — те, що побачить відвідувач /news
              </div>
            </div>
          </div>

          {/* Kind-specific form (фактичний контент картки) */}
          {kind === "ARTICLE" ? (
            <ArticleForm
              data={data as ArticleData}
              onChange={d => setData(d)}
            />
          ) : (
            <EventForm
              data={data as EventData}
              onChange={d => setData(d)}
              onFocusRegion={setFocusedRegion}
            />
          )}

          {/* ── Внизу: SEO + URL — не на картці, тільки для адмінки/Google ── */}
          <div
            style={{
              marginTop: 26,
              padding: "14px 16px 16px",
              borderRadius: 12,
              background: "#FAF6F0",
              border: "1px dashed #D4A843",
              fontFamily: ff,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 12,
              }}
            >
              <span aria-hidden style={{ fontSize: 14 }}>⚙️</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "#1C3A2E" }}>
                  Адмін + SEO
                </div>
                <div style={{ fontSize: 11, color: "#9B7C45", marginTop: 2 }}>
                  Це НЕ показується на картці — тільки для адмінки і Google
                </div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <TextInput
                label="Slug (URL)"
                value={meta.slug}
                onChange={v => setMeta({ ...meta, slug: v })}
                hint="/news/{slug} · кириличні слова → latinized автоматично"
              />
              <TextAreaInput
                label="SEO-excerpt"
                value={meta.excerpt}
                onChange={v => setMeta({ ...meta, excerpt: v })}
                rows={2}
                hint={kind === "ARTICLE"
                  ? "коротке резюме для Google/соц-мережей · за замовчуванням = лід шаблону"
                  : "коротке резюме для Google/соц-мережей · за замовчуванням = перший абзац опису фахівця"}
              />
            </div>
          </div>
        </aside>

        {/* ── RIGHT: live preview ───────────────────────────────────────────── */}
        <main style={{ padding: "24px 32px 80px" }}>
          {/* Preview-mode toggle — тільки для ARTICLE, бо там 2 РІЗНІ рендери:
              compact preview-card (360×400) на /news listing і повна сторінка
              /news/{slug} з hero, секціями, ілюстраціями. Для EVENT — обидва
              контексти рендеряться ТИМ САМИМ EventTemplate (2-кол картка
              фахівця), тому tabs не дають value. Показуємо просто single label. */}
          {kind === "ARTICLE" ? (
            <div
              style={{
                display: "inline-flex",
                gap: 0,
                padding: 4,
                background: "#F5F1E8",
                borderRadius: 10,
                marginBottom: 24,
              }}
            >
              <PreviewModeButton
                active={previewMode === "card"}
                onClick={() => setPreviewMode("card")}
                label="🃏 Превʼю-картка"
                hint="на /news listing"
              />
              <PreviewModeButton
                active={previewMode === "page"}
                onClick={() => setPreviewMode("page")}
                label="📄 Сторінка статті"
                hint="/news/{slug}"
              />
            </div>
          ) : (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                background: "#F5F1E8",
                borderRadius: 10,
                marginBottom: 24,
                fontFamily: ff,
              }}
            >
              <span aria-hidden style={{ fontSize: 14 }}>🎟</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#1C3A2E", lineHeight: 1.1 }}>
                  Картка фахівця
                </div>
                <div style={{ fontSize: 10, color: "#9B7C45", marginTop: 1 }}>
                  однаковий рендер на /news і на /news/{`{slug}`}
                </div>
              </div>
            </div>
          )}

          {/* Render: для EVENT — завжди card-mode (один-єдиний рендер).
              Для ARTICLE — пер preview-mode (card vs повна сторінка). */}
          {kind === "EVENT" || previewMode === "card" ? (
            <PreviewCanvas>
              <div style={{ padding: "60px 0", display: "flex", justifyContent: "center" }}>
                <TemplatePreviewCard kind={kind} data={data} highlight={focusedRegion} />
              </div>
            </PreviewCanvas>
          ) : (
            <PreviewCanvas>
              <div style={{ padding: "40px 24px", background: "#FFFFFF" }}>
                <ArticleTemplate data={data as ArticleData} />
              </div>
            </PreviewCanvas>
          )}
        </main>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function PreviewModeButton({ active, onClick, label, hint }: { active: boolean; onClick: () => void; label: string; hint: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "8px 16px",
        background: active ? "#FFFFFF" : "transparent",
        border: "none",
        borderRadius: 8,
        cursor: "pointer",
        fontFamily: ff,
        boxShadow: active ? "0 2px 6px rgba(28,58,46,0.08)" : "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 2,
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 700, color: active ? "#1C3A2E" : "#9B7C45" }}>{label}</span>
      <span style={{ fontSize: 10, color: "#9B7C45", fontWeight: 400 }}>{hint}</span>
    </button>
  );
}

function PreviewCanvas({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "#F5F1E8",
        borderRadius: 16,
        border: "1px solid #E8D5B7",
        minHeight: 600,
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}
