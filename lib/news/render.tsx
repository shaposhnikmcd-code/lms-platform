import React from "react";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import PreviewCardScale from "./PreviewCardScale";

// ⚠️ ОДИН ДЖЕРЕЛО ПРАВДИ для рендера блоків новини.
//
// Цей файл рендерить блоки ОДНАКОВО на трьох поверхнях:
//   1) Білдер (адмін → редактор) — використовує BlockInner всередині своєї absolute canvas.
//   2) Адмін-список новин (expanded preview картки) — викликає <ScaledNewsPreview/>.
//   3) Публічна сторінка /[locale]/news/[slug] — використовує AbsoluteCanvas + AbsoluteBlockRender.
//
// Якщо щось у цьому файлі змінюється — воно змінюється у всіх трьох поверхнях одразу.
// Це зроблено навмисно. НЕ роздуплюй render-код назад по сторінках.

export type BlockType =
  | "text"
  | "heading"
  | "image"
  | "youtube"
  | "quote"
  | "divider"
  | "card"
  | "newsCard";

export interface Block {
  id: string;
  type: BlockType;
  data: Record<string, string>;
  width?: string;
  x?: number;
  y?: number;
  height?: number;
  align?: "left" | "center" | "right";
  vAlign?: "top" | "center" | "bottom";
  bgColor?: string;
}

// Ширина канваса в пікселях. Це ЄДИНЕ джерело правди — editor і public імпортують
// звідси через @/lib/news/render. Будь-яка зміна автоматично синхронізує обидві
// поверхні, тому вигляд у білдері і на сайті завжди однаковий.
//
// 2026-04-28: 832 → 920. Користувач хоче ширшу робочу область. Старі image-блоки
// з збереженою px-висотою можуть мати трохи розтягнуту/стиснуту пропорцію на
// public — щоб виправити, відкрити/зберегти новину в редакторі (auto-aspect
// effect у BlockItem перерахує height під нову ширину).
export const CANVAS_WIDTH = 920;
/** Стандартна ширина канвасу білдера превʼю-картки `/dashboard/admin/news/[id]/preview`.
 *  Підібрана так, щоб WYSIWYG в адмінці максимально близько співпадав з тим,
 *  як картка рендериться у newsCard-блоках на /news (33–50% від CANVAS_WIDTH).
 *  Не змінюй без міграції — y-координати блоків зберігаються в px і прив'язані
 *  до цього розміру; зміна без перерахунку зрушить лейаути існуючих превʼю. */
export const PREVIEW_CARD_WIDTH = 360;
/** Стандартна ВИСОТА канвасу білдера превʼю-картки. Картка фіксована 360×400,
 *  тому всюди де newsCard з кастомним previewContent рендериться — обмежуємо
 *  висоту цим значенням (з overflow:hidden), щоб повторити те, що менеджер
 *  бачив у білдері. canvasHeight(previewBlocks) НЕ використовуємо, бо застарілі
 *  дані можуть мати block.height > 400 від раннього buggy auto-aspect. */
export const PREVIEW_CARD_HEIGHT = 400;

// ── Спільна типографіка блоків (білдер + public) ──────────────────────────────
// Білдер і публічна сторінка ОБОВ'ЯЗКОВО мають рендерити текст з однаковими
// font-size / line-height / margin. Інакше блок з фіксованою висотою, заданою
// в білдері, обрізає контент на public. Цей CSS injectиться:
//   1) [slug]/page.tsx — для public absolute desktop AND mobile sequential.
//   2) ScaledNewsPreview — для admin-preview списку новин.
//   3) Кожен builder-editor (TextEditor / HeadingEditor / QuoteEditor) обгортає
//      EditorContent у `<div data-news-block-type="...">` щоб ці селектори теж
//      спрацювали на ProseMirror всередині.
//
// ВАЖЛИВО: не задавати font-size на .ProseMirror в builder-editor'ах — нехай
// успадковується через cascade. Інакше переоб'являти доведеться у двох місцях.
export const NEWS_BLOCK_FF = "-apple-system, BlinkMacSystemFont, sans-serif";

