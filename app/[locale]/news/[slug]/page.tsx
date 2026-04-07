import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { FaCalendar, FaUser, FaArrowLeft } from "react-icons/fa";
import { getTranslatedContent } from "@/lib/translate";
import { newsContent } from "../_content/uk";

const getContent = getTranslatedContent(newsContent, "news-page", {
  en: () => import("../_content/en").then(m => m.default),
  pl: () => import("../_content/pl").then(m => m.default),
});

const CATEGORY_COLORS: Record<string, string> = {
  NEWS: "bg-blue-100 text-blue-700",
  ANNOUNCEMENT: "bg-yellow-100 text-yellow-700",
  ARTICLE: "bg-green-100 text-green-700",
};

type BlockType = "text" | "heading" | "image" | "youtube" | "quote" | "divider";
interface Block { id: string; type: BlockType; data: Record<string, string>; }

function renderBlocks(content: string): { isJson: boolean; blocks: Block[] } {
  if (!content) return { isJson: false, blocks: [] };
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return { isJson: true, blocks: parsed };
  } catch {}
  return { isJson: false, blocks: [] };
}

function getEmbedUrl(url: string): string {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([a-zA-Z0-9_-]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : "";
}

type Props = { params: Promise<{ slug: string; locale: string }> };

export default async function NewsItemPage({ params }: Props) {
  const { slug, locale } = await params;
  const c = await getContent(locale);

  const item = await prisma.news.findUnique({
    where: { slug },
    include: { author: { select: { name: true } } },
  });

  if (!item || !item.published) notFound();

  const related = await prisma.news.findMany({
    where: { published: true, id: { not: item.id }, category: item.category },
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

  const { isJson, blocks } = renderBlocks(localizedContent);
  const isOldHtml = !isJson && localizedContent?.trim().startsWith("<");

  return (
    <main className="min-h-screen bg-gray-50">
      <section className="bg-gradient-to-br from-[#1C3A2E] to-[#2a4f3f] text-white py-12">
        <div className="max-w-4xl mx-auto px-4">
          <Link href="/news" className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white mb-6 transition-colors">
            <FaArrowLeft /> {c.back}
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <span className={"text-xs px-3 py-1 rounded-full font-medium " + CATEGORY_COLORS[item.category]}>
              {c.categories[item.category as keyof typeof c.categories] ?? item.category}
            </span>
            <span className="flex items-center gap-1 text-xs text-white/50">
              <FaCalendar />{new Date(item.createdAt).toLocaleDateString(locale === "uk" ? "uk-UA" : locale === "pl" ? "pl-PL" : "en-US")}
            </span>
            {item.author?.name && (
              <span className="flex items-center gap-1 text-xs text-white/50">
                <FaUser />{item.author.name}
              </span>
            )}
          </div>
          <h1 className="text-3xl md:text-4xl font-bold leading-tight">{title}</h1>
          {excerpt && (
            <p className="text-white/70 text-lg mt-4 leading-relaxed">{excerpt}</p>
          )}
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="bg-white rounded-2xl shadow-sm p-8 md:p-12">
          {item.imageUrl && (
            <div className="rounded-xl overflow-hidden mb-8">
              <img src={item.imageUrl} alt={title} className="w-full h-64 object-cover" />
            </div>
          )}

          {isJson && blocks.length > 0 && (
            <div className="news-content">
              {blocks.map((block) => {
                switch (block.type) {
                  case "text":
                    return <div key={block.id} dangerouslySetInnerHTML={{ __html: block.data.html || "" }} />;
                  case "heading": {
                    const Tag = `h${block.data.level || "2"}` as "h1" | "h2" | "h3";
                    return <Tag key={block.id} style={{ color: "#1C3A2E", fontWeight: 700, margin: "1em 0 0.5em" }}>{block.data.text}</Tag>;
                  }
                  case "image":
                    return block.data.url ? (
                      <img key={block.id} src={block.data.url} alt={block.data.alt || ""} style={{ width: "100%", borderRadius: "8px", margin: "1em 0" }} />
                    ) : null;
                  case "youtube": {
                    const embedUrl = getEmbedUrl(block.data.url || "");
                    return embedUrl ? (
                      <iframe key={block.id} src={embedUrl} style={{ width: "100%", height: "360px", borderRadius: "8px", border: "none", margin: "1em 0" }} allowFullScreen />
                    ) : null;
                  }
                  case "quote":
                    return (
                      <blockquote key={block.id} style={{ borderLeft: "4px solid #D4A843", margin: "1em 0", padding: "0.5em 1em", background: "#E8F5E0", borderRadius: "0 6px 6px 0", color: "#1C3A2E" }}>
                        {block.data.text}
                      </blockquote>
                    );
                  case "divider":
                    return <hr key={block.id} style={{ border: "none", borderTop: "2px solid #D4A843", margin: "1.5em 0" }} />;
                  default:
                    return null;
                }
              })}
            </div>
          )}

          {isOldHtml && (
            <div className="news-content" dangerouslySetInnerHTML={{ __html: item.content || "" }} />
          )}

          {!isJson && !isOldHtml && (
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
                    <img src={r.imageUrl} alt={rTitle} className="w-full h-32 object-cover rounded-lg mb-3" />
                  )}
                  <span className={"text-xs px-2 py-0.5 rounded-full font-medium " + CATEGORY_COLORS[r.category]}>
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

      <style>{`
        .news-content { font-family: -apple-system, BlinkMacSystemFont, sans-serif; color: #1C3A2E; line-height: 1.7; font-size: 16px; }
        .news-content h1 { font-size: 2rem; font-weight: 700; margin: 1.2em 0 0.5em; }
        .news-content h2 { font-size: 1.5rem; font-weight: 700; margin: 1.1em 0 0.5em; }
        .news-content h3 { font-size: 1.2rem; font-weight: 600; margin: 1em 0 0.4em; }
        .news-content p { margin: 0.6em 0; }
        .news-content ul { list-style: disc; padding-left: 1.5em; margin: 0.6em 0; }
        .news-content ol { list-style: decimal; padding-left: 1.5em; margin: 0.6em 0; }
        .news-content strong { font-weight: 700; }
        .news-content em { font-style: italic; }
        .news-content blockquote { border-left: 4px solid #D4A843; margin: 1em 0; padding: 0.5em 1em; background: #E8F5E0; border-radius: 0 6px 6px 0; }
        .news-content hr { border: none; border-top: 2px solid #D4A843; margin: 1.5em 0; }
        .news-content img { max-width: 100%; border-radius: 8px; margin: 1em 0; }
      `}</style>
    </main>
  );
}