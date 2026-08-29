# P1-C water baseline and upgrade

The P1-B/P0 values remain available as `WATER_BASELINE_PRESET`; selecting that
profile restores the previous water material without changing geometry.

| Parameter | Baseline | P1-C Configuration |
| --- | ---: | ---: |
| opacity | 0.29 | 0.42 |
| transmission | 0.26 | 0.54 |
| IOR | 1.333 | 1.333 |
| thickness | 0.035 | 0.06 |
| roughness | 0.12 | 0.095 |
| reflectivity | 0.10 | 0.12 |
| specular intensity | 0.18 | 0.28 |
| clearcoat | 0.24 | 0.18 |
| attenuation colour / distance | `#e8fffb` / 1.8 m | `#e8fffb` / 2.4 m |
| normal scale | 0.016 | 0.012 |
| wave speed | 0.0015, 0.001 | 0.00115, 0.00072 |
| wave drift amplitude | 0.006, 0.005 | 0.004, 0.0035 |
| caustics strength / scale / speed | 0.018 / 22 / 0.35 | 0.016 / 18 / 0.28 |

The six liner absorption and scattering values in `lib/pool/config.ts` are
unchanged and remain the source of colour identity. Optical path continues to
be approximated continuously from water level, submerged world position and
view angle, clamped to 3.5 m. Global vertical water-plane oscillation is removed.

Experience-mode candidates: screen-space refraction, planar reflection,
higher-resolution dual-normal sampling, and physically projected caustics.

## Visual-correction calibration

The correction pass preserves the P1-C values as `WATER_P1C_BASELINE_PRESET`.
Surface colour, opacity, transmission, IOR, thickness, attenuation and every
liner-specific absorption/scattering value remain unchanged. Configuration now
uses roughness `0.085`, clearcoat roughness `0.19`, reflectivity `0.135`,
specular intensity `0.32`, normal scale `0.016`, environment intensity `0.40`,
a `1.06` continuous optical-path factor and a `1.12` global caustic visibility
factor. The latter multiplies rather than replaces each liner's approved value.

## Final surface diagnosis and implementation

The earlier correction remained visually weak because it translated one normal
sample at a very low scale. Three's physical Fresnel was present, but
`specularIntensity: 0.32` reduced water's IOR-derived F0 from about `0.020` to
about `0.0065`, making camera-dependent reflection difficult to read.

The final premium path keeps `MeshPhysicalMaterial`, but replaces its tangent
normal chunk with two independently scaled and animated samples. The large
layer moves at `(0.004, 0.0022)` UV units/second; the micro layer moves in a
different direction at `(-0.011, 0.008)`. Their slopes are combined before the
physical lighting stage, so one resulting normal drives the built-in IOR
Fresnel, environment reflection, directional-light specular response and
transmission/refraction cue. With IOR `1.333` and specular intensity `1`, F0 is
approximately `0.0203`.

Set `ACTIVE_WATER_RENDERING` to `"legacy"` for the internal fallback. No UI
control or alternate geometry is involved.

## Clean optical-base correction

This pass removes the uniform milky veil without adding further water effects.
Premium surface opacity/transmission changed from `0.42 / 0.54` to
`0.12 / 0.92`; colour, IOR and liner inputs are unchanged. Underwater
in-scattering is no longer added at full liner strength. It is gated from an
optical path of `0.18 m`, scaled by `0.16`, and capped at `0.06` energy before
being tinted by the existing liner scattering colour. The previous P1-C values
remain available through `WATER_P1C_BASELINE_PRESET` and the legacy selector.

## Step 2 surface diagnostics

Development builds accept `VITE_WATER_DEBUG=normals`, `fresnel`, or `specular`.
Normals outputs the combined tangent-space result as RGB; Fresnel outputs the
Schlick response using water F0 `0.02033`; specular suppresses the environment
and temporarily lowers roughness to isolate the existing directional-light
highlight. Production always resolves to the normal physical-water path.

The final normal field uses two distinct procedural maps. Broad ripples sample
at scale `0.82`, strength `0.19`, rotation `0.24`; micro ripples sample at scale
`3.8`, strength `0.12`, rotation `-0.68`. Their offsets advance independently
at `(0.004, 0.0022)` and `(-0.011, 0.008)` UV units per second. Slopes are
combined and normalized before Three's physical Fresnel, environment and direct
lighting calculations. The clean optical-base opacity, transmission and
underwater-scattering calibration are unchanged.
