export type { BlockType, BgColor, Align, Pad, BlockPos, Block, Row } from "@/components/news/newsTypes";
export type VAlign = "top" | "middle" | "bottom";

export interface MetaNew {
  title: string;
  slug: string;
  excerpt: string;
  category: string;
}

export interface MetaEdit extends MetaNew {
  published: boolean;
}