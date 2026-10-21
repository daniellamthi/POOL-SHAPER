import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Raycaster,
  Vector3,
  ShaderChunk,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { calibratedLedColor, LED_OPTICS, ledIntensityScale } from "../src/lib/pool/led-optics";
import {
  benchMicroSpotBeam,
  MICRO_SPOT_OPTICS,
  microSpotPresentation,
} from "../src/lib/pool/micro-spot-optics";
import { HYDRO_DIMENSIONS } from "../src/lib/pool/comfort-plan";
import { configuredPoolLayout } from "../src/lib/pool/resolved-layout";
import { buildOutline } from "../src/lib/pool/geometry";
import { buildFloorProfile } from "../src/lib/pool/floor-profile";
import { getPoolVerticalLayout } from "../src/lib/pool/vertical-layout";
import { POOL_BORDER_PRESET } from "../src/configurator/materials/visual-presets";
import { shelfStairGeometry } from "../src/components/pool/three/PoolComfortModel";
import { createSlopedFloorGeometry } from "../src/components/pool/three/poolGeometry";
import { backendFixture } from "./backend-fixtures";
import { describeSelection } from "../src/components/pool/wizard/wizard-model";
import {
  applyLedTransmission,
  createMicroSpotTransport,
  updateMicroSpotTransport,
  MAX_MICRO_SPOT_SOURCES,
} from "../src/components/pool/three/ledTransmission";

let checks = 0,
  cases = 0;
let benchBeams = 0,
  unraisedBeams = 0,
  slopedBeams = 0,
  minDrop = Infinity,
  maxDrop = 0;
const check = (value: unknown, reason: string) => {
  assert.ok(value, reason);
  checks++;
};
const near = (a: number, b: number, reason: string) => check(Math.abs(a - b) < 1e-7, reason);

// The installed renderer's finite-distance window is the physical oracle:
// old tests checked geometry only and missed a zero cutoff after regularisation.
check(
  ShaderChunk.lights_pars_begin.includes(
    "pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) )",
  ),
  "Read the actual renderer's finite cutoff, not just source-to-target geometry",
);
const attenuation = (distance: number, cutoff: number) =>
  Math.max(0, 1 - (distance / cutoff) ** 4) ** 2 / Math.max(distance ** 2, 0.01);
const transport = createMicroSpotTransport(),
  otherCanvas = createMicroSpotTransport();
check(
  transport.origins.value !== otherCanvas.origins.value &&
    transport.origins.value[0] !== otherCanvas.origins.value[0],
  "No shared source registry between canvases",
);
const originalVectors = [...transport.origins.value];
updateMicroSpotTransport(transport, [{ x: 1, y: -0.6, z: 2, dir: [0, 1] }]);
near(
  transport.origins.value[0]!.z,
  2 + MICRO_SPOT_OPTICS.lensCenter + MICRO_SPOT_OPTICS.emitterEpsilon,
  "Uniform registers the actual lens emitter, not the wall mounting point",
);
updateMicroSpotTransport(transport, []);
check(
  transport.count.value === 0 &&
    transport.origins.value.every((vector, i) => vector === originalVectors[i]),
  "ON/OFF updates count but allocates no replacement vectors",
);
assert.throws(
  () =>
    updateMicroSpotTransport(
      transport,
      Array.from({ length: MAX_MICRO_SPOT_SOURCES + 1 }, () => ({
        x: 0,
        y: 0,
        z: 0,
        dir: [1, 0] as const,
      })),
    ),
  RangeError,
);
checks++;
const stubShader = () =>
  ({
    uniforms: {},
    vertexShader: "",
    fragmentShader:
      "#include <lights_pars_begin>\n#include <shadowmap_pars_fragment>\n#include <lights_fragment_begin>",
  }) as WebGLProgramParametersWithUniforms;
const mainShader = stubShader(),
  microShader = stubShader();
