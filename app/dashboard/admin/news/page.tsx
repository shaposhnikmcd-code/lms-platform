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
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-[#1C3A2E] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto">
      <Link href="/dashboard/admin"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#1C3A2E] mb-4 transition-colors">
        {"← Назад до адмін-панелі"}
      </Link>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#1C3A2E]">{"Новини"}</h1>
        <Link href="/dashboard/admin/news/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#1C3A2E] text-white text-sm rounded-lg hover:bg-[#1C3A2E]/80 transition-colors">
          <FaPlus /> {"Створити новину"}
        </Link>
      </div>

      {news.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center shadow-sm">
          <p className="text-gray-500 mb-4">{"Новин ще немає"}</p>
          <Link href="/dashboard/admin/news/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#1C3A2E] text-white text-sm rounded-lg">
            <FaPlus /> {"Створити першу новину"}
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{"Заголовок"}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{"Категорія"}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{"Автор"}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{"Статус"}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{"Дата і час"}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{"Дії"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {news.map((item) => {
                const date = new Date(item.createdAt);
                const dateStr = date.toLocaleDateString("uk-UA");
                const timeStr = date.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });
                return (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-800 line-clamp-1">{item.title}</p>
                      <p className="text-xs text-gray-400">{"/news/" + item.slug}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                        {CATEGORY_LABELS[item.category]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {item.author?.name || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {item.published ? (
                        <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs w-fit">
                          <FaEye className="text-xs" /> {"Опубліковано"}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs w-fit">
                          <FaEyeSlash className="text-xs" /> {"Чернетка"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-600">{dateStr}</p>
                      <p className="text-xs text-gray-400">{timeStr}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => togglePublish(item.id, item.published)}
                          className="p-1.5 text-gray-400 hover:text-[#1C3A2E] transition-colors"
                          title={item.published ? "Зняти з публікації" : "Опублікувати"}
                        >
                          {item.published ? <FaEyeSlash /> : <FaEye />}
                        </button>
                        <Link href={`/dashboard/admin/news/${item.id}/edit`}
                          className="p-1.5 text-gray-400 hover:text-[#D4A843] transition-colors">
                          <FaEdit />
                        </Link>
                        <button
                          onClick={() => deleteNews(item.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
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