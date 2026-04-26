"use client";

import React, { useRef, useState } from "react";
import { NewsMeta, UIMP_COLORS } from "./types";

const ff = "-apple-system, BlinkMacSystemFont, sans-serif";

const cardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: "14px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "#E8D5B7",
  overflow: "hidden",
  boxShadow: "0 2px 12px rgba(28,58,46,0.06)",
};

const cardHeaderStyle: React.CSSProperties = {
  padding: "11px 16px",
  background: "#1C3A2E",
  fontSize: "9px",
  fontWeight: 800,
  color: "#D4A843",
  letterSpacing: "0.15em",
  textTransform: "uppercase",
  fontFamily: ff,
};

const cardBodyStyle: React.CSSProperties = {
  padding: "16px",
  display: "flex",
  flexDirection: "column",
  gap: "14px",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "10px",
  fontWeight: 700,
  color: "#1C3A2E",
  marginBottom: "5px",
  textTransform: "uppercase",
  letterSpacing: "0.07em",
  fontFamily: ff,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: "8px",
  borderWidth: "1.5px",
  borderStyle: "solid",
  borderColor: "#E8D5B7",
  background: "#FAF6F0",
  fontSize: "13px",
  color: "#1C3A2E",
  fontFamily: ff,
  outline: "none",
  boxSizing: "border-box",
};

interface Props {
  meta: NewsMeta;
  onChange: (meta: NewsMeta) => void;
  onUpload: (file: File) => Promise<string>;
}

export default function MetaSidebar({ meta, onChange, onUpload }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const generateSlug = (text: string) =>
    text.toLowerCase().trim()
      .replace(/[а-яёїієґ]/g, (c) => ({ а:"a",б:"b",в:"v",г:"h",ґ:"g",д:"d",е:"e",є:"ie",ж:"zh",з:"z",и:"y",і:"i",ї:"i",й:"j",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"kh",ц:"ts",ч:"ch",ш:"sh",щ:"shch",ь:"",ю:"iu",я:"ia",ё:"yo" }[c] || c))
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");

  const handleTitleChange = (val: string) => {
    onChange({ ...meta, title: val, slug: meta.slug || generateSlug(val) });
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const url = await onUpload(file);
    setUploading(false);
    if (url) onChange({ ...meta, imageUrl: url });
    e.target.value = "";
  };

  return (
    <div style={{ width: "260px", minWidth: "260px", display: "flex", flexDirection: "column", gap: "16px" }}>

      <div style={cardStyle}>
        <div style={cardHeaderStyle}>{"Публікація"}</div>
        <div style={cardBodyStyle}>
          <div>
            <label style={labelStyle}>{"Заголовок"}</label>
            <input style={inputStyle} value={meta.title} onChange={e => handleTitleChange(e.target.value)} placeholder="Назва новини" />
          </div>
          <div>
            <label style={labelStyle}>{"Slug (URL)"}</label>
            <input style={inputStyle} value={meta.slug} onChange={e => onChange({ ...meta, slug: e.target.value })} placeholder="nazva-novyny" />
          </div>
          <div>
            <label style={labelStyle}>{"Короткий опис"}</label>
            <textarea
              style={{ ...inputStyle, resize: "vertical", minHeight: "80px" }}
              value={meta.excerpt}
              onChange={e => onChange({ ...meta, excerpt: e.target.value })}
              placeholder="Короткий опис для картки новини"
            />
          </div>
          <div>
            <label style={labelStyle}>{"Категорія"}</label>
            <select
              style={{ ...inputStyle, cursor: "pointer" }}
              value={meta.category}
              onChange={e => onChange({ ...meta, category: e.target.value as NewsMeta["category"] })}
            >
              <option value="NEWS">{"Новина"}</option>
              <option value="ANNOUNCEMENT">{"Анонс"}</option>
              <option value="ARTICLE">{"Стаття"}</option>
              <option value="EVENT">{"Подія"}</option>
            </select>
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={cardHeaderStyle}>{"Фон сторінки новини"}</div>
        <div style={cardBodyStyle}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
            {/* Дефолтний (білий) */}
            <button
              type="button"
              title="Білий (за замовчуванням)"
              onClick={() => onChange({ ...meta, pageBgColor: "" })}
              style={{
                width: "26px", height: "26px", borderRadius: "6px",
                border: `1.5px solid ${!meta.pageBgColor ? "#D4A843" : "#E8D5B7"}`,
                background: "#FFFFFF",
                cursor: "pointer", padding: 0,
                boxShadow: !meta.pageBgColor ? "0 0 0 2px rgba(212,168,67,0.3)" : "none",
              }}
            />
            {UIMP_COLORS.filter(c => c.value && c.value !== "#FFFFFF").map(c => {
              const active = (meta.pageBgColor || "").toUpperCase() === c.value.toUpperCase();
              return (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  onClick={() => onChange({ ...meta, pageBgColor: c.value })}
                  style={{
                    width: "26px", height: "26px", borderRadius: "6px",
                    border: `1.5px solid ${active ? "#D4A843" : "#E8D5B7"}`,
                    background: c.value, cursor: "pointer", padding: 0,
                    boxShadow: active ? "0 0 0 2px rgba(212,168,67,0.3)" : "none",
                  }}
                />
              );
            })}
            <input
              type="color"
              value={meta.pageBgColor || "#FFFFFF"}
              onChange={(e) => onChange({ ...meta, pageBgColor: e.target.value })}
              title="Свій колір"
              style={{ width: "30px", height: "26px", border: "1.5px solid #E8D5B7", borderRadius: "6px", padding: 0, background: "none", cursor: "pointer" }}
            />
          </div>
          <div style={{ fontSize: "10px", color: "#9CA3AF", lineHeight: 1.4, fontFamily: ff }}>
            {"Колір білого контейнера, в якому розміщено блоки новини."}
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={cardHeaderStyle}>{"Обкладинка"}</div>
        <div style={cardBodyStyle}>
          {meta.imageUrl ? (
            <div style={{ position: "relative" }}>
              <img
                src={meta.imageUrl}
                alt="cover"
                style={{ width: "100%", borderRadius: "8px", display: "block" }}
              />
              <button
                onClick={() => onChange({ ...meta, imageUrl: "" })}
                style={{ position: "absolute", top: "6px", right: "6px", background: "#EF4444", color: "#fff", border: "none", borderRadius: "5px", padding: "3px 8px", cursor: "pointer", fontSize: "11px", fontWeight: 700 }}
              >{"✕"}</button>
            </div>
          ) : (
            <div
              onClick={() => fileRef.current?.click()}
              style={{ borderWidth: "2px", borderStyle: "dashed", borderColor: "#D4A843", borderRadius: "10px", padding: "24px 16px", textAlign: "center", cursor: "pointer", color: "#9CA3AF", fontSize: "12px", background: "#FAF6F0", fontFamily: ff }}
            >
              {uploading ? "Завантаження..." : "🖼 Завантажити обкладинку"}
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleCoverUpload} />
        </div>
      </div>
    </div>
  );
}