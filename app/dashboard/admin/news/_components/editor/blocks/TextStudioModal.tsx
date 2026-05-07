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
import SectionedTextToolbar from "./TextToolbar";
import { ff, Section, SectionLabel, ToggleBtn } from "./_settingsPrimitives";
import { NEWS_BLOCK_CSS } from "@/lib/news/render";
import type { BlockAlign, BlockVAlign } from "../types";

type HeadingLevel = "1" | "2" | "3";

// SVG-гліфи для VAlign — дзеркало BlockItemHeader VALIGN_GLYPHS, без зайвої залежності.
const VALIGN_GLYPHS: Record<BlockVAlign, React.ReactElement> = {
  top: (
    <svg width="10" height="14" viewBox="0 0 10 14" fill="none">
      <rect x="0" y="0" width="10" height="1.6" rx="0.8" fill="currentColor" />
      <rect x="2" y="2.6" width="6" height="1.6" rx="0.8" fill="currentColor" />
    </svg>
  ),
  center: (
    <svg width="10" height="14" viewBox="0 0 10 14" fill="none">
      <rect x="0" y="5.2" width="10" height="1.6" rx="0.8" fill="currentColor" />
      <rect x="2" y="7.8" width="6" height="1.6" rx="0.8" fill="currentColor" />
    </svg>
  ),
  bottom: (
    <svg width="10" height="14" viewBox="0 0 10 14" fill="none">
      <rect x="2" y="10.4" width="6" height="1.6" rx="0.8" fill="currentColor" />
      <rect x="0" y="13" width="10" height="1.6" rx="0.8" fill="currentColor" />
    </svg>
  ),
};

interface Props {
  initialHtml: string;
  onCancel: () => void;
  onSave: (html: string) => void;
  /** Назва модалки (за замовчуванням "Редактор тексту"). Реюзаємо для Цитати/Заголовка. */
  title?: string;
  /** Іконка у top-bar (за замовчуванням "¶"). */
  icon?: string;
  /** Тип блока для CSS-cascade — щоб NEWS_BLOCK_CSS показав текст у редакторі
   *  у тих самих розмірах як public. "text" | "heading" | "quote". */
  blockType?: "text" | "heading" | "quote";
  /** Heading-only: поточний рівень H1/H2/H3. Якщо передано, у sidebar з'являється секція "Рівень". */
  headingLevel?: HeadingLevel;
  onHeadingLevelChange?: (level: HeadingLevel) => void;
  /** Heading-only: поточний vAlign. Якщо передано, у sidebar з'являється секція "Вертикаль". */
  vAlign?: BlockVAlign;
  onVAlignChange?: (v: BlockVAlign) => void;
  /** Точна ШИРИНА "паперу" в px — повна ширина блока (включно з 16px padding-ом
   *  по горизонталі). Текст переноситься 1-в-1 як у блоці на канвасі. */
  paperWidthPx?: number;
  /** Точна ВИСОТА "паперу" в px — block.height. Якщо не передано — auto. */
  paperHeightPx?: number;
  /** Background-колір паперу = block.bgColor (амбер/зелений тощо). Якщо порожній —
   *  білий, як було. Текст автоматично стає світлим на темних фонах. */
  paperBgColor?: string;
  /** vAlign блока (top/center/bottom) — впливає на вертикальне позиціонування тексту
   *  всередині паперу. За замовчуванням top. */
  paperVAlign?: BlockVAlign;
  /** Горизонтальне вирівнювання тексту (block.align — left/center/right). */
  paperAlign?: BlockAlign;
}

