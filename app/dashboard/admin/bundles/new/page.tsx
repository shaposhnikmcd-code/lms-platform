"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const AVAILABLE_COURSES = [
  { slug: 'psychology-basics', title: 'Основи психології', price: 3500 },
  { slug: 'psychiatry-basics', title: 'Основи психіатрії', price: 3500 },
  { slug: 'mentorship', title: 'Основи душеопікунства', price: 3500 },
  { slug: 'psychotherapy-of-biblical-heroes', title: 'Психотерапія біблійних героїв', price: 1400 },
  { slug: 'sex-education', title: 'Статеве виховання', price: 4300 },
  { slug: 'military-psychology', title: 'Військова психологія', price: 5999 },
  { slug: 'emotional-intelligence', title: 'Емоційний інтелект', price: 1499 },
];

export default function NewBundlePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    slug: "",
    price: "",
    published: false,
  });
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);

  const handleTitleChange = (title: string) => {
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9а-яіїєґ\s-]/gi, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
    setForm({ ...form, title, slug });
  };

  const toggleCourse = (slug: string) => {
    setSelectedCourses((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const totalOriginalPrice = selectedCourses.reduce((sum, slug) => {
    const course = AVAILABLE_COURSES.find((c) => c.slug === slug);
    return sum + (course?.price || 0);
  }, 0);

  const handleSubmit = async () => {
    if (!form.title || !form.price || selectedCourses.length < 2) {
      setMessage("Заповніть назву, ціну і оберіть мінімум 2 курси");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/bundles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          price: parseInt(form.price),
          courseSlugs: selectedCourses,
        }),
      });
      if (res.ok) {
        router.push("/dashboard/admin/bundles");
      } else {
        const data = await res.json();
        setMessage(data.error || "Помилка збереження");
        setSaving(false);
      }
    } catch {
      setMessage("Помилка збереження");
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-800 mb-8">Новий пакет курсів</h1>

      {message && (
        <div className="mb-4 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {message}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200/70 p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Назва пакету <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Психологія + Психіатрія"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Slug (URL)
          </label>
          <input
            type="text"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            placeholder="psychology-psychiatry-bundle"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Опис
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Опис пакету..."
            rows={3}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-3">
            Курси в пакеті <span className="text-red-400">*</span>
            <span className="text-xs text-slate-400 ml-2">(мінімум 2)</span>
          </label>
          <div className="space-y-2">
            {AVAILABLE_COURSES.map((course) => {
              const isSelected = selectedCourses.includes(course.slug);
              return (
                <label
                  key={course.slug}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    isSelected
                      ? "border-violet-300 bg-violet-50"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleCourse(course.slug)}
                    className="w-4 h-4 accent-violet-600"
                  />
                  <span className="text-sm font-medium text-slate-700 flex-1">
                    {course.title}
                  </span>
                  <span className="text-sm text-slate-500 tabular-nums">
                    {course.price.toLocaleString()} ₴
                  </span>
                </label>
              );
            })}
          </div>
          {selectedCourses.length >= 2 && (
            <div className="mt-3 p-3 bg-slate-50 rounded-lg text-sm text-slate-600">
              Сума окремо: <span className="font-semibold">{totalOriginalPrice.toLocaleString()} ₴</span>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Ціна пакету (UAH) <span className="text-red-400">*</span>
          </label>
          <input
            type="number"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            placeholder="5500"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
          />
          {form.price && totalOriginalPrice > 0 && parseInt(form.price) < totalOriginalPrice && (
            <p className="text-xs text-emerald-600 mt-1">
              Знижка: {Math.round((1 - parseInt(form.price) / totalOriginalPrice) * 100)}% (економія {(totalOriginalPrice - parseInt(form.price)).toLocaleString()} ₴)
            </p>
          )}
        </div>

        <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200 bg-slate-50/50">
          <div>
            <p className="text-sm font-medium text-slate-700">Показувати на сайті</p>
            <p className="text-xs text-slate-400 mt-0.5">Пакет буде видимий для покупців на сторінці курсів</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={form.published}
            onClick={() => setForm({ ...form, published: !form.published })}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
              form.published ? "bg-violet-600" : "bg-slate-300"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform mt-0.5 ${
                form.published ? "translate-x-5 ml-0.5" : "translate-x-0 ml-0.5"
              }`}
            />
          </button>
        </div>

        <button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full bg-violet-600 text-white font-medium py-3 rounded-xl hover:bg-violet-700 transition-colors disabled:opacity-50"
        >
          {saving ? "Збереження..." : "Створити пакет"}
        </button>
      </div>
    </div>
  );
}
