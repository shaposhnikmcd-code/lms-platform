import { Block, BG_STYLES, ALIGN_CLASS, PAD_CLASS } from "../newsUtils";

function baseCls(block: Block) {
  return ALIGN_CLASS[block.align] + " " + PAD_CLASS[block.padding] + " rounded-xl px-4 flex-1 overflow-hidden";
}

export function HeadingBlock({ block }: { block: Block }) {
  const bgStyle = BG_STYLES[block.bg];
  const textColor = bgStyle.color as string | undefined;
  return (
    <div className={baseCls(block)} style={bgStyle}>
      <h2 className="text-2xl font-bold" style={{ color: textColor ?? "#1C3A2E" }}>
        {block.data.text}
      </h2>
    </div>
  );
}

export function TextBlock({ block }: { block: Block }) {
  const bgStyle = BG_STYLES[block.bg];
  const textColor = bgStyle.color as string | undefined;
  return (
    <div className={baseCls(block)} style={bgStyle}>
      <p className="leading-relaxed whitespace-pre-wrap text-lg" style={{ color: textColor ?? "#374151" }}>
        {block.data.content}
      </p>
    </div>
  );
}

export function QuoteBlock({ block }: { block: Block }) {
  const bgStyle = BG_STYLES[block.bg];
  const textColor = bgStyle.color as string | undefined;
  return (
    <div className={baseCls(block)} style={bgStyle}>
      <blockquote className="border-l-4 pl-6 py-2" style={{ borderColor: "#D4A843" }}>
        <p className="text-xl italic leading-relaxed" style={{ color: textColor ?? "#374151" }}>
          {block.data.text}
        </p>
        {block.data.author && (
          <cite className="text-sm mt-2 block not-italic" style={{ color: textColor ? "rgba(255,255,255,0.6)" : "#9ca3af" }}>
            {"— "}{block.data.author}
          </cite>
        )}
      </blockquote>
    </div>
  );
}

export function ListBlock({ block }: { block: Block }) {
  const bgStyle = BG_STYLES[block.bg];
  const textColor = bgStyle.color as string | undefined;
  return (
    <div className={baseCls(block)} style={bgStyle}>
      <ul className="list-disc list-inside space-y-2">
        {(block.data.items as string[]).map((item, i) => (
          <li key={i} className="text-lg" style={{ color: textColor ?? "#374151" }}>{item}</li>
        ))}
      </ul>
    </div>
  );
}