// Fullscreen-редактор для блоків Текст / Заголовок / Цитата. Аналог
// ImageStudioModal — sidebar-toolbar зліва, велика робоча область справа.
// Save → onSave(html), Cancel/Esc → onCancel.
export default function TextStudioModal({
  initialHtml, onCancel, onSave,
  title = "Редактор тексту",
  icon = "¶",
  blockType = "text",
  headingLevel,
  onHeadingLevelChange,
  vAlign,
  onVAlignChange,
  paperWidthPx,
  paperHeightPx,
  paperBgColor,
  paperVAlign,
  paperAlign,
}: Props) {
  const [mounted, setMounted] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      Placeholder.configure({ placeholder: "Введіть текст..." }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      Highlight.configure({ multicolor: true }),
      Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true }),
    ],
    content: initialHtml || "",
  });

  useEffect(() => { setMounted(true); }, []);

  // Заблокувати скрол body+html поки модалка відкрита.
  useEffect(() => {
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, []);

  // Esc → cancel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  if (!mounted) return null;

  const handleSave = () => {
    if (!editor) return;
    onSave(editor.getHTML());
  };

  const node = (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(15, 30, 25, 0.65)",
      backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px",
      fontFamily: ff,
    }}>
      <div style={{
        background: "#FAF6F0",
        borderRadius: "16px",
        boxShadow: "0 24px 80px rgba(0,0,0,0.4)",
        width: "100%", maxWidth: "1280px",
        height: "100%", maxHeight: "900px",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Top bar */}
        <div style={{
          display: "flex", alignItems: "center", gap: "12px",
          padding: "14px 20px",
          background: "#1C3A2E",
          color: "#FAF6F0",
          flexShrink: 0,
        }}>
          <div style={{
            width: "30px", height: "30px", borderRadius: "8px",
            background: "#D4A843", color: "#1C3A2E",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontSize: "14px", fontWeight: 800, flexShrink: 0,
          }}>{icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "14px", fontWeight: 700, lineHeight: 1.1 }}>{title}</div>
            <div style={{ fontSize: "11px", color: "rgba(250,246,240,0.6)", marginTop: "2px" }}>
              Esc — скасувати
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: "8px 16px", borderRadius: "8px",
              border: "1px solid rgba(250,246,240,0.2)",
              background: "transparent", color: "#FAF6F0",
              fontSize: "13px", fontWeight: 600,
              cursor: "pointer", fontFamily: ff,
            }}
          >Скасувати</button>
          <button
            type="button"
            onClick={handleSave}
            style={{
              padding: "8px 20px", borderRadius: "8px",
              border: "1px solid #D4A843",
              background: "#D4A843", color: "#1C3A2E",
              fontSize: "13px", fontWeight: 700,
              cursor: "pointer", fontFamily: ff,
              boxShadow: "0 2px 8px rgba(212,168,67,0.3)",
            }}
          >✓ Зберегти</button>
        </div>

        {/* Body: toolbar | editor */}
        <div style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>
          {/* Toolbar rail. М'який off-white фон щоб відділити від білого
              "паперу" редактора, без різкого контрасту. Дише ліворуч-праворуч
              через padding в Section/GroupHeader, не тут. */}
          <div style={{
            width: "260px",
            minWidth: "260px",
            background: "#FCFAF5",
            borderRight: "1px solid #EEEAE2",
            overflowY: "auto",
            paddingBottom: "16px",
          }}>
            {blockType === "heading" && headingLevel && onHeadingLevelChange && (
              <Section>
                <SectionLabel>Рівень</SectionLabel>
                <div style={{ display: "flex", gap: "5px" }}>
                  {(["1", "2", "3"] as const).map(l => (
                    <ToggleBtn
                      key={l}
                      flex
                      active={headingLevel === l}
                      onClick={() => onHeadingLevelChange(l)}
                      title={`Заголовок ${l}-го рівня`}
                    >
                      <span style={{ fontWeight: 700 }}>{`H${l}`}</span>
                    </ToggleBtn>
                  ))}
                </div>
              </Section>
            )}
            {blockType === "heading" && vAlign && onVAlignChange && (
              <Section padTop={0}>
                <SectionLabel>Вертикаль</SectionLabel>
                <div style={{ display: "flex", gap: "5px" }}>
                  {(["top", "center", "bottom"] as BlockVAlign[]).map(v => (
                    <ToggleBtn
                      key={v}
                      flex
                      active={vAlign === v}
                      onClick={() => onVAlignChange(v)}
                      title={v === "top" ? "По верхньому краю" : v === "bottom" ? "По нижньому краю" : "По центру (вертикально)"}
                    >
                      {VALIGN_GLYPHS[v]}
                    </ToggleBtn>
                  ))}
                </div>
              </Section>
            )}
            {editor && <SectionedTextToolbar editor={editor} />}
          </div>

          {/* Editor area. Папір — точна копія блока на канвасі білдера:
              ширина (paperWidthPx) включає 16px padding по горизонталі,
              висота = block.height (paperHeightPx), фон = block.bgColor.
              Wrapping тексту, font-size, vAlign — 1-в-1 як у білдері. */}
          {(() => {
            const hasFixedSize = !!(paperWidthPx && paperWidthPx > 60);
            const paperFixedClass = hasFixedSize ? "studio-paper-fixed" : "";
            const bg = paperBgColor || "#FFFFFF";
            // Текст на темних фонах має бути світлим (= як у BlockItem).
            const isDarkBg = bg === "#1C3A2E" || bg === "#1a1a1a" || bg === "#000000";
            const textColor = isDarkBg ? "#FAF6F0" : "#1C3A2E";
            const flexAlign: "flex-start" | "center" | "flex-end" =
              paperVAlign === "center" ? "center"
                : paperVAlign === "bottom" ? "flex-end"
                : "flex-start";
            return (
              <div style={{
                flex: 1, minWidth: 0,
                background: "#F5EFE6",
                padding: "32px",
                overflowY: "auto",
                display: "flex", justifyContent: "center",
                // safe center — центрує по вертикалі, але якщо папір вищий за
                // preview-зону, fall-back на flex-start (інакше верх клипається).
                alignItems: "safe center",
              }}>
                <div style={{
                  width: hasFixedSize ? `${paperWidthPx}px` : "100%",
                  maxWidth: hasFixedSize ? `${paperWidthPx}px` : "720px",
                  // min-height: точна висота блока. Якщо менеджер набирає більше тексту
                  // ніж вміщається — папір росте вниз (видно що блок треба зробити вищим).
                  minHeight: hasFixedSize && paperHeightPx && paperHeightPx > 0
                    ? `${paperHeightPx}px`
                    : (hasFixedSize ? undefined : "100%"),
                  background: bg,
                  color: textColor,
                  borderRadius: "8px",
                  // Padding 0 16px — точна копія BlockItem inner. Контентна область
                  // = paperWidthPx − 32 (так само як у білдері).
                  padding: hasFixedSize ? "0 16px" : "40px 44px",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
                  boxSizing: "border-box",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: flexAlign,
                }}>
                  <div className={paperFixedClass} data-news-block-type={blockType} {...(blockType === "heading" ? { "data-level": "2" } : {})} style={{ width: "100%", textAlign: paperAlign || "left" }}>
                    <EditorContent editor={editor} />
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Модалка — портал у document.body, тому стилі з NewsEditor можуть не
          застосуватись (залежить від dom-position). Дублюємо CSS тут — гарантує
          що шрифти/italic/ul-bullets працюють у редакторі модалки. */}
      <style>{NEWS_BLOCK_CSS + `
        [data-news-block-type] .ProseMirror{outline:none;min-height:200px;color:inherit}
        [data-news-block-type] .ProseMirror p.is-editor-empty:first-child::before{
          color:#9CA3AF;content:attr(data-placeholder);float:left;height:0;pointer-events:none;font-style:normal
        }
        /* Fixed-size paper (точна копія блока): ProseMirror НЕ має власної
           min-height — папір сам тримає висоту блока через minHeight на wrapper-і.
           Інакше 200px ProseMirror розтягує папір понад block.height і vAlign
           ламається. */
        .studio-paper-fixed.ProseMirror, .studio-paper-fixed .ProseMirror{ min-height:0 }
        /* Heading у fixed-paper має 0 margin зверху/знизу (інакше H2 cascading
           margin зсуває текст від верху, ламаючи vAlign). */
        .studio-paper-fixed h1, .studio-paper-fixed h2, .studio-paper-fixed h3,
        .studio-paper-fixed p { margin: 0 }
      `}</style>
    </div>
  );

  return createPortal(node, document.body);
}