const transportCamera = new PerspectiveCamera();
applyLedTransmission(mainShader);
applyLedTransmission(microShader, transport, () => transportCamera);
check(
  mainShader.fragmentShader.includes(
    `float ledDistance = sqrt(lightDistance * lightDistance + ${LED_OPTICS.nearField ** 2});`,
  ) && !mainShader.fragmentShader.includes("poolMicroSpotCount"),
  "Main PAR transport remains the exact original1.4m path when no micro registry is supplied",
);
check(!microShader.fragmentShader.includes("for (int microIndex") && microShader.fragmentShader.includes("poolSpotNearFields[UNROLLED_LOOP_INDEX]"), "Emitter search occurs once per draw, not per fragment; actual renderer light ordering is preserved");
const testEmitter = {x:1,y:-0.6,z:2,dir:[0,1] as const};
updateMicroSpotTransport(transport, [testEmitter]);
for (const cameraPosition of [[12,6,8],[-8,3,-12],[4,-3,6]]) {
  transportCamera.position.set(...cameraPosition as [number,number,number]);
  transportCamera.lookAt(0,-0.4,0); transportCamera.updateMatrixWorld(true);
  const mainOrigin = new Vector3(3,-0.6,-2), microOrigin = transport.origins.value[0]!.clone();
  for (const sorted of [[mainOrigin,microOrigin],[microOrigin,mainOrigin]]) {
    microShader.uniforms["spotLights"] = {value:sorted.map(position => ({position:position.clone().applyMatrix4(transportCamera.matrixWorldInverse)}))};
    const fields = microShader.uniforms["poolSpotNearFields"]!.value as Float32Array;
    sorted.forEach((position,i) => near(fields[i]!,position === microOrigin ? MICRO_SPOT_OPTICS.nearField : LED_OPTICS.nearField,"World emitter identity survives camera changes and renderer reordering"));
    check(microShader.uniforms["poolSpotNearFields"]!.value === fields, "Steady draws reuse the lookup buffer");
    updateMicroSpotTransport(transport, []);
    check([...microShader.uniforms["poolSpotNearFields"]!.value].every(value => Math.abs(value-LED_OPTICS.nearField)<1e-7), "OFF removes micro classification from every existing light");
    updateMicroSpotTransport(transport,[testEmitter]);
  }
}

for (const colour of [
  "#ffffff",
  "#ff0000",
  "#00ff00",
  "#0000ff",
  "#ffff00",
  "#00ffff",
  "#ff00ff",
  "#ff7a00",
])
  for (const dimmer of [0, 0.25, 0.5, 0.75, 1, Number.NaN]) {
    const main = calibratedLedColor(colour),
      level = ledIntensityScale(dimmer);
    const night = microSpotPresentation(true, colour, dimmer);
    check(night.colour.equals(main), "Micro lens and light use exactly the main RGB calibration");
    near(
      night.emission,
      LED_OPTICS.presentations.night.emission * 0.28 * level.emission,
      "Same main dimmer curve on the miniature lens",
    );
    near(
      night.output,
      MICRO_SPOT_OPTICS.outputCandela * LED_OPTICS.presentations.night.output * level.output,
      "Same main dimmer curve on the short footwell beam",
    );
    const day = microSpotPresentation(false, colour, dimmer);
    check(day.emission === 0 && day.output === 0, "Day never emits, including every RGB setting");
  }
const radius = HYDRO_DIMENSIONS.spotDiameter / 2;
check(HYDRO_DIMENSIONS.spotDiameter <= 0.04, "Miniature pool fitting, not a resized main PAR lamp");
check(
  MICRO_SPOT_OPTICS.bodyCenter + MICRO_SPOT_OPTICS.bodyDepth / 2 < MICRO_SPOT_OPTICS.lensCenter,
  "Recessed metal body cannot occlude its lens",
);
check(
  MICRO_SPOT_OPTICS.trimCenter + MICRO_SPOT_OPTICS.trimTube <= 0.003,
  "No floating body: visible trim projects less than3mm from actual riser",
);
check(
  MICRO_SPOT_OPTICS.lensRadiusRatio * HYDRO_DIMENSIONS.spotDiameter <
    radius - MICRO_SPOT_OPTICS.trimTube,
  "Lens fits inside the rolled satin trim",
);

for (const [length, width] of [
  [6, 3],
  [8, 4],
  [12, 5],
])
  for (const stairType of ["linear", "corner"] as const)
    for (const mirrored of [false, true])
      for (const side of [0, 1, 2, 3]) {
        const base = backendFixture("B").config;
        const config = {
          ...base,
          dimensions: { ...base.dimensions, length: length!, width: width! },
          internalStairType: stairType,
          internalStairMirrored: mirrored,
          features: ["stairLighting"] as typeof base.features,
          infinityEdge: { ...base.infinityEdge!, side },
        };
        const layout = configuredPoolLayout(config),
          access = layout.access;
        const without = configuredPoolLayout({ ...config, features: [] });
        assert.deepEqual(layout.access, without.access);
        checks++;
        assert.deepEqual(layout.lighting, without.lighting);
        checks++;
        for (const spot of layout.stairMicroSpots) {
          check(
            [spot.x, spot.y, spot.z, ...spot.dir].every(Number.isFinite),
            "Finite world fixture transform",
          );
          near(
            Math.hypot(...spot.dir),
            1,
            "Normal stays normalized through all mirrored orientations",
          );
          if (access.corner && !access.corner.rectangular && access.placement) {
            const dx = spot.x - access.placement.x,
              dz = spot.z - access.placement.z;
            const c = Math.cos(access.placement.rotation),
              s = Math.sin(access.placement.rotation);
            near(
              c * dx - s * dz,
              s * dx + c * dz,
              "Every curved riser fitting is centred at45degrees locally",
            );
          }
        }
        if (access.corner && !access.corner.rectangular)
          check(
            layout.stairMicroSpots.length === access.steps,
            "Exactly one fitting per curved riser, no dotted paired arcs",
          );
        cases++;
      }

