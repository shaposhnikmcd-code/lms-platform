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
import { BackgroundFill } from "./backgroundFillMark";
import { FontWeight } from "./fontWeightExtension";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Block, BlockVAlign } from "../types";
import { ff } from "./_settingsPrimitives";
import SectionedTextToolbar from "./TextToolbar";

// Інлайн-редактор Заголовок: TipTap для базового набору без панелі форматування.
// Повноцінне форматування (шрифт/розмір/кольори/B/I/U) — у TextStudioModal.
// data.html зберігає plain-rich text, data.level — H1/H2/H3 тег для public render.
//
// Backward compat: старі заголовки в data.text → конвертуються в HTML на init.

interface Props {
  block: Block;
  onChange: (data: Record<string, string>) => void;
  selected?: boolean;
  /** Сетер vAlign на рівні блока. Передається з BlockItem (там же, що в BlockItemHeader). */
  onSetVAlign?: (v: BlockVAlign) => void;
  /** Px-ширина канвасу — для paperWidthPx у TextStudioModal (1-в-1 з канвасом). */
  containerWidthPx?: number;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function headingInitialHtml(data: Record<string, string>): string {
  if (data.html) return data.html;
  const t = data.text || "";
  return t ? `<p>${escapeHtml(t)}</p>` : "";
}

export default function HeadingEditor({ block, onChange, selected = false, onSetVAlign, containerWidthPx = 0 }: Props) {
  void containerWidthPx;
  const level = (block.data.level || "2") as "1" | "2" | "3";

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
      BackgroundFill,
      FontWeight,
      // Link mark — без нього editor.setLink() з toolbar-у silently no-op-ить:
      // ProseMirror-схема не знає про link mark і парс HTML викидає <a> теги.
      Link.configure({ openOnClick: false, autolink: false, linkOnPaste: true }),
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
      {/* Інлайн toolbar з тим самим функціоналом, що в overlay-блоці «Текст на фото»
          (шрифт+розмір, стилі, списки, кольори, highlight). Командить TipTap-редактор
          напряму — заголовок одразу оновлюється на канвасі.
          Секція H1/H2/H3 прибрана: рівень тегу не змінює візуального вигляду
          в білдері (через однакові стилі), і користувачу не потрібен. Доступний
          у TextStudioModal якщо знадобиться. */}
      <SectionedTextToolbar
        editor={editor}
        vAlign={block.vAlign || "top"}
        onSetVAlign={onSetVAlign}
      />
    </div>
  );

  // Click-to-edit у "мертвій зоні" блока: коли користувач клікає в порожню
  // частину поза .ProseMirror (актуально для коротких заголовків у малих блоках),
  // фокусуємо редактор у кінець тексту. Без цього cursor:grab AbsoluteBlock-у
  // створює враження що блок можна тільки тягати.
  const focusEditor = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest(".ProseMirror, input, textarea, button, [contenteditable=\"true\"]")) return;
    editor.commands.focus("end");
  };

  // vAlign → justify-content: top/center/bottom. Реплейс попередньої окремої
  // flex-обгортки для center/bottom — тепер ОДИН wrapper для всіх трьох,
  // що дає однорідну зону кліку (`height: 100%`).
  const justify =
    block.vAlign === "center" ? "center" :
    block.vAlign === "bottom" ? "flex-end" : "flex-start";

  // WYSIWYG-колір: дзеркало логіки render.tsx (heading-case). data.color override
  // перебиває auto-контраст; auto = світлий на тёмному bg, темний на світлому.
  const customColor = block.data.color || "";
  const autoColor =
    block.bgColor === "#1C3A2E" || block.bgColor === "#1a1a1a" ? "#FAF6F0" : "#1C3A2E";
  const effectiveColor = customColor || autoColor;

  return (
    <>
      {settingsSlot && createPortal(sidebarPanel, settingsSlot)}
      <div
        data-news-block-type="heading"
        data-level={level}
        onClick={focusEditor}
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: justify,
          cursor: "text",
          color: effectiveColor,
        }}
      >
        <EditorContent editor={editor} />
      </div>
      <style>{`
        /* color: inherit — щоб inline-style на wrapper-і (з data.color або
           auto-контрасту) розповсюджувався на ProseMirror. Раніше hardcoded
           #1C3A2E ламав WYSIWYG: на public був custom color, а в білдері — стандартний. */
        /* Inter Variable за замовчуванням — забезпечує плавний font-weight 100..900
           через font-variation-settings. Якщо користувач явно обрав інший шрифт,
           setMark("textStyle", { fontFamily }) ставить inline style з вищим
           пріоритетом і перекриває цей default. */
        [data-news-block-type="heading"] .ProseMirror{outline:none;color:inherit;font-weight:700;font-family:var(--font-inter), Inter, system-ui, sans-serif}
        /* Лінки в заголовку: текст без підкреслення/синього. Маркер — стрілка ↗
           після слова (external-link icon). !important потрібен щоб перебити UA
           :link стиль. */
        [data-news-block-type="heading"] .ProseMirror a,
        [data-news-block-type="heading"] .ProseMirror a:link,
        [data-news-block-type="heading"] .ProseMirror a:visited{
          text-decoration:none !important;
          color:inherit !important;
          cursor:pointer;
        }
        /* External-link SVG icon через mask-image — успадковує currentColor
           (контраст з будь-яким фоном), чіткий на будь-якому розмірі. */
        /* External-link icon на ОСТАННЬОМУ <span> у <a> (там TipTap TextStyle
           ставить inline color), fallback на <a> якщо span-а нема. currentColor
           береться з реального видимого кольору тексту. */
        [data-news-block-type="heading"] .ProseMirror a:not(:has(span))::after,
        [data-news-block-type="heading"] .ProseMirror a > span:last-child::after{
          content:"";
          display:inline-block;
          width:0.55em;
          height:0.55em;
          margin-left:0.28em;
          vertical-align:0.18em;
          background-color:currentColor;
          -webkit-mask:url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6'/%3E%3Cpath d='M15 3h6v6'/%3E%3Cpath d='M10 14 21 3'/%3E%3C/svg%3E") no-repeat center / contain;
          mask:url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6'/%3E%3Cpath d='M15 3h6v6'/%3E%3Cpath d='M10 14 21 3'/%3E%3C/svg%3E") no-repeat center / contain;
          opacity:0.6;
          transition:transform 0.15s, opacity 0.15s;
        }
        [data-news-block-type="heading"] .ProseMirror a:hover:not(:has(span))::after,
        [data-news-block-type="heading"] .ProseMirror a:hover > span:last-child::after{
          opacity:0.95;
          transform:translate(1px,-1px);
        }
        /* Виділення тримаємо як 28% від кольору тексту: на темному фоні з білим
           текстом — світла плашка, на світлому з темним — темна. Працює без
           логіки в JS, просто через currentColor. */
        [data-news-block-type="heading"] .ProseMirror ::selection,
        [data-news-block-type="heading"] .ProseMirror::selection{background:color-mix(in srgb, currentColor 28%, transparent);color:inherit}
        [data-news-block-type="heading"] .ProseMirror p{margin:0}
        [data-news-block-type="heading"] .ProseMirror p.is-editor-empty:first-child::before{
          color:#9CA3AF;content:attr(data-placeholder);float:left;height:0;pointer-events:none;font-weight:400
        }
      `}</style>
    </>
  );
}
