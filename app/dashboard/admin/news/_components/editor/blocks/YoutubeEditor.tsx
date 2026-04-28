"use client";

import { Block } from "../types";
// Один парсер YouTube URL для білдера і public — підтримує playlist, shorts,
// watch?v=, youtu.be/. Дивись lib/news/render.tsx getEmbedUrl.
import { getEmbedUrl } from "@/lib/news/render";

const ff = "-apple-system, BlinkMacSystemFont, sans-serif";

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: "8px",
  borderWidth: "1.5px", borderStyle: "solid", borderColor: "#E8D5B7",
  background: "#FAF6F0", fontSize: "14px", color: "#1C3A2E",
  fontFamily: ff, outline: "none", boxSizing: "border-box",
};

interface Props {
  block: Block;
  onChange: (data: Record<string, string>) => void;
}

export default function YoutubeEditor({ block, onChange }: Props) {
  const embed = getEmbedUrl(block.data.url || "");

  // iframe заповнює весь wrapper блока (як на public — width:100%, height:100%).
  // URL-input — absolute toolbar ПОЗА блоком (під ним), щоб не з'їдати висоту блока
  // і щоб блок у білдері мав ту саму геометрію, що блок на public сайті.
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {embed ? (
        <iframe
          src={embed}
          style={{ width: "100%", height: "100%", borderRadius: "8px", border: "none", display: "block" }}
          allowFullScreen
        />
      ) : (
        // Поки URL не введено / не валідний — показуємо placeholder всередині блока,
        // щоб юзер бачив, що це YouTube-блок чекає посилання.
        <div style={{
          width: "100%", height: "100%", borderRadius: "8px",
          background: "#FAF6F0", borderWidth: "1.5px", borderStyle: "dashed", borderColor: "#E8D5B7",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#9CA3AF", fontSize: "13px", fontFamily: ff,
        }}>
          ▶ Вставте URL відео або плейлиста YouTube ↓
        </div>
      )}
      <div style={{ position: "absolute", left: 0, right: 0, top: "100%", marginTop: "8px", zIndex: 21 }}>
        <input
          style={inputStyle}
          placeholder="https://youtube.com/watch?v=… або /playlist?list=…"
          value={block.data.url || ""}
          onChange={e => onChange({ ...block.data, url: e.target.value })}
        />
      </div>
    </div>
  );
}