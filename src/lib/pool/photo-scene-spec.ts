import type { ProjectConfiguration } from "./project";
import { buildOutline, computeMetrics, outlineBounds } from "./geometry";
import { getPoolVerticalLayout } from "./vertical-layout";
import { buildFloorProfile } from "./floor-profile";
import { configuredPoolLayout } from "./resolved-layout";
import { planSkimmers } from "./engineering";
import { resolveMaterials } from "./materials";
import { POOL_BORDER_PRESET, WATER_VISUAL_PRESET } from "@/configurator/materials/visual-presets";
import { pavingId, premiumEnvironment, PAVING } from "./presentation";
import { normalisedLedIntensity } from "./led-optics";
import { computeInfinityEdgeGeometry, infinityExclusion } from "./infinity-edge";
import { resolveAutomaticCover } from "./cover-plan";
import { oppositeInfinityCoordinate } from "./infinity-access";
import { resolvedAccessAnchors } from "./technical-plan";
import { structureFamily } from "./construction-presentation";

/** Data contract only. No renderer, generative redesign, UI theme, or customer PII.
 * The future renderer must build product geometry from these same versioned
 * resolvers, not infer it from a prompt or a photograph. */
export function createPhotoSceneSpec(project: ProjectConfiguration) {
  const config = project.config;
  if (config.shape === "organic") throw new Error("Unsupported retired pool shape");
  const { customer: _customer, uploads: _uploads, ...selection } = config;
  const outline = buildOutline(config.shape, config.dimensions, config.controlPoints);
  const poolType = config.poolType ?? "in-ground";
  const elevations = getPoolVerticalLayout({ poolType, system: config.system,
    overflowType: config.overflowType, depth: config.dimensions.depth,
    copingThickness: POOL_BORDER_PRESET.thickness });
  const { floorYAt: _floorY, depthAt: _depth, ...floor } = buildFloorProfile({
    outline, shape: config.shape, poolType, dimensions: config.dimensions,
    verticalLayout: elevations,
    sunShelf: config.features.includes("sunShelf") || config.features.includes("hydromassage"),
    infinityEdge: config.system === "infinity" ? config.infinityEdge : null,
  });
  const bounds = outlineBounds(outline);
  const layout = configuredPoolLayout(config);
  const resolvedMaterials = resolveMaterials(config);
  const excluded = config.system === "infinity" && config.infinityEdge
    ? infinityExclusion(outline, config.infinityEdge, config.shape) : null;
  const spec = {
    schema: "POOL_SHAPER_PHOTO_SCENE_SPEC", version: 1, projectId: project.projectId,
    sourceSchemaVersion: project.schemaVersion, renovation: project.renovation,
    units: "metres", axes: { up: "+Y", footprint: "XZ" },
    rendering: { status: "not-implemented", productRedesignAllowed: false },
    selection,
    structureType: structureFamily(config.structure),
    pool: { outline, elevations, floor, layout,
      skimmers: planSkimmers(outline, computeMetrics(outline, config.dimensions.depth).waterSurface, config.system === "skimmer"),
      infinity: config.system === "infinity" && config.infinityEdge ? {
        requested: config.infinityEdge,
        resolved: computeInfinityEdgeGeometry(outline, config.infinityEdge, config.shape),
      } : null,
      materials: resolvedMaterials,
      interiorFinish: config.finish === "none"
        ? {
            material: "visible-stainless-steel",
            label: "Nessun rivestimento aggiuntivo — vasca inox a vista",
            textureUrl: null,
            metalness: 1,
            roughness: 0.32,
          }
        : {
            material: config.finish,
            label: config.finish === "mosaic" ? "Mosaico" : "Liner / PVC",
            textureUrl: resolvedMaterials.surface.textureUrl,
            metalness: resolvedMaterials.liner.metalness,
            roughness: resolvedMaterials.liner.roughness,
          },
      water: WATER_VISUAL_PRESET,
      cover: (() => {
        const plan = resolveAutomaticCover(config);
        return {
          requested: plan.enabled,
          position: plan.position,
          status: plan.status,
          reason: plan.reason,
          geometryAvailable: plan.geometry !== null,
          geometry: plan.geometry,
        };
      })(),
      technicalConfiguration: {
        systemId: config.system,
        overflowId: config.system === "overflow" ? config.overflowType : null,
        skimmerTypeId: config.system === "skimmer" ? config.skimmerType : null,
        compensation: config.system === "skimmer" ? "not-applicable" : "requires-technical-validation",
        infinityAccess: excluded ? {
          selectedOverflowSide: config.infinityEdge?.side ?? null,
          preferredOppositeSide: { axis: excluded.axis,
            coordinate: oppositeInfinityCoordinate(outline, excluded) },
          resolvedStatus: layout.status,
          resolvedAnchors: resolvedAccessAnchors(outline, layout, excluded),
        } : null,
      },
    },
    paving: PAVING.find(p => p.id === pavingId(config.paving))!,
    lighting: { time: config.sceneTime === "night" ? "night" : "day",
      ledsEnabled: config.features.includes("ledLighting"), color: config.ledColor ?? "#ffffff",
      intensity: normalisedLedIntensity(config.ledIntensity) },
    environment: { id: premiumEnvironment(config.premiumEnvironment),
      footprint: outline, poolBounds: bounds,
      // A scale-aware brief, never a stretched photograph or a built room.
      minimumClearanceMetres: 1.5,
      minimumHostSpan: [bounds.spanX + 3, bounds.spanZ + 3],
      humanScale: 1,
      indoorArtDirection: "user-wellness-master-v1",
      infinityIdentity: "Simons Town Rocks",
      geometryStatus: "future-photo-mode-build" },
  } as const;
  // Deep, JSON-safe snapshot: callers cannot mutate the live configuration.
  return JSON.parse(JSON.stringify(spec)) as typeof spec;
}
export type PhotoSceneSpec = ReturnType<typeof createPhotoSceneSpec>;