// ВАЖЛИВО для consistency builder ↔ public:
// Tailwind preflight у проєкті скидає margin для p/ul/ol/h*/blockquote до 0.
// Builder (TipTap всередині nashok-builder layout) успадковує цей reset, тому
// показує tight-параграфи. Якщо public CSS додасть 0.x em margin, public
// розійдеться з builder. Тримаємо margin: 0 на всіх елементах контенту, а
// візуальний "ритм" задає line-height. Для h1/h2/h3 у блоку Текст лишаємо
// малий margin-bottom, щоб підзаголовок не "склеювався" з абзацом нижче.
export const NEWS_BLOCK_CSS = `
  [data-news-block-type="text"] {
    font-family: ${NEWS_BLOCK_FF};
    font-size: 15px;
    line-height: 1.7;
  }
  [data-news-block-type="text"] p { margin: 0 }
  [data-news-block-type="text"] h1 { font-size: 1.7em; font-weight: 700; line-height: 1.25; margin: 0.4em 0 0.2em }
  [data-news-block-type="text"] h2 { font-size: 1.35em; font-weight: 700; line-height: 1.25; margin: 0.4em 0 0.2em }
  [data-news-block-type="text"] h3 { font-size: 1.15em; font-weight: 700; line-height: 1.25; margin: 0.4em 0 0.2em }
  [data-news-block-type="text"] ul { list-style: disc; padding-left: 1.5em; margin: 0 }
  [data-news-block-type="text"] ol { list-style: decimal; padding-left: 1.5em; margin: 0 }

  [data-news-block-type="heading"] {
    font-family: ${NEWS_BLOCK_FF};
    font-weight: 700;
    line-height: 1.2;
    margin: 0;
  }
  [data-news-block-type="heading"][data-level="1"] { font-size: 30px }
  [data-news-block-type="heading"][data-level="2"] { font-size: 24px }
  [data-news-block-type="heading"][data-level="3"] { font-size: 20px }
  [data-news-block-type="heading"] p { margin: 0 }
  /* Лінки в заголовках: текст не міняє ні кольору, ні підкреслення; маркер
     клікабельності — золотиста external-link стрілка ↗ після слова. !important
     перебиває UA :link стилі. */
  [data-news-block-type="heading"] a,
  [data-news-block-type="heading"] a:link,
  [data-news-block-type="heading"] a:visited {
    text-decoration: none !important;
    color: inherit !important;
    cursor: pointer;
  }
  /* External-link icon в заголовку. Розташовуємо ::after на ОСТАННЬОМУ <span>
     всередині <a> (там лежить inline-color з TipTap TextStyle), а fallback —
     прямо на <a> якщо span-а нема. Так icon завжди успадковує реальний колір
     тексту, який бачить юзер, а не дефолтний контраст від <h1>. */
  [data-news-block-type="heading"] a:not(:has(span))::after,
  [data-news-block-type="heading"] a > span:last-child::after {
    content: "";
    display: inline-block;
    width: 0.55em;
    height: 0.55em;
    margin-left: 0.28em;
    /* Піднімаємо icon ~15% від font-size — стандартна "superscript-style"
       позиція для external-link маркерів (як у Wikipedia/MDN). */
    vertical-align: 0.18em;
    background-color: currentColor;
    -webkit-mask: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6'/%3E%3Cpath d='M15 3h6v6'/%3E%3Cpath d='M10 14 21 3'/%3E%3C/svg%3E") no-repeat center / contain;
    mask: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6'/%3E%3Cpath d='M15 3h6v6'/%3E%3Cpath d='M10 14 21 3'/%3E%3C/svg%3E") no-repeat center / contain;
    opacity: 0.6;
    transition: transform 0.15s, opacity 0.15s;
  }
  [data-news-block-type="heading"] a:hover:not(:has(span))::after,
  [data-news-block-type="heading"] a:hover > span:last-child::after {
    opacity: 0.95;
    transform: translate(1px, -1px);
  }

  [data-news-block-type="quote"] {
    font-family: ${NEWS_BLOCK_FF};
    font-size: 14px;
    line-height: 1.6;
    font-style: italic;
  }
  [data-news-block-type="quote"] p { margin: 0 }
  [data-news-block-type="quote"] ul { list-style: disc; padding-left: 1.5em; margin: 0 }
  [data-news-block-type="quote"] ol { list-style: decimal; padding-left: 1.5em; margin: 0 }

  [data-news-block-type] strong { font-weight: 700 }
  [data-news-block-type] em { font-style: italic }
  [data-news-block-type] u { text-decoration: underline }
  [data-news-block-type] s { text-decoration: line-through }
  [data-news-block-type] a { color: #0EA5E9; text-decoration: underline }
  [data-news-block-type] mark { padding: 0 2px; border-radius: 2px }
`;

// Fallback-висоти для блоків без явної .height і без aspectRatio.
// Має ЗБІГАТИСЬ з LEGACY_HEIGHT у editor/types.ts. Інакше білдер і public
// покажуть різну висоту для блоків без явно заданої висоти (особливо image).
export const LEGACY_H: Record<BlockType, number> = {
  heading: 80,
  text: 180,
  image: 300,
  youtube: 360,
  quote: 120,
  divider: 40,
  card: 280,
  newsCard: 380, // одна картка (image 16:9 + texts), висота природно ~370px при 32% width
};

