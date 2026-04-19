"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { NewsMeta } from "../_components/editor/types";

// NewsEditor тягне Tiptap (~200KB). Ліниво-завантажуємо — щоб сторінка показала skeleton,
// а потім підвантажила редактор. Без SSR, бо Tiptap працює тільки у браузері.
const NewsEditor = dynamic(() => import("../_components/editor/NewsEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-[#D4A843] border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

export default function NewNewsPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const handleSave = async (meta: NewsMeta, content: string, imageUrl: string) => {
    setSaving(true);
    const res = await fetch("/api/admin/news", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...meta, content, imageUrl }),
    });
    if (res.ok) { router.push("/dashboard/admin/news"); }
    else { setSaving(false); }
  };

  return (
    <NewsEditor
      pageTitle={"Нова новина"}
      newsId={undefined}
      onSave={handleSave}
      onBack={() => router.push("/dashboard/admin/news")}
      saving={saving}
    />
  );
}