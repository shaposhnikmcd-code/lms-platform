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

// Інлайн-редактор Текст: тільки набір тексту в канвасі без панелі форматування.
// Повноцінний редактор (B/I/U, шрифти, кольори, посилання) — у TextStudioModal,
// що відкривається кнопкою з sidebar-а. Аналог патерну ImageStudioModal.

interface Props {
  block: Block;
  onChange: (data: Record<string, string>) => void;
  /** Чи блок selected — кнопка "Відкрити редактор" портал-иться у
   *  #news-block-settings-slot тільки коли selected. */
  selected?: boolean;
  /** Сетер vAlign на рівні блока — дублює BlockItemHeader, доступний з панелі. */
  onSetVAlign?: (v: BlockVAlign) => void;
  /** Px-ширина канвасу білдера (passed з BlockItem). Потрібна щоб обчислити
   *  paperWidthPx для TextStudioModal — фуллскрін рендерить блок у тих же
   *  розмірах, що в білдері. */
  containerWidthPx?: number;
}

export default function TextEditor({ block, onChange, selected = false, onSetVAlign, containerWidthPx = 0 }: Props) {
  void containerWidthPx;
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
      BackgroundFill,
      FontWeight,
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
      <SectionedTextToolbar
        editor={editor}
        vAlign={block.vAlign || "top"}
        onSetVAlign={onSetVAlign}
      />
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
      <style>{`
        [data-news-block-type="text"] .ProseMirror{outline:none;min-height:80px;color:#1C3A2E;font-family:var(--font-inter), Inter, system-ui, sans-serif}
        /* Виділення = 28% від кольору тексту → адаптується до фону блока і
           кастомних кольорів тексту автоматично. */
        [data-news-block-type="text"] .ProseMirror ::selection,
        [data-news-block-type="text"] .ProseMirror::selection{background:color-mix(in srgb, currentColor 28%, transparent);color:inherit}
        [data-news-block-type="text"] .ProseMirror p.is-editor-empty:first-child::before{
          color:#9CA3AF;content:attr(data-placeholder);float:left;height:0;pointer-events:none
        }
      `}</style>
    </>
  );
}