// Конвертує будь-який вживаний YouTube URL у embed-URL для <iframe>.
// Підтримує: watch?v=, youtu.be/, /embed/, /shorts/, /playlist?list= і
// "watch?v=...&list=..." (одне відео в контексті playlist).
export function getEmbedUrl(url: string): string {
  if (!url) return "";
  // Playlist (без конкретного відео)
  const playlistOnly = url.match(
    /youtube\.com\/playlist\?(?:[^#]*&)?list=([a-zA-Z0-9_-]+)/
  );
  if (playlistOnly) {
    return `https://www.youtube.com/embed/videoseries?list=${playlistOnly[1]}`;
  }
  // Окреме відео (можливо з ?list= параметром, якщо є — embed-имо в контексті playlist)
  const video = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/
  );
  if (video) {
    const list = url.match(/[?&]list=([a-zA-Z0-9_-]+)/)?.[1];
    return list
      ? `https://www.youtube.com/embed/${video[1]}?list=${list}`
      : `https://www.youtube.com/embed/${video[1]}`;
  }
  return "";
}

export function parseBlocks(content: string): { isJson: boolean; blocks: Block[] } {
  if (!content) return { isJson: false, blocks: [] };
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return { isJson: true, blocks: parsed as Block[] };
  } catch {}
  return { isJson: false, blocks: [] };
}

export function hasCoords(blocks: Block[]): boolean {
  return blocks.some((b) => typeof b.x === "number" && typeof b.y === "number");
}

// Обчислює висоту канваса (px) з урахуванням aspectRatio для image-блоків.
// Використовується як SSR-початкове значення; AbsoluteCanvas потім переміряє по DOM.
export function canvasHeight(blocks: Block[]): number {
  return Math.max(
    400,
    ...blocks.map((b) => {
      let h = b.height;
      if (!h && b.type === "image" && b.data?.aspectRatio) {
        const ar = parseFloat(b.data.aspectRatio);
        const wPct = Math.max(1, Number(b.width) || 100);
        if (ar > 0) h = Math.round(((CANVAS_WIDTH * wPct) / 100) / ar);
      }
      if (!h || h <= 0) h = LEGACY_H[b.type] ?? 200;
      return (b.y ?? 0) + h + 60;
    })
  );
}

// Виправляє локалізовані блоки оригінальними URL-ами для image/youtube.
// DeepL інколи ламає URL у data — тягнемо їх з UK-оригіналу за індексом.
export function repairBlocks(localized: Block[], original: Block[]): Block[] {
  if (!original.length) return localized;
  return localized.map((b, i) => {
    const orig = original[i];
    if (!orig || orig.type !== b.type) return b;
    if (b.type === "image" || b.type === "youtube") {
      return { ...b, data: { ...b.data, url: orig.data.url || b.data.url } };
    }
    return b;
  });
}

// Прев'ю-дані новини для блока `newsCard` (передаються згори, з server-prefetch).
// Лежать тут, а не в БД-моделі, бо рендеримо як на public, так і в адмін-превʼю
// (білдер сторінки /news), де дані можуть бути undefined → показуємо placeholder.
export interface NewsListItemForBlock {
  id: string;
  title: string;
  titleEn?: string | null;
  titlePl?: string | null;
  slug: string;
  excerpt: string | null;
  excerptEn?: string | null;
  excerptPl?: string | null;
  imageUrl: string | null;
  category: string;
  createdAt: string | Date;
  authorName?: string | null;
  /** JSON-блоки новини (lib/news/render формат). Потрібно для displayMode="expanded" — інлайн-рендер. */
  content?: string | null;
  contentEn?: string | null;
  contentPl?: string | null;
  /** Кастомний layout превʼю-картки (білдер /news/[id]/preview). Якщо задано — використовується
   *  замість дефолтного auto-card layout у newsCard з displayMode="preview". */
  previewContent?: string | null;
  previewContentEn?: string | null;
  previewContentPl?: string | null;
  pageBgColor?: string | null;
  /** Якщо задано — render-имо preview через TemplatePreviewCard замість блокового. */
  templateKind?: "ARTICLE" | "EVENT" | null;
  templateData?: string | null;
}

export interface OverlayShape {
  id: string;
  text: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  fontSize: number;
  color: string;
  bgColor?: string;
  weight: number;
  radius?: number;
  shadow?: boolean;
  fontFamily?: string;
  italic?: boolean;
  underline?: boolean;
  align?: "left" | "center" | "right";
  vAlign?: "top" | "center" | "bottom";
  letterSpacing?: number;
  lineHeight?: number;
  href?: string;
}

