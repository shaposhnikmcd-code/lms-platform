"use client";

import React, { useEffect, useRef, useState } from "react";

interface Props {
  initialHeight: number;
  maxWidth: number;
  children: React.ReactNode;
}

// Client-side wrapper, який після монтування вимірює реальну висоту всіх
// абсолютно-позиціонованих блоків і виставляє контейнеру коректну висоту.
// Захищає від ситуації, коли SSR обрахував меншу висоту і блоки рендерились
// під футером сайту. Працює навіть для старих новин без `block.height`.
export default function AbsoluteCanvas({ initialHeight, maxWidth, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(initialHeight);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const recalc = () => {
      let max = 400;
      el.querySelectorAll<HTMLElement>("[data-news-block]").forEach(node => {
        const top = node.offsetTop;
        const height = node.offsetHeight;
        max = Math.max(max, top + height + 40);
      });
      setH(max);
    };
    recalc();
    // На випадок завантаження картинок з cdn — переміряти після load
    const imgs = el.querySelectorAll("img");
    imgs.forEach(img => {
      if (!img.complete) img.addEventListener("load", recalc, { once: true });
    });
    const ro = new ResizeObserver(recalc);
    el.querySelectorAll("[data-news-block]").forEach(node => ro.observe(node));
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="news-content hidden md:block"
      style={{ position: "relative", width: "100%", maxWidth: `${maxWidth}px`, margin: "0 auto", height: `${h}px` }}
    >
      {children}
    </div>
  );
}
