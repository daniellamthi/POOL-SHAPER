import { useMemo } from "react";
import { rectangleInfinityZones } from "@/lib/pool/infinity-edge";
import type { RectangleInfinitySide } from "@/lib/pool/infinity-edge";
import type { Outline } from "@/lib/pool/types";
import { cn } from "@/lib/utils";

/**
 * Compass-style side label derived from the zone's own outward normal --
 * never the raw "X+/Z-" coordinate axis a customer has no reason to
 * understand. Picks whichever axis the normal points along more strongly,
 * which is always unambiguous for an axis-aligned Rectangle side.
 */
function sideLabel(normal: readonly [number, number]): string {
  if (Math.abs(normal[0]) >= Math.abs(normal[1])) {
    return normal[0] >= 0 ? "Lato Est" : "Lato Ovest";
  }
  return normal[1] >= 0 ? "Lato Sud" : "Lato Nord";
}

/**
 * Small inline SVG plan of the 4 rectangle sides -- lets the customer pick
 * "LATO INFINITY" visually instead of typing/reading raw coordinates.
 * Rectangle-only (mirrors `rectangleInfinityZones`'s own honest emptiness
 * for any other shape -- the Acqua step never renders this for L-shape/
 * Organic to begin with, but this stays defensive regardless).
 */
export function InfinitySideSelector({
  outline,
  selectedSide,
  onSelect,
}: {
  outline: Outline;
  selectedSide: RectangleInfinitySide | null;
  onSelect: (side: RectangleInfinitySide) => void;
}) {
  const zones = useMemo(() => rectangleInfinityZones(outline), [outline]);
  if (zones.length !== 4) return null;

  const minX = Math.min(...outline.map((p) => p[0]));
  const maxX = Math.max(...outline.map((p) => p[0]));
  const minZ = Math.min(...outline.map((p) => p[1]));
  const maxZ = Math.max(...outline.map((p) => p[1]));
  const spanX = Math.max(maxX - minX, 1e-6);
  const spanZ = Math.max(maxZ - minZ, 1e-6);
  const pad = 14;
  const viewW = 160;
  const viewH = 160;
  const toView = ([x, z]: readonly [number, number]): readonly [number, number] => [
    pad + ((x - minX) / spanX) * (viewW - pad * 2),
    pad + ((z - minZ) / spanZ) * (viewH - pad * 2),
  ];

  return (
    <div
      className="flex flex-col items-center gap-3 rounded-2xl border border-hairline p-5"
      role="group"
      aria-label="Selezione lato Infinity"
    >
      <p className="label-xs self-start">Lato Infinity</p>
      <svg
        viewBox={`0 0 ${viewW} ${viewH}`}
        className="h-40 w-40"
        role="img"
        aria-label="Pianta della piscina con i 4 lati selezionabili"
      >
        {/* Basin fill, just so the plan reads as a pool rather than 4 loose bars. */}
        <polygon
          points={outline.map((p) => toView(p).join(",")).join(" ")}
          className="fill-foreground/5 stroke-none"
        />
        {zones.map((zone) => {
          const [x1, y1] = toView(zone.start);
          const [x2, y2] = toView(zone.end);
          const selected = selectedSide === zone.side;
          return (
            <line
              key={zone.side}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              strokeWidth={selected ? 7 : 5}
              strokeLinecap="round"
              className={cn(
                "cursor-pointer transition-colors duration-300",
                selected ? "stroke-brand" : "stroke-foreground/25 hover:stroke-foreground/55",
              )}
              tabIndex={0}
              role="button"
              aria-pressed={selected}
              aria-label={sideLabel(zone.normal)}
              onClick={() => onSelect(zone.side)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(zone.side);
                }
              }}
            />
          );
        })}
      </svg>
      <p className="text-center text-[12px] font-light text-muted-foreground">
        {selectedSide !== null
          ? sideLabel(zones.find((z) => z.side === selectedSide)!.normal)
          : "Seleziona il lato che scompare a filo orizzonte"}
      </p>
    </div>
  );
}
