"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { FaTrash } from "react-icons/fa";
import BundleForm, { AvailableCourse, BundleFormInitial } from "../_components/BundleForm";

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
        <div className="mb-4 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {message}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200/70 p-6">
        {initial && (
          <BundleForm
            mode="edit"
            initial={initial}
            availableCourses={availableCourses}
            coursesLoading={coursesLoading}
            onSubmit={handleSubmit}
            saving={saving}
          />
        )}
      </div>
    </div>
  );
}
