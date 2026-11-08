import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { createCatalogueLoungerFrame, createCatalogueCushion } from "./catalogueLounger";
import type { ArchitecturalPart } from "@/lib/pool/catalogue-architecture";

/** Small real edge radii catch highlights without changing the metric envelope. */
export function createCataloguePartGeometry(part: ArchitecturalPart): THREE.BufferGeometry {
  const radius =
    part.finish === "fabric"
      ? 0.045
      : part.finish === "plaster"
        ? 0.008
        : part.finish === "stone"
          ? 0.003
          : part.finish === "wood"
            ? 0.002
            : part.finish === "dark"
              ? 0.001
              : 0;
  const raw =
    part.profile === "lounger-frame"
      ? createCatalogueLoungerFrame()
      : part.finish === "linen"
        ? createCatalogueCushion(part.s)
        : radius
          ? new RoundedBoxGeometry(...part.s, part.finish === "fabric" ? 3 : 1, radius)
          : new THREE.BoxGeometry(...part.s);
  if (part.profile === "lounger-frame" &&
      (part.s[0] !== 0.82 || part.s[1] !== 0.9 || part.s[2] !== 2.02))
    raw.scale(part.s[0] / 0.82, part.s[1] / 0.9, part.s[2] / 2.02);
  const geometry = raw.index ? raw.toNonIndexed() : raw;
  if (geometry !== raw) raw.dispose();
  const position = geometry.getAttribute("position"),
    normal = geometry.getAttribute("normal"),
    uv = geometry.getAttribute("uv");
  // The compound frame already owns metric grain coordinates per timber member.
  if (part.profile !== "lounger-frame")
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i) + part.p[0],
        y = position.getY(i) + part.p[1],
        z = position.getZ(i) + part.p[2];
      const nx = Math.abs(normal.getX(i)),
        ny = Math.abs(normal.getY(i));
      let u = nx > 0.5 ? z : x,
        v = ny > 0.5 ? z : y;
      if (part.finish === "wood") {
        if (part.s[1] > 0.9 && Math.min(part.s[0], part.s[2]) < 0.3) {
          // Vertical wall boards: grain runs up the wall, not across it.
          u = y;
          v = nx > 0.5 ? z : x;
        } else if (ny > 0.5 && part.s[2] > part.s[0]) {
          u = z;
          v = x;
        }
      }
      uv.setXY(i, u, v);
    }
  if (part.tilt) geometry.rotateX(part.tilt);
  geometry.translate(...part.p);
  return geometry;
}
