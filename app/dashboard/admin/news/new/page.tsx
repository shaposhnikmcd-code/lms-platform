"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { emptyRow } from "../_components/constants";
import EditorLayout from "../_components/EditorLayout";
import { useEditorState, EditorMeta } from "../_hooks/useEditorState";

export default function NewNewsPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [meta, setMeta] = useState<EditorMeta>({ title: "", slug: "", excerpt: "", category: "NEWS" });

  const editor = useEditorState([emptyRow("hero")]);

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
    const res = await fetch("/api/admin/news", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...meta, published, content: JSON.stringify(editor.rows), imageUrl }),
    });
    if (res.ok) { router.push("/dashboard/admin/news"); }
    else { setMessage("Помилка збереження"); setSaving(false); }
  };

  return (
    <EditorLayout
      title={"Нова новина"}
      meta={meta}
      rows={editor.rows}
      selectedId={editor.selectedId}
      picker={editor.picker}
      saving={saving}
      uploading={uploading}
      message={message}
      isEdit={false}
      onMetaChange={setMeta}
      onSelectBlock={editor.setSelectedId}
      onSetPicker={editor.setPicker}
      onRemoveBlock={editor.removeBlock}
      onRemoveRow={editor.removeRow}
      onMoveRow={editor.moveRow}
      onAddBlockToRow={editor.addBlockToRow}
      onAddRowAfter={editor.addRowAfter}
      onResizeBlock={(id, w, h) => editor.updateBlockSettings(id, { width: w, height: h })}
      onUpdateBlock={editor.updateBlock}
      onUpdateBlockSettings={editor.updateBlockSettings}
      onUpload={uploadFile}
      onAddRow={editor.addRow}
      onSave={handleSave}
    />
  );
}