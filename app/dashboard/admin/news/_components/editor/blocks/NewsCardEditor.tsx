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
  /** Передається з BlockItem → AbsoluteBlock щоб клік У БУДЬ-ЯКЕ місце newsCard
   *  preview (фото / текст / цитата / overlay-и) гарантовано вибирав цей блок.
   *  Раніше клік на текст/цитату всередині <a>-обгортки превʼю-картки інколи не
   *  bubble-ив до AbsoluteBlock.onClick (через preventDefault на <a>) — селект
   *  не спрацьовував. */
  onSelectBlock?: (id: string) => void;
}

// Простий cache на рівні модуля — щоб не фетчити library двічі для кожного блока.
let libCache: { items: LibraryNewsItem[]; ts: number } | null = null;
const LIB_TTL = 30_000;

async function fetchLibrary(opts?: { bypassCache?: boolean }): Promise<LibraryNewsItem[]> {
  if (!opts?.bypassCache && libCache && Date.now() - libCache.ts < LIB_TTL) return libCache.items;
  const r = await fetch("/api/admin/news/library");
  if (!r.ok) return libCache?.items || [];
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

export default function NewsCardEditor({ block, onChange, onSelectBlock }: Props) {
  void onChange; // sidebar прибрано — onChange не використовується
  const newsId = block.data.newsId || "";
  const [items, setItems] = useState<LibraryNewsItem[] | null>(null);
  // retryDone — true після додаткового bypass-cache фетча, коли newsId не
  // знайдено у першому resolve. Без цього стало можливо, що newsCard drag-ався
  // одразу після створення/публікації новини, а libCache (30s TTL) повертав
  // ще-не-оновлений список → "не знайдена" відображалась помилково.
  const [retryDone, setRetryDone] = useState(false);

  useEffect(() => {
    let active = true;
    fetchLibrary().then(async d => {
      if (!active) return;
      setItems(d);
      // Якщо новина drop-нута, але її НЕ виявилось у кеші — інвалідуємо
      // libCache і фетчимо свіжу копію (можливо новина створена щойно або
      // libCache стейл). Робимо це ОДИН РАЗ на mount, щоб не зациклити.
      const hasMatch = d.some(it => it.id === newsId);
      if (!hasMatch && newsId) {
        const fresh = await fetchLibrary({ bypassCache: true });
        if (active) setItems(fresh);
      }
      if (active) setRetryDone(true);
    });
    return () => { active = false; };
  }, [newsId]);

  const current = items?.find(i => i.id === newsId) || null;
  const newsItemsForRender: NewsListItemForBlock[] | undefined =
    current ? [toNewsListItem(current)] : undefined;

  // Loading state: бібліотека ще не зафетчилась (items==null) АБО зробив retry
  // bypass-cache (retryDone=false) — BlockInner отримав би newsItems=undefined
  // і показав «Новина не знайдена або не опублікована» помилково. Показуємо
  // тонкий спінер замість. Після resolve-у retry: items не null, retryDone=true →
  // або render новини, або справді не знайдена (видалена з БД).
  const isLoading = !!newsId && (items === null || !retryDone);

  return (
    // У білдері картка новини НЕ має навігувати — користувач клікає щоб ВИБРАТИ
    // блок (для resize/налаштувань), а не йти на public-сторінку. BlockInner
    // рендерить <a href="/news/...">; інтерсептимо click + preventDefault.
    //
    // data-no-block-drag — body картки виключений з whole-block drag-у (див.
    // NO_DRAG_SELECTOR у EditorCanvas#AbsoluteBlock). Без цього клік по
    // content-у новини інколи активував dnd-kit drag-listener (зсув курсора
    // 5+px) і "з'їдав" подальший click → selection не спрацьовував через раз.
    // Drag блока лишається доступний через виділений ⋮⋮ handle у top-left.
    <div
      data-no-block-drag
      style={{ width: "100%", height: "100%" }}
      title="Подвійний клік — редагувати контент новини"
      // Контент новини НЕ редагується у Білдері Сторінки (тут лише компонування
      // карток). Раніше це був dead-end без жодної підказки: менеджер клікав по
      // блоках всередині картки і нічого не відбувалось. Подвійний клік відкриває
      // content-редактор новини у новій вкладці (білдер сторінки не втрачає стан).
      onDoubleClick={() => {
        if (newsId) window.open(`/dashboard/admin/news/${newsId}/template`, "_blank", "noopener");
      }}
      onClickCapture={(e) => {
        const t = e.target as HTMLElement;
        // Прибираємо навігацію <a> (preventDefault), АЛЕ паралельно явно
        // викликаємо onSelectBlock — щоб клік на будь-якому елементі превʼю
        // (текст/цитата/фото/overlay) виділяв блок. Раніше click bubble інколи
        // не доходив до AbsoluteBlock.onClick (особливо коли <a> навколо
        // ARTICLE-превʼю гасило подію), і селект не спрацьовував через раз.
        if (t.closest("a")) e.preventDefault();
        if (onSelectBlock) onSelectBlock(block.id);
      }}
    >
      {isLoading ? (
        <div
          aria-label="Завантаження новини"
          style={{
            width: "100%",
            height: "100%",
            minHeight: 240,
            borderRadius: 16,
            border: "1.5px dashed #E8D5B7",
            background: "rgba(212,168,67,0.04)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxSizing: "border-box",
          }}
        >
          <div
            className="animate-spin"
            style={{
              width: 28,
              height: 28,
              borderWidth: 2,
              borderStyle: "solid",
              borderColor: "#D4A843",
              borderTopColor: "transparent",
              borderRadius: "50%",
            }}
          />
        </div>
      ) : (
        <BlockInner block={block} newsItems={newsItemsForRender} locale="uk" />
      )}
    </div>
  );
}
