"use client";

import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle, FontSize } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import FontFamily from "@tiptap/extension-font-family";
import { useEffect, useRef, useState } from "react";
import { Block } from "../types";

const ff = "-apple-system, BlinkMacSystemFont, sans-serif";

const TEXT_COLORS = [
  "#1C3A2E", "#000000", "#475569", "#94A3B8",
  "#DC2626", "#EA580C", "#D97706", "#CA8A04",
  "#65A30D", "#16A34A", "#0EA5E9", "#2563EB",
  "#7C3AED", "#C026D3", "#DB2777", "#E11D48",
];

const HIGHLIGHT_COLORS = [
  "#FEF3C7", "#FED7AA", "#FECACA", "#FBCFE8",
  "#E9D5FF", "#C7D2FE", "#BFDBFE", "#A5F3FC",
  "#A7F3D0", "#D9F99D", "#FDE68A", "transparent",
];

const FONT_FAMILIES = [
  { label: "За замовчуванням", value: "" },
  { label: "Sans-serif", value: "sans-serif" },
  { label: "Serif", value: "serif" },
  { label: "Mono", value: "monospace" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times", value: '"Times New Roman", serif' },
  { label: "Arial", value: "Arial, sans-serif" },
];

const FONT_SIZES = ["12px", "13px", "14px", "15px", "16px", "18px", "20px", "24px", "28px", "32px", "36px"];

function TBtn({
  active, onClick, children, title,
}: { active?: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      type="button"
      title={title}
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: "4px 8px", borderRadius: "5px", border: "none", cursor: "pointer",
        fontSize: "11px", fontWeight: 700, fontFamily: ff,
        background: active ? "#1C3A2E" : hov ? "#E8F5E0" : "#EEEAE2",
        color: active ? "#D4A843" : "#1C3A2E",
        transition: "all 0.12s", minWidth: "26px", height: "26px",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
      }}
    >{children}</button>
  );
}

function Sep() {
  return <div style={{ width: "1px", background: "#E8D5B7", margin: "0 3px", alignSelf: "stretch" }} />;
}

function ColorSwatchPicker({
  open, swatches, current, onPick, onClose,
}: {
  open: boolean;
  swatches: string[];
  current?: string | null;
  onPick: (c: string | null) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      ref={ref}
      style={{
        position: "absolute", top: "100%", left: 0, marginTop: "4px",
        background: "#fff", borderRadius: "8px",
        boxShadow: "0 4px 16px rgba(28,58,46,0.18)",
        padding: "8px", zIndex: 50, display: "grid",
        gridTemplateColumns: "repeat(8, 18px)", gap: "4px",
      }}
    >
      {swatches.map(c => (
        <button
          key={c}
          type="button"
          onMouseDown={e => { e.preventDefault(); onPick(c === "transparent" ? null : c); onClose(); }}
          title={c}
          style={{
            width: "18px", height: "18px", borderRadius: "4px",
            background: c === "transparent" ? "transparent" : c,
            border: c === current ? "2px solid #1C3A2E" : "1px solid #E8D5B7",
            cursor: "pointer", padding: 0,
            position: "relative",
          }}
        >
          {c === "transparent" && (
            <span style={{
              position: "absolute", inset: 0, display: "flex",
              alignItems: "center", justifyContent: "center",
              fontSize: "10px", color: "#64748B",
            }}>×</span>
          )}
        </button>
      ))}
    </div>
  );
}

function StyleSelect({ editor }: { editor: Editor }) {
  const value = editor.isActive("heading", { level: 1 }) ? "h1"
    : editor.isActive("heading", { level: 2 }) ? "h2"
    : editor.isActive("heading", { level: 3 }) ? "h3"
    : "p";
  return (
    <select
      value={value}
      onChange={e => {
        const v = e.target.value;
        if (v === "p") editor.chain().focus().setParagraph().run();
        else editor.chain().focus().toggleHeading({ level: Number(v.slice(1)) as 1 | 2 | 3 }).run();
      }}
      style={selectStyle}
    >
      <option value="p">Параграф</option>
      <option value="h1">Заголовок 1</option>
      <option value="h2">Заголовок 2</option>
      <option value="h3">Заголовок 3</option>
    </select>
  );
}

const selectStyle: React.CSSProperties = {
  height: "26px", padding: "0 6px", borderRadius: "5px",
  border: "1px solid #E8D5B7", background: "#fff",
  fontSize: "11px", fontFamily: ff, color: "#1C3A2E",
  cursor: "pointer", outline: "none",
};

interface Props {
  block: Block;
  onChange: (data: Record<string, string>) => void;
}

