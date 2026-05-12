"use client";

// Form для ARTICLE template-новини.
// Поля типізовані 1:1 до ArticleData (lib/news/templates/types.ts).
// Field↔region zoning через RegionGroup wrap-и (paralelno EventForm).

import React from "react";
import type { ArticleData, ArticleSection } from "@/lib/news/templates/types";
import type { ArticleRegion } from "@/lib/news/templates/ArticleTemplate";
import { TextInput, TextAreaInput, ImageInput, SectionHeader } from "./Inputs";

interface Props {
  data: ArticleData;
  onChange: (next: ArticleData) => void;
  /** Callback при фокусі поля. Передає region-id або null (на blur).
   *  Виставляє підсвітку відповідного блоку у ArticleTemplate preview. */
  onFocusRegion?: (region: ArticleRegion | null) => void;
}

// Wrapper-секція з focus-event-делегуванням (capture). Будь-яке поле всередині
// при фокусі тригерить `onFocusRegion(region)`, на blur — null. Те саме як в
// EventForm — єдина мапа поведінки.
function RegionGroup({
  region,
  onFocusRegion,
  children,
}: {
  region: ArticleRegion;
  onFocusRegion?: (region: ArticleRegion | null) => void;
  children: React.ReactNode;
}) {
  if (!onFocusRegion) return <>{children}</>;
  return (
    <div
      onFocusCapture={() => onFocusRegion(region)}
      onBlurCapture={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        onFocusRegion(null);
      }}
    >
      {children}
    </div>
  );
}

export default function ArticleForm({ data, onChange, onFocusRegion }: Props) {
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
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <RegionGroup region="cover" onFocusRegion={onFocusRegion}>
        <SectionHeader icon="🖼" title="Cover" whereOnCard="hero, 16:9" />
        <ImageInput
          label="Головне фото"
          value={data.cover}
          onChange={v => update("cover", v)}
          aspectRatio="16/9"
          maxPreviewWidth={200}
        />
      </RegionGroup>

      <RegionGroup region="header" onFocusRegion={onFocusRegion}>
        <SectionHeader icon="✍️" title="Заголовок та лід" whereOnCard="header, центр" />
        <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 8 }}>
          <TextInput
            label="Eyebrow / категорія"
            value={data.category}
            onChange={v => update("category", v)}
            placeholder="СТАТТЯ · 5 ХВ"
            hint="caps над title"
            maxLength={60}
          />
          <TextInput
            label="Заголовок"
            value={data.title}
            onChange={v => update("title", v)}
            placeholder="Заголовок статті"
            maxLength={120}
          />
        </div>
        <div style={{ marginTop: 8 }}>
          <TextAreaInput
            label="Лід"
            value={data.lead}
            onChange={v => update("lead", v)}
            placeholder="Короткий підзаголовок, 1-2 речення."
            rows={2}
            maxLength={280}
            hint="italic під title"
          />
        </div>
      </RegionGroup>

      <RegionGroup region="sections" onFocusRegion={onFocusRegion}>
        <SectionHeader
          icon="📑"
          title={`Розділи (${data.sections.length})`}
          whereOnCard="body статті"
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {data.sections.map((s, idx) => (
            <div
              key={idx}
              style={{
                background: "#FAF6F0",
                border: "1px solid #E8D5B7",
                borderRadius: 8,
                padding: "8px 10px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {/* Toolbar: index + actions inline */}
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#9B7C45",
                    fontFamily: "Inter, system-ui, -apple-system, sans-serif",
                    minWidth: 22,
                  }}
                >
                  {idx + 1}.
                </span>
                <input
                  type="text"
                  value={s.heading}
                  onChange={e => updateSection(idx, { heading: e.target.value })}
                  placeholder="Заголовок розділу (H2)"
                  maxLength={120}
                  style={inlineInputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = "#D4A843")}
                  onBlur={e => (e.currentTarget.style.borderColor = "#E8D5B7")}
                />
                <div style={{ display: "flex", gap: 3 }}>
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
                    title={s.image ? "Прибрати фото" : "Додати фото 4:3"}
                    style={{
                      ...iconBtnStyle(false),
                      background: s.image ? "#1C3A2E" : "#FFFFFF",
                      color: s.image ? "#F5E1A4" : "#1C3A2E",
                      borderColor: s.image ? "#1C3A2E" : "#E8D5B7",
                    }}
                  >🖼</button>
                  <button
                    type="button"
                    onClick={() => removeSection(idx)}
                    title="Видалити розділ"
                    style={{ ...iconBtnStyle(false), borderColor: "#FECACA", color: "#B91C1C" }}
                  >✕</button>
                </div>
              </div>
              <TextAreaInput
                label="Тіло"
                value={s.body}
                onChange={v => updateSection(idx, { body: v })}
                placeholder="Параграфи через порожній рядок..."
                rows={3}
                hint="Enter Enter = новий абзац"
              />
              {s.image && (
                <ImageInput
                  label="Ілюстрація"
                  value={s.image}
                  onChange={img => updateSection(idx, { image: img })}
                  aspectRatio="4/3"
                  withCaption
                  maxPreviewWidth={140}
                />
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addSection}
            style={{
              padding: "7px 12px",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "Inter, system-ui, -apple-system, sans-serif",
              background: "#FFFFFF",
              color: "#1C3A2E",
              border: "1.5px dashed #D4A843",
              borderRadius: 8,
              cursor: "pointer",
              transition: "all 0.15s",
              alignSelf: "flex-start",
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
        </div>
      </RegionGroup>

      <RegionGroup region="pullquote" onFocusRegion={onFocusRegion}>
        <SectionHeader icon="💬" title="Pull-quote" whereOnCard="між розділами" />
        <TextAreaInput
          label="Цитата"
          value={data.pullquote}
          onChange={v => update("pullquote", v)}
          placeholder="Ключова думка, що ловить увагу..."
          rows={2}
          maxLength={300}
          hint="порожнє → не рендериться"
        />
      </RegionGroup>

      <RegionGroup region="conclusion" onFocusRegion={onFocusRegion}>
        <SectionHeader icon="🎯" title="Висновки" whereOnCard="низ статті" />
        <TextAreaInput
          label="Підсумок"
          value={data.conclusion}
          onChange={v => update("conclusion", v)}
          placeholder="2-3 ключові тези + наступний крок."
          rows={3}
        />
      </RegionGroup>

      <RegionGroup region="author" onFocusRegion={onFocusRegion}>
        <SectionHeader icon="✒️" title="Footer" whereOnCard="підпис унизу" />
        <TextInput
          label="Author / контакт / джерела"
          value={data.authorLine}
          onChange={v => update("authorLine", v)}
          placeholder="Автор · контакт · джерела"
          maxLength={200}
        />
      </RegionGroup>
    </div>
  );
}

const inlineInputStyle: React.CSSProperties = {
  flex: 1,
  padding: "6px 10px",
  fontSize: 13,
  fontWeight: 600,
  fontFamily: "Inter, system-ui, -apple-system, sans-serif",
  color: "#1C1917",
  background: "#FFFFFF",
  border: "1.5px solid #E8D5B7",
  borderRadius: 6,
  outline: "none",
  transition: "border-color 0.15s",
};

function iconBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    width: 24,
    height: 26,
    borderRadius: 5,
    border: "1px solid #E8D5B7",
    background: "#FFFFFF",
    color: "#1C3A2E",
    fontSize: 11,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.4 : 1,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "Inter, system-ui, -apple-system, sans-serif",
    padding: 0,
  };
}
