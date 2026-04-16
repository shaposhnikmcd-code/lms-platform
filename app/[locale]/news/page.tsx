import Image from "next/image";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { FaCalendar, FaUser } from "react-icons/fa";
import { getTranslatedContent } from "@/lib/translate";
import { newsContent } from "./_content/uk";

const getContent = getTranslatedContent(newsContent, "news-page", {
  en: () => import("./_content/en").then(m => m.default),
  pl: () => import("./_content/pl").then(m => m.default),
});

const CATEGORY_COLORS: Record<string, string> = {
  NEWS: "bg-blue-100 text-blue-700",
  ANNOUNCEMENT: "bg-yellow-100 text-yellow-700",
  ARTICLE: "bg-green-100 text-green-700",
  EVENT: "bg-pink-100 text-pink-700",
};

export default async function NewsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const c = await getContent(locale);

  const now = new Date();
  const news = await prisma.news.findMany({
    where: {
      published: true,
      OR: [
        { suspendedAt: null },
        { resumeAt: { lte: now } },
      ],
    },
    orderBy: { createdAt: "desc" },
    include: { author: { select: { name: true } } },
  });

  return (
    <main className="min-h-screen bg-gray-50">
      <section className="bg-gradient-to-br from-[#1C3A2E] to-[#2a4f3f] text-white py-20">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{c.title}</h1>
          <p className="text-white/70 text-lg">{c.subtitle}</p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 py-16">
        {news.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">{"📰"}</div>
            <p className="text-gray-500 text-lg">{c.empty}</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {news.map((item) => {
              const title = locale === "en" ? (item.titleEn ?? item.title)
                : locale === "pl" ? (item.titlePl ?? item.title)
                : item.title;
              const excerpt = locale === "en" ? (item.excerptEn ?? item.excerpt)
                : locale === "pl" ? (item.excerptPl ?? item.excerpt)
                : item.excerpt;
              return (
              <Link key={item.id} href={`/news/${item.slug}`}
                className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden group">
                {item.imageUrl ? (
                  <div className="relative w-full h-48 overflow-hidden">
                    <Image src={item.imageUrl} alt={title} fill className="object-cover group-hover:scale-105 transition-transform duration-300" />
                  </div>
                ) : (
                  <div className="w-full h-48 bg-gradient-to-br from-[#1C3A2E] to-[#2a4f3f] flex items-center justify-center">
                    <span className="text-5xl">{"📰"}</span>
                  </div>
                )}
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${CATEGORY_COLORS[item.category]}`}>
                      {c.categories[item.category as keyof typeof c.categories] ?? item.category}
                    </span>
                  </div>
                  <h2 className="font-bold text-[#1C3A2E] text-lg mb-2 group-hover:text-[#D4A843] transition-colors line-clamp-2">
                    {title}
                  </h2>
                  {excerpt && (
                    <p className="text-gray-500 text-sm mb-4 line-clamp-3">{excerpt}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <FaCalendar />
                      {new Date(item.createdAt).toLocaleDateString(locale === "uk" ? "uk-UA" : locale === "pl" ? "pl-PL" : "en-US")}
                    </span>
                    {item.author?.name && (
                      <span className="flex items-center gap-1">
                        <FaUser />
                        {item.author.name}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );})}
          </div>
        )}
      </section>
    </main>
  );
}