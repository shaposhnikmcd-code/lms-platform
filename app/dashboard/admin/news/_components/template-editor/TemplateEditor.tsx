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
  EVENT_CARD_WIDTH_MIN,
  EVENT_CARD_WIDTH_MAX,
  EVENT_CARD_WIDTH_DEFAULT,
  EVENT_CARD_HEIGHT_MIN,
  EVENT_CARD_HEIGHT_MAX,
  EVENT_CARD_HEIGHT_DEFAULT,
  EVENT_TITLE_WIDTH_MIN,
  EVENT_TITLE_WIDTH_MAX,
  EVENT_TITLE_HEIGHT_MIN,
  EVENT_TITLE_HEIGHT_MAX,
  type ArticleData,
  type ArticleImage,
  type EventData,
  type TemplateKind,
} from "@/lib/news/templates/types";
import ArticleTemplate from "@/lib/news/templates/ArticleTemplate";
// EventTemplate імпортуємо для page-mode preview ("Повна сторінка") — на feed-mode
// preview ("У стрічці /news") використовується TemplatePreviewCard.
import EventTemplate from "@/lib/news/templates/EventTemplate";
import TemplatePreviewCard from "@/lib/news/templates/TemplatePreviewCard";
import type { EventRegion } from "@/lib/news/templates/EventTemplate";
import type { ArticleRegion } from "@/lib/news/templates/ArticleTemplate";
import ArticleForm from "./ArticleForm";
import EventForm from "./EventForm";
import { TextInput } from "./Inputs";
import { slugifyNewsTitle } from "@/lib/news/slug";
import HeadingEditor from "../editor/blocks/HeadingEditor";
import ImageEditor from "../editor/blocks/ImageEditor";
import { NewsEditorActionsContext } from "../editor/NewsEditor";
import { buildGoogleFontsHref } from "../editor/blocks/editorFonts";
import type { Block } from "../editor/types";

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
  // Fullscreen iframe-превʼю — той самий паттерн що в /dashboard/admin/news.
  const [previewOpen, setPreviewOpen] = useState(false);
  // Esc закриває модалку.
  useEffect(() => {
    if (!previewOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPreviewOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [previewOpen]);
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
  // Який «віртуальний блок» зараз обраний у preview-канвасі. Активний блок
  // портал-ить свої налаштування в #news-block-settings-slot — як у білдері
  // новин. `null` — нічого не вибрано, slot пустий.
  const [selectedBlock, setSelectedBlock] = useState<"title" | "photo" | null>(null);
  // Escape — деселект блока (виходимо з режиму редагування title/photo).
  // Click outside — також деселект (клік поза preview-канвасом і поза
  // settings-slot-ом у sidebar-і).
  useEffect(() => {
    if (!selectedBlock) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (document.querySelector("[data-fullscreen-editor]")) return;
      setSelectedBlock(null);
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      // Ігноруємо кліки в самих блоках (preview-канвас) і в settings-slot
      // (sidebar з налаштуваннями обраного блока) — це частини активного
      // редагування. Також ігноруємо fullscreen-модалки.
      // Клік на сам блок (heading або body) — НЕ деселект. Інакше деселектимо.
      // Це дає UX «клік на cream background навколо блоків деселектить».
      if (target.closest("[data-block-region]")) return;
      if (target.closest("#news-block-settings-slot")) return;
      if (target.closest("[data-fullscreen-editor]")) return;
      setSelectedBlock(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [selectedBlock]);

  // ── Undo/Redo історія для data + meta ──────────────────────────────────────
  // history-stack ref-based (без re-render на push). Pointer показує позицію
  // у history; undo рухає назад, redo вперед. user-edit (через editData/editMeta)
  // pushить snapshot. setData/setMeta з undo/redo — пропускає push через флаг.
  type Snapshot = { data: ArticleData | EventData; meta: Meta };
  const historyRef = React.useRef<Snapshot[]>([]);
  const historyPointerRef = React.useRef(-1);
  const skipHistoryRef = React.useRef(false);
  const [historyTick, setHistoryTick] = useState(0);
  void historyTick;
  const HISTORY_CAP = 80;

  const pushHistory = React.useCallback((snap: Snapshot) => {
    if (skipHistoryRef.current) { skipHistoryRef.current = false; return; }
    const cur = historyRef.current;
    const ptr = historyPointerRef.current;
    // Якщо вже були undo — обрізаємо «майбутнє» перед push нового стану.
    const trimmed = cur.slice(0, ptr + 1);
    // Skip duplicate (consecutive identical snapshots).
    const last = trimmed[trimmed.length - 1];
    if (last && JSON.stringify(last) === JSON.stringify(snap)) return;
    trimmed.push(snap);
    if (trimmed.length > HISTORY_CAP) trimmed.shift();
    historyRef.current = trimmed;
    historyPointerRef.current = trimmed.length - 1;
    setHistoryTick(t => t + 1);
  }, []);

  // user-edit wrappers: викликаються формами замість setData/setMeta напряму,
  // push snapshot перед застосуванням зміни.
  const editData = React.useCallback((next: ArticleData | EventData) => {
    if (data && meta) pushHistory({ data, meta });
    setData(next);
  }, [data, meta, pushHistory]);

  const undo = React.useCallback(() => {
    const ptr = historyPointerRef.current;
    if (ptr <= 0) return;
    historyPointerRef.current = ptr - 1;
    const snap = historyRef.current[historyPointerRef.current];
    skipHistoryRef.current = true;
    setData(snap.data);
    setMeta(snap.meta);
    setHistoryTick(t => t + 1);
  }, []);

  const redo = React.useCallback(() => {
    const ptr = historyPointerRef.current;
    if (ptr >= historyRef.current.length - 1) return;
    historyPointerRef.current = ptr + 1;
    const snap = historyRef.current[historyPointerRef.current];
    skipHistoryRef.current = true;
    setData(snap.data);
    setMeta(snap.meta);
    setHistoryTick(t => t + 1);
  }, []);

  const canUndo = historyPointerRef.current > 0;
  const canRedo = historyPointerRef.current < historyRef.current.length - 1;

  // Keyboard shortcuts Ctrl+Z / Ctrl+Shift+Z. Skip коли фокус у тексті — там
  // власний undo (browser-level для input/textarea).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);
      const cmd = isMac ? e.metaKey : e.ctrlKey;
      if (!cmd) return;
      const key = e.key.toLowerCase();
      if (key !== "z" && key !== "y") return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        if (target.isContentEditable) return;
      }
      e.preventDefault();
      if (key === "z" && !e.shiftKey) undo();
      else redo();
    };
    document.addEventListener("keydown", onKey, { capture: true });
    return () => document.removeEventListener("keydown", onKey, { capture: true });
  }, [undo, redo]);

  // Початковий snapshot — після першого hydration (server або draft).
  useEffect(() => {
    if (!hydratedRef.current || !data || historyRef.current.length > 0) return;
    historyRef.current = [{ data, meta }];
    historyPointerRef.current = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

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

  // News.title — єдине джерело правди для заголовка. На render-час
  // підмінюємо `data.title` поточним `meta.title` (див. `dataForRender`),
  // на save теж форсимо. Окремий sync useEffect не потрібен — менш надійно
  // через batching з draft-restore.
  const dataForRender = React.useMemo(() => {
    if (!data || !kind) return data;
    if (kind === "ARTICLE") return { ...(data as ArticleData), title: meta.title };
    return { ...(data as EventData), title: meta.title };
  }, [data, kind, meta.title]);

  // ── Синтетичні Block-и для HeadingEditor / ImageEditor ─────────────────────
  // HeadingEditor і ImageEditor очікують `Block` shape. Ми не зберігаємо їх як
  // окремі blocks у БД — лише data.titleHtml + data.photo. Block-обʼєкти
  // конструюються на льоту з поточного data + sensible defaults для layout-полів
  // (width/align/bgColor — все одно не використовуються бо рендер inline у
  // EventTemplate).
  // Унікалізуємо block.id префіксом newsId — щоб module-level реєстр
  // ImageEditor (cropHandlers Map<blockId, fn>) не конфліктував з блоками
  // звичайного news-builder-а у тому ж DOM (теоретичний multi-tab edge case).
  const titleBlockId = `tpl-${newsId}-title`;
  const photoBlockId = `tpl-${newsId}-photo`;

  // Deps: data.titleHtml / meta.title окремо — інакше будь-яке оновлення `data`
  // (наприклад фото) пересоздавало titleBlock і скидало фокус у TipTap.
  const titleBlock: Block | null = React.useMemo(() => {
    if (!data || kind !== "EVENT") return null;
    const ev = data as EventData;
    const html = (ev.titleHtml && ev.titleHtml.trim() !== "")
      ? ev.titleHtml
      : (meta.title ? `<p>${meta.title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>` : "");
    return {
      id: titleBlockId,
      type: "heading",
      data: { html, level: "2", color: "" },
      width: "100",
      align: "center",
      vAlign: "center",
      bgColor: "#FFFFFF",
      x: 0, y: 0, height: 90,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(data as EventData | null)?.titleHtml, kind, meta.title, titleBlockId]);

  const photoBlock: Block | null = React.useMemo(() => {
    if (!data || kind !== "EVENT") return null;
    const p = (data as EventData).photo;
    return {
      id: photoBlockId,
      type: "image",
      data: {
        url: p.url || "",
        alt: p.alt || "",
        imgRadius: String(p.imgRadius ?? 0),
        imgRadiusCorners: p.imgRadiusCorners || "1111",
        overlays: p.overlays || "",
        aspectRatio: p.aspectRatio ? String(p.aspectRatio) : "",
        bgRemoveTolerance: String(p.bgRemoveTolerance ?? 0),
      },
      width: "100",
      align: "left",
      bgColor: "",
      x: 0, y: 0,
      height: (data as EventData).cardHeight || EVENT_CARD_HEIGHT_DEFAULT,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    (data as EventData | null)?.photo,
    (data as EventData | null)?.cardHeight,
    kind, photoBlockId,
  ]);

  // Upload helper для ImageEditor — той самий ендпоінт що в білдері новин.
  const uploadPhoto = React.useCallback(async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) throw new Error("Upload failed");
    const j = await res.json();
    return j.url as string;
  }, []);

  // onChange handlers для синтетичних блоків. Розпаковуємо назад у data shape.
  const onTitleBlockChange = React.useCallback((next: Record<string, string>) => {
    if (!data || kind !== "EVENT") return;
    const html = next.html || "";
    // Extract plain text з HTML для sync з meta.title (slug + SEO).
    const plain = html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
    editData({ ...(data as EventData), titleHtml: html });
    if (plain && plain !== meta.title) {
      setMeta(m => ({ ...m, title: plain }));
    }
  }, [data, kind, editData, meta.title]);

  const onPhotoBlockChange = React.useCallback((next: Record<string, string>) => {
    if (!data || kind !== "EVENT") return;
    const ev = data as EventData;
    editData({
      ...ev,
      photo: {
        ...ev.photo,
        url: next.url || "",
        alt: next.alt || "",
        imgRadius: next.imgRadius ? Number(next.imgRadius) : undefined,
        imgRadiusCorners: next.imgRadiusCorners || undefined,
        overlays: next.overlays || undefined,
        aspectRatio: next.aspectRatio ? Number(next.aspectRatio) : undefined,
        bgRemoveTolerance: next.bgRemoveTolerance ? Number(next.bgRemoveTolerance) : undefined,
      },
    });
  }, [data, kind, editData]);

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
      // Форсимо `data.title = meta.title` у serialized templateData, щоб
      // публічний рендер на /news/{slug} мав той самий заголовок, що в БД.
      const dataToSave = kind === "ARTICLE"
        ? { ...(data as ArticleData), title: meta.title }
        : { ...(data as EventData), title: meta.title };
      const payload = {
        title: meta.title,
        slug: meta.slug,
        excerpt: meta.excerpt,
        templateData: JSON.stringify(dataToSave),
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
    <NewsEditorActionsContext.Provider value={{ undo, redo }}>
    <>
    {/* Google Fonts — той самий набір що в білдері новин (потрібен для
        HeadingEditor + TextStudioModal). Підключаємо через head injection,
        бо TemplateEditor може бути не загорнутий у NewsEditor. */}
    <link rel="stylesheet" href={buildGoogleFontsHref()} />
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

        {/* Undo / Redo — глобальна історія data+meta. Ctrl+Z / Ctrl+Shift+Z теж
            працюють (keyboard handler у useEffect). */}
        <div style={{ display: "inline-flex", gap: 4 }}>
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            title="Скасувати (Ctrl+Z)"
            aria-label="Скасувати"
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              border: "1px solid #E8D5B7",
              background: "#FFFFFF",
              color: canUndo ? "#1C3A2E" : "#D6CFC0",
              cursor: canUndo ? "pointer" : "not-allowed",
              fontSize: 15,
              fontFamily: ff,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.15s, color 0.15s",
            }}
          >↶</button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            title="Повторити (Ctrl+Shift+Z)"
            aria-label="Повторити"
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              border: "1px solid #E8D5B7",
              background: "#FFFFFF",
              color: canRedo ? "#1C3A2E" : "#D6CFC0",
              cursor: canRedo ? "pointer" : "not-allowed",
              fontSize: 15,
              fontFamily: ff,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.15s, color 0.15s",
            }}
          >↷</button>
        </div>

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

        {/* Превʼю — fullscreen iframe з /uk/news/{slug}?preview=1
            (той самий паттерн що в /dashboard/admin/news). */}
        <button
          type="button"
          onClick={() => {
            if (!meta.slug.trim()) {
              setToast({ message: "Заповни slug, щоб подивитись превʼю", type: "error" });
              return;
            }
            setPreviewOpen(true);
          }}
          title={`Превʼю · /news/${meta.slug}`}
          style={{
            padding: "10px 14px",
            fontSize: 13,
            fontWeight: 700,
            background: "#FFFFFF",
            color: "#1C3A2E",
            border: "1px solid #E8D5B7",
            borderRadius: 10,
            cursor: "pointer",
            fontFamily: ff,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            transition: "background 0.15s, border-color 0.15s",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = "#FAF6F0";
            e.currentTarget.style.borderColor = "#D4A843";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = "#FFFFFF";
            e.currentTarget.style.borderColor = "#E8D5B7";
          }}
        >
          <span aria-hidden>👁</span>
          <span>Превʼю</span>
        </button>

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

      {/* Fullscreen iframe-превʼю. Той самий паттерн що в /dashboard/admin/news
          (itemPreview modal): backdrop + центрований iframe з ?preview=1 для
          unpublished/template новин. Закриття: backdrop click, Esc, ✕ кнопка. */}
      {previewOpen && (
        <div
          onClick={() => setPreviewOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            background: "rgba(28,25,23,0.85)",
            backdropFilter: "blur(8px)",
            display: "flex",
            flexDirection: "column",
            fontFamily: ff,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 20px",
              borderBottom: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, color: "rgba(255,255,255,0.9)", minWidth: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                Превʼю · /news/{meta.slug}
              </span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {meta.title}
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setPreviewOpen(false); }}
              title="Закрити (Esc)"
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.8)",
                cursor: "pointer",
                fontSize: 16,
                fontFamily: ff,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ✕
            </button>
          </div>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ flex: 1, overflow: "hidden", padding: 24 }}
          >
            <div
              style={{
                margin: "0 auto",
                height: "100%",
                maxWidth: 1280,
                borderRadius: 10,
                overflow: "hidden",
                boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
                background: "#FFFFFF",
              }}
            >
              <iframe
                key={meta.slug}
                src={`/uk/news/${meta.slug}?preview=1`}
                title={`Превʼю · ${meta.title}`}
                style={{ width: "100%", height: "100%", border: 0 }}
              />
            </div>
          </div>
        </div>
      )}

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
          {/* Settings-slot для активного preview-блоку. Той самий пайплайн, що в
              білдері новин: HeadingEditor/ImageEditor портал-ять свої панелі
              сюди через document.getElementById("news-block-settings-slot").
              Видимий тільки коли є виділений блок (CSS :empty). */}
          <div
            className="template-settings-wrapper"
            style={{ marginBottom: 16 }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#9B7C45",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              {selectedBlock === "title" ? "🅣 Заголовок · налаштування" :
               selectedBlock === "photo" ? "🖼 Фото · налаштування" :
               "Налаштування блока"}
            </div>
            <div
              id="news-block-settings-slot"
              style={{
                display: "flex",
                flexDirection: "column",
                background: "#FAF6F0",
                border: "1px solid #E8D5B7",
                borderRadius: 10,
                overflow: "hidden",
              }}
            />
          </div>
          <style>{`
            #news-block-settings-slot > * + * { border-top: 1px solid #EEEAE2; }
            .template-settings-wrapper:has(#news-block-settings-slot:empty) { display: none; }
          `}</style>
          {/* ── META block (зверху): Заголовок + Slug + Excerpt разом ──────
              Логіка: усе що не на картці (адмінка + SEO + URL) згруповано
              нагорі. Менеджер бачить мета-частину один раз і далі редагує
              контент. */}
          <div
            style={{
              position: "relative",
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
              />
              <TextInput
                label="Slug (URL)"
                value={meta.slug}
                onChange={v => setMeta({ ...meta, slug: v })}
              />
            </div>
            {/* EVENT-only: око 👁 — позиціоновано АБСОЛЮТНО у правому нижньому
                куті мета-блоку, на 6px вище нижньої риски (як у SectionHeader-ах
                з paddingBottom:6). Однакова X-координата і відступ від риски,
                як у Фото фахівця, Фахівець, Вартість і тривалість. */}
            {kind === "EVENT" && (() => {
              const eventData = data as EventData;
              const titleHidden = eventData.hidden?.title === true;
              const toggle = () => {
                const next = { ...(eventData.hidden || {}) };
                if (titleHidden) delete next.title;
                else next.title = true;
                editData({ ...eventData, hidden: next });
              };
              return (
                <button
                  type="button"
                  onClick={toggle}
                  onMouseEnter={() => setFocusedRegion("title")}
                  onMouseLeave={() => setFocusedRegion(null)}
                  title={titleHidden ? "Показати заголовок над карткою" : "Сховати заголовок з-над картки"}
                  aria-label={titleHidden ? "Показати заголовок" : "Сховати заголовок"}
                  style={{
                    position: "absolute",
                    right: 0,
                    top: -10,
                    width: 28,
                    height: 24,
                    borderRadius: 5,
                    border: "1px solid #E8D5B7",
                    background: titleHidden ? "#FFFFFF" : "#FAF6F0",
                    color: titleHidden ? "#9B7C45" : "#1C3A2E",
                    cursor: "pointer",
                    fontSize: 11,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: ff,
                    padding: 0,
                    zIndex: 1,
                  }}
                >
                  {titleHidden ? "🚫" : "👁"}
                </button>
              );
            })()}
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

          {/* Kind-specific form (фактичний контент картки) */}
          {kind === "ARTICLE" ? (
            <ArticleForm
              data={data as ArticleData}
              onChange={d => editData(d)}
              onFocusRegion={setFocusedArticleRegion}
            />
          ) : (
            <EventForm
              data={data as EventData}
              onChange={d => editData(d)}
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
                  onChange={patch => data && editData(applyArticleCoverPatch(data as ArticleData, patch))}
                />
                <PreviewCanvas>
                  <div style={{ padding: "32px 24px", display: "flex", justifyContent: "center" }}>
                    <TemplatePreviewCard
                      kind={kind}
                      data={dataForRender as ArticleData}
                      onCoverFocalClick={(x, y) => data && editData(applyArticleCoverPatch(data as ArticleData, { previewFocalX: x, previewFocalY: y }))}
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
                  onChange={patch => data && editData(applyArticleCoverPatch(data as ArticleData, patch))}
                />
                <PreviewCanvas>
                  <div style={{ padding: "32px 24px", background: "#FFFFFF", width: "100%" }}>
                    <ArticleTemplate
                      data={dataForRender as ArticleData}
                      highlight={focusedArticleRegion}
                      onCoverFocalClick={(x, y) => data && editData(applyArticleCoverPatch(data as ArticleData, { pageFocalX: x, pageFocalY: y }))}
                    />
                  </div>
                </PreviewCanvas>
              </PreviewSection>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <PreviewSection
                badge="🃏"
                title="У стрічці /news"
                hint="так картка зʼявиться у списку новин · потягни кут щоб змінити розмір"
                accent="#A8956C"
              >
                <CoverImageToolbar
                  scope="preview"
                  cover={(data as EventData).photo}
                  onChange={patch => data && editData(applyEventPhotoPatch(data as EventData, patch))}
                  onResetCardSize={() => {
                    if (!data) return;
                    const ev = data as EventData;
                    // Context-aware: скидаємо розмір ТОГО блоку який зараз обраний.
                    // Якщо нічого не обрано — скидаємо обидва.
                    if (selectedBlock === "title") {
                      editData({ ...ev, titleWidth: undefined, titleHeight: undefined });
                    } else if (selectedBlock === "photo") {
                      editData({ ...ev, cardWidth: EVENT_CARD_WIDTH_DEFAULT, cardHeight: EVENT_CARD_HEIGHT_DEFAULT });
                    } else {
                      editData({
                        ...ev,
                        cardWidth: EVENT_CARD_WIDTH_DEFAULT,
                        cardHeight: EVENT_CARD_HEIGHT_DEFAULT,
                        titleWidth: undefined,
                        titleHeight: undefined,
                      });
                    }
                  }}
                  cardSizeIsDefault={
                    selectedBlock === "title"
                      ? (data as EventData).titleWidth === undefined && (data as EventData).titleHeight === undefined
                      : ((data as EventData).cardWidth || EVENT_CARD_WIDTH_DEFAULT) === EVENT_CARD_WIDTH_DEFAULT &&
                        ((data as EventData).cardHeight || EVENT_CARD_HEIGHT_DEFAULT) === EVENT_CARD_HEIGHT_DEFAULT
                  }
                  resetLabel={
                    selectedBlock === "title" ? "Стандартний розмір заголовка" :
                    selectedBlock === "photo" ? "Стандартний розмір картки" :
                    "Стандартний розмір"
                  }
                />
                <ResizableEventPreview
                  data={dataForRender as EventData}
                  onChange={d => editData(d)}
                  highlight={focusedRegion}
                  onPhotoFocalClick={(x, y) => data && editData(applyEventPhotoPatch(data as EventData, { previewFocalX: x, previewFocalY: y }))}
                  titleSlot={titleBlock && !(data as EventData).hidden?.title && (
                    <HeadingEditor
                      block={titleBlock}
                      onChange={onTitleBlockChange}
                      selected={selectedBlock === "title"}
                      containerWidthPx={(data as EventData).cardWidth || EVENT_CARD_WIDTH_DEFAULT}
                      onSetVAlign={() => { /* vAlign не релевантне для inline-heading у картці */ }}
                    />
                  )}
                  onTitleClick={() => setSelectedBlock("title")}
                  onPhotoClick={() => setSelectedBlock("photo")}
                  titleSelected={selectedBlock === "title"}
                  photoSelected={selectedBlock === "photo"}
                />
                {/* Off-screen ImageEditor — рендериться завжди, щоб його sidebar
                    портал-ився у #news-block-settings-slot коли фото виділене.
                    Photo візуально рендериться через CoverImageBox у photo-секції
                    EventTemplate (cover + focal-point, без розтяжки). ImageEditor
                    тут лише для sidebar-функціоналу: alt + radius/crop/chroma +
                    ImageStudioModal на повний екран. */}
                {photoBlock && (
                  <div aria-hidden style={{
                    position: "absolute",
                    left: -99999,
                    top: -99999,
                    width: Math.round(((data as EventData).cardWidth || EVENT_CARD_WIDTH_DEFAULT) * 0.46),
                    height: (data as EventData).cardHeight || EVENT_CARD_HEIGHT_DEFAULT,
                    pointerEvents: "none",
                  }}>
                    <ImageEditor
                      block={photoBlock}
                      onChange={onPhotoBlockChange}
                      onUpload={uploadPhoto}
                      selected={selectedBlock === "photo"}
                      onSelectBlock={() => setSelectedBlock("photo")}
                      containerWidthPx={Math.round(((data as EventData).cardWidth || EVENT_CARD_WIDTH_DEFAULT) * 0.46)}
                      previewHeight={(data as EventData).cardHeight || EVENT_CARD_HEIGHT_DEFAULT}
                    />
                  </div>
                )}
              </PreviewSection>
              {/* EVENT-шаблон рендерить ОДНАКОВУ картку у feed і на повній
                  сторінці. Дублікат-блоку «Повна сторінка» прибрано — налаштування
                  з feed (fit/scale/focal) автоматично застосовуються до публічного
                  рендеру `/news/{slug}` через applyEventPhotoPatch (always-sync
                  preview→page). Для ARTICLE дубль зберігається бо preview ≠ page. */}
            </div>
          )}
        </main>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
    </div>
    </>
    </NewsEditorActionsContext.Provider>
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
/** Pure-функція: обчислити наступний ArticleData при patch-у cover.
 *  Caller сам викликає editData(next) щоб збереглось у undo-history. */
function applyArticleCoverPatch(article: ArticleData, patch: Partial<ArticleImage>): ArticleData {
  const cover = article.cover;
  const next: ArticleImage = { ...cover, ...patch };
  if (next.linkScale) {
    if (patch.previewFit !== undefined) next.pageFit = patch.previewFit;
    if (patch.pageFit !== undefined) next.previewFit = patch.pageFit;
    if (patch.previewScale !== undefined) next.pageScale = patch.previewScale;
    if (patch.pageScale !== undefined) next.previewScale = patch.pageScale;
    // Focal-point теж синкається коли linkScale=true.
    if (patch.previewFocalX !== undefined) next.pageFocalX = patch.previewFocalX;
    if (patch.previewFocalY !== undefined) next.pageFocalY = patch.previewFocalY;
    if (patch.pageFocalX !== undefined) next.previewFocalX = patch.pageFocalX;
    if (patch.pageFocalY !== undefined) next.previewFocalY = patch.pageFocalY;
  }
  if (patch.linkScale === true && cover.linkScale !== true) {
    next.pageFit = next.previewFit;
    next.pageScale = next.previewScale;
    const fx = next.previewFocalX ?? next.focalX ?? 50;
    const fy = next.previewFocalY ?? next.focalY ?? 50;
    next.previewFocalX = fx; next.previewFocalY = fy;
    next.pageFocalX = fx; next.pageFocalY = fy;
  }
  return { ...article, cover: next };
}

/** EVENT-version applyArticleCoverPatch для data.photo. */
function applyEventPhotoPatch(event: EventData, patch: Partial<ArticleImage>): EventData {
  const photo = event.photo;
  const next: ArticleImage = { ...photo, ...patch };
  // EVENT-шаблон: ОДНА і та сама картка рендериться у feed і на повній сторінці,
  // тож preview-* і page-* завжди синхронізуються (без оглядки на linkScale).
  // Редактор показує лише feed-блок; зміна fit/scale/focal автоматично дублюється
  // в page-*-поля щоб публічний рендер `/news/{slug}` мав ті ж значення.
  if (patch.previewFit !== undefined) next.pageFit = patch.previewFit;
  if (patch.previewScale !== undefined) next.pageScale = patch.previewScale;
  if (patch.previewFocalX !== undefined) next.pageFocalX = patch.previewFocalX;
  if (patch.previewFocalY !== undefined) next.pageFocalY = patch.previewFocalY;
  return { ...event, photo: next };
}

/** Toolbar над preview-блоком для керування cover-зображенням.
 *  scope визначає чи редагуємо preview-конфіг чи page-конфіг. Lock 🔗 живе
 *  лише на page-toolbar (preview — provider). */
function CoverImageToolbar({
  scope,
  cover,
  onChange,
  onResetCardSize,
  cardSizeIsDefault,
  resetLabel,
}: {
  scope: "preview" | "page";
  cover: ArticleImage;
  onChange: (patch: Partial<ArticleImage>) => void;
  onResetCardSize?: () => void;
  cardSizeIsDefault?: boolean;
  resetLabel?: string;
}) {
  const scale = scope === "preview" ? (cover.previewScale ?? 1) : (cover.pageScale ?? 1);
  const linked = cover.linkScale === true;
  const fitKey = scope === "preview" ? "previewFit" : "pageFit";
  const scaleKey = scope === "preview" ? "previewScale" : "pageScale";
  const disabled = !cover.url;
  const sliderMin = 50;
  const sliderMax = 200;
  // Quick-action: фото в реальних пропорціях, повністю видно (contain, scale=1)
  const expandToFit = () => onChange({ [fitKey]: "contain", [scaleKey]: 1 });
  // Quick-action: фото заповнює весь слот, можливий crop (cover, scale=1)
  const fillSlot = () => onChange({ [fitKey]: "cover", [scaleKey]: 1 });

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

      {/* Quick-actions: Розгорнути (contain до краю по довшій стороні) +
          Заповнити (cover, всі краї впритул). */}
      <div style={{ display: "inline-flex", gap: 4 }}>
        <button
          type="button"
          onClick={expandToFit}
          style={{
            padding: "5px 10px",
            fontSize: 11,
            fontWeight: 600,
            border: "1px solid #E8D5B7",
            background: "#FFFFFF",
            color: "#57534E",
            cursor: "pointer",
            fontFamily: ff,
            borderRadius: 6,
          }}
          title="Розгорнути — фото у реальних пропорціях, по довшій стороні впритул до краю слоту"
        >
          ⤢ Розгорнути
        </button>
        <button
          type="button"
          onClick={fillSlot}
          style={{
            padding: "5px 10px",
            fontSize: 11,
            fontWeight: 600,
            border: "1px solid #E8D5B7",
            background: "#FFFFFF",
            color: "#57534E",
            cursor: "pointer",
            fontFamily: ff,
            borderRadius: 6,
          }}
          title="Заповнити — фото на весь слот, всі краї впритул (можливий crop)"
        >
          ⛶ Заповнити
        </button>
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

      {onResetCardSize && (
        <button
          type="button"
          onClick={onResetCardSize}
          disabled={cardSizeIsDefault}
          title={cardSizeIsDefault
            ? "Картка вже стандартного розміру"
            : `Повернути до стандартного розміру (${EVENT_CARD_WIDTH_DEFAULT}×${EVENT_CARD_HEIGHT_DEFAULT})`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 10px",
            fontSize: 11,
            fontWeight: 600,
            fontFamily: ff,
            color: cardSizeIsDefault ? "#A8956C" : "#1C3A2E",
            background: cardSizeIsDefault ? "rgba(255,255,255,0.6)" : "#FFFFFF",
            border: `1px solid ${cardSizeIsDefault ? "#E8D5B7" : "#D4A843"}`,
            borderRadius: 6,
            cursor: cardSizeIsDefault ? "not-allowed" : "pointer",
          }}
        >
          <span aria-hidden style={{ fontSize: 12, lineHeight: 1 }}>↺</span>
          <span>{resetLabel || "Стандартний розмір"}</span>
        </button>
      )}

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

/** Preview-канвас editor-mode: дві незалежні resizable-секції стеком —
 *  HEADING-блок зверху (titleWidth × titleHeight) і BODY-картка знизу
 *  (cardWidth × cardHeight). Кожен блок має власні drag-handles на трьох
 *  напрямках (право, низ, діагональ). Resize-handles видимі при hover
 *  або коли блок виділений. */
function ResizableEventPreview({
  data,
  onChange,
  highlight,
  onPhotoFocalClick,
  titleSlot,
  photoSlot,
  onTitleClick,
  onPhotoClick,
  titleSelected,
  photoSelected,
}: {
  data: EventData;
  onChange: (next: EventData) => void;
  highlight: EventRegion | null;
  onPhotoFocalClick?: (x: number, y: number) => void;
  titleSlot?: React.ReactNode;
  photoSlot?: React.ReactNode;
  onTitleClick?: () => void;
  onPhotoClick?: () => void;
  titleSelected?: boolean;
  photoSelected?: boolean;
}) {
  const cardWidth = data.cardWidth || EVENT_CARD_WIDTH_DEFAULT;
  const cardHeight = data.cardHeight || EVENT_CARD_HEIGHT_DEFAULT;
  // Default heading width = cardWidth (heading рівний картці), height = auto
  // (по контенту). Якщо менеджер ресайзив — використовуємо збережене значення.
  const titleWidth = data.titleWidth ?? cardWidth;
  const titleHeight = data.titleHeight ?? null;

  return (
    <div
      style={{
        background: "#F5F1E8",
        borderRadius: 16,
        border: "1px solid #E8D5B7",
        overflowX: "auto",
        overflowY: "hidden",
        position: "relative",
      }}
    >
      <div style={{ padding: "32px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, minWidth: "min-content" }}>
        {/* HEADING block — own resizable wrapper. Якщо hidden.title — нічого. */}
        {titleSlot && !data.hidden?.title && (
          <ResizableBox
            width={titleWidth}
            height={titleHeight ?? undefined}
            minWidth={EVENT_TITLE_WIDTH_MIN}
            maxWidth={EVENT_TITLE_WIDTH_MAX}
            minHeight={EVENT_TITLE_HEIGHT_MIN}
            maxHeight={EVENT_TITLE_HEIGHT_MAX}
            selected={!!titleSelected}
            onResize={(w, h) => onChange({ ...data, titleWidth: w, titleHeight: h })}
            label="Заголовок"
          >
            <div
              onClick={onTitleClick}
              style={{
                padding: "26px 28px 24px",
                background: "#FFFFFF",
                borderRadius: 18,
                boxShadow: "0 6px 20px -10px rgba(28,58,46,0.15)",
                textAlign: "center",
                fontFamily: "Inter, system-ui, -apple-system, sans-serif",
                color: "#1C3A2E",
                fontSize: 20,
                fontWeight: 700,
                lineHeight: 1.35,
                width: "100%",
                height: "100%",
                cursor: onTitleClick ? "pointer" : undefined,
                ...(titleSelected ? {
                  outline: "2px solid #D4A843",
                  outlineOffset: 3,
                  boxShadow: "0 0 0 6px rgba(212,168,67,0.20), 0 8px 24px -4px rgba(212,168,67,0.45)",
                } : {}),
              }}
            >
              {titleSlot}
            </div>
          </ResizableBox>
        )}

        {/* BODY card — own resizable wrapper. EventTemplate з skipHeading=true. */}
        <ResizableBox
          width={cardWidth}
          height={cardHeight}
          minWidth={EVENT_CARD_WIDTH_MIN}
          maxWidth={EVENT_CARD_WIDTH_MAX}
          minHeight={EVENT_CARD_HEIGHT_MIN}
          maxHeight={EVENT_CARD_HEIGHT_MAX}
          selected={!!photoSelected}
          onResize={(w, h) => onChange({ ...data, cardWidth: w, cardHeight: h })}
          label="Картка"
        >
          <TemplatePreviewCard
            kind="EVENT"
            data={data}
            width={cardWidth}
            height={cardHeight}
            highlight={highlight}
            onPhotoFocalClick={onPhotoFocalClick}
            photoSlot={photoSlot}
            onPhotoClick={onPhotoClick}
            photoSelected={photoSelected}
            skipHeading={true}
          />
        </ResizableBox>
      </div>
    </div>
  );
}

/** Generic resizable-обгортка: дитячий контент займає width × height,
 *  resize-handles (право/низ/діагональ) видимі при hover або selected. */
function ResizableBox({
  width,
  height,
  minWidth,
  maxWidth,
  minHeight,
  maxHeight,
  selected,
  onResize,
  label,
  children,
}: {
  width: number;
  height?: number;
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
  selected: boolean;
  onResize: (w: number, h: number) => void;
  label: string;
  children: React.ReactNode;
}) {
  type ResizeMode = "x" | "y" | "xy";
  const [resizing, setResizing] = useState<ResizeMode | null>(null);
  const [hover, setHover] = useState(false);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const startXRef = React.useRef(0);
  const startYRef = React.useRef(0);
  const startWRef = React.useRef(0);
  const startHRef = React.useRef(0);
  const draftWRef = React.useRef(width);
  const draftHRef = React.useRef(height ?? 0);

  const beginResize = (mode: ResizeMode, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Якщо height auto — беремо поточну виміряну висоту як стартову.
    const measuredH = height ?? (containerRef.current?.getBoundingClientRect().height || minHeight);
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    startWRef.current = width;
    startHRef.current = measuredH;
    draftWRef.current = width;
    draftHRef.current = measuredH;
    setResizing(mode);
    const cursor = mode === "x" ? "ew-resize" : mode === "y" ? "ns-resize" : "nwse-resize";
    const onMove = (ev: MouseEvent) => {
      let nextW = draftWRef.current;
      let nextH = draftHRef.current;
      if (mode === "x" || mode === "xy") {
        const dx = ev.clientX - startXRef.current;
        nextW = Math.max(minWidth, Math.min(maxWidth, Math.round((startWRef.current + dx) / 10) * 10));
      }
      if (mode === "y" || mode === "xy") {
        const dy = ev.clientY - startYRef.current;
        nextH = Math.max(minHeight, Math.min(maxHeight, Math.round((startHRef.current + dy) / 10) * 10));
      }
      if (nextW === draftWRef.current && nextH === draftHRef.current) return;
      draftWRef.current = nextW;
      draftHRef.current = nextH;
      onResize(nextW, nextH);
    };
    const onUp = () => {
      setResizing(null);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.style.cursor = cursor;
    document.body.style.userSelect = "none";
  };

  const showHandles = hover || resizing !== null || selected;
  const handleColor = "#1C3A2E";
  const handleActiveColor = "#D4A843";

  return (
    <div
      ref={containerRef}
      data-block-region={label}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        width: `${width}px`,
        height: height ? `${height}px` : "auto",
      }}
    >
      {children}

      {/* Right edge — лише ширина */}
      <div
        onMouseDown={(e) => beginResize("x", e)}
        title={`Ширина: ${width}px · потягни (${minWidth}–${maxWidth})`}
        style={{
          position: "absolute",
          right: -8,
          top: "20%",
          bottom: "20%",
          width: 16,
          cursor: "ew-resize",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10,
          opacity: showHandles ? 1 : 0,
          transition: "opacity 0.15s",
        }}
      >
        <div style={{
          width: 4, height: 40, borderRadius: 4,
          background: resizing === "x" ? handleActiveColor : handleColor,
          transition: "background 0.15s",
          boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
        }} />
      </div>

      {/* Bottom edge — лише висота */}
      <div
        onMouseDown={(e) => beginResize("y", e)}
        title={`Висота: ${height ?? "auto"}px · потягни (${minHeight}–${maxHeight})`}
        style={{
          position: "absolute",
          left: "20%",
          right: "20%",
          bottom: -8,
          height: 16,
          cursor: "ns-resize",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10,
          opacity: showHandles ? 1 : 0,
          transition: "opacity 0.15s",
        }}
      >
        <div style={{
          height: 4, width: 40, borderRadius: 4,
          background: resizing === "y" ? handleActiveColor : handleColor,
          transition: "background 0.15s",
          boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
        }} />
      </div>

      {/* SE corner — діагональ */}
      <div
        onMouseDown={(e) => beginResize("xy", e)}
        title={`Розмір ${label}: ${width}×${height ?? "auto"}px · потягни діагонально`}
        style={{
          position: "absolute",
          right: -10,
          bottom: -10,
          width: 22, height: 22,
          cursor: "nwse-resize",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 12,
          opacity: showHandles ? 1 : 0,
          transition: "opacity 0.15s",
        }}
      >
        <div aria-hidden style={{
          width: 16, height: 16, borderRadius: 4,
          background: resizing === "xy" ? handleActiveColor : handleColor,
          boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
          position: "relative",
        }}>
          <span style={{ position: "absolute", right: 3, bottom: 3, width: 9, height: 2, background: "#F5E1A4", transform: "rotate(-45deg)", transformOrigin: "right bottom", borderRadius: 1 }} />
          <span style={{ position: "absolute", right: 3, bottom: 7, width: 5, height: 2, background: "#F5E1A4", transform: "rotate(-45deg)", transformOrigin: "right bottom", borderRadius: 1 }} />
        </div>
      </div>

      {/* Float-badge з поточним розміром */}
      {(resizing !== null || hover || selected) && (
        <div style={{
          position: "absolute",
          right: -8,
          top: -28,
          padding: "3px 8px",
          background: "#1C3A2E",
          color: "#F5E1A4",
          fontSize: 11,
          fontWeight: 700,
          fontFamily: ff,
          borderRadius: 6,
          fontVariantNumeric: "tabular-nums",
          pointerEvents: "none",
          whiteSpace: "nowrap",
        }}>
          {label}: {width} × {height ?? "auto"} px
        </div>
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
