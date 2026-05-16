"use client";

// Reusable form-primitives для template editor-а.
// Стиль — узгоджений з адмінкою (#1C3A2E акцент, #FAF6F0 фон, #E8D5B7 рамка).

import React, { useRef, useState } from "react";
import TextStudioModal from "../editor/blocks/TextStudioModal";

const ff = "Inter, system-ui, -apple-system, sans-serif";

// ── Text input ──────────────────────────────────────────────────────────────

interface TextInputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  /** Maximum allowed length (визначає лічильник у hint-row). */
  maxLength?: number;
}

export function TextInput({ label, value, onChange, placeholder, hint, maxLength }: TextInputProps) {
  return (
    <label style={{ display: "block", fontFamily: ff }}>
      <FieldHeader label={label} hint={hint} value={value} maxLength={maxLength} />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        style={{
          width: "100%",
          padding: "7px 10px",
          fontSize: 13,
          fontFamily: ff,
          color: "#1C1917",
          background: "#FFFFFF",
          border: "1.5px solid #E8D5B7",
          borderRadius: 7,
          outline: "none",
          transition: "border-color 0.15s",
        }}
        onFocus={e => (e.currentTarget.style.borderColor = "#D4A843")}
        onBlur={e => (e.currentTarget.style.borderColor = "#E8D5B7")}
      />
    </label>
  );
}

// ── Link input (URL з зеленою галкою-confirm) ──────────────────────────────
// Той самий UX, що в news-builder Текст-на-фото (OverlayLinkRow): draft state,
// ✓ для коміту, lock-стан після збереження, 🗑 для скидання.

interface LinkInputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}

export function LinkInput({ label, value, onChange, placeholder, hint }: LinkInputProps) {
  const [draft, setDraft] = useState(value);
  React.useEffect(() => { setDraft(value); }, [value]);
  const trimmed = draft.trim();
  const isSaved = !!value;
  const canSave = !isSaved && !!trimmed;
  const baseInputStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    padding: "7px 10px",
    fontSize: 13,
    fontFamily: ff,
    color: isSaved ? "#9B7C45" : "#1C1917",
    background: isSaved ? "#F5F1E8" : "#FFFFFF",
    border: "1.5px solid #E8D5B7",
    borderRadius: 7,
    outline: "none",
    cursor: isSaved ? "default" : "text",
    transition: "border-color 0.15s",
  };
  return (
    <label style={{ display: "block", fontFamily: ff }}>
      <FieldHeader label={label} hint={hint} value={value} />
      <div style={{ display: "flex", gap: 5 }}>
        <input
          type="text"
          value={draft}
          readOnly={isSaved}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (isSaved) return;
            if (e.key === "Enter") {
              e.preventDefault();
              if (canSave) onChange(trimmed);
            }
          }}
          placeholder={placeholder}
          style={baseInputStyle}
          onFocus={e => { if (!isSaved) e.currentTarget.style.borderColor = "#D4A843"; }}
          onBlur={e => (e.currentTarget.style.borderColor = "#E8D5B7")}
        />
        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); if (canSave) onChange(trimmed); }}
          title={canSave ? "Зберегти посилання" : (isSaved ? "Збережено" : "Введіть URL")}
          style={{
            width: 34,
            height: 34,
            border: `1.5px solid ${canSave ? "#059669" : "#E8D5B7"}`,
            borderRadius: 7,
            background: canSave ? "#059669" : "#FAF6F0",
            color: canSave ? "#FFFFFF" : "#A8956C",
            cursor: canSave ? "pointer" : "default",
            fontWeight: 700,
            fontSize: 14,
            opacity: canSave ? 1 : 0.55,
            fontFamily: ff,
            flexShrink: 0,
          }}
        >✓</button>
        {isSaved && (
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); onChange(""); }}
            title="Прибрати посилання"
            style={{
              width: 34,
              height: 34,
              border: "1.5px solid #E8D5B7",
              borderRadius: 7,
              background: "#FFFFFF",
              color: "#B91C1C",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 14,
              flexShrink: 0,
            }}
          >🗑</button>
        )}
      </div>
    </label>
  );
}

// ── Textarea ────────────────────────────────────────────────────────────────

interface TextAreaProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  rows?: number;
  maxLength?: number;
}

