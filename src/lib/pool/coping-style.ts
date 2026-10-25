import type { PoolConfig } from "./types";

export type CopingStyle = "dedicated" | "flush";
export type CopingEdge = "square" | "rounded";
export const COPING_EDGE_RADIUS = .006;
export const isCopingStyle = (value: unknown): value is CopingStyle => value === "dedicated" || value === "flush";
export const isCopingEdge = (value: unknown): value is CopingEdge => value === "square" || value === "rounded";
type CopingSystem = Pick<PoolConfig, "poolType" | "system" | "overflowType"> & {shape?: PoolConfig["shape"]};
export const supportsCopingStyle = (config: CopingSystem) =>
  config.poolType === "in-ground" && config.system === "overflow" && config.overflowType === "continuous";
export const supportsCopingEdge = (config: CopingSystem) =>
  config.poolType === "in-ground" && config.system === "skimmer" &&
    (!config.shape || config.shape === "rectangle" || config.shape === "l-shape");
export const copingEdgeRadius = (config: CopingSystem & { copingEdge?: CopingEdge | undefined }) =>
  supportsCopingStyle(config) ? COPING_EDGE_RADIUS : supportsCopingEdge(config)
    ? config.copingEdge === "rounded" ? COPING_EDGE_RADIUS : .0018 : undefined;
export function integratedCoping(config: Pick<PoolConfig, "poolType" | "system" | "overflowType"> & { copingStyle?: CopingStyle | undefined }) {
  return supportsCopingStyle(config) && config.copingStyle !== "dedicated";
}