for (const [length, width] of [
  [6, 3],
  [8, 4],
  [12, 5],
])
  for (const variant of ["closed", "open"] as const)
    for (const wallType of ["traditional", "glass"] as const)
      for (const sloped of [false, true])
        for (const depth of [0.9, 1.5, 2.4])
          for (const scenario of ["A", "B"] as const)
            for (const side of [0, 1, 2, 3]) {
              if (scenario === "A" && (side !== 0 || wallType !== "traditional")) continue;
              const base = backendFixture(scenario).config;
              const config = {
                ...base,
                dimensions: {
                  ...base.dimensions,
                  length: length!,
                  width: width!,
                  depth,
                  floorProfile: sloped ? ("slope" as const) : ("flat" as const),
                  shallowDepth: Math.min(depth - 0.1, 1.25),
                },
                features: ["hydromassage", "hydromassageBenchLighting"] as typeof base.features,
                internalStairType: "linear" as const,
                hydromassageVariant: variant,
                infinityEdge: { ...base.infinityEdge!, side, wallType },
              };
              const layout = configuredPoolLayout(config),
                hydro = layout.comfort.elements.find((e) => e.kind === "hydromassage");
              if (!hydro) {
                check(
                  !describeSelection("lighting", config).includes("micro-spot panca"),
                  "Unavailable hydro cannot advertise bench lighting",
                );
                continue;
              }
              updateMicroSpotTransport(transport, [...layout.stairMicroSpots, ...hydro.spots!]);
              check(
                transport.count.value <= MAX_MICRO_SPOT_SOURCES,
                "Actual supported combined stair+bench count fits transport capacity",
              );
              const noLight = configuredPoolLayout({ ...config, features: ["hydromassage"] });
              assert.deepEqual(layout.comfort, noLight.comfort);
              checks++;
              check(
                describeSelection("lighting", { ...config, sceneTime: "night" }).includes(
                  "micro-spot panca",
                ),
                "Available selected bench lighting appears in the actual footer",
              );
              check(
                !describeSelection("lighting", {
                  ...config,
                  features: ["hydromassage"],
                  sceneTime: "night",
                }).includes("micro-spot panca"),
                "BenchOFF is not advertised in the footer",
              );
              const seats = hydro.tiers!.filter((t) =>
                ["backSeat", "sideSeat", "innerSideSeat"].includes(t.role),
              );
              check(
                hydro.spots!.length === seats.length &&
                  hydro.spots!.length >= 2 &&
                  hydro.spots!.length <= 3,
                "Only one centred foot-face fitting per real bench: two onL, three onU",
              );
              const outline = buildOutline(config.shape, config.dimensions, config.controlPoints);
              const vertical = getPoolVerticalLayout({
                poolType: config.poolType!,
                system: config.system,
                overflowType: config.overflowType,
                depth: config.dimensions.depth,
                copingThickness: POOL_BORDER_PRESET.thickness,
              });
              const floor = buildFloorProfile({
                outline,
                shape: config.shape,
                poolType: config.poolType!,
                dimensions: config.dimensions,
                verticalLayout: vertical,
                sunShelf: true,
                infinityEdge: config.infinityEdge,
              });
              const geometry = shelfStairGeometry(hydro, floor),
                material = new MeshBasicMaterial({ side: DoubleSide });
              const mesh = new Mesh(geometry, material);
              mesh.updateMatrixWorld();
              const floorGeometry = createSlopedFloorGeometry(outline, floor.floorYAt, floor);
              const floorMesh = new Mesh(floorGeometry, material);
              floorMesh.updateMatrixWorld();
              for (const spot of hydro.spots!) {
                near(Math.hypot(...spot.dir), 1, "Bench fitting outward normal");
                const ray = new Raycaster(
                  new Vector3(spot.x + spot.dir[0] * 0.04, spot.y, spot.z + spot.dir[1] * 0.04),
                  new Vector3(-spot.dir[0], 0, -spot.dir[1]),
                );
                const hits = ray.intersectObject(mesh);
                check(
                  !!hits[0] && Math.abs(hits[0].distance - 0.04) < 0.00001,
                  "Each lens mounts flush on the actual rendered seat front, never a backrest or floating plane",
                );
                const seatY = hydro.tiers!.find((t) => t.role === "backSeat")!.topY;
                near(
                  spot.y,
                  seatY - HYDRO_DIMENSIONS.spotBelowSeat,
                  "Lighting remains below approved seat, not beside the jets",
                );
                check(
                  hydro.jets!.every(
                    (jet) =>
                      Math.hypot(jet.x - spot.x, jet.y - spot.y, jet.z - spot.z) >
                      HYDRO_DIMENSIONS.jetDiameter,
                  ),
                  "Dedicated lights are separate from technical nozzles",
                );
                const beam = benchMicroSpotBeam(spot, hydro, floor);
                benchBeams++;
                if (sloped) slopedBeams++;
                if (!hydro.tiers!.some((tier) => tier.role === "tubFloor")) unraisedBeams++;
                minDrop = Math.min(minDrop, -beam.target[1]);
                maxDrop = Math.max(maxDrop, -beam.target[1]);
                const origin = new Vector3(
                  spot.x + spot.dir[0] * (MICRO_SPOT_OPTICS.lensCenter + 0.0002),
                  spot.y,
                  spot.z + spot.dir[1] * (MICRO_SPOT_OPTICS.lensCenter + 0.0002),
                );
                const target = new Vector3(
                  spot.x + spot.dir[0] * beam.target[2],
                  spot.y + beam.target[1],
                  spot.z + spot.dir[1] * beam.target[2],
                );
                const delta = target.clone().sub(origin),
                  distance = delta.length();
                const microDistance = Math.hypot(distance, MICRO_SPOT_OPTICS.nearField);
                check(
                  microDistance < beam.range && attenuation(microDistance, beam.range) > 0,
                  "Explicit micro transport yields nonzero irradiance at actual feet, unlike PAR regularization's zero cutoff",
                );
                const footHits = new Raycaster(
                  origin,
                  delta.normalize(),
                  0.0001,
                  beam.range,
                ).intersectObjects([mesh, floorMesh]);
                check(
                  !!footHits[0] && Math.abs(footHits[0].distance - distance) < 0.0001,
                  "Actual beam axis reaches the actual rendered footwell, including slopes and low unraised floors",
                );
                check(
                  beam.range > distance * 2,
                  "Footwell is well inside the smooth cutoff, never at its zero-light boundary",
                );
                check(
                  beam.target[1] < 0 && beam.target[2] > 0 && beam.target[2] <= 0.5,
                  "Bench beam aims down into adjacent free legroom, never at jets/backrest",
                );
              }
              geometry.dispose();
              floorGeometry.dispose();
              material.dispose();
              cases++;
            }
