import Image from "next/image";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { FaCalendar, FaUser } from "react-icons/fa";
import BackButton from "@/components/BackButton";
import { getTranslatedContent } from "@/lib/translate";
import { newsContent } from "../_content/uk";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import AbsoluteCanvas from "./components/AbsoluteCanvas";
import {
  AbsoluteBlockRender,
  CANVAS_WIDTH,
  canvasHeight,
  hasCoords,
  NEWS_BLOCK_CSS,
  parseBlocks,
  PREVIEW_CARD_WIDTH,
  PREVIEW_CARD_HEIGHT,
  repairBlocks,
  SequentialBlockRender,
} from "@/lib/news/render";
import PreviewCardScale from "@/lib/news/PreviewCardScale";
import ArticleTemplate from "@/lib/news/templates/ArticleTemplate";
import EventTemplate from "@/lib/news/templates/EventTemplate";
import { parseTemplateData, type TemplateKind, type EventData } from "@/lib/news/templates/types";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const getContent = getTranslatedContent(newsContent, "news-page", {
  en: () => import("../_content/en").then(m => m.default),
  pl: () => import("../_content/pl").then(m => m.default),
});

const CATEGORY_COLORS: Record<string, string> = {
  NEWS: "bg-blue-100 text-blue-700",
  ANNOUNCEMENT: "bg-yellow-100 text-yellow-700",
  ARTICLE: "bg-green-100 text-green-700",
};

type Props = {
  params: Promise<{ slug: string; locale: string }>;
  searchParams?: Promise<{ preview?: string }>;
};

