import { Block, BG_STYLES, ALIGN_CLASS, PAD_CLASS } from "../newsUtils";

export function CtaBlock({ block }: { block: Block }) {
  const bgStyle = BG_STYLES[block.bg];
  const cls = ALIGN_CLASS[block.align] + " " + PAD_CLASS[block.padding] + " rounded-xl px-4 flex-1";
  return (
    <div className={cls} style={bgStyle}>
      <a href={block.data.url || "#"} className="inline-block font-bold px-8 py-4 rounded-xl text-lg hover:opacity-90 transition-opacity" style={{ backgroundColor: "#D4A843", color: "#1C3A2E" }}>
        {block.data.text}
      </a>
    </div>
  );
}

export function DividerBlock() {
  return <hr className="border-gray-200 my-2 w-full" />;
}