import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { FaCalendar, FaUser, FaArrowLeft } from "react-icons/fa";

const CATEGORY_LABELS: Record<string, string> = {
  NEWS: "Новини",
  ANNOUNCEMENT: "Оголошення",
  ARTICLE: "Стаття",
};

const CATEGORY_COLORS: Record<string, string> = {
  NEWS: "bg-blue-100 text-blue-700",
  ANNOUNCEMENT: "bg-yellow-100 text-yellow-700",
  ARTICLE: "bg-green-100 text-green-700",
};

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function NewsItemPage({ params }: Props) {
  const { slug } = await params;

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

  return (
    <main className="min-h-screen bg-gray-50">
      {item.imageUrl && (
        <div className="w-full h-64 md:h-96 overflow-hidden">
          <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link href="/news"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#1C3A2E] mb-6 transition-colors">
          <FaArrowLeft /> Назад до новин
        </Link>

        <div className="bg-white rounded-2xl shadow-sm p-8 md:p-12">
          <div className="flex items-center gap-3 mb-6">
            <span className={`text-xs px-3 py-1 rounded-full font-medium ${CATEGORY_COLORS[item.category]}`}>
              {CATEGORY_LABELS[item.category]}
            </span>
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <FaCalendar />
              {new Date(item.createdAt).toLocaleDateString("uk-UA")}
            </span>
            {item.author?.name && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <FaUser />
                {item.author.name}
              </span>
            )}
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-[#1C3A2E] mb-6">{item.title}</h1>

          {item.excerpt && (
            <p className="text-lg text-gray-600 mb-8 border-l-4 border-[#D4A843] pl-4 italic">
              {item.excerpt}
            </p>
          )}

          <div className="prose prose-lg max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
            {item.content}
          </div>
        </div>

        {related.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-bold text-[#1C3A2E] mb-6">Схожі матеріали</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {related.map((r) => (
                <Link key={r.id} href={`/news/${r.slug}`}
                  className="bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-all">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[r.category]}`}>
                    {CATEGORY_LABELS[r.category]}
                  </span>
                  <h3 className="font-medium text-[#1C3A2E] mt-2 text-sm line-clamp-2 hover:text-[#D4A843] transition-colors">
                    {r.title}
                  </h3>
                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(r.createdAt).toLocaleDateString("uk-UA")}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}