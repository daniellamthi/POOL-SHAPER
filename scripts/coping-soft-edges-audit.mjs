import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "rolldown";
import { Mesh, MeshBasicMaterial, DoubleSide, Raycaster, Vector3 } from "three";

const cache = resolve("node_modules/.cache/coping-soft-edges-audit");
await build({
  input: ["src/components/pool/three/poolConstruction.ts", "src/components/pool/three/pavingGeometry.ts", "src/lib/pool/geometry.ts", "scripts/infinity-coping-ends-audit.ts"],
  output: { dir: cache, format: "esm" }, platform: "node",
  resolve: { alias: { "@": resolve("src") } },
  external: ["three", "three/addons/utils/BufferGeometryUtils.js"],
});
const { createCopingSlabGeometry } = await import(pathToFileURL(`${cache}/poolConstruction.js`));
const { offsetOutline } = await import(pathToFileURL(`${cache}/geometry.js`));
const { createPavingModules } = await import(pathToFileURL(`${cache}/pavingGeometry.js`));
let cases = 0;
for (const [length, width] of [[6, 3], [8, 4], [12, 5]]) {
  const inner = [[-length / 2, -width / 2], [length / 2, -width / 2], [length / 2, width / 2], [-length / 2, width / 2]];
  const outer = offsetOutline(inner, .32);
  for (const continuous of [false, true]) for (const thickness of [.02, .03, .055]) {
    const g = createCopingSlabGeometry(inner, outer, thickness, null, continuous);
    g.computeBoundingBox();
    const p = g.attributes.position, n = g.attributes.normal, frame = g.attributes.slabFrame;
    const parts = new Set();
    let rounded = 0;
    for (let i = 0; i < p.count; i++) {
      assert(Number.isFinite(p.getX(i) + p.getY(i) + p.getZ(i) + n.getX(i) + n.getY(i) + n.getZ(i)));
      assert(Math.abs(p.getX(i)) <= length / 2 + .32 + 1e-6);
      assert(Math.abs(p.getZ(i)) <= width / 2 + .32 + 1e-6);
      assert(Math.abs(p.getX(i)) >= length / 2 - 1e-6 || Math.abs(p.getZ(i)) >= width / 2 - 1e-6, "no intrusion into basin");
      if (Math.abs(p.getY(i)) < 1e-6) assert.equal(n.getY(i), 1, "honed top remains planar");
      if (n.getY(i) > .1 && n.getY(i) < .9) rounded++;
      parts.add([frame.getX(i), frame.getY(i), frame.getZ(i), frame.getW(i)].join(","));
    }
    assert(Math.abs(g.boundingBox.max.y) < 1e-6, "top datum unchanged");
    assert(Math.abs(g.boundingBox.min.y + thickness - .0012) < 1e-6, "underside datum unchanged");
    assert(Math.abs(g.boundingBox.max.x - (length / 2 + .32 - .0004)) < 1e-6, "outer footprint unchanged");
    assert(rounded > 0, "real curved bevel normals");
    assert.equal(parts.size, continuous ? 4 : 2 * (Math.round(length / .62) + Math.round(width / .62)), "same slab layout and timber continuity");
    assert(p.count / 3 < 55000, "bounded coping geometry, one merged mesh");
    g.dispose(); cases++;
  }
}
for (const inner of [
  [[-4,-2], [4,-2], [4,0], [1,0], [1,2], [-4,2]],
  Array.from({ length: 64 }, (_, i) => [4 * Math.cos(i / 64 * Math.PI * 2), 2 * Math.sin(i / 64 * Math.PI * 2)]),
]) for (const continuous of [false, true]) {
  const g = createCopingSlabGeometry(inner, offsetOutline(inner, .32), .055, null, continuous);
  assert([...g.attributes.position.array, ...g.attributes.normal.array].every(Number.isFinite), "finite L-shaped and curved perimeter");
  g.dispose(); cases++;
}
await import(pathToFileURL(`${cache}/infinity-coping-ends-audit.js`));
for (const [length, width] of [[6, 3], [8, 4], [12, 5]]) {
  const inner = [[-length/2,-width/2], [length/2,-width/2], [length/2,width/2], [-length/2,width/2]];
  const outer = offsetOutline(inner, .32);
  const material = new MeshBasicMaterial({side: DoubleSide});
  const topAt = (geometry, x, z) => {
    const mesh = new Mesh(geometry, material); mesh.updateMatrixWorld();
    const hit = new Raycaster(new Vector3(x, 1, z), new Vector3(0,-1,0)).intersectObject(mesh)[0];
    assert(hit, "physical upper face is present"); return hit.point.y;
  };
  for (const radius of [.0018, .006]) {
    const rim = createCopingSlabGeometry(inner, outer, .055, null, false, radius);
    const rimY = topAt(rim, .123, width/2+.002), rimD = .002 - .0004;
    assert(Math.abs(rimY - (radius > rimD ? -radius + Math.sqrt(radius**2-(radius-rimD)**2) : 0)) < .0003, `selected real coping roundover: ${radius}, y=${rimY}`);
    rim.dispose();
    const paving = createPavingModules(inner, offsetOutline(inner, 1.5), [.6,1.2], {gap: .003, thickness: .02, edgeRadius: radius});
    assert([...paving.attributes.position.array, ...paving.attributes.normal.array].every(Number.isFinite));
    const z = width/2+.002;
    // Sample away from a module joint, rather than mistaking its intentional gap for missing stone.
    let y;
    for (const x of [.123, .253, .377]) { try { y = topAt(paving, x, z); break; } catch {} }
    assert(y !== undefined && Math.abs(y - (radius > .002 ? -radius+Math.sqrt(radius**2-(radius-.002)**2) : 0)) < .00035, "flush paving has the same actual selected roundover");
    assert(paving.attributes.position.count < 150000, "bounded single-mesh perimeter tessellation");
    paving.dispose();
  }
  material.dispose();
}
console.log("PASS: square/6 mm coping and flush paving profiles at 6×3, 8×4, 12×5; physical rays, finite normals, bounded mesh");
console.log(`PASS: ${cases} softened coping cases, 6×3 / 8×4 / 12×5, unchanged datums, footprint, slab layout, continuous timber and finite normals`);
