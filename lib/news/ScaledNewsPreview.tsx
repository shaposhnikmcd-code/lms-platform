"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AbsoluteBlockRender,
  CANVAS_WIDTH,
  canvasHeight,
  hasCoords,
  NEWS_BLOCK_CSS,
  SequentialBlockRender,
  type Block,
} from "./render";

// Превью новини з фактичним публічним рендером, зменшене до ширини контейнера.
// Використовується в адмін-списку новин (expanded card), де доступно ~720px,
// а канвас новини — 832px. Через CSS transform: scale зберігаємо точний layout.
//
// Якщо в блоків немає координат (legacy без x/y) — рендеримо стек, як public mobile.

export default function ScaledNewsPreview({ blocks }: { blocks: Block[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [innerH, setInnerH] = useState(() => canvasHeight(blocks));

  const useAbsolute = hasCoords(blocks);

  // Слідкуємо за шириною контейнера → перераховуємо scale.
  useLayoutEffect(() => {
    if (!useAbsolute) return;
    const el = wrapRef.current;
    if (!el) return;
    const recalc = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(Math.min(1, w / CANVAS_WIDTH));
    };
    recalc();
    const ro = new ResizeObserver(recalc);
    ro.observe(el);
    return () => ro.disconnect();
  }, [useAbsolute]);

  // Слідкуємо за реальною висотою контенту (картинки можуть змінити висоту блоків
  // після завантаження). Аналог логіки AbsoluteCanvas на публічній сторінці.
  useEffect(() => {
    if (!useAbsolute) return;
    const el = innerRef.current;
    if (!el) return;
    const recalc = () => {
      let max = 200;
      el.querySelectorAll<HTMLElement>("[data-news-block]").forEach((n) => {
        max = Math.max(max, n.offsetTop + n.offsetHeight + 40);
      });
      setInnerH(max);
    };
    recalc();
    const imgs = el.querySelectorAll("img");
    imgs.forEach((img) => {
      if (!img.complete) img.addEventListener("load", recalc, { once: true });
    });
    const ro = new ResizeObserver(recalc);
    el.querySelectorAll("[data-news-block]").forEach((n) => ro.observe(n));
    return () => ro.disconnect();
  }, [blocks, useAbsolute]);

  // Стек-режим (легасі-блоки без x/y). Виглядає як public mobile.
  if (!useAbsolute) {
    return (
      <>
        <style>{NEWS_BLOCK_CSS}</style>
        <div className="news-content">
          {blocks.map((b) => (
            <SequentialBlockRender key={b.id} block={b} />
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <style>{NEWS_BLOCK_CSS}</style>
      <div
        ref={wrapRef}
        className="news-content"
        style={{
          position: "relative",
          width: "100%",
          height: `${Math.round(innerH * scale)}px`,
          overflow: "hidden",
        }}
      >
        <div
          ref={innerRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: `${CANVAS_WIDTH}px`,
            height: `${innerH}px`,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          {blocks.map((b) => (
            <AbsoluteBlockRender key={b.id} block={b} />
          ))}
        </div>
      </div>
    </>
  );
}
