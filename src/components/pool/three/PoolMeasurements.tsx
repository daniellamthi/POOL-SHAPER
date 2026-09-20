import { useMemo } from "react";
import { Html, Line } from "@react-three/drei";
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

const LABEL_CLASS =
  "pointer-events-none whitespace-nowrap select-none rounded-full border border-hairline bg-panel px-3 py-1 font-mono text-[10px] font-light tracking-[0.08em] text-foreground";

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

  const offset = 0.9;
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
        lineWidth={1}
      />
      <Html position={[0, y, zLine]} center zIndexRange={[10, 0]}>
        <span className={LABEL_CLASS}>L {formatNumber(length, 2)} m</span>
      </Html>

      <Line
        points={[
          [xLine, y, -bounds.maxZ],
          [xLine, y, bounds.maxZ],
        ]}
        color={color}
        lineWidth={1}
      />
      <Html position={[xLine, y, 0]} center zIndexRange={[10, 0]}>
        <span className={LABEL_CLASS}>W {formatNumber(width, 2)} m</span>
      </Html>

      <Line
        points={[
          [-xLine, wallTopY, zLine],
          [-xLine, floorY, zLine],
        ]}
        color={color}
        lineWidth={1}
      />
      <Html position={[-xLine, (wallTopY + floorY) / 2, zLine]} center zIndexRange={[10, 0]}>
        <span className={LABEL_CLASS}>{depthLabel}</span>
      </Html>
    </group>
  );
}
