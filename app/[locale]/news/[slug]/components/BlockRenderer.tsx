import { Block, getVideoEmbed } from "./newsUtils";

export default function BlockRenderer({ block }: { block: Block }) {
  switch (block.type) {
    case "hero":
      return (
        <div className="w-full h-full">
          <h2 className="text-2xl font-bold mb-2">
            {block.data.title}
          </h2>
          {block.data.subtitle && (
            <p className="opacity-75 text-base">{block.data.subtitle}</p>
          )}
        </div>
      );
    case "heading":
      return (
        <h2 className="text-2xl font-bold w-full">{block.data.text}</h2>
      );
    case "text":
  return (
    <p className="leading-relaxed whitespace-pre-wrap text-lg w-full overflow-hidden"
      style={{ wordBreak: "break-word" }}>
      {block.data.content}
    </p>
  );
    case "image":
      return block.data.url ? (
        <img src={block.data.url} alt={block.data.alt || ""} className="w-full h-full object-cover rounded-lg" />
      ) : null;
    case "gallery":
      return (block.data.images as string[]).length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 w-full">
          {(block.data.images as string[]).map((url, i) => (
            <img key={i} src={url} alt="" className="w-full h-40 object-cover rounded-xl" />
          ))}
        </div>
      ) : null;
    case "video": {
      const embed = getVideoEmbed(block.data.url || "");
      return embed ? (
        <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
          <iframe src={embed} className="absolute inset-0 w-full h-full rounded-lg" allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
        </div>
      ) : block.data.url ? (
        <video src={block.data.url} controls className="w-full rounded-lg" />
      ) : null;
    }
    case "quote":
      return (
        <blockquote className="border-l-4 pl-6 py-2 w-full" style={{ borderColor: "#D4A843" }}>
          <p className="text-xl italic leading-relaxed">{block.data.text}</p>
          {block.data.author && (
            <cite className="text-sm mt-2 block not-italic opacity-60">{"— "}{block.data.author}</cite>
          )}
        </blockquote>
      );
    case "divider":
      return <hr className="border-gray-200 w-full" />;
    case "list":
      return (
        <ul className="list-disc list-inside space-y-2 w-full">
          {(block.data.items as string[]).map((item, i) => (
            <li key={i} className="text-lg">{item}</li>
          ))}
        </ul>
      );
    case "cta":
      return (
        <div className="w-full">
          <a href={block.data.url || "#"} className="inline-block font-bold px-8 py-4 rounded-xl text-lg hover:opacity-90 transition-opacity" style={{ backgroundColor: "#D4A843", color: "#1C3A2E" }}>
            {block.data.text}
          </a>
        </div>
      );
    default:
      return null;
  }
}