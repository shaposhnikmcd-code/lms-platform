"use client";

import React, { useEffect, useState } from "react";
import { Block } from "../types";
import { BlockInner, type NewsListItemForBlock } from "@/lib/news/render";
import type { LibraryNewsItem } from "../NewsLibrarySidebar";

// Редактор-обгортка для блока `newsCard` — конкретна новина на канвасі.
// Сама новина ID в data.newsId; render використовує live дані з library API
// (фетчимо тут і кладемо у newsItems prop, щоб BlockInner показав справжню картку).
//
// Sidebar-налаштування цього блока навмисно прибрано (за запитом менеджера):
//   - displayMode (preview/expanded) задається drag-source у правому барі (Превʼю
//     vs Новини без Превʼю) — не потрібен toggle тут.
//   - "Привʼязана новина" / "Замінити на" / schedule visibleFrom/Until — менеджер
//     керує заміною через delete + new drop, schedule не використовується.
// BlockItemHeader (вирівнювання/фон/тощо) лишається — цей файл його НЕ рендерить.

interface Props {
  block: Block;
  onChange: (data: Record<string, string>) => void;
  selected?: boolean;
}

// Простий cache на рівні модуля — щоб не фетчити library двічі для кожного блока.
let libCache: { items: LibraryNewsItem[]; ts: number } | null = null;
const LIB_TTL = 30_000;

async function fetchLibrary(): Promise<LibraryNewsItem[]> {
  if (libCache && Date.now() - libCache.ts < LIB_TTL) return libCache.items;
  const r = await fetch("/api/admin/news/library");
  if (!r.ok) return [];
  const d = await r.json();
  libCache = { items: Array.isArray(d) ? d : [], ts: Date.now() };
  return libCache.items;
}

function toNewsListItem(it: LibraryNewsItem): NewsListItemForBlock {
  return {
    id: it.id,
    title: it.title,
    slug: it.slug,
    excerpt: it.excerpt,
    imageUrl: it.imageUrl,
    category: it.category,
    createdAt: it.createdAt,
    authorName: it.author?.name ?? null,
    content: it.content ?? null,
    previewContent: it.previewContent ?? null,
    pageBgColor: it.pageBgColor ?? null,
    // Без цих двох render у `lib/news/render.tsx` падає у legacy free-canvas
    // гілку і малює auto-картку замість TemplatePreviewCard — тоді розміри/
    // компоновка фото відрізняються від того, що менеджер бачив у шаблонному
    // редакторі.
    templateKind: it.templateKind ?? null,
    templateData: it.templateData ?? null,
    templateBlocks: it.templateBlocks ?? null,
    templateCanvas: it.templateCanvas ?? null,
  };
}

export default function NewsCardEditor({ block, onChange }: Props) {
  void onChange; // sidebar прибрано — onChange не використовується
  const newsId = block.data.newsId || "";
  const [items, setItems] = useState<LibraryNewsItem[] | null>(null);

  useEffect(() => {
    let active = true;
    fetchLibrary().then(d => { if (active) setItems(d); });
    return () => { active = false; };
  }, []);

  const current = items?.find(i => i.id === newsId) || null;
  const newsItemsForRender: NewsListItemForBlock[] | undefined =
    current ? [toNewsListItem(current)] : undefined;

  return (
    // У білдері картка новини НЕ має навігувати — користувач клікає щоб ВИБРАТИ
    // блок (для resize/налаштувань), а не йти на public-сторінку. BlockInner
    // рендерить <a href="/news/...">; інтерсептимо click + preventDefault.
    <div
      style={{ width: "100%", height: "100%" }}
      onClickCapture={(e) => {
        const t = e.target as HTMLElement;
        if (t.closest("a")) e.preventDefault();
      }}
    >
      <BlockInner block={block} newsItems={newsItemsForRender} locale="uk" />
    </div>
  );
}
