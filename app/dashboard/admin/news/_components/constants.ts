import { BlockType, BgColor, Align, Pad, BlockPos, Block, Row } from "./types";
export { BG_STYLES, PAD_STYLES, ALIGN_STYLES, getBlockPosStyle } from "@/components/news/newsUtils";

export const uid = () => Math.random().toString(36).slice(2, 8);

export const emptyBlock = (type: BlockType, width = 100): Block => ({
  id: uid(), type, bg: "white",
  align: type === "hero" || type === "cta" ? "center" : "left",
  valign: "top",
  padding: "md", width, blockPos: "left",
  data: ({
    hero: { title: "", subtitle: "" },
    heading: { text: "" },
    text: { content: "" },
    image: { url: "", alt: "" },
    gallery: { images: [] as string[] },
    video: { url: "" },
    quote: { text: "", author: "" },
    divider: {},
    list: { items: [""] },
    cta: { text: "", url: "" },
  } as Record<BlockType, Record<string, any>>)[type],
});

export const emptyRow = (type: BlockType): Row => ({ id: uid(), blocks: [emptyBlock(type, 100)] });

export const ensureBlock = (b: any): Block => ({
  ...b,
  blockPos: (b.blockPos ?? "left") as BlockPos,
  width: b.width ?? 100,
  valign: b.valign ?? "top",
});

export const parseRows = (content: string): Row[] | null => {
  try {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    if (parsed[0] && typeof parsed[0] === "object" && "blocks" in parsed[0]) {
      return (parsed as Row[]).map(row => ({ ...row, blocks: row.blocks.map(ensureBlock) }));
    }
    return (parsed as any[]).map(b => ({ id: uid(), blocks: [ensureBlock(b)] }));
  } catch (e) {
    return null;
  }
};

export const translitMap: Record<string, string> = {
  '\u0430':'a','\u0431':'b','\u0432':'v','\u0433':'h','\u0491':'g',
  '\u0434':'d','\u0435':'e','\u0454':'ye','\u0436':'zh','\u0437':'z',
  '\u0438':'y','\u0456':'i','\u0457':'yi','\u0439':'y','\u043a':'k',
  '\u043b':'l','\u043c':'m','\u043d':'n','\u043e':'o','\u043f':'p',
  '\u0440':'r','\u0441':'s','\u0442':'t','\u0443':'u','\u0444':'f',
  '\u0445':'kh','\u0446':'ts','\u0447':'ch','\u0448':'sh',
  '\u0449':'shch','\u044c':'','\u044e':'yu','\u044f':'ya',' ':'-'
};

export const toSlug = (t: string) =>
  t.toLowerCase().split('').map(c => translitMap[c] ?? c).join('').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').trim();

export const BG_DOT: Record<BgColor, string> = {
  white: "#ffffff", green: "#1C3A2E", gold: "#D4A843", mint: "#E8F5E0", gray: "#f3f4f6",
};

export const BG_CLASSES: Record<BgColor, string> = {
  white: "bg-white", green: "bg-[#1C3A2E]", gold: "bg-[#D4A843]", mint: "bg-[#E8F5E0]", gray: "bg-gray-50",
};

export const ALIGN_CLASS: Record<Align, string> = {
  left: "text-left", center: "text-center", right: "text-right",
};

export const PAD_CLASS: Record<Pad, string> = {
  sm: "py-2", md: "py-4", lg: "py-8",
};

export const BLOCK_LABELS: Record<BlockType, string> = {
  hero: "Банер", heading: "Заголовок", text: "Текст", image: "Фото",
  gallery: "Галерея", video: "Відео", quote: "Цитата",
  divider: "Роздільник", list: "Список", cta: "Кнопка CTA",
};

export const BLOCK_ICONS: Record<BlockType, string> = {
  hero: "🖼", heading: "T", text: "P", image: "📷", gallery: "📸",
  video: "▶", quote: "Q", divider: "-", list: "L", cta: "B",
};

export const BLOCK_TYPES: BlockType[] = [
  "hero", "heading", "text", "image", "gallery", "video", "quote", "divider", "list", "cta"
];

export const ic = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1C3A2E]/20";
export const lc = "block text-xs font-medium text-gray-500 mb-1";