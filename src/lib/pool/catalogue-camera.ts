import { Vector3 } from "three";
import type { ArchitecturalPlan } from "./catalogue-architecture";

/** Keep the architectural eye height/lens, retreating only when a portrait
 * frame would clip the actual pool. Furniture may remain partly outside a
 * portrait shot, as in the reference, rather than shrinking the pool to fit a house. */
export function fitCatalogueCamera(
  plan: ArchitecturalPlan,
  aspect: number,
  portrait = aspect < 0.8,
) {
  const original = plan.camera;
  if (plan.indoor) return { ...original, fov: aspect < 0.8 ? 72 : original.fov };
  if (!portrait || !Number.isFinite(aspect) || aspect <= 0) return original;
  const fov = 64;
  const tanY = Math.tan((fov * Math.PI) / 360),
    tanX = tanY * Math.max(0.2, aspect);
  const c = Math.cos(plan.angle),
    s = Math.sin(plan.angle);
  const world = (x: number, y: number, z: number) =>
    new Vector3(plan.centre[0] + c * x + s * z, y, plan.centre[1] - s * x + c * z);
  const points: Vector3[] = [];
  const ground = original.target[1] - 0.35;
  for (const u of [-plan.length / 2 - 0.15, plan.length / 2 + 0.15])
    for (const v of [-plan.width / 2 - 0.15, plan.width / 2 + 0.15])
      points.push(world(u, ground, v));
  const target = world(plan.length * 0.18, original.target[1], 0),
    position = new Vector3(...original.position);
  const horizontal = position.clone().sub(target).setY(0),
    start = horizontal.length();
  horizontal.normalize();
  const forward = new Vector3(),
    right = new Vector3(),
    up = new Vector3(),
    delta = new Vector3();
  for (let distance = start, attempt = 0; attempt < 80; attempt++, distance *= 1.06) {
    position.copy(target).addScaledVector(horizontal, distance);
    position.y = original.position[1];
    forward.copy(target).sub(position).normalize();
    right.crossVectors(forward, new Vector3(0, 1, 0)).normalize();
    up.crossVectors(right, forward);
    const fits = points.every((p) => {
      delta.copy(p).sub(position);
      const depth = delta.dot(forward);
      return (
        depth > 0 &&
        Math.abs(delta.dot(right)) <= depth * tanX * 0.88 &&
        Math.abs(delta.dot(up)) <= depth * tanY * 0.88
      );
    });
    if (fits) break;
  }
  return {
    position: position.toArray() as [number, number, number],
    target: target.toArray() as [number, number, number],
    fov,
  };
}
