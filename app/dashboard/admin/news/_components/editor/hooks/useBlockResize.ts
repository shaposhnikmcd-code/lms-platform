import { useCallback, useEffect, useRef, useState } from "react";
import { BlockWidth, WIDTH_SNAP_PRESETS } from "../types";

// Крок resize — 1%. Плюс soft-snap до стандартних пресетів (25/33/50/66/75/100) у межах ±0.8%.
function snapWidth(pct: number): BlockWidth {
  const clamped = Math.max(20, Math.min(100, pct));
  for (const preset of WIDTH_SNAP_PRESETS) {
    if (Math.abs(clamped - preset) <= 0.8) return String(preset);
  }
  return String(Math.round(clamped));
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
      const pct = ((startPx + ev.clientX - startX) / containerWidthPx) * 100;
      const snapped = Number(snapWidth(pct));
      currentSnappedPct = snapped;
      setLivePct(snapped);
      onPreviewWidth(blockId, snapped);
      if (isImage) {
        const newH = computeImageH(snapped);
        currentH = newH;
        onPreviewHeight(blockId, newH);
      }
    };

    const onUp = () => {
      const finalW = snapWidth(currentSnappedPct);
      if (isImage) {
        onSetWidthAndData(blockId, finalW, { ...blockData, minHeight: String(currentH) }, currentH);
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

    let currentH = startH;
    let savedInnerMinHeight = "";

    if (isImage && innerEl) {
      // Тимчасово знімаємо min-height обгортки прямо в DOM (інакше блок не стиснеться).
      savedInnerMinHeight = innerEl.style.minHeight;
      innerEl.style.minHeight = "0px";
    }

    if (!isImage) {
      // Для non-image використовуємо стейт-підхід (як раніше працювало).
      setResizingH(true);
      setSnapGuideH(null);
    }

    const onMove = (ev: MouseEvent) => {
      const rawH = Math.max(60, startH + ev.clientY - startY);
      if (isImage && imgEl) {
        imgEl.style.height = `${rawH}px`;
        imgEl.style.objectFit = "fill";
        // Подвійна гарантія для обгортки — на випадок якщо щось перезапише.
        if (innerEl) innerEl.style.minHeight = "0px";
        currentH = rawH;
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
      }
      // Коміт даних + top-level block.height (щоб обгортка блока теж стиснулась
      // разом з картинкою). Зберігаємо minHeight у data для backward-compat.
      const fh = Math.round(finalH);
      onSetWidthAndData(blockId, blockWidth, { ...blockData, minHeight: String(fh) }, fh);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [aspectRatio, blockId, blockData, blockWidth, onSetWidthAndData, getSameRowHeights, snapThreshold]);

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
      // Діагональна ручка має реагувати і на вертикальний, і на горизонтальний рух.
      // Конвертуємо dy в «еквівалентну ширину» через aspect (image або block) і беремо
      // того delta, в якого більший модуль — це найкраще зчитує намір користувача,
      // навіть якщо він тягне переважно вниз/вгору.
      const aspectForProjection = isImage ? (effectiveAspect > 0 ? effectiveAspect : blockAspect) : blockAspect;
      const dxFromDy = dy * aspectForProjection;
      const effectiveDx = Math.abs(dx) >= Math.abs(dxFromDy) ? dx : dxFromDy;
      const newPxW = Math.max(80, startPxW + effectiveDx);
      const pct = (newPxW / containerWidthPx) * 100;
      const snapped = Number(snapWidth(pct));
      currentSnappedPct = snapped;
      setLivePct(snapped);
      onPreviewWidth(blockId, snapped);
      const snappedPxW = (snapped / 100) * containerWidthPx;

      let newH: number;
      if (isImage) {
        // Висота <img> з aspect (natural або fallback з рендерених розмірів).
        const aspectForH = effectiveAspect > 0 ? effectiveAspect : blockAspect;
        const imgWidth = Math.max(60, snappedPxW - IMAGE_INNER_DELTA);
        newH = Math.max(60, Math.round(imgWidth / aspectForH));
        // Не чіпаємо block minHeight — щоб не псувати висоту блока-обгортки
      } else {
        // Висота блока = проскейлена за поточним аспектом блока
        newH = Math.max(60, Math.round(snappedPxW / blockAspect));
        setMinHeight(newH);
      }
      currentH = newH;
      onPreviewHeight(blockId, newH);
    };

    const onUp = () => {
      // Атомарно: width, data (з minHeight для backward-compat), і top-level
      // block.height — щоб wrapper блока і фото були синхронізовані.
      onSetWidthAndData(blockId, snapWidth(currentSnappedPct), {
        ...blockData,
        minHeight: String(currentH),
      }, currentH);
      onClearPreviewHeight(blockId);
      setResizingD(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [aspectRatio, blockId, blockData, blockWidth, containerWidthPx, onSetWidthAndData, onPreviewWidth, onPreviewHeight, onClearPreviewHeight]);

  const displayPct = resizingW || resizingD ? livePct : Number(blockWidth);

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