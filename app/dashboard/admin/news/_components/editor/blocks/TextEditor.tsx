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
import SectionedTextToolbar from "./TextToolbar";

// Інлайн-редактор Текст: тільки набір тексту в канвасі без панелі форматування.
// Повноцінний редактор (B/I/U, шрифти, кольори, посилання) — у TextStudioModal,
// що відкривається кнопкою з sidebar-а. Аналог патерну ImageStudioModal.

interface Props {
  block: Block;
  onChange: (data: Record<string, string>) => void;
  /** Чи блок selected — кнопка "Відкрити редактор" портал-иться у
   *  #news-block-settings-slot тільки коли selected. */
  selected?: boolean;
  /** Px-ширина канвасу білдера (passed з BlockItem). Потрібна щоб обчислити
   *  paperWidthPx для TextStudioModal — фуллскрін рендерить блок у тих же
   *  розмірах, що в білдері. */
  containerWidthPx?: number;
}

export default function TextEditor({ block, onChange, selected = false, containerWidthPx = 0 }: Props) {
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
      {/* Інлайн toolbar (шрифт+розмір, стилі, списки, кольори, highlight) —
          командить TipTap-редактор напряму. Той самий функціонал, що в
          overlay-блоці «Текст на фото». */}
      <SectionedTextToolbar editor={editor} />

      <Section padTop={6}>
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
          Розширений режим — для довгих текстів, посилань і fine-tuning.
        </div>
      </Section>
    </div>
  );

  // Click-to-edit у "мертвій зоні" блока: див. HeadingEditor для пояснення.
  const focusEditor = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest(".ProseMirror, input, textarea, button, [contenteditable=\"true\"]")) return;
    editor.commands.focus("end");
  };

  return (
    <>
      {settingsSlot && createPortal(sidebarPanel, settingsSlot)}
      {/* data-news-block-type — щоб NEWS_BLOCK_CSS (lib/news/render.tsx) застосувавася
          до ProseMirror всередині. Тоді builder і public показують текст ідентично.
          height:100% + cursor:text — щоб клік у будь-яку зону блока вів у редактор
          (а не тригерив cursor:grab AbsoluteBlock-у). */}
      <div
        data-news-block-type="text"
        onClick={focusEditor}
        style={{ width: "100%", height: "100%", cursor: "text" }}
      >
        <EditorContent editor={editor} />
      </div>
      {studioOpen && (
        <TextStudioModal
          initialHtml={block.data.html || ""}
          onCancel={() => setStudioOpen(false)}
          onSave={(html) => {
            onChange({ ...block.data, html });
            setStudioOpen(false);
          }}
          paperWidthPx={
            containerWidthPx > 0
              ? Math.max(60, ((Number(block.width) || 100) * containerWidthPx) / 100)
              : undefined
          }
          paperHeightPx={block.height}
          paperBgColor={block.bgColor || ""}
          paperVAlign={block.vAlign}
          paperAlign={block.align}
        />
      )}
      <style>{`
        [data-news-block-type="text"] .ProseMirror{outline:none;min-height:80px;color:#1C3A2E}
        [data-news-block-type="text"] .ProseMirror p.is-editor-empty:first-child::before{
          color:#9CA3AF;content:attr(data-placeholder);float:left;height:0;pointer-events:none
        }
      `}</style>
    </>
  );
}
