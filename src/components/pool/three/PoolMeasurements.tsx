import { useMemo } from "react";
import { Html, Line } from "@react-three/drei";
import { Vector3 } from "three";
import { formatNumber } from "@/lib/pool/format";
import type { Outline } from "@/lib/pool/types";

interface Props {
  outline: Outline;
  length: number;
  width: number;
  depth: number;
  floorY: number;
  wallTopY: number;
  color: string;
  /** Sloped floor (Geometry Pass A) only: the shallow-end depth, metres.
   * When set and different from `depth`, the depth label reads as a range
   * ("1,20 → 1,50 m") instead of a single value -- no extra guide line, to
   * keep the overlay from getting cluttered. */
  shallowDepth?: number | undefined;
}

// Calm technical annotation: small tabular figures on a soft card chip, no
// outline -- the guide supports reading the pool, it never competes with it.
const LABEL_CLASS =
  "pointer-events-none whitespace-nowrap select-none rounded-full bg-card/85 px-2 py-0.5 font-mono text-[9.5px] font-normal tabular-nums tracking-[0.06em] text-foreground/80 shadow-[0_1px_2px_rgb(0_0_0/0.06)]";

/** Line styling shared by every guide: hairline weight, partly transparent. */
const LINE = { lineWidth: 0.75, transparent: true, opacity: 0.55 } as const;
/** Half-length of the perpendicular end ticks, metres. */
const TICK = 0.12;

const labelPosition: NonNullable<React.ComponentProps<typeof Html>["calculatePosition"]> = (object, camera, size) => {
  const projected = object.getWorldPosition(new Vector3()).project(camera);
  const x = (projected.x * 0.5 + 0.5) * size.width;
  const y = (-projected.y * 0.5 + 0.5) * size.height;
  const mobile = typeof window !== "undefined" && window.innerWidth < 640;
  const side = mobile ? 62 : 55;
  const bottom = mobile ? 112 : 38;
  return [
    Math.min(Math.max(x, side), Math.max(side, size.width - side)),
    Math.min(Math.max(y, 24), Math.max(24, size.height - bottom)),
  ];
};

/** Dimension guides drawn around the live geometry. */
export function PoolMeasurements({
  outline,
  length,
  width,
  depth,
  floorY,
  wallTopY,
  color,
  shallowDepth,
}: Props) {
  const depthLabel =
    shallowDepth !== undefined && Math.abs(shallowDepth - depth) > 0.001
      ? `D ${formatNumber(shallowDepth, 2)} → ${formatNumber(depth, 2)} m`
      : `D ${formatNumber(depth, 2)} m`;
  const bounds = useMemo(() => {
    let maxX = 0;
    let maxZ = 0;
    for (const [x, z] of outline) {
      maxX = Math.max(maxX, Math.abs(x));
      maxZ = Math.max(maxZ, Math.abs(z));
    }
    return { maxX, maxZ };
  }, [outline]);

  // Guides sit a little closer to the basin than before so they read as part
  // of the drawing, with short end ticks instead of long free-floating rules.
  const offset = 0.6;
  const y = wallTopY + 0.02;
  const zLine = bounds.maxZ + offset;
  const xLine = bounds.maxX + offset;

  return (
    <group>
      <Line
        points={[
          [-bounds.maxX, y, zLine],
          [bounds.maxX, y, zLine],
        ]}
        color={color}
        {...LINE}
      />
      <Line points={[[-bounds.maxX, y, zLine - TICK], [-bounds.maxX, y, zLine + TICK]]} color={color} {...LINE} />
      <Line points={[[bounds.maxX, y, zLine - TICK], [bounds.maxX, y, zLine + TICK]]} color={color} {...LINE} />
      <Html position={[0, y, zLine]} center zIndexRange={[10, 0]} calculatePosition={labelPosition}>
        <span className={LABEL_CLASS}>L {formatNumber(length, 2)} m</span>
      </Html>

      <Line
        points={[
          [xLine, y, -bounds.maxZ],
          [xLine, y, bounds.maxZ],
        ]}
        color={color}
        {...LINE}
      />
      <Line points={[[xLine - TICK, y, -bounds.maxZ], [xLine + TICK, y, -bounds.maxZ]]} color={color} {...LINE} />
      <Line points={[[xLine - TICK, y, bounds.maxZ], [xLine + TICK, y, bounds.maxZ]]} color={color} {...LINE} />
      <Html position={[xLine, y, 0]} center zIndexRange={[10, 0]} calculatePosition={labelPosition}>
        <span className={LABEL_CLASS}>W {formatNumber(width, 2)} m</span>
      </Html>

      <Line
        points={[
          [-xLine, wallTopY, zLine],
          [-xLine, floorY, zLine],
        ]}
        color={color}
        {...LINE}
      />
      <Line points={[[-xLine - TICK, floorY, zLine], [-xLine + TICK, floorY, zLine]]} color={color} {...LINE} />
      <Html position={[-xLine, (wallTopY + floorY) / 2, zLine]} center zIndexRange={[10, 0]} calculatePosition={labelPosition}>
        <span className={LABEL_CLASS}>{depthLabel}</span>
      </Html>
    </group>
  );
}
