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

const getContent = getTranslatedContent(newsContent, "news-page", {
  en: () => import("../_content/en").then(m => m.default),
  pl: () => import("../_content/pl").then(m => m.default),
});

const CATEGORY_COLORS: Record<string, string> = {
  NEWS: "bg-blue-100 text-blue-700",
  ANNOUNCEMENT: "bg-yellow-100 text-yellow-700",
  ARTICLE: "bg-green-100 text-green-700",
};

type BlockType = "text" | "heading" | "image" | "youtube" | "quote" | "divider" | "card";
interface Block {
  id: string;
  type: BlockType;
  data: Record<string, string>;
  width?: string;
  x?: number;
  y?: number;
  height?: number;
  align?: "left" | "center" | "right";
  bgColor?: string;
}

const CANVAS_WIDTH = 832;

function renderBlocks(content: string): { isJson: boolean; blocks: Block[] } {
  if (!content) return { isJson: false, blocks: [] };
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return { isJson: true, blocks: parsed };
  } catch {}
  return { isJson: false, blocks: [] };
}

function hasCoords(blocks: Block[]): boolean {
  return blocks.some(b => typeof b.x === "number" && typeof b.y === "number");
}

function canvasHeight(blocks: Block[]): number {
  const LEGACY_H: Record<string, number> = { heading: 80, text: 180, image: 600, youtube: 360, quote: 120, divider: 40, card: 320 };
  return Math.max(
    400,
    ...blocks.map(b => {
      let h = b.height;
      // Якщо це image без записаної висоти — обчислимо з aspectRatio (точна висота в pixels)
      if (!h && b.type === "image" && b.data?.aspectRatio) {
        const ar = parseFloat(b.data.aspectRatio);
        const wPct = Math.max(1, Number(b.width) || 100);
        if (ar > 0) h = Math.round((CANVAS_WIDTH * wPct / 100) / ar);
      }
      if (!h || h <= 0) h = LEGACY_H[b.type] ?? 200;
      return (b.y ?? 0) + h + 60;
    })
  );
}

