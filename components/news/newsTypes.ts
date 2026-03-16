export type BlockType =
  | "hero" | "heading" | "text" | "image"
  | "gallery" | "video" | "quote" | "divider" | "list" | "cta";
export type BgColor = "white" | "green" | "gold" | "mint" | "gray";
export type Align = "left" | "center" | "right";
export type VAlign = "top" | "middle" | "bottom";
export type Pad = "sm" | "md" | "lg";
export type BlockPos = "left" | "center" | "right";

export interface Block {
  id: string;
  type: BlockType;
  bg: BgColor;
  align: Align;
  valign: VAlign;
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