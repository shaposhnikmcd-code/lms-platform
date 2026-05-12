"use client";

// Form для EVENT template-новини. Поля 1:1 до EventData (нова структура:
// фото фахівця + overlay-info + 2-секції про спеціаліста та освіту).

import React from "react";
import type { EventData, EventEducationItem, EventRegionKey } from "@/lib/news/templates/types";
import type { EventRegion } from "@/lib/news/templates/EventTemplate";
import { TextInput, TextAreaInput, ImageInput, SectionHeader } from "./Inputs";

interface Props {
  data: EventData;
  onChange: (next: EventData) => void;
  /** Callback при фокусі поля. Передає region-id або null (на blur).
   *  Виставляє підсвітку відповідного блоку у preview-картці. */
  onFocusRegion?: (region: EventRegion | null) => void;
}

// Wrapper-секція з focus-event-делегуванням: будь-яке поле всередині при
// фокусі тригерить `onFocusRegion(region)`, на blur — `onFocusRegion(null)`.
// Використовується event capturing — щоб працювало для inputs усередині.
function RegionGroup({
  region,
  onFocusRegion,
  children,
}: {
  region: EventRegion;
  onFocusRegion?: (region: EventRegion | null) => void;
  children: React.ReactNode;
}) {
  if (!onFocusRegion) return <>{children}</>;
  return (
    <div
      onFocusCapture={() => onFocusRegion(region)}
      onBlurCapture={(e) => {
        // Якщо focus переходить у дочірній елемент тієї ж групи — не скидаємо.
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        onFocusRegion(null);
      }}
    >
      {children}
    </div>
  );
}

