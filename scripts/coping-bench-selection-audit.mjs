import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "rolldown";
import { Mesh, MeshBasicMaterial, DoubleSide, Raycaster, Vector3 } from "three";

const root = process.cwd();
const baseline = "e27fe46903811b7b0f91f33259847115bb08f5ae";
const legacyId = resolve("src/lib/pool/comfort-plan.before-selection.ts");
const output = resolve("node_modules/.cache/coping-bench-selection-audit.mjs");
await build({ input: "coping-bench-audit", output: { file: output, format: "esm" }, platform: "node",
  external: ["react", "react/jsx-runtime", "three", "@react-three/fiber", "@react-three/drei"],
  resolve: { alias: { "@": resolve("src") } }, plugins: [{ name: "real-legacy-comparison",
    resolveId(id) { if (id === "coping-bench-audit") return id; if (id === "legacy-comfort") return legacyId; },
    load(id) {
      if (id === legacyId) return execFileSync("git", ["show", `${baseline}:src/lib/pool/comfort-plan.ts`], { encoding: "utf8" });
      if (id !== "coping-bench-audit") return null;
      return `export { resolveComfortPlan as before } from "legacy-comfort";
        export { resolveComfortPlan as after, HYDRO_DIMENSIONS } from "${root}/src/lib/pool/comfort-plan.ts";
        export { buildOutline, offsetOutline } from "${root}/src/lib/pool/geometry.ts";
        export { createCopingSlabGeometry, copingOuterOffset } from "${root}/src/components/pool/three/poolConstruction.ts";
        export { buildFloorProfile } from "${root}/src/lib/pool/floor-profile.ts";
        export { getPoolVerticalLayout } from "${root}/src/lib/pool/vertical-layout.ts";
        export { DEFAULT_DIMENSIONS, DEFAULT_CONTROL_POINTS } from "${root}/src/lib/pool/config.ts";
        export { shelfStairGeometry } from "${root}/src/components/pool/three/PoolComfortModel.tsx";
        export { INTEGRATED_BENCH } from "${root}/src/lib/pool/integrated-bench.ts";`;
    },
  }] });
const api = await import(pathToFileURL(output));
const { before, after, HYDRO_DIMENSIONS: H, buildOutline, buildFloorProfile, getPoolVerticalLayout,
  DEFAULT_DIMENSIONS, DEFAULT_CONTROL_POINTS, shelfStairGeometry, INTEGRATED_BENCH: B } = api;
