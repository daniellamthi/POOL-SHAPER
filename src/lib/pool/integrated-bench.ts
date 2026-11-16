/** Presentation layout, not a universal hydraulic or statutory specification.
 * Face reference: Waterway Omni Cluster Revo 243-7009S-DSG, 2.32 in.
 * https://waterwayplastics.com/wp-content/uploads/006501.0424.pdf
 * Final body, pump, suction and flows require the selected supplier's design. */
export const INTEGRATED_BENCH = {
  stationWidth: 0.6,
  maxStations: 4,
  defaultStations: 2,
  jetsPerStation: 4,
  jetPairSpacing: 0.22,
  jetDiameter: 2.32 * 0.0254,
  floorOverlap: 0.002,
} as const;

export function integratedBenchStations(run: number, requested?: number) {
  const capacity = Math.min(INTEGRATED_BENCH.maxStations, Math.max(1, Math.floor((run + 1e-8) / INTEGRATED_BENCH.stationWidth)));
  const desired = Number.isSafeInteger(requested) && requested! > 0 ? requested! : INTEGRATED_BENCH.defaultStations;
  return { capacity, count: Math.min(capacity, desired), adjusted: desired > capacity };
}
