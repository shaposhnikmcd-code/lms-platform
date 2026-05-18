// Auth-gated preview route для адмінки. Рендерить /news точнісінько як публічна
// сторінка (включно з Navbar + Footer з [locale]/layout.tsx), але дозволяє
// підмінити content-джерело через ?source query param. Використовується в
// fullscreen-превʼю на /dashboard/admin/news через <iframe>.
//
// source=live (default) → NewsPage.content (поточна live-сторінка)
// source=next           → NewsPage.nextContent (staged-чернетка)
// source=archive&id=X   → NewsPageArchive.content (історична версія)
//
// Force-dynamic — щоб уникнути ISR кешу і авто-publish мутацій під час превʼю.

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { notFound } from "next/navigation";
import { getTranslatedContent } from "@/lib/translate";
import { newsContent } from "../_content/uk";
import {
  AbsoluteBlockRender,
  SequentialBlockRender,
  NEWS_BLOCK_CSS,
  CANVAS_WIDTH,
  canvasHeight,
  parseBlocks,
  type Block,
  type NewsListItemForBlock,
} from "@/lib/news/render";

export const dynamic = "force-dynamic";

const getContent = getTranslatedContent(newsContent, "news-page", {
  en: () => import("../_content/en").then(m => m.default),
  pl: () => import("../_content/pl").then(m => m.default),
});

interface ContentSource {
  content: string | null;
  contentEn: string | null;
  contentPl: string | null;
  pageBgColor: string | null;
}

async function loadSource(source: string, archiveId: string | null): Promise<ContentSource | null> {
  if (source === "archive" && archiveId) {
    const row = await prisma.newsPageArchive.findUnique({ where: { id: archiveId } });
    if (!row) return null;
    return {
      content: row.content,
      contentEn: row.contentEn,
      contentPl: row.contentPl,
      pageBgColor: row.pageBgColor,
    };
  }
  const page = await prisma.newsPage.findUnique({ where: { key: "default" } });
  if (!page) return null;
  if (source === "next") {
    return {
      content: page.nextContent,
      contentEn: page.nextContentEn,
      contentPl: page.nextContentPl,
      pageBgColor: page.nextPageBgColor ?? page.pageBgColor,
    };
  }
  return {
    content: page.content,
    contentEn: page.contentEn,
    contentPl: page.contentPl,
    pageBgColor: page.pageBgColor,
  };
}

export default async function NewsPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ source?: string; id?: string }>;
}) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "ADMIN" && role !== "MANAGER") notFound();

  const { locale } = await params;
  const { source = "live", id = null } = await searchParams;
  const c = await getContent(locale);

  const src = await loadSource(source, id);

  // Усі published новини потрібні для newsCard блоків (id → title/slug/тощо).
  const now = new Date();
  const publishedNews = await prisma.news.findMany({
    where: { published: true, isTemplate: false },
    orderBy: { createdAt: "desc" },
    include: { author: { select: { name: true } } },
  });

  const newsItemsForBlocks: NewsListItemForBlock[] = publishedNews.map(n => ({
    id: n.id,
    title: n.title,
    titleEn: n.titleEn,
    titlePl: n.titlePl,
    slug: n.slug,
    excerpt: n.excerpt,
    excerptEn: n.excerptEn,
    excerptPl: n.excerptPl,
    imageUrl: n.imageUrl,
    category: n.category,
    createdAt: n.createdAt.toISOString(),
    authorName: n.author?.name ?? null,
    content: n.content,
    contentEn: n.contentEn,
    contentPl: n.contentPl,
    previewContent: n.previewContent,
    previewContentEn: n.previewContentEn,
    previewContentPl: n.previewContentPl,
    pageBgColor: n.pageBgColor,
    templateKind: n.templateKind,
    templateData: n.templateData,
    templateBlocks: n.templateBlocks,
    templateCanvas: n.templateCanvas,
  }));

  let blocks: Block[] = [];
  if (src?.content) {
    const localized =
      locale === "en" && src.contentEn ? src.contentEn :
      locale === "pl" && src.contentPl ? src.contentPl :
      src.content;
    const parsed = parseBlocks(localized);
    if (parsed.isJson) blocks = parsed.blocks;
  }

  // Per-block schedule + filter unavailable newsCard (як на публічній /news).
  const visibleBlocks = blocks.filter((b) => {
    if (b.type === "newsCard") {
      const newsId = b.data.newsId || "";
      if (!newsItemsForBlocks.some((n) => n.id === newsId)) return false;
      const fromStr = b.data.visibleFrom || "";
      const untilStr = b.data.visibleUntil || "";
      if (fromStr) {
        const from = new Date(fromStr);
        if (!Number.isNaN(from.getTime()) && from > now) return false;
      }
      if (untilStr) {
        const until = new Date(untilStr);
        if (!Number.isNaN(until.getTime()) && until <= now) return false;
      }
    }
    return true;
  });

  const useBuilderLayout = visibleBlocks.length > 0;
  const pageBg = src?.pageBgColor || undefined;
  const canvasH = useBuilderLayout ? canvasHeight(visibleBlocks) : 0;

  return (
    <main className="min-h-screen" style={{ background: pageBg || "#F9FAFB" }}>
      <style>{NEWS_BLOCK_CSS}</style>
      <section className="bg-gradient-to-br from-[#1C3A2E] to-[#2a4f3f] text-white py-20">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{c.title}</h1>
          <p className="text-white/70 text-lg">{c.subtitle}</p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 py-16">
        {useBuilderLayout ? (
          <>
            <div
              className="hidden md:block relative mx-auto"
              style={{ width: CANVAS_WIDTH, height: canvasH }}
            >
              {visibleBlocks.map(b => (
                <AbsoluteBlockRender
                  key={b.id}
                  block={b}
                  newsItems={newsItemsForBlocks}
                  locale={locale}
                />
              ))}
            </div>
            <div className="md:hidden">
              {visibleBlocks.map(b => (
                <SequentialBlockRender
                  key={b.id}
                  block={b}
                  newsItems={newsItemsForBlocks}
                  locale={locale}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">{"📰"}</div>
            <p className="text-gray-500 text-lg">{c.empty}</p>
          </div>
        )}
      </section>
    </main>
  );
}
