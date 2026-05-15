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
  const fit = (role === "preview" ? image.previewFit : image.pageFit) ?? "contain";
  const scale = (role === "preview" ? image.previewScale : image.pageScale) ?? 1;
  // Role-specific focal з fallback на legacy `focalX/Y` для backward-compat
  // старих записів (preview/pageFocal-полів ще нема).
  const fxRole = role === "preview" ? image.previewFocalX : image.pageFocalX;
  const fyRole = role === "preview" ? image.previewFocalY : image.pageFocalY;
  const fx = fxRole ?? image.focalX ?? 50;
  const fy = fyRole ?? image.focalY ?? 50;

  // Дві базові моделі вписування + загальний zoom-scale:
  //   • fit="contain" (Розгорнути) — фото повністю видно, можлива letterbox.
  //     scale=1 = вписане ціле, >1 = зум від focal-точки.
  //   • fit="cover" (Заповнити) — фото заповнює слот повністю, можливий crop.
  //     scale=1 = базовий cover, >1 = додатковий зум від focal-точки.
  // У будь-якому режимі transformOrigin = focal point, щоб зум не «плив»
  // в бік, а збільшувався туди, куди клікнув користувач.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image.url}
      alt={image.alt || ""}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: fit === "cover" ? "cover" : "contain",
        objectPosition: `${fx}% ${fy}%`,
        transform: scale === 1 ? undefined : `scale(${scale})`,
        transformOrigin: `${fx}% ${fy}%`,
        display: "block",
      }}
      loading="lazy"
      draggable={false}
    />
  );
}
