import { useMemo } from "react";
import { infinityZonesForOutline } from "@/lib/pool/infinity-edge";
import type { Outline, PoolShapeId } from "@/lib/pool/types";
import { cn } from "@/lib/utils";

/**
 * Compass-style side label derived from the zone's own outward normal --
 * never the raw "X+/Z-" coordinate axis a customer has no reason to
 * understand. Picks whichever axis the normal points along more strongly,
 * which is always unambiguous for an axis-aligned Rectangle side.
 */
export function sideLabel(normal: readonly [number, number]): string {
  if (Math.abs(normal[0]) >= Math.abs(normal[1])) {
    return normal[0] >= 0 ? "Lato Est" : "Lato Ovest";
  }
  return normal[1] >= 0 ? "Lato Sud" : "Lato Nord";
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
            <polyline
              key={zone.side}
              points={zone.points.map((p) => toView(p).join(",")).join(" ")}
              fill="none"
              strokeWidth={selected ? 7 : 5}
              strokeLinecap="round"
              strokeLinejoin="round"
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
