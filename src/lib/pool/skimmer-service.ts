/** Generic service cover dimensions, metres; independent of pool size. */
export const SKIMMER_SERVICE_LID = {
  width: 0.235,
  depth: 0.16,
  thickness: 0.004,
  joint: 0.02,
} as const;

/** Local inward Z is positive. Keep the complete cover behind the coping,
 * with its upper surface flush to the existing deck (not to the coping top). */
export function skimmerServicePosition(copingExtent: number, deckY: number) {
  return {
    z: -(copingExtent + SKIMMER_SERVICE_LID.joint + SKIMMER_SERVICE_LID.depth / 2),
    y: deckY - SKIMMER_SERVICE_LID.thickness / 2,
  };
}
