import { useCallback, useEffect, useRef, useState } from "react";
import { BlockWidth } from "../types";

function snapWidth(pct: number): BlockWidth {
  const step = 5;
  const snapped = Math.round(pct / step) * step;
  return String(Math.max(20, Math.min(100, snapped))) as BlockWidth;
}

interface Options {
  blockId: string;
  blockData: Record<string, string>;
  blockWidth: string;
  containerWidthPx: number;
  onSetWidth: (id: string, w: BlockWidth) => void;
  onPreviewWidth: (id: string, pct: number) => void;
  onClearPreview: (id: string) => void;
  onChange: (id: string, data: Record<string, string>) => void;
  onReportHeight: (id: string, h: number) => void;
  getSameRowHeights: () => number[];
  snapThreshold: number;
}

export function useBlockResize({
  blockId, blockData, blockWidth, containerWidthPx,
  onSetWidth, onPreviewWidth, onClearPreview, onChange,
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
    setResizingW(true);

    const onMove = (ev: MouseEvent) => {
      const pct = ((startPx + ev.clientX - startX) / containerWidthPx) * 100;
      const snapped = Number(snapWidth(pct));
      setLivePct(snapped);
      onPreviewWidth(blockId, snapped);
    };

    const onUp = (ev: MouseEvent) => {
      const pct = ((startPx + ev.clientX - startX) / containerWidthPx) * 100;
      onSetWidth(blockId, snapWidth(pct));
      onClearPreview(blockId);
      setResizingW(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [blockId, blockWidth, containerWidthPx, onSetWidth, onPreviewWidth, onClearPreview]);

  const startResizeHeight = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startH = blockRef.current?.offsetHeight ?? 100;
    setResizingH(true);
    setSnapGuideH(null);

    const onMove = (ev: MouseEvent) => {
      const rawH = Math.max(60, startH + ev.clientY - startY);
      const rowHeights = getSameRowHeights();
      let snapped = rawH;
      let guideH: number | null = null;
      for (const rh of rowHeights) {
        if (Math.abs(rawH - rh) <= snapThreshold) { snapped = rh; guideH = rh; break; }
      }
      setMinHeight(snapped);
      setSnapGuideH(guideH);
    };

    const onUp = (ev: MouseEvent) => {
      const rawH = Math.max(60, startH + ev.clientY - startY);
      const rowHeights = getSameRowHeights();
      let finalH = rawH;
      for (const rh of rowHeights) {
        if (Math.abs(rawH - rh) <= snapThreshold) { finalH = rh; break; }
      }
      setMinHeight(finalH);
      setSnapGuideH(null);
      onChange(blockId, { ...blockData, minHeight: String(Math.round(finalH)) });
      setResizingH(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [blockId, blockData, onChange, getSameRowHeights, snapThreshold]);

  const startResizeDiagonal = useCallback((e: React.MouseEvent) => {
    if (!aspectRatio) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startPxW = blockRef.current?.offsetWidth ?? Math.round(containerWidthPx * Number(blockWidth) / 100);
    setResizingD(true);

    const onMove = (ev: MouseEvent) => {
      const newPxW = Math.max(80, startPxW + ev.clientX - startX);
      const pct = (newPxW / containerWidthPx) * 100;
      const snapped = Number(snapWidth(pct));
      setLivePct(snapped);
      onPreviewWidth(blockId, snapped);
      const snappedPxW = (snapped / 100) * containerWidthPx;
      const newH = Math.round(snappedPxW / aspectRatio);
      setMinHeight(newH);
    };

    const onUp = () => {
      const finalPct = livePct;
      const snapped = snapWidth(finalPct);
      const snappedPxW = (Number(snapped) / 100) * containerWidthPx;
      const finalH = Math.round(snappedPxW / aspectRatio);
      onSetWidth(blockId, snapped);
      onChange(blockId, { ...blockData, minHeight: String(finalH) });
      onClearPreview(blockId);
      setResizingD(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [aspectRatio, blockId, blockData, blockWidth, containerWidthPx, onSetWidth, onPreviewWidth, onClearPreview, onChange, livePct]);

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