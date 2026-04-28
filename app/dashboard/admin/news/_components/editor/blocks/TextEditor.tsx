"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle, FontSize } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import FontFamily from "@tiptap/extension-font-family";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Block } from "../types";
import {
  ff,
  Section,
  SectionLabel,
} from "./_settingsPrimitives";
import TextStudioModal from "./TextStudioModal";

// Інлайн-редактор Текст: тільки набір тексту в канвасі без панелі форматування.
// Повноцінний редактор (B/I/U, шрифти, кольори, посилання) — у TextStudioModal,
// що відкривається кнопкою з sidebar-а. Аналог патерну ImageStudioModal.

interface Props {
  block: Block;
  onChange: (data: Record<string, string>) => void;
  /** Чи блок selected — кнопка "Відкрити редактор" портал-иться у
   *  #news-block-settings-slot тільки коли selected. */
  selected?: boolean;
}

export default function TextEditor({ block, onChange, selected = false }: Props) {
  const [studioOpen, setStudioOpen] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      Placeholder.configure({ placeholder: "Введіть текст..." }),
      // TextAlign, кольори, лінки тощо — підключені теж: інлайн-набір зберігає
      // вже наявне форматування (з модалки) під час редагування звичайного тексту.
      // Кнопок керування інлайн немає — вони лише в TextStudioModal.
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      Highlight.configure({ multicolor: true }),
      Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true }),
    ],
    content: block.data.html || "",
    onUpdate: ({ editor }) => onChange({ html: editor.getHTML() }),
  });

  // Sync content коли block.data.html змінюється ззовні — наприклад, після
  // збереження з TextStudioModal. Без цього інлайн залишився б зі старим HTML.
  useEffect(() => {
    if (!editor) return;
    const external = block.data.html || "";
    if (editor.getHTML() === external) return;
    editor.commands.setContent(external, { emitUpdate: false });
  }, [block.data.html, editor]);

  if (!editor) return null;

  const settingsSlot = typeof document !== "undefined" && selected
    ? document.getElementById("news-block-settings-slot")
    : null;

  const sidebarPanel = (
    <div style={{ background: "#FFFFFF", fontFamily: ff }}>
      <Section>
        <SectionLabel>Редактор тексту</SectionLabel>
        <button
          type="button"
          onClick={() => setStudioOpen(true)}
          style={{
            width: "100%", height: "34px",
            borderRadius: "6px",
            border: "1px solid #D4A843",
            background: "#1C3A2E",
            color: "#D4A843",
            fontSize: "12px",
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: ff,
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px",
            letterSpacing: "0.04em",
          }}
        >✎ Відкрити на весь екран</button>
        <div style={{ fontSize: "10px", color: "#9CA3AF", lineHeight: 1.5, marginTop: "6px" }}>
          Шрифти, кольори, списки, посилання — у повноекранному редакторі.
        </div>
      </Section>
    </div>
  );

  return (
    <>
      {settingsSlot && createPortal(sidebarPanel, settingsSlot)}
      <EditorContent editor={editor} />
      {studioOpen && (
        <TextStudioModal
          initialHtml={block.data.html || ""}
          onCancel={() => setStudioOpen(false)}
          onSave={(html) => {
            onChange({ ...block.data, html });
            setStudioOpen(false);
          }}
        />
      )}
      <style>{`
        .ProseMirror{outline:none;min-height:80px;font-size:15px;line-height:1.7;color:#1C3A2E;font-family:${ff}}
        .ProseMirror p{margin:0.4em 0}
        .ProseMirror h2{font-size:1.35em;font-weight:700;margin:0.6em 0 0.3em}
        .ProseMirror h3{font-size:1.15em;font-weight:700;margin:0.6em 0 0.3em}
        .ProseMirror ul{list-style:disc;padding-left:1.5em}
        .ProseMirror ol{list-style:decimal;padding-left:1.5em}
        .ProseMirror a{color:#0EA5E9;text-decoration:underline;cursor:pointer}
        .ProseMirror mark{padding:0 2px;border-radius:2px}
        .ProseMirror p.is-editor-empty:first-child::before{
          color:#9CA3AF;content:attr(data-placeholder);float:left;height:0;pointer-events:none
        }
      `}</style>
    </>
  );
}
