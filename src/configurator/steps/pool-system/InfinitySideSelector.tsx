import { useMemo, useState } from "react";
import { infinityZonesForOutline } from "@/lib/pool/infinity-edge";
import type { Outline, PoolShapeId } from "@/lib/pool/types";
import { cn } from "@/lib/utils";

/** Stable edge label shared with summary/export; never camera-relative. */
export function sideLabel(side: number): string {
  return `Lato ${side + 1}`;
}

/**
 * Small inline SVG plan of the pool's own candidate Infinity sides -- lets
 * the customer pick "LATO INFINITY" visually instead of typing/reading raw
 * coordinates or vertex indices. Shape-generic: draws whatever outline it's
 * given and whatever valid zones `infinityZonesForOutline` returns for it
 * (4 sides for Rectangle, up to 4 of L-shape's 6 -- the two recess-adjacent
 * edges are never candidates, see `lShapeInfinityZones` -- or up to 4 named
 * flat arcs of Organic's curved perimeter, see `organicInfinityZones`), so
 * this is the one selector all 3 buildable shapes share rather than a
 * duplicate per-shape component. Each zone is drawn as its own real
 * `zone.points` polyline rather than a straight `start`-`end` line -- for
 * Rectangle/L-shape that is still exactly one straight segment (2 points),
 * byte-identical to before; for Organic it is what actually draws the curved
 * arc instead of a misleading straight chord cutting across the bay. The
 * outline itself may be concave (L-shape) or smoothly curved (Organic); the
 * SVG polygon fill and the `toView` projection make no convexity assumption.
 * Renders nothing when there are no candidate zones at all (a "custom"
 * free-draw outline, or a real outline too small/degenerate to offer any).
 */
export function InfinitySideSelector({
  outline,
  shape,
  selectedSide,
  onSelect,
}: {
  outline: Outline;
  shape: PoolShapeId;
  selectedSide: number | null;
  onSelect: (side: number) => void;
}) {
  const zones = useMemo(() => infinityZonesForOutline(outline, shape), [outline, shape]);
  const [hovered, setHovered] = useState<number | null>(null);
  if (zones.length === 0) return null;

  const minX = Math.min(...outline.map((p) => p[0]));
  const maxX = Math.max(...outline.map((p) => p[0]));
  const minZ = Math.min(...outline.map((p) => p[1]));
  const maxZ = Math.max(...outline.map((p) => p[1]));
  const spanX = Math.max(maxX - minX, 1e-6);
  const spanZ = Math.max(maxZ - minZ, 1e-6);
  const pad = 14;
  const viewW = 160;
  const viewH = 160;
  const scale = (viewW - pad * 2) / Math.max(spanX, spanZ);
  const selectedZone = zones.find((zone) => zone.side === selectedSide);
  const toView = ([x, z]: readonly [number, number]): readonly [number, number] => [
    (viewW - spanX * scale) / 2 + (x - minX) * scale,
    (viewH - spanZ * scale) / 2 + (z - minZ) * scale,
  ];

  return (
    <div
      className="flex flex-col items-center gap-3 rounded-2xl border border-hairline p-5"
      role="group"
      aria-label="Selezione lato Infinity"
    >
      <p className="label-xs self-start">Scegli il lato Infinity</p>
      <svg
        viewBox={`0 0 ${viewW} ${viewH}`}
        className="h-40 w-40"
        role="img"
        aria-label={`Pianta della piscina con ${zones.length} lati selezionabili`}
      >
        {/* Basin fill, just so the plan reads as a pool rather than 4 loose bars. */}
        <polygon
          points={outline.map((p) => toView(p).join(",")).join(" ")}
          className="fill-foreground/5 stroke-none"
        />
        {zones.map((zone) => {
          const selected = selectedSide === zone.side;
          return (
            <g
              key={zone.side}
              onPointerEnter={() => setHovered(zone.side)}
              onPointerLeave={() => setHovered(null)}
            >
              <polyline
                key={zone.side}
                points={zone.points.map((p) => toView(p).join(",")).join(" ")}
                fill="none"
                strokeWidth={selected ? 7 : 5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={cn(
                  "cursor-pointer motion-safe:transition-colors duration-200",
                  selected || hovered === zone.side ? "stroke-brand" : "stroke-foreground/25",
                )}
                onClick={() => onSelect(zone.side)}
              />
              <polyline
                points={zone.points.map((p) => toView(p).join(",")).join(" ")}
                fill="none"
                stroke="transparent"
                strokeWidth={16}
                onClick={() => onSelect(zone.side)}
                className="cursor-pointer"
              />
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap justify-center gap-2">
        {zones.map((zone) => (
          <button
            key={zone.side}
            type="button"
            aria-pressed={selectedSide === zone.side}
            onClick={() => onSelect(zone.side)}
            onFocus={() => setHovered(zone.side)}
            onBlur={() => setHovered(null)}
            className={cn(
              "min-h-11 rounded-lg border px-3 text-xs motion-safe:transition-colors focus-visible:outline-2 focus-visible:outline-brand",
              selectedSide === zone.side
                ? "border-brand bg-brand/10 text-brand"
                : "border-hairline hover:border-brand",
            )}
          >
            {sideLabel(zone.side)}
          </button>
        ))}
      </div>
      <p className="text-center text-[12px] font-light text-muted-foreground">
        {selectedZone
          ? sideLabel(selectedZone.side)
          : "Seleziona il lato che scompare a filo orizzonte"}
      </p>
    </div>
  );
}
