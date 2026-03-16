"use client";

import { Block } from "./types";
import { ic, lc } from "./constants";

interface Props {
  block: Block;
  onChange: (data: Record<string, any>) => void;
  onUpload: (file: File) => Promise<string>;
}

export default function BlockEditor({ block, onChange, onUpload }: Props) {
  const d = block.data;

  switch (block.type) {
    case "hero": return (
      <div className="space-y-3">
        <div>
          <label className={lc}>Заголовок</label>
          <input className={ic} value={d.title} onChange={e => onChange({...d, title: e.target.value})} placeholder="Назва новини" />
        </div>
        <div>
          <label className={lc}>Підзаголовок</label>
          <input className={ic} value={d.subtitle} onChange={e => onChange({...d, subtitle: e.target.value})} placeholder="Короткий опис..." />
        </div>
      </div>
    );

    case "heading": return (
      <div>
        <label className={lc}>Заголовок</label>
        <input className={ic} value={d.text} onChange={e => onChange({...d, text: e.target.value})} placeholder="Заголовок розділу..." />
      </div>
    );

    case "text": return (
      <div>
        <label className={lc}>Текст</label>
        <textarea className={ic} rows={6} value={d.content} onChange={e => onChange({...d, content: e.target.value})} placeholder="Текст абзацу..." />
      </div>
    );

    case "image": return (
      <div className="space-y-3">
        {d.url && <img src={d.url} alt="" className="w-full h-28 object-cover rounded-lg" />}
        <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-[#1C3A2E]/30 rounded-lg cursor-pointer hover:border-[#1C3A2E] hover:bg-[#1C3A2E]/5 transition-colors">
          <span className="text-xs text-gray-500">Вибрати фото</span>
          <input type="file" accept="image/*" className="hidden" onChange={async e => {
            const file = e.target.files?.[0]; if (!file) return;
            const url = await onUpload(file); if (url) onChange({...d, url});
          }} />
        </label>
        <div>
          <label className={lc}>або URL</label>
          <input className={ic} value={d.url} onChange={e => onChange({...d, url: e.target.value})} placeholder="https://..." />
        </div>
        <div>
          <label className={lc}>Alt текст</label>
          <input className={ic} value={d.alt} onChange={e => onChange({...d, alt: e.target.value})} placeholder="Опис фото..." />
        </div>
      </div>
    );

    case "gallery": return (
      <div>
        <label className={lc}>Фото галереї (до 6)</label>
        <div className="grid grid-cols-3 gap-2 mb-2">
          {(d.images as string[]).map((url: string, i: number) => (
            <div key={i} className="relative">
              <img src={url} alt="" className="w-full h-20 object-cover rounded-lg" />
              <button
                onClick={() => { const imgs = [...d.images]; imgs.splice(i, 1); onChange({...d, images: imgs}); }}
                className="absolute top-1 right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center"
              >x</button>
            </div>
          ))}
          {(d.images as string[]).length < 6 && (
            <label className="flex items-center justify-center h-20 border-2 border-dashed border-[#1C3A2E]/30 rounded-lg cursor-pointer hover:border-[#1C3A2E] transition-colors">
              <span className="text-xl text-gray-400">+</span>
              <input type="file" accept="image/*" className="hidden" onChange={async e => {
                const file = e.target.files?.[0]; if (!file) return;
                const url = await onUpload(file); if (url) onChange({...d, images: [...d.images, url]});
              }} />
            </label>
          )}
        </div>
      </div>
    );

    case "video": return (
      <div>
        <label className={lc}>Посилання на відео</label>
        <input className={ic} value={d.url} onChange={e => onChange({...d, url: e.target.value})} placeholder="https://youtube.com/watch?v=..." />
        <p className="text-xs text-gray-400 mt-1">YouTube або Vimeo</p>
      </div>
    );

    case "quote": return (
      <div className="space-y-3">
        <div>
          <label className={lc}>Цитата</label>
          <textarea className={ic} rows={3} value={d.text} onChange={e => onChange({...d, text: e.target.value})} placeholder="Текст цитати..." />
        </div>
        <div>
          <label className={lc}>Автор</label>
          <input className={ic} value={d.author} onChange={e => onChange({...d, author: e.target.value})} placeholder="Автор..." />
        </div>
      </div>
    );

    case "divider": return (
      <p className="text-xs text-gray-400 text-center">Горизонтальна лінія-роздільник</p>
    );

    case "list": return (
      <div>
        <label className={lc}>Пункти списку</label>
        {(d.items as string[]).map((item: string, i: number) => (
          <div key={i} className="flex gap-2 mb-2">
            <input
              className={ic}
              value={item}
              onChange={e => { const items = [...d.items]; items[i] = e.target.value; onChange({...d, items}); }}
              placeholder={"Пункт " + (i + 1) + "..."}
            />
            <button
              onClick={() => { const items = [...d.items]; items.splice(i, 1); onChange({...d, items}); }}
              className="text-red-400 hover:text-red-600 text-sm px-2"
            >x</button>
          </div>
        ))}
        <button onClick={() => onChange({...d, items: [...d.items, ""]})} className="text-xs text-[#1C3A2E] hover:underline">
          + додати пункт
        </button>
      </div>
    );

    case "cta": return (
      <div className="space-y-3">
        <div>
          <label className={lc}>Текст кнопки</label>
          <input className={ic} value={d.text} onChange={e => onChange({...d, text: e.target.value})} placeholder="Записатись..." />
        </div>
        <div>
          <label className={lc}>Посилання</label>
          <input className={ic} value={d.url} onChange={e => onChange({...d, url: e.target.value})} placeholder="/consultations або https://..." />
        </div>
      </div>
    );

    default: return null;
  }
}