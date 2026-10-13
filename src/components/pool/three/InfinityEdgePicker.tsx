import { useEffect, useMemo, useState } from "react";
import { BoxGeometry } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { infinityZonesForOutline } from "@/lib/pool/infinity-edge";
import type { Outline, PoolShapeId } from "@/lib/pool/types";

/** Picking uses the same canonical polylines as the inline accessible plan. */
export function InfinityEdgePicker({
  outline,
  shape,
  selectedSide,
  y,
  onSelect,
}: {
  outline: Outline;
  shape: PoolShapeId;
  selectedSide: number | null;
  y: number;
  onSelect: (side: number) => void;
}) {
  const zones = useMemo(() => infinityZonesForOutline(outline, shape), [outline, shape]);
  const geometry = useMemo(
    () =>
      zones.map((zone) => {
        const strip = (height: number, width: number) => {
          const parts = zone.points.slice(0, -1).map((a, i) => {
            const b = zone.points[i + 1]!;
            const box = new BoxGeometry(Math.hypot(b[0] - a[0], b[1] - a[1]), height, width);
            box.rotateY(-Math.atan2(b[1] - a[1], b[0] - a[0]));
            box.translate((a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2);
            return box;
          });
          const merged = mergeGeometries(parts)!;
          parts.forEach((part) => part.dispose());
          return merged;
        };
        return { side: zone.side, hit: strip(0.08, 0.3), bar: strip(0.014, 0.035) };
      }),
    [zones, y],
  );
  useEffect(
    () => () =>
      geometry.forEach((g) => {
        g.hit.dispose();
        g.bar.dispose();
      }),
    [geometry],
  );
  const [hovered, setHovered] = useState<number | null>(null);
  return (
    <group name="infinity-edge-picker">
      {geometry.map((zone) => (
        <group
          key={zone.side}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHovered(zone.side);
          }}
          onPointerOut={() => setHovered(null)}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(zone.side);
          }}
        >
          <mesh geometry={zone.hit}>
            <meshBasicMaterial visible={false} />
          </mesh>
          <mesh geometry={zone.bar} renderOrder={10}>
            <meshBasicMaterial
              color={selectedSide === zone.side || hovered === zone.side ? "#8980df" : "#a9a6b6"}
              transparent
              opacity={selectedSide === zone.side || hovered === zone.side ? 0.95 : 0.38}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
