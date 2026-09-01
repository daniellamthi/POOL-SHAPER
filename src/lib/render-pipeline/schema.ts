/**
 * Runtime validation for `PoolRenderConfig`. This is the contract Blender's
 * `config_loader.py` mirrors in plain Python (see
 * rendering/blender/config_loader.py) -- keep the two in sync by hand when a
 * field is added or renamed; there is no shared code generation between the
 * TS and Python sides.
 */
import { z } from "zod";
import type { PoolRenderConfig } from "./types";

const vec2 = z.tuple([z.number(), z.number()]);
const vec3 = z.tuple([z.number(), z.number(), z.number()]);
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "expected a 6-digit hex colour");

const shapeSchema = z.object({
  kind: z.enum(["rectangle", "custom"]),
  outline: z.array(vec2).min(3, "a pool outline needs at least 3 vertices"),
});

const dimensionsSchema = z.object({
  length: z.number().positive(),
  width: z.number().positive(),
  depth: z.number().positive(),
  cornerRadius: z.number().min(0).max(1),
});

const structureSchema = z.object({
  installation: z.enum(["in-ground", "above-ground"]),
  system: z.enum(["skimmer", "overflow"]),
  overflowType: z.enum(["hidden", "visible"]).nullable(),
});

const verticalLayoutSchema = z.object({
  groundY: z.number(),
  floorY: z.number(),
  wallTopY: z.number(),
  waterY: z.number(),
  copingY: z.number(),
  copingThickness: z.number().nonnegative(),
  copingWidth: z.number().nonnegative(),
});

const finishSchema = z.object({
  material: z.enum(["liner", "mosaic"]),
  colorId: z.string().min(1),
  title: z.string().min(1),
  baseColorHex: hexColor,
  textureUrl: z.string().min(1).nullable(),
  roughness: z.number().min(0).max(1),
  metalness: z.number().min(0).max(1),
});

const copingSchema = z.object({
  colorHex: hexColor,
  roughness: z.number().min(0).max(1),
  thickness: z.number().positive(),
  width: z.number().positive(),
});

const waterSchema = z.object({
  waterY: z.number(),
  ior: z.number().min(1),
  roughness: z.number().min(0).max(1),
  transmission: z.number().min(0).max(1),
  scatteringColor: vec3,
  absorption: vec3,
  attenuationColorHex: hexColor,
  attenuationDistance: z.number().positive(),
});

const staircaseSchema = z.object({
  present: z.boolean(),
  kind: z.enum(["external", "internal-steps", "stainless-ladder"]).nullable(),
});

const accessorySchema = z.object({
  id: z.string().min(1),
  category: z.enum(["feature", "equipment"]),
  title: z.string().min(1),
});

const cameraSchema = z.object({
  preset: z.enum(["hero", "overview", "skimmer", "overflow", "liner", "mosaic"]),
  position: vec3,
  target: vec3,
  verticalFovDeg: z.number().positive().max(179),
});

const environmentSchema = z.object({
  theme: z.enum(["light", "dark"]),
  label: z.enum(["Sunny Day", "Dusk"]),
  hdriUrl: z.string().min(1),
});

const outputPresetSchema = z.object({
  id: z.enum(["hd", "4k"]),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  samples: z.number().int().positive(),
  denoise: z.boolean(),
});

export const poolRenderConfigSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string().datetime({ offset: true }),
  sourceProject: z.literal("pool-shape-shaper-main"),
  shape: shapeSchema,
  dimensions: dimensionsSchema,
  structure: structureSchema,
  verticalLayout: verticalLayoutSchema,
  finish: finishSchema,
  coping: copingSchema,
  water: waterSchema,
  staircase: staircaseSchema,
  accessories: z.array(accessorySchema),
  camera: cameraSchema,
  environment: environmentSchema,
  outputPreset: outputPresetSchema,
}) satisfies z.ZodType<PoolRenderConfig>;

export type PoolRenderConfigValidationResult =
  | { success: true; data: PoolRenderConfig }
  | { success: false; error: z.ZodError<PoolRenderConfig> };

export function safeValidatePoolRenderConfig(data: unknown): PoolRenderConfigValidationResult {
  const result = poolRenderConfigSchema.safeParse(data);
  return result.success
    ? { success: true, data: result.data }
    : { success: false, error: result.error };
}

/** Throws with a readable message on the first validation failure -- for CLI/test call sites that want a hard fail rather than a result object. */
export function validatePoolRenderConfig(data: unknown): PoolRenderConfig {
  const result = safeValidatePoolRenderConfig(data);
  if (!result.success) {
    throw new Error(
      `Invalid PoolRenderConfig: ${result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`,
    );
  }
  return result.data;
}
