import assert from "node:assert/strict";
import { validSitePhoto, type SitePhotoDraft } from "../src/lib/pool/site-photo-storage";
const draft: SitePhotoDraft = {
  version: 1,
  projectId: "qa-garden",
  image: "data:image/jpeg;base64,YQ==",
  width: 1400,
  height: 900,
  points: [
    [600, 335],
    [1067, 462],
    [882, 669],
    [350, 439],
  ],
  length: "14",
  depth: "9",
  knownFov: "",
  offsetX: 1.5,
  offsetZ: -0.5,
  rotation: 20,
};
assert(validSitePhoto(draft, draft.projectId));
assert(!validSitePhoto(draft, "different-project"));
for (const change of [
  { version: 2 },
  { image: "https://example.test/photo.jpg" },
  { image: "data:text/html;base64,YQ==" },
  { width: 99 },
  { height: 1801 },
  { width: 1400.5 },
  { points: [[NaN, 0]] },
  { points: [[1401, 0]] },
  { points: [[0, -1]] },
  { points: Array(5).fill([0, 0]) },
  { offsetX: Infinity },
  { offsetZ: 101 },
  { rotation: 361 },
  { knownFov: "0".repeat(21) },
  { length: 14 },
])
  assert(!validSitePhoto({ ...draft, ...change }, draft.projectId));
assert(
  validSitePhoto({ ...draft, points: [] }, draft.projectId),
  "Incomplete references may be saved and continued",
);
console.log(
  "Site photo storage validation PASS: project isolation, malformed data, bounds, incomplete drafts.",
);
