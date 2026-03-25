'use client';

const notionUrl = "https://www.notion.so/native/173e5fa4a921802297e6e15b1e4cfa64?source=copy_link&deepLinkOpenNewTab=true";

export default function NotionButton() {
  return (
    <div className="flex justify-center pt-4">
      <button
        onClick={() => window.open(notionUrl, '_blank')}
        className="inline-flex items-center gap-3 bg-white border border-[#1C3A2E]/10 text-[#1C3A2E] font-semibold px-8 py-4 rounded-2xl shadow-sm hover:shadow-md hover:bg-[#1C3A2E] hover:text-white transition-all duration-200 text-sm tracking-wide cursor-pointer"
      >
        {"Більше спеціалістів у базі UIMP"}
      </button>
    </div>
  );
}