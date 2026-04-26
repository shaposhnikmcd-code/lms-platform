"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { HiOutlineCheckCircle } from "react-icons/hi2";
import { Block, NewsMeta, blocksToJson, jsonToBlocks } from "./types";
import EditorCanvas from "./EditorCanvas";
import MetaSidebar from "./MetaSidebar";

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
  const [draftToast, setDraftToast] = useState<{ savedAt?: number } | null>(
    initialDraft ? { savedAt: initialDraft.savedAt } : null
  );

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

  // Toast-повідомлення що чернетку відновлено — ховаємо через 7 сек.
  useEffect(() => {
    if (!draftToast) return;
    const t = setTimeout(() => setDraftToast(null), 7000);
    return () => clearTimeout(t);
  }, [draftToast]);

  // ── Undo/Redo (Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y) ────────────────────────────
  const historyRef = useRef<HistorySnap[]>([]);
  const pointerRef = useRef(-1);
  const skipPushRef = useRef(false);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [historyTick, setHistoryTick] = useState(0); // тригер ре-рендеру для disabled-стану кнопок

  const discardDraft = useCallback(() => {
    clearDraft(newsId);
    setMeta({ ...def, ...initialMeta });
    setBlocks(jsonToBlocks(initialContent || ""));
    historyRef.current = [];
    pointerRef.current = -1;
    skipPushRef.current = false;
    setDraftToast(null);
    setHistoryTick(t => t + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newsId, initialContent]);

  useEffect(() => {
    if (initialContent && !draftRestoredRef.current) {
      setMeta({ ...def, ...initialMeta });
      setBlocks(jsonToBlocks(initialContent));
    }
    // Після першого запуску прапорець скидається — якщо initialContent зміниться ще раз,
    // це вже буде явна зміна DB-версії (не restore), і ми її застосуємо.
    draftRestoredRef.current = false;
    historyRef.current = [];
    pointerRef.current = -1;
    skipPushRef.current = false;
    if (pushTimerRef.current) { clearTimeout(pushTimerRef.current); pushTimerRef.current = null; }
    setHistoryTick(t => t + 1);
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
      // Документо-рівневий undo завжди — щоб Ctrl+Z скасовував будь-яку дію
      // в білдері (додавання/видалення блока, drag, resize, edit), як це
      // працює в Notion / Figma / Google Docs.
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
    await onSave({ ...meta, published }, content, imageUrl);
    clearDraft(newsId);
  };

  return (
    <div ref={editorRootRef} className="min-h-screen bg-slate-100" style={{ zoom }}>
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
              <div className="flex items-center gap-1 mr-1">
                <button
                  type="button"
                  onClick={undo}
                  disabled={!canUndo}
                  title="Скасувати (Ctrl+Z)"
                  className="w-10 h-10 flex items-center justify-center text-[18px] font-semibold text-slate-600 bg-white ring-1 ring-slate-200 rounded-lg shadow-sm hover:bg-slate-50 hover:ring-slate-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ↶
                </button>
                <button
                  type="button"
                  onClick={redo}
                  disabled={!canRedo}
                  title="Повторити (Ctrl+Shift+Z)"
                  className="w-10 h-10 flex items-center justify-center text-[18px] font-semibold text-slate-600 bg-white ring-1 ring-slate-200 rounded-lg shadow-sm hover:bg-slate-50 hover:ring-slate-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ↷
                </button>
              </div>
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
                  {saving ? "Збереження…" : "Зберегти"}
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

        {/* Toast — відновлено чернетку з localStorage */}
        {draftToast && (
          <div
            className="fixed top-36 right-5 z-30 flex items-center gap-3 px-4 py-3 bg-white shadow-lg rounded-xl ring-1 ring-amber-200"
            style={{ animation: "toast-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
          >
            <span className="text-[18px]">♻️</span>
            <div className="flex flex-col gap-0.5">
              <span className="text-[12px] font-semibold text-slate-800">Відновлено чернетку</span>
              <span className="text-[10px] text-slate-500">
                {draftToast.savedAt
                  ? `Збережено ${new Date(draftToast.savedAt).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })}`
                  : "Ваші незбережені зміни підхоплено"}
              </span>
            </div>
            <button
              onClick={discardDraft}
              className="ml-2 px-3 py-1.5 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-md transition-colors"
              title="Очистити чернетку і почати спочатку"
            >
              Очистити
            </button>
            <button
              onClick={() => setDraftToast(null)}
              className="text-slate-400 hover:text-slate-600 text-[16px] px-1"
              title="Закрити"
            >
              ✕
            </button>
          </div>
        )}
        <style>{`@keyframes toast-in { 0% { opacity: 0; transform: translateY(-8px); } 100% { opacity: 1; transform: translateY(0); } }`}</style>

        {/* Editor row — Palette | Canvas | Sidebar, всі стартують на одному Y */}
        <div className="flex flex-col lg:flex-row gap-10 items-start">
          <div className="flex-1 min-w-0 w-full">
            <EditorCanvas blocks={blocks} onBlocksChange={setBlocks} onUpload={uploadFile} pageBgColor={meta.pageBgColor || ""} />
          </div>

          <div className="w-full lg:w-auto lg:sticky lg:top-24 lg:self-start">
            <MetaSidebar meta={meta} onChange={setMeta} onUpload={uploadFile} />
          </div>
        </div>
      </div>
    </div>
  );
}
