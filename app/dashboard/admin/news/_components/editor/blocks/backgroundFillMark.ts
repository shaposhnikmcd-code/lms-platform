import { Mark, mergeAttributes } from "@tiptap/core";

// TipTap inline mark — "підкладка під написом". Дзеркалить bgColor+radius+shadow
// з OverlayToolbar (Текст на фото), але на рівні TipTap-mark, тож:
//   • користувач може застосувати лише до виділеного тексту (а не всього блока);
//   • рендериться однаково в білдері та на public (через серіалізацію в HTML).
// Окремий mark (не extends Highlight) — щоб не конфліктувати з секцією
// "Виділення" (Word-style маркер з WORD_HIGHLIGHT_COLORS).

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    backgroundFill: {
      setBackgroundFill: (attrs: { color?: string; radius?: number | null; shadow?: boolean | null }) => ReturnType;
      updateBackgroundFill: (attrs: { color?: string; radius?: number | null; shadow?: boolean | null }) => ReturnType;
      unsetBackgroundFill: () => ReturnType;
    };
  }
}

export const BackgroundFill = Mark.create({
  name: "backgroundFill",

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      color: { default: null },
      radius: { default: null },
      shadow: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-bgfill]" }];
  },

  renderHTML({ HTMLAttributes }) {
    const { color, radius, shadow, ...rest } = HTMLAttributes as Record<string, unknown>;
    const styles: string[] = [];
    if (color) styles.push(`background-color:${color}`);
    if (radius != null) styles.push(`border-radius:${radius}px`);
    if (shadow) styles.push("box-shadow:0 2px 6px rgba(0,0,0,0.18)");
    // padding/inline-block потрібен щоб radius+shadow були видимі
    if (styles.length) {
      styles.push("padding:0.05em 0.35em");
      styles.push("box-decoration-break:clone");
      styles.push("-webkit-box-decoration-break:clone");
    }
    return [
      "span",
      mergeAttributes(rest as Record<string, unknown>, {
        "data-bgfill": "",
        style: styles.join(";"),
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setBackgroundFill: (attrs) => ({ commands }) => commands.setMark(this.name, attrs),
      updateBackgroundFill: (attrs) => ({ commands }) => commands.updateAttributes(this.name, attrs),
      unsetBackgroundFill: () => ({ commands }) => commands.unsetMark(this.name),
    };
  },
});
