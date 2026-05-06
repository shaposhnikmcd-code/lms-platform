"use client";

import React from "react";
import { NewsMeta } from "./types";

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
  padding: "7px 12px",
  background: "#1C3A2E",
  fontSize: "9px",
  fontWeight: 800,
  color: "#D4A843",
  letterSpacing: "0.15em",
  textTransform: "uppercase",
  fontFamily: ff,
};

const cardBodyStyle: React.CSSProperties = {
  padding: "10px 12px",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "10px",
  fontWeight: 700,
  color: "#1C3A2E",
  marginBottom: "3px",
  textTransform: "uppercase",
  letterSpacing: "0.07em",
  fontFamily: ff,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 10px",
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

const hintStyle: React.CSSProperties = {
  fontSize: "10px",
  color: "#9B7C45",
  lineHeight: 1.4,
  fontFamily: ff,
};

interface Props {
  meta: NewsMeta;
  onChange: (meta: NewsMeta) => void;
}

/// Спрощений правий бар для білдера превʼю-картки. Лишився тільки Slug —
/// заголовок та обкладинка автоматично витягуються з канвасу (перший
/// heading- та image-блок), решта meta-полів (excerpt/category/pageBgColor)
/// тут не редагується (збережене попереднє значення з БД лишається).
export default function SlugSidebar({ meta, onChange }: Props) {
  return (
    <div style={{ width: "200px", minWidth: "200px", display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={cardStyle}>
        <div style={cardHeaderStyle}>{"URL"}</div>
        <div style={cardBodyStyle}>
          <div>
            <label style={labelStyle}>{"Slug (URL)"}</label>
            <input
              style={inputStyle}
              value={meta.slug}
              onChange={e => onChange({ ...meta, slug: e.target.value })}
              placeholder="nazva-novyny"
            />
            <p style={{ ...hintStyle, marginTop: "6px" }}>
              Адреса статті: <code style={{ background: "#F3F0E8", padding: "1px 4px", borderRadius: "3px" }}>/news/{meta.slug || "..."}</code>
            </p>
          </div>
          <div style={{ ...hintStyle, paddingTop: "4px", borderTop: "1px dashed #E8D5B7" }}>
            <strong>Заголовок</strong> та <strong>обкладинка</strong> автоматично беруться з канвасу — перший heading-блок і перший image-блок.
          </div>
        </div>
      </div>
    </div>
  );
}
