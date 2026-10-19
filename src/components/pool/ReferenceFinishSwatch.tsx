import { referenceFinish } from "@/lib/pool/reference-finishes";

/** A real crop of the supplied colour photograph. The image keeps its native
 * aspect: crop positioning uses percentage translations of the source image,
 * not a stretch to a square. The outer card may clip this sample further.
 * No caption, source icon or invented product photograph is included. */
export function ReferenceFinishSwatch({ id, className = "" }: { id: unknown; className?: string }) {
  const finish = referenceFinish(id);
  if (!finish) return null;
  const [sourceWidth, sourceHeight] = finish.imageSize;
  const sample = finish.sample;
  const rectangle = "swatchPixels" in finish ? finish.swatchPixels : sample.kind === "rectangle" ? sample.pixels : [
    Math.min(...sample.pixels.map(point => point[0])),
    Math.min(...sample.pixels.map(point => point[1])),
    Math.max(...sample.pixels.map(point => point[0])) - Math.min(...sample.pixels.map(point => point[0])),
    Math.max(...sample.pixels.map(point => point[1])) - Math.min(...sample.pixels.map(point => point[1])),
  ] as const;
  const [left, top, width, height] = rectangle;
  return <span className={`relative block overflow-hidden ${className || "h-full w-full"}`}
    style={{ containerType: "size", aspectRatio: width / height }}>
    <img src={finish.asset.url} alt={finish.title} title="Campione fotografico fornito dal cliente"
      loading="lazy" decoding="async" width={sourceWidth} height={sourceHeight}
      className="absolute left-1/2 top-1/2 max-w-none"
      style={{
        // Cover the caller's actual box while preserving the source image's
        // ratio. Container units choose the larger width/height scale; the
        // crop centre, not the full original/caption, stays in the card.
        width: `max(${100 * sourceWidth / width}cqw, ${100 * sourceWidth / height}cqh)`,
        height: "auto",
        transform: `translate(${-100 * (left + width / 2) / sourceWidth}%, ${-100 * (top + height / 2) / sourceHeight}%)`,
      }} />
  </span>;
}
