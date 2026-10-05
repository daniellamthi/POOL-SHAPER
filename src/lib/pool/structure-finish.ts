import type {
  FinishMaterial,
  PoolStructure,
  PoolType,
  SelectableFinishMaterial,
} from "./types";

export const VISIBLE_STAINLESS_STRUCTURE: PoolStructure = "visible-stainless-steel";

export function isVisibleStainlessStructure(structure: PoolStructure | null): boolean {
  return structure === VISIBLE_STAINLESS_STRUCTURE;
}

export function allowedFinishesForStructure(
  structure: PoolStructure | null,
): readonly SelectableFinishMaterial[] {
  if (structure === VISIBLE_STAINLESS_STRUCTURE) return [];
  if (structure === "modular-steel-panels") return ["liner"];
  return ["liner", "mosaic"];
}

export function normaliseFinishForStructure(
  structure: PoolStructure | null,
  finish: FinishMaterial | unknown,
): FinishMaterial {
  if (structure === VISIBLE_STAINLESS_STRUCTURE) return "none";
  if (structure === "modular-steel-panels") return "liner";
  return finish === "mosaic" ? "mosaic" : "liner";
}

export function structureSupportsPoolType(
  structure: PoolStructure | null,
  poolType: PoolType | null,
): boolean {
  if (structure === null || poolType === null) return false;
  if (structure === "reinforced-concrete") return poolType === "in-ground";
  return true;
}

/** Legacy projects used `modular-steel-structure` for the above-ground
 * panel shell. It migrates to steel panels, never to the new visible-inox
 * product, so restore cannot silently change what the customer bought. */
export function normalisePoolStructure(value: unknown): PoolStructure | null {
  if (value === "modular-steel-structure") return "modular-steel-panels";
  if (value === "reinforced-concrete") return value;
  if (value === "modular-steel-panels") return value;
  if (value === VISIBLE_STAINLESS_STRUCTURE) return VISIBLE_STAINLESS_STRUCTURE;
  return null;
}

export function finishDescription(
  structure: PoolStructure | null,
  finish: FinishMaterial,
): string {
  if (structure === VISIBLE_STAINLESS_STRUCTURE || finish === "none") {
    return "Nessuno — vasca inox a vista";
  }
  return finish === "mosaic" ? "Mosaico" : "Liner / PVC";
}
