"use client";

import { createPortal } from "react-dom";
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
  /** Чи блок selected — URL-інпут портал-иться в #news-block-settings-slot
   *  (як у TextEditor/ImageEditor). Без selected інпут не рендериться,
   *  щоб не плодити порожні портали. */
  selected?: boolean;
}

export default function YoutubeEditor({ block, onChange, selected = false }: Props) {
  const embed = getEmbedUrl(block.data.url || "");

  // Портал-target — slot у лівому sidebar. Рендеримо туди ТІЛЬКИ коли selected.
  // BlockItem обгортка має overflow:hidden, тому інпут не може жити "під" блоком
  // як absolute; top:100% — обрізається. Портал у sidebar — стандартний паттерн
  // для контекстних toolbar-ів цього редактора.
  const settingsSlot = typeof document !== "undefined" && selected
    ? document.getElementById("news-block-settings-slot")
    : null;

  const toolbarNode = (
    <div style={{ padding: "10px 12px", background: "#FFFFFF" }}>
      <div style={{
        fontSize: "11px", fontWeight: 600, color: "#1C3A2E",
        marginBottom: "6px", fontFamily: ff,
      }}>{"URL відео або плейлиста YouTube"}</div>
      <input
        style={inputStyle}
        placeholder="https://youtube.com/watch?v=… або /playlist?list=…"
        value={block.data.url || ""}
        onChange={e => onChange({ ...block.data, url: e.target.value })}
      />
    </div>
  );

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
          color: "#9CA3AF", fontSize: "13px", fontFamily: ff, textAlign: "center", padding: "0 16px",
        }}>
          {selected ? "▶ Встав URL у панелі зліва ←" : "▶ Клікни щоб додати URL відео"}
        </div>
      )}
      {settingsSlot && createPortal(toolbarNode, settingsSlot)}
    </div>
  );
}
