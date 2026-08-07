import { useMemo } from "react";
import { Html, Line } from "@react-three/drei";
import { formatNumber } from "@/lib/pool/format";
import type { Outline } from "@/lib/pool/types";

interface Props {
  outline: Outline;
  length: number;
  width: number;
  depth: number;
  color: string;
}

const LABEL_CLASS =
  "pointer-events-none whitespace-nowrap select-none rounded-full border border-hairline bg-panel px-3 py-1 font-mono text-[10px] font-light tracking-[0.08em] text-foreground backdrop-blur-xl";

/** Dimension guides drawn around the live geometry. */
export function PoolMeasurements({ outline, length, width, depth, color }: Props) {
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
  const y = 0.02;
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
          [-xLine, 0, zLine],
          [-xLine, -depth, zLine],
        ]}
        color={color}
        lineWidth={1}
      />
      <Html position={[-xLine, -depth / 2, zLine]} center zIndexRange={[10, 0]}>
        <span className={LABEL_CLASS}>D {formatNumber(depth, 2)} m</span>
      </Html>
    </group>
  );
}
