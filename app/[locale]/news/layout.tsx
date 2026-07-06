import { buildGoogleFontsHref } from "@/lib/news/fonts";

// Публічні /news-сторінки (список + деталь /news/{slug}) підвантажують той самий
// Google Fonts stylesheet, що й admin-білдер новин. Без нього вибраний менеджером
// шрифт (Playfair/Lora/Oswald…) не завантажувався на сайті — inline `fontFamily`
// стояв, але файл шрифту ніхто не запитував, тож текст падав на системний
// fallback. Домени googleapis/gstatic дозволені в CSP (next.config.mjs).
// display=swap → текст видно одразу; браузер лениво тягне woff2 лише для
// family, реально застосованих у DOM.
export default function NewsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link rel="stylesheet" href={buildGoogleFontsHref()} />
      {children}
    </>
  );
}
