"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useParams } from "next/navigation";
import { NewsMeta } from "../../_components/editor/types";

// Lazy-load Tiptap editor (~200KB) — skeleton while chunk loads.
const NewsEditor = dynamic(() => import("../../_components/editor/NewsEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-[#D4A843] border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

export default function EditNewsPage() {
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [initialMeta, setInitialMeta] = useState<Partial<NewsMeta>>({});
  const [initialContent, setInitialContent] = useState("");

  useEffect(() => {
    if (!id) return;
    fetch("/api/admin/news/" + id)
      .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(d => {
        setInitialMeta({
          title: d.title || "",
          slug: d.slug || "",
          excerpt: d.excerpt || "",
          category: d.category || "NEWS",
          imageUrl: d.imageUrl || "",
          published: d.published || false,
        });
        setInitialContent(d.content || "");
        setLoading(false);
      })
      .catch(e => { setError("Помилка завантаження: " + e.message); setLoading(false); });
  }, [id]);

  const handleSave = async (meta: NewsMeta, content: string, imageUrl: string) => {
    setSaving(true);
    const res = await fetch("/api/admin/news/" + id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...meta, content, imageUrl }),
    });
    if (res.ok) { router.push("/dashboard/admin/news"); }
    else { setSaving(false); }
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "256px" }}>
      <div style={{ width: "32px", height: "32px", borderWidth: "4px", borderStyle: "solid", borderColor: "#1C3A2E", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    </div>
  );

  if (error) return (
    <div style={{ padding: "24px" }}>
      <div style={{ background: "#FEF2F2", borderWidth: "1px", borderStyle: "solid", borderColor: "#FECACA", borderRadius: "12px", padding: "24px", color: "#DC2626" }}>{error}</div>
    </div>
  );

  return (
    <NewsEditor
      pageTitle={"Редагування новини"}
      initialMeta={initialMeta}
      initialContent={initialContent}
      newsId={id}
      onSave={handleSave}
      onBack={() => router.push("/dashboard/admin/news")}
      saving={saving}
    />
  );
}