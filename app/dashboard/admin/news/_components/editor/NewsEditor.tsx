"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { HiOutlineCheckCircle } from "react-icons/hi2";
import { Block, NewsMeta, blocksToJson, jsonToBlocks } from "./types";
import EditorCanvas from "./EditorCanvas";
import MetaSidebar from "./MetaSidebar";
import NewsLibrarySidebar from "./NewsLibrarySidebar";
import SlugSidebar from "./SlugSidebar";
import { NEWS_BLOCK_CSS } from "@/lib/news/render";

// Multi-tab NewsEditor.
// Backward-compat: одиночний контент (initialContent + onSave) працює як раніше.
// Новий режим: tabs[] — по канвасу на кожен таб (контент / превʼю / тощо).
// Кожна вкладка має:
//   - власні блоки state
//   - власну історію undo/redo
//   - власний selection
// Спільні: meta, save кнопка, палітра/MetaSidebar.

const HISTORY_CAP = 80;
const HISTORY_DEBOUNCE_MS = 350;
const DEFAULT_TAB_KEY = "main";

interface TabConfig {
  key: string;
  label: string;
  initialContent: string;
}

interface DraftPayload {
  meta: NewsMeta;
  blocksByTab: Record<string, Block[]>;
  savedAt: number;
}

type DraftMode = "post" | "page" | "preview";

// `mode` у ключі — щоб draft з content-білдера (`/[id]/edit`, mode=post) не
// перетирався з draft превʼю-картки (`/[id]/preview`, mode=preview) — обидва
// мають один newsId, але редагують РІЗНІ поля БД (content vs previewContent).
// Для post лишаємо старий ключ без префікса (backward-compat для in-flight чернеток).
function draftKey(newsId: string | undefined, mode: DraftMode) {
  const id = newsId || "new";
  return mode === "post" ? `uimp_draft_${id}` : `uimp_draft_${mode}_${id}`;
}

function saveDraft(meta: NewsMeta, blocksByTab: Record<string, Block[]>, newsId: string | undefined, mode: DraftMode) {
  try {
    const payload: DraftPayload = { meta, blocksByTab, savedAt: Date.now() };
    localStorage.setItem(draftKey(newsId, mode), JSON.stringify(payload));
  } catch { /* localStorage недоступний */ }
}
function clearDraft(newsId: string | undefined, mode: DraftMode) {
  try { localStorage.removeItem(draftKey(newsId, mode)); } catch { /* ignore */ }
}
function loadDraft(newsId: string | undefined, mode: DraftMode): DraftPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(draftKey(newsId, mode));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.meta) return null;
    // Backward compat: старий формат {meta, blocks}.
    if (Array.isArray(parsed.blocks)) {
      return { meta: parsed.meta, blocksByTab: { [DEFAULT_TAB_KEY]: parsed.blocks }, savedAt: parsed.savedAt || 0 };
    }
    if (parsed.blocksByTab && typeof parsed.blocksByTab === "object") {
      return parsed as DraftPayload;
    }
    return null;
  } catch { return null; }
}

interface HistorySnap { meta: NewsMeta; blocks: Block[] }

interface BaseProps {
  pageTitle: string;
  initialMeta?: Partial<NewsMeta>;
  newsId?: string;
  onBack: () => void;
  saving: boolean;
  /** "post" — канвас редагує `News.content` (повний контент сторінки новини).
   *  "preview" — канвас редагує `News.previewContent` (картка-превʼю для /news).
   *  "page" — канвас редагує `NewsPage.content` (лендинг /news). */
  mode?: "post" | "page" | "preview";
  /** Чи показувати MetaSidebar (Публікація / Slug / Категорія / Обкладинка / Фон).
   *  За замовчуванням: post / preview → true; page → false (там окремий
   *  NewsLibrarySidebar). Override-иться явно через props. */
  metaSidebar?: boolean;
  /** Ширина канвасу — пробрасується до EditorCanvas. Default — full-page (920).
   *  Для білдера превʼю-картки: PREVIEW_CARD_WIDTH (360). */
  canvasWidth?: number;
  /** Мінімальна висота канвасу. Default 500 (full-page). */
  minCanvasHeight?: number;
  /** Кастомні підписи на chrome-смужці канвасу. */
  canvasLabel?: { left: string; right: string };
  /** Запас вільного місця під останнім блоком. Default 240. */
  bottomSlack?: number;
  /** Заблокувати висоту канвасу на minCanvasHeight (не росте під контент).
   *  Для card-builder-а — картка має фіксовані розміри. */
  fixedHeight?: boolean;
  /** Slim-режим правого бару: тільки Slug-input. Title та imageUrl
   *  автоматично деривуються з канвасу при збереженні
   *  (перший heading-блок → title, перший image-блок → imageUrl). */
  slugOnlyMeta?: boolean;
}

