"use client";

// Form для EVENT template-новини. Поля 1:1 до EventData (нова структура:
// фото фахівця + overlay-info + 2-секції про спеціаліста та освіту).

import React from "react";
import type { EventData, EventEducationItem } from "@/lib/news/templates/types";
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
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <RegionGroup region="photo" onFocusRegion={onFocusRegion}>
        <SectionHeader icon="📸" title="Фото фахівця" whereOnCard="ліва половина картки" subtitle="Вертикальне фото 3:4. Object-fit:cover — будь-яке фото вписується у слот." />
        <ImageInput
          label="Фото"
          value={data.photo}
          onChange={v => update("photo", v)}
          aspectRatio="3/4"
        />
      </RegionGroup>

      <RegionGroup region="metrics" onFocusRegion={onFocusRegion}>
        <SectionHeader icon="🎯" title="Подія" whereOnCard="overlay над фото" subtitle="Назва — для адмінки/SEO. Вартість і Тривалість — overlay на фото під розділювачем." />
        <TextInput
          label="Назва події (для адмінки/SEO)"
          value={data.title}
          onChange={v => update("title", v)}
          placeholder="Консультація з Анною Гудзенко"
          maxLength={120}
          hint="внутрішньо; на самій картці не показується"
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
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
            placeholder="50 хвилин"
            maxLength={40}
          />
        </div>
      </RegionGroup>

      <RegionGroup region="cta" onFocusRegion={onFocusRegion}>
        <SectionHeader icon="🎟" title="CTA-кнопка" whereOnCard="золота кнопка під фото" subtitle='Для "Триває реєстрація" → "Записатися на консультацію". Для "Придбати запис" → "Придбати".' />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <TextInput
            label="Текст кнопки"
            value={data.ctaLabel}
            onChange={v => update("ctaLabel", v)}
            placeholder="Записатися на консультацію"
            maxLength={48}
          />
          <TextInput
            label="URL кнопки"
            value={data.ctaHref}
            onChange={v => update("ctaHref", v)}
            placeholder="https://forms.gle/... або https://t.me/..."
            hint="порожнє → кнопка disabled"
          />
        </div>
      </RegionGroup>

      <RegionGroup region="specialist" onFocusRegion={onFocusRegion}>
        <SectionHeader icon="👤" title="Фахівець" whereOnCard="нижня частина фото" subtitle="Імʼя, роль і tagline відображаються overlay-ом у нижній частині фото." />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
          <TextInput
            label="Tagline"
            value={data.specialistTagline}
            onChange={v => update("specialistTagline", v)}
            placeholder="3+ роки в ментальному здоровʼї"
            maxLength={120}
            hint="досвід / фокус, 1 рядок"
          />
        </div>
      </RegionGroup>

      <RegionGroup region="about" onFocusRegion={onFocusRegion}>
        <SectionHeader icon="📖" title="Про фахівця" whereOnCard="права інфо-панель, верх" subtitle="Опис у білій інфо-картці справа, перший блок. Параграфи розділяй порожнім рядком." />
        <TextAreaInput
          label="Опис"
          value={data.about}
          onChange={v => update("about", v)}
          placeholder="Описати підхід, з ким працює, у чому експертний..."
          rows={6}
          hint="нові абзаци через Enter Enter"
        />
      </RegionGroup>

      <RegionGroup region="education" onFocusRegion={onFocusRegion}>
      <SectionHeader
        icon="🎓"
        title={`Освіта та кваліфікація (${data.education.length})`}
        whereOnCard="права інфо-панель, низ"
        subtitle="Список освітніх записів. Кожен — назва + meta-рядок (тип, роки, школа)."
      />
      {data.education.map((edu, idx) => (
        <div
          key={idx}
          style={{
            background: "#FAF6F0",
            border: "1px solid #E8D5B7",
            borderRadius: 12,
            padding: 14,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
              Запис {idx + 1}
            </span>
            <div style={{ flex: 1 }} />
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

          <TextInput
            label="Назва"
            value={edu.title}
            onChange={v => updateEducation(idx, { title: v })}
            placeholder="Практична психологія"
            maxLength={120}
          />
          <TextInput
            label="Meta (тип / роки / школа)"
            value={edu.meta}
            onChange={v => updateEducation(idx, { meta: v })}
            placeholder="Бакалавр практичної психології · 2023-2026"
            maxLength={160}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={addEducation}
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
        + Додати освіту
      </button>
      </RegionGroup>
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
