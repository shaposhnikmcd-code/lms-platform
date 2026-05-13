// Render-helper для фото-слота з керуванням розміру/фокусу.
//
// Модель:
//  - `fit` (cover | contain) — БАЗОВА поведінка вписування у слот.
//  - `scale` (0.5..2.0) — масштаб фото відносно базової поведінки.
//
// **Cover**: фото cover-крипається у слот при scale=1.0; scale>1 збільшує
// (більше обрізки), scale<1 — не підтримуємо у Cover (виглядає як «зменшене
// обрізане»). Toolbar для Cover тримає slider у діапазоні 100-200%.
//
// **Contain**: фото вписується ціле (можливий letterbox). scale=1.0 — нормальне
// contain. scale<1 — фото менше з більшим padding. scale>1 — фото більше за
// слот, контейнер overflow:hidden показує центральну частину.
//
// `focalX/focalY` (0..100) керує object-position у Cover-mode і transform-
// origin у Contain-mode з scale > 1 (через biased translate всередині wrapper).
//
// Wrapper-елемент СНАРУЖІ цього компонента відповідає за aspectRatio + overflow.

import React from "react";
import type { ArticleImage } from "./types";

interface Props {
  image: ArticleImage;
  /** preview = використовуємо previewFit/previewScale; page = pageFit/pageScale. */
  role: "preview" | "page";
}

export default function CoverImageBox({ image, role }: Props) {
  const fit = (role === "preview" ? image.previewFit : image.pageFit) ?? "cover";
  const scale = (role === "preview" ? image.previewScale : image.pageScale) ?? 1;
  const fx = image.focalX ?? 50;
  const fy = image.focalY ?? 50;

  if (fit === "cover") {
    // Cover: object-fit:cover + object-position + transform:scale (тільки >=1).
    // Slider у toolbar обмежено 100-200% → scale тут завжди ≥ 1.
    const safeScale = Math.max(1, scale);
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image.url}
        alt={image.alt || ""}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: `${fx}% ${fy}%`,
          transform: safeScale === 1 ? undefined : `scale(${safeScale})`,
          transformOrigin: `${fx}% ${fy}%`,
          display: "block",
        }}
        loading="lazy"
        draggable={false}
      />
    );
  }

  // Contain: img розтягується на scale*100% слоту, object-fit:contain зберігає
  // пропорції зображення всередині цього збільшеного/зменшеного box-а.
  // Wrapper-overflow:hidden у батьківському компоненті обрізає те що поза слотом.
  const pct = scale * 100;
  // Зміщення для центрування (бо ми не використовуємо translate)
  const offset = 50 - pct / 2;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image.url}
      alt={image.alt || ""}
      style={{
        position: "absolute",
        width: `${pct}%`,
        height: `${pct}%`,
        left: `${offset}%`,
        top: `${offset}%`,
        objectFit: "contain",
        objectPosition: `${fx}% ${fy}%`,
        display: "block",
      }}
      loading="lazy"
      draggable={false}
    />
  );
}
