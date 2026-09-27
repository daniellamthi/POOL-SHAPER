# Caustics check — historical failure and focused correction

## Follow-up, 2026-09-26

The failure below was real for the prior WIP. A targeted history check located the original limits in commit `db1f3c0` (`fix: separate overflow systems and calm pool water`): they were internal aesthetic guards for **barely visible** calm-water caustics, not physical units, manufacturer values or universal limits. At that time the receiving equation was `causticValue * 8 * min(strength, 0.007) * exp(-depth * 0.35)` and the visibility preset was 0.1 (later 0.012). The approved brighter WIP instead used a nonlinear `smoothstep(0.025, 0.22, value) * 10`, cap 0.035 and preset 0.75. A scalar-only `preset <= 0.1` no longer measures the actual light contribution under this different transfer. It would neither catch a huge shader gain below 0.1 nor distinguish narrow highlights from a broad wash.

At identical camera/light/exposure and animation time 12 s, an ON/OFF test isolated a broad caustic veil hiding Sand's micrograin. Numerical bilinear sampling of the actual two-projection transfer (two sizes, depths 0.4/1.5 m, times 0/12/60 s) found 44.54% of sampled positions above half of the local maximum multiplier. This is a measured defect, not just an outdated test.

The correction narrows only the light-concentration field (`exp(-gap * 22)` instead of 10), retains its soft Gaussian filter, and rejects the soft pedestal with `smoothstep(0.08, 0.24, value)`. Peak gain/cap, visibility 0.75, movement, water absorption, Sand, exposure and lights are preserved. Texture mean is now **0.0654789046**, below the **unchanged 0.08** ceiling; two-axis wrapped maximum gradient is **20**, below the unchanged 30 limit. Bright coverage is **12.94%**. Mean added direct-diffuse multiplier for Sand decreases **0.10138 → 0.03069**, while its tested peak stays **0.26081**. These are shader multipliers, not total scene luminance or measured physical irradiance.

`scripts/geometry-audit.ts` retains the texture mean/softness checks. Only its obsolete scalar-visibility assertion is replaced by importing `scripts/caustics-audit.ts`: meaningful bounds on nonzero mean, peak, spatial coverage, temporal continuity and receiver attachment across all six liners. The former WIP fails these new distribution checks. The new budgets are project-specific regression guards, stated as such; no original numeric ceiling was widened. Full-scene visual QA remains separate from these numerical/source contracts.

See [controlled captures, checks, performance and limits](./caustics-coherent-water.md). Infinity readability remains open and was not modified.

## Original diagnosis retained

Inspected only the relevant assertions and their inputs, not the full geometry audit.

`scripts/geometry-audit.ts:182`: `sum / (512 * 512 * 255) < 0.08`, message **caustic field must remain sparse and low-energy**.
Recomputed with the current `createCausticsMap(512)` implementation: **0.13453464882046567**, above 0.08. This is the normalized mean of the red channel of the generated light-concentration map, not measured scene luminance or electrical energy.

Cause: the current warped-cellular field uses `exp(-(second - first) * 10)` and amplitude up to 1, followed by normalized wrap-around Gaussian filtering (radius 6). Filtering softens edges but largely preserves the mean; the resulting field is broader/brighter than the test's low-energy requirement.

The next local assertion, `maxGradient < 30`, passes: **22**. The subsequent `WATER_VISUAL_PRESET.causticVisibility <= 0.1` also fails independently: active value **0.75**. The suite normally stops at its first assertion; do not represent later checks as executed by that stopped run. These values were inspected/recomputed separately.

Impact: the configured light pattern can dominate subtle liner grain in close-up. The receiving shader additionally remaps it with `smoothstep(0.025, 0.22, causticValue)` and bounds its direct-diffuse multiplier. Texture mean alone does not establish final-image overexposure, a geometry defect or a runtime crash.

The materials pass does not edit caustic generation, shader, presets or assertions. The approved water remains unchanged; the failure remains open and is not superseded by passing typecheck/build/other tests. Resolving the mismatch requires a separately authorized water/caustics calibration and visual comparison, not a relaxed threshold.

Infinity film readability also remains open; no new film, rollover or flow-normal experiment in this materials pass.
