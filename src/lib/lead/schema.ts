/**
 * Server-side validation for a lead submission. Reuses the existing email
 * pattern from `src/lib/pool/validation.ts` and the same enum vocabularies
 * as the canonical `PoolConfig` (`src/lib/pool/types.ts`) instead of
 * re-declaring a parallel model. The embedded `project` is checked with
 * `z.custom` against the real `ProjectConfiguration` type -- a real runtime
 * shape check on the fields the commercial email reads, without a second,
 * structurally-diverging zod copy of `PoolConfig`/`RenovationConfig`.
 */
import { z } from "zod";
import type { ProjectConfiguration } from "@/lib/pool/project";
import { LEAD_TIMING_OPTIONS, type LeadTimingId } from "./types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Kept as a literal tuple (not derived via .map(), which would widen to
// `string`) so z.enum infers the real LeadTimingId union; `satisfies`
// cross-checks it against LEAD_TIMING_OPTIONS at compile time.
const TIMING_IDS = [
  "asap",
  "within3Months",
  "threeToSixMonths",
  "sixToTwelveMonths",
  "evaluating",
] as const satisfies readonly LeadTimingId[];

const SYSTEM_IDS = new Set(["skimmer", "overflow"]);
const OVERFLOW_IDS = new Set(["hidden", "visible"]);
const FINISH_IDS = new Set(["liner", "mosaic"]);
const PROJECT_TYPE_IDS = new Set([null, "new", "renovation"]);
const POOL_TYPE_IDS = new Set([null, "in-ground", "above-ground"]);

function isFiniteNumberInRange(value: unknown, min: number, max: number): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > min && value <= max;
}

/** Real runtime validation of the fields the commercial email/summary
 * actually reads, without redeclaring the full `PoolConfig` shape as a
 * second zod schema (see module comment). */
const projectConfigurationSchema = z.custom<ProjectConfiguration>((value) => {
  if (typeof value !== "object" || value === null) return false;
  const project = value as Record<string, unknown>;
  if (project["schemaVersion"] !== 1) return false;
  const projectId = project["projectId"];
  if (typeof projectId !== "string" || projectId.trim().length === 0) return false;
  const renovation = project["renovation"];
  if (typeof renovation !== "object" || renovation === null) return false;
  const configValue = project["config"];
  if (typeof configValue !== "object" || configValue === null) return false;

  const config = configValue as Record<string, unknown>;
  if (!PROJECT_TYPE_IDS.has(config["projectType"] as string | null)) return false;
  if (!POOL_TYPE_IDS.has(config["poolType"] as string | null)) return false;
  if (!SYSTEM_IDS.has(config["system"] as string)) return false;
  if (!OVERFLOW_IDS.has(config["overflowType"] as string)) return false;
  if (!FINISH_IDS.has(config["finish"] as string)) return false;
  const features = config["features"];
  if (!Array.isArray(features) || features.length > 20) return false;
  const equipment = config["equipment"];
  if (!Array.isArray(equipment) || equipment.length > 20) return false;
  const uploads = config["uploads"];
  if (!Array.isArray(uploads) || uploads.length > 50) return false;

  const dimensions = config["dimensions"] as Record<string, unknown> | undefined;
  if (!dimensions) return false;
  if (!isFiniteNumberInRange(dimensions["length"], 0, 60)) return false;
  if (!isFiniteNumberInRange(dimensions["width"], 0, 60)) return false;
  if (!isFiniteNumberInRange(dimensions["depth"], 0, 10)) return false;
  const cornerRadius = dimensions["cornerRadius"];
  if (typeof cornerRadius !== "number" || cornerRadius < 0 || cornerRadius > 1) return false;
  return true;
}, "Configurazione progetto non valida");

export const leadSubmissionInputSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(1, "Il nome è obbligatorio").max(120),
    email: z.string().trim().max(254).regex(EMAIL_PATTERN, "Inserisci un'email valida"),
    phone: z.string().trim().min(4, "Inserisci un numero di telefono valido").max(40),
    projectLocation: z.string().trim().min(1, "Indica la località del progetto").max(160),
  }),
  commercial: z.object({
    timing: z.enum(TIMING_IDS),
    notes: z.string().trim().max(2000).optional().default(""),
  }),
  privacy: z.object({
    accepted: z.literal(true, {
      errorMap: () => ({ message: "È necessario accettare l'informativa privacy" }),
    }),
    marketingConsent: z.boolean(),
  }),
  // Anti-spam honeypot: real users never see or fill this field.
  website: z.string().max(0).optional().default(""),
  idempotencyKey: z.string().trim().min(8).max(100),
  project: projectConfigurationSchema,
});

export type LeadSubmissionInput = z.infer<typeof leadSubmissionInputSchema>;
