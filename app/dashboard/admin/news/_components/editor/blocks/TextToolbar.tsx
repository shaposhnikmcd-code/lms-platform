"use client";

import { Editor } from "@tiptap/react";
import { OVERLAY_FONTS } from "./ImageEditor";
import {
  ff,
  Section,
  SectionLabel,
  GroupDivider,
  GroupHeader,
  SwatchGrid,
  WORD_TEXT_COLORS,
  WORD_HIGHLIGHT_COLORS,
  ToggleBtn,
  FontSelect,
  inputBase,
} from "./_settingsPrimitives";

const FONT_SIZE_PRESETS = ["12px", "13px", "14px", "15px", "16px", "18px", "20px", "24px", "28px", "32px", "36px"];

// Sectioned toolbar для блоків Текст / Заголовок / Цитата. Живе всередині
// TextStudioModal (fullscreen-редактор). Word-style палітри для кольору тексту
// і highlight, без секції "Посилання".
export default function SectionedTextToolbar({ editor }: { editor: Editor }) {
  const currentColor = (editor.getAttributes("textStyle").color as string | undefined) || "";
  const currentHl = (editor.getAttributes("highlight").color as string | undefined) || "";
  const currentSize = (editor.getAttributes("textStyle").fontSize as string | undefined) || "";
  const currentFont = (editor.getAttributes("textStyle").fontFamily as string | undefined) || "";

  // Реальний обчислений розмір тексту в редакторі (підставляється у "Авто"-опцію
  // селекту, щоб користувач бачив фактичний px замість абстрактного "Авто").
  // Читається на кожному рендері toolbar-у — TipTap ре-рендерить при зміні
  // курсору/стану, тож значення оновлюється коли курсор переходить на h2/h3.
  let effectiveSize: number | null = null;
  if (typeof window !== "undefined" && editor.view?.dom) {
    const cs = window.getComputedStyle(editor.view.dom);
    const px = parseFloat(cs.fontSize);
    if (Number.isFinite(px)) effectiveSize = Math.round(px);
  }

  return (
    <div style={{ fontFamily: ff }}>
      <GroupHeader>Типографіка</GroupHeader>

      <Section padTop={4}>
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

      <Section padTop={2}>
        <SectionLabel>Стиль</SectionLabel>
        <div style={{ display: "flex", gap: "5px" }}>
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
      </Section>

      <Section padTop={2}>
        <SectionLabel>Списки</SectionLabel>
        <div style={{ display: "flex", gap: "5px" }}>
          <ToggleBtn flex active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Маркований">
            <span style={{ fontSize: "14px" }}>•</span>
          </ToggleBtn>
          <ToggleBtn flex active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Нумерований">
            <span style={{ fontSize: "11px" }}>1.</span>
          </ToggleBtn>
        </div>
      </Section>

      <GroupDivider />
      <GroupHeader>Кольори</GroupHeader>

      <Section padTop={4}>
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
      </Section>

      <Section padTop={2}>
        <SectionLabel>Виділення</SectionLabel>
        <SwatchGrid
          current={currentHl}
          palette={WORD_HIGHLIGHT_COLORS}
          cols={7}
          onChange={c => {
            if (!c) editor.chain().focus().unsetHighlight().run();
            else editor.chain().focus().setHighlight({ color: c }).run();
          }}
        />
      </Section>
    </div>
  );
}