// Парсимо raw JSON-рядок overlays із block.data.overlays / photo.overlays.
// Викидаємо невалідні елементи, ловимо JSON помилки → []. Безпечно для server
// та client render (без залежностей).
export function parseImageOverlays(raw: string | undefined | null): OverlayShape[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((o): o is OverlayShape =>
      o && typeof o.id === "string" && typeof o.text === "string"
    );
  } catch {
    return [];
  }
}

// Reusable render одного overlay-напису. Використовується в:
//   1) BlockInner case "image" (звичайний блок-image у білдері Новин)
//   2) EventTemplate (overlay-text над фото фахівця у шаблоні Event)
// Логіка стилю/позиції/посилання ідентична — інакше WYSIWYG між контекстами
// розходитиметься. Якщо потрібен tweak — міняйте тут.
export function renderImageOverlay(ov: OverlayShape): React.ReactNode {
  const r = ov.radius ?? (ov.bgColor ? 4 : 0);
  const radiusCss = r >= 999 ? "9999px" : `${r}px`;
  const padX = ov.bgColor ? Math.max(10, Math.round(ov.fontSize * 0.5)) : 6;
  const padY = ov.bgColor ? Math.max(4, Math.round(ov.fontSize * 0.2)) : 2;
  const hasSize = typeof ov.w === "number" && typeof ov.h === "number";
  const safeHref =
    ov.href && /^(https?:\/\/|\/|mailto:|tel:)/i.test(ov.href) ? ov.href : "";
  const external = /^https?:\/\//i.test(safeHref);
  const commonStyle: React.CSSProperties = {
    position: "absolute",
    left: `${ov.x}%`,
    top: `${ov.y}%`,
    width: hasSize ? `${ov.w}%` : "auto",
    height: hasSize ? `${ov.h}%` : "auto",
    color: ov.color,
    background: ov.bgColor || "transparent",
    fontSize: `${ov.fontSize}px`,
    fontWeight: ov.weight,
    fontFamily: ov.fontFamily || undefined,
    fontStyle: ov.italic ? "italic" : "normal",
    textDecoration: ov.underline ? "underline" : "none",
    letterSpacing: ov.letterSpacing ? `${ov.letterSpacing}px` : "normal",
    lineHeight: ov.lineHeight || 1.2,
    textAlign: ov.align || "center",
    textShadow: ov.bgColor ? "none" : "0 2px 8px rgba(0,0,0,0.5)",
    whiteSpace: "pre-wrap",
    padding: `${padY}px ${padX}px`,
    borderRadius: radiusCss,
    boxShadow: ov.shadow ? "0 4px 16px rgba(0,0,0,0.35)" : "none",
    display: hasSize ? "flex" : "inline-block",
    alignItems: hasSize
      ? ov.vAlign === "top"
        ? "flex-start"
        : ov.vAlign === "bottom"
          ? "flex-end"
          : "center"
      : undefined,
    justifyContent: hasSize
      ? ov.align === "left"
        ? "flex-start"
        : ov.align === "right"
          ? "flex-end"
          : "center"
      : undefined,
    boxSizing: "border-box",
    overflow: "hidden",
    pointerEvents: safeHref ? "auto" : "none",
    cursor: safeHref ? "pointer" : "default",
  };
  if (safeHref) {
    return (
      <a
        key={ov.id}
        href={safeHref}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        style={commonStyle}
      >
        {ov.text}
      </a>
    );
  }
  return (
    <span key={ov.id} style={commonStyle}>
      {ov.text}
    </span>
  );
}

