/** Pure comfort-selection rules (no three/React) shared by store, persistence and the engine. */

/** Sun shelf and hydromassage are alternatives for the same comfort zone. The
 * option selected last wins (`prefer`); with no preference the shelf is kept. */
export function normalizeComfortFeatures<T extends string>(
  features: ReadonlyArray<T>,
  prefer?: T,
): T[] {
  const ids = features as ReadonlyArray<string>;
  if (!ids.includes("sunShelf") || !ids.includes("hydromassage")) return [...features];
  const drop = prefer === "hydromassage" ? "sunShelf" : "hydromassage";
  return features.filter((id) => (id as string) !== drop);
}

export function activeFlightKind(
  features: ReadonlyArray<string>,
): "sunShelf" | "hydromassage" | null {
  const f = normalizeComfortFeatures(features);
  return f.includes("sunShelf") ? "sunShelf" : f.includes("hydromassage") ? "hydromassage" : null;
}