const source = readFileSync("src/components/pool/three/PoolComfortModel.tsx", "utf8");
check(
  attenuation(Math.hypot(0.42, LED_OPTICS.nearField), 0.9) === 0 &&
    attenuation(Math.hypot(0.42, MICRO_SPOT_OPTICS.nearField), 0.9) > 0,
  "Reproduced cause: PAR1.4m regularizer exceeds a miniature0.9m cutoff and zeros the light; mini aperture path does not",
);
check(
  unraisedBeams > 0 && slopedBeams > 0,
  `Real raycast coverage includes unraised footwells and slopes, not only raised flat tubs: ${unraisedBeams}unraised/${slopedBeams}sloped`,
);
const jetSource = source.slice(source.indexOf("function HydroJet"));
check(
  !/emissive|Light\b|AdditiveBlending/.test(jetSource),
  "Hydromassage nozzles never emit light",
);
check(
  !source.includes("AdditiveBlending") && !source.includes('"#ffd9a0"'),
  "No oversized warm additive disc left on micro-spots",
);
check(source.includes("castShadow={false}"), "Micro beam adds no shadow-map render passes");
const model = readFileSync("src/components/pool/three/PoolModel.tsx", "utf8");
check(
  model.includes('features.includes("stairLighting")') &&
    model.includes('features.includes("hydromassageBenchLighting")'),
  "Independent existing optional switches preserved",
);
check(
  model.includes("ledColor={ledColor} ledIntensity={ledIntensity}"),
  "Actual stair renderer receives global colour and dimmer",
);
const footer = backendFixture("A").config;
check(
  describeSelection("lighting", {
    ...footer,
    features: ["stairLighting"],
    sceneTime: "night",
  }).includes("micro-spot scale"),
  "Stair-only footer remains independent of bench optional",
);
check(
  !describeSelection("lighting", {
    ...footer,
    features: ["stairLighting"],
    sceneTime: "night",
  }).includes("micro-spot panca"),
  "Stair-only footer never invents bench illumination",
);
console.log(
  `PASS — ${checks} micro-spot realism/RGB/geometry checks, ${cases} configurations; ${benchBeams} actual footwell raycasts (${unraisedBeams} unraised,${slopedBeams} sloped), drop ${minDrop.toFixed(3)}–${maxDrop.toFixed(3)}m; day non-emissive, centred risers,2L/3U, unchanged solids, independent optionals`,
);
