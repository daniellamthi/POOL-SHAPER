import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Raycaster, Vector3 } from "three";
import { configuredPoolLayout } from "../src/lib/pool/resolved-layout";
import { buildOutline, outlineArea, outlineCentroid } from "../src/lib/pool/geometry";
import { buildFloorProfile } from "../src/lib/pool/floor-profile";
import { getPoolVerticalLayout } from "../src/lib/pool/vertical-layout";
import { clampInfinityEdgeParams, infinityExclusion } from "../src/lib/pool/infinity-edge";
import { clearOfInfinityEdge } from "../src/lib/pool/infinity-access";
import { shelfStairGeometry } from "../src/components/pool/three/PoolComfortModel";
import { RawShellMaterial } from "../src/components/pool/three/RawShellMaterial";
import { DEFAULT_CONTROL_POINTS, DEFAULT_DIMENSIONS } from "../src/lib/pool/config";
import { parseProjectConfiguration, serializeProjectConfiguration } from "../src/lib/pool/project";
import { DEFAULT_MOSAIC_FINISH_ID } from "../src/configurator/materials/interior-textures";
import type { PoolConfig } from "../src/lib/pool/types";

let checks = 0, glassChanges = 0, radialFlights = 0, safelyUnavailable = 0;
const check = (value: unknown, message: string) => { assert(value, message); checks++; };
const equal = (a: unknown, b: unknown, message: string) => { assert.deepEqual(a, b, message); checks++; };
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
function config(length: number, width: number, side: number, wallType: "traditional" | "glass", variant: "closed" | "open", corner = false, inox = false): PoolConfig {
  return {
    projectType: "new", poolType: "in-ground", structure: "steel", shape: "rectangle", shapeSelected: true,
    copingMaterial: "travertine", customMode: "draw", controlPoints: DEFAULT_CONTROL_POINTS,
    dimensions: { ...DEFAULT_DIMENSIONS, length, width, depth: 1.5, floorProfile: "flat" },
    system: "infinity", overflowType: "hidden", skimmerFinish: "white", skimmerType: "slim",
    finish: "liner", linerColor: "motionBlackStone799", mosaicFinish: DEFAULT_MOSAIC_FINISH_ID,
    features: ["hydromassage", "stairLighting", "hydromassageBenchLighting", ...(inox ? ["inoxLadder" as const] : [])],
    ledColor: "#ffffff", ledIntensity: 0.6, poolAccess: "internalSteps", internalStairType: corner ? "corner" : "linear",
    hydromassageVariant: variant, infinityEdge: clampInfinityEdgeParams({ enabled: true, side, wallType }),
    equipment: [], customer: {} as PoolConfig["customer"], uploads: [],
  };
}
const hydro = (c: PoolConfig) => configuredPoolLayout(c).comfort.elements.find(e => e.kind === "hydromassage")!;
for (const [length, width] of [[6, 3], [8, 4], [12, 5]]) for (let side = 0; side < 4; side++) for (const variant of ["closed", "open"] as const) {
  const traditional = config(length!, width!, side, "traditional", variant);
  const glass = config(length!, width!, side, "glass", variant);
  const before = hydro(traditional), after = hydro(glass);
  check(before && after, `hydro remains available ${length}/${side}/${variant}`);
  const outline = buildOutline(glass.shape, glass.dimensions, glass.controlPoints);
  const excluded = infinityExclusion(outline, glass.infinityEdge!, glass.shape)!;
  const outer = before.tiers!.find(t => t.role === "sideSeat")!;
  const touchesGlass = outer.footprint.some(p => near(p[excluded.axis === "x" ? 0 : 1], excluded.coordinate));
  if (touchesGlass) {
    glassChanges++;
    check(!after.tiers!.some(t => t.role === "sideSeat"), "no seat along glass");
    equal(after.tiers!.filter(t => ["backSeat", "innerSideSeat"].includes(t.role)).length, 2, "L has two solid-wall seats");
    check(after.jets!.every(p => Math.abs(p[excluded.axis] - excluded.coordinate) > 0.08), "no jet on glass");
    check(after.spots!.every(p => Math.abs(p[excluded.axis] - excluded.coordinate) > 0.08), "no floating spot on removed seat");
    const floor = after.tiers!.find(t => t.role === "tubFloor")!;
    check(floor.footprint.some(p => near(p[excluded.axis === "x" ? 0 : 1], excluded.coordinate)), "floor fills released glass-side strip");
    check(near(after.tiers!.reduce((sum, tier) => sum + outlineArea(tier.footprint), 0), outlineArea(after.footprint)), "tiers tile complete footprint without holes/overlaps");
    equal(after.topY, before.topY, "backrest elevation unchanged");
    equal(after.tiers!.find(t => t.role === "backSeat")!.topY, before.tiers!.find(t => t.role === "backSeat")!.topY, "seat elevation unchanged");
  } else equal(after, before, "glass away from hydro does not alter bench");
  for (const inox of [false, true]) {
    const c = config(length!, width!, side, "glass", variant, true, inox), resolved = configuredPoolLayout(c), h = hydro(c);
    check(h && !h.steps && !h.landing && !h.riser, "no duplicate integrated straight flight");
    equal(resolved.effectiveAccess, "internalSteps", "selected corner access respected");
    if (resolved.access.corner) {
      check(!resolved.access.corner.rectangular && !resolved.access.reason, "available corner is genuinely radial");
      radialFlights++;
      check(clearOfInfinityEdge(outline, excluded, resolved.access.footprint), "radial flight keeps Infinity clearance");
      check(resolved.stairMicroSpots.length > 0, "micro-spots follow radial flight");
    } else {
      safelyUnavailable++;
      check(resolved.status === "UNAVAILABLE" && !!resolved.access.reason && !resolved.access.placement,
        `insufficient space rejects corner explicitly, never substitutes straight ${length}x${width}/${side}/${variant}`);
    }
    if (inox) check(resolved.ladder?.status !== "UNAVAILABLE", "inox addition remains valid");
    const vertical = getPoolVerticalLayout({ poolType: c.poolType!, system: c.system, overflowType: c.overflowType, depth: c.dimensions.depth });
    const profile = buildFloorProfile({ outline, shape: c.shape, poolType: c.poolType!, dimensions: c.dimensions, verticalLayout: vertical, sunShelf: true, infinityEdge: c.infinityEdge });
    const geometry = shelfStairGeometry(h, profile);
    const position = geometry.getAttribute("position");
    check(position.count > 0 && Array.from(position.array).every(Number.isFinite), "tiered Hydro mesh finite without integrated flight");
    // Verify the real generated heightfield still contains the seat and tub floor.
    for (const tier of h.tiers!.filter(t => ["backSeat", "innerSideSeat", "tubFloor"].includes(t.role))) {
      const [x, z] = outlineCentroid(tier.footprint);
      const hit = new Raycaster(new Vector3(x, 1, z), new Vector3(0, -1, 0)).ray;
      let top = -Infinity;
      const point = new Vector3();
      for (let i = 0; i < position.count; i += 3) {
        const a = new Vector3().fromBufferAttribute(position, i), b = new Vector3().fromBufferAttribute(position, i + 1), d = new Vector3().fromBufferAttribute(position, i + 2);
        if (hit.intersectTriangle(a, b, d, false, point)) top = Math.max(top, point.y);
      }
      check(Math.abs(top - tier.topY) < 1e-5, `actual mesh retains ${tier.role} elevation`);
    }
    geometry.dispose();
    const restored = parseProjectConfiguration(serializeProjectConfiguration({
      schemaVersion: 1, projectId: "hydro-glass-corner-qa", config: c,
      renovation: { areas: [], currentFinish: "liner", filtrationWorks: [], replaceCoping: null, copingMaterial: "", structureIssues: [], equipmentUpgrades: [] },
    })).config;
    equal(restored.internalStairType, "corner", "corner selection round-trips");
    equal(restored.infinityEdge?.wallType, "glass", "glass selection round-trips");
    equal(hydro(restored).tiers, h.tiers, "saved configuration derives same L");
  }
  const legacy = { ...traditional, infinityEdge: { ...traditional.infinityEdge!, wallType: undefined } };
  equal(configuredPoolLayout(legacy), configuredPoolLayout(traditional), "legacy wall default unchanged");
  const skim = { ...glass, system: "skimmer" as const };
  equal(configuredPoolLayout(skim), configuredPoolLayout({ ...skim, infinityEdge: undefined }), "stale glass value has no effect outside Infinity");
}
const raw = RawShellMaterial({ kind: "steel", seamlessSteel: true });
const pixels = raw.props.map.image.data as Uint8Array;
let boundary = 0, inner = 0, rows = 0;
for (let y = 0; y < 512; y += 16) {
  boundary += pixels[(y * 512) * 4]!;
  inner += pixels[(y * 512 + 256) * 4]!;
  rows++;
}
check(boundary / rows > 150 && Math.abs(boundary - inner) / rows < 15, "steel scan has no dark artificial panel seam");
const exterior = RawShellMaterial({ kind: "steel" }).props.map.image.data as Uint8Array;
check(exterior[0] === 82, "exterior steel panel joints unchanged");
check(readFileSync("src/components/pool/three/PoolComfortModel.tsx", "utf8").includes("element.tiers?.length || element.steps"), "renderer selects heightfield for tiers even without steps");
check(glassChanges > 0 && radialFlights > 0, "new branches exercised");
console.log(`PASS hydro-glass-corner: ${checks} checks; ${glassChanges} glass-side L plans; ${radialFlights} radial flights; ${safelyUnavailable} explicit insufficient-space rejections`);
