import { Block, BG_STYLES, ALIGN_CLASS } from "../newsUtils";

export default function HeroBlock({ block }: { block: Block }) {
  const bgStyle = BG_STYLES[block.bg];
  const textColor = bgStyle.color as string | undefined;
  return (
    <div className={"rounded-2xl px-8 py-10 flex-1 " + ALIGN_CLASS[block.align]} style={bgStyle}>
      <h2 className="text-2xl font-bold mb-2" style={{ color: textColor ?? "#1C3A2E" }}>
        {block.data.title}
      </h2>
      {block.data.subtitle && (
        <p style={{ color: textColor ? "rgba(255,255,255,0.75)" : "#6b7280" }}>
          {block.data.subtitle}
        </p>
      )}
    </div>
  );
}