import { Block, BG_STYLES, ALIGN_CLASS, PAD_CLASS, getVideoEmbed } from "../newsUtils";

export function ImageBlock({ block }: { block: Block }) {
  const bgStyle = BG_STYLES[block.bg];
  if (!block.data.url) return null;
  return (
    <div className="rounded-xl overflow-hidden flex-1" style={bgStyle}>
      <img src={block.data.url} alt={block.data.alt || ""} className="w-full h-full object-cover" />
    </div>
  );
}

export function GalleryBlock({ block }: { block: Block }) {
  const bgStyle = BG_STYLES[block.bg];
  const cls = ALIGN_CLASS[block.align] + " " + PAD_CLASS[block.padding] + " rounded-xl px-4 flex-1";
  if ((block.data.images as string[]).length === 0) return null;
  return (
    <div className={cls} style={bgStyle}>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {(block.data.images as string[]).map((url, i) => (
          <img key={i} src={url} alt="" className="w-full h-40 object-cover rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function VideoBlock({ block }: { block: Block }) {
  const bgStyle = BG_STYLES[block.bg];
  const cls = ALIGN_CLASS[block.align] + " " + PAD_CLASS[block.padding] + " rounded-xl px-4 flex-1";
  const embed = getVideoEmbed(block.data.url || "");
  if (embed) {
    return (
      <div className="rounded-xl overflow-hidden flex-1" style={bgStyle}>
        <iframe src={embed} className="w-full h-full" style={{ minHeight: "200px" }} allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
      </div>
    );
  }
  if (block.data.url) {
    return (
      <div className={cls} style={bgStyle}>
        <video src={block.data.url} controls className="w-full h-full rounded-xl" />
      </div>
    );
  }
  return null;
}