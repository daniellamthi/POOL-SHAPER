/**
 * Proves the Blender/Cycles photorealistic-render export guard against the
 * real production code (`serializePoolRenderConfig`), for both the
 * pre-existing sloped-rectangle guard (Geometry Pass A) and the L-shape
 * guard added in Geometry Pass B: an unsupported project must refuse to
 * export -- with a clear, customer-facing Italian message -- rather than
 * silently serialising the wrong shape/floor under a `PoolRenderShapeKind`
 * that doesn't actually describe it.
 */
import { serializePoolRenderConfig } from "../src/lib/render-pipeline/serialize";
import type { PoolConfig } from "../src/lib/pool/types";
import { DEFAULT_MOSAIC_FINISH_ID } from "../src/configurator/materials/interior-textures";

const assert = (condition: unknown, message: string): asserts condition => {
  if (!condition) throw new Error(message);
};

const rectangle = (length: number, width: number) =>
  [
    [-length / 2, -width / 2],
    [length / 2, -width / 2],
    [length / 2, width / 2],
    [-length / 2, width / 2],
  ] as const;

const baseConfig: PoolConfig = {
  projectType: "new",
  poolType: "in-ground",
  structure: "reinforced-concrete",
  shape: "rectangle",
  shapeSelected: true,
  copingMaterial: "prun",
  customMode: "draw",
  controlPoints: [
    [-0.5, -0.5],
    [0.5, -0.5],
    [0.5, 0.5],
    [-0.5, 0.5],
  ],
  dimensions: { length: 10, width: 4.5, depth: 1.5, cornerRadius: 0.1 },
  system: "skimmer",
  skimmerFinish: "steel",
  skimmerType: "flush",
  finish: "liner",
  linerColor: "motionBlueSky602",
  mosaicFinish: DEFAULT_MOSAIC_FINISH_ID,
  features: [],
  poolAccess: null,
  equipment: [],
  customer: {
    name: "",
    surname: "",
    company: "",
    email: "",
    phone: "",
    city: "",
    country: "",
    notes: "",
  },
  uploads: [],
};

const skimmers = { count: 2, positions: [], spacing: 3, cornerDistance: 0.6 };

// --- A. A plain flat rectangle must export cleanly (regression). ---
const flatRect = serializePoolRenderConfig({
  config: baseConfig,
  outline: rectangle(10, 4.5),
  skimmers,
  theme: "light",
});
assert(
  flatRect.shape.kind === "rectangle",
  "a flat rectangle must export with shape.kind === 'rectangle'",
);
console.log("PASS — A) flat rectangle exports cleanly (regression)");

// --- B. A sloped rectangle must refuse (Geometry Pass A guard, regression). ---
let slopedRectThrew = false;
try {
  serializePoolRenderConfig({
    config: {
      ...baseConfig,
      dimensions: { ...baseConfig.dimensions, floorProfile: "slope", shallowDepth: 1.0 },
    },
    outline: rectangle(10, 4.5),
    skimmers,
    theme: "light",
  });
} catch (error) {
  slopedRectThrew = true;
  assert(
    error instanceof Error && /pendenza/.test(error.message),
    "sloped-rectangle guard must give a clear Italian message",
  );
}
assert(slopedRectThrew, "a sloped rectangle must refuse to export, never silently render flat");
console.log("PASS — B) sloped rectangle export guard (regression)");