export function TextAreaInput({ label, value, onChange, placeholder, hint, rows = 4, maxLength }: TextAreaProps) {
  return (
    <label style={{ display: "block", fontFamily: ff }}>
      <FieldHeader label={label} hint={hint} value={value} maxLength={maxLength} />
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        style={{
          width: "100%",
          padding: "8px 10px",
          fontSize: 13,
          fontFamily: ff,
          color: "#1C1917",
          background: "#FFFFFF",
          border: "1.5px solid #E8D5B7",
          borderRadius: 7,
          outline: "none",
          resize: "vertical",
          minHeight: 56,
          lineHeight: 1.5,
          transition: "border-color 0.15s",
        }}
        onFocus={e => (e.currentTarget.style.borderColor = "#D4A843")}
        onBlur={e => (e.currentTarget.style.borderColor = "#E8D5B7")}
      />
    </label>
  );
}

// ── Rich-text field (textarea preview + кнопка «✎ Редактор» → TextStudioModal) ─

interface RichTextFieldProps {
  label: string;
  /** HTML-рядок. Для backward-compat plain text auto-wrap у <p>...</p> на open. */
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  hint?: string;
  rows?: number;
  maxLength?: number;
}

function stripHtmlForPreview(html: string): string {
  if (!html) return "";
  // Replace <br>/<p>/closing tags → newlines + strip останніх тегів. Дає preview
  // близький до того що користувач набрав, без HTML noise у формі.
  return html
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function wrapPlainAsHtml(text: string): string {
  if (!text) return "";
  // Якщо вже HTML — лишаємо. Інакше parse plain → <p> per абзац.
  if (/<\w+[^>]*>/.test(text)) return text;
  const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  return paragraphs.map(p => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("");
}

export function RichTextField({ label, value, onChange, placeholder, hint, rows = 4, maxLength }: RichTextFieldProps) {
  const [open, setOpen] = useState(false);
  // Якщо value — HTML, у textarea показуємо stripped plain, але редагування
  // вільне: користувач може набирати/вставляти як завжди. Перехід у формат-режим
  // через кнопку ✎ Редактор (опційно). Це поведінка як в Notion/Substack:
  // основний шлях — plain text; форматування — окремий жест.
  const isHtml = /<\w+[^>]*>/.test(value || "");
  const textareaValue = isHtml ? stripHtmlForPreview(value) : value;
  return (
    <div style={{ display: "block", fontFamily: ff }}>
      <FieldHeader label={label} hint={hint} value={textareaValue} maxLength={maxLength} />
      <div style={{ position: "relative" }}>
        <textarea
          value={textareaValue}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          maxLength={maxLength}
          style={{
            width: "100%",
            padding: "8px 10px",
            fontSize: 13,
            fontFamily: ff,
            color: "#1C1917",
            background: "#FFFFFF",
            border: "1.5px solid #E8D5B7",
            borderRadius: 7,
            outline: "none",
            resize: "vertical",
            minHeight: 56,
            lineHeight: 1.5,
            transition: "border-color 0.15s",
          }}
          onFocus={e => (e.currentTarget.style.borderColor = "#D4A843")}
          onBlur={e => (e.currentTarget.style.borderColor = "#E8D5B7")}
        />
        {/* ✎ — опційна кнопка у нижньому правому куті, не перекриває область
            тексту і не блокує введення. Дзеркало як «Розгорнути на весь екран»
            у Gmail/Linear. */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Відкрити повноцінний редактор з форматуванням (B/I/U, кольори, посилання)"
          style={{
            position: "absolute",
            bottom: 8,
            right: 8,
            padding: "3px 7px",
            fontSize: 10,
            fontWeight: 600,
            border: "1px solid #E8D5B7",
            background: "rgba(255,255,255,0.92)",
            color: "#9B7C45",
            borderRadius: 5,
            cursor: "pointer",
            fontFamily: ff,
            letterSpacing: "0.04em",
            backdropFilter: "blur(2px)",
            opacity: 0.85,
            transition: "opacity 0.15s, color 0.15s, border-color 0.15s",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.opacity = "1";
            e.currentTarget.style.color = "#1C3A2E";
            e.currentTarget.style.borderColor = "#D4A843";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.opacity = "0.85";
            e.currentTarget.style.color = "#9B7C45";
            e.currentTarget.style.borderColor = "#E8D5B7";
          }}
        >
          ✎ Редактор
        </button>
      </div>
      {open && (
        <TextStudioModal
          title={`Редактор · ${label}`}
          icon="¶"
          blockType="text"
          initialHtml={wrapPlainAsHtml(value)}
          onCancel={() => setOpen(false)}
          onSave={(html) => {
            onChange(html);
            setOpen(false);
          }}
          paperBgColor=""
          paperAlign="left"
        />
      )}
    </div>
  );
}

// ── Rich-text single-line input (input + малий ✎ → TextStudioModal) ─────────

interface RichTextInputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  maxLength?: number;
}

/** Видаляє <p>-обгортки навколо контенту — щоб HTML був inline-safe для
 *  рендера всередині <h*>, <span>, <div> з inline-форматуванням. Зберігає
 *  inline-теги (<strong>, <em>, <span style>, <a>, <br>). */
function stripBlockTags(html: string): string {
  if (!html) return "";
  return html
    .replace(/<\/?p[^>]*>/gi, "")
    .replace(/<\/?div[^>]*>/gi, "")
    .replace(/<\/?h[1-6][^>]*>/gi, "")
    .trim();
}

export function RichTextInput({ label, value, onChange, placeholder, hint, maxLength }: RichTextInputProps) {
  const [open, setOpen] = useState(false);
  // Safe-coalesce: старі чернетки в localStorage можуть не мати нових полів
  // (priceLabel/durationLabel тощо) → undefined пробивається сюди. Не падаємо.
  const safeValue = typeof value === "string" ? value : "";
  const isHtml = /<\w+[^>]*>/.test(safeValue);
  const inputValue = isHtml ? stripHtmlForPreview(safeValue) : safeValue;
  return (
    <label style={{ display: "block", fontFamily: ff }}>
      <FieldHeader label={label} hint={hint} value={inputValue} maxLength={maxLength} />
      <div style={{ position: "relative" }}>
        <input
          type="text"
          value={inputValue}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          style={{
            width: "100%",
            padding: "7px 32px 7px 10px",
            fontSize: 13,
            fontFamily: ff,
            color: "#1C1917",
            background: "#FFFFFF",
            border: "1.5px solid #E8D5B7",
            borderRadius: 7,
            outline: "none",
            transition: "border-color 0.15s",
          }}
          onFocus={e => (e.currentTarget.style.borderColor = "#D4A843")}
          onBlur={e => (e.currentTarget.style.borderColor = "#E8D5B7")}
        />
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Відкрити редактор з форматуванням (B/I/U, кольори, посилання)"
          aria-label="Редактор"
          style={{
            position: "absolute",
            top: "50%",
            right: 6,
            transform: "translateY(-50%)",
            width: 22,
            height: 22,
            padding: 0,
            border: "1px solid transparent",
            background: "transparent",
            color: "#9B7C45",
            borderRadius: 4,
            cursor: "pointer",
            fontFamily: ff,
            fontSize: 12,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "color 0.15s, background 0.15s, border-color 0.15s",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = "#1C3A2E";
            e.currentTarget.style.background = "#FAF6F0";
            e.currentTarget.style.borderColor = "#D4A843";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = "#9B7C45";
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.borderColor = "transparent";
          }}
        >
          ✎
        </button>
      </div>
      {open && (
        <TextStudioModal
          title={`Редактор · ${label}`}
          icon="¶"
          blockType="text"
          initialHtml={isHtml ? safeValue : (safeValue ? `<p>${safeValue}</p>` : "")}
          onCancel={() => setOpen(false)}
          onSave={(html) => {
            // Inline-safe: видаляємо <p>/<div>/<h*>-обгортки, лишаємо тільки
            // inline-форматування. Якщо результат після стрипу == plain text —
            // зберігаємо як plain (без HTML-noise).
            const stripped = stripBlockTags(html);
            const plainProbe = stripped.replace(/<[^>]+>/g, "").trim();
            const isJustPlain = !/<\w+[^>]*>/.test(stripped);
            onChange(isJustPlain ? plainProbe : stripped);
            setOpen(false);
          }}
          paperBgColor=""
          paperAlign="left"
        />
      )}
    </label>
  );
}

// ── Field header (label + counter + hint) ───────────────────────────────────

function FieldHeader({ label, hint, value, maxLength }: { label: string; hint?: string; value: string; maxLength?: number }) {
  // Лічильник показуємо тільки коли є шанс впертися: ≥60% від ліміту або поле
  // не порожнє і нема hint. Інакше — візуальний шум.
  const showCounter = !hint && maxLength && value.length > 0 && (value.length / maxLength) > 0.6;
  const rightText = hint || (showCounter ? `${value.length} / ${maxLength}` : "");
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3, gap: 8 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#1C3A2E", letterSpacing: "0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
      {rightText && (
        <span style={{ fontSize: 9.5, color: "#9B7C45", whiteSpace: "nowrap" }}>{rightText}</span>
      )}
    </div>
  );
}

// ── Image input (upload + alt + caption) ────────────────────────────────────

interface ImageInputProps {
  label: string;
  value: { url: string; alt?: string; caption?: string };
  onChange: (v: { url: string; alt?: string; caption?: string }) => void;
  /** Aspect ratio для preview-thumbnail (наприклад "16/9", "4/3", "12/5"). Слот фіксований. */
  aspectRatio: string;
  /** Якщо true — поле caption доступне (для section image). Default false. */
  withCaption?: boolean;
  hint?: string;
  /** Максимальна ширина preview-thumbnail у px. За замовчуванням повна ширина.
   *  Використовується для портретних аспектів (3:4), щоб не розтягувати на всю
   *  висоту сайдбару. */
  maxPreviewWidth?: number;
}

export function ImageInput({ label, value, onChange, aspectRatio, withCaption = false, hint, maxPreviewWidth }: ImageInputProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  // Останнє видалене фото — для inline-undo (як у Gmail "Mail moved. Undo").
  // Зберігається у local-state на час сесії редактора, до перезавантаження.
  const [lastDeleted, setLastDeleted] = useState<typeof value | null>(null);

  const handleDelete = () => {
    if (!value.url) return;
    setLastDeleted(value);
    onChange({ url: "", alt: "", caption: "" });
  };
  const handleUndo = () => {
    if (!lastDeleted) return;
    onChange(lastDeleted);
    setLastDeleted(null);
  };

  const upload = async (file: File) => {
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (res.ok) {
        const { url } = await res.json();
        onChange({ ...value, url });
      } else {
        const j = await res.json().catch(() => ({}));
        setError(j?.error || `HTTP ${res.status}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Невідома помилка");
    } finally {
      setUploading(false);
    }
  };

  // Compact layout: коли є maxPreviewWidth (портретний 3:4), фото зліва +
  // alt/clear/caption справа в колонці. Інакше — повний flow (cover 16/9).
  const compact = !!maxPreviewWidth;
  const thumbW = maxPreviewWidth ?? undefined;

  const thumb = (
    <div
      style={{
        width: compact ? thumbW : "100%",
        flexShrink: 0,
        aspectRatio,
        background: value.url ? "transparent" : "#FAF6F0",
        border: "1.5px dashed #E8D5B7",
        borderRadius: 8,
        overflow: "hidden",
        position: "relative",
        cursor: "pointer",
      }}
      onClick={() => inputRef.current?.click()}
    >
      {value.url ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value.url}
            alt={value.alt || ""}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(28,58,46,0.45)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 600,
              opacity: 0,
              transition: "opacity 0.18s",
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "0")}
          >
            {uploading ? "Завантаження..." : "Замінити"}
          </div>
        </>
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            color: "#9B7C45",
            fontSize: 11,
            fontWeight: 600,
            textAlign: "center",
            padding: 8,
          }}
        >
          <span style={{ fontSize: 22 }} aria-hidden>🖼</span>
          <span>{uploading ? "Завантаження..." : "Натисніть, щоб завантажити"}</span>
        </div>
      )}
    </div>
  );

  const sideFields = (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 0 }}>
      <label style={{ display: "block", fontFamily: ff }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#1C3A2E", letterSpacing: "0.02em" }}>Alt-текст</span>
          <InfoTip text="Короткий опис фото словами — навіщо потрібен:&#10;&#10;• A11Y — програми для незрячих читають це голосом замість фото.&#10;• SEO — Google Images враховує цей текст у пошуковій видачі.&#10;• Fallback — якщо фото не завантажиться, у слоті покажеться цей текст.&#10;&#10;Приклад: «Логотип UIMP» або «Анна Гудзенко, психолог-консультант».&#10;Для декоративних фото можна лишити порожнім." />
        </div>
        <input
          type="text"
          value={value.alt || ""}
          onChange={e => onChange({ ...value, alt: e.target.value })}
          placeholder="опис фото для a11y + SEO"
          style={{
            width: "100%",
            padding: "7px 10px",
            fontSize: 12,
            fontFamily: ff,
            border: "1px solid #E8D5B7",
            borderRadius: 6,
            outline: "none",
            background: "#FFFFFF",
            color: "#1C1917",
          }}
        />
      </label>
      {withCaption && (
        <label style={{ display: "block", fontFamily: ff }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#1C3A2E", letterSpacing: "0.02em", marginBottom: 3 }}>Підпис</div>
          <input
            type="text"
            value={value.caption || ""}
            onChange={e => onChange({ ...value, caption: e.target.value })}
            placeholder="підпис під фото"
            style={{
              width: "100%",
              padding: "7px 10px",
              fontSize: 12,
              fontFamily: ff,
              border: "1px solid #E8D5B7",
              borderRadius: 6,
              outline: "none",
              background: "#FFFFFF",
              color: "#1C1917",
              fontStyle: "italic",
            }}
          />
        </label>
      )}
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          style={{
            padding: "5px 10px",
            fontSize: 11,
            fontWeight: 600,
            border: "1px solid #E8D5B7",
            background: "#FAF6F0",
            color: "#1C3A2E",
            borderRadius: 6,
            cursor: "pointer",
            fontFamily: ff,
          }}
          title={value.url ? "Замінити фото" : "Завантажити фото"}
        >
          {value.url ? "↻ Замінити" : "↑ Завантажити"}
        </button>
        {value.url && (
          <button
            type="button"
            onClick={handleDelete}
            style={{
              padding: "5px 10px",
              fontSize: 11,
              fontWeight: 600,
              border: "1px solid #FECACA",
              background: "#FFFFFF",
              color: "#B91C1C",
              borderRadius: 6,
              cursor: "pointer",
              fontFamily: ff,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
            title="Видалити фото"
          >
            🗑 Видалити фото
          </button>
        )}
        {/* ↻ Повернути — показуємо коли є last-deleted backup і поточне поле
           порожнє. Inline-undo як у Gmail/Notion: миттєвий revert без пошуку
           через глобальний Ctrl+Z. */}
        {!value.url && lastDeleted && (
          <button
            type="button"
            onClick={handleUndo}
            style={{
              padding: "5px 10px",
              fontSize: 11,
              fontWeight: 600,
              border: "1px solid #D4A843",
              background: "#FAF6F0",
              color: "#8B6F2D",
              borderRadius: 6,
              cursor: "pointer",
              fontFamily: ff,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
            title="Повернути щойно видалене фото"
          >
            ↻ Повернути
          </button>
        )}
      </div>
      {error && <div style={{ fontSize: 11, color: "#DC2626" }}>{error}</div>}
    </div>
  );

  return (
    <div style={{ fontFamily: ff }}>
      {!compact && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6, gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#1C3A2E", letterSpacing: "0.02em" }}>{label}</span>
          <span style={{ fontSize: 9.5, color: "#9B7C45" }}>{hint || `aspect ${aspectRatio.replace("/", ":")}`}</span>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }}
      />

      {compact ? (
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          {thumb}
          {sideFields}
        </div>
      ) : (
        <>
          {thumb}
          <div style={{ marginTop: 8 }}>{sideFields}</div>
        </>
      )}
    </div>
  );
}

// ── InfoTip (іконка ⓘ з hover-tooltip для пояснень полів) ───────────────────

/** Маленька «ⓘ» іконка біля підпису поля. При наведенні показує tooltip-картку
 *  з поясненням. Текст підтримує перенос рядка через `\n` або `&#10;`. */
export function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span
        role="img"
        aria-label="інформація"
        tabIndex={0}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: open ? "#1C3A2E" : "#E8D5B7",
          color: open ? "#D4A843" : "#1C3A2E",
          fontSize: 9,
          fontWeight: 800,
          cursor: "help",
          transition: "background 0.15s, color 0.15s",
          userSelect: "none",
          fontStyle: "italic",
          fontFamily: "Georgia, serif",
        }}
      >
        i
      </span>
      {open && (
        <span
          role="tooltip"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            zIndex: 50,
            minWidth: 260,
            maxWidth: 340,
            padding: "10px 12px",
            background: "#1C3A2E",
            color: "#FAF6F0",
            borderRadius: 8,
            fontSize: 11,
            lineHeight: 1.55,
            fontWeight: 400,
            fontFamily: ff,
            boxShadow: "0 8px 24px -6px rgba(0,0,0,0.35)",
            whiteSpace: "pre-line",
            letterSpacing: "0.01em",
            pointerEvents: "none",
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
}

// ── Section header (для group-divider у формі) ─────────────────────────────

export function SectionHeader({
  icon,
  title,
  subtitle,
  whereOnCard,
  hidden = false,
  onToggleHidden,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
}: {
  icon?: string;
  title: string;
  subtitle?: string;
  /** Підказка-tag «де саме на картці зʼявиться»: «фото overlay», «права панель»
   *  тощо. Зменшує когнітивне навантаження — менеджер одразу бачить звʼязок
   *  поля з місцем на превʼю. */
  whereOnCard?: string;
  /** Поточний стан видимості секції. true → візуальний `hidden` стиль (opacity
   *  + line-through на title), щоб менеджер бачив що блок не на картці. */
  hidden?: boolean;
  /** Toggle для show/hide. Якщо не передано — кнопка не показується. */
  onToggleHidden?: () => void;
  /** Reorder controls. Передаються лише для рухомих регіонів (movable). */
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}) {
  return (
    <div
      style={{
        marginTop: 14,
        marginBottom: 10,
        paddingBottom: 6,
        borderBottom: "1px solid #E8D5B7",
        fontFamily: ff,
        opacity: hidden ? 0.55 : 1,
        transition: "opacity 0.18s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {icon && <span style={{ fontSize: 15 }} aria-hidden>{icon}</span>}
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "#1C3A2E",
            letterSpacing: "0.02em",
            textDecoration: hidden ? "line-through" : "none",
          }}
        >
          {title}
        </span>
        {/* whereOnCard-чипи прибрано — дублюють інфо preview-підсвітки. */}
        {hidden && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              padding: "1px 7px",
              borderRadius: 999,
              background: "#F1F1ED",
              color: "#78716C",
              fontSize: 9.5,
              fontWeight: 600,
              letterSpacing: "0.02em",
            }}
          >
            не на картці
          </span>
        )}
        <div style={{ flex: 1 }} />
        {/* Reorder controls (тільки для movable регіонів) */}
        {(onMoveUp || onMoveDown) && (
          <div style={{ display: "inline-flex", gap: 3 }}>
            <button
              type="button"
              onClick={onMoveUp}
              disabled={!canMoveUp}
              title="Підняти вище"
              aria-label="Підняти секцію вище"
              style={sectionIconBtnStyle(!canMoveUp)}
            >↑</button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={!canMoveDown}
              title="Опустити нижче"
              aria-label="Опустити секцію нижче"
              style={sectionIconBtnStyle(!canMoveDown)}
            >↓</button>
          </div>
        )}
        {/* Show/hide toggle */}
        {onToggleHidden && (
          <button
            type="button"
            onClick={onToggleHidden}
            title={hidden ? "Показати на картці" : "Сховати з картки"}
            aria-label={hidden ? "Показати секцію" : "Сховати секцію"}
            style={{
              ...sectionIconBtnStyle(false),
              width: 28,
              background: hidden ? "#FFFFFF" : "#FAF6F0",
              color: hidden ? "#9B7C45" : "#1C3A2E",
            }}
          >
            {hidden ? "🚫" : "👁"}
          </button>
        )}
      </div>
      {subtitle && !hidden && (
        <div style={{ fontSize: 10.5, color: "#9B7C45", marginTop: 3, lineHeight: 1.35 }}>{subtitle}</div>
      )}
    </div>
  );
}

function sectionIconBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    width: 24,
    height: 24,
    borderRadius: 5,
    border: "1px solid #E8D5B7",
    background: "#FFFFFF",
    color: "#1C3A2E",
    fontSize: 11,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.35 : 1,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: ff,
    padding: 0,
    transition: "background 0.15s, opacity 0.15s",
  };
}
