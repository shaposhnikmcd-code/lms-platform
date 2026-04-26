"use client";

import { useRef, useState } from "react";
import { Block, UIMP_COLORS } from "../types";

const ff = "-apple-system, BlinkMacSystemFont, sans-serif";

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 10px", borderRadius: "6px",
  borderWidth: "1.5px", borderStyle: "solid", borderColor: "#E8D5B7",
  background: "#FAF6F0", fontSize: "13px", color: "#1C3A2E",
  fontFamily: ff, outline: "none", boxSizing: "border-box",
};

interface Props {
  block: Block;
  onChange: (data: Record<string, string>) => void;
  onUpload: (file: File) => Promise<string>;
}

export default function CardEditor({ block, onChange, onUpload }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const d = block.data;
  const set = (patch: Record<string, string>) => onChange({ ...d, ...patch });

  const title = d.title || "";
  const subtitle = d.subtitle || "";
  const buttonLabel = d.buttonLabel || "";
  const buttonHref = d.buttonHref || "";
  const bgColor = d.bgColor || "#1C3A2E";
  const bgImage = d.bgImage || "";
  const textColor = d.textColor || "#FAF6F0";
  const buttonBg = d.buttonBg || "#D4A843";
  const buttonColor = d.buttonColor || "#1C3A2E";
  const radius = Number(d.radius || "16");
  const align = d.cardAlign || "center";

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    const url = await onUpload(f);
    setUploading(false);
    if (url) set({ bgImage: url });
    e.target.value = "";
  };

  const swatch = (current: string, on: (c: string) => void, withTransparent = false) => (
    <div style={{ display: "inline-flex", gap: "3px", flexWrap: "wrap" }}>
      {withTransparent && (
        <button
          title="Без кольору"
          onClick={() => on("")}
          style={{
            width: "20px", height: "20px", borderRadius: "5px",
            border: `1.5px solid ${!current ? "#D4A843" : "#E8D5B7"}`,
            background: "repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%) 50% / 8px 8px",
            cursor: "pointer", padding: 0,
          }}
        />
      )}
      {UIMP_COLORS.filter(c => c.value).map(c => {
        const active = current.toUpperCase() === c.value.toUpperCase();
        return (
          <button
            key={c.value}
            title={c.label}
            onClick={() => on(c.value)}
            style={{
              width: "20px", height: "20px", borderRadius: "5px",
              border: `1.5px solid ${active ? "#D4A843" : "#E8D5B7"}`,
              background: c.value, cursor: "pointer", padding: 0,
              boxShadow: active ? "0 0 0 2px rgba(212,168,67,0.3)" : "none",
            }}
          />
        );
      })}
      <input
        type="color" value={current || "#000000"}
        onChange={(e) => on(e.target.value)}
        title="Свій колір"
        style={{ width: "24px", height: "20px", border: "1.5px solid #E8D5B7", borderRadius: "5px", padding: 0, background: "none", cursor: "pointer" }}
      />
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Live preview */}
      <div style={{
        position: "relative",
        borderRadius: `${radius}px`,
        overflow: "hidden",
        background: bgImage ? "transparent" : bgColor,
        minHeight: "180px",
        padding: "32px 24px",
        textAlign: align as "left" | "center" | "right",
        display: "flex", flexDirection: "column", justifyContent: "center",
        gap: "12px",
      }}>
        {bgImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bgImage} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }} />
        )}
        {bgImage && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 1 }} />
        )}
        <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", gap: "10px", alignItems: align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start" }}>
          {title && <div style={{ color: textColor, fontSize: "26px", fontWeight: 700, lineHeight: 1.2, fontFamily: ff }}>{title}</div>}
          {subtitle && <div style={{ color: textColor, fontSize: "14px", lineHeight: 1.5, fontFamily: ff, opacity: 0.9 }}>{subtitle}</div>}
          {buttonLabel && (
            <div style={{
              display: "inline-block", padding: "10px 24px", borderRadius: "8px",
              background: buttonBg, color: buttonColor,
              fontSize: "13px", fontWeight: 700, fontFamily: ff,
              letterSpacing: "0.04em",
            }}>{buttonLabel}</div>
          )}
        </div>
      </div>

      {/* Editor controls */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        <input style={inputStyle} placeholder="Заголовок" value={title} onChange={(e) => set({ title: e.target.value })} />
        <input style={inputStyle} placeholder="Підзаголовок" value={subtitle} onChange={(e) => set({ subtitle: e.target.value })} />
        <input style={inputStyle} placeholder="Текст кнопки (напр. Дізнатись більше)" value={buttonLabel} onChange={(e) => set({ buttonLabel: e.target.value })} />
        <input style={inputStyle} placeholder="URL кнопки (https://...)" value={buttonHref} onChange={(e) => set({ buttonHref: e.target.value })} />
      </div>

      {/* Style controls */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", padding: "10px 12px", background: "#FAF6F0", border: "1.5px solid #E8D5B7", borderRadius: "8px", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "10px", color: "#6B7280", fontWeight: 600 }}>Фон</span>
          {swatch(bgColor, (c) => set({ bgColor: c }))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "10px", color: "#6B7280", fontWeight: 600 }}>Текст</span>
          {swatch(textColor, (c) => set({ textColor: c }))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "10px", color: "#6B7280", fontWeight: 600 }}>Кнопка</span>
          {swatch(buttonBg, (c) => set({ buttonBg: c }))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "10px", color: "#6B7280", fontWeight: 600 }}>Текст кнопки</span>
          {swatch(buttonColor, (c) => set({ buttonColor: c }))}
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", padding: "10px 12px", background: "#FAF6F0", border: "1.5px solid #E8D5B7", borderRadius: "8px", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "10px", color: "#6B7280", fontWeight: 600 }}>Заокруглення</span>
          <input
            type="range" min={0} max={48} value={radius}
            onChange={(e) => set({ radius: e.target.value })}
            style={{ width: "120px", accentColor: "#D4A843" }}
          />
          <span style={{ fontSize: "11px", fontWeight: 600, color: "#1C3A2E", minWidth: "28px" }}>{radius}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span style={{ fontSize: "10px", color: "#6B7280", fontWeight: 600 }}>Вирівнювання</span>
          {(["left", "center", "right"] as const).map((a, i) => {
            const active = align === a;
            return (
              <button
                key={a}
                onClick={() => set({ cardAlign: a })}
                style={{
                  padding: "5px 10px", borderRadius: "6px",
                  border: `1.5px solid ${active ? "#D4A843" : "#E8D5B7"}`,
                  background: active ? "#1C3A2E" : "#fff",
                  color: active ? "#D4A843" : "#1C3A2E",
                  fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: ff,
                }}
              >{["←", "↔", "→"][i]}</button>
            );
          })}
        </div>

        {/* Background image */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "auto" }}>
          <span style={{ fontSize: "10px", color: "#6B7280", fontWeight: 600 }}>Фото-фон</span>
          {bgImage ? (
            <>
              <span style={{ fontSize: "10px", color: "#1C3A2E", maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bgImage.split("/").pop()}</span>
              <button
                onClick={() => set({ bgImage: "" })}
                title="Прибрати фото"
                style={{
                  padding: "4px 8px", borderRadius: "5px", border: "none",
                  background: "#EF4444", color: "#fff", fontSize: "11px", cursor: "pointer", fontWeight: 600,
                }}
              >✕</button>
            </>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              style={{
                padding: "5px 10px", borderRadius: "6px",
                border: "1.5px solid #E8D5B7", background: "#fff", color: "#1C3A2E",
                fontSize: "11px", fontWeight: 600, cursor: uploading ? "wait" : "pointer", fontFamily: ff,
              }}
            >{uploading ? "Завантаження…" : "🖼 Додати"}</button>
          )}
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleBgUpload} />
        </div>
      </div>
    </div>
  );
}
