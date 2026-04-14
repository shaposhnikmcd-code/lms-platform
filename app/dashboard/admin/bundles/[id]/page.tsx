"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { FaTrash, FaPause, FaPlay } from "react-icons/fa";

interface AvailableCourse {
  slug: string;
  title: string;
  price: number;
}

interface BundleCourse {
  id: string;
  courseSlug: string;
}

export default function EditBundlePage() {
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    title: "",
    slug: "",
    price: "",
    published: false,
  });
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [availableCourses, setAvailableCourses] = useState<AvailableCourse[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [suspendedAt, setSuspendedAt] = useState<string | null>(null);
  const [resumeAt, setResumeAt] = useState<string | null>(null);
  const [resumeDate, setResumeDate] = useState("");
  const [discount, setDiscount] = useState(0);
  const [rounding, setRounding] = useState(false);
  const [showDiscountPicker, setShowDiscountPicker] = useState(false);
  const [suspendLoading, setSuspendLoading] = useState(false);
  const discountRef = useRef<HTMLDivElement>(null);
  const discountBtnRef = useRef<HTMLButtonElement>(null);
  const [discountAbove, setDiscountAbove] = useState(false);

  const closeDiscountPicker = useCallback(() => setShowDiscountPicker(false), []);

  useEffect(() => {
    if (!showDiscountPicker) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDiscountPicker();
    };
    const handleClick = (e: MouseEvent) => {
      if (
        discountRef.current && !discountRef.current.contains(e.target as Node) &&
        discountBtnRef.current && !discountBtnRef.current.contains(e.target as Node)
      ) {
        closeDiscountPicker();
      }
    };

    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [showDiscountPicker, closeDiscountPicker]);

  useEffect(() => {
    fetch(`/api/admin/bundles/${id}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Помилка завантаження");
        setForm({
          title: data.title || "",
          slug: data.slug || "",
          price: String(data.price || ""),
          published: data.published || false,
        });
        setSelectedCourses(data.courses?.map((c: BundleCourse) => c.courseSlug) || []);
        setSuspendedAt(data.suspendedAt || null);
        setResumeAt(data.resumeAt || null);
        setLoading(false);
      })
      .catch((err) => {
        setMessage(err.message || "Помилка завантаження");
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/courses");
        if (!res.ok) throw new Error("Не вдалося завантажити курси");
        const data = await res.json();
        const list: AvailableCourse[] = (Array.isArray(data) ? data : [])
          .filter((c: { slug: string | null }) => !!c.slug)
          .map((c: { slug: string; title: string; price: number }) => ({
            slug: c.slug,
            title: c.title,
            price: c.price,
          }));
        setAvailableCourses(list);
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Помилка завантаження курсів");
      } finally {
        setCoursesLoading(false);
      }
    })();
  }, []);

  const toggleCourse = (slug: string) => {
    setSelectedCourses((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const totalOriginalPrice = selectedCourses.reduce((sum, slug) => {
    const course = availableCourses.find((c) => c.slug === slug);
    return sum + (course?.price || 0);
  }, 0);

  const handleSave = async () => {
    if (!form.title || !form.price || selectedCourses.length < 2) {
      setMessage("Заповніть назву, ціну і оберіть мінімум 2 курси");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/bundles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          price: parseInt(form.price),
          courseSlugs: selectedCourses,
        }),
      });
      if (res.ok) {
        window.location.assign("/dashboard/admin/bundles");
        return;
      }
      const data = await res.json();
      setMessage(data.error || "Помилка збереження");
    } catch {
      setMessage("Помилка збереження");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Видалити цей пакет?")) return;
    try {
      await fetch(`/api/admin/bundles/${id}`, { method: "DELETE" });
      window.location.assign("/dashboard/admin/bundles");
    } catch {
      setMessage("Помилка видалення");
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-48" />
          <div className="h-64 bg-slate-100 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Редагувати пакет</h1>
        <button
          onClick={handleDelete}
          className="inline-flex items-center gap-2 px-3 py-2 bg-red-50 text-red-600 text-sm font-medium rounded-lg hover:bg-red-100 transition-colors"
        >
          <FaTrash className="text-xs" /> Видалити
        </button>
      </div>

      {message && (
        <div className={`mb-4 px-4 py-2 rounded-lg text-sm ${
          message === "Збережено"
            ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
            : "bg-red-50 border border-red-200 text-red-700"
        }`}>
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
            maxLength={60}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
          />
          <p className={`text-xs font-semibold mt-1 text-right tabular-nums ${
            form.title.length >= 60 ? 'text-rose-600' : form.title.length >= 50 ? 'text-amber-600' : 'text-slate-600'
          }`}>{form.title.length}/60</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Slug (URL)</label>
          <input
            type="text"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-3">
            Курси в пакеті <span className="text-red-400">*</span>
          </label>
          <div className="space-y-2">
            {coursesLoading ? (
              <p className="text-sm text-slate-400">Завантаження курсів…</p>
            ) : availableCourses.length === 0 ? (
              <p className="text-sm text-slate-400">Курси в БД відсутні. Спочатку створи курс.</p>
            ) : (
              availableCourses.map((course) => {
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
              })
            )}
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
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={form.price}
              onChange={(e) => { setForm({ ...form, price: e.target.value }); setDiscount(0); }}
              className="w-32 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
            <div className="relative w-28">
              <button
                ref={discountBtnRef}
                type="button"
                onClick={() => {
                  if (!showDiscountPicker && discountBtnRef.current) {
                    const rect = discountBtnRef.current.getBoundingClientRect();
                    const spaceBelow = window.innerHeight - rect.bottom;
                    setDiscountAbove(spaceBelow < 320);
                  }
                  setShowDiscountPicker(!showDiscountPicker);
                }}
                className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm bg-white text-left focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              >
                {discount > 0 ? `−${discount}%` : 'Знижка %'}
              </button>
              {showDiscountPicker && (
                <div
                  ref={discountRef}
                  className={`absolute left-0 bg-white border border-slate-200 rounded-xl shadow-lg z-50 flex ${
                    discountAbove ? 'bottom-full mb-1' : 'top-full mt-1'
                  }`}
                  style={{ width: 125 }}
                >
                  <div className="flex-1 py-1">
                    {[5, 10, 15, 20, 25, 30, 35, 40, 45, 50].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => {
                          setDiscount(pct);
                          let calculated = Math.round(totalOriginalPrice * (1 - pct / 100));
                          if (rounding) calculated = Math.round(calculated / 100) * 100;
                          setForm({ ...form, price: String(calculated) });
                          setShowDiscountPicker(false);
                        }}
                        className={`w-full text-left px-3 py-1 text-sm hover:bg-violet-50 transition-colors ${
                          discount === pct ? 'bg-violet-50 text-violet-700 font-medium' : 'text-slate-700'
                        }`}
                      >
                        −{pct}%
                      </button>
                    ))}
                  </div>
                  <div className="w-10 border-l border-slate-100 flex flex-col items-center justify-center py-3">
                    <input
                      type="range"
                      min={1}
                      max={60}
                      value={discount || 0}
                      onChange={(e) => {
                        const pct = parseInt(e.target.value);
                        setDiscount(pct);
                        if (totalOriginalPrice > 0) {
                          let calculated = Math.round(totalOriginalPrice * (1 - pct / 100));
                          if (rounding) calculated = Math.round(calculated / 100) * 100;
                          setForm({ ...form, price: String(calculated) });
                        }
                      }}
                      className="h-[200px] accent-violet-600 cursor-pointer"
                      style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
                    />
                    <span className="text-[10px] text-slate-500 mt-1 tabular-nums">{discount || 0}%</span>
                  </div>
                </div>
              )}
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <button
                type="button"
                role="switch"
                aria-checked={rounding}
                onClick={() => {
                  const next = !rounding;
                  setRounding(next);
                  if (next && form.price) {
                    setForm({ ...form, price: String(Math.round(parseInt(form.price) / 100) * 100) });
                  }
                }}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
                  rounding ? "bg-violet-600" : "bg-slate-300"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition-transform mt-0.5 ${
                    rounding ? "translate-x-4 ml-0.5" : "translate-x-0 ml-0.5"
                  }`}
                />
              </button>
              <span className="text-xs text-slate-500 whitespace-nowrap">Округлення</span>
            </label>
          </div>
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
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-violet-600 text-white font-medium py-3 rounded-xl hover:bg-violet-700 transition-colors disabled:opacity-50"
        >
          {saving ? "Збереження..." : "Зберегти зміни"}
        </button>
      </div>
    </div>
  );
}
