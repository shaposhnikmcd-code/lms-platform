"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { HiOutlineCheckCircle } from "react-icons/hi2";
import { Block, NewsMeta, blocksToJson, jsonToBlocks } from "./types";
import EditorCanvas from "./EditorCanvas";
import MetaSidebar from "./MetaSidebar";

// Settings slot тепер живе ВСЕРЕДИНІ BlockPalette (внизу палітри) — щоб усе ліве меню
// було в одному компоненті, без floating overlay.

function saveDraft(meta: NewsMeta, blocks: Block[], newsId?: string) {
  try { localStorage.setItem(`uimp_draft_${newsId || "new"}`, JSON.stringify({ meta, blocks, savedAt: Date.now() })); } catch {}
}
function clearDraft(newsId?: string) {
  try { localStorage.removeItem(`uimp_draft_${newsId || "new"}`); } catch {}
}
function loadDraft(newsId?: string): { meta: NewsMeta; blocks: Block[]; savedAt?: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`uimp_draft_${newsId || "new"}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.meta && Array.isArray(parsed.blocks)) return parsed;
  } catch {}
  return null;
}

const HISTORY_CAP = 80;
const HISTORY_DEBOUNCE_MS = 350;

interface HistorySnap { meta: NewsMeta; blocks: Block[] }

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

  // Спробуємо відновити чернетку з localStorage одразу при маунті,
  // щоб якщо користувач перезавантажив сторінку — напрацювання не зникли.
  const initialDraft = loadDraft(newsId);
  const draftRestoredRef = useRef(!!initialDraft);

  const [meta, setMeta] = useState<NewsMeta>(() =>
    initialDraft?.meta ?? { ...def, ...initialMeta }
  );
  const [blocks, setBlocks] = useState<Block[]>(() =>
    initialDraft?.blocks ?? jsonToBlocks(initialContent || "")
  );
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  // Selection піднято з EditorCanvas сюди — щоб FloatingBlockSettings (фіксована
  // panel зліва, що слідкує за вибраним блоком) могла читати selection.
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  // Page zoom через Ctrl+колесо. Браузер за замовчуванням на Ctrl+wheel робить
  // власний UI-zoom (всю сторінку разом з шапкою браузера), що тут небажано —
  // потрібно зумити саме контент editor-а. Тому ловимо wheel non-passive і
  // preventDefault, далі скейлимо обгортку через CSS `zoom` (на відміну від
  // transform: scale, він коректно перераховує scroll-area).
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

  // Ctrl+0 — скинути zoom до 100%.
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

  // ── Undo/Redo (Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y) ────────────────────────────
  const historyRef = useRef<HistorySnap[]>([]);
  const pointerRef = useRef(-1);
  const skipPushRef = useRef(false);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [historyTick, setHistoryTick] = useState(0); // тригер ре-рендеру для disabled-стану кнопок

  // Відстежуємо попередній initialContent щоб НЕ перезаписувати state при
  // повторних викликах useEffect-у з тим самим значенням (React 18 strict-mode
  // double-mount, parent re-render тощо). Стейт скидається ТІЛЬКИ якщо parent
  // реально передав НОВИЙ initialContent (наприклад, юзер перейшов на іншу новину).
  const prevInitialContentRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    // Перший запуск — нічого не робимо: useState lazy-init вже виставив state
    // (з draft або initialContent). Просто запам'ятовуємо значення.
    if (prevInitialContentRef.current === undefined) {
      prevInitialContentRef.current = initialContent;
      return;
    }
    // Те саме значення → strict-mode чи інший no-op re-render → не чіпаємо state.
    if (prevInitialContentRef.current === initialContent) return;
    // Реальна зміна → застосовуємо нову DB-версію.
    setMeta({ ...def, ...initialMeta });
    setBlocks(jsonToBlocks(initialContent || ""));
    prevInitialContentRef.current = initialContent;
    historyRef.current = [];
    pointerRef.current = -1;
    skipPushRef.current = false;
    if (pushTimerRef.current) { clearTimeout(pushTimerRef.current); pushTimerRef.current = null; }
    setHistoryTick(t => t + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialContent]);

  useEffect(() => {
    if (skipPushRef.current) { skipPushRef.current = false; return; }
    if (historyRef.current.length === 0) {
      // Baseline-снапшот (без debounce)
      historyRef.current = [{ meta, blocks }];
      pointerRef.current = 0;
      setHistoryTick(t => t + 1);
      return;
    }
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(() => {
      const h = historyRef.current.slice(0, pointerRef.current + 1);
      const last = h[h.length - 1];
      // Пропускаємо якщо нічого не змінилось (dedupe)
      if (last && last.meta === meta && last.blocks === blocks) return;
      h.push({ meta, blocks });
      if (h.length > HISTORY_CAP) h.shift();
      historyRef.current = h;
      pointerRef.current = h.length - 1;
      setHistoryTick(t => t + 1);
    }, HISTORY_DEBOUNCE_MS);
  }, [meta, blocks]);

  const undo = useCallback(() => {
    // Якщо є pending debounced push — закомічу його негайно, щоб undo повернув попередній стан
    if (pushTimerRef.current) {
      clearTimeout(pushTimerRef.current);
      pushTimerRef.current = null;
      const h = historyRef.current.slice(0, pointerRef.current + 1);
      const last = h[h.length - 1];
      if (!last || last.meta !== meta || last.blocks !== blocks) {
        h.push({ meta, blocks });
        if (h.length > HISTORY_CAP) h.shift();
        historyRef.current = h;
        pointerRef.current = h.length - 1;
      }
    }
    if (pointerRef.current <= 0) return;
    pointerRef.current -= 1;
    const snap = historyRef.current[pointerRef.current];
    skipPushRef.current = true;
    setMeta(snap.meta);
    setBlocks(snap.blocks);
    setHistoryTick(t => t + 1);
  }, [meta, blocks]);

  const redo = useCallback(() => {
    if (pointerRef.current >= historyRef.current.length - 1) return;
    pointerRef.current += 1;
    const snap = historyRef.current[pointerRef.current];
    skipPushRef.current = true;
    setMeta(snap.meta);
    setBlocks(snap.blocks);
    setHistoryTick(t => t + 1);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);
      const cmd = isMac ? e.metaKey : e.ctrlKey;
      if (!cmd) return;
      const key = e.key.toLowerCase();
      if (key !== "z" && key !== "y") return;

      // Якщо фокус всередині input/textarea/contenteditable (TipTap ProseMirror) —
      // не перехоплюємо: хай нативний/TipTap undo обробить редагування тексту.
      // Документо-рівневий undo спрацює лише коли користувач не друкує/редагує.
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        if (target.isContentEditable) return;
      }

      // Документо-рівневий undo — для дій над блоками (додавання/видалення,
      // drag, resize), як у Notion / Figma / Google Docs.
      e.preventDefault();
      if (key === "z" && !e.shiftKey) undo();
      else redo();
    };
    document.addEventListener("keydown", onKey, { capture: true });
    return () => document.removeEventListener("keydown", onKey, { capture: true });
  }, [undo, redo]);

  const canUndo = pointerRef.current > 0;
  const canRedo = pointerRef.current < historyRef.current.length - 1;
  void historyTick; // ре-рендер прив'язаний до state, історія — ref

  const autoSave = useCallback(() => {
    saveDraft(meta, blocks, newsId);
  }, [meta, blocks, newsId]);

  useEffect(() => {
    // Швидший debounce — щоб якщо юзер натисне F5 одразу після зміни,
    // чернетка вже встигла потрапити у localStorage.
    const t = setTimeout(autoSave, 300);
    return () => clearTimeout(t);
  }, [meta, blocks]);

  // Flush на refresh/close: коли вкладка ховається або сторінка закривається —
  // ОДРАЗУ синхронно зберігаємо чернетку у localStorage, не чекаючи debounce.
  // Без цього дрібні зміни (зроблені за <300мс до F5) гублять.
  const flushRef = useRef({ meta, blocks, newsId });
  useEffect(() => { flushRef.current = { meta, blocks, newsId }; }, [meta, blocks, newsId]);
  useEffect(() => {
    const flush = () => {
      const s = flushRef.current;
      saveDraft(s.meta, s.blocks, s.newsId);
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
    // Запам'ятовуємо РЕАЛЬНУ висоту кожного блока з DOM перед збереженням —
    // public сторінка використовує її для розрахунку висоти контейнера, інакше
    // блоки можуть рендеритись поза ним (наприклад під футером).
    const baked = blocks.map(b => {
      if (typeof document === "undefined") return b;
      const el = document.querySelector(`[data-block-id="${b.id}"]`) as HTMLElement | null;
      const measured = el?.offsetHeight;
      if (measured && measured > 0) return { ...b, height: measured };
      return b;
    });
    const content = blocksToJson(baked);
    const imageUrl = meta.imageUrl || baked.find(b => b.type === "image")?.data.url || "";
    try {
      await onSave({ ...meta, published }, content, imageUrl);
      clearDraft(newsId);
    } catch (e) {
      // Помилку (наприклад, дублікат slug, мережа, 500) показуємо юзеру явно
      // замість silent fail — інакше кнопка просто повертається з "Збереження…"
      // і нічого не відбувається, як було раніше.
      const msg = e instanceof Error ? e.message : "Невідома помилка збереження";
      setMessage(msg);
    }
  };

  return (
    <div ref={editorRootRef} className="min-h-screen bg-slate-100" style={{ zoom }}>
      <div className="max-w-[1520px] mx-auto px-6 py-10">
        {/* Top header — eyebrow + title. Дії (Save / Undo / Redo / Чернетка) винесені:
            - Save → floating-кнопка зліва від back-стрілки (внизу файлу)
            - Undo/Redo → доступні гарячими клавішами Ctrl+Z / Ctrl+Shift+Z
            - "Чернетка" окремо тут не потрібна: localStorage сам автозберігає
              кожні 300мс + при закритті вкладки. */}
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
          {(message || uploading) && (
            <p className="mt-2 text-[12px] font-medium">
              {message && <span className="text-rose-600">{message}</span>}
              {uploading && <span className="text-amber-600">Завантаження…</span>}
            </p>
          )}
        </div>

        {/* Editor row — Palette | Canvas | Sidebar, всі стартують на одному Y.
            gap-5 (20px) синхронізовано з внутрішнім gap між BlockPalette і canvas
            у EditorCanvas — щоб page була візуально по центру між обома барами. */}
        <div className="flex flex-col lg:flex-row gap-5 items-start">
          <div className="flex-1 min-w-0 w-full">
            <EditorCanvas
              blocks={blocks}
              onBlocksChange={setBlocks}
              onUpload={uploadFile}
              pageBgColor={meta.pageBgColor || ""}
              selectedBlockId={selectedBlockId}
              onSelectBlock={setSelectedBlockId}
            />
          </div>

          <div className="w-full lg:w-auto lg:sticky lg:top-24 lg:self-start">
            <MetaSidebar meta={meta} onChange={setMeta} onUpload={uploadFile} />
          </div>
        </div>
      </div>

      {/* Settings slot тепер живе всередині BlockPalette — як темна card-секція палітри. */}

      {/* Floating Save — закріплена fixed зліва від back-стрілки (DashboardBackButton:
          fixed top-20 right-5 w-14). Зміщення right: 5+14+3 = 22 (Tailwind units).
          Щоб користувач міг зберегти з будь-якої точки сторінки без прокрутки нагору. */}
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
    </div>
  );
}