// Рендер ВНУТРІШНОСТІ блока (без обгортки з padding/border). Викликається з
// AbsoluteBlockRender і SequentialBlockRender. Тут — ВСІ типи блоків,
// включно з overlays на image, card-кнопкою, youtube-embed.
//
// Опціональні parents-параметри:
//  - newsItems / locale — для блока `newsCard` (рендер карток новин на сторінці /news).
//    Передаються з server-prefetch у public; у білдері — мікро-фетч у NewsCardEditor.
export function BlockInner({
  block,
  newsItems,
  locale,
}: {
  block: Block;
  newsItems?: NewsListItemForBlock[];
  locale?: string;
}) {
  const align = block.align || "left";
  const textColor =
    block.bgColor === "#1C3A2E" || block.bgColor === "#1a1a1a"
      ? "#FAF6F0"
      : "#1C3A2E";

  switch (block.type) {
    case "text":
      return (
        <div
          data-news-block-type="text"
          style={{ textAlign: align, color: textColor }}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.data.html || "") }}
        />
      );

    case "heading": {
      const level = block.data.level || "2";
      const Tag = `h${level}` as "h1" | "h2" | "h3";
      // Новий формат: data.html (TipTap-rich). Fallback — data.text + старі
      // data.fontFamily/fontSize/color (legacy form-mode заголовки).
      const html = block.data.html;
      const customColor = block.data.color || "";
      const customFamily = block.data.fontFamily || "";
      const customSize = Number(block.data.fontSize) || 0;
      const headingTag = (
        <Tag
          data-news-block-type="heading"
          data-level={level}
          style={{
            width: "100%",
            color: customColor || textColor,
            textAlign: align,
            fontFamily: customFamily || undefined,
            // Custom size override через inline — інакше CSS rule бере дефолт
            // за рівнем (h1=30, h2=24, h3=20).
            fontSize: customSize > 0 ? `${customSize}px` : undefined,
          }}
          {...(html
            ? { dangerouslySetInnerHTML: { __html: sanitizeHtml(html) } }
            : {})}
        >
          {!html ? block.data.text : null}
        </Tag>
      );
      // Flex-обгортка для vertical-align ЛИШЕ якщо vAlign явно не дефолтний.
      // Інакше рендер як в старій версії — без зайвої обгортки → жодних
      // регресій у sequential/mobile рендері (де у блока може не бути висоти).
      const vAlign = block.vAlign;
      if (vAlign === "center" || vAlign === "bottom") {
        const flexAlign = vAlign === "center" ? "center" : "flex-end";
        return (
          <div style={{ display: "flex", width: "100%", height: "100%", alignItems: flexAlign }}>
            {headingTag}
          </div>
        );
      }
      return headingTag;
    }

    case "image": {
      if (!block.data.url) return null;
      const overlays = parseImageOverlays(block.data.overlays);
      const imgRadius = Number(block.data.imgRadius) || 0;
      // Per-corner radius: "TRBL" 4-char string of 0/1, default "1111".
      // Якщо undefined (старі блоки) — поведінка "all corners".
      const cornersStr = (block.data.imgRadiusCorners || "1111").padEnd(4, "1");
      const radiusCss = [0, 1, 2, 3]
        .map(i => `${cornersStr[i] === "1" ? imgRadius : 0}px`)
        .join(" ");
      return (
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            borderRadius: radiusCss,
            overflow: "hidden",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={block.data.url}
            alt={block.data.alt || ""}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "fill",
              display: "block",
            }}
          />
          {overlays.map(renderImageOverlay)}
        </div>
      );
    }

    case "youtube": {
      const embed = getEmbedUrl(block.data.url || "");
      return embed ? (
        <iframe
          src={embed}
          style={{
            width: "100%",
            height: "100%",
            minHeight: "200px",
            borderRadius: "8px",
            border: "none",
            display: "block",
          }}
          allowFullScreen
        />
      ) : null;
    }

    case "quote": {
      // Новий формат: data.html (rich text з модалки). Fallback — data.text
      // (legacy plain). Якщо html-немає — рендер як було раніше (звичайний текст).
      const html = block.data.html;
      return (
        <blockquote
          data-news-block-type="quote"
          style={{
            borderLeft: "4px solid #D4A843",
            margin: 0,
            padding: "0.5em 1em",
            background: "#E8F5E0",
            borderRadius: "0 6px 6px 0",
            color: textColor,
            textAlign: align,
            height: "100%",
            boxSizing: "border-box",
          }}
          {...(html
            ? { dangerouslySetInnerHTML: { __html: sanitizeHtml(html) } }
            : {})}
        >
          {!html ? block.data.text : null}
        </blockquote>
      );
    }

    case "divider":
      return (
        <hr
          style={{
            border: "none",
            borderTop: "2px solid #D4A843",
            margin: "0.8em 0",
          }}
        />
      );

    case "card": {
      const title = block.data.title || "";
      const subtitle = block.data.subtitle || "";
      const buttonLabel = block.data.buttonLabel || "";
      const buttonHref = block.data.buttonHref || "";
      const cardBg = block.data.bgColor || "#1C3A2E";
      const cardImg = block.data.bgImage || "";
      const cardTextColor = block.data.textColor || "#FAF6F0";
      const buttonBg = block.data.buttonBg || "#D4A843";
      const buttonColor = block.data.buttonColor || "#1C3A2E";
      const radius = Number(block.data.radius || "16");
      const cardAlign = (block.data.cardAlign || "center") as
        | "left"
        | "center"
        | "right";
      const itemAlign =
        cardAlign === "center"
          ? "center"
          : cardAlign === "right"
            ? "flex-end"
            : "flex-start";
      return (
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            borderRadius: `${radius}px`,
            overflow: "hidden",
            background: cardImg ? "transparent" : cardBg,
            padding: "32px 24px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            textAlign: cardAlign,
            boxSizing: "border-box",
          }}
        >
          {cardImg && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cardImg}
              alt=""
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                zIndex: 0,
              }}
            />
          )}
          {cardImg && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(0,0,0,0.35)",
                zIndex: 1,
              }}
            />
          )}
          <div
            style={{
              position: "relative",
              zIndex: 2,
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              alignItems: itemAlign,
            }}
          >
            {title && (
              <h3
                style={{
                  color: cardTextColor,
                  fontSize: "26px",
                  fontWeight: 700,
                  lineHeight: 1.2,
                  margin: 0,
                }}
              >
                {title}
              </h3>
            )}
            {subtitle && (
              <p
                style={{
                  color: cardTextColor,
                  fontSize: "14px",
                  lineHeight: 1.5,
                  margin: 0,
                  opacity: 0.9,
                }}
              >
                {subtitle}
              </p>
            )}
            {buttonLabel &&
              buttonHref &&
              (() => {
                const safe = /^(https?:\/\/|\/|mailto:|tel:)/i.test(buttonHref)
                  ? buttonHref
                  : "#";
                const external = /^https?:\/\//i.test(safe);
                return (
                  <a
                    href={safe}
                    {...(external
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                    style={{
                      display: "inline-block",
                      padding: "12px 28px",
                      borderRadius: "8px",
                      background: buttonBg,
                      color: buttonColor,
                      fontSize: "14px",
                      fontWeight: 700,
                      textDecoration: "none",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {buttonLabel}
                  </a>
                );
              })()}
          </div>
        </div>
      );
    }

    case "newsCard": {
      const newsId = block.data.newsId || "";
      const displayMode = block.data.displayMode === "expanded" ? "expanded" : "preview";
      const item = newsItems?.find((n) => n.id === newsId);
      const lc = locale || "uk";
      const title = (n: NewsListItemForBlock) =>
        lc === "en" ? (n.titleEn ?? n.title) : lc === "pl" ? (n.titlePl ?? n.title) : n.title;
      const excerpt = (n: NewsListItemForBlock) =>
        lc === "en" ? (n.excerptEn ?? n.excerpt) : lc === "pl" ? (n.excerptPl ?? n.excerpt) : n.excerpt;
      const dateFmt = (d: string | Date) =>
        new Date(d).toLocaleDateString(lc === "uk" ? "uk-UA" : lc === "pl" ? "pl-PL" : "en-US");

      // Білдер: даних може не бути взагалі або newsId ще не вибрано → placeholder.
      if (!item) {
        return (
          <div
            style={{
              width: "100%",
              height: "100%",
              minHeight: 240,
              borderRadius: 16,
              border: "1.5px dashed #E8D5B7",
              background: "rgba(212,168,67,0.04)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#9B7C45",
              fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
              fontSize: 13,
              padding: 16,
              textAlign: "center",
              boxSizing: "border-box",
            }}
          >
            {newsId ? "Новина не знайдена або не опублікована" : "Перетягніть новину з правого бару"}
          </div>
        );
      }

      // ── EXPANDED (template-based) ──
      if (displayMode === "expanded" && item.templateKind && item.templateData) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { parseTemplateData } = require("./templates/types");
        const tplData = parseTemplateData(item.templateKind, item.templateData);
        if (item.templateKind === "ARTICLE") {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const ArticleTemplate = require("./templates/ArticleTemplate").default;
          return (
            <a href={`/${lc}/news/${item.slug}`} style={{ display: "block", textDecoration: "none", color: "inherit" }}>
              <ArticleTemplate data={tplData} />
            </a>
          );
        }
        // EVENT
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const EventTemplate = require("./templates/EventTemplate").default;
        // На /news у page-builder блоці шанурмо native cardWidth картки, але
        // не виходимо за ширину блока на канвасі — об'єдинюємо як maxWidth.
        const eventCardWidth = (tplData as { cardWidth?: number }).cardWidth || undefined;
        return (
          <a href={`/${lc}/news/${item.slug}`} style={{ display: "block", textDecoration: "none", color: "inherit" }}>
            <EventTemplate data={tplData} maxWidth={eventCardWidth} />
          </a>
        );
      }

      // ── EXPANDED (free-canvas, legacy) ──
      // Рендеримо ВИКЛЮЧНО блоки новини, як вони були зверстані в білдері.
      // Без cover/title/meta header-а і без footer-лінка — це повна репліка білдера новини.
      // Фон сторінки новини застосовуємо, бо її блоки могли бути зверстані з ним в розрахунку.
      if (displayMode === "expanded") {
        const localizedContent =
          lc === "en" && item.contentEn ? item.contentEn :
          lc === "pl" && item.contentPl ? item.contentPl :
          (item.content || "");
        const parsed = parseBlocks(localizedContent);
        const innerBlocks = parsed.isJson ? parsed.blocks : [];
        const newsBg = item.pageBgColor || "transparent";
        const innerCanvasH = innerBlocks.length > 0 ? canvasHeight(innerBlocks) : 0;

        if (innerBlocks.length === 0) {
          return (
            <div style={{ color: "#9CA3AF", fontSize: 13, padding: "12px", textAlign: "center" }}>
              Контент новини порожній.
            </div>
          );
        }

        return (
          <div
            style={{
              position: "relative",
              width: "100%",
              height: `${innerCanvasH}px`,
              background: newsBg,
            }}
          >
            {innerBlocks.map((b) => (
              <AbsoluteBlockRender
                key={b.id}
                block={b}
                newsItems={newsItems}
                locale={lc}
              />
            ))}
          </div>
        );
      }

      // ── PREVIEW (template-based) ──
      // Якщо новина базується на шаблоні (templateKind), рендеримо preview через
      // TemplatePreviewCard (auto з templateData). Жодних блоків — фіксована форма.
      // Розміри картки: ARTICLE — портретна 360×400, EVENT — `data.cardWidth`×400
      // (горизонтальна 2-кол з фото фахівця + інфо; менеджер контролює ширину).
      if (item.templateKind && item.templateData) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const TemplatePreviewCard = require("./templates/TemplatePreviewCard").default;
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { parseTemplateData } = require("./templates/types");
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { TEMPLATE_PREVIEW_DIMS: DIMS, getEventPreviewDims } = require("./templates/TemplatePreviewCard");
        const data = parseTemplateData(item.templateKind, item.templateData);
        const dims = item.templateKind === "EVENT"
          ? getEventPreviewDims(data)
          : (DIMS[item.templateKind] || { width: PREVIEW_CARD_WIDTH, height: PREVIEW_CARD_HEIGHT });
        const blockWPct = Number(block.width) || 100;
        const initialActualWidth = Math.max(60, (CANVAS_WIDTH * blockWPct) / 100);
        const initialScale = initialActualWidth / dims.width;
        return (
          <a
            href={`/${lc}/news/${item.slug}`}
            style={{
              display: "block",
              position: "relative",
              width: "100%",
              background: "transparent",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <PreviewCardScale
              baseWidth={dims.width}
              baseHeight={dims.height}
              initialScale={initialScale}
            >
              <TemplatePreviewCard kind={item.templateKind} data={data} disableLinks />
            </PreviewCardScale>
          </a>
        );
      }

      // ── PREVIEW (free-canvas, legacy) ──
      // Якщо адмін зверстав кастомний layout превʼю в /dashboard/admin/news/[id]/preview —
      // рендеримо ті блоки 1-в-1 (повна свобода компоновки). Інакше — дефолтний auto-card.
      const localizedPreview =
        lc === "en" && item.previewContentEn ? item.previewContentEn :
        lc === "pl" && item.previewContentPl ? item.previewContentPl :
        item.previewContent;
      if (localizedPreview) {
        const previewParsed = parseBlocks(localizedPreview);
        if (previewParsed.isJson && previewParsed.blocks.length > 0) {
          // newsCard preview має padding=0 на AbsoluteBlockRender (без -32). Усі
          // preview-блоки нормалізовані до однакового block.width % (auto-fit),
          // тому SSR-scale коректний; ResizeObserver уточнить після hydration.
          const blockWPct = Number(block.width) || 100;
          const initialActualWidth = Math.max(60, (CANVAS_WIDTH * blockWPct) / 100);
          const initialScale = initialActualWidth / PREVIEW_CARD_WIDTH;
          return (
            <a
              href={`/${lc}/news/${item.slug}`}
              style={{
                display: "block",
                position: "relative",
                width: "100%",
                background: "transparent",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <PreviewCardScale
                baseWidth={PREVIEW_CARD_WIDTH}
                baseHeight={PREVIEW_CARD_HEIGHT}
                initialScale={initialScale}
              >
                {previewParsed.blocks.map((b) => (
                  <AbsoluteBlockRender key={b.id} block={b} newsItems={newsItems} locale={lc} />
                ))}
              </PreviewCardScale>
            </a>
          );
        }
      }

      // Дефолтна auto-картка — як у класичному /news.
      return (
        <a
          href={`/${lc}/news/${item.slug}`}
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
            background: "#fff",
            borderRadius: 16,
            overflow: "hidden",
            boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          {item.imageUrl ? (
            <div style={{ width: "100%", aspectRatio: "16 / 9", overflow: "hidden", background: "#F3F0E8", flexShrink: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.imageUrl} alt={title(item) || ""} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </div>
          ) : (
            <div style={{ width: "100%", aspectRatio: "16 / 9", background: "linear-gradient(135deg,#1C3A2E,#2a4f3f)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 40, flexShrink: 0 }}>
              📰
            </div>
          )}
          <div style={{ padding: 20, flex: 1, display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9B7C45", marginBottom: 8 }}>
              {item.category}
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#1C3A2E", lineHeight: 1.3, marginBottom: 8 }}>
              {title(item)}
            </div>
            {excerpt(item) && (
              <div style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.5, marginBottom: 10, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {excerpt(item)}
              </div>
            )}
            <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: "auto" }}>
              {dateFmt(item.createdAt)}
              {item.authorName ? ` · ${item.authorName}` : ""}
            </div>
          </div>
        </a>
      );
    }

    default:
      return null;
  }
}

// Обгортка блока для AbsoluteCanvas (desktop). Розмір — за x/y/width/height блока.
// Padding ідентичний з editor/BlockItem.tsx (тільки 16px по горизонталі — header у білдері
// плаває absolute поза блоком, тому вертикального padding теж немає).
export function AbsoluteBlockRender({
  block,
  newsItems,
  locale,
}: {
  block: Block;
  newsItems?: NewsListItemForBlock[];
  locale?: string;
}) {
  const w = Number(block.width) || 100;
  const x = block.x ?? 0;
  const y = block.y ?? 0;
  const h = block.height;
  // newsCard preview: висота auto через aspect-ratio (392:400, з урахуванням
  // padding 0 16px на цьому ж div-і). Гарантує, що картка завжди має пропорції
  // 360×400 незалежно від block.height у БД (яка може застаріти).
  const isNewsCardPreview =
    block.type === "newsCard" &&
    (block.data.displayMode || "preview") === "preview";
  // borderRadius: явний `block.borderRadius` (з RadiusControl) має пріоритет;
  // інакше fallback на 8px при bgColor, 0 без bgColor (історична поведінка).
  // 999 → 9999 (pill).
  const resolvedRadius =
    typeof block.borderRadius === "number"
      ? (block.borderRadius >= 999 ? 9999 : block.borderRadius)
      : (block.bgColor ? 8 : 0);
  return (
    <div
      data-news-block
      style={{
        position: "absolute",
        left: `${x}%`,
        top: `${y}px`,
        width: `${w}%`,
        // newsCard preview: висота auto через aspect-ratio 360:400 — щоб картка
        // мала однакові пропорції незалежно від canvas-ширини. Усі preview-блоки
        // мусять мати однаковий block.width % (auto-fit нормалізує) → візуально
        // однаковий розмір.
        height: isNewsCardPreview ? "auto" : (h ? `${h}px` : "auto"),
        aspectRatio: isNewsCardPreview ? "360 / 400" : undefined,
        background: block.bgColor || "transparent",
        borderRadius: resolvedRadius,
        padding: isNewsCardPreview ? "0" : "0 16px",
        boxSizing: "border-box",
        // newsCard у будь-якому режимі може мати динамічний контент (expanded — повне тіло;
        // preview — кастомний layout з білдера превʼю). Дозволяємо overflow:visible щоб
        // блок ріс під природній розмір.
        overflow: block.type === "newsCard" ? "visible" : "hidden",
      }}
    >
      <BlockInner block={block} newsItems={newsItems} locale={locale} />
    </div>
  );
}

// Послідовний рендер для mobile / fallback (коли в блоків немає x/y).
// Стікає вертикально, ігноруючи width%.
export function SequentialBlockRender({
  block,
  newsItems,
  locale,
}: {
  block: Block;
  newsItems?: NewsListItemForBlock[];
  locale?: string;
}) {
  const resolvedRadius =
    typeof block.borderRadius === "number"
      ? (block.borderRadius >= 999 ? 9999 : block.borderRadius)
      : (block.bgColor ? 8 : 0);
  return (
    <div
      style={{
        margin: "0.8em 0",
        background: block.bgColor || "transparent",
        borderRadius: resolvedRadius,
        padding: block.bgColor ? "10px 14px" : 0,
      }}
    >
      <BlockInner block={block} newsItems={newsItems} locale={locale} />
    </div>
  );
}
