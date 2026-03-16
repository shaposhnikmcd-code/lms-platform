import { Block, BgColor } from "./newsTypes";
import { getBlockWrapperStyle, getVideoEmbed, BG_STYLES } from "./newsUtils";

function getTextColor(bg: BgColor): string {
  return BG_STYLES[bg].color as string ?? "#374151";
}

function getYoutubeThumbnail(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  if (yt) return "https://img.youtube.com/vi/" + yt[1] + "/hqdefault.jpg";
  return null;
}

interface Props {
  block: Block;
  editorMode?: boolean;
}

export default function BlockRenderer({ block, editorMode = false }: Props) {
  const wrapperStyle = getBlockWrapperStyle(block);
  const textColor = getTextColor(block.bg);
  const hasCustomColor = !!BG_STYLES[block.bg].color;

  // В editorMode — весь блок не реагує на події мишки
  const rootStyle: React.CSSProperties = editorMode
    ? { ...wrapperStyle, pointerEvents: "none", userSelect: "none" }
    : wrapperStyle;

  switch (block.type) {
    case "hero":
      return (
        <div style={rootStyle}>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "8px", color: hasCustomColor ? textColor : "#1C3A2E" }}>
            {block.data.title || ""}
          </h2>
          {block.data.subtitle && (
            <p style={{ color: hasCustomColor ? "rgba(255,255,255,0.75)" : "#6b7280", fontSize: "1rem" }}>
              {block.data.subtitle}
            </p>
          )}
        </div>
      );

    case "heading":
      return (
        <div style={rootStyle}>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: hasCustomColor ? textColor : "#1C3A2E" }}>
            {block.data.text || ""}
          </h2>
        </div>
      );

    case "text":
      return (
        <div style={rootStyle}>
          <p style={{ lineHeight: 1.7, whiteSpace: "pre-wrap", fontSize: "1.125rem", color: hasCustomColor ? textColor : "#374151" }}>
            {block.data.content || ""}
          </p>
        </div>
      );

    case "image":
      return block.data.url ? (
        <div style={{ ...rootStyle, padding: 0 }}>
          <img
            src={block.data.url}
            alt={block.data.alt || ""}
            draggable={false}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", borderRadius: "12px", pointerEvents: "none" }}
          />
        </div>
      ) : (
        <div style={{ ...rootStyle, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "120px", border: "2px dashed #e5e7eb", backgroundColor: "#f9fafb", color: "#9ca3af", fontSize: "0.875rem" }}>
          {"Фото не вибрано"}
        </div>
      );

    case "gallery":
      return (block.data.images as string[]).length > 0 ? (
        <div style={rootStyle}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
            {(block.data.images as string[]).map((url, i) => (
              <img key={i} src={url} alt="" draggable={false} style={{ width: "100%", height: "160px", objectFit: "cover", borderRadius: "8px", pointerEvents: "none" }} />
            ))}
          </div>
        </div>
      ) : (
        <div style={{ ...rootStyle, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "80px", border: "2px dashed #e5e7eb", backgroundColor: "#f9fafb", color: "#9ca3af", fontSize: "0.875rem" }}>
          {"Галерея порожня"}
        </div>
      );

    case "video": {
      const embed = getVideoEmbed(block.data.url || "");
      const thumbnail = getYoutubeThumbnail(block.data.url || "");

      if (editorMode) {
        return thumbnail ? (
          <div style={{ ...rootStyle, padding: 0, position: "relative" }}>
            <img
              src={thumbnail}
              alt="video preview"
              draggable={false}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", borderRadius: "12px", pointerEvents: "none" }}
            />
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.3)", borderRadius: "12px", pointerEvents: "none" }}>
              <div style={{ width: "48px", height: "48px", background: "rgba(255,255,255,0.9)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: "1.25rem", marginLeft: "4px" }}>{"▶"}</span>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ ...rootStyle, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "120px", gap: "8px", color: hasCustomColor ? textColor : "#6b7280" }}>
            <span style={{ fontSize: "2rem" }}>{"▶"}</span>
            <span style={{ fontSize: "0.875rem" }}>{block.data.url || "Відео не додано"}</span>
          </div>
        );
      }

      return embed ? (
        <div style={{ ...wrapperStyle, padding: 0 }}>
          <iframe
            src={embed}
            style={{ width: "100%", height: "100%", minHeight: "200px", borderRadius: "12px", border: "none", display: "block" }}
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        </div>
      ) : (
        <div style={{ ...wrapperStyle, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "120px", gap: "8px", color: hasCustomColor ? textColor : "#6b7280" }}>
          <span style={{ fontSize: "2rem" }}>{"▶"}</span>
          <span style={{ fontSize: "0.875rem" }}>{block.data.url || "Відео не додано"}</span>
        </div>
      );
    }

    case "quote":
      return (
        <div style={rootStyle}>
          <blockquote style={{ borderLeft: "4px solid #D4A843", paddingLeft: "24px", margin: 0 }}>
            <p style={{ fontSize: "1.25rem", fontStyle: "italic", lineHeight: 1.6, color: hasCustomColor ? textColor : "#374151" }}>
              {block.data.text || ""}
            </p>
            {block.data.author && (
              <cite style={{ display: "block", marginTop: "8px", fontSize: "0.875rem", fontStyle: "normal", color: hasCustomColor ? "rgba(255,255,255,0.6)" : "#9ca3af" }}>
                {"— "}{block.data.author}
              </cite>
            )}
          </blockquote>
        </div>
      );

    case "divider":
      return (
        <div style={{ padding: "8px 0", width: "100%", pointerEvents: editorMode ? "none" : "auto" }}>
          <hr style={{ border: "none", borderTop: "1px solid #e5e7eb" }} />
        </div>
      );

    case "list":
      return (
        <div style={rootStyle}>
          <ul style={{ listStyle: "disc", paddingLeft: "24px", margin: 0 }}>
            {(block.data.items as string[]).map((item, i) => (
              <li key={i} style={{ fontSize: "1.125rem", marginBottom: "8px", color: hasCustomColor ? textColor : "#374151" }}>
                {item}
              </li>
            ))}
          </ul>
        </div>
      );

    case "cta":
      return (
        <div style={rootStyle}>
          <a href={block.data.url || "#"} style={{ display: "inline-block", backgroundColor: "#D4A843", color: "#1C3A2E", fontWeight: 700, padding: "16px 32px", borderRadius: "12px", fontSize: "1.125rem", textDecoration: "none", pointerEvents: "none" }}>
            {block.data.text || "Кнопка"}
          </a>
        </div>
      );

    default:
      return null;
  }
}