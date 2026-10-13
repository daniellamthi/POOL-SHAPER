import { configuredPoolLayout } from "./resolved-layout";
import { resolveAccessPlan } from "@/components/pool/three/PoolAccessModel";
import { copingOuterOffset } from "@/components/pool/three/poolConstruction";
import type { PoolVerticalLayout } from "./vertical-layout";
import type { PoolConfig, SystemType, OverflowType } from "./types";

/** Flanges sit on coping, or beyond an overflow channel on the ground deck. */
export function accessMounting(
  system: SystemType,
  overflow: OverflowType,
  layout: PoolVerticalLayout,
) {
  const beyondChannel = system === "overflow";
  return {
    ladderAnchorOffset: beyondChannel ? copingOuterOffset(system, overflow) + 0.12 : 0.2,
    ladderAnchorY: beyondChannel ? layout.groundY : layout.copingY,
    ladderDeckAvailable: !beyondChannel || layout.wallTopY <= layout.groundY + 0.01,
  };
}

/** Same plan for selector, validation and 3D. No extra saved selection state. */
export function configuredAccessPlan(config: PoolConfig): ReturnType<typeof resolveAccessPlan> {
  return configuredPoolLayout(config).access;
}
