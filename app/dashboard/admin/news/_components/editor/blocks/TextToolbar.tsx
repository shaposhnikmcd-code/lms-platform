"use client";

import { useEffect, useRef, useState } from "react";
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
import type { BlockVAlign } from "../types";

const FONT_SIZE_MIN = 8;
const FONT_SIZE_MAX = 400;

// Sectioned toolbar для блоків Текст / Заголовок / Цитата.
// Layout — дзеркало OverlayToolbar (Текст на фото): SectionLabel зверху,
// контроли знизу, всі секції впритул (padTop=0 крім першої).
export default function SectionedTextToolbar({
  editor,
  vAlign,
  onSetVAlign,
  showLists = false,
}: {
  editor: Editor;
  vAlign?: BlockVAlign;
  onSetVAlign?: (v: BlockVAlign) => void;
  /** Чи показувати секцію «Списки та блоки» (•/1./❝/—). У білдер-sidebar
   *  default=false (короткий toolbar), у TextStudioModal — true (повноцінний). */
  showLists?: boolean;
}) {
  const currentColor = (editor.getAttributes("textStyle").color as string | undefined) || "";
  const currentHl = (editor.getAttributes("highlight").color as string | undefined) || "";
  const currentSize = (editor.getAttributes("textStyle").fontSize as string | undefined) || "";
  const currentFont = (editor.getAttributes("textStyle").fontFamily as string | undefined) || "";
  // currentLink: спершу шукаємо link-mark на поточному selection (TipTap
  // standard), якщо там пусто — обходимо документ і беремо перший link mark.
  // Без цього після undo input не показував би лінк, якщо курсор стояв поза
  // текстом з link mark-ом.
  const currentLink = (() => {
    const sel = (editor.getAttributes("link").href as string | undefined) || "";
    if (sel) return sel;
    let found = "";
    editor.state.doc.descendants((node) => {
      if (found) return false;
      for (const m of node.marks) {
        if (m.type.name === "link" && typeof m.attrs.href === "string" && m.attrs.href) {
          found = m.attrs.href;
          return false;
        }
      }
      return true;
    });
    return found;
  })();
  // Контрольований input для лінка. Sync з editor: коли currentLink змінився
  // ззовні (undo/redo, ввімкнувся інший блок) і input НЕ у фокусі — підтягуємо.
  // Поки користувач друкує — value сидить локально, бо setLink-на-кожен-ключ
  // викликає selectAll(), що ламає UX набору.
  const [linkDraft, setLinkDraft] = useState(currentLink);
  const linkInputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (document.activeElement !== linkInputRef.current) setLinkDraft(currentLink);
  }, [currentLink]);
  const commitLink = (raw: string) => {
    const url = raw.trim();
    if (!url) {
      if (currentLink) editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    const { from, to } = editor.state.selection;
    const chain = editor.chain().focus();
    if (from === to) chain.selectAll();
    chain.extendMarkRange("link").setLink({ href: url }).run();
  };
  const clearLink = () => {
    setLinkDraft("");
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
  };

  let effectiveSize: number | null = null;
  if (typeof window !== "undefined" && editor.view?.dom) {
    const cs = window.getComputedStyle(editor.view.dom);
    const px = parseFloat(cs.fontSize);
    if (Number.isFinite(px)) effectiveSize = Math.round(px);
  }

  // Для stepper-а: parsed-px з currentSize (TipTap textStyle.fontSize), або
  // ефективний computed-розмір з DOM (для незаданого textStyle). Без явного
  // setFontSize це effectiveSize; інакше — number з "32px".
  const parsedSize = (() => {
    const m = currentSize.match(/^(\d+(?:\.\d+)?)px$/);
    return m ? Math.round(parseFloat(m[1])) : null;
  })();
  const displaySize = parsedSize ?? effectiveSize ?? 16;
  const applySize = (n: number) => {
    const clamped = Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, n));
    editor.chain().focus().setFontSize(`${clamped}px`).run();
  };

  // Font-weight slider: значення з textStyle.fontWeight. Fallback на 700 якщо
  // bold-mark активний (B-кнопка кладе bold через окремий mark, не textStyle),
  // інакше 400 (нормальний). Step 100, як стандартні CSS font-weight значення.
  const rawWeight = editor.getAttributes("textStyle").fontWeight as string | undefined;
  const displayWeight = (() => {
    const n = rawWeight ? Number(rawWeight) : NaN;
    if (Number.isFinite(n) && n >= 100 && n <= 900) return n;
    return editor.isActive("bold") ? 700 : 400;
  })();
  const applyWeight = (w: number) => {
    const clamped = Math.max(100, Math.min(900, Math.round(w / 10) * 10));
    // Стандартна TipTap-поведінка: mark діє на виділений діапазон. Без виділення
    // — лише "режим набору" для наступного вводу (видимої зміни не буде).
    const chain = editor.chain().focus();
    if (editor.isActive("bold")) chain.unsetBold();
    chain.setMark("textStyle", { fontWeight: String(clamped) }).run();
  };

  const hasAnyMark =
    editor.isActive("bold") || editor.isActive("italic") || editor.isActive("underline") ||
    editor.isActive("strike") || editor.isActive("highlight") || !!currentColor || !!currentSize || !!currentFont || !!rawWeight;


  // Порядок секцій 1-в-1 з OverlayToolbar (Текст на фото):
  //   Дії(inline) → Колір тексту → Колір фону → Шрифт+розмір → Стиль →
  //   Гориз → Верт → Форма підкладки → Ефекти → Посилання
  // Унікальні для текст-блока (нема в overlay) — Списки та блоки, Виділення —
  // вставлені перед Посиланням, щоб не ламати overlay-порядок зверху.
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
        <div style={{ display: "flex", flexDirection: "row", gap: "6px", alignItems: "center" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <FontSelect
              value={currentFont}
              onChange={v => {
                if (!v) editor.chain().focus().unsetFontFamily().run();
                else editor.chain().focus().setFontFamily(v).run();
              }}
              options={OVERLAY_FONTS}
            />
          </div>
          <div style={{ display: "inline-flex", gap: "4px", alignItems: "center", flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => applySize(displaySize - 1)}
              title="Менше"
              style={{ ...inputBase, width: "22px", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}
            >−</button>
            <input
              type="text"
              inputMode="numeric"
              value={displaySize}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9]/g, "");
                if (v === "") return;
                const n = Number(v);
                if (Number.isFinite(n) && n >= FONT_SIZE_MIN && n <= FONT_SIZE_MAX) applySize(n);
              }}
              title="Розмір шрифту (px)"
              style={{ ...inputBase, width: "38px", textAlign: "center", padding: "0 4px" }}
            />
            <button
              type="button"
              onClick={() => applySize(displaySize + 1)}
              title="Більше"
              style={{ ...inputBase, width: "22px", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}
            >+</button>
          </div>
        </div>
      </Section>

      <Section padTop={0}>
        <SectionLabel>Стиль</SectionLabel>
        <div style={{ display: "flex", gap: "5px" }}>
          <ToggleBtn flex active={displayWeight >= 600} onClick={() => applyWeight(displayWeight >= 600 ? 400 : 700)} title="Жирний (Ctrl+B)">
            <span style={{ fontWeight: 700 }}>B</span>
          </ToggleBtn>
          <ToggleBtn flex active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Курсив (Ctrl+I)">
            <span style={{ fontStyle: "italic", fontWeight: 600 }}>I</span>
          </ToggleBtn>
          <ToggleBtn flex active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Підкреслений (Ctrl+U)">
            <span style={{ textDecoration: "underline", fontWeight: 600 }}>U</span>
          </ToggleBtn>
        </div>
        {/* Жирність — плавна. Slider 100..900 з кроком 100 (стандартні CSS-вагові ступені).
            Поруч цифрове значення з натяком на пресет (Thin/Light/Regular/Medium/Bold/Black). */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px" }}>
          <input
            type="range"
            min={100}
            max={900}
            step={10}
            value={displayWeight}
            onChange={(e) => applyWeight(Number(e.target.value))}
            title="Жирність шрифту (100..900)"
            style={{ flex: 1, accentColor: "#D4A843", cursor: "pointer" }}
          />
          <span style={{
            fontSize: "10px", fontWeight: 700, color: "#9B7C45",
            minWidth: "26px", textAlign: "right", fontFamily: ff,
          }}>{displayWeight}</span>
        </div>
      </Section>

      <Section padTop={0}>
        <SectionLabel>Вирівнювання по горизонталі</SectionLabel>
        <div style={{ display: "flex", gap: "5px" }}>
          {(["left", "center", "right"] as const).map(a => (
            <ToggleBtn
              key={a}
              flex
              active={editor.isActive({ textAlign: a })}
              onClick={() => editor.chain().focus().setTextAlign(a).run()}
              title={a === "left" ? "Ліворуч" : a === "right" ? "Праворуч" : "По центру"}
            >
              {a === "left" ? "⯇" : a === "right" ? "⯈" : "≡"}
            </ToggleBtn>
          ))}
        </div>
      </Section>

      <Section padTop={0}>
        <SectionLabel>Вирівнювання по вертикалі</SectionLabel>
        <div style={{ display: "flex", gap: "5px" }}>
          {(["top", "center", "bottom"] as const).map(v => {
            const active = (vAlign || "top") === v;
            const disabled = !onSetVAlign;
            return (
              <ToggleBtn
                key={v}
                flex
                active={active}
                onClick={() => onSetVAlign?.(v)}
                title={disabled ? "Недоступно" : v === "top" ? "Зверху" : v === "bottom" ? "Знизу" : "По центру"}
              >
                <span style={{ opacity: disabled ? 0.4 : 1 }}>
                  {v === "top" ? "⏶" : v === "bottom" ? "⏷" : "≡"}
                </span>
              </ToggleBtn>
            );
          })}
        </div>
      </Section>


      {showLists && (
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
      )}

      {/* Колір тексту + Виділення поряд (Word-like).
          Колір тексту — повна 6-col Word-палітра (30 swatches),
          Виділення — компактна 1×6 (highlight-marker). Розташовуємо в єдиному
          Section з flex-row + gap, щоб мати спільний нижній padding. */}
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

      <Section padTop={0}>
        <SectionLabel>Посилання</SectionLabel>
        <div style={{ display: "flex", gap: "5px" }}>
          <input
            ref={linkInputRef}
            type="text"
            value={linkDraft}
            onChange={(e) => setLinkDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitLink(linkDraft);
                linkInputRef.current?.blur();
              }
            }}
            placeholder="https://..."
            style={{ ...inputBase, flex: 1, padding: "0 8px" }}
          />
          {/* ✓ показуємо тільки коли є pending-зміни (draft ≠ примінений лінк).
             Після успішного коміту галочка зникає → лишається лише ✕.
             Це дає чіткий сигнал "збережено", як user-expected. */}
          {linkDraft.trim() && linkDraft.trim() !== currentLink && (
            <button
              type="button"
              onClick={() => commitLink(linkDraft)}
              title="Зберегти посилання"
              style={{
                ...inputBase, width: "32px",
                cursor: "pointer",
                color: "#FFFFFF",
                background: "#059669",
                borderColor: "#059669",
                fontWeight: 700,
              }}
            >✓</button>
          )}
          {currentLink && (
            <button
              type="button"
              onClick={clearLink}
              title="Прибрати посилання"
              style={{ ...inputBase, width: "32px", color: "#B91C1C", cursor: "pointer" }}
            >✕</button>
          )}
        </div>
      </Section>
    </div>
  );
}
