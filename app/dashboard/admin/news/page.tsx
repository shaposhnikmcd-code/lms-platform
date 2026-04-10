"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FaPlus, FaEdit, FaTrash, FaEye, FaEyeSlash } from "react-icons/fa";

interface NewsItem {
  id: string;
  title: string;
  slug: string;
  category: string;
  published: boolean;
  createdAt: string;
  author?: { name: string | null };
}

const CATEGORY_LABELS: Record<string, string> = {
  NEWS: "Новини",
  ANNOUNCEMENT: "Оголошення",
  ARTICLE: "Стаття",
};

export default function AdminNewsPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/news")
      .then((r) => r.json())
      .then((d) => { setNews(d); setLoading(false); });
  }, []);

  const togglePublish = async (id: string, published: boolean) => {
    await fetch(`/api/admin/news/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !published }),
    });
    setNews(news.map((n) => n.id === id ? { ...n, published: !published } : n));
  };

  const deleteNews = async (id: string) => {
    if (!confirm("Видалити цю новину?")) return;
    await fetch(`/api/admin/news/${id}`, { method: "DELETE" });
    setNews(news.filter((n) => n.id !== id));
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-10 h-10 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Новини</h1>
        <Link href="/dashboard/admin/news/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white text-sm font-medium rounded-lg hover:bg-indigo-600 shadow-sm shadow-indigo-500/20 transition-colors">
          <FaPlus /> Створити новину
        </Link>
      </div>

      {news.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/70 p-16 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="text-slate-500 mb-5">Новин ще немає</p>
          <Link href="/dashboard/admin/news/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white text-sm font-medium rounded-lg hover:bg-indigo-600 transition-colors">
            <FaPlus /> Створити першу новину
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50/70 border-b border-slate-200/70">
              <tr>
                <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Заголовок</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Категорія</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Автор</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Статус</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Дата і час</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Дії</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {news.map((item) => {
                const date = new Date(item.createdAt);
                const dateStr = date.toLocaleDateString("uk-UA");
                const timeStr = date.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });
                return (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3">
                      <p className="text-sm font-medium text-slate-800 line-clamp-1">{item.title}</p>
                      <p className="text-xs text-slate-400">/news/{item.slug}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
                        {CATEGORY_LABELS[item.category]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600">
                      {item.author?.name || "—"}
                    </td>
                    <td className="px-5 py-3">
                      {item.published ? (
                        <span className="flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 rounded-full text-xs font-medium w-fit">
                          <FaEye className="text-xs" /> Опубліковано
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium w-fit">
                          <FaEyeSlash className="text-xs" /> Чернетка
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-sm text-slate-600">{dateStr}</p>
                      <p className="text-xs text-slate-400">{timeStr}</p>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => togglePublish(item.id, item.published)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                          title={item.published ? "Зняти з публікації" : "Опублікувати"}
                        >
                          {item.published ? <FaEyeSlash /> : <FaEye />}
                        </button>
                        <Link href={`/dashboard/admin/news/${item.id}/edit`}
                          className="p-2 text-slate-400 hover:text-amber-600 hover:bg-slate-100 rounded-lg transition-colors">
                          <FaEdit />
                        </Link>
                        <button
                          onClick={() => deleteNews(item.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}