let cases = 0;
const evidence = [];
for (const [length, width] of [[6, 3], [8, 4], [12, 5], [10, 4.5], [4, 8]]) {
  for (const sloped of [false, true]) for (const style of ["dedicated", "flush"]) {
    const dimensions = { ...DEFAULT_DIMENSIONS, length, width, depth: 1.5, shallowDepth: 1.05, floorProfile: sloped ? "slope" : "flat" };
    const outline = buildOutline("rectangle", dimensions, DEFAULT_CONTROL_POINTS);
    const layout = getPoolVerticalLayout({ poolType: "in-ground", system: "skimmer", overflowType: "hidden", depth: 1.5, copingThickness: .055, copingStyle: style });
    const defaultLayout = getPoolVerticalLayout({ poolType: "in-ground", system: "skimmer", overflowType: "hidden", depth: 1.5, copingThickness: .055 });
    assert.equal(layout.waterY, defaultLayout.waterY, "coping choice does not change the real waterline");
    assert.equal(layout.copingY, .055, "Skimmer retains its normal coping datum; overflow-only style is dormant");
    const floorProfile = buildFloorProfile({ outline, shape: "rectangle", poolType: "in-ground", dimensions, verticalLayout: layout, sunShelf: true, twoLoungerShelf: true });
    const input = { outline, shape: "rectangle", poolType: "in-ground", system: "skimmer", floorProfile,
      waterY: layout.waterY, enabled: ["sunShelf", "integratedBench"], nominalWidth: width };
    const previous = before(input).elements.find(e => e.kind === "integratedBench");
    for (const requested of [1, 2, 3, 4]) {
      const plan = after({ ...input, integratedBenchStations: requested });
      const bench = plan.elements.find(e => e.kind === "integratedBench");
      assert(bench, `${length}×${width} opposite bench must fit`);
      const centre = e => e.footprint.reduce((sum, p) => sum + p[length >= width ? 1 : 0], 0) / e.footprint.length;
      assert(previous && centre(previous) * centre(bench) < 0, "opposite wall compared with actual pinned legacy code");
      assert.equal(bench.jets.length, bench.stations.count * 4);
      assert(bench.run / bench.stations.count >= B.stationWidth, "no squeezed seating positions");
      assert.equal(bench.topY, layout.waterY - H.seatWaterDepth);
      const positions = bench.jets.filter(j => j.y > bench.topY);
      assert.equal(positions.length, bench.stations.count * 2);
      for (const jet of bench.jets) assert(Math.abs(jet.diameter - .058928) < 1e-9, "published 2.32 inch face in metres");
      const geometry = shelfStairGeometry(bench, floorProfile);
      geometry.computeBoundingBox();
      const lowestFloor = Math.min(...bench.footprint.map(p => floorProfile.floorYAt(...p)));
      assert(Math.abs(geometry.boundingBox.min.y - (lowestFloor - B.floorOverlap)) < 1e-6, "base physically reaches the real floor");
      const leg = bench.jets.find(j => j.y < bench.topY);
      const sampleY = floorProfile.floorYAt(leg.x, leg.z) + .025;
      const material = new MeshBasicMaterial({ side: DoubleSide });
      const mesh = new Mesh(geometry, material); mesh.updateMatrixWorld();
      const ray = new Raycaster(new Vector3(leg.x + leg.dir[0] * .1, sampleY, leg.z + leg.dir[1] * .1), new Vector3(-leg.dir[0], 0, -leg.dir[1]), 0, .2);
      assert(ray.intersectObject(mesh).length, "solid front reaches to within 25 mm of the floor; no floating bench");
      geometry.dispose(); material.dispose(); cases++;
      if (!sloped && style === "dedicated" && requested === 3) evidence.push({ length, width, beforeWall: centre(previous), afterWall: centre(bench), stations: bench.stations.count, jets: bench.jets.length });
    }
  }
}
console.log(JSON.stringify({ status: "PASS", cases, baseline, evidence }));
for (const [length, width] of [[6, 3], [8, 4], [12, 5]]) {
  const outline = [[-length / 2, -width / 2], [length / 2, -width / 2], [length / 2, width / 2], [-length / 2, width / 2]];
  assert.equal(api.copingOuterOffset("overflow", "continuous"), 0, "legacy concealed overflow keeps integrated paving");
  assert.equal(api.copingOuterOffset("overflow", "continuous", "dedicated"), .32, "explicit separate rim has a real width");
  const g = api.createCopingSlabGeometry(outline, api.offsetOutline(outline, .32), .055);
  const material = new MeshBasicMaterial({ side: DoubleSide }), mesh = new Mesh(g, material);
  mesh.updateMatrixWorld();
  const rear = new Raycaster(new Vector3(.123, 1, width / 2 + .319), new Vector3(0, -1, 0));
  const hit = rear.intersectObject(mesh)[0];
  assert(hit && hit.point.y > -.0025, "rear arris meets paving without a deep rounded groove");
  const a = getPoolVerticalLayout({ poolType: "in-ground", system: "overflow", overflowType: "continuous", depth: 1.5, copingThickness: .055, copingStyle: "dedicated" });
  const b = getPoolVerticalLayout({ poolType: "in-ground", system: "overflow", overflowType: "continuous", depth: 1.5, copingThickness: .055, copingStyle: "flush" });
  assert.equal(a.copingY, 0); assert.deepEqual(a, b, "concealed overflow keeps all elevations between rim choices");
  g.dispose(); material.dispose();
}
console.log("PASS: concealed-overflow choices and physical rear coping/paving junction at all three sizes");
