// Каталог шрифтів переїхав у спільний [lib/news/fonts.ts], щоб і admin-білдер,
// і публічні /news-сторінки тягнули той самий Google Fonts stylesheet із одного
// джерела правди. Цей файл лишається re-export-shim-ом для наявних імпортів
// (NewsEditor / TemplateEditor / ImageEditor).
export * from "@/lib/news/fonts";
