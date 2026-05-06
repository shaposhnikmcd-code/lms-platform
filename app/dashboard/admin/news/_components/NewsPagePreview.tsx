"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AbsoluteBlockRender,
  CANVAS_WIDTH,
  canvasHeight,
  parseBlocks,
  NEWS_BLOCK_CSS,
  type Block,
  type NewsListItemForBlock,
} from "@/lib/news/render";

interface PageContent {
  content: string;
  pageBgColor: string | null;
  published: boolean;
}

interface LibraryNewsRaw {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  previewContent: string | null;
  pageBgColor: string | null;
  imageUrl: string | null;
  category: string;
  createdAt: string;
  author: { name: string | null } | null;
}

// Превʼю сторінки /news для адмін-листа. Фетчить layout + library, рендерить
// через ту саму AbsoluteBlockRender, що й public — щоб адмін бачив 1-в-1
// результат до публікації. Масштабовано через CSS transform: scale.
export default function NewsPagePreview() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [page, setPage] = useState<PageContent | null>(null);
  const [items, setItems] = useState<NewsListItemForBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/news/page-content").then(r => r.ok ? r.json() : null),
      fetch("/api/admin/news/library").then(r => r.ok ? r.json() : []),
    ]).then(([pageData, libRaw]) => {
      setPage(pageData ? {
        content: pageData.content || "",
        pageBgColor: pageData.pageBgColor || null,
        published: !!pageData.published,
      } : null);
      const lib = (Array.isArray(libRaw) ? libRaw : []) as LibraryNewsRaw[];
      setItems(lib.map((n) => ({
        id: n.id,
        title: n.title,
        slug: n.slug,
        excerpt: n.excerpt,
        imageUrl: n.imageUrl,
        category: n.category,
        createdAt: n.createdAt,
        authorName: n.author?.name ?? null,
        content: n.content,
        previewContent: n.previewContent,
        pageBgColor: n.pageBgColor,
      })));
      setLoading(false);
    }).catch(e => { setError(String(e?.message || e)); setLoading(false); });
  }, []);

  // Парсимо блоки і застосовуємо ту саму фільтрацію, що й публічна /news:
  //  - newsCard з невідомим/непублікованим newsId — викидаємо
  //  - per-block visibleFrom/Until window
  const blocks: Block[] = (() => {
    if (!page?.content) return [];
    const parsed = parseBlocks(page.content);
    if (!parsed.isJson) return [];
    const now = new Date();
    return parsed.blocks.filter((b) => {
      if (b.type !== "newsCard") return true;
      const newsId = b.data.newsId || "";
      if (!items.some(n => n.id === newsId)) return false;
      const fromStr = b.data.visibleFrom || "";
      const untilStr = b.data.visibleUntil || "";
      if (fromStr) {
        const f = new Date(fromStr);
        if (!Number.isNaN(f.getTime()) && f > now) return false;
      }
      if (untilStr) {
        const u = new Date(untilStr);
        if (!Number.isNaN(u.getTime()) && u <= now) return false;
      }
      return true;
    });
  })();

  const innerH = blocks.length > 0 ? canvasHeight(blocks) : 200;

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const recalc = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(Math.min(1, w / CANVAS_WIDTH));
    };
    recalc();
    const ro = new ResizeObserver(recalc);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
        Завантаження превʼю...
      </div>
    );
  }
  if (error) {
    return <div style={{ padding: 16, color: "#DC2626", fontSize: 13 }}>{error}</div>;
  }

  if (blocks.length === 0) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
        Сторінку ще не зверстано — відкрий <strong>білдер сторінки /news</strong> і додай блоки.
      </div>
    );
  }

  const pageBg = page?.pageBgColor || "#F9FAFB";

  return (
    <>
      <style>{NEWS_BLOCK_CSS}</style>
      <div
        ref={wrapRef}
        style={{
          position: "relative",
          width: "100%",
          height: `${Math.round(innerH * scale)}px`,
          overflow: "hidden",
          background: pageBg,
          borderRadius: 8,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: `${CANVAS_WIDTH}px`,
            height: `${innerH}px`,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          {blocks.map((b) => (
            <AbsoluteBlockRender key={b.id} block={b} newsItems={items} locale="uk" />
          ))}
        </div>
      </div>
    </>
  );
}
