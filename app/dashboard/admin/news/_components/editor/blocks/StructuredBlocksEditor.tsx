"use client";

// Editors для структурованих блоків шаблонів (Session 2 of template refactor).
//
// Кожен блок = семантичний слот EVENT/ARTICLE-картки. Зберігає дані у
// `block.data` (Record<string, string>), редагується інлайн на canvas-і
// (contentEditable для текстових полів). Стилі рендеру дзеркалять stubs
// у lib/news/render.tsx — те що бачиш у редакторі = те що буде на /news.
//
// Список editor-ів:
//   SpeakerNameEditor    — Імʼя фахівця
//   SpeakerRoleEditor    — Посада / спеціалізація
//   TaglineEditor        — Tagline
//   PriceEditor          — Вартість (value + currency + label)
//   DurationEditor       — Тривалість (value + unit + label)
//   CtaButtonEditor      — Кнопка CTA (label + href + colors)
//   EducationItemEditor  — Пункт освіти (title + subtitle)
//
// Settings-панелі (вибір шрифту/розміру/кольору) для кожного — у Session 3
// разом з constructor-режимом TemplateEditor. Зараз editori мінімальні:
// content-editable текстові поля без зайвої UI-обвʼязки. style props
// читаються з block.data (fontFamily/fontSize/color/weight тощо), що
// зберігаються з зовнішніх settings — як HeadingEditor зараз робить.

import React, { useEffect, useRef } from "react";
import type { Block } from "../types";

const ff = "-apple-system, BlinkMacSystemFont, sans-serif";

interface BaseProps {
  block: Block;
  onChange: (data: Record<string, string>) => void;
  selected?: boolean;
}

// ─── Helper: inline-editable текстовий елемент ────────────────────────────────
// React-friendly contentEditable: text-only, без перерендеру при кожному вводі
// (через uncontrolled input + ref + onInput → onChange батьку лише при blur).
// Це уникає курсор-jumping-у при швидкому набиранні.

function EditableText({
  value,
  onCommit,
  placeholder,
  style,
  ariaLabel,
  multiline = false,
}: {
  value: string;
  onCommit: (next: string) => void;
  placeholder: string;
  style: React.CSSProperties;
  ariaLabel: string;
  multiline?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // При зовнішній зміні value (undo/redo / load) — синкаємо innerText.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.innerText !== value) el.innerText = value;
  }, [value]);

  return (
    <div
      ref={ref}
      role="textbox"
      aria-label={ariaLabel}
      contentEditable
      suppressContentEditableWarning
      onBlur={e => {
        const next = (e.currentTarget.innerText || "").trim();
        if (next !== value) onCommit(next);
      }}
      onKeyDown={e => {
        // Enter без shift = commit + blur (для single-line). Для multiline —
        // дозволяємо новий рядок.
        if (e.key === "Enter" && !e.shiftKey && !multiline) {
          e.preventDefault();
          (e.currentTarget as HTMLElement).blur();
        }
      }}
      // Placeholder через ::before з data-attr — стандартний contentEditable
      // hack без додаткових бібліотек.
      data-placeholder={placeholder}
      style={{
        outline: "none",
        cursor: "text",
        minWidth: 40,
        whiteSpace: multiline ? "pre-wrap" : "nowrap",
        fontFamily: ff,
        ...style,
      }}
    />
  );
}

// CSS для placeholder-у contentEditable. Injectиться один раз через
// styled-jsx-style тег у NewsEditor (вже існує там) АБО локальним <style>.
// Тут — локальний, щоб editor був самодостатнім.
const placeholderCss = `
  [contenteditable][data-placeholder]:empty::before {
    content: attr(data-placeholder);
    color: #A8956C;
    opacity: 0.65;
    pointer-events: none;
  }
`;

// ─── 1. Імʼя фахівця ──────────────────────────────────────────────────────────

