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
  type ArticleImage,
  type EventData,
  type TemplateKind,
} from "@/lib/news/templates/types";
import ArticleTemplate from "@/lib/news/templates/ArticleTemplate";
// EventTemplate більше не імпортуємо напряму — для EVENT preview використовується
// TemplatePreviewCard (який всередині рендерить EventTemplate). Для ARTICLE
// page-mode використовується ArticleTemplate.
import TemplatePreviewCard from "@/lib/news/templates/TemplatePreviewCard";
import type { EventRegion } from "@/lib/news/templates/EventTemplate";
import type { ArticleRegion } from "@/lib/news/templates/ArticleTemplate";
import ArticleForm from "./ArticleForm";
import EventForm from "./EventForm";
import { TextInput } from "./Inputs";
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
  // Підсвічена зона на preview. EVENT і ARTICLE мають різні набори region-id,
  // тому два окремих state — кожна форма керує своїм. focus-events bubble
  // через wrapper-divs у формах (RegionGroup).
  const [focusedRegion, setFocusedRegion] = useState<EventRegion | null>(null);
  const [focusedArticleRegion, setFocusedArticleRegion] = useState<ArticleRegion | null>(null);
  // SEO-розкривашка: за замовчуванням закрита, бо excerpt auto-derive з контенту
  // і менеджеру не треба його чіпати. Розкривається коли треба override для Google.
  const [seoOpen, setSeoOpen] = useState(false);
  // Dirty state — є локальні зміни, ще не збережені на сервер. Показуємо
  // «Чернетка · не збережено» badge у sticky header; cleared на save success.
  const [isDirty, setIsDirty] = useState(false);
  // Скільки змін зроблено — щоб показати menager-у в badge ("3 зміни").
  const [draftChangeCount, setDraftChangeCount] = useState(0);
  // hydrated = форма завантажила server data (і опційно перекрила local draft).
  // Поки false, дочірні setData/setMeta — це just hydration і не повинні
  // тригерити dirty / localStorage запис.
  const hydratedRef = React.useRef(false);

  const draftKey = `news-template-draft-${newsId}`;

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

  // Load. Спочатку server snapshot (для kind + initial canonical state), потім
  // якщо в localStorage є draft — overlay-имо. Це дозволяє менеджеру оновити
  // сторінку, повернутись пізніше, або випадково закрити — нічого не втрачено.
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
        const serverData = parseTemplateData(k, d.templateData);
        const loadedSlug: string = d.slug || "";
        const serverMeta: Meta = {
          title: d.title || "",
          slug: loadedSlug,
          excerpt: d.excerpt || "",
          published: !!d.published,
          isTemplate: !!d.isTemplate,
        };

        // Перевіряємо localStorage на draft саме цієї новини.
        let restoredFromDraft = false;
        try {
          const raw = typeof window !== "undefined" ? window.localStorage.getItem(draftKey) : null;
          if (raw) {
            const draft = JSON.parse(raw) as { data?: unknown; meta?: Meta; changeCount?: number };
            if (draft.data && draft.meta) {
              setData(draft.data as ArticleData | EventData);
              setMeta(draft.meta);
              setIsDirty(true);
              setDraftChangeCount(draft.changeCount || 0);
              restoredFromDraft = true;
            }
          }
        } catch {
          // Невалідний JSON у localStorage — ігноруємо і використовуємо server.
        }

        if (!restoredFromDraft) {
          setData(serverData);
          setMeta(serverMeta);
        }

        // Помічаємо initial slug як «авто-managed». Дозволяє title→slug sync
        // переписувати його коли менеджер починає вводити заголовок (blueprint-
        // clone-и приходять з random-slug, який не співпадає з slugifyNewsTitle).
        // Якщо менеджер свідомо змінив slug руками — він стане custom і подальші
        // зміни title його не зачеплять.
        lastAutoSlugRef.current = restoredFromDraft ? (JSON.parse(localStorage.getItem(draftKey) || "{}").meta?.slug || loadedSlug) : loadedSlug;
        setLoading(false);
        // Після hydration усі наступні setData/setMeta — це user-edits;
        // дозволяємо їм оновлювати draft в localStorage + позначати dirty.
        hydratedRef.current = true;
      })
      .catch(e => { setError("Помилка завантаження: " + e.message); setLoading(false); });
  }, [newsId, draftKey]);

  // Auto-save draft у localStorage при будь-якій зміні форми (debounced 400ms).
  // Це джерело правди для refresh/recovery. На save success — clear draft.
  useEffect(() => {
    if (!hydratedRef.current || !data) return;
    const t = setTimeout(() => {
      try {
        window.localStorage.setItem(draftKey, JSON.stringify({ data, meta, changeCount: draftChangeCount + 1, savedAt: Date.now() }));
        setIsDirty(true);
        setDraftChangeCount(c => c + 1);
      } catch {
        // Сховище повне / приватний режим — silent. На save піде server-PATCH.
      }
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, meta]);

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

  // ARTICLE: News.title — єдине джерело правди для заголовка статті. Sync
  // `meta.title → data.title` щоб render статті/preview-картки показував те
  // саме, що вводить менеджер у верхньому полі. Без цього поле дублювалось
  // в формі і збивало з пантелику. Для EVENT — `data.title` не на картці
  // взагалі (поле dead), тому sync не потрібен.
  useEffect(() => {
    if (!data || kind !== "ARTICLE") return;
    const current = (data as ArticleData).title;
    if (current === meta.title) return;
    setData(prev => prev ? ({ ...(prev as ArticleData), title: meta.title }) : prev);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.title, kind]);

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
        // Save success — очищаємо local draft. Тепер server canonical state
        // = поточний; isDirty=false, counter reset.
        try { window.localStorage.removeItem(draftKey); } catch {}
        setIsDirty(false);
        setDraftChangeCount(0);
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
          padding: "14px 128px 14px 24px",
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

        {/* Status badge — поточний стан змін відносно сервера.
            - isDirty=true  → «● Чернетка · X змін»  (amber)
            - isDirty=false → нічого (за замовч. — все збережено)
            При successful save показуємо «✓ Опубліковано» (через showSavedFlash). */}
        {isDirty && !showSavedFlash && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 12px",
              borderRadius: 999,
              background: "rgba(212,168,67,0.14)",
              border: "1px solid rgba(212,168,67,0.45)",
              color: "#8B6F2D",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.04em",
            }}
            title="Зміни зберігаються у браузері. Натисни «Зберегти» щоб опублікувати на /news"
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#D4A843" }} aria-hidden />
            <span>Чернетка</span>
            {draftChangeCount > 0 && (
              <span style={{ color: "#A8956C", fontWeight: 500 }}>· {draftChangeCount} змін</span>
            )}
          </span>
        )}

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
          gridTemplateColumns: "minmax(440px, 540px) 1fr",
          gap: 0,
          alignItems: "start",
          minHeight: "calc(100vh - 60px)",
        }}
      >
        {/* ── LEFT: form ────────────────────────────────────────────────────── */}
        <aside
          style={{
            padding: "18px 22px 32px",
            borderRight: "1px solid #E8D5B7",
            background: "#FFFFFF",
            position: "sticky",
            top: 60,
            maxHeight: "calc(100vh - 60px)",
            overflowY: "auto",
          }}
        >
          {/* ── META block (зверху): Заголовок + Slug + Excerpt разом ──────
              Логіка: усе що не на картці (адмінка + SEO + URL) згруповано
              нагорі. Менеджер бачить мета-частину один раз і далі редагує
              контент. */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              paddingBottom: 12,
              marginBottom: 6,
              borderBottom: "1px solid #E8D5B7",
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: 8 }}>
              <TextInput
                label="Заголовок"
                value={meta.title}
                onChange={v => setMeta({ ...meta, title: v })}
                hint="адмін + SEO-title"
              />
              <TextInput
                label="Slug (URL)"
                value={meta.slug}
                onChange={v => setMeta({ ...meta, slug: v })}
                hint="кирилиця → latin"
              />
            </div>
            {/* SEO-excerpt — приховано за toggle, бо auto-derive з контенту.
                Менеджеру не треба знати про це поле в 95% випадків. Розкривається
                якщо потрібно перевизначити опис для Google search-видачі. */}
            <button
              type="button"
              onClick={() => setSeoOpen(o => !o)}
              style={{
                alignSelf: "flex-start",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 10px",
                fontSize: 11,
                fontWeight: 600,
                color: "#9B7C45",
                background: seoOpen ? "#FAF6F0" : "transparent",
                border: "1px dashed #E8D5B7",
                borderRadius: 6,
                cursor: "pointer",
                fontFamily: ff,
                transition: "background 0.15s",
              }}
              aria-expanded={seoOpen}
            >
              <span aria-hidden>{seoOpen ? "▾" : "▸"}</span>
              <span>🔍 Опис для Google</span>
              <span style={{ fontWeight: 400, color: "#A8956C" }}>
                {seoOpen ? "" : `· авто з ${kind === "ARTICLE" ? "ліду" : "опису"}`}
              </span>
            </button>
            {seoOpen && (
              <div style={{ paddingLeft: 4 }}>
                <TextInput
                  label="Опис у пошуковій видачі"
                  value={meta.excerpt}
                  onChange={v => setMeta({ ...meta, excerpt: v })}
                  hint={`auto = ${kind === "ARTICLE" ? "лід" : "1-й абзац опису"} · ~155 симв для Google`}
                />
              </div>
            )}
          </div>

          {/* Divider-label замість декоративного банера */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginTop: 4,
              marginBottom: 8,
              fontFamily: ff,
            }}
          >
            <span aria-hidden style={{ fontSize: 12 }}>{kind === "ARTICLE" ? "📰" : "🎟"}</span>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: "#1C3A2E" }}>
              Зміст картки
            </span>
            <span style={{ flex: 1, height: 1, background: "#E8D5B7" }} />
            <span style={{ fontSize: 10, color: "#9B7C45" }}>видно на /news</span>
          </div>

          {/* Kind-specific form (фактичний контент картки) */}
          {kind === "ARTICLE" ? (
            <ArticleForm
              data={data as ArticleData}
              onChange={d => setData(d)}
              onFocusRegion={setFocusedArticleRegion}
            />
          ) : (
            <EventForm
              data={data as EventData}
              onChange={d => setData(d)}
              onFocusRegion={setFocusedRegion}
            />
          )}
        </aside>

        {/* ── RIGHT: live preview ───────────────────────────────────────────── */}
        <main style={{ padding: "24px 32px 80px" }}>
          {/* ARTICLE: stacked preview — превʼю-картка (як виглядає у feed)
              ЗВЕРХУ + повна сторінка статті ПІД нею. Менеджер бачить обидва
              контексти одночасно без перемикання табів. EVENT: один рендер
              (preview-картка = повна сторінка), показуємо без зайвих labels. */}
          {kind === "ARTICLE" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <PreviewSection
                badge="🃏"
                title="У стрічці /news"
                hint="так картка зʼявиться у списку новин"
                accent="#A8956C"
              >
                <CoverImageToolbar
                  scope="preview"
                  cover={(data as ArticleData).cover}
                  onChange={patch => updateArticleCover(setData, patch)}
                />
                <PreviewCanvas>
                  <div style={{ padding: "32px 24px", display: "flex", justifyContent: "center" }}>
                    <TemplatePreviewCard
                      kind={kind}
                      data={data}
                      onCoverFocalClick={(x, y) => updateArticleCover(setData, { focalX: x, focalY: y })}
                    />
                  </div>
                </PreviewCanvas>
              </PreviewSection>
              <PreviewSection
                badge="📄"
                title="Повна сторінка"
                hint="/news/{slug}"
                accent="#1C3A2E"
              >
                <CoverImageToolbar
                  scope="page"
                  cover={(data as ArticleData).cover}
                  onChange={patch => updateArticleCover(setData, patch)}
                />
                <PreviewCanvas>
                  <div style={{ padding: "32px 24px", background: "#FFFFFF", width: "100%" }}>
                    <ArticleTemplate
                      data={data as ArticleData}
                      highlight={focusedArticleRegion}
                      onCoverFocalClick={(x, y) => updateArticleCover(setData, { focalX: x, focalY: y })}
                    />
                  </div>
                </PreviewCanvas>
              </PreviewSection>
            </div>
          ) : (
            <PreviewSection
              badge="🎟"
              title="Картка фахівця"
              hint="однаковий рендер на /news і на /news/{slug}"
              accent="#1C3A2E"
            >
              <PreviewCanvas>
                <div style={{ padding: "32px 24px", display: "flex", justifyContent: "center" }}>
                  <TemplatePreviewCard kind={kind} data={data} highlight={focusedRegion} />
                </div>
              </PreviewCanvas>
            </PreviewSection>
          )}
        </main>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function PreviewSection({
  badge,
  title,
  hint,
  accent,
  children,
}: {
  badge: string;
  title: string;
  hint: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          marginBottom: 10,
          fontFamily: ff,
        }}
      >
        <span aria-hidden style={{ fontSize: 14 }}>{badge}</span>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: accent }}>
          {title}
        </span>
        <span style={{ fontSize: 11, color: "#9B7C45" }}>· {hint}</span>
        <span style={{ flex: 1, height: 1, background: "#E8D5B7", marginTop: 4 }} />
      </div>
      {children}
    </section>
  );
}

