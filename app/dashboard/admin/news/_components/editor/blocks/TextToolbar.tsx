"use client";

import { useState } from "react";
import { Editor } from "@tiptap/react";
import { OVERLAY_FONTS } from "./ImageEditor";
import {
  ff,
  Section,
  SectionLabel,
  SwatchGrid,
  WORD_TEXT_COLORS,
  WORD_HIGHLIGHT_COLORS,
  ToggleBtn,
  FontSelect,
  inputBase,
} from "./_settingsPrimitives";

const FONT_SIZE_PRESETS = ["12px", "13px", "14px", "15px", "16px", "18px", "20px", "24px", "28px", "32px", "36px"];

// Sectioned toolbar для блоків Текст / Заголовок / Цитата.
// Layout — дзеркало OverlayToolbar (Текст на фото): SectionLabel зверху,
// контроли знизу, всі секції впритул (padTop=0 крім першої).
export default function SectionedTextToolbar({ editor }: { editor: Editor }) {
  const currentColor = (editor.getAttributes("textStyle").color as string | undefined) || "";
  const currentHl = (editor.getAttributes("highlight").color as string | undefined) || "";
  const currentSize = (editor.getAttributes("textStyle").fontSize as string | undefined) || "";
  const currentFont = (editor.getAttributes("textStyle").fontFamily as string | undefined) || "";
  const currentLink = (editor.getAttributes("link").href as string | undefined) || "";
  const [linkInput, setLinkInput] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);

  let effectiveSize: number | null = null;
  if (typeof window !== "undefined" && editor.view?.dom) {
    const cs = window.getComputedStyle(editor.view.dom);
    const px = parseFloat(cs.fontSize);
    if (Number.isFinite(px)) effectiveSize = Math.round(px);
  }

  const hasAnyMark =
    editor.isActive("bold") || editor.isActive("italic") || editor.isActive("underline") ||
    editor.isActive("strike") || editor.isActive("highlight") || !!currentColor || !!currentSize || !!currentFont;

  return (
    <div style={{ fontFamily: ff }}>
      <div style={{ padding: "6px 10px 6px", display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{
          fontSize: "9px", fontWeight: 800, color: "#9B7C45",
          letterSpacing: "0.14em", textTransform: "uppercase",
          fontFamily: ff, whiteSpace: "nowrap", flexShrink: 0,
        }}>Дії</div>
        <div style={{ display: "flex", gap: "5px", flex: 1 }}>
          <ToggleBtn flex active={false} onClick={() => editor.chain().focus().undo().run()} title="Скасувати (Ctrl+Z)">
            <span style={{ fontSize: "13px" }}>↶</span>
          </ToggleBtn>
          <ToggleBtn flex active={false} onClick={() => editor.chain().focus().redo().run()} title="Повторити (Ctrl+Shift+Z)">
            <span style={{ fontSize: "13px" }}>↷</span>
          </ToggleBtn>
          <ToggleBtn flex active={false} onClick={() => editor.chain().focus().unsetAllMarks().run()} title="Очистити форматування (B/I/U/колір/розмір)">
            <span style={{ fontSize: "11px", opacity: hasAnyMark ? 1 : 0.4 }}>✕ T</span>
          </ToggleBtn>
        </div>
      </div>

      <Section padTop={0}>
        <SectionLabel>Шрифт та розмір</SectionLabel>
        <div style={{ display: "flex", gap: "5px" }}>
          <div style={{ flex: 2, minWidth: 0 }}>
            <FontSelect
              value={currentFont}
              onChange={v => {
                if (!v) editor.chain().focus().unsetFontFamily().run();
                else editor.chain().focus().setFontFamily(v).run();
              }}
              options={OVERLAY_FONTS}
            />
          </div>
          <select
            value={currentSize}
            onChange={e => {
              const v = e.target.value;
              if (!v) editor.chain().focus().unsetFontSize().run();
              else editor.chain().focus().setFontSize(v).run();
            }}
            style={{ ...inputBase, padding: "0 6px", cursor: "pointer", flex: 1, minWidth: 0 }}
            title="Розмір шрифту"
          >
            <option value="">{effectiveSize ? `Авто (${effectiveSize})` : "Авто"}</option>
            {FONT_SIZE_PRESETS.map(s => (
              <option key={s} value={s}>{s.replace("px", "")}</option>
            ))}
          </select>
        </div>
      </Section>

      <div style={{ padding: "0 10px 6px", display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{
          fontSize: "9px", fontWeight: 800, color: "#9B7C45",
          letterSpacing: "0.14em", textTransform: "uppercase",
          fontFamily: ff, whiteSpace: "nowrap", flexShrink: 0,
        }}>Стиль</div>
        <div style={{ display: "flex", gap: "5px", flex: 1 }}>
          <ToggleBtn flex active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Жирний (Ctrl+B)">
            <span style={{ fontWeight: 700 }}>B</span>
          </ToggleBtn>
          <ToggleBtn flex active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Курсив (Ctrl+I)">
            <span style={{ fontStyle: "italic", fontWeight: 600 }}>I</span>
          </ToggleBtn>
          <ToggleBtn flex active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Підкреслений (Ctrl+U)">
            <span style={{ textDecoration: "underline", fontWeight: 600 }}>U</span>
          </ToggleBtn>
          <ToggleBtn flex active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} title="Закреслений">
            <span style={{ textDecoration: "line-through", fontWeight: 600 }}>S</span>
          </ToggleBtn>
        </div>
      </div>

      <Section padTop={0}>
        <SectionLabel>Вирівнювання абзацу</SectionLabel>
        <div style={{ display: "flex", gap: "5px" }}>
          <ToggleBtn flex active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} title="По лівому">
            <span style={{ fontSize: "11px" }}>⯇</span>
          </ToggleBtn>
          <ToggleBtn flex active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} title="По центру">
            <span style={{ fontSize: "11px" }}>≡</span>
          </ToggleBtn>
          <ToggleBtn flex active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()} title="По правому">
            <span style={{ fontSize: "11px" }}>⯈</span>
          </ToggleBtn>
          <ToggleBtn flex active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()} title="По ширині">
            <span style={{ fontSize: "11px", letterSpacing: "-1px" }}>≣</span>
          </ToggleBtn>
        </div>
      </Section>

      <Section padTop={0}>
        <SectionLabel>Списки та блоки</SectionLabel>
        <div style={{ display: "flex", gap: "5px" }}>
          <ToggleBtn flex active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Маркований список">
            <span style={{ fontSize: "14px" }}>•</span>
          </ToggleBtn>
          <ToggleBtn flex active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Нумерований список">
            <span style={{ fontSize: "11px" }}>1.</span>
          </ToggleBtn>
          <ToggleBtn flex active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Цитата">
            <span style={{ fontSize: "13px" }}>❝</span>
          </ToggleBtn>
          <ToggleBtn flex active={false} onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Горизонтальна лінія">
            <span style={{ fontSize: "11px", letterSpacing: "-1px" }}>—</span>
          </ToggleBtn>
        </div>
      </Section>

      {/* Колір тексту + Виділення поруч в одному рядку, щоб зекономити висоту. */}
      <Section padTop={0}>
        <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
          <div style={{ flexShrink: 0 }}>
            <SectionLabel>Колір тексту</SectionLabel>
            <SwatchGrid
              current={currentColor}
              palette={WORD_TEXT_COLORS}
              cols={6}
              onChange={c => {
                if (!c) editor.chain().focus().unsetColor().run();
                else editor.chain().focus().setColor(c).run();
              }}
            />
          </div>
          <div style={{ flexShrink: 0 }}>
            <SectionLabel>Виділення</SectionLabel>
            <SwatchGrid
              current={currentHl}
              palette={WORD_HIGHLIGHT_COLORS}
              cols={2}
              onChange={c => {
                if (!c) editor.chain().focus().unsetHighlight().run();
                else editor.chain().focus().setHighlight({ color: c }).run();
              }}
            />
          </div>
        </div>
      </Section>

      <div style={{ padding: "0 10px 6px", display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{
          fontSize: "9px", fontWeight: 800, color: "#9B7C45",
          letterSpacing: "0.14em", textTransform: "uppercase",
          fontFamily: ff, whiteSpace: "nowrap", flexShrink: 0,
        }}>Посилання</div>
        <div style={{ flex: 1, minWidth: 0, display: "flex", gap: "4px" }}>
          {!linkOpen && !currentLink && (
            <button
              type="button"
              onClick={() => { setLinkOpen(true); setLinkInput(""); }}
              style={{
                flex: 1, height: "26px",
                borderRadius: "6px",
                border: "1px dashed #D4A843",
                background: "transparent",
                color: "#9B7C45",
                fontSize: "11px", fontWeight: 600,
                cursor: "pointer", fontFamily: ff,
              }}
            >🔗 Додати</button>
          )}
          {(linkOpen || currentLink) && (
            <>
              <input
                type="text"
                value={linkOpen ? linkInput : currentLink}
                onChange={(e) => setLinkInput(e.target.value)}
                onFocus={() => { if (currentLink && !linkOpen) { setLinkInput(currentLink); setLinkOpen(true); } }}
                placeholder="https://..."
                style={{ ...inputBase, flex: 1, minWidth: 0, padding: "0 8px" }}
              />
              {/* ✓ показуємо ТІЛЬКИ під час активного вводу/редагування. Після
                  збереження (setLinkOpen(false)) залишається лише input з
                  поточним посиланням і 🗑 для видалення. Так юзер не плутається
                  «чи треба ще раз тиснути ✓ — лінк вже записаний?». */}
              {linkOpen && (
              <button
                type="button"
                onClick={() => {
                  const url = linkInput.trim();
                  if (!url) return;
                  // Якщо нічого не виділено — лінк нема куди прикріпити (link
                  // mark створиться на курсорі без тексту). Виділяємо весь
                  // вміст редактора (для заголовків це слово/фраза, для тексту
                  // — все що написано), щоб setLink реально обгорнув <a>.
                  const { from, to } = editor.state.selection;
                  const chain = editor.chain().focus();
                  if (from === to) chain.selectAll();
                  chain.extendMarkRange("link").setLink({ href: url }).run();
                  setLinkOpen(false);
                }}
                title={currentLink ? "Оновити" : "Зберегти"}
                style={{
                  width: "26px", height: "26px", borderRadius: "5px",
                  border: "1px solid #D4A843", background: "#1C3A2E",
                  color: "#D4A843", fontSize: "11px", fontWeight: 700,
                  cursor: "pointer", fontFamily: ff, flexShrink: 0,
                }}
              >✓</button>
              )}
              {currentLink && (
                <button
                  type="button"
                  onClick={() => {
                    editor.chain().focus().extendMarkRange("link").unsetLink().run();
                    setLinkInput("");
                    setLinkOpen(false);
                  }}
                  title="Видалити посилання"
                  style={{
                    width: "26px", height: "26px", borderRadius: "5px",
                    border: "1px solid #FCA5A5", background: "#FFFFFF",
                    color: "#B91C1C", fontSize: "11px", fontWeight: 700,
                    cursor: "pointer", fontFamily: ff, flexShrink: 0,
                  }}
                >🗑</button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
