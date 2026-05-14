import { Extension } from "@tiptap/core";

// TipTap extension: атрибут font-weight на TextStyle mark. Дзеркало логіки
// @tiptap/extension-text-style/FontSize. Без власного mark — все шиється у
// існуючий <span style="..."> від TextStyle, sanitizeHtml вже пропускає
// font-weight через свій regex.

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fontWeight: {
      setFontWeight: (weight: string | number) => ReturnType;
      unsetFontWeight: () => ReturnType;
    };
  }
}

export const FontWeight = Extension.create({
  name: "fontWeight",

  addOptions() {
    return { types: ["textStyle"] };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types as string[],
        attributes: {
          fontWeight: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.fontWeight || null,
            renderHTML: (attrs: Record<string, unknown>) => {
              const w = attrs.fontWeight;
              if (!w) return {};
              // font-weight + font-variation-settings 'wght' разом — на variable
              // шрифтах (Inter, Roboto Flex) дає плавну зміну ваги по всьому
              // діапазону 100..900. На non-variable шрифтах браузер сам обере
              // найближчу доступну вагу — без fake-stroke хаків, що виглядали
              // дешево. Користувач має обрати variable шрифт у dropdown
              // «Шрифт» для плавної жирності.
              return {
                style: `font-weight: ${w};font-variation-settings: 'wght' ${w}`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setFontWeight:
        (weight: string | number) =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontWeight: String(weight) }).run(),
      unsetFontWeight:
        () =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontWeight: null }).removeEmptyTextStyle().run(),
    };
  },
});