export default function EventForm({ data, onChange, onFocusRegion }: Props) {
  const update = <K extends keyof EventData>(key: K, value: EventData[K]) => {
    onChange({ ...data, [key]: value });
  };

  // Show/hide toggle. Зберігаємо у data.hidden (sanitized у parseTemplateData).
  // Тоggle: hidden[region] = true ⇄ delete hidden[region]. Якщо hidden стає
  // пустим — лишаємо порожній obj (для consistency, simpler check у render).
  const isHidden = (region: EventRegionKey) => data.hidden?.[region] === true;
  const toggleHidden = (region: EventRegionKey) => {
    const next = { ...(data.hidden || {}) };
    if (next[region]) delete next[region];
    else next[region] = true;
    onChange({ ...data, hidden: next });
  };

  const updateEducation = (idx: number, patch: Partial<EventEducationItem>) => {
    const next = data.education.map((e, i) => (i === idx ? { ...e, ...patch } : e));
    onChange({ ...data, education: next });
  };

  const addEducation = () => {
    onChange({
      ...data,
      education: [...data.education, { title: "Нова освіта", meta: "Тип · рік" }],
    });
  };

  const removeEducation = (idx: number) => {
    onChange({ ...data, education: data.education.filter((_, i) => i !== idx) });
  };

  const moveEducation = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= data.education.length) return;
    const next = [...data.education];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange({ ...data, education: next });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <RegionGroup region="photo" onFocusRegion={onFocusRegion}>
        <SectionHeader
          icon="📸"
          title="Фото фахівця"
          whereOnCard="ліва половина"
          hidden={isHidden("photo")}
          onToggleHidden={() => toggleHidden("photo")}
        />
        {!isHidden("photo") && (
          <ImageInput
            label="Фото"
            value={data.photo}
            onChange={v => update("photo", v)}
            aspectRatio="3/4"
            maxPreviewWidth={140}
          />
        )}
      </RegionGroup>

      <RegionGroup region="metrics" onFocusRegion={onFocusRegion}>
        <SectionHeader
          icon="🎯"
          title="Вартість і тривалість"
          whereOnCard="overlay на фото"
          hidden={isHidden("metrics")}
          onToggleHidden={() => toggleHidden("metrics")}
        />
        {!isHidden("metrics") && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <TextInput
              label="Вартість"
              value={data.price}
              onChange={v => update("price", v)}
              placeholder="1300 грн"
              maxLength={40}
            />
            <TextInput
              label="Тривалість"
              value={data.duration}
              onChange={v => update("duration", v)}
              placeholder="50 хв"
              maxLength={40}
            />
          </div>
        )}
      </RegionGroup>

      <RegionGroup region="cta" onFocusRegion={onFocusRegion}>
        <SectionHeader
          icon="🎟"
          title="CTA-кнопка"
          whereOnCard="золота кнопка"
          hidden={isHidden("cta")}
          onToggleHidden={() => toggleHidden("cta")}
        />
        {!isHidden("cta") && (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 220px) 1fr", gap: 8 }}>
            <TextInput
              label="Текст кнопки"
              value={data.ctaLabel}
              onChange={v => update("ctaLabel", v)}
              placeholder="Записатися на консультацію"
              maxLength={48}
            />
            <TextInput
              label="URL посилання"
              value={data.ctaHref}
              onChange={v => update("ctaHref", v)}
              placeholder="https://forms.gle/... або https://t.me/..."
              hint="порожнє → disabled"
            />
          </div>
        )}
      </RegionGroup>

      <RegionGroup region="specialist" onFocusRegion={onFocusRegion}>
        <SectionHeader
          icon="👤"
          title="Фахівець"
          whereOnCard="низ фото"
          hidden={isHidden("specialist")}
          onToggleHidden={() => toggleHidden("specialist")}
        />
        {!isHidden("specialist") && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <TextInput
              label="Імʼя"
              value={data.specialistName}
              onChange={v => update("specialistName", v)}
              placeholder="Анна Гудзенко"
              maxLength={80}
            />
            <TextInput
              label="Роль / спеціалізація"
              value={data.specialistRole}
              onChange={v => update("specialistRole", v)}
              placeholder="Психолог-консультант"
              maxLength={80}
            />
            <div style={{ gridColumn: "1 / -1" }}>
              <TextInput
                label="Tagline"
                value={data.specialistTagline}
                onChange={v => update("specialistTagline", v)}
                placeholder="3+ роки в ментальному здоровʼї"
                maxLength={120}
              />
            </div>
          </div>
        )}
      </RegionGroup>

      <RegionGroup region="about" onFocusRegion={onFocusRegion}>
        <SectionHeader
          icon="📖"
          title="Про фахівця"
          whereOnCard="права панель, верх"
          hidden={isHidden("about")}
          onToggleHidden={() => toggleHidden("about")}
        />
        {!isHidden("about") && (
          <TextAreaInput
            label="Опис"
            value={data.about}
            onChange={v => update("about", v)}
            placeholder="Описати підхід, з ким працює, у чому експертний..."
            rows={4}
            hint="нові абзаци — Enter Enter"
          />
        )}
      </RegionGroup>

      <RegionGroup region="education" onFocusRegion={onFocusRegion}>
      <SectionHeader
        icon="🎓"
        title={`Освіта (${data.education.length})`}
        whereOnCard="права панель, низ"
        hidden={isHidden("education")}
        onToggleHidden={() => toggleHidden("education")}
      />
      {!isHidden("education") && (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {data.education.map((edu, idx) => (
          <div
            key={idx}
            style={{
              display: "grid",
              gridTemplateColumns: "20px 1fr 1fr auto",
              gap: 6,
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#9B7C45",
                textAlign: "center",
                fontFamily: "Inter, system-ui, -apple-system, sans-serif",
              }}
              title={`Запис ${idx + 1}`}
            >
              {idx + 1}.
            </span>
            <input
              type="text"
              value={edu.title}
              onChange={e => updateEducation(idx, { title: e.target.value })}
              placeholder="Назва (напр. Практична психологія)"
              maxLength={120}
              style={eduInputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = "#D4A843")}
              onBlur={e => (e.currentTarget.style.borderColor = "#E8D5B7")}
            />
            <input
              type="text"
              value={edu.meta}
              onChange={e => updateEducation(idx, { meta: e.target.value })}
              placeholder="Meta (напр. Бакалавр · 2023-2026)"
              maxLength={160}
              style={eduInputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = "#D4A843")}
              onBlur={e => (e.currentTarget.style.borderColor = "#E8D5B7")}
            />
            <div style={{ display: "flex", gap: 3 }}>
              <button
                type="button"
                onClick={() => moveEducation(idx, -1)}
                disabled={idx === 0}
                title="Вгору"
                style={iconBtnStyle(idx === 0)}
              >↑</button>
              <button
                type="button"
                onClick={() => moveEducation(idx, 1)}
                disabled={idx === data.education.length - 1}
                title="Вниз"
                style={iconBtnStyle(idx === data.education.length - 1)}
              >↓</button>
              <button
                type="button"
                onClick={() => removeEducation(idx)}
                title="Видалити"
                style={{ ...iconBtnStyle(false), borderColor: "#FECACA", color: "#B91C1C" }}
              >✕</button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addEducation}
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
          + Додати освіту
        </button>
      </div>
      )}
      </RegionGroup>
    </div>
  );
}

const eduInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  fontSize: 13,
  fontFamily: "Inter, system-ui, -apple-system, sans-serif",
  color: "#1C1917",
  background: "#FFFFFF",
  border: "1.5px solid #E8D5B7",
  borderRadius: 7,
  outline: "none",
  transition: "border-color 0.15s",
};

function iconBtnStyle(disabled: boolean, color?: string): React.CSSProperties {
  return {
    width: 24,
    height: 26,
    borderRadius: 5,
    border: "1px solid #E8D5B7",
    background: "#FFFFFF",
    color: color || "#1C3A2E",
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
