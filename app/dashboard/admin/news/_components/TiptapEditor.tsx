"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Youtube from "@tiptap/extension-youtube";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useRef, useState } from "react";

const toolbarStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "4px",
  padding: "10px 12px",
  background: "#1C3A2E",
  borderRadius: "10px 10px 0 0",
  borderBottom: "2px solid #D4A843",
};

const editorWrapStyle: React.CSSProperties = {
  minHeight: "420px",
  background: "#FAF6F0",
  borderRadius: "0 0 10px 10px",
  padding: "24px",
  fontSize: "15px",
  lineHeight: "1.7",
  color: "#1C3A2E",
  fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
  outline: "none",
};

const btnBase: React.CSSProperties = {
  padding: "5px 10px",
  borderRadius: "6px",
  border: "none",
  cursor: "pointer",
  fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
  fontSize: "13px",
  fontWeight: 600,
  transition: "background 0.15s",
};

const btnDefault: React.CSSProperties = {
  ...btnBase,
  background: "rgba(255,255,255,0.1)",
  color: "#FAF6F0",
};

const btnActive: React.CSSProperties = {
  ...btnBase,
  background: "#D4A843",
  color: "#1C3A2E",
};

const separatorStyle: React.CSSProperties = {
  width: "1px",
  height: "28px",
  background: "rgba(255,255,255,0.2)",
  margin: "0 4px",
};

interface Props {
  value: string;
  onChange: (html: string) => void;
  onUpload: (file: File) => Promise<string>;
}

export default function TiptapEditor({ value, onChange, onUpload }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      Image.configure({ inline: false, allowBase64: false }),
      Youtube.configure({ width: 640, height: 360, nocookie: true }),
      Placeholder.configure({ placeholder: "Почніть писати новину..." }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        style: Object.entries(editorWrapStyle)
          .map(([k, v]) => `${k.replace(/([A-Z])/g, "-$1").toLowerCase()}:${v}`)
          .join(";"),
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value || "");
    }
  }, [value]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    setUploading(true);
    const url = await onUpload(file);
    setUploading(false);
    if (url) editor.chain().focus().setImage({ src: url }).run();
    e.target.value = "";
  };

  const handleYoutube = () => {
    const url = prompt("Вставте посилання на YouTube відео:");
    if (url && editor) editor.chain().focus().setYoutubeVideo({ src: url }).run();
  };

  if (!editor) return null;

  const btn = (active: boolean) => (active ? btnActive : btnDefault);

  return (
    <div style={{ borderRadius: "10px", boxShadow: "0 2px 12px rgba(28,58,46,0.1)" }}>
      <div style={toolbarStyle}>
        <button style={btn(editor.isActive("bold"))} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}>{"B"}</button>
        <button style={{ ...btn(editor.isActive("italic")), fontStyle: "italic" }} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }}>{"I"}</button>
        <button style={{ ...btn(editor.isActive("underline")), textDecoration: "underline" }} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleUnderline().run(); }}>{"U"}</button>
        <button style={{ ...btn(editor.isActive("strike")), textDecoration: "line-through" }} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleStrike().run(); }}>{"S"}</button>

        <div style={separatorStyle} />

        <button style={btn(editor.isActive("heading", { level: 1 }))} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 1 }).run(); }}>{"H1"}</button>
        <button style={btn(editor.isActive("heading", { level: 2 }))} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 2 }).run(); }}>{"H2"}</button>
        <button style={btn(editor.isActive("heading", { level: 3 }))} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 3 }).run(); }}>{"H3"}</button>

        <div style={separatorStyle} />

        <button style={btn(editor.isActive("bulletList"))} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBulletList().run(); }}>{"• Список"}</button>
        <button style={btn(editor.isActive("orderedList"))} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run(); }}>{"1. Список"}</button>

        <div style={separatorStyle} />

        <button style={btn(editor.isActive("blockquote"))} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBlockquote().run(); }}>{"❝ Цитата"}</button>
        <button style={btnDefault} onMouseDown={e => { e.preventDefault(); editor.chain().focus().setHorizontalRule().run(); }}>{"— Лінія"}</button>

        <div style={separatorStyle} />

        <button
          style={{ ...btnDefault, opacity: uploading ? 0.6 : 1 }}
          onMouseDown={e => { e.preventDefault(); fileInputRef.current?.click(); }}
        >
          {uploading ? "Завантаження..." : "🖼 Фото"}
        </button>
        <button style={btnDefault} onMouseDown={e => { e.preventDefault(); handleYoutube(); }}>{"▶ YouTube"}</button>

        <div style={separatorStyle} />

        <button style={btnDefault} onMouseDown={e => { e.preventDefault(); editor.chain().focus().undo().run(); }}>{"↩ Undo"}</button>
        <button style={btnDefault} onMouseDown={e => { e.preventDefault(); editor.chain().focus().redo().run(); }}>{"↪ Redo"}</button>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageUpload} />

      <EditorContent editor={editor} />

      <style>{`
        .ProseMirror { outline: none; min-height: 420px; }
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          color: #9CA3AF;
          pointer-events: none;
          float: left;
          height: 0;
        }
        .ProseMirror h1 { font-size: 2rem; font-weight: 700; margin: 1.2em 0 0.5em; color: #1C3A2E; }
        .ProseMirror h2 { font-size: 1.5rem; font-weight: 700; margin: 1.1em 0 0.5em; color: #1C3A2E; }
        .ProseMirror h3 { font-size: 1.2rem; font-weight: 600; margin: 1em 0 0.4em; color: #1C3A2E; }
        .ProseMirror p { margin: 0.6em 0; }
        .ProseMirror ul { list-style: disc; padding-left: 1.5em; margin: 0.6em 0; }
        .ProseMirror ol { list-style: decimal; padding-left: 1.5em; margin: 0.6em 0; }
        .ProseMirror blockquote {
          border-left: 4px solid #D4A843;
          margin: 1em 0;
          padding: 0.5em 1em;
          background: #E8F5E0;
          color: #1C3A2E;
          border-radius: 0 6px 6px 0;
        }
        .ProseMirror hr { border: none; border-top: 2px solid #D4A843; margin: 1.5em 0; }
        .ProseMirror img { max-width: 100%; border-radius: 8px; margin: 1em 0; }
        .ProseMirror iframe { border-radius: 8px; margin: 1em 0; max-width: 100%; }
      `}</style>
    </div>
  );
}