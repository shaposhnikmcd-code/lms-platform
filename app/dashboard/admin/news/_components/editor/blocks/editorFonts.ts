// Каталог шрифтів для редактора новин. Дзеркало UX MS Word, але з вебівських
// шрифтів, відібраних за критеріями:
//   1. Cyrillic-підтримка (українська не повинна падати на fallback).
//   2. Variable (axis 'wght') там де можливо — для плавного слайдера жирності.
//   3. Покриття 5 категорій: Sans / Serif / Display / Handwriting / Monospace.
//   4. Якість гліфів (Google Fonts curated).
//
// Шрифти підвантажуються через Google Fonts CDN (link rel="stylesheet" в
// editor-only компоненті — не торкає public сторінки). Family-string у `value`
// — це готова CSS font-family із fallback-ланцюгом.

export interface EditorFont {
  label: string;
  value: string;          // CSS font-family
  google: string;         // специфікація для Google Fonts API
  category: "sans" | "serif" | "display" | "handwriting" | "mono";
  variable: boolean;      // Чи має axis 'wght' (плавна жирність зі слайдером)
}

export const EDITOR_FONTS: EditorFont[] = [
  // Default (variable) — вантажиться через next/font/google в layout.tsx
  { label: "Inter (плавна жирність)", value: "var(--font-inter), Inter, system-ui, sans-serif", google: "", category: "sans", variable: true },

  // Sans-serif
  { label: "Roboto Flex",       value: "'Roboto Flex', system-ui, sans-serif",  google: "Roboto+Flex:wght@100..900",         category: "sans", variable: true },
  { label: "Open Sans",         value: "'Open Sans', system-ui, sans-serif",    google: "Open+Sans:wght@300..800",            category: "sans", variable: true },
  { label: "Montserrat",        value: "Montserrat, system-ui, sans-serif",     google: "Montserrat:wght@100..900",           category: "sans", variable: true },
  { label: "IBM Plex Sans",     value: "'IBM Plex Sans', system-ui, sans-serif",google: "IBM+Plex+Sans:wght@100;300;400;500;600;700", category: "sans", variable: false },

  // Serif
  { label: "Playfair Display",  value: "'Playfair Display', Georgia, serif",    google: "Playfair+Display:wght@400..900",     category: "serif", variable: true },
  { label: "Lora",              value: "Lora, Georgia, serif",                  google: "Lora:wght@400..700",                 category: "serif", variable: true },
  { label: "Merriweather",      value: "Merriweather, Georgia, serif",          google: "Merriweather:wght@300;400;700;900",  category: "serif", variable: false },
  { label: "EB Garamond",       value: "'EB Garamond', Georgia, serif",         google: "EB+Garamond:wght@400..800",          category: "serif", variable: true },
  { label: "Cormorant",         value: "'Cormorant Garamond', Georgia, serif",  google: "Cormorant+Garamond:wght@300;400;500;600;700", category: "serif", variable: false },

  // Display
  { label: "Oswald",            value: "Oswald, Impact, sans-serif",            google: "Oswald:wght@200..700",               category: "display", variable: true },
  { label: "Bebas Neue",        value: "'Bebas Neue', Impact, sans-serif",      google: "Bebas+Neue",                          category: "display", variable: false },
  { label: "Russo One",         value: "'Russo One', Impact, sans-serif",       google: "Russo+One",                           category: "display", variable: false },
  { label: "Cinzel",            value: "Cinzel, Georgia, serif",                google: "Cinzel:wght@400..900",               category: "display", variable: true },

  // Handwriting
  { label: "Caveat",            value: "Caveat, cursive",                       google: "Caveat:wght@400..700",               category: "handwriting", variable: true },
  { label: "Pacifico",          value: "Pacifico, cursive",                     google: "Pacifico",                            category: "handwriting", variable: false },

  // Monospace
  { label: "JetBrains Mono",    value: "'JetBrains Mono', Consolas, monospace", google: "JetBrains+Mono:wght@100..800",       category: "mono", variable: true },
  { label: "Fira Code",         value: "'Fira Code', Consolas, monospace",      google: "Fira+Code:wght@300..700",            category: "mono", variable: true },
];

/**
 * Збирає <link href> для Google Fonts API із усіх не-empty `google` рядків.
 * `display=swap` — text візібільний одразу, без FOIT. Один request на всі шрифти —
 * Google API оптимізує під один payload з кількома family.
 */
export function buildGoogleFontsHref(): string {
  const families = EDITOR_FONTS
    .filter(f => f.google)
    .map(f => `family=${f.google}`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}
