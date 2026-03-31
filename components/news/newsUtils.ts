import { Block, BgColor, Align, VAlign, Pad, BlockPos, Row } from "./newsTypes";

export const BG_STYLES: Record<BgColor, React.CSSProperties> = {
  white: { backgroundColor: "#ffffff" },
  green: { backgroundColor: "#1C3A2E", color: "#ffffff" },
  gold:  { backgroundColor: "#D4A843", color: "#1C3A2E" },
  mint:  { backgroundColor: "#E8F5E0" },
  gray:  { backgroundColor: "#f3f4f6" },
};

export const PAD_STYLES: Record<Pad, React.CSSProperties> = {
  sm: { paddingTop: "8px",  paddingBottom: "8px"  },
  md: { paddingTop: "16px", paddingBottom: "16px" },
  lg: { paddingTop: "32px", paddingBottom: "32px" },
};

export const ALIGN_STYLES: Record<Align, React.CSSProperties> = {
  left:   { textAlign: "left" },
  center: { textAlign: "center" },
  right:  { textAlign: "right" },
};

export const VALIGN_STYLES: Record<VAlign, React.CSSProperties> = {
  top:    { justifyContent: "flex-start" },
  middle: { justifyContent: "center" },
  bottom: { justifyContent: "flex-end" },
};

export function getBlockWrapperStyle(block: Block): React.CSSProperties {
  return {
    ...BG_STYLES[block.bg],
    ...PAD_STYLES[block.padding],
    ...ALIGN_STYLES[block.align],
    ...VALIGN_STYLES[block.valign ?? "top"],
    paddingLeft: "16px",
    paddingRight: "16px",
    borderRadius: "12px",
    width: "100%",
    height: "100%",
    boxSizing: "border-box",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  };
}

export function getBlockPosStyle(block: Block): React.CSSProperties {
  const w = "calc(" + block.width + "% - 8px)";
  const h = block.height ? { height: block.height + "px" } : {};
  if (block.blockPos === "center") return { width: w, minWidth: "80px", marginLeft: "auto", marginRight: "auto", ...h };
  if (block.blockPos === "right")  return { width: w, minWidth: "80px", marginLeft: "auto", ...h };
  return { width: w, minWidth: "80px", ...h };
}

export function getVideoEmbed(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  if (yt) return "https://www.youtube.com/embed/" + yt[1];
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return "https://player.vimeo.com/video/" + vm[1];
  return null;
}

export function ensureBlock(b: any): Block {
  return {
    ...b,
    blockPos: (b.blockPos ?? "left") as BlockPos,
    width: b.width ?? 100,
    valign: (b.valign ?? "top") as VAlign,
  };
}

export function parseContent(content: string): Row[] | null {
  try {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    if ("blocks" in parsed[0]) {
      return (parsed as Row[]).map(row => ({ ...row, blocks: row.blocks.map(ensureBlock) }));
    }
    return (parsed as any[]).map(b => ({ id: b.id + "_row", blocks: [ensureBlock(b)] }));
  } catch {
    return null;
  }
}