export function SpeakerNameEditor({ block, onChange }: BaseProps) {
  return (
    <>
      <style>{placeholderCss}</style>
      <EditableText
        value={block.data.text || ""}
        onCommit={text => onChange({ ...block.data, text })}
        placeholder="[Імʼя Прізвище]"
        ariaLabel="Імʼя фахівця"
        style={{
          fontSize: Number(block.data.fontSize) || 22,
          fontWeight: Number(block.data.weight) || 700,
          fontFamily: block.data.fontFamily || ff,
          color: block.data.color || "#1C3A2E",
          lineHeight: 1.2,
          width: "100%",
        }}
      />
    </>
  );
}

// ─── 2. Посада / спеціалізація ────────────────────────────────────────────────

export function SpeakerRoleEditor({ block, onChange }: BaseProps) {
  return (
    <>
      <style>{placeholderCss}</style>
      <EditableText
        value={block.data.text || ""}
        onCommit={text => onChange({ ...block.data, text })}
        placeholder="[Посада / спеціалізація]"
        ariaLabel="Посада фахівця"
        style={{
          fontSize: Number(block.data.fontSize) || 14,
          fontWeight: Number(block.data.weight) || 500,
          fontFamily: block.data.fontFamily || ff,
          color: block.data.color || "#1C3A2E",
          opacity: 0.85,
          lineHeight: 1.3,
          width: "100%",
        }}
      />
    </>
  );
}

// ─── 3. Tagline ───────────────────────────────────────────────────────────────

export function TaglineEditor({ block, onChange }: BaseProps) {
  return (
    <>
      <style>{placeholderCss}</style>
      <EditableText
        value={block.data.text || ""}
        onCommit={text => onChange({ ...block.data, text })}
        placeholder="[Tagline — досвід або фокус, 1 рядок]"
        ariaLabel="Tagline"
        style={{
          fontSize: Number(block.data.fontSize) || 13,
          fontFamily: block.data.fontFamily || ff,
          color: block.data.color || "#1C3A2E",
          fontStyle: block.data.italic === "true" ? "italic" : "normal",
          opacity: 0.9,
          lineHeight: 1.35,
          width: "100%",
        }}
      />
    </>
  );
}

// ─── 4. Вартість ──────────────────────────────────────────────────────────────

export function PriceEditor({ block, onChange }: BaseProps) {
  return (
    <>
      <style>{placeholderCss}</style>
      <div style={{ fontFamily: block.data.fontFamily || ff, color: block.data.color || "#1C3A2E" }}>
        <EditableText
          value={block.data.label || ""}
          onCommit={label => onChange({ ...block.data, label })}
          placeholder="ВАРТІСТЬ"
          ariaLabel="Підпис над ціною"
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            opacity: 0.7,
            marginBottom: 4,
          }}
        />
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <EditableText
            value={block.data.value || ""}
            onCommit={value => onChange({ ...block.data, value })}
            placeholder="[X]"
            ariaLabel="Значення ціни"
            style={{
              fontSize: Number(block.data.fontSize) || 22,
              fontWeight: 700,
              lineHeight: 1,
            }}
          />
          <EditableText
            value={block.data.currency || ""}
            onCommit={currency => onChange({ ...block.data, currency })}
            placeholder="грн"
            ariaLabel="Валюта"
            style={{
              fontSize: Math.max(14, (Number(block.data.fontSize) || 22) - 4),
              fontWeight: 700,
              lineHeight: 1,
            }}
          />
        </div>
      </div>
    </>
  );
}

// ─── 5. Тривалість ────────────────────────────────────────────────────────────