// --- C. An L-shape project must refuse to export at all, never as a rectangle. ---
let lShapeThrew = false;
try {
  serializePoolRenderConfig({
    config: {
      ...baseConfig,
      shape: "l-shape",
      dimensions: {
        ...baseConfig.dimensions,
        lShapeRecessLength: 4,
        lShapeRecessWidth: 1.8,
        lShapeOrientation: "se",
      },
    },
    outline: [
      [-5, -2.25],
      [1, -2.25],
      [1, -0.45],
      [5, -0.45],
      [5, 2.25],
      [-5, 2.25],
    ],
    skimmers,
    theme: "light",
  });
} catch (error) {
  lShapeThrew = true;
  assert(
    error instanceof Error && /forma a L/.test(error.message) && /rettangolare/.test(error.message),
    "L-shape export guard must give a clear, customer-facing Italian message naming the L shape and a real workaround",
  );
}
assert(
  lShapeThrew,
  "an L-shape project must refuse to export -- it must NEVER silently serialise as 'rectangle' or 'custom'",
);
console.log(
  "PASS — C) L-shape export guard: refuses cleanly, never exports as rectangle/custom, clear Italian message",
);

// --- D. A sloped L-shape must ALSO refuse (both guards apply; whichever
// fires first, the export must never proceed). ---
let slopedLThrew = false;
try {
  serializePoolRenderConfig({
    config: {
      ...baseConfig,
      shape: "l-shape",
      dimensions: {
        ...baseConfig.dimensions,
        floorProfile: "slope",
        shallowDepth: 1.0,
        lShapeRecessLength: 4,
        lShapeRecessWidth: 1.8,
        lShapeOrientation: "se",
      },
    },
    outline: [
      [-5, -2.25],
      [1, -2.25],
      [1, -0.45],
      [5, -0.45],
      [5, 2.25],
      [-5, 2.25],
    ],
    skimmers,
    theme: "light",
  });
} catch {
  slopedLThrew = true;
}
assert(slopedLThrew, "a sloped L-shape must also refuse to export");
console.log("PASS — D) sloped L-shape also refuses to export");

// --- E. An Organic-shape project must refuse to export, never as
// rectangle/custom, with a clear Italian message naming the organic shape
// and a real workaround. ---
let organicThrew = false;
try {
  serializePoolRenderConfig({
    config: {
      ...baseConfig,
      shape: "organic",
      dimensions: { ...baseConfig.dimensions, organicCurvature: 0.6, organicMirror: false },
    },
    outline: [
      [-5, 0],
      [-3, -3],
      [3, -3],
      [5, 0],
      [3, 3],
      [-3, 3],
    ],
    skimmers,
    theme: "light",
  });
} catch (error) {
  organicThrew = true;
  assert(
    error instanceof Error &&
      /forma organica/.test(error.message) &&
      /rettangolare/.test(error.message),
    "Organic export guard must give a clear, customer-facing Italian message naming the organic shape and a real workaround",
  );
}
assert(
  organicThrew,
  "an Organic-shape project must refuse to export -- it must NEVER silently serialise as 'rectangle' or 'custom'",
);
console.log(
  "PASS — E) Organic export guard: refuses cleanly, never exports as rectangle/custom, clear Italian message",
);

// --- F. An Infinity-system rectangle project must refuse to export at all,
// never as a plain skimmer/overflow rectangle. ---
let infinityThrew = false;
try {
  serializePoolRenderConfig({
    config: {
      ...baseConfig,
      system: "infinity",
      infinityEdge: { enabled: true, side: 0, startT: 0, endT: 1, dropDirection: "outward" },
    },
    outline: rectangle(10, 4.5),
    skimmers,
    theme: "light",
  });
} catch (error) {
  infinityThrew = true;
  assert(
    error instanceof Error && /infinity/.test(error.message) && /skimmer/.test(error.message),
    "Infinity export guard must give a clear, customer-facing Italian message naming Infinity and a real workaround",
  );
}
assert(
  infinityThrew,
  "an Infinity-system project must refuse to export -- it must NEVER silently serialise as a plain skimmer/overflow rectangle",
);
console.log(
  "PASS — F) Infinity export guard: refuses cleanly, never exports as a plain skimmer/overflow rectangle, clear Italian message",
);

console.log(
  "Export guard audit complete: rectangle regression clean, L-shape, sloped-L-shape, Organic and Infinity all refuse cleanly with a clear message.",
);
