"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewCoursePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    slug: "",
    imageUrl: "",
    published: false,
  });

  const handleTitleChange = (title: string) => {
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
    setForm({ ...form, title, slug });
  };

  const handleSubmit = async () => {
    if (!form.title || !form.description || !form.price) {
      setMessage("❌ Заповніть всі обов'язкові поля");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/admin/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        price: parseInt(form.price),
      }),
    });
    if (res.ok) {
      const data = await res.json();
      router.push(`/dashboard/admin/courses/${data.id}`);
    } else {
      setMessage("❌ Помилка збереження");
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/dashboard/admin/courses"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#1C3A2E] mb-4 transition-colors"
      >
        ← Назад до курсів
      </Link>

      <h1 className="text-2xl font-bold text-[#1C3A2E] mb-8">Новий курс</h1>

      {message && (
        <div className="mb-4 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
          {message}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Назва курсу <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Основи психології"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1C3A2E]/20"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Slug (URL) <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            placeholder="psychology-basics"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1C3A2E]/20"
          />
          <p className="text-xs text-gray-400 mt-1">
            URL курсу: /courses/{form.slug || "slug"}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Опис <span className="text-red-400">*</span>
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Короткий опис курсу..."
            rows={4}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1C3A2E]/20"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Ціна (UAH) <span className="text-red-400">*</span>
          </label>
          <input
            type="number"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            placeholder="3500"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1C3A2E]/20"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            URL зображення
          </label>
          <input
            type="text"
            value={form.imageUrl}
            onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
            placeholder="https://..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1C3A2E]/20"
          />
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="published"
            checked={form.published}
            onChange={(e) => setForm({ ...form, published: e.target.checked })}
            className="w-4 h-4 accent-[#1C3A2E]"
          />
          <label htmlFor="published" className="text-sm font-medium text-gray-700">
            Опублікувати одразу
          </label>
        </div>

        <button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full bg-[#1C3A2E] text-white font-medium py-3 rounded-xl hover:bg-[#1C3A2E]/80 transition-colors disabled:opacity-50"
        >
          {saving ? "Збереження..." : "Створити курс"}
        </button>
      </div>
    </div>
  );
}