export function DurationEditor({ block, onChange }: BaseProps) {
  return (
    <>
      <style>{placeholderCss}</style>
      <div style={{ fontFamily: block.data.fontFamily || ff, color: block.data.color || "#1C3A2E" }}>
        <EditableText
          value={block.data.label || ""}
          onCommit={label => onChange({ ...block.data, label })}
          placeholder="ТРИВАЛІСТЬ"
          ariaLabel="Підпис над тривалістю"
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            opacity: 0.7,
            marginBottom: 4,
          }}
        />
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <EditableText
            value={block.data.value || ""}
            onCommit={value => onChange({ ...block.data, value })}
            placeholder="[N]"
            ariaLabel="Значення тривалості"
            style={{
              fontSize: Number(block.data.fontSize) || 22,
              fontWeight: 700,
              lineHeight: 1,
            }}
          />
          <EditableText
            value={block.data.unit || ""}
            onCommit={unit => onChange({ ...block.data, unit })}
            placeholder="хв"
            ariaLabel="Одиниця часу"
            style={{
              fontSize: Math.max(14, (Number(block.data.fontSize) || 22) - 4),
              fontWeight: 700,
              lineHeight: 1,
            }}
          />
        </div>
      </div>
    </>
  );
}

// ─── 6. Кнопка CTA ────────────────────────────────────────────────────────────

export function CtaButtonEditor({ block, onChange }: BaseProps) {
  const bg = block.data.bgColor || "#D4A843";
  const fg = block.data.fgColor || "#1C3A2E";
  const radiusVal = Number(block.data.radius);
  const radius = Number.isFinite(radiusVal) ? radiusVal : 8;
  const radiusCss = radius >= 999 ? "9999px" : `${radius}px`;

  return (
    <>
      <style>{placeholderCss}</style>
      <div style={{ width: "100%", textAlign: "center" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: bg,
            color: fg,
            fontFamily: block.data.fontFamily || ff,
            fontSize: Number(block.data.fontSize) || 14,
            fontWeight: 700,
            padding: "10px 18px",
            borderRadius: radiusCss,
            letterSpacing: "0.02em",
            minWidth: 120,
          }}
        >
          <EditableText
            value={block.data.label || ""}
            onCommit={label => onChange({ ...block.data, label })}
            placeholder="Записатися на консультацію"
            ariaLabel="Текст кнопки"
            style={{ color: fg, fontWeight: 700 }}
          />
        </div>
        {/* href: дрібний editable нижче, щоб admin побачив куди веде кнопка.
           Зберігається в data.href. У public-render — у <a> обгортці. */}
        <div style={{ marginTop: 6 }}>
          <EditableText
            value={block.data.href || ""}
            onCommit={href => onChange({ ...block.data, href })}
            placeholder="https://… (URL не задано)"
            ariaLabel="URL посилання"
            style={{
              fontSize: 10,
              color: "#A8956C",
              fontFamily: ff,
              opacity: 0.85,
            }}
          />
        </div>
      </div>
    </>
  );
}

// ─── 7. Пункт освіти ──────────────────────────────────────────────────────────

export function EducationItemEditor({ block, onChange }: BaseProps) {
  return (
    <>
      <style>{placeholderCss}</style>
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "flex-start",
          fontFamily: block.data.fontFamily || ff,
          color: block.data.color || "#1C3A2E",
        }}
      >
        <span aria-hidden style={{ flexShrink: 0, marginTop: 6 }}>▪</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <EditableText
            value={block.data.title || ""}
            onCommit={title => onChange({ ...block.data, title })}
            placeholder="[Назва освіти]"
            ariaLabel="Назва освіти"
            style={{
              fontSize: Number(block.data.fontSize) || 14,
              fontWeight: 700,
              lineHeight: 1.35,
            }}
          />
          <EditableText
            value={block.data.subtitle || ""}
            onCommit={subtitle => onChange({ ...block.data, subtitle })}
            placeholder="[Тип / диплом · роки]"
            ariaLabel="Підпис до освіти"
            style={{
              fontSize: Math.max(11, (Number(block.data.fontSize) || 14) - 2),
              fontWeight: 400,
              opacity: 0.75,
              lineHeight: 1.4,
              marginTop: 2,
            }}
          />
        </div>
      </div>
    </>
  );
}