function BlockInner({ block }: { block: Block }) {
  const align = block.align || "left";
  const textColor = (block.bgColor === "#1C3A2E" || block.bgColor === "#1a1a1a") ? "#FAF6F0" : "#1C3A2E";
  switch (block.type) {
    case "text":
      return <div style={{ textAlign: align, color: textColor }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.data.html || "") }} />;
    case "heading": {
      const Tag = `h${block.data.level || "2"}` as "h1" | "h2" | "h3";
      return <Tag style={{ color: textColor, fontWeight: 700, margin: "0.3em 0", textAlign: align }}>{block.data.text}</Tag>;
    }
    case "image": {
      if (!block.data.url) return null;
      let overlays: Array<{ id: string; text: string; x: number; y: number; w?: number; h?: number; fontSize: number; color: string; bgColor?: string; weight: number; radius?: number; shadow?: boolean; fontFamily?: string; italic?: boolean; underline?: boolean; align?: "left" | "center" | "right"; letterSpacing?: number; lineHeight?: number; href?: string }> = [];
      try {
        const parsed = JSON.parse(block.data.overlays || "[]");
        if (Array.isArray(parsed)) overlays = parsed;
      } catch { /* ignore */ }
      // Якщо в блоці задана висота → обʼєкт-фіт fill (як у білдері): картинка
      // повністю заповнює блок, без обрізки країв. Без явної висоти → contain.
      const hasExplicitHeight = typeof block.height === "number" && block.height > 0;
      const objectFit: "fill" | "contain" = hasExplicitHeight ? "fill" : "contain";
      return (
        <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: "8px", overflow: "hidden" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={block.data.url} alt={block.data.alt || ""} style={{ width: "100%", height: "100%", objectFit, display: "block" }} />
          {overlays.map(ov => {
            const r = ov.radius ?? (ov.bgColor ? 4 : 0);
            const radiusCss = r >= 999 ? "9999px" : `${r}px`;
            const padX = ov.bgColor ? Math.max(10, Math.round(ov.fontSize * 0.5)) : 6;
            const padY = ov.bgColor ? Math.max(4, Math.round(ov.fontSize * 0.2)) : 2;
            const hasSize = typeof ov.w === "number" && typeof ov.h === "number";
            const safeHref = ov.href && /^(https?:\/\/|\/|mailto:|tel:)/i.test(ov.href) ? ov.href : "";
            const external = /^https?:\/\//i.test(safeHref);
            const commonStyle: React.CSSProperties = {
              position: "absolute",
              left: `${ov.x}%`,
              top: `${ov.y}%`,
              width: hasSize ? `${ov.w}%` : "auto",
              height: hasSize ? `${ov.h}%` : "auto",
              color: ov.color,
              background: ov.bgColor || "transparent",
              fontSize: `${ov.fontSize}px`,
              fontWeight: ov.weight,
              fontFamily: ov.fontFamily || undefined,
              fontStyle: ov.italic ? "italic" : "normal",
              textDecoration: ov.underline ? "underline" : "none",
              letterSpacing: ov.letterSpacing ? `${ov.letterSpacing}px` : "normal",
              lineHeight: ov.lineHeight || 1.2,
              textAlign: ov.align || "center",
              textShadow: ov.bgColor ? "none" : "0 2px 8px rgba(0,0,0,0.5)",
              whiteSpace: "pre-wrap",
              padding: `${padY}px ${padX}px`,
              borderRadius: radiusCss,
              boxShadow: ov.shadow ? "0 4px 16px rgba(0,0,0,0.35)" : "none",
              display: hasSize ? "flex" : "inline-block",
              alignItems: hasSize ? "center" : undefined,
              justifyContent: hasSize ? (ov.align === "left" ? "flex-start" : ov.align === "right" ? "flex-end" : "center") : undefined,
              boxSizing: "border-box",
              overflow: "hidden",
              pointerEvents: safeHref ? "auto" : "none",
              cursor: safeHref ? "pointer" : "default",
            };
            if (safeHref) {
              return (
                <a
                  key={ov.id}
                  href={safeHref}
                  {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  style={commonStyle}
                >{ov.text}</a>
              );
            }
            return <span key={ov.id} style={commonStyle}>{ov.text}</span>;
          })}
        </div>
      );
    }
    case "youtube": {
      const embed = getEmbedUrl(block.data.url || "");
      return embed ? (
        <iframe src={embed} style={{ width: "100%", height: "100%", minHeight: "200px", borderRadius: "8px", border: "none", display: "block" }} allowFullScreen />
      ) : null;
    }
    case "quote":
      return (
        <blockquote style={{ borderLeft: "4px solid #D4A843", margin: 0, padding: "0.5em 1em", background: "#E8F5E0", borderRadius: "0 6px 6px 0", color: textColor, textAlign: align, height: "100%", boxSizing: "border-box" }}>
          {block.data.text}
        </blockquote>
      );
    case "divider":
      return <hr style={{ border: "none", borderTop: "2px solid #D4A843", margin: "0.8em 0" }} />;
    case "card": {
      const title = block.data.title || "";
      const subtitle = block.data.subtitle || "";
      const buttonLabel = block.data.buttonLabel || "";
      const buttonHref = block.data.buttonHref || "";
      const cardBg = block.data.bgColor || "#1C3A2E";
      const cardImg = block.data.bgImage || "";
      const cardTextColor = block.data.textColor || "#FAF6F0";
      const buttonBg = block.data.buttonBg || "#D4A843";
      const buttonColor = block.data.buttonColor || "#1C3A2E";
      const radius = Number(block.data.radius || "16");
      const cardAlign = (block.data.cardAlign || "center") as "left" | "center" | "right";
      const itemAlign = cardAlign === "center" ? "center" : cardAlign === "right" ? "flex-end" : "flex-start";
      return (
        <div style={{
          position: "relative",
          width: "100%", height: "100%",
          borderRadius: `${radius}px`,
          overflow: "hidden",
          background: cardImg ? "transparent" : cardBg,
          padding: "32px 24px",
          display: "flex", flexDirection: "column", justifyContent: "center",
          textAlign: cardAlign,
          boxSizing: "border-box",
        }}>
          {cardImg && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cardImg} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }} />
          )}
          {cardImg && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 1 }} />}
          <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", gap: "12px", alignItems: itemAlign }}>
            {title && <h3 style={{ color: cardTextColor, fontSize: "26px", fontWeight: 700, lineHeight: 1.2, margin: 0 }}>{title}</h3>}
            {subtitle && <p style={{ color: cardTextColor, fontSize: "14px", lineHeight: 1.5, margin: 0, opacity: 0.9 }}>{subtitle}</p>}
            {buttonLabel && buttonHref && (() => {
              const safe = /^(https?:\/\/|\/|mailto:|tel:)/i.test(buttonHref) ? buttonHref : "#";
              const external = /^https?:\/\//i.test(safe);
              return (
                <a
                  href={safe}
                  {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  style={{
                    display: "inline-block", padding: "12px 28px", borderRadius: "8px",
                    background: buttonBg, color: buttonColor,
                    fontSize: "14px", fontWeight: 700, textDecoration: "none",
                    letterSpacing: "0.04em",
                  }}
                >{buttonLabel}</a>
              );
            })()}
          </div>
        </div>
      );
    }
    default:
      return null;
  }
}

