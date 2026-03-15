"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewNewsPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    imageUrl: "",
    category: "NEWS",
    published: false,
  });

  const handleTitleChange = (title: string) => {
    const slug = title.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
    setForm({ ...form, title, slug });
  };

  const handleSubmit = async () => {
    if (!form.title || !form.slug || !form.content) {
      setMessage("Заповніть всі обов'язкові поля");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/admin/news", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      router.push("/dashboard/admin/news");
    } else {
      setMessage("Помилка збереження");
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/dashboard/admin/news"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#1C3A2E] mb-4 transition-colors">
        ← Назад до новин
      </Link>

      <h1 className="text-2xl font-bold text-[#1C3A2E] mb-8">Нова новина</h1>

      {message && (
        <div className="mb-4 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {message}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Заголовок *</label>
          <input type="text" value={form.title} onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Назва новини"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1C3A2E]/20" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Slug (URL) *</label>
          <input type="text" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })}
            placeholder="nazva-novyny"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1C3A2E]/20" />
          <p className="text-xs text-gray-400 mt-1">/news/{form.slug || "slug"}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Категорія</label>
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1C3A2E]/20">
            <option value="NEWS">Новини</option>
            <option value="ANNOUNCEMENT">Оголошення</option>
            <option value="ARTICLE">Стаття</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Короткий опис</label>
          <textarea value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
            placeholder="Короткий опис для превью..." rows={2}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1C3A2E]/20" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Текст новини *</label>
          <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })}
            placeholder="Повний текст новини..." rows={10}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1C3A2E]/20" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">URL зображення</label>
          <input type="text" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
            placeholder="https://..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1C3A2E]/20" />
        </div>

        <div className="flex items-center gap-3">
          <input type="checkbox" id="published" checked={form.published}
            onChange={(e) => setForm({ ...form, published: e.target.checked })}
            className="w-4 h-4 accent-[#1C3A2E]" />
          <label htmlFor="published" className="text-sm font-medium text-gray-700">Опублікувати одразу</label>
        </div>

        <button onClick={handleSubmit} disabled={saving}
          className="w-full bg-[#1C3A2E] text-white font-medium py-3 rounded-xl hover:bg-[#1C3A2E]/80 transition-colors disabled:opacity-50">
          {saving ? "Збереження..." : "Створити новину"}
        </button>
      </div>
    </div>
  );
}