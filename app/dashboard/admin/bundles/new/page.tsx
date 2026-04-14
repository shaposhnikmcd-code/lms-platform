"use client";

import { useState, useEffect } from "react";
import BundleForm, { AvailableCourse } from "../_components/BundleForm";

export default function NewBundlePage() {
  const [saving, setSaving] = useState(false);
  const [availableCourses, setAvailableCourses] = useState<AvailableCourse[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);

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
    <div className="max-w-2xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-800 mb-8">Новий пакет курсів</h1>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200/70 p-6">
        <BundleForm
          mode="create"
          availableCourses={availableCourses}
          coursesLoading={coursesLoading}
          onSubmit={handleSubmit}
          saving={saving}
        />
      </div>
    </div>
  );
}
