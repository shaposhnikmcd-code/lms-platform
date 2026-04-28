import React from "react";
import { sanitizeHtml } from "@/lib/sanitizeHtml";

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
  | "card";

export interface Block {
  id: string;
  type: BlockType;
  data: Record<string, string>;
  width?: string;
  x?: number;
  y?: number;
  height?: number;
  align?: "left" | "center" | "right";
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

interface OverlayShape {
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
  letterSpacing?: number;
  lineHeight?: number;
  href?: string;
}

// Рендер ВНУТРІШНОСТІ блока (без обгортки з padding/border). Викликається з
// AbsoluteBlockRender і SequentialBlockRender. Тут — ВСІ типи блоків,
// включно з overlays на image, card-кнопкою, youtube-embed.
export function BlockInner({ block }: { block: Block }) {
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
      return (
        <Tag
          data-news-block-type="heading"
          data-level={level}
          style={{
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
    }

    case "image": {
      if (!block.data.url) return null;
      let overlays: OverlayShape[] = [];
      try {
        const parsed = JSON.parse(block.data.overlays || "[]");
        if (Array.isArray(parsed)) overlays = parsed as OverlayShape[];
      } catch {
        /* ignore */
      }
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
          {overlays.map((ov) => {
            const r = ov.radius ?? (ov.bgColor ? 4 : 0);
            const radiusCss = r >= 999 ? "9999px" : `${r}px`;
            const padX = ov.bgColor
              ? Math.max(10, Math.round(ov.fontSize * 0.5))
              : 6;
            const padY = ov.bgColor
              ? Math.max(4, Math.round(ov.fontSize * 0.2))
              : 2;
            const hasSize =
              typeof ov.w === "number" && typeof ov.h === "number";
            const safeHref =
              ov.href && /^(https?:\/\/|\/|mailto:|tel:)/i.test(ov.href)
                ? ov.href
                : "";
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
              letterSpacing: ov.letterSpacing
                ? `${ov.letterSpacing}px`
                : "normal",
              lineHeight: ov.lineHeight || 1.2,
              textAlign: ov.align || "center",
              textShadow: ov.bgColor
                ? "none"
                : "0 2px 8px rgba(0,0,0,0.5)",
              whiteSpace: "pre-wrap",
              padding: `${padY}px ${padX}px`,
              borderRadius: radiusCss,
              boxShadow: ov.shadow
                ? "0 4px 16px rgba(0,0,0,0.35)"
                : "none",
              display: hasSize ? "flex" : "inline-block",
              alignItems: hasSize ? "center" : undefined,
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
                  {...(external
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
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
          })}
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

    default:
      return null;
  }
}

// Обгортка блока для AbsoluteCanvas (desktop). Розмір — за x/y/width/height блока.
// Padding ідентичний з editor/BlockItem.tsx (тільки 16px по горизонталі — header у білдері
// плаває absolute поза блоком, тому вертикального padding теж немає).
export function AbsoluteBlockRender({ block }: { block: Block }) {
  const w = Number(block.width) || 100;
  const x = block.x ?? 0;
  const y = block.y ?? 0;
  const h = block.height;
  return (
    <div
      data-news-block
      style={{
        position: "absolute",
        left: `${x}%`,
        top: `${y}px`,
        width: `${w}%`,
        height: h ? `${h}px` : "auto",
        background: block.bgColor || "transparent",
        borderRadius: block.bgColor ? "8px" : 0,
        padding: "0 16px",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <BlockInner block={block} />
    </div>
  );
}

// Послідовний рендер для mobile / fallback (коли в блоків немає x/y).
// Стікає вертикально, ігноруючи width%.
export function SequentialBlockRender({ block }: { block: Block }) {
  return (
    <div
      style={{
        margin: "0.8em 0",
        background: block.bgColor || "transparent",
        borderRadius: block.bgColor ? "8px" : 0,
        padding: block.bgColor ? "10px 14px" : 0,
      }}
    >
      <BlockInner block={block} />
    </div>
  );
}
