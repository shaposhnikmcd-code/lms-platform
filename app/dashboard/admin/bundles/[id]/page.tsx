"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { FaTrash } from "react-icons/fa";
import BundleForm, {
  AvailableCourse,
  BundleFormInitial,
  BundleTypeRail,
  BundleType,
} from "../_components/BundleForm";

interface BundleCourseRaw {
  id: string;
  courseSlug: string;
  isFree: boolean;
}

export default function EditBundlePage() {
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [initial, setInitial] = useState<Partial<BundleFormInitial> | null>(null);
  const [availableCourses, setAvailableCourses] = useState<AvailableCourse[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [type, setType] = useState<BundleType>("DISCOUNT");

  useEffect(() => {
    fetch(`/api/admin/bundles/${id}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Помилка завантаження");
        setInitial({
          title: data.title || "",
          slug: data.slug || "",
          price: String(data.price || ""),
          published: data.published || false,
          type: data.type || "DISCOUNT",
          paidCount: data.paidCount ?? 2,
          freeCount: data.freeCount ?? 0,
          courses: (data.courses ?? []).map((c: BundleCourseRaw) => ({
            courseSlug: c.courseSlug,
            isFree: !!c.isFree,
          })),
        });
        setType((data.type as BundleType) || "DISCOUNT");
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
      } finally {
        setCoursesLoading(false);
      }
    })();
  }, []);

  const handleSubmit = async (payload: Parameters<Parameters<typeof BundleForm>[0]["onSubmit"]>[0]) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/bundles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        window.location.assign("/dashboard/admin/bundles");
        return;
      }
      const data = await res.json();
      throw new Error(data.error || "Помилка збереження");
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
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-48" />
          <div className="h-64 bg-slate-100 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-7xl px-6 py-10">
        {message && (
          <div className="mb-4 px-4 py-2 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">
            {message}
          </div>
        )}

        <div className="flex items-start gap-8">
          <aside className="w-56 flex-shrink-0 pt-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-600 mb-1.5">
              Пакети курсів
            </p>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight leading-tight">
              Редагувати пакет
            </h1>
          </aside>

          <div className="flex-1 min-w-0 relative">
            <div id="bundle-toast-slot" className="fixed top-36 right-5 z-30" />

            <button
              onClick={handleDelete}
              aria-label="Видалити пакет"
              className="group absolute top-0 right-0 z-20 inline-flex items-center gap-1.5 h-9 pl-3 pr-3.5 bg-white ring-1 ring-slate-200/70 text-slate-400 hover:text-white hover:bg-gradient-to-br hover:from-rose-500 hover:to-rose-600 hover:ring-rose-500 hover:shadow-[0_6px_16px_rgba(244,63,94,0.28)] rounded-tr-2xl rounded-bl-xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all"
            >
              <FaTrash className="text-[11px] transition-transform group-hover:scale-110" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">Видалити</span>
            </button>

            <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-200/70">
              <BundleTypeRail type={type} onChange={setType} />
              <div className="p-7 sm:p-8 bg-gradient-to-b from-white to-slate-50/60 rounded-b-2xl md:rounded-b-none md:rounded-r-2xl">
                {initial && (
                  <BundleForm
                    mode="edit"
                    initial={initial}
                    availableCourses={availableCourses}
                    coursesLoading={coursesLoading}
                    type={type}
                    onTypeChange={setType}
                    onSubmit={handleSubmit}
                    saving={saving}
                    draftKey={`bundle-draft:edit:${id}`}
                  />
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
