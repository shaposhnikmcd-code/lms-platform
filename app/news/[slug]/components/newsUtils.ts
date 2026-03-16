export type BlockType = "hero" | "heading" | "text" | "image" | "gallery" | "video" | "quote" | "divider" | "list" | "cta";
export type BgColor = "white" | "green" | "gold" | "mint" | "gray";
export type Align = "left" | "center" | "right";
export type Pad = "sm" | "md" | "lg";
export type BlockPos = "left" | "center" | "right";

export interface Block {
  id: string;
  type: BlockType;
  bg: BgColor;
  align: Align;
  padding: Pad;
  width: number;
  height?: number;
  blockPos: BlockPos;
  data: Record<string, any>;
}
export interface Row {
  id: string;
  blocks: Block[];
}

export const CATEGORY_LABELS: Record<string, string> = {
  NEWS: "Новини",
  ANNOUNCEMENT: "Оголошення",
  ARTICLE: "Стаття",
};
export const CATEGORY_COLORS: Record<string, string> = {
  NEWS: "bg-blue-100 text-blue-700",
  ANNOUNCEMENT: "bg-yellow-100 text-yellow-700",
  ARTICLE: "bg-green-100 text-green-700",
};

export const BG_STYLES: Record<BgColor, React.CSSProperties> = {
  white: { backgroundColor: "#ffffff" },
  green: { backgroundColor: "#1C3A2E", color: "#ffffff" },
  gold:  { backgroundColor: "#D4A843", color: "#1C3A2E" },
  mint:  { backgroundColor: "#E8F5E0" },
  gray:  { backgroundColor: "#f3f4f6" },
};

export const ALIGN_CLASS: Record<Align, string> = {
  left: "text-left", center: "text-center", right: "text-right",
};

export const PAD_CLASS: Record<Pad, string> = {
  sm: "py-2", md: "py-4", lg: "py-8",
};

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

function ensureBlockPos(b: any): Block {
  return { ...b, blockPos: (b.blockPos ?? "left") as BlockPos, width: b.width ?? 100 };
}

export function parseContent(content: string): Row[] | null {
  try {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    if ("blocks" in parsed[0]) {
      return (parsed as Row[]).map(row => ({ ...row, blocks: row.blocks.map(ensureBlockPos) }));
    }
    return (parsed as any[]).map(b => ({ id: b.id + "_row", blocks: [ensureBlockPos(b)] }));
  } catch {
    return null;
  }
}