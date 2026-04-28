"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle, FontSize } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import FontFamily from "@tiptap/extension-font-family";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Block } from "../types";
import {
  ff,
  Section,
  SectionLabel,
  ToggleBtn,
} from "./_settingsPrimitives";
import TextStudioModal from "./TextStudioModal";

// Інлайн-редактор Заголовок: TipTap для базового набору без панелі форматування.
// Повноцінне форматування (шрифт/розмір/кольори/B/I/U) — у TextStudioModal.
// data.html зберігає plain-rich text, data.level — H1/H2/H3 тег для public render.
//
// Backward compat: старі заголовки в data.text → конвертуються в HTML на init.

interface Props {
  block: Block;
  onChange: (data: Record<string, string>) => void;
  selected?: boolean;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function headingInitialHtml(data: Record<string, string>): string {
  if (data.html) return data.html;
  const t = data.text || "";
  return t ? `<p>${escapeHtml(t)}</p>` : "";
}

export default function HeadingEditor({ block, onChange, selected = false }: Props) {
  const [studioOpen, setStudioOpen] = useState(false);
  const level = block.data.level || "2";

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      Placeholder.configure({ placeholder: `Заголовок ${level}-го рівня...` }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      Highlight.configure({ multicolor: true }),
    ],
    content: headingInitialHtml(block.data),
    onUpdate: ({ editor }) => {
      onChange({ ...block.data, html: editor.getHTML() });
    },
  });

  useEffect(() => {
    if (!editor) return;
    const external = headingInitialHtml(block.data);
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
        <SectionLabel>Рівень</SectionLabel>
        <div style={{ display: "flex", gap: "5px" }}>
          {(["1", "2", "3"] as const).map(l => (
            <ToggleBtn
              key={l}
              flex
              active={level === l}
              onClick={() => onChange({ ...block.data, level: l })}
              title={`Заголовок ${l}-го рівня`}
            >
              <span style={{ fontWeight: 700 }}>{`H${l}`}</span>
            </ToggleBtn>
          ))}
        </div>
      </Section>

      <Section padTop={0}>
        <SectionLabel>Редактор заголовка</SectionLabel>
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
          Шрифти, кольори, стилі — у повноекранному редакторі.
        </div>
      </Section>
    </div>
  );

  return (
    <>
      {settingsSlot && createPortal(sidebarPanel, settingsSlot)}
      {/* data-news-block-type + data-level — застосовується NEWS_BLOCK_CSS,
          щоб font-size H1/H2/H3 збігався з public. */}
      <div data-news-block-type="heading" data-level={level} style={{ width: "100%" }}>
        <EditorContent editor={editor} />
      </div>
      {studioOpen && (
        <TextStudioModal
          title="Редактор заголовка"
          icon="H"
          blockType="heading"
          initialHtml={headingInitialHtml(block.data)}
          onCancel={() => setStudioOpen(false)}
          onSave={(html) => {
            onChange({ ...block.data, html });
            setStudioOpen(false);
          }}
        />
      )}
      <style>{`
        [data-news-block-type="heading"] .ProseMirror{outline:none;color:#1C3A2E;font-weight:700}
        [data-news-block-type="heading"] .ProseMirror p{margin:0}
        [data-news-block-type="heading"] .ProseMirror p.is-editor-empty:first-child::before{
          color:#9CA3AF;content:attr(data-placeholder);float:left;height:0;pointer-events:none;font-weight:400
        }
      `}</style>
    </>
  );
}
