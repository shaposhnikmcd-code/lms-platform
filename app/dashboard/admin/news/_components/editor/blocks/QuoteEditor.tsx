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
import { ff, Section, SectionLabel } from "./_settingsPrimitives";
import TextStudioModal from "./TextStudioModal";

// Інлайн-редактор Цитата: TipTap для базового набору без панелі форматування.
// Повноцінне форматування — у TextStudioModal (реюз з блока Текст з власною
// title/icon). Поведінка дзеркальна до TextEditor.
//
// Backward compat: старі цитати зберігали plain-text у data.text. Новий формат —
// rich HTML у data.html. Якщо data.html пусте, використовуємо data.text як
// initial content. На render.tsx (public) data.html має пріоритет.

interface Props {
  block: Block;
  onChange: (data: Record<string, string>) => void;
  selected?: boolean;
}

function quoteInitialHtml(data: Record<string, string>): string {
  if (data.html) return data.html;
  // Plain text → одиничний параграф (TipTap прийме як стартовий контент)
  const t = data.text || "";
  return t ? `<p>${escapeHtml(t)}</p>` : "";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export default function QuoteEditor({ block, onChange, selected = false }: Props) {
  const [studioOpen, setStudioOpen] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      Placeholder.configure({ placeholder: "Текст цитати..." }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      Highlight.configure({ multicolor: true }),
      Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true }),
    ],
    content: quoteInitialHtml(block.data),
    onUpdate: ({ editor }) => {
      // Зберігаємо в data.html. data.text лишається для legacy-сумісності,
      // але джерело правди — html.
      onChange({ ...block.data, html: editor.getHTML() });
    },
  });

  // Sync content коли block.data.html змінюється ззовні (після Save в модалці).
  useEffect(() => {
    if (!editor) return;
    const external = quoteInitialHtml(block.data);
    if (editor.getHTML() === external) return;
    editor.commands.setContent(external, { emitUpdate: false });
  }, [block.data, editor]);

  if (!editor) return null;

  const settingsSlot = typeof document !== "undefined" && selected
    ? document.getElementById("news-block-settings-slot")
    : null;

  const sidebarPanel = (
    <div style={{ background: "#FFFFFF", fontFamily: ff }}>
      <Section>
        <SectionLabel>Редактор цитати</SectionLabel>
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
          Шрифти, кольори, посилання — у повноекранному редакторі.
        </div>
      </Section>
    </div>
  );

  return (
    <>
      {settingsSlot && createPortal(sidebarPanel, settingsSlot)}
      <div
        data-news-block-type="quote"
        style={{
          borderLeftWidth: "4px", borderLeftStyle: "solid", borderLeftColor: "#D4A843",
          borderRadius: "0 8px 8px 0", padding: "12px 16px", background: "#E8F5E0",
          height: "100%", boxSizing: "border-box",
        }}
      >
        <EditorContent editor={editor} />
      </div>
      {studioOpen && (
        <TextStudioModal
          title="Редактор цитати"
          icon="❝"
          blockType="quote"
          initialHtml={quoteInitialHtml(block.data)}
          onCancel={() => setStudioOpen(false)}
          onSave={(html) => {
            onChange({ ...block.data, html });
            setStudioOpen(false);
          }}
        />
      )}
      <style>{`
        [data-news-block-type="quote"] .ProseMirror{outline:none;min-height:60px;color:#1C3A2E}
        [data-news-block-type="quote"] .ProseMirror p.is-editor-empty:first-child::before{
          color:#9CA3AF;content:attr(data-placeholder);float:left;height:0;pointer-events:none;font-style:normal
        }
      `}</style>
    </>
  );
}
