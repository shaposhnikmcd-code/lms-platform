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
import { ff } from "./_settingsPrimitives";

interface Props {
  initialHtml: string;
  onCancel: () => void;
  onSave: (html: string) => void;
  /** Назва модалки (за замовчуванням "Редактор тексту"). Реюзаємо для Цитати. */
  title?: string;
  /** Іконка у top-bar (за замовчуванням "¶"). */
  icon?: string;
}

// Fullscreen-редактор для блока Текст (та Цитати). Аналог ImageStudioModal —
// sidebar-toolbar зліва, велика робоча область справа. Save → onSave(html),
// Cancel/Esc → onCancel.
export default function TextStudioModal({
  initialHtml, onCancel, onSave,
  title = "Редактор тексту",
  icon = "¶",
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
            {editor && <SectionedTextToolbar editor={editor} />}
          </div>

          {/* Editor area */}
          <div style={{
            flex: 1, minWidth: 0,
            background: "#F5EFE6",
            padding: "32px",
            overflowY: "auto",
            display: "flex", justifyContent: "center",
          }}>
            <div style={{
              width: "100%", maxWidth: "720px",
              background: "#FFFFFF",
              borderRadius: "12px",
              padding: "40px 44px",
              boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
              minHeight: "100%",
              boxSizing: "border-box",
            }}>
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .ProseMirror{outline:none;min-height:200px;font-size:16px;line-height:1.7;color:#1C3A2E;font-family:${ff}}
        .ProseMirror p{margin:0.6em 0}
        .ProseMirror h2{font-size:1.5em;font-weight:700;margin:0.8em 0 0.4em}
        .ProseMirror h3{font-size:1.25em;font-weight:700;margin:0.7em 0 0.4em}
        .ProseMirror ul{list-style:disc;padding-left:1.5em}
        .ProseMirror ol{list-style:decimal;padding-left:1.5em}
        .ProseMirror a{color:#0EA5E9;text-decoration:underline;cursor:pointer}
        .ProseMirror mark{padding:0 2px;border-radius:2px}
        .ProseMirror p.is-editor-empty:first-child::before{
          color:#9CA3AF;content:attr(data-placeholder);float:left;height:0;pointer-events:none
        }
      `}</style>
    </div>
  );

  return createPortal(node, document.body);
}
