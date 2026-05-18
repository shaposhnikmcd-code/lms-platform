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
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Block, BlockVAlign } from "../types";
import { ff } from "./_settingsPrimitives";
import { BackgroundFill } from "./backgroundFillMark";
import { FontWeight } from "./fontWeightExtension";
import SectionedTextToolbar from "./TextToolbar";

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
  onSetVAlign?: (v: BlockVAlign) => void;
  /** Px-ширина канвасу — для paperWidthPx у TextStudioModal (1-в-1 з канвасом). */
  containerWidthPx?: number;
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

export default function QuoteEditor({ block, onChange, selected = false, onSetVAlign, containerWidthPx = 0 }: Props) {
  void containerWidthPx;
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
      BackgroundFill,
      FontWeight,
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
      {/* Інлайн toolbar (шрифт+розмір, стилі, списки, кольори, highlight) —
          командить TipTap-редактор напряму. Той самий функціонал, що в
          overlay-блоці «Текст на фото». */}
      <SectionedTextToolbar
        editor={editor}
        vAlign={block.vAlign || "top"}
        onSetVAlign={onSetVAlign}
      />
    </div>
  );

  return (
    <>
      {settingsSlot && createPortal(sidebarPanel, settingsSlot)}
      <div
        data-news-block-type="quote"
        onClick={(e) => {
          // Click-to-edit у "мертвій зоні": якщо клік не на ProseMirror —
          // фокусуємо редактор. Дзеркало логіки HeadingEditor/TextEditor.
          const t = e.target as HTMLElement;
          if (t.closest(".ProseMirror, input, textarea, button, [contenteditable=\"true\"]")) return;
          editor?.commands.focus("end");
        }}
        style={{
          borderLeftWidth: "4px", borderLeftStyle: "solid", borderLeftColor: "#D4A843",
          padding: "12px 16px", background: "#E8F5E0",
          height: "100%", boxSizing: "border-box", cursor: "text",
        }}
      >
        <EditorContent editor={editor} />
      </div>
      <style>{`
        [data-news-block-type="quote"] .ProseMirror{outline:none;min-height:60px;color:#1C3A2E;font-family:var(--font-inter), Inter, system-ui, sans-serif}
        /* Selection-bg = 28% currentColor — підлаштовується під фон блока і
           колір тексту автоматично (на темному фоні зі світлим текстом — світла
           плашка, на світлому з темним — темна). */
        [data-news-block-type="quote"] .ProseMirror ::selection,
        [data-news-block-type="quote"] .ProseMirror::selection{background:color-mix(in srgb, currentColor 28%, transparent);color:inherit}
        [data-news-block-type="quote"] .ProseMirror p.is-editor-empty:first-child::before{
          color:#9CA3AF;content:attr(data-placeholder);float:left;height:0;pointer-events:none;font-style:normal
        }
      `}</style>
    </>
  );
}
