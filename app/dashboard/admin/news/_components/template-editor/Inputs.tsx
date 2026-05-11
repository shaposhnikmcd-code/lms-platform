"use client";

// Reusable form-primitives для template editor-а.
// Стиль — узгоджений з адмінкою (#1C3A2E акцент, #FAF6F0 фон, #E8D5B7 рамка).

import React, { useRef, useState } from "react";

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
          padding: "10px 12px",
          fontSize: 14,
          fontFamily: ff,
          color: "#1C1917",
          background: "#FFFFFF",
          border: "1.5px solid #E8D5B7",
          borderRadius: 8,
          outline: "none",
          transition: "border-color 0.15s",
        }}
        onFocus={e => (e.currentTarget.style.borderColor = "#D4A843")}
        onBlur={e => (e.currentTarget.style.borderColor = "#E8D5B7")}
      />
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
          padding: "10px 12px",
          fontSize: 14,
          fontFamily: ff,
          color: "#1C1917",
          background: "#FFFFFF",
          border: "1.5px solid #E8D5B7",
          borderRadius: 8,
          outline: "none",
          resize: "vertical",
          minHeight: 80,
          lineHeight: 1.55,
          transition: "border-color 0.15s",
        }}
        onFocus={e => (e.currentTarget.style.borderColor = "#D4A843")}
        onBlur={e => (e.currentTarget.style.borderColor = "#E8D5B7")}
      />
    </label>
  );
}

// ── Field header (label + counter + hint) ───────────────────────────────────

function FieldHeader({ label, hint, value, maxLength }: { label: string; hint?: string; value: string; maxLength?: number }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "#1C3A2E", letterSpacing: "0.02em" }}>{label}</span>
      <span style={{ fontSize: 10, color: "#9B7C45", fontStyle: hint ? "normal" : "italic" }}>
        {hint
          ? hint
          : maxLength
            ? `${value.length} / ${maxLength}`
            : ""}
      </span>
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
}

export function ImageInput({ label, value, onChange, aspectRatio, withCaption = false, hint }: ImageInputProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div style={{ fontFamily: ff }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#1C3A2E", letterSpacing: "0.02em" }}>{label}</span>
        <span style={{ fontSize: 10, color: "#9B7C45" }}>{hint || `aspect ${aspectRatio.replace("/", ":")}`}</span>
      </div>

      {/* Preview thumbnail with fixed aspect ratio */}
      <div
        style={{
          width: "100%",
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
            {/* hover overlay with replace */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(28,58,46,0.45)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 600,
                opacity: 0,
                transition: "opacity 0.18s",
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "0")}
            >
              {uploading ? "Завантаження..." : "Замінити фото"}
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
              gap: 6,
              color: "#9B7C45",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <span style={{ fontSize: 28 }} aria-hidden>🖼</span>
            <span>{uploading ? "Завантаження..." : "Натисніть, щоб завантажити фото"}</span>
            <span style={{ fontSize: 11, fontWeight: 400, color: "#A8956C" }}>JPG / PNG / WebP, до 8 MB</span>
          </div>
        )}
      </div>

      {error && (
        <div style={{ fontSize: 11, color: "#DC2626", marginTop: 6 }}>{error}</div>
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

      <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="text"
          value={value.alt || ""}
          onChange={e => onChange({ ...value, alt: e.target.value })}
          placeholder="Alt-текст (для accessibility і SEO)"
          style={{
            flex: 1,
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
        {value.url && (
          <button
            type="button"
            onClick={() => onChange({ url: "", alt: "", caption: "" })}
            style={{
              padding: "6px 10px",
              fontSize: 11,
              border: "1px solid #FECACA",
              background: "#FFFFFF",
              color: "#B91C1C",
              borderRadius: 6,
              cursor: "pointer",
              fontFamily: ff,
            }}
            title="Прибрати фото"
          >
            Очистити
          </button>
        )}
      </div>

      {withCaption && (
        <input
          type="text"
          value={value.caption || ""}
          onChange={e => onChange({ ...value, caption: e.target.value })}
          placeholder="Підпис під фото (italic)"
          style={{
            marginTop: 8,
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
      )}
    </div>
  );
}

// ── Section header (для group-divider у формі) ─────────────────────────────

export function SectionHeader({
  icon,
  title,
  subtitle,
  whereOnCard,
}: {
  icon?: string;
  title: string;
  subtitle?: string;
  /** Підказка-tag «де саме на картці зʼявиться»: «фото overlay», «права панель»
   *  тощо. Зменшує когнітивне навантаження — менеджер одразу бачить звʼязок
   *  поля з місцем на превʼю. */
  whereOnCard?: string;
}) {
  return (
    <div
      style={{
        marginTop: 28,
        marginBottom: 16,
        paddingBottom: 10,
        borderBottom: "1px solid #E8D5B7",
        fontFamily: ff,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {icon && <span style={{ fontSize: 16 }} aria-hidden>{icon}</span>}
        <span style={{ fontSize: 14, fontWeight: 700, color: "#1C3A2E", letterSpacing: "0.02em" }}>{title}</span>
        {whereOnCard && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 8px",
              borderRadius: 999,
              background: "#F5E1A4",
              color: "#5C4513",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
            title={`Куди це піде на картці: ${whereOnCard}`}
          >
            <span aria-hidden>↗</span>
            {whereOnCard}
          </span>
        )}
      </div>
      {subtitle && (
        <div style={{ fontSize: 11, color: "#9B7C45", marginTop: 4, lineHeight: 1.4 }}>{subtitle}</div>
      )}
    </div>
  );
}
