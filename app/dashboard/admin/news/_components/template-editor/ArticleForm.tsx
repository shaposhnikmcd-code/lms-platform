"use client";

// Form для ARTICLE template-новини.
// Поля типізовані 1:1 до ArticleData (lib/news/templates/types.ts).

import React from "react";
import type { ArticleData, ArticleSection } from "@/lib/news/templates/types";
import { TextInput, TextAreaInput, ImageInput, SectionHeader } from "./Inputs";

interface Props {
  data: ArticleData;
  onChange: (next: ArticleData) => void;
}

export default function ArticleForm({ data, onChange }: Props) {
  const update = <K extends keyof ArticleData>(key: K, value: ArticleData[K]) => {
    onChange({ ...data, [key]: value });
  };

  const updateSection = (idx: number, patch: Partial<ArticleSection>) => {
    const next = data.sections.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    onChange({ ...data, sections: next });
  };

  const addSection = () => {
    onChange({
      ...data,
      sections: [
        ...data.sections,
        { heading: "Новий розділ", body: "Текст розділу..." },
      ],
    });
  };

  const removeSection = (idx: number) => {
    onChange({ ...data, sections: data.sections.filter((_, i) => i !== idx) });
  };

  const moveSection = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= data.sections.length) return;
    const next = [...data.sections];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange({ ...data, sections: next });
  };

  const toggleSectionImage = (idx: number) => {
    const s = data.sections[idx];
    if (s.image) {
      updateSection(idx, { image: undefined });
    } else {
      updateSection(idx, { image: { url: "", alt: "", caption: "" } });
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionHeader icon="🖼" title="Cover" subtitle="Hero-фото статті, 16:9. Будь-яка картинка вписується у слот без витискання." />
      <ImageInput
        label="Головне фото"
        value={data.cover}
        onChange={v => update("cover", v)}
        aspectRatio="16/9"
      />

      <SectionHeader icon="✍️" title="Заголовок та лід" />
      <TextInput
        label="Eyebrow / категорія"
        value={data.category}
        onChange={v => update("category", v)}
        placeholder="СТАТТЯ · 5 ХВ ЧИТАННЯ"
        hint="мала uppercase лейбл над title"
        maxLength={60}
      />
      <TextInput
        label="Заголовок"
        value={data.title}
        onChange={v => update("title", v)}
        placeholder="Заголовок статті"
        maxLength={120}
      />
      <TextAreaInput
        label="Лід"
        value={data.lead}
        onChange={v => update("lead", v)}
        placeholder="Короткий підзаголовок, 1-2 речення."
        rows={3}
        maxLength={280}
      />

      <SectionHeader
        icon="📑"
        title={`Розділи (${data.sections.length})`}
        subtitle="H2 + body. До body можна додати ілюстрацію 4:3 із підписом."
      />
      {data.sections.map((s, idx) => (
        <div
          key={idx}
          style={{
            background: "#FAF6F0",
            border: "1px solid #E8D5B7",
            borderRadius: 12,
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {/* Section toolbar */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: -4 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#9B7C45",
                fontFamily: "Inter, system-ui, -apple-system, sans-serif",
              }}
            >
              Розділ {idx + 1}
            </span>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              onClick={() => moveSection(idx, -1)}
              disabled={idx === 0}
              title="Вгору"
              style={iconBtnStyle(idx === 0)}
            >↑</button>
            <button
              type="button"
              onClick={() => moveSection(idx, 1)}
              disabled={idx === data.sections.length - 1}
              title="Вниз"
              style={iconBtnStyle(idx === data.sections.length - 1)}
            >↓</button>
            <button
              type="button"
              onClick={() => toggleSectionImage(idx)}
              title={s.image ? "Прибрати фото" : "Додати фото"}
              style={iconBtnStyle(false, s.image ? "#1C3A2E" : undefined)}
            >🖼</button>
            <button
              type="button"
              onClick={() => removeSection(idx)}
              title="Видалити розділ"
              style={{ ...iconBtnStyle(false), borderColor: "#FECACA", color: "#B91C1C" }}
            >✕</button>
          </div>

          <TextInput
            label="Заголовок розділу"
            value={s.heading}
            onChange={v => updateSection(idx, { heading: v })}
            placeholder="Назва розділу"
            maxLength={120}
          />
          <TextAreaInput
            label="Тіло"
            value={s.body}
            onChange={v => updateSection(idx, { body: v })}
            placeholder="Параграфи через порожній рядок..."
            rows={6}
            hint="нові абзаци через порожній рядок (Enter Enter)"
          />
          {s.image && (
            <ImageInput
              label="Ілюстрація"
              value={s.image}
              onChange={img => updateSection(idx, { image: img })}
              aspectRatio="4/3"
              withCaption
            />
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={addSection}
        style={{
          padding: "12px 16px",
          fontSize: 13,
          fontWeight: 600,
          fontFamily: "Inter, system-ui, -apple-system, sans-serif",
          background: "#FFFFFF",
          color: "#1C3A2E",
          border: "1.5px dashed #D4A843",
          borderRadius: 10,
          cursor: "pointer",
          transition: "all 0.15s",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = "#FAF6F0";
          e.currentTarget.style.borderStyle = "solid";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = "#FFFFFF";
          e.currentTarget.style.borderStyle = "dashed";
        }}
      >
        + Додати розділ
      </button>

      <SectionHeader icon="💬" title="Pull-quote" subtitle="Ключова цитата між секціями. Порожнє → не рендериться." />
      <TextAreaInput
        label="Цитата"
        value={data.pullquote}
        onChange={v => update("pullquote", v)}
        placeholder="Ключова думка, що ловить увагу..."
        rows={3}
        maxLength={300}
      />

      <SectionHeader icon="🎯" title="Висновки" />
      <TextAreaInput
        label="Підсумок"
        value={data.conclusion}
        onChange={v => update("conclusion", v)}
        placeholder="2-3 ключові тези + наступний крок."
        rows={4}
      />

      <SectionHeader icon="✒️" title="Footer" />
      <TextInput
        label="Author / контакт / джерела"
        value={data.authorLine}
        onChange={v => update("authorLine", v)}
        placeholder="Автор · контакт · джерела"
        maxLength={200}
      />
    </div>
  );
}

function iconBtnStyle(disabled: boolean, color?: string): React.CSSProperties {
  return {
    width: 28,
    height: 28,
    borderRadius: 6,
    border: "1px solid #E8D5B7",
    background: "#FFFFFF",
    color: color || "#1C3A2E",
    fontSize: 13,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.4 : 1,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "Inter, system-ui, -apple-system, sans-serif",
    padding: 0,
  };
}