export default async function NewsItemPage({ params, searchParams }: Props) {
  const { slug, locale } = await params;
  const sp = searchParams ? await searchParams : {};
  const c = await getContent(locale);

  // Preview-режим (?preview=1) — авторизований superuser/manager бачить
  // unpublished або isTemplate=true новини. Використовується iframe-превʼю
  // в /dashboard/admin/news і в template-editor.
  const isPreview = sp.preview === "1";
  let allowDraft = false;
  if (isPreview) {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;
    allowDraft = role === "ADMIN" || role === "MANAGER";
  }

  const item = await prisma.news.findUnique({
    where: { slug },
    include: { author: { select: { name: true } } },
  });

  const now = new Date();
  // Новина прихована iff suspendedAt уже настав і ще немає завершення (resumeAt у майбутньому або null).
  // Якщо suspendedAt у майбутньому — це заплановане призупинення, новина все ще видима.
  const isSuspended =
    !!item?.suspendedAt &&
    new Date(item.suspendedAt) <= now &&
    (!item.resumeAt || new Date(item.resumeAt) > now);
  // Шаблони (isTemplate=true) ніколи не доступні публічно — це лише
  // адмін-заготовки для спрощення створення новин.
  // У preview-режимі (адмін/менеджер) показуємо й unpublished/template — для
  // редакторського превʼю до публікації.
  if (!item) notFound();
  if (!allowDraft && (!item.published || isSuspended || item.isTemplate)) notFound();

  const related = await prisma.news.findMany({
    where: {
      published: true,
      isTemplate: false,
      id: { not: item.id },
      category: item.category,
      OR: [
        { suspendedAt: null },
        { suspendedAt: { gt: now } },
        { resumeAt: { lte: now } },
      ],
    },
    take: 3,
    orderBy: { createdAt: "desc" },
  });

  const title = locale === "en" ? (item.titleEn ?? item.title)
    : locale === "pl" ? (item.titlePl ?? item.title)
    : item.title;
  const excerpt = locale === "en" ? (item.excerptEn ?? item.excerpt)
    : locale === "pl" ? (item.excerptPl ?? item.excerpt)
    : item.excerpt;
  const localizedContent = locale === "en" ? (item.contentEn ?? item.content)
    : locale === "pl" ? (item.contentPl ?? item.content)
    : item.content;

  // Template-based news: render through dedicated template component instead
  // of free-canvas blocks. Skip the gradient hero (template has its own cover).
  const isTemplateNews = !!item.templateKind;
  const templateData = isTemplateNews && item.templateKind
    ? parseTemplateData(item.templateKind as TemplateKind, item.templateData)
    : null;

  // Block-based template body (конструктор наповнення зберігає templateBlocks +
  // templateCanvas, але НЕ синкає templateData). Пріоритет templateBlocks >
  // templateData — саме так рендериться картка на /news (lib/news/render newsCard).
  // Деталь-сторінка теж має рендерити блоки, коли вони є, інакше показує
  // дефолтний скелет templateData з плейсхолдерами.
  const parsedTemplateBlocks = isTemplateNews
    ? parseBlocks(item.templateBlocks || "")
    : { isJson: false, blocks: [] };
  const hasTemplateBlocks = parsedTemplateBlocks.isJson && parsedTemplateBlocks.blocks.length > 0;
  // Розмір canvas-у "WxH" з templateCanvas; fallback за kind (як у newsCard render).
  let tplCanvasW = item.templateKind === "EVENT" ? 600 : PREVIEW_CARD_WIDTH;
  let tplCanvasH = item.templateKind === "EVENT" ? 400 : PREVIEW_CARD_HEIGHT;
  if (hasTemplateBlocks && item.templateCanvas) {
    const m = item.templateCanvas.match(/^(\d+)x(\d+)$/);
    if (m) {
      const w = Number(m[1]);
      const hh = Number(m[2]);
      if (Number.isFinite(w) && Number.isFinite(hh) && w >= 60 && hh >= 60) {
        tplCanvasW = w;
        tplCanvasH = hh;
      }
    }
  }

  let { isJson, blocks } = parseBlocks(localizedContent);
  // Якщо локалізована версія взагалі зламана — падаємо на UK-оригінал
  if (locale !== 'uk' && !isJson) {
    const ukParsed = parseBlocks(item.content);
    if (ukParsed.isJson) {
      isJson = true;
      blocks = ukParsed.blocks;
    }
  } else if (locale !== 'uk' && isJson) {
    // Виправляємо image/youtube URLs з UK-оригіналу
    const ukParsed = parseBlocks(item.content);
    if (ukParsed.isJson) {
      blocks = repairBlocks(blocks, ukParsed.blocks);
    }
  }
  const isOldHtml = !isJson && localizedContent?.trim().startsWith("<");

  return (
    <main className="min-h-screen bg-gray-50">
      <BackButton href="/news" label={c.back} />
      {/* Gradient hero — тільки для НЕ-шаблонних новин. У шаблонах власний cover-hero. */}
      {!isTemplateNews && (
        <section className="bg-gradient-to-br from-[#1C3A2E] to-[#2a4f3f] text-white py-12">
          <div className="max-w-4xl mx-auto px-4">
            <h1 className="text-3xl md:text-4xl font-bold leading-tight">{title}</h1>
            {excerpt && (
              <p className="text-white/70 text-lg mt-4 leading-relaxed">{excerpt}</p>
            )}
            {item.showAuthorMeta && (
              <div className="flex items-center gap-3 mt-6">
                <span className="flex items-center gap-1 text-xs text-white/50">
                  <FaCalendar />{new Date(item.createdAt).toLocaleDateString(locale === "uk" ? "uk-UA" : locale === "pl" ? "pl-PL" : "en-US")}
                </span>
                {item.author?.name && (
                  <span className="flex items-center gap-1 text-xs text-white/50">
                    <FaUser />{item.author.name}
                  </span>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {(() => {
        // Контейнер сторінки розширюється, якщо EVENT-картка ширша за CANVAS_WIDTH:
        // менеджер у редакторі обрав напр. 1100px — на /news/{slug} стаття не має
        // обрізатись 920px-канвасом. Беремо max(CANVAS_WIDTH, eventCardWidth) + 64
        // на padding. ARTICLE та non-template — стандартний CANVAS_WIDTH+64.
        const eventCardWidth = isTemplateNews && item.templateKind === "EVENT" && templateData
          ? (templateData as EventData).cardWidth || 0
          : 0;
        // Block-based шаблон рендериться у нативній ширині canvas-у (tplCanvasW),
        // тож контейнер сторінки має її вмістити (як для legacy EVENT cardWidth).
        const nativeTemplateWidth = hasTemplateBlocks ? tplCanvasW : eventCardWidth;
        const pageMaxWidth = Math.max(CANVAS_WIDTH, nativeTemplateWidth) + 64;
        return (
      <div className="mx-auto py-10 px-4 md:px-0" style={{ maxWidth: `${pageMaxWidth}px` }}>
        <div
          className="rounded-2xl shadow-sm"
          style={{ background: item.pageBgColor || "#FFFFFF", padding: isTemplateNews ? "32px 24px" : "32px" }}
        >
          {/* Template-render branch: рендериться повністю окремим компонентом
              з фіксованими слотами (object-fit:cover) — нічого не зміщується,
              hero/title/lead вже в розмітці шаблона. */}
          {/* Block-based шаблон (пріоритет): рендеримо templateBlocks через той
              самий двіжок, що й картка на /news — точний WYSIWYG з білдером
              наповнення. Native canvas WxH, PreviewCardScale масштабує під
              ширину контейнера (і вниз на мобільному). */}
          {isTemplateNews && hasTemplateBlocks && (
            <div style={{ maxWidth: `${tplCanvasW}px`, marginLeft: "auto", marginRight: "auto" }}>
              <PreviewCardScale baseWidth={tplCanvasW} baseHeight={tplCanvasH} initialScale={1}>
                <div
                  style={{
                    position: "relative",
                    width: tplCanvasW,
                    height: tplCanvasH,
                    background: item.pageBgColor || "#FFFFFF",
                    overflow: "hidden",
                  }}
                >
                  {parsedTemplateBlocks.blocks.map(b => (
                    <AbsoluteBlockRender key={b.id} block={b} />
                  ))}
                </div>
              </PreviewCardScale>
            </div>
          )}
          {/* Legacy structured-render (fallback): лише коли block-based body
              немає — старі шаблонні новини на templateData. */}
          {isTemplateNews && !hasTemplateBlocks && templateData && item.templateKind === "ARTICLE" && (
            <ArticleTemplate data={templateData as import("@/lib/news/templates/types").ArticleData} />
          )}
          {isTemplateNews && !hasTemplateBlocks && templateData && item.templateKind === "EVENT" && (
            <EventTemplate
              data={templateData as EventData}
              maxWidth={(templateData as EventData).cardWidth || undefined}
            />
          )}

          {!isTemplateNews && isJson && blocks.length > 0 && (() => {
            const useAbsolute = hasCoords(blocks);
            // Для мобільного — сортуємо по y (потім по x) і стекаємо 100%
            const mobileOrdered = [...blocks].sort((a, b) => (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0));
            return (
              <>
                {/* Desktop — абсолютне позиціонування */}
                {useAbsolute && (
                  <AbsoluteCanvas initialHeight={canvasHeight(blocks)} maxWidth={CANVAS_WIDTH}>
                    {blocks.map(b => <AbsoluteBlockRender key={b.id} block={b} />)}
                  </AbsoluteCanvas>
                )}

                {/* Mobile / fallback — стек 100% */}
                <div className={useAbsolute ? "news-content md:hidden" : "news-content"}>
                  {(useAbsolute ? mobileOrdered : blocks).map(b => <SequentialBlockRender key={b.id} block={b} />)}
                </div>
              </>
            );
          })()}

          {!isTemplateNews && isOldHtml && (
            <div className="news-content" dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.content || "") }} />
          )}

          {!isTemplateNews && !isOldHtml && !(isJson && blocks.length > 0) && (
            <div className="text-gray-400 italic">{c.emptyContent}</div>
          )}
        </div>

        {related.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-bold text-[#1C3A2E] mb-6">{c.related}</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {related.map((r) => {
                const rTitle = locale === "en" ? (r.titleEn ?? r.title)
                  : locale === "pl" ? (r.titlePl ?? r.title)
                  : r.title;
                return (
                <Link key={r.id} href={"/news/" + r.slug} className="bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-all">
                  {r.imageUrl && (
                    <div className="relative w-full h-32 overflow-hidden rounded-lg mb-3">
                      <Image src={r.imageUrl} alt={rTitle} fill className="object-cover" />
                    </div>
                  )}
                  <span className={"text-xs px-2 py-0.5 rounded-full font-medium " + (CATEGORY_COLORS[r.category] || "bg-gray-100 text-gray-700")}>
                    {c.categories[r.category as keyof typeof c.categories] ?? r.category}
                  </span>
                  <h3 className="font-medium text-[#1C3A2E] mt-2 text-sm line-clamp-2 hover:text-[#D4A843] transition-colors">
                    {rTitle}
                  </h3>
                  <p className="text-xs text-gray-400 mt-2">{new Date(r.createdAt).toLocaleDateString(locale === "uk" ? "uk-UA" : locale === "pl" ? "pl-PL" : "en-US")}</p>
                </Link>
              );})}
            </div>
          </div>
        )}
      </div>
        );
      })()}

      <style>{NEWS_BLOCK_CSS + `
        /* Legacy: підтримка старих новин що зберегли HTML напряму у data.content
           без блоків. Тільки для mobile sequential обгортки .news-content. */
        .news-content { font-family: -apple-system, BlinkMacSystemFont, sans-serif; color: #1C3A2E; line-height: 1.7; font-size: 15px; }
        .news-content hr { border: none; border-top: 2px solid #D4A843; margin: 1.5em 0; }
        .news-content img { max-width: 100%; border-radius: 8px; margin: 1em 0; }
      `}</style>
    </main>
  );
}
