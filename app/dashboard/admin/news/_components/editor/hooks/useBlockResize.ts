import { useCallback, useEffect, useRef, useState } from "react";
import { BlockWidth, WIDTH_SNAP_PRESETS } from "../types";

// Крок resize — 0.1% (≈0.8px на канвасі 832px), безперервне відчуття.
// Soft-snap до пресетів (25/33/50/66/75/100) у вузькому вікні ±0.3% — магнітить
// коли цілишся повільно, не "липне" коли просто проходиш повз.
function snapWidth(pct: number): BlockWidth {
  const clamped = Math.max(20, Math.min(100, pct));
  for (const preset of WIDTH_SNAP_PRESETS) {
    if (Math.abs(clamped - preset) <= 0.3) return String(preset);
  }
  return String(Math.round(clamped * 10) / 10);
}

// Ширина «внутрішнього» контента image-блоку (img width) — обгортка блока мінус padding/border.
// Див. BlockItem.tsx: padding 14+16, border 2*1.5 → ~32px. Залишаємо як у діагональному resize.
const IMAGE_INNER_DELTA = 32;

interface Options {
  blockId: string;
  blockData: Record<string, string>;
  blockWidth: string;
  containerWidthPx: number;
  onSetWidth: (id: string, w: BlockWidth) => void;
  onSetWidthAndData: (id: string, w: BlockWidth, data: Record<string, string>, height?: number) => void;
  onPreviewWidth: (id: string, pct: number) => void;
  onClearPreview: (id: string) => void;
  onPreviewHeight: (id: string, h: number) => void;
  onClearPreviewHeight: (id: string) => void;
  onChange: (id: string, data: Record<string, string>) => void;
  onReportHeight: (id: string, h: number) => void;
  getSameRowHeights: () => number[];
  snapThreshold: number;
}

