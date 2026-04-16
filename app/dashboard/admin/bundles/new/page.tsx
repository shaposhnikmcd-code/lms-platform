"use client";

import { useState, useEffect } from "react";
import BundleForm, {
  AvailableCourse,
  BundleTypeRail,
  BundleType,
} from "../_components/BundleForm";

export default function NewBundlePage() {
  const [saving, setSaving] = useState(false);
  const [availableCourses, setAvailableCourses] = useState<AvailableCourse[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [type, setType] = useState<BundleType>("DISCOUNT");

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
      const res = await fetch("/api/admin/bundles", {
        method: "POST",
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

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="relative mb-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-600 mb-1.5">
            Пакети курсів
          </p>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Новий пакет</h1>
          <p className="text-sm text-slate-500 mt-1.5">Створіть комбінацію курсів зі знижкою або бонусом</p>
        </div>

        <div id="bundle-toast-slot" className="fixed top-36 right-5 z-30" />

        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-200/70">
          <BundleTypeRail type={type} onChange={setType} />
          <div className="p-7 sm:p-8 bg-gradient-to-b from-white to-slate-50/60 rounded-b-2xl md:rounded-b-none md:rounded-r-2xl">
            <BundleForm
              mode="create"
              availableCourses={availableCourses}
              coursesLoading={coursesLoading}
              type={type}
              onTypeChange={setType}
              onSubmit={handleSubmit}
              saving={saving}
              draftKey="bundle-draft:new"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
