import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { FaCalendar, FaUser, FaArrowLeft } from "react-icons/fa";
import BlockRenderer from "@/components/news/BlockRenderer";
import { parseContent, getBlockPosStyle } from "@/components/news/newsUtils";
import { Block } from "@/components/news/newsTypes";

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

type Props = { params: Promise<{ slug: string }> };

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

  const rows = parseContent(item.content);

  return (
    <main className="min-h-screen bg-gray-50">
      <section className="bg-gradient-to-br from-[#1C3A2E] to-[#2a4f3f] text-white py-12">
        <div className="max-w-4xl mx-auto px-4">
          <Link href="/news" className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white mb-6 transition-colors">
            <FaArrowLeft /> Назад до новин
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <span className={"text-xs px-3 py-1 rounded-full font-medium " + CATEGORY_COLORS[item.category]}>
              {CATEGORY_LABELS[item.category]}
            </span>
            <span className="flex items-center gap-1 text-xs text-white/50">
              <FaCalendar />{new Date(item.createdAt).toLocaleDateString("uk-UA")}
            </span>
            {item.author?.name && (
              <span className="flex items-center gap-1 text-xs text-white/50">
                <FaUser />{item.author.name}
              </span>
            )}
          </div>
          <h1 className="text-3xl md:text-4xl font-bold leading-tight">{item.title}</h1>
          {item.excerpt && (
            <p className="text-white/70 text-lg mt-4 leading-relaxed">{item.excerpt}</p>
          )}
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 py-10">
        {rows ? (
          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row.id} className="flex gap-2 flex-wrap items-start">
                {row.blocks.map((block: Block) => (
                  <div key={block.id} style={getBlockPosStyle(block)}>
                    <BlockRenderer block={block} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm p-8 md:p-12">
            {item.imageUrl && (
              <div className="rounded-xl overflow-hidden mb-8">
                <img src={item.imageUrl} alt={item.title} className="w-full h-64 object-cover" />
              </div>
            )}
            <div className="prose prose-lg max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
              {item.content}
            </div>
          </div>
        )}

        {related.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-bold text-[#1C3A2E] mb-6">Схожі матеріали</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {related.map((r) => (
                <Link key={r.id} href={"/news/" + r.slug} className="bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-all">
                  {r.imageUrl && (
                    <img src={r.imageUrl} alt={r.title} className="w-full h-32 object-cover rounded-lg mb-3" />
                  )}
                  <span className={"text-xs px-2 py-0.5 rounded-full font-medium " + CATEGORY_COLORS[r.category]}>
                    {CATEGORY_LABELS[r.category]}
                  </span>
                  <h3 className="font-medium text-[#1C3A2E] mt-2 text-sm line-clamp-2 hover:text-[#D4A843] transition-colors">
                    {r.title}
                  </h3>
                  <p className="text-xs text-gray-400 mt-2">{new Date(r.createdAt).toLocaleDateString("uk-UA")}</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}