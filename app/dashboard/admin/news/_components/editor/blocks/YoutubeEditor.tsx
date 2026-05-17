"use client";

import { useEffect, useState } from "react";
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
  const appliedUrl = block.data.url || "";
  const embed = getEmbedUrl(appliedUrl);

  // Draft-state інпуту URL. Як у Heading/Text — поки draft != applied показується
  // зелена ✓; після коміту draft вирівнюється з applied і ✓ зникає.
  const [urlDraft, setUrlDraft] = useState(appliedUrl);
  useEffect(() => { setUrlDraft(appliedUrl); }, [appliedUrl]);

  const trimmedDraft = urlDraft.trim();
  const hasPendingChange = trimmedDraft !== appliedUrl;

  const commitUrl = () => {
    onChange({ ...block.data, url: trimmedDraft });
  };
  const clearUrl = () => {
    setUrlDraft("");
    onChange({ ...block.data, url: "" });
  };

  // Портал-target — slot у лівому sidebar. Рендеримо туди ТІЛЬКИ коли selected.
  const settingsSlot = typeof document !== "undefined" && selected
    ? document.getElementById("news-block-settings-slot")
    : null;

  const toolbarNode = (
    <div style={{ padding: "10px 12px", background: "#FFFFFF" }}>
      <div style={{
        fontSize: "11px", fontWeight: 600, color: "#1C3A2E",
        marginBottom: "6px", fontFamily: ff,
      }}>{"URL відео або плейлиста YouTube"}</div>
      <div style={{ display: "flex", gap: "5px" }}>
        <input
          style={{ ...inputStyle, flex: 1 }}
          placeholder="https://youtube.com/watch?v=… або /playlist?list=…"
          value={urlDraft}
          onChange={e => setUrlDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitUrl();
              (e.currentTarget as HTMLInputElement).blur();
            }
          }}
        />
        {/* ✓ — показуємо тільки коли draft має зміни щодо applied. Після коміту зникає. */}
        {trimmedDraft && hasPendingChange && (
          <button
            type="button"
            onClick={commitUrl}
            title="Зберегти URL"
            style={{
              ...inputStyle, width: "38px", padding: 0,
              cursor: "pointer",
              color: "#FFFFFF",
              background: "#059669",
              borderColor: "#059669",
              fontWeight: 700,
            }}
          >✓</button>
        )}
        {appliedUrl && (
          <button
            type="button"
            onClick={clearUrl}
            title="Прибрати URL"
            style={{ ...inputStyle, width: "38px", padding: 0, color: "#B91C1C", cursor: "pointer" }}
          >✕</button>
        )}
      </div>
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
