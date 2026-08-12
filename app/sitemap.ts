import type { MetadataRoute } from "next";
import prisma from "@/lib/prisma";
import { LOCALES, localeUrl } from "@/lib/seo";

// Sitemap перегенеровується раз на годину — новини публікуються не частіше.
export const revalidate = 3600;

/**
 * Публічні статичні маршрути (шлях без локального префікса) + пріоритет.
 * Свідомо НЕ включені: `/login`, `/forgot-password`, `/reset-password`,
 * `/payment/*` (транзакційні), `/news/preview` (адмін-превʼю),
 * `/certificate/[token]` (noindex, індивідуальні токени), `/dashboard/*`,
 * `/partners` і `/additional-materials` (заглушки «в розробці» — вони noindex).
 */
const STATIC_ROUTES: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }> = [
  { path: "/", priority: 1.0, changeFrequency: "weekly" },
  { path: "/courses", priority: 0.9, changeFrequency: "weekly" },
  { path: "/yearly-program", priority: 0.9, changeFrequency: "weekly" },
  { path: "/courses/psychology-basics", priority: 0.8, changeFrequency: "monthly" },
  { path: "/courses/psychiatry-basics", priority: 0.8, changeFrequency: "monthly" },
  { path: "/courses/mentorship", priority: 0.8, changeFrequency: "monthly" },
  { path: "/courses/psychotherapy-of-biblical-heroes", priority: 0.8, changeFrequency: "monthly" },
  { path: "/courses/sex-education", priority: 0.8, changeFrequency: "monthly" },
  { path: "/courses/military-psychology", priority: 0.8, changeFrequency: "monthly" },
  { path: "/courses/emotional-intelligence", priority: 0.8, changeFrequency: "monthly" },
  { path: "/courses/Fundamentals-of-Christian-Psychology-2.0", priority: 0.7, changeFrequency: "monthly" },
  { path: "/games", priority: 0.7, changeFrequency: "monthly" },
  { path: "/links/connector", priority: 0.7, changeFrequency: "monthly" },
  { path: "/links/consultation", priority: 0.6, changeFrequency: "monthly" },
  { path: "/links", priority: 0.5, changeFrequency: "monthly" },
  { path: "/news", priority: 0.8, changeFrequency: "daily" },
  { path: "/consultations", priority: 0.7, changeFrequency: "monthly" },
  { path: "/contacts", priority: 0.6, changeFrequency: "monthly" },
  { path: "/charity", priority: 0.5, changeFrequency: "monthly" },
  { path: "/accessibility", priority: 0.3, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
  { path: "/delete-data", priority: 0.2, changeFrequency: "yearly" },
];

/** Один запис sitemap із alternates-блоком на всі три локалі. */
function entry(
  path: string,
  opts: { priority?: number; changeFrequency?: MetadataRoute.Sitemap[number]["changeFrequency"]; lastModified?: Date },
): MetadataRoute.Sitemap {
  return LOCALES.map((locale) => ({
    url: localeUrl(locale, path),
    lastModified: opts.lastModified,
    changeFrequency: opts.changeFrequency,
    priority: opts.priority,
    alternates: {
      languages: {
        "uk-UA": localeUrl("uk", path),
        en: localeUrl("en", path),
        pl: localeUrl("pl", path),
      },
    },
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // Ті самі умови видимості, що й на публічній /news/[slug]:
  // published, не blueprint, і не в активній паузі.
  let news: Array<{ slug: string; updatedAt: Date }> = [];
  try {
    news = await prisma.news.findMany({
      where: {
        published: true,
        isTemplate: false,
        OR: [{ suspendedAt: null }, { suspendedAt: { gt: now } }, { resumeAt: { lte: now } }],
      },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });
  } catch (e) {
    // Sitemap не має падати 500-ю, якщо БД недоступна — краще віддати статичну частину.
    console.error("[sitemap] news query failed:", e);
  }

  return [
    ...STATIC_ROUTES.flatMap((r) =>
      entry(r.path, { priority: r.priority, changeFrequency: r.changeFrequency, lastModified: now }),
    ),
    ...news.flatMap((n) =>
      entry(`/news/${n.slug}`, { priority: 0.6, changeFrequency: "monthly", lastModified: n.updatedAt }),
    ),
  ];
}
