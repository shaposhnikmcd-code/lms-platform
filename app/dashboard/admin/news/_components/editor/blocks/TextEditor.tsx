"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { useState } from "react";
import { Block } from "../types";

const ff = "-apple-system, BlinkMacSystemFont, sans-serif";

function TBtn({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ padding: "3px 8px", borderRadius: "5px", border: "none", cursor: "pointer", fontSize: "11px", fontWeight: 700, fontFamily: ff, background: active ? "#1C3A2E" : hov ? "#E8F5E0" : "#EEEAE2", color: active ? "#D4A843" : "#1C3A2E", transition: "all 0.12s", minWidth: "24px" }}
    >{children}</button>
  );
}

interface Props {
  block: Block;
  onChange: (data: Record<string, string>) => void;
}

export default function TextEditor({ block, onChange }: Props) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      Placeholder.configure({ placeholder: "Введіть текст..." }),
    ],
    content: block.data.html || "",
    onUpdate: ({ editor }) => onChange({ html: editor.getHTML() }),
  });

  if (!editor) return null;

  return (
    <>
      <div style={{ display: "flex", gap: "3px", marginBottom: "10px", flexWrap: "wrap", padding: "6px 8px", background: "rgba(0,0,0,0.03)", borderRadius: "7px" }}>
        <TBtn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>{"B"}</TBtn>
        <TBtn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>{"I"}</TBtn>
        <TBtn active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>{"U"}</TBtn>
        <TBtn active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>{"S"}</TBtn>
        <div style={{ width: "1px", background: "#E8D5B7", margin: "0 3px" }} />
        <TBtn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>{"•"}</TBtn>
        <TBtn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>{"1."}</TBtn>
      </div>
      <EditorContent editor={editor} />
      <style>{`.ProseMirror{outline:none;min-height:80px;font-size:15px;line-height:1.7;color:#1C3A2E;font-family:${ff}}.ProseMirror p{margin:0.4em 0}.ProseMirror ul{list-style:disc;padding-left:1.5em}.ProseMirror ol{list-style:decimal;padding-left:1.5em}`}</style>
    </>
  );
}