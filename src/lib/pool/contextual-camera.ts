import type { PoolConfig } from "./types";
import type { CameraIntent } from "./camera";

/** Ephemeral presentation intent, never part of ProjectConfiguration. */
export type VisualFocus = "POOL_OVERVIEW" | "DIMENSIONS_TOP" | "DEPTH" | "STAIRS" | "INOX" |
  "SUN_SHELF" | "HYDROMASSAGE" | "BENCH" | "SKIMMER" | "OVERFLOW" | "INFINITY" |
  "INTERIOR_FINISH" | "COPING" | "PAVING" | "LIGHTING" | "COVER" | "TECHNICAL";
export interface FocusRequest { focus: VisualFocus; revision: number }

const accessFocus = (c: PoolConfig): VisualFocus => c.features.includes("sunShelf") ? "SUN_SHELF"
  : c.features.includes("hydromassage") ? "HYDROMASSAGE"
  : c.poolAccess === "internalSteps" ? "STAIRS"
  : c.poolAccess === "stainlessSteelLadder" ? "INOX" : "POOL_OVERVIEW";

/** Interpret the accepted configuration, not optimistic UI selections. */
export function focusForAction(action: { type: string; key?: string; value?: unknown }, c: PoolConfig): VisualFocus | null | undefined {
  switch (action.type) {
    case "next": case "previous": case "goToStep": case "reset": case "restoreProject": return null;
    case "setDimension": return action.key === "depth" || action.key === "shallowDepth" ? "DEPTH" : "DIMENSIONS_TOP";
    case "setFloorProfile": case "toggleSlopeReversed": return "DEPTH";
    case "setShape": case "setControlPoint": case "setLShapeOrientation": return "DIMENSIONS_TOP";
    case "setSystem": case "setOverflowType": case "setInfinitySide": case "setSkimmerType": case "setSkimmerFinish":
      return c.system === "infinity" ? "INFINITY" : c.system === "overflow" ? "OVERFLOW" : "SKIMMER";
    case "setPoolType": case "setPoolStructure": return "POOL_OVERVIEW";
    case "setFinish": case "setLinerColor": case "setMosaicFinish": return "INTERIOR_FINISH";
    case "setCopingMaterial": return "COPING";
    case "setPaving": return "PAVING";
    case "setLedColor": case "setLedIntensity": case "setSceneTime": return "LIGHTING";
    case "setInternalStairType": case "toggleInternalSteps": case "setPoolAccess": return accessFocus(c);
    case "setHydromassageVariant": return accessFocus(c);
    case "toggleInoxLadder": return c.features.includes("inoxLadder") || c.poolAccess === "stainlessSteelLadder" ? "INOX" : accessFocus(c);
    case "togglePoolFeature":
      if (action.value === "ledLighting") return "LIGHTING";
      if (action.value === "integratedBench" && c.features.includes("integratedBench")) return "BENCH";
      return accessFocus(c);
    case "toggleEquipment": return "TECHNICAL"; // No cover geometry exists yet: never imply it is visible.
    case "updateRenovation":
      if (action.value && typeof action.value === "object" && ("targetFinish" in action.value || "linerColor" in action.value || "mosaicFinish" in action.value)) return "INTERIOR_FINISH";
      return undefined;
    default: return undefined;
  }
}

export function nextFocusRequest(previous: FocusRequest | null, focus: VisualFocus | null | undefined): FocusRequest | null {
  if (focus === undefined) return previous;
  if (focus === null) return null;
  // Editing remains in one stable projection. New option selections may reframe
  // after a manual orbit even when they address the same semantic feature.
  if (previous?.focus === focus && (focus === "DIMENSIONS_TOP" || focus === "DEPTH")) return previous;
  return { focus, revision: (previous?.revision ?? 0) + 1 };
}

export function contextualIntent(focus: VisualFocus, c: PoolConfig): CameraIntent {
  switch (focus) {
    case "DIMENSIONS_TOP": return "top";
    case "DEPTH": return "depth";
    case "STAIRS": return "access";
    case "INOX": return "inox";
    case "SUN_SHELF": return "shelf";
    case "HYDROMASSAGE": return "hydromassage";
    case "BENCH": return "bench";
    case "SKIMMER": return "skimmer-detail";
    case "OVERFLOW": return c.overflowType === "hidden" ? "overflow-hidden" : "overflow-visible";
    case "INFINITY": return "infinity";
    case "INTERIOR_FINISH": return c.finish === "mosaic" ? "mosaic" : "liner";
    case "COPING": return "coping";
    case "LIGHTING": return c.system === "infinity" ? "infinity" : "features";
    default: return "review";
  }
}
