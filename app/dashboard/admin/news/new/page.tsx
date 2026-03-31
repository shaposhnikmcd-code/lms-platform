"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import NewsEditor from "../_components/editor/NewsEditor";
import { NewsMeta } from "../_components/editor/types";

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