interface SingleProps extends BaseProps {
  initialContent?: string;
  onSave: (meta: NewsMeta, content: string, imageUrl: string) => Promise<void>;
  tabs?: undefined;
  onSaveTabs?: undefined;
}

interface TabbedProps extends BaseProps {
  tabs: TabConfig[];
  onSaveTabs: (meta: NewsMeta, contents: Record<string, string>, imageUrl: string) => Promise<void>;
  initialContent?: undefined;
  onSave?: undefined;
}

type Props = SingleProps | TabbedProps;

export default function NewsEditor(props: Props) {
  const { pageTitle, initialMeta, newsId, saving, mode = "post" } = props;
  // metaSidebar: явний prop > дефолт по mode (post/preview=true, page=false).
  const showMetaSidebar = props.metaSidebar ?? (mode === "post" || mode === "preview");
  void props.onBack;

  const def: NewsMeta = { title: "", slug: "", excerpt: "", category: "NEWS", imageUrl: "", published: false };

  // Нормалізуємо tabs — single-tab caller автоматом отримує один таб "main".
  const effectiveTabs: TabConfig[] = useMemo(() => {
    if ("tabs" in props && props.tabs && props.tabs.length > 0) return props.tabs;
    return [{ key: DEFAULT_TAB_KEY, label: "", initialContent: ("initialContent" in props ? props.initialContent : "") || "" }];
    // initialContent зміни приходять через окремий ефект нижче (синхронізація з parent fetch).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    "tabs" in props ? props.tabs : null,
    "initialContent" in props ? props.initialContent : null,
  ]);

  const isMultiTab = effectiveTabs.length > 1;

  // Відновлення з localStorage при першому маунті.
  const initialDraft = loadDraft(newsId, mode);

  const [meta, setMeta] = useState<NewsMeta>(() => initialDraft?.meta ?? { ...def, ...initialMeta });

  // blocksByTab — Record<TabKey, Block[]>. Якщо в драфті є ключ — беремо звідти, інакше з initialContent.
  const [blocksByTab, setBlocksByTab] = useState<Record<string, Block[]>>(() => {
    const out: Record<string, Block[]> = {};
    for (const t of effectiveTabs) {
      const draftBlocks = initialDraft?.blocksByTab?.[t.key];
      out[t.key] = draftBlocks ?? jsonToBlocks(t.initialContent || "");
    }
    return out;
  });

  // Selection per tab — щоб перемикання табів не "переносило" виділення між канвасами.
  const [selectedByTab, setSelectedByTab] = useState<Record<string, string | null>>(() => {
    const out: Record<string, string | null> = {};
    for (const t of effectiveTabs) out[t.key] = null;
    return out;
  });

  const [activeTab, setActiveTab] = useState<string>(effectiveTabs[0].key);

  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);

  // ── Page zoom (Ctrl+wheel) ───────────────────────────────────────────────
  const [zoom, setZoom] = useState(1);
  const editorRootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = editorRootRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const step = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(z => Math.max(0.5, Math.min(2, +(z + step).toFixed(2))));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === "0") {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
        e.preventDefault();
        setZoom(1);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // ── Undo/Redo per tab ────────────────────────────────────────────────────
  // Map<tabKey, {history, pointer}>. Тригер ре-рендеру disabled-стану — historyTick.
  const histRef = useRef<Map<string, { history: HistorySnap[]; pointer: number }>>(new Map());
  const skipPushRef = useRef<Set<string>>(new Set());
  const pushTimerRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [historyTick, setHistoryTick] = useState(0);
  void historyTick;

  // Sync state from parent (initialContent / tabs.initialContent) — ТІЛЬКИ коли реально змінилось.
  // Зберігаємо попередні значення в ref щоб не перезаписувати state на double-mount React 18.
  const prevInitialRef = useRef<string>("");
  useEffect(() => {
    const sig = JSON.stringify(effectiveTabs.map(t => ({ k: t.key, c: t.initialContent })));
    if (!prevInitialRef.current) { prevInitialRef.current = sig; return; }
    if (prevInitialRef.current === sig) return;
    prevInitialRef.current = sig;
    // Реальна зміна (інша новина) — ресет state до нових значень.
    setMeta({ ...def, ...initialMeta });
    const next: Record<string, Block[]> = {};
    for (const t of effectiveTabs) next[t.key] = jsonToBlocks(t.initialContent || "");
    setBlocksByTab(next);
    histRef.current.clear();
    skipPushRef.current.clear();
    pushTimerRef.current.forEach(clearTimeout);
    pushTimerRef.current.clear();
    setHistoryTick(t => t + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveTabs]);

  // History push для активного таба — debounce.
  useEffect(() => {
    const tab = activeTab;
    if (skipPushRef.current.has(tab)) { skipPushRef.current.delete(tab); return; }
    let entry = histRef.current.get(tab);
    if (!entry) {
      entry = { history: [{ meta, blocks: blocksByTab[tab] || [] }], pointer: 0 };
      histRef.current.set(tab, entry);
      setHistoryTick(t => t + 1);
      return;
    }
    const existing = pushTimerRef.current.get(tab);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      const cur = histRef.current.get(tab);
      if (!cur) return;
      const trimmed = cur.history.slice(0, cur.pointer + 1);
      const last = trimmed[trimmed.length - 1];
      if (last && last.meta === meta && last.blocks === blocksByTab[tab]) return;
      trimmed.push({ meta, blocks: blocksByTab[tab] || [] });
      if (trimmed.length > HISTORY_CAP) trimmed.shift();
      cur.history = trimmed;
      cur.pointer = trimmed.length - 1;
      setHistoryTick(t => t + 1);
    }, HISTORY_DEBOUNCE_MS);
    pushTimerRef.current.set(tab, timer);
  }, [meta, blocksByTab, activeTab]);

  const undo = useCallback(() => {
    const tab = activeTab;
    // Flush pending debounce — щоб undo повернув попередній стан, не той що щойно ввели.
    const pendingTimer = pushTimerRef.current.get(tab);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      pushTimerRef.current.delete(tab);
      const entry = histRef.current.get(tab);
      if (entry) {
        const trimmed = entry.history.slice(0, entry.pointer + 1);
        const last = trimmed[trimmed.length - 1];
        const curBlocks = blocksByTab[tab] || [];
        if (!last || last.meta !== meta || last.blocks !== curBlocks) {
          trimmed.push({ meta, blocks: curBlocks });
          if (trimmed.length > HISTORY_CAP) trimmed.shift();
          entry.history = trimmed;
          entry.pointer = trimmed.length - 1;
        }
      }
    }
    const entry = histRef.current.get(tab);
    if (!entry || entry.pointer <= 0) return;
    entry.pointer -= 1;
    const snap = entry.history[entry.pointer];
    skipPushRef.current.add(tab);
    setMeta(snap.meta);
    setBlocksByTab(prev => ({ ...prev, [tab]: snap.blocks }));
    setHistoryTick(t => t + 1);
  }, [activeTab, meta, blocksByTab]);

  const redo = useCallback(() => {
    const tab = activeTab;
    const entry = histRef.current.get(tab);
    if (!entry || entry.pointer >= entry.history.length - 1) return;
    entry.pointer += 1;
    const snap = entry.history[entry.pointer];
    skipPushRef.current.add(tab);
    setMeta(snap.meta);
    setBlocksByTab(prev => ({ ...prev, [tab]: snap.blocks }));
    setHistoryTick(t => t + 1);
  }, [activeTab]);

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

  // ── Auto-save draft (300ms debounce + flush on hide/unload) ──────────────
  useEffect(() => {
    const t = setTimeout(() => saveDraft(meta, blocksByTab, newsId, mode), 300);
    return () => clearTimeout(t);
  }, [meta, blocksByTab, newsId, mode]);

  const flushRef = useRef({ meta, blocksByTab, newsId, mode });
  useEffect(() => { flushRef.current = { meta, blocksByTab, newsId, mode }; }, [meta, blocksByTab, newsId, mode]);
  useEffect(() => {
    const flush = () => {
      const s = flushRef.current;
      saveDraft(s.meta, s.blocksByTab, s.newsId, s.mode);
    };
    const onVis = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("beforeunload", flush);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("beforeunload", flush);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // ── File upload helper ───────────────────────────────────────────────────
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
    } finally { setUploading(false); }
  };

  // ── Save: серіалізуємо blocks для кожного таба, кличемо відповідний колбек ─
  const handleSave = async (published: boolean) => {
    // Валідація заголовка/slug — там, де менеджер реально їх редагує
    // (MetaSidebar видимий). У content-only edit це не його зона.
    if (showMetaSidebar && (!meta.title || !meta.slug)) {
      setMessage("Заповніть заголовок і slug");
      return;
    }
    if (props.slugOnlyMeta && !meta.slug) {
      setMessage("Заповніть slug у правому барі");
      return;
    }
    setMessage("");

    // Запам'ятовуємо РЕАЛЬНУ висоту кожного блока активного таба з DOM.
    // Для неактивних табів heights з пам'яті — їх wrapper не примонтований до DOM
    // у display:none гілці, але CSS ховання через position+visibility зберігає offsetHeight
    // (нижче ми ховаємо через height:0+overflow:hidden, тож для неактивних беремо з state).
    const bakedByTab: Record<string, Block[]> = {};
    for (const t of effectiveTabs) {
      const blocks = blocksByTab[t.key] || [];
      bakedByTab[t.key] = blocks.map(b => {
        if (typeof document === "undefined") return b;
        const el = document.querySelector(`[data-tab-key="${t.key}"] [data-block-id="${b.id}"]`) as HTMLElement | null;
        const measured = el?.offsetHeight;
        if (measured && measured > 0) return { ...b, height: measured };
        return b;
      });
    }

    const contents: Record<string, string> = {};
    for (const t of effectiveTabs) contents[t.key] = blocksToJson(bakedByTab[t.key]);

    // Cover fallback з content-таба, як раніше.
    const mainTabKey = effectiveTabs.find(t => t.key === DEFAULT_TAB_KEY || t.key === "content")?.key || effectiveTabs[0].key;
    const imageUrl = meta.imageUrl || (bakedByTab[mainTabKey] || []).find(b => b.type === "image")?.data.url || "";

    // У slug-only режимі (білдер превʼю-картки) auto-деривуємо title з
    // першого heading-блока на канвасі, щоб менеджер не дублював його у
    // правому барі. Контент карток слугує source-of-truth для назви.
    let effectiveMeta = meta;
    if (props.slugOnlyMeta) {
      const firstHeading = (bakedByTab[mainTabKey] || []).find(b => b.type === "heading");
      const headingHtml = (firstHeading?.data?.text as string | undefined) || "";
      const headingPlain = headingHtml.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
      if (!headingPlain) {
        setMessage("Додайте блок-заголовок на картку — з нього беремо назву новини");
        return;
      }
      effectiveMeta = { ...meta, title: headingPlain, imageUrl };
    }

    try {
      if (isMultiTab && "onSaveTabs" in props && props.onSaveTabs) {
        await props.onSaveTabs({ ...effectiveMeta, published }, contents, imageUrl);
      } else if ("onSave" in props && props.onSave) {
        const k = effectiveTabs[0].key;
        await props.onSave({ ...effectiveMeta, published }, contents[k], imageUrl);
      }
      clearDraft(newsId, mode);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Невідома помилка збереження";
      setMessage(msg);
    }
  };

  // Обмежуємо setMeta-через MetaSidebar до one-shot (інакше TS infers any).
  const handleMetaChange = (m: NewsMeta) => setMeta(m);

  // Helpers per tab.
  const setBlocksFor = (tabKey: string) => (next: Block[]) =>
    setBlocksByTab(prev => ({ ...prev, [tabKey]: next }));
  const setSelectedFor = (tabKey: string) => (id: string | null) =>
    setSelectedByTab(prev => ({ ...prev, [tabKey]: id }));

  return (
    <div ref={editorRootRef} className="min-h-screen bg-slate-100" style={{ zoom }}>
      <style>{NEWS_BLOCK_CSS}</style>
      <div className="max-w-[1520px] mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-600 mb-1.5">
            Admin · Новини
          </p>
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
          {uploading && (
            <p className="mt-2 text-[12px] font-medium">
              <span className="text-amber-600">Завантаження…</span>
            </p>
          )}
        </div>

        {/* Tab switcher (тільки в multi-tab режимі) */}
        {isMultiTab && (
          <div className="mb-5 inline-flex items-center gap-1 p-1 rounded-xl bg-white shadow-sm border border-stone-200">
            {effectiveTabs.map(t => {
              const active = t.key === activeTab;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveTab(t.key)}
                  className={`px-4 py-2 text-[13px] font-semibold rounded-lg transition-all ${
                    active
                      ? "bg-[#1C3A2E] text-[#D4A843] shadow-sm"
                      : "text-stone-600 hover:bg-stone-100"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Канвас на кожен таб. Display:none для неактивних — щоб state, history,
            selection, draft зберігались і не мігрували між табами. */}
        {effectiveTabs.map(t => {
          const isActive = t.key === activeTab;
          return (
            <div
              key={t.key}
              data-tab-key={t.key}
              style={{ display: isActive ? "block" : "none" }}
            >
              <EditorCanvas
                blocks={blocksByTab[t.key] || []}
                onBlocksChange={setBlocksFor(t.key)}
                onUpload={uploadFile}
                pageBgColor={meta.pageBgColor || ""}
                selectedBlockId={selectedByTab[t.key]}
                onSelectBlock={setSelectedFor(t.key)}
                canvasWidth={props.canvasWidth}
                minCanvasHeight={props.minCanvasHeight}
                canvasLabel={props.canvasLabel}
                bottomSlack={props.bottomSlack}
                fixedHeight={props.fixedHeight}
                rightSidebar={
                  mode === "page" ? (
                    <NewsLibrarySidebar
                      meta={meta}
                      onChange={handleMetaChange}
                      placedNewsIds={new Set(
                        (blocksByTab[t.key] || [])
                          .filter(b => b.type === "newsCard" && b.data.newsId)
                          .map(b => b.data.newsId)
                      )}
                    />
                  ) : props.slugOnlyMeta ? (
                    <SlugSidebar meta={meta} onChange={handleMetaChange} />
                  ) : showMetaSidebar ? (
                    <MetaSidebar meta={meta} onChange={handleMetaChange} onUpload={uploadFile} />
                  ) : null
                }
              />
            </div>
          );
        })}
      </div>

      {/* Floating Save */}
      <button
        type="button"
        onClick={() => handleSave(true)}
        disabled={saving}
        title={saving ? "Збереження…" : "Зберегти"}
        aria-label="Зберегти"
        className="fixed top-20 right-[88px] z-40 group flex items-center justify-center gap-2 h-14 px-6 rounded-full text-[14px] font-semibold text-white shadow-lg transition-all duration-300 ease-out hover:scale-[1.04] active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
        style={{
          backgroundImage:
            "linear-gradient(135deg, #6D28D9 0%, #7C3AED 40%, #D4A017 100%)",
          backgroundSize: "200% 200%",
          boxShadow: [
            "0 6px 20px rgba(109, 40, 217, 0.35)",
            "0 2px 6px rgba(0, 0, 0, 0.12)",
            "0 0 0 1px rgba(255, 255, 255, 0.18)",
            "inset 0 1px 0 rgba(255, 255, 255, 0.22)",
          ].join(", "),
        }}
      >
        <HiOutlineCheckCircle className="text-[20px]" />
        <span>{saving ? "Збереження…" : "Зберегти"}</span>
      </button>

      {message && (
        <div
          role="alert"
          className="fixed top-[152px] right-[88px] z-40 max-w-[360px] flex items-start gap-2.5 px-4 py-3 rounded-xl bg-rose-50 border border-rose-300 shadow-lg animate-[slideInDown_0.2s_ease-out]"
          style={{ boxShadow: "0 8px 24px -6px rgba(244, 63, 94, 0.35), 0 2px 6px rgba(0,0,0,0.08)" }}
        >
          <span className="flex-shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-500 text-white text-[12px] font-bold mt-0.5">!</span>
          <p className="text-[13px] font-medium text-rose-900 leading-snug flex-1">{message}</p>
          <button
            type="button"
            onClick={() => setMessage("")}
            aria-label="Закрити"
            className="flex-shrink-0 -mr-1 -mt-1 w-6 h-6 inline-flex items-center justify-center rounded-md text-rose-500 hover:bg-rose-100 transition-colors"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
