"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { emptyRow, parseRows } from "../../_components/constants";
import EditorLayout from "../../_components/EditorLayout";
import { useEditorState, EditorMeta } from "../../_hooks/useEditorState";

interface Meta extends EditorMeta {
  published: boolean;
}

export default function EditNewsPage() {
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id as string;

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [meta, setMeta] = useState<Meta>({ title: "", slug: "", excerpt: "", category: "NEWS", published: false });

  const editor = useEditorState([]);

  useEffect(() => {
    if (!id) return;
    fetch("/api/admin/news/" + id)
      .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(d => {
        setMeta({ title: d.title || "", slug: d.slug || "", excerpt: d.excerpt || "", category: d.category || "NEWS", published: d.published || false });
        const parsed = parseRows(d.content || "");
        editor.setRows(parsed && parsed.length > 0 ? parsed : [emptyRow("text")]);
        setLoading(false);
      })
      .catch(e => { setError("Помилка завантаження: " + e.message); setLoading(false); });
  }, [id]);

  const uploadFile = async (file: File): Promise<string> => {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    setUploading(false);
    if (res.ok) { const { url } = await res.json(); return url; }
    setMessage("Помилка завантаження фото");
    return "";
  };

  const handleSave = async (published: boolean) => {
    if (!meta.title || !meta.slug) { setMessage("Заповніть заголовок"); return; }
    setSaving(true);
    const imageUrl = editor.rows.flatMap(r => r.blocks).find(b => b.type === "image")?.data?.url || "";
    const res = await fetch("/api/admin/news/" + id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...meta, published, content: JSON.stringify(editor.rows), imageUrl }),
    });
    if (res.ok) { router.push("/dashboard/admin/news"); }
    else { setMessage("Помилка збереження"); setSaving(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-[#1C3A2E] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="p-6">
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700">{error}</div>
    </div>
  );

  return (
    <EditorLayout
      title={"Редагування новини"}
      meta={meta}
      rows={editor.rows}
      selectedId={editor.selectedId}
      picker={editor.picker}
      saving={saving}
      uploading={uploading}
      message={message}
      isEdit={true}
      onMetaChange={m => setMeta(m as Meta)}
      onSelectBlock={editor.setSelectedId}
      onSetPicker={editor.setPicker}
      onRemoveBlock={editor.removeBlock}
      onRemoveRow={editor.removeRow}
      onMoveRow={editor.moveRow}
      onAddBlockToRow={editor.addBlockToRow}
      onAddRowAfter={editor.addRowAfter}
      onResizeBlock={(blockId, w, h) => editor.updateBlockSettings(blockId, { width: w, height: h })}
      onUpdateBlock={editor.updateBlock}
      onUpdateBlockSettings={editor.updateBlockSettings}
      onUpload={uploadFile}
      onAddRow={editor.addRow}
      onSave={handleSave}
    />
  );
}