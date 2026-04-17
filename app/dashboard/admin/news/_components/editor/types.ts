export type BlockType = "text" | "heading" | "image" | "youtube" | "quote" | "divider";
// BlockWidth — рядок з числом відсотків (1..100). Тримаємо як string для сумісності
// зі старими записами та з JSON-серіалізацією. Крок resize — 1%.
export type BlockWidth = string;
export type BlockAlign = "left" | "center" | "right";

export interface Block {
  id: string;
  type: BlockType;
  data: Record<string, string>;
  width: BlockWidth;
  align: BlockAlign;
  bgColor: string;
}

export interface NewsMeta {
  title: string;
  slug: string;
  excerpt: string;
  category: "NEWS" | "ANNOUNCEMENT" | "ARTICLE" | "EVENT";
  imageUrl: string;
  published: boolean;
}

export function blocksToJson(blocks: Block[]): string {
  return JSON.stringify(blocks);
}

export function jsonToBlocks(content: string): Block[] {
  if (!content) return [];
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed.map(b => ({
      width: "100" as BlockWidth,
      align: "left" as BlockAlign,
      bgColor: "",
      ...b,
    }));
    return [];
  } catch {
    if (content.trim().startsWith("<")) {
      return [{ id: crypto.randomUUID(), type: "text" as BlockType, data: { html: content }, width: "100" as BlockWidth, align: "left" as BlockAlign, bgColor: "" }];
    }
    return [];
  }
}

export function blocksToHtml(blocks: Block[]): string {
  return blocks.map(b => {
    switch (b.type) {
      case "text": return b.data.html || "";
      case "heading": return `<h${b.data.level || "2"}>${b.data.text || ""}</h${b.data.level || "2"}>`;
      case "image": return b.data.url ? `<img src="${b.data.url}" alt="${b.data.alt || ""}" />` : "";
      case "youtube": {
        const match = (b.data.url || "").match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([a-zA-Z0-9_-]{11})/);
        return match ? `<iframe src="https://www.youtube.com/embed/${match[1]}" frameborder="0" allowfullscreen style="width:100%;height:360px;border-radius:8px;"></iframe>` : "";
      }
      case "quote": return `<blockquote>${b.data.text || ""}</blockquote>`;
      case "divider": return `<hr />`;
      default: return "";
    }
  }).join("\n");
}

export function uid(): string {
  return crypto.randomUUID();
}

export const UIMP_COLORS = [
  { label: "Прозорий", value: "" },
  { label: "Лісовий зелений", value: "#1C3A2E" },
  { label: "Золото", value: "#D4A843" },
  { label: "М'ята", value: "#E8F5E0" },
  { label: "Теплий крем", value: "#FAF6F0" },
  { label: "Теплий пісок", value: "#E8D5B7" },
  { label: "Пильна троянда", value: "#C4919A" },
  { label: "Білий", value: "#FFFFFF" },
  { label: "Темний", value: "#1a1a1a" },
];

export const WIDTH_OPTIONS: { value: BlockWidth; label: string }[] = [
  { value: "25",  label: "¼" },
  { value: "33",  label: "⅓" },
  { value: "50",  label: "½" },
  { value: "66",  label: "⅔" },
  { value: "75",  label: "¾" },
  { value: "100", label: "Full" },
];

// Пресети, до яких resize підхоплюється в межах ±0.8%, щоб зручно «клацнути» стандартну ширину
export const WIDTH_SNAP_PRESETS = [25, 33, 50, 66, 75, 100];