/** Applies a patch to data.cover та оновлює state. Якщо linkScale=true і
 *  патч торкає preview-полів — дублює зміни на page-поля (і навпаки). */
function updateArticleCover(
  setData: React.Dispatch<React.SetStateAction<ArticleData | EventData | null>>,
  patch: Partial<ArticleImage>
) {
  setData(prev => {
    if (!prev) return prev;
    const article = prev as ArticleData;
    const cover = article.cover;
    let next: ArticleImage = { ...cover, ...patch };

    // Sync logic: коли linkScale=true, fit/scale зміни віддзеркалюються між
    // preview і page. Focal point завжди спільний (за дизайном).
    if (next.linkScale) {
      if (patch.previewFit !== undefined) next.pageFit = patch.previewFit;
      if (patch.pageFit !== undefined) next.previewFit = patch.pageFit;
      if (patch.previewScale !== undefined) next.pageScale = patch.previewScale;
      if (patch.pageScale !== undefined) next.previewScale = patch.pageScale;
    }
    // Якщо щойно увімкнули linkScale — підтягуємо page-параметри до preview
    // (preview приймається за provider, як зазначено у toolbar UI).
    if (patch.linkScale === true && cover.linkScale !== true) {
      next.pageFit = next.previewFit;
      next.pageScale = next.previewScale;
    }
    return { ...article, cover: next };
  });
}

