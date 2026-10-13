/** Pure comfort-selection rules (no three/React) shared by store, persistence and the engine. */

/** Sun shelf and hydromassage are alternatives for the same comfort zone. The
 * option selected last wins (`prefer`); with no preference the shelf is kept.
 * The integrated bench belongs to the sun shelf: without the shelf (no
 * comfort, or hydromassage) a previously chosen bench is dropped. */
export function normalizeComfortFeatures<T extends string>(
  features: ReadonlyArray<T>,
  prefer?: T,
): T[] {
  const ids = features as ReadonlyArray<string>;
  const drop =
    ids.includes("sunShelf") && ids.includes("hydromassage")
      ? prefer === "hydromassage"
        ? "sunShelf"
        : "hydromassage"
      : null;
  const resolved = features.filter((id) => (id as string) !== drop);
  return resolved.includes("sunShelf" as T)
    ? resolved
    : resolved.filter((id) => (id as string) !== "integratedBench");
}

export function activeFlightKind(
  features: ReadonlyArray<string>,
): "sunShelf" | "hydromassage" | null {
  const f = normalizeComfortFeatures(features);
  return f.includes("sunShelf") ? "sunShelf" : f.includes("hydromassage") ? "hydromassage" : null;
}
