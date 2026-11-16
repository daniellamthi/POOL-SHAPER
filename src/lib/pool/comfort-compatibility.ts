import type { PoolConfig } from "./types";
import { configuredPoolLayout } from "./resolved-layout";
import { configuredSunShelfLoungers } from "./sun-shelf-loungers";

export const COMFORT_RESOLUTION_MESSAGE = "Risolvi le scelte comfort non compatibili prima di confermare il progetto.";

/** Requests remain in the canonical draft. Only realizable geometry is rendered;
 * final documents/proposals require explicit resolution, never silent deletion. */
export function comfortConfigurationIssues(config: PoolConfig) {
  const requested = (["sunShelf", "hydromassage", "integratedBench"] as const)
    .filter(kind => config.features.includes(kind));
  const resolved = configuredPoolLayout(config), comfort = resolved.comfort;
  const issues: Array<{feature:string;reason:string}> = requested.flatMap(kind => comfort.availability[kind].available ? [] : [{
    feature: kind,
    reason: comfort?.availability[kind].reason ?? "Non disponibile per questa configurazione.",
  }]);
  if (config.features.includes("integratedBench") && comfort.elements.find(element => element.kind === "integratedBench")?.stations?.adjusted)
    issues.push({ feature: "integratedBench", reason: "Conferma le postazioni della panca: la richiesta supera lo spazio disponibile." });
  if (resolved.effectiveAccess && !resolved.access.placement) issues.push({
    feature: "access", reason: resolved.access.reason ?? "Accesso incompatibile con la zona comfort selezionata.",
  });
  if (resolved.ladder?.status === "UNAVAILABLE") issues.push({
    feature: "inoxLadder", reason: resolved.ladder.plan.reason ?? "Accesso incompatibile con la zona comfort selezionata.",
  });
  if (config.features.includes("sunShelfLoungers") && !issues.some(issue => issue.feature === "sunShelf")) {
    const loungers = configuredSunShelfLoungers(config);
    const invalidCount = config.sunShelfLoungerCount !== undefined &&
      (!Number.isSafeInteger(config.sunShelfLoungerCount) || config.sunShelfLoungerCount < 1);
    if (invalidCount || !loungers.available || loungers.adjusted) issues.push({
      feature: "sunShelf",
      reason: loungers.reason ?? "Non disponibile per questa configurazione.",
    });
  }
  return issues;
}