export function useBlockResize({
  blockId, blockData, blockWidth, containerWidthPx,
  onSetWidth, onSetWidthAndData, onPreviewWidth, onClearPreview,
  onPreviewHeight, onClearPreviewHeight, onChange,
  onReportHeight, getSameRowHeights, snapThreshold,
}: Options) {
  const blockRef = useRef<HTMLDivElement | null>(null);
  const [resizingW, setResizingW] = useState(false);
  const [resizingH, setResizingH] = useState(false);
  const [resizingD, setResizingD] = useState(false);
  const [livePct, setLivePct] = useState(Number(blockWidth));
  const [minHeight, setMinHeight] = useState(Number(blockData.minHeight) || 0);
  const [snapGuideH, setSnapGuideH] = useState<number | null>(null);

  const aspectRatio = Number(blockData.aspectRatio) || 0;

  useEffect(() => {
    setMinHeight(Number(blockData.minHeight) || 0);
  }, [blockData.minHeight]);

  useEffect(() => {
    if (!resizingW) setLivePct(Number(blockWidth));
  }, [blockWidth, resizingW]);

  // Репортуємо висоту при кожній зміні розміру
  useEffect(() => {
    if (!blockRef.current) return;
    const ro = new ResizeObserver(() => {
      if (blockRef.current) onReportHeight(blockId, blockRef.current.offsetHeight);
    });
    ro.observe(blockRef.current);
    return () => ro.disconnect();
  }, [blockId, onReportHeight]);

  const startResizeWidth = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startPx = blockRef.current?.offsetWidth ?? Math.round(containerWidthPx * Number(blockWidth) / 100);
    // Детектимо image через DOM (надійніше за aspectRatio для SVG-лого без natural dims).
    const imgEl = blockRef.current?.querySelector("img") as HTMLImageElement | null;
    const isImage = !!imgEl;
    // Aspect: пріоритет — natural із blockData; fallback — рендерені розміри <img>.
    let effectiveAspect = aspectRatio;
    if (isImage && effectiveAspect <= 0 && imgEl) {
      const w = imgEl.naturalWidth || imgEl.offsetWidth;
      const h = imgEl.naturalHeight || imgEl.offsetHeight;
      if (w > 0 && h > 0) effectiveAspect = w / h;
    }
    setResizingW(true);

    // Для image-блоку: під час drag висота <img> має тримати aspect (щоб не було розтягу
    // через objectFit: fill при фіксованому minHeight). Тому паралельно з шириною
    // превʼюємо пропорційну висоту і комітимо її в blockData на mouseup.
    let currentSnappedPct = Number(blockWidth);
    let currentH = Number(blockData.minHeight) || 0;

    const computeImageH = (pct: number) => {
      if (effectiveAspect <= 0) return currentH;
      const pxW = (pct / 100) * containerWidthPx;
      const imgW = Math.max(60, pxW - IMAGE_INNER_DELTA);
      return Math.max(60, Math.round(imgW / effectiveAspect));
    };

    const onMove = (ev: MouseEvent) => {
      const freeMode = ev.shiftKey;
      const pct = ((startPx + ev.clientX - startX) / containerWidthPx) * 100;
      const snapped = Number(snapWidth(pct));
      currentSnappedPct = snapped;
      setLivePct(snapped);
      onPreviewWidth(blockId, snapped);
      // Auto-aspect для фото: висота йде за шириною. Shift = вільний (юзер сам обрізає
      // пропорції — корисно якщо треба вписати фото в нестандартний слот).
      if (isImage && !freeMode) {
        const newH = computeImageH(snapped);
        currentH = newH;
        onPreviewHeight(blockId, newH);
      }
    };

    const onUp = () => {
      const finalW = snapWidth(currentSnappedPct);
      if (isImage) {
        // НЕ зберігаємо minHeight у data — block.height тепер канонічне джерело,
        // stale minHeight ламає геометрію wrapper-а. Див. startResizeHeight.onUp.
        const cleanData = { ...blockData };
        delete cleanData.minHeight;
        onSetWidthAndData(blockId, finalW, cleanData, currentH);
        onClearPreviewHeight(blockId);
      } else {
        onSetWidth(blockId, finalW);
      }
      onClearPreview(blockId);
      setResizingW(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [aspectRatio, blockId, blockData, blockWidth, containerWidthPx, onSetWidth, onSetWidthAndData, onPreviewWidth, onClearPreview, onPreviewHeight, onClearPreviewHeight]);

  const startResizeHeight = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;

    // Детектуємо image-блок через сам DOM (а не aspectRatio) — це надійніше для SVG-лого
    // та інших фото без natural dimensions, де aspectRatio може бути 0.
    const imgEl = blockRef.current?.querySelector("img") as HTMLImageElement | null;
    const isImage = !!imgEl;
    const innerEl = blockRef.current?.firstElementChild as HTMLDivElement | null;

    const startH: number = imgEl
      ? (imgEl.getBoundingClientRect().height || imgEl.offsetHeight || 100)
      : (blockRef.current?.offsetHeight ?? 100);

    // Aspect для image — пріоритет natural із blockData; fallback — рендерені розміри.
    let effectiveAspect = aspectRatio;
    if (isImage && effectiveAspect <= 0 && imgEl) {
      const w = imgEl.naturalWidth || imgEl.offsetWidth;
      const h = imgEl.naturalHeight || imgEl.offsetHeight;
      if (w > 0 && h > 0) effectiveAspect = w / h;
    }
    const hasImageAspect = isImage && effectiveAspect > 0;

    let currentH = startH;
    let currentSnappedPct = Number(blockWidth);
    let savedInnerMinHeight = "";

    if (isImage && innerEl) {
      // Тимчасово знімаємо min-height обгортки прямо в DOM (інакше блок не стиснеться).
      savedInnerMinHeight = innerEl.style.minHeight;
      innerEl.style.minHeight = "0px";
    }

    // Для image-aspect-режиму ставимо resizingW (а не resizingH) — це переключить
    // displayPct на livePct, щоб у хедері відображався preview ширини під час drag-у.
    if (!isImage) {
      setResizingH(true);
      setSnapGuideH(null);
    } else if (hasImageAspect) {
      setResizingW(true);
    }

    const onMove = (ev: MouseEvent) => {
      const rawH = Math.max(60, startH + ev.clientY - startY);
      const freeMode = ev.shiftKey;

      if (isImage && imgEl) {
        if (hasImageAspect && !freeMode) {
          // Auto-aspect: курсор задає висоту → обчислюємо ширину блока пропорційно.
          // Спочатку згрубляємо нову width у %, snap-имо до пресетів,
          // потім перерахунок точної висоти від snapped width — щоб aspect лишився чистим.
          const newImgW = Math.max(60, Math.round(rawH * effectiveAspect));
          const newBlockPxW = newImgW + IMAGE_INNER_DELTA;
          const pctRaw = (newBlockPxW / containerWidthPx) * 100;
          const snapped = Number(snapWidth(pctRaw));
          currentSnappedPct = snapped;
          const snappedPxW = (snapped / 100) * containerWidthPx;
          const finalImgW = Math.max(60, snappedPxW - IMAGE_INNER_DELTA);
          const finalH = Math.max(60, Math.round(finalImgW / effectiveAspect));
          imgEl.style.height = `${finalH}px`;
          imgEl.style.objectFit = "fill";
          if (innerEl) innerEl.style.minHeight = "0px";
          currentH = finalH;
          setLivePct(snapped);
          onPreviewWidth(blockId, snapped);
          onPreviewHeight(blockId, finalH);
        } else {
          // Free mode (Shift) або фото без aspect-даних — стара поведінка: тільки висота.
          imgEl.style.height = `${rawH}px`;
          imgEl.style.objectFit = "fill";
          if (innerEl) innerEl.style.minHeight = "0px";
          currentH = rawH;
          onPreviewHeight(blockId, rawH);
        }
        return;
      }
      const rowHeights = getSameRowHeights();
      let snapped = rawH;
      let guideH: number | null = null;
      for (const rh of rowHeights) {
        if (Math.abs(rawH - rh) <= snapThreshold) { snapped = rh; guideH = rh; break; }
      }
      currentH = snapped;
      setMinHeight(snapped);
      setSnapGuideH(guideH);
      // КРИТИЧНО: text-блок (і non-image взагалі) живе всередині AbsoluteBlock-а,
      // який бере висоту з `previewHeight` коли вона задана, інакше з `block.height`.
      // Без цього виклику AbsoluteBlock тримає стару висоту весь час drag-у —
      // юзер тягне ручку, але блок не реагує, тільки на mouseup стрибає у фінальну
      // позицію. setMinHeight оновлює лише внутрішню обгортку, що не видно бо
      // AbsoluteBlock зверху обмежує висоту своєю фіксованою.
      onPreviewHeight(blockId, snapped);
    };

    const onUp = () => {
      let finalH = currentH;
      if (!isImage) {
        const rowHeights = getSameRowHeights();
        for (const rh of rowHeights) {
          if (Math.abs(currentH - rh) <= snapThreshold) { finalH = rh; break; }
        }
        setMinHeight(finalH);
        setSnapGuideH(null);
        setResizingH(false);
      } else {
        // Повертаємо обгортці її inline minHeight (React переоновить на наступному рендері).
        if (innerEl) innerEl.style.minHeight = savedInnerMinHeight;
        // КРИТИЧНО: знімаємо inline style з img, інакше залишається жорстко зафіксована
        // висота і фото вилазить за межі wrapper-а навіть після того, як block.height
        // зменшено. React не бачить імперативну DOM-мутацію — мусимо очистити вручну.
        if (imgEl) {
          imgEl.style.height = "";
          imgEl.style.objectFit = "";
        }
        if (hasImageAspect) setResizingW(false);
      }
      const fh = Math.round(finalH);
      // Коміт. minHeight БІЛЬШЕ НЕ зберігаємо в data — block.height тепер канонічне джерело
      // висоти, а stale minHeight у data перевищує block.height і ламає геометрію wrapper-а.
      const cleanData = { ...blockData };
      delete cleanData.minHeight;
      if (isImage && hasImageAspect) {
        const finalW = snapWidth(currentSnappedPct);
        onSetWidthAndData(blockId, finalW, cleanData, fh);
        onClearPreview(blockId);
      } else {
        onSetWidthAndData(blockId, blockWidth, cleanData, fh);
      }
      onClearPreviewHeight(blockId);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [aspectRatio, blockId, blockData, blockWidth, containerWidthPx, onSetWidthAndData, onPreviewWidth, onClearPreview, onPreviewHeight, onClearPreviewHeight, getSameRowHeights, snapThreshold]);

  const startResizeDiagonal = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startPxW = blockRef.current?.offsetWidth ?? Math.round(containerWidthPx * Number(blockWidth) / 100);
    const startPxH = blockRef.current?.offsetHeight ?? Math.max(60, Number(blockData.minHeight) || 100);
    // Image-блок детектимо через DOM. Для aspect — пріоритет natural з blockData,
    // fallback — рендерені розміри <img>.
    const imgEl = blockRef.current?.querySelector("img") as HTMLImageElement | null;
    const isImage = !!imgEl;
    let effectiveAspect = aspectRatio;
    if (isImage && effectiveAspect <= 0 && imgEl) {
      const w = imgEl.naturalWidth || imgEl.offsetWidth;
      const h = imgEl.naturalHeight || imgEl.offsetHeight;
      if (w > 0 && h > 0) effectiveAspect = w / h;
    }
    const blockAspect = startPxW / startPxH;
    setResizingD(true);
    // Для фото — знімаємо "підлогу" min-height блока на час drag, щоб блок міг вільно
    // стискатись за висотою фото. Після commit useEffect синхронізує з новим blockData.minHeight.
    if (isImage) setMinHeight(0);

    let currentSnappedPct = Number(blockWidth);
    let currentH = Number(blockData.minHeight) || 0;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const freeMode = ev.shiftKey;
      // Діагональна ручка має реагувати і на вертикальний, і на горизонтальний рух.
      // Конвертуємо dy в «еквівалентну ширину» через aspect (image або block) і беремо
      // того delta, в якого більший модуль — це найкраще зчитує намір користувача,
      // навіть якщо він тягне переважно вниз/вгору.
      const aspectForProjection = isImage ? (effectiveAspect > 0 ? effectiveAspect : blockAspect) : blockAspect;
      const dxFromDy = dy * aspectForProjection;
      // У free-режимі (Shift) — width лише від dx, висоту візьмемо з dy окремо.
      const effectiveDx = freeMode ? dx : (Math.abs(dx) >= Math.abs(dxFromDy) ? dx : dxFromDy);
      const newPxW = Math.max(80, startPxW + effectiveDx);
      const pct = (newPxW / containerWidthPx) * 100;
      const snapped = Number(snapWidth(pct));
      currentSnappedPct = snapped;
      setLivePct(snapped);
      onPreviewWidth(blockId, snapped);
      const snappedPxW = (snapped / 100) * containerWidthPx;

      let newH: number;
      if (isImage && !freeMode) {
        // Auto-aspect: висота <img> прорахована з natural aspect.
        const aspectForH = effectiveAspect > 0 ? effectiveAspect : blockAspect;
        const imgWidth = Math.max(60, snappedPxW - IMAGE_INNER_DELTA);
        newH = Math.max(60, Math.round(imgWidth / aspectForH));
      } else if (isImage && freeMode) {
        // Shift: вільний resize — висота лише від dy (можна обрізати пропорції).
        newH = Math.max(60, startPxH + dy);
      } else {
        // Non-image: висота за aspect блока.
        newH = Math.max(60, Math.round(snappedPxW / blockAspect));
        setMinHeight(newH);
      }
      currentH = newH;
      onPreviewHeight(blockId, newH);
    };

    const onUp = () => {
      // Атомарно: width + top-level block.height. minHeight у data НЕ зберігаємо —
      // воно перевизначає wrapper висоту і ламає геометрію (фото вилазить за блок).
      const cleanData = { ...blockData };
      delete cleanData.minHeight;
      onSetWidthAndData(blockId, snapWidth(currentSnappedPct), cleanData, currentH);
      onClearPreviewHeight(blockId);
      setResizingD(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [aspectRatio, blockId, blockData, blockWidth, containerWidthPx, onSetWidthAndData, onPreviewWidth, onPreviewHeight, onClearPreviewHeight]);

  // displayPct показує live preview ширини під час будь-якого resize.
  // Включаємо resizingH, бо image-aspect-режим bottom-handle теж змінює ширину.
  const displayPct = (resizingW || resizingD || resizingH) ? livePct : Number(blockWidth);

  // Check if current width/height ratio matches the natural image aspect ratio
  let aspectMatched: boolean | null = null;
  if (aspectRatio > 0 && minHeight > 0) {
    const currentPxW = (displayPct / 100) * containerWidthPx;
    const currentRatio = currentPxW / minHeight;
    const diff = Math.abs(currentRatio - aspectRatio) / aspectRatio;
    aspectMatched = diff < 0.03; // 3% tolerance
  }

  return {
    blockRef,
    resizingW, resizingH, resizingD,
    displayPct, minHeight, snapGuideH,
    aspectMatched, hasAspect: aspectRatio > 0,
    startResizeWidth, startResizeHeight, startResizeDiagonal,
  };
}