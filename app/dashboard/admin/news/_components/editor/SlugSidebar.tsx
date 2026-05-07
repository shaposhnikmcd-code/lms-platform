"use client";

import React from "react";
import { NewsMeta } from "./types";
import { transliterateUA } from "@/lib/translate";

// Транслітеруємо UA → латиницю, прибираємо все крім [a-z0-9-] і нормалізуємо тире.
function slugifyTitle(title: string): string {
  return transliterateUA(title)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

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

/// Правий бар білдера превʼю-картки. Slug + Заголовок + Короткий опис.
/// Заголовок і опис використовуються в hero-хедері сторінки `/news/{slug}` —
/// вони потрібні коли на сторінці /news менеджер розміщує превʼю (клік → перехід
/// на саму новину з hero). Якщо менеджер розміщує тільки повну новину (expanded),
/// hero з title+excerpt не показується, тому ці поля можна не заповнювати.
/// Обкладинка hero-у автоматично береться з першого image-блока на канвасі.
export default function SlugSidebar({ meta, onChange }: Props) {
  // Slug автозаповнюється з title до того моменту, як користувач його руками
  // НЕ змінив (щоб не перетирати кастомний URL після додаткового редагування
  // заголовку). Лічильник: якщо поточний slug = slugifyTitle(попередній_title)
  // АБО slug порожній — слідуємо за title. Інакше — користувач його кастомізував.
  const slugManuallyEditedRef = React.useRef(false);
  const lastTitleSyncedRef = React.useRef(meta.title || "");

  // На init: якщо в БД slug відрізняється від slugify(title), вважаємо що
  // користувач його колись редагував вручну → не overwrite-имо.
  React.useEffect(() => {
    if (meta.slug && meta.title && meta.slug !== slugifyTitle(meta.title)) {
      slugManuallyEditedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTitleChange = (newTitle: string) => {
    const next: NewsMeta = { ...meta, title: newTitle };
    if (!slugManuallyEditedRef.current) {
      next.slug = slugifyTitle(newTitle);
    }
    lastTitleSyncedRef.current = newTitle;
    onChange(next);
  };

  const handleSlugChange = (newSlug: string) => {
    slugManuallyEditedRef.current = true;
    onChange({ ...meta, slug: newSlug });
  };

  return (
    <div style={{ width: "240px", minWidth: "240px", display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={cardStyle}>
        <div style={cardHeaderStyle}>{"Заголовок"}</div>
        <div style={cardBodyStyle}>
          <input
            style={inputStyle}
            value={meta.title}
            onChange={e => handleTitleChange(e.target.value)}
            placeholder="Заголовок новини"
          />
          <p style={hintStyle}>
            Показується в <strong>hero-хедері</strong> сторінки{" "}
            <code style={{ background: "#F3F0E8", padding: "1px 4px", borderRadius: "3px" }}>/news/{meta.slug || "..."}</code>{" "}
            (коли користувач клікає по превʼю на /news).
          </p>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={cardHeaderStyle}>{"Короткий опис"}</div>
        <div style={cardBodyStyle}>
          <textarea
            style={{ ...inputStyle, minHeight: "60px", resize: "vertical", fontFamily: ff, lineHeight: 1.45 }}
            value={meta.excerpt || ""}
            onChange={e => onChange({ ...meta, excerpt: e.target.value })}
            placeholder="Опис під заголовком у hero"
            rows={3}
          />
          <p style={hintStyle}>
            Підзаголовок під назвою новини в hero. Також іде в{" "}
            <code style={{ background: "#F3F0E8", padding: "1px 4px", borderRadius: "3px" }}>og:description</code>{" "}
            для соцмереж.
          </p>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={cardHeaderStyle}>{"URL"}</div>
        <div style={cardBodyStyle}>
          <div>
            <label style={labelStyle}>{"Slug (URL)"}</label>
            <input
              style={inputStyle}
              value={meta.slug}
              onChange={e => handleSlugChange(e.target.value)}
              placeholder="nazva-novyny"
            />
            <p style={{ ...hintStyle, marginTop: "6px" }}>
              Адреса статті:{" "}
              <code style={{ background: "#F3F0E8", padding: "1px 4px", borderRadius: "3px" }}>/news/{meta.slug || "..."}</code>
            </p>
          </div>
          <div style={{ ...hintStyle, paddingTop: "4px", borderTop: "1px dashed #E8D5B7" }}>
            <strong>Обкладинка</strong> hero-у автоматично береться з першого image-блока на канвасі.
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={cardHeaderStyle}>{"Хто та коли розмістив"}</div>
        <div style={cardBodyStyle}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, color: "#1C3A2E", fontFamily: ff }}>
            <input
              type="checkbox"
              checked={!!meta.showAuthorMeta}
              onChange={e => onChange({ ...meta, showAuthorMeta: e.target.checked })}
              style={{ width: 14, height: 14, accentColor: "#1C3A2E", cursor: "pointer" }}
            />
            <span>Показувати дату та автора в hero</span>
          </label>
          <p style={hintStyle}>
            За замовчуванням приховано. Увімкни, щоб під заголовком новини зʼявились дата публікації та імʼя автора.
          </p>
        </div>
      </div>
    </div>
  );
}