/** Toolbar над preview-блоком для керування cover-зображенням.
 *  scope визначає чи редагуємо preview-конфіг чи page-конфіг. Lock 🔗 живе
 *  лише на page-toolbar (preview — provider). */
function CoverImageToolbar({
  scope,
  cover,
  onChange,
}: {
  scope: "preview" | "page";
  cover: ArticleImage;
  onChange: (patch: Partial<ArticleImage>) => void;
}) {
  const fit = scope === "preview" ? (cover.previewFit ?? "cover") : (cover.pageFit ?? "cover");
  const scale = scope === "preview" ? (cover.previewScale ?? 1) : (cover.pageScale ?? 1);
  const linked = cover.linkScale === true;
  const fitKey = scope === "preview" ? "previewFit" : "pageFit";
  const scaleKey = scope === "preview" ? "previewScale" : "pageScale";
  const disabled = !cover.url;
  // Slider діапазон залежно від режиму:
  // - Cover: 100-200% (зменшення < 100% дає «крихітне обрізане» → нелогічно).
  // - Contain: 50-200% (фото — ціле, можна зменшити з letterbox або збільшити).
  const sliderMin = fit === "cover" ? 100 : 50;
  const sliderMax = 200;
  // Якщо при переключенні в Cover поточний scale < 1 — clamp на 1.
  const handleFitChange = (next: "cover" | "contain") => {
    const patch: Partial<ArticleImage> = { [fitKey]: next };
    if (next === "cover" && scale < 1) patch[scaleKey] = 1;
    onChange(patch);
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
        padding: "8px 14px",
        marginBottom: 8,
        background: "#FFFFFF",
        border: "1px solid #E8D5B7",
        borderRadius: 10,
        fontFamily: ff,
        fontSize: 12,
        opacity: disabled ? 0.55 : 1,
        pointerEvents: disabled ? "none" : undefined,
      }}
      title={disabled ? "Додай Cover фото у формі, щоб відкрити налаштування" : undefined}
    >
      <span style={{ fontSize: 11, fontWeight: 700, color: "#1C3A2E", letterSpacing: "0.04em", textTransform: "uppercase" }}>
        🖼 Фото
      </span>

      {/* Cover / Contain toggle */}
      <div style={{ display: "inline-flex", border: "1px solid #E8D5B7", borderRadius: 6, overflow: "hidden" }}>
        {(["cover", "contain"] as const).map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => handleFitChange(opt)}
            style={{
              padding: "5px 10px",
              fontSize: 11,
              fontWeight: 600,
              border: "none",
              background: fit === opt ? "#1C3A2E" : "#FFFFFF",
              color: fit === opt ? "#D4A843" : "#57534E",
              cursor: "pointer",
              fontFamily: ff,
            }}
            title={opt === "cover" ? "Заповнити слот — кропати щоб не було вільного місця" : "Вписати ціле фото — допустимий letterbox"}
          >
            {opt === "cover" ? "Заповнити" : "Вписати"}
          </button>
        ))}
      </div>

      {/* Zoom slider */}
      <label style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#57534E" }}>
        <span style={{ fontSize: 11, fontWeight: 600 }}>🔍 Розмір</span>
        <input
          type="range"
          min={sliderMin}
          max={sliderMax}
          step={1}
          value={Math.round(scale * 100)}
          onChange={e => onChange({ [scaleKey]: Number(e.target.value) / 100 })}
          style={{ width: 140, accentColor: "#D4A843" }}
        />
        <span style={{ fontSize: 11, fontVariantNumeric: "tabular-nums", color: "#9B7C45", minWidth: 36 }}>
          {Math.round(scale * 100)}%
        </span>
      </label>

      {/* Focal hint */}
      <span style={{ fontSize: 11, color: "#9B7C45" }}>
        🎯 Клік по фото — точка фокусу
      </span>

      <span style={{ flex: 1 }} />

      {/* Lock — лише на page-toolbar, бо preview — provider */}
      {scope === "page" && (
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 10px",
            borderRadius: 999,
            border: `1px solid ${linked ? "#D4A843" : "#E8D5B7"}`,
            background: linked ? "rgba(212,168,67,0.14)" : "#FFFFFF",
            cursor: "pointer",
            userSelect: "none",
          }}
          title="Синхронізувати з налаштуваннями у стрічці"
        >
          <input
            type="checkbox"
            checked={linked}
            onChange={e => onChange({ linkScale: e.target.checked })}
            style={{ accentColor: "#D4A843" }}
          />
          <span style={{ fontSize: 11, fontWeight: 700, color: linked ? "#8B6F2D" : "#57534E" }}>
            🔗 Синхрон зі стрічкою
          </span>
        </label>
      )}
    </div>
  );
}

function PreviewCanvas({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "#F5F1E8",
        borderRadius: 16,
        border: "1px solid #E8D5B7",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </div>
  );
}