// Chrome у білдері (BlockItem header+padding+border) з'їдає з висоти/ширини
// видимої області блока. Щоб public render дзеркалив білдер 1-в-1, додаємо
// такі ж відступи у внутрішнього контейнера. Тоді image area має ідентичні
// розміри і AR не "плющиться".
const BUILDER_HEADER_H = 32;
const BUILDER_PAD_X = 16;
const BUILDER_PAD_Y = 14;
const BUILDER_BORDER = 1.5;

function AbsoluteBlockRender({ block }: { block: Block }) {
  const w = Number(block.width) || 100;
  const x = block.x ?? 0;
  const y = block.y ?? 0;
  const h = block.height;
  return (
    <div
      data-news-block
      style={{
        position: "absolute",
        left: `${x}%`,
        top: `${y}px`,
        width: `${w}%`,
        height: h ? `${h}px` : "auto",
        background: block.bgColor || "transparent",
        borderRadius: block.bgColor ? "8px" : 0,
        boxSizing: "border-box",
        overflow: "hidden",
        padding: `${BUILDER_HEADER_H + BUILDER_PAD_Y + BUILDER_BORDER}px ${BUILDER_PAD_X + BUILDER_BORDER}px ${BUILDER_PAD_Y + BUILDER_BORDER}px`,
      }}
    >
      <div style={{ width: "100%", height: "100%", position: "relative" }}>
        <BlockInner block={block} />
      </div>
    </div>
  );
}

function SequentialBlockRender({ block }: { block: Block }) {
  return (
    <div
      style={{
        margin: "0.8em 0",
        background: block.bgColor || "transparent",
        borderRadius: block.bgColor ? "8px" : 0,
        padding: block.bgColor ? "10px 14px" : 0,
      }}
    >
      <BlockInner block={block} />
    </div>
  );
}

// Repair localized blocks against the UK original by index. DeepL может
// зіпсувати або викинути URL у image/youtube блоках, тож тягнемо їх з UK.
function repairBlocks(localized: Block[], original: Block[]): Block[] {
  if (!original.length) return localized;
  return localized.map((b, i) => {
    const orig = original[i];
    if (!orig || orig.type !== b.type) return b;
    if (b.type === 'image' || b.type === 'youtube') {
      return { ...b, data: { ...b.data, url: orig.data.url || b.data.url } };
    }
    return b;
  });
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

  const now = new Date();
  const isSuspended =
    !!item?.suspendedAt && (!item.resumeAt || new Date(item.resumeAt) > now);
  if (!item || !item.published || isSuspended) notFound();

  const related = await prisma.news.findMany({
    where: {
      published: true,
      id: { not: item.id },
      category: item.category,
      OR: [
        { suspendedAt: null },
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

  let { isJson, blocks } = renderBlocks(localizedContent);
  // Якщо локалізована версія взагалі зламана — падаємо на UK-оригінал
  if (locale !== 'uk' && !isJson) {
    const ukParsed = renderBlocks(item.content);
    if (ukParsed.isJson) {
      isJson = true;
      blocks = ukParsed.blocks;
    }
  } else if (locale !== 'uk' && isJson) {
    // Виправляємо image/youtube URLs з UK-оригіналу
    const ukParsed = renderBlocks(item.content);
    if (ukParsed.isJson) {
      blocks = repairBlocks(blocks, ukParsed.blocks);
    }
  }
  const isOldHtml = !isJson && localizedContent?.trim().startsWith("<");

  return (
    <main className="min-h-screen bg-gray-50">
      <BackButton href="/news" label={c.back} />
      <section className="bg-gradient-to-br from-[#1C3A2E] to-[#2a4f3f] text-white py-12">
        <div className="max-w-4xl mx-auto px-4">
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

      <div className="mx-auto py-10 px-4 md:px-0" style={{ maxWidth: `${CANVAS_WIDTH + 64}px` }}>
        <div
          className="rounded-2xl shadow-sm"
          style={{ background: item.pageBgColor || "#FFFFFF", padding: "32px" }}
        >
          {isJson && blocks.length > 0 && (() => {
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

          {isOldHtml && (
            <div className="news-content" dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.content || "") }} />
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
                    <div className="relative w-full h-32 overflow-hidden rounded-lg mb-3">
                      <Image src={r.imageUrl} alt={rTitle} fill className="object-cover" />
                    </div>
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