export default function TextEditor({ block, onChange }: Props) {
  const [colorOpen, setColorOpen] = useState(false);
  const [hlOpen, setHlOpen] = useState(false);

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
    content: block.data.html || "",
    onUpdate: ({ editor }) => onChange({ html: editor.getHTML() }),
  });

  if (!editor) return null;

  const askLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL посилання:", prev || "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const currentColor = (editor.getAttributes("textStyle").color as string | undefined) || null;
  const currentHl = (editor.getAttributes("highlight").color as string | undefined) || null;
  const currentSize = (editor.getAttributes("textStyle").fontSize as string | undefined) || "";
  const currentFont = (editor.getAttributes("textStyle").fontFamily as string | undefined) || "";

  return (
    <>
      <div style={{
        display: "flex", gap: "3px", marginBottom: "10px", flexWrap: "wrap",
        padding: "6px 8px", background: "rgba(0,0,0,0.03)", borderRadius: "7px",
        alignItems: "center",
      }}>
        <StyleSelect editor={editor} />

        <Sep />

        <TBtn title="Жирний (Ctrl+B)" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>B</TBtn>
        <TBtn title="Курсив (Ctrl+I)" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><span style={{ fontStyle: "italic" }}>I</span></TBtn>
        <TBtn title="Підкреслений (Ctrl+U)" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}><span style={{ textDecoration: "underline" }}>U</span></TBtn>
        <TBtn title="Закреслений" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}><span style={{ textDecoration: "line-through" }}>S</span></TBtn>

        <Sep />

        <TBtn title="Маркований список" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>•</TBtn>
        <TBtn title="Нумерований список" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1.</TBtn>

        <Sep />

        <TBtn title="Вліво" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}>⯇</TBtn>
        <TBtn title="По центру" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}>≡</TBtn>
        <TBtn title="Вправо" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}>⯈</TBtn>
        <TBtn title="По ширині" active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()}>☰</TBtn>

        <Sep />

        <select
          value={currentFont}
          onChange={e => {
            const v = e.target.value;
            if (!v) editor.chain().focus().unsetFontFamily().run();
            else editor.chain().focus().setFontFamily(v).run();
          }}
          style={{ ...selectStyle, minWidth: "120px" }}
          title="Шрифт"
        >
          {FONT_FAMILIES.map(f => (<option key={f.value} value={f.value}>{f.label}</option>))}
        </select>

        <select
          value={currentSize}
          onChange={e => {
            const v = e.target.value;
            if (!v) editor.chain().focus().unsetFontSize().run();
            else editor.chain().focus().setFontSize(v).run();
          }}
          style={{ ...selectStyle, minWidth: "70px" }}
          title="Розмір шрифту"
        >
          <option value="">Розмір</option>
          {FONT_SIZES.map(s => (<option key={s} value={s}>{s.replace("px", "")}</option>))}
        </select>

        <Sep />

        <div style={{ position: "relative" }}>
          <TBtn title="Колір тексту" active={!!currentColor} onClick={() => { setHlOpen(false); setColorOpen(o => !o); }}>
            <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: "1px", lineHeight: 1 }}>
              <span style={{ fontSize: "11px" }}>A</span>
              <span style={{ width: "14px", height: "3px", background: currentColor || "#1C3A2E", borderRadius: "1px" }} />
            </span>
          </TBtn>
          <ColorSwatchPicker
            open={colorOpen}
            swatches={TEXT_COLORS}
            current={currentColor}
            onPick={c => {
              if (c === null) editor.chain().focus().unsetColor().run();
              else editor.chain().focus().setColor(c).run();
            }}
            onClose={() => setColorOpen(false)}
          />
        </div>

        <div style={{ position: "relative" }}>
          <TBtn title="Колір фону тексту" active={!!currentHl} onClick={() => { setColorOpen(false); setHlOpen(o => !o); }}>
            <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: "1px", lineHeight: 1 }}>
              <span style={{ fontSize: "11px" }}>🖍</span>
              <span style={{ width: "14px", height: "3px", background: currentHl || "#FEF3C7", borderRadius: "1px" }} />
            </span>
          </TBtn>
          <ColorSwatchPicker
            open={hlOpen}
            swatches={HIGHLIGHT_COLORS}
            current={currentHl}
            onPick={c => {
              if (c === null) editor.chain().focus().unsetHighlight().run();
              else editor.chain().focus().toggleHighlight({ color: c }).run();
            }}
            onClose={() => setHlOpen(false)}
          />
        </div>

        <Sep />

        <TBtn title="Посилання" active={editor.isActive("link")} onClick={askLink}>🔗</TBtn>
        <TBtn title="Очистити форматування" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>⌫</TBtn>
      </div>

      <EditorContent editor={editor} />
      <style>{`
        .ProseMirror{outline:none;min-height:80px;font-size:15px;line-height:1.7;color:#1C3A2E;font-family:${ff}}
        .ProseMirror p{margin:0.4em 0}
        .ProseMirror h1{font-size:1.7em;font-weight:700;margin:0.6em 0 0.3em}
        .ProseMirror h2{font-size:1.35em;font-weight:700;margin:0.6em 0 0.3em}
        .ProseMirror h3{font-size:1.15em;font-weight:700;margin:0.6em 0 0.3em}
        .ProseMirror ul{list-style:disc;padding-left:1.5em}
        .ProseMirror ol{list-style:decimal;padding-left:1.5em}
        .ProseMirror a{color:#0EA5E9;text-decoration:underline;cursor:pointer}
        .ProseMirror mark{padding:0 2px;border-radius:2px}
      `}</style>
    </>
  );
}
