import assert from "node:assert/strict";
import { buildOutline } from "../src/lib/pool/geometry";
import { DEFAULT_CONTROL_POINTS, DEFAULT_DIMENSIONS } from "../src/lib/pool/config";
import { clampInfinityEdgeDimensions, infinityZonesForOutline } from "../src/lib/pool/infinity-edge";
import { createInfinityContainmentGeometry, infinityContainmentLevels, insetInfinityWaterZone } from "../src/components/pool/three/infinityContainment";
import { createInfinityWaterFilmGeometry } from "../src/components/pool/three/infinityEdgeGeometry";
import { getCameraPose } from "../src/lib/pool/camera";
import { getPoolVerticalLayout } from "../src/lib/pool/vertical-layout";
import { createInfinityDeck, infinityGroundHeight } from "../src/components/pool/three/infinityLandscape";

let count = 0;
for (const shape of ["rectangle", "l-shape", "organic", "custom"] as const) {
  for (const length of [6, 10]) {
    const outline = buildOutline(shape, { ...DEFAULT_DIMENSIONS, length, width: length === 6 ? 3 : 4.5 }, DEFAULT_CONTROL_POINTS);
    const zones = infinityZonesForOutline(outline, shape);
    assert(zones.length > 0, `${shape}/${length}: non-vacuous eligible-zone coverage`);
    for (const zone of zones) {
      const dims = clampInfinityEdgeDimensions(undefined), levels = infinityContainmentLevels(dims, 0);
      const geometry = createInfinityContainmentGeometry(zone, dims, 0, 0.32, 0.08, outline);
      const p = geometry.getAttribute("position");
      for (let i = 0; i < p.count; i++) assert(p.getY(i) <= levels.crestY + 1e-6, "No raised terminal piers above the spill crest");
      assert(levels.rimY - levels.baseY < 0.4, "Receiving front remains subordinate to the spill wall");
      const edges = new Map<string, number>();
      const key = (i: number) => [p.getX(i), p.getY(i), p.getZ(i)].map(v => Math.round(v * 1e5)).join(",");
      for (let i = 0; i < p.count; i++) assert(Number.isFinite(p.getX(i)) && Number.isFinite(p.getY(i)) && Number.isFinite(p.getZ(i)));
      for (let i = 0; i < p.count; i += 3) for (let j = 0; j < 3; j++) {
        const a = key(i + j), b = key(i + (j + 1) % 3);
        const edge = a < b ? a + ":" + b : b + ":" + a;
        edges.set(edge, (edges.get(edge) ?? 0) + 1);
      }
      const open = [...edges].filter(([, n]) => n !== 2);
      assert.equal(open.length, 0, `${shape}/${zone.side}: closed structural shell, unmatched edges: ${JSON.stringify(open.slice(0,4))}`);
      assert(levels.baseY < levels.floorY && levels.floorY < levels.receiverY && levels.receiverY < levels.rimY && levels.rimY < levels.crestY);
      const flow = insetInfinityWaterZone(zone, 0.012);
      assert(flow.length < zone.length && flow.length > 0);
      const receiver = createInfinityWaterFilmGeometry(flow, dims.lipWidth + dims.catchBasinWidth - 0.004, levels.receiverY, dims.lipWidth + 0.003);
      const water = receiver.getAttribute("position");
      for (let i = 0; i < water.count; i++) assert(Math.abs(water.getY(i) - levels.receiverY) < 1e-6);
      const deck = createInfinityDeck(outline, zone, 0.32);
      const deckPosition = deck.getAttribute("position");
      let buriedVertices = 0;
      for (let i = 0; i < deckPosition.count; i++) {
        const x = deckPosition.getX(i), y = deckPosition.getY(i), z = deckPosition.getZ(i);
        assert(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z));
        if (y < -0.001) {
          assert(y <= infinityGroundHeight(outline, zone, x, z) - 0.059, "Deck fascia stays buried along the curved grade, not just at wall endpoints");
          buriedVertices++;
        }
      }
      assert(buriedVertices > 0, "Deck fascia regression must exercise actual vertical supports");
      deck.dispose(); receiver.dispose(); geometry.dispose(); count++;
    }
  }
}
console.log(`Infinity containment: ${count} closed shells; receiver freeboard, floor, base and inset water PASS`);
console.log("Infinity deck fascia follows local terrain for all eligible test zones PASS");

const outline = buildOutline("rectangle", DEFAULT_DIMENSIONS, DEFAULT_CONTROL_POINTS);
const poseInput = {
  intent: "infinity" as const, outline, depth: 1.2,
  layout: getPoolVerticalLayout({poolType:"in-ground", system:"infinity", depth:1.2, copingThickness:0.055}),
  skimmers: {count:0, positions:[], spacing:0, cornerDistance:0},
  infinityZone: infinityZonesForOutline(outline,"rectangle")[0]!,
};
const portrait = getCameraPose({...poseInput, viewportAspect:390/844});
const oldMinimum = getCameraPose({...poseInput, viewportAspect:0.6});
const distance = (pose: typeof portrait) => Math.hypot(...pose.position.map((p,i) => p - pose.target[i]!));
assert(distance(portrait) > distance(oldMinimum) * 1.15, "Portrait Infinity fit must respect widths below the old 0.6 aspect clamp");
assert.deepEqual(portrait.target, oldMinimum.target, "Portrait fit preserves the existing composition target");
console.log("Infinity portrait framing regression PASS");
