/** Owner-supplied LT302 colour photographs. Descriptive labels, not invented
 * commercial names. Display approximations, not certified colour swatches. */
export const SUN_SHELF_LOUNGER_COLORS = [
  { id: "white", label: "Bianco", hex: "#ffffff" },
  { id: "agt", label: "Verde lime", hex: "#98c573" },
  { id: "amb", label: "Grigio tortora", hex: "#adb1a6" },
  { id: "aqm", label: "Acquamarina", hex: "#b8dad3" },
  { id: "fer", label: "Grigio azzurro", hex: "#97adb0" },
  { id: "gda", label: "Verde chiaro", hex: "#add5a3" },
] as const;

export type SunShelfLoungerColorId = (typeof SUN_SHELF_LOUNGER_COLORS)[number]["id"];
export function isSunShelfLoungerColor(value: unknown): value is SunShelfLoungerColorId {
  return SUN_SHELF_LOUNGER_COLORS.some(color => color.id === value);
}
/** Older projects without a colour use the owner's standard white. */
export function sunShelfLoungerColor(value: unknown) {
  return SUN_SHELF_LOUNGER_COLORS.find(color => color.id === value) ?? SUN_SHELF_LOUNGER_COLORS[0];
}
