"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

interface Props {
  /** Природні розміри канвасу превʼю-картки (360×400 для UIMP). */
  baseWidth: number;
  baseHeight: number;
  /** Початкова scale для SSR — обчислюється статично з block.width × CANVAS_WIDTH.
   *  ResizeObserver одразу після hydration перерахує по фактичній ширині. */
  initialScale: number;
  children: React.ReactNode;
}

/**
 * Контейнер, що рендерить дочірній контент у фіксованому розмірі (baseWidth×baseHeight)
 * і CSS-scale-ить його так, щоб ширина точно дорівнювала фактичній ширині батьківського
 * елемента. Висота — пропорційно (через padding-bottom aspect trick), без overflow.
 *
 * Навіщо: newsCard preview-блок на /news може бути будь-якої ширини. Внутрішні preview-
 * блоки авторовані для 360×400 канвасу — їх позиції/розміри в px фіксовані. Scale через
 * CSS transform зберігає ідентичність вигляду.
 *
 * ResizeObserver НЕОБХІДНИЙ для адмін-білдера: під час resize outer-обгортки React
 * оновлює `previewWidth` style миттєво, але `block.width` ще не закомічено — статичний
 * scale-розрахунок з block.width дає застарілий результат, і блоки розтягуються нерівно.
 */
const useIso = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export default function PreviewCardScale({
  baseWidth,
  baseHeight,
  initialScale,
  children,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(initialScale);

  useIso(() => {
    if (!ref.current) return;
    const update = () => {
      if (!ref.current) return;
      const w = ref.current.getBoundingClientRect().width;
      if (w > 0) setScale(w / baseWidth);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [baseWidth]);

  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        width: "100%",
        // padding-bottom задає aspect-ratio: висота auto-зміниться разом з шириною.
        // (baseHeight/baseWidth)*100% = висота у % від ширини.
        height: 0,
        paddingBottom: `${(baseHeight / baseWidth) * 100}%`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: `${baseWidth}px`,
          height: `${baseHeight}px`,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
    </div>
  );
}
