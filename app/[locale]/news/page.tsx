import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import { getTranslatedContent } from "@/lib/translate";
import { buildPageMetadata } from "@/lib/seo";
import { maybeAutoPublishStagedNewsPage } from "@/lib/newsPagePublish";
import { hasUnfilledPlaceholders } from "@/lib/news/placeholderCheck";
import { newsContent } from "./_content/uk";
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

// ISR: 60s. Адмінські мутації PATCH /api/admin/news/page-content і admin/news/[id]
// викликають revalidatePath('/news') → миттєве оновлення.
export const revalidate = 60;

const getContent = getTranslatedContent(newsContent, "news-page", {
  en: () => import("./_content/en").then(m => m.default),
  pl: () => import("./_content/pl").then(m => m.default),
});

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const c = await getContent(locale);
  return buildPageMetadata({
    locale,
    path: "/news",
    title: c.title,
    description: c.subtitle,
  });
}

export default async function NewsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const c = await getContent(locale);

  // Read-time auto-publish: якщо у NewsPage є staged-копія з nextPublishAt що
  // настав — swap-имо у БД до того як читати live. Pattern як з News.suspendedAt
  // (без cron-ів, перевірка при читанні). Перший відвідувач /news після часу
  // публікації тригерить swap; решта читає вже оновлений content.
  await maybeAutoPublishStagedNewsPage();

  // Тягнемо паралельно: NewsPage layout + всі published новини (для join-у в newsCard блоках).
  // У ЗАПИТІ suspendedAt/resumeAt не фільтруємо (повний набір потрібен для рендеру),
  // але картки призупинених новин ховаємо нижче у visibleBlocks — інакше картка
  // видима, а клік по ній веде на 404 (детальна /news/[slug] гейтить suspendedAt).
  // Тягнемо тільки поля, що реально йдуть у рендер, і лише переклади активної
  // локалі: раніше кожен запит /news вивантажував UK+EN+PL копії content,
  // previewContent, templateData і templateBlocks усіх опублікованих новин
  // (десятки КБ на новину), з яких 2/3 одразу відкидались.
  const isEn = locale === "en";
  const isPl = locale === "pl";

  const now = new Date();
  const [pageRow, publishedNews] = await Promise.all([
    prisma.newsPage.findUnique({ where: { key: "default" } }),
    prisma.news.findMany({
      where: { published: true, isTemplate: false },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        imageUrl: true,
        category: true,
        createdAt: true,
        suspendedAt: true,
        resumeAt: true,
        pageBgColor: true,
        content: true,
        previewContent: true,
        templateKind: true,
        templateData: true,
        templateBlocks: true,
        templateCanvas: true,
        titleEn: isEn,
        titlePl: isPl,
        excerptEn: isEn,
        excerptPl: isPl,
        contentEn: isEn,
        contentPl: isPl,
        previewContentEn: isEn,
        previewContentPl: isPl,
        templateDataEn: isEn,
        templateDataPl: isPl,
        templateBlocksEn: isEn,
        templateBlocksPl: isPl,
        author: { select: { name: true } },
      },
    }),
  ]);

  const newsItemsForBlocks: NewsListItemForBlock[] = publishedNews.map(n => ({
    id: n.id,
    title: n.title,
    titleEn: n.titleEn ?? null,
    titlePl: n.titlePl ?? null,
    slug: n.slug,
    excerpt: n.excerpt,
    excerptEn: n.excerptEn ?? null,
    excerptPl: n.excerptPl ?? null,
    imageUrl: n.imageUrl,
    category: n.category,
    createdAt: n.createdAt.toISOString(),
    authorName: n.author?.name ?? null,
    // Контент потрібен для newsCard блоків з displayMode="expanded" — повний інлайн-рендер.
    content: n.content,
    contentEn: n.contentEn ?? null,
    contentPl: n.contentPl ?? null,
    // Кастомний layout превʼю-картки — для displayMode="preview".
    previewContent: n.previewContent,
    previewContentEn: n.previewContentEn ?? null,
    previewContentPl: n.previewContentPl ?? null,
    pageBgColor: n.pageBgColor,
    // Template-based render: коли задано — newsCard рендериться через
    // lib/news/templates замість блокового renderer-а.
    templateKind: n.templateKind,
    templateData: n.templateData,
    templateDataEn: n.templateDataEn ?? null,
    templateDataPl: n.templateDataPl ?? null,
    // Block-based template render (Session 4): якщо templateBlocks непустий,
    // картка рендериться через AbsoluteBlockRender у рамках templateCanvas;
    // інакше fallback на legacy templateData → TemplatePreviewCard.
    // *En/*Pl — локалізований текст карток (render обирає за locale).
    templateBlocks: n.templateBlocks,
    templateBlocksEn: n.templateBlocksEn ?? null,
    templateBlocksPl: n.templateBlocksPl ?? null,
    templateCanvas: n.templateCanvas,
  }));

  // Призупинені новини (suspendedAt настав, resumeAt ще не настав) — той самий
  // інваріант, що гейтить детальну /news/[slug]. Їхні картки треба ховати з
  // listing-у, інакше картка видима, а клік по ній → 404 (dead-end link).
  const suspendedIds = new Set(
    publishedNews
      .filter(n => !!n.suspendedAt && n.suspendedAt <= now && (!n.resumeAt || n.resumeAt > now))
      .map(n => n.id),
  );

  // Сторінка публікується тільки якщо адмін активував її через toggle на /dashboard/admin/news.
  // Без цього /news показує empty state — навіть якщо layout є в БД (це чернетка).
  const isActive = !!pageRow?.published;

  let blocks: Block[] = [];
  if (isActive && pageRow?.content) {
    const localized =
      locale === "en" && pageRow.contentEn ? pageRow.contentEn :
      locale === "pl" && pageRow.contentPl ? pageRow.contentPl :
      pageRow.content;
    const parsed = parseBlocks(localized);
    if (parsed.isJson) blocks = parsed.blocks;
  }

  // Per-block schedule: відсіюємо newsCard блоки, чий час "Зʼявиться" ще не настав
  // або "Зникне" вже минув. Інші типи блоків (heading/text/image тощо) лишаються завжди.
  // Також фільтруємо newsCard, у яких прикріплена новина не доступна (не published чи suspended)
  // АБО містить незаповнені плейсхолдери шаблону (safety net поверх API-гарду в
  // [app/api/admin/news/[id]/route.ts] на випадок legacy-записів).
  const visibleBlocks = blocks.filter((b) => {
    if (b.type === "newsCard") {
      const newsId = b.data.newsId || "";
      const item = newsItemsForBlocks.find((n) => n.id === newsId);
      if (!item) return false;
      if (suspendedIds.has(newsId)) return false;
      if (hasUnfilledPlaceholders(item.templateData, item.templateBlocks)) return false;

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
  const pageBg = pageRow?.pageBgColor || undefined;
  // Heuristic: блоки, збережені новим кодом, мають width у пікселях (>100 для
  // реальних розмірів). Legacy %-формат тримає всі width ≤ 100. Без цієї
  // детекції превʼю ламається для непереміщених legacy-сторінок (block w="100"
  // інтерпретувався би як 100px → крихітна точка). Після першого save через
  // нову адмінку дані конвертуються у px і блок-флаг стане true автоматично.
  const blocksUseAbsolutePx = visibleBlocks.some(
    b => (Number(b.width) || 0) > 100 || (b.x ?? 0) > 100
  );
  const canvasH = useBuilderLayout
    ? canvasHeight(visibleBlocks, { widthIsPx: blocksUseAbsolutePx })
    : 0;

  return (
    <main className="min-h-screen" style={{ background: pageBg || "#F9FAFB" }}>
      <style>{NEWS_BLOCK_CSS}</style>
      <section className="bg-gradient-to-br from-[#1C3A2E] to-[#2a4f3f] text-white py-20">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{c.title}</h1>
          <p className="text-white/70 text-lg">{c.subtitle}</p>
        </div>
      </section>

      <section
        className="mx-auto px-4 py-16"
        // maxWidth = pageWidth + horizontal padding (px-4 = 32px), щоб контент-зона
        // дорівнювала pageWidth. Інакше container шириною pageWidth «вилазив» за
        // межі section через padding.
        style={{ maxWidth: (pageRow?.pageWidth ?? CANVAS_WIDTH) + 32 }}
      >
        {useBuilderLayout ? (
          <>
            {/* Desktop — абсолютний canvas; Mobile — sequential stack. */}
            <div
              className="hidden md:block relative mx-auto"
              style={{ width: pageRow?.pageWidth ?? CANVAS_WIDTH, height: canvasH }}
            >
              {visibleBlocks.map(b => (
                <AbsoluteBlockRender
                  key={b.id}
                  block={b}
                  newsItems={newsItemsForBlocks}
                  locale={locale}
                  // На /news блоки збережені у абсолютних пікселях (а не у % від
                  // контейнера) — щоб реальний розмір новини/блока на сайті НЕ
                  // змінювався при зміні ширини сторінки. Detection вище — щоб
                  // legacy %-сторінки рендерилися без поломки.
                  widthIsPx={blocksUseAbsolutePx}
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
          // Empty state: жодного newsCard на сторінці білдера. Раніше тут була авто-сітка
          // з усіх published новин — тепер ні (видимість на /news диктує білдер).
          // Якщо є published новини але вони не розміщені — нагадуємо адміну. Інакше —
          // загальний "новин ще немає".
          <div className="text-center py-20">
            <div className="text-6xl mb-4">{"📰"}</div>
            <p className="text-gray-500 text-lg">{c.empty}</p>
          </div>
        )}
      </section>
    </main>
  );
}

