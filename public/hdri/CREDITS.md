# HDRI credits

These files are CC0 (public domain), downloaded from [Poly Haven](https://polyhaven.com)
via its public API. No attribution is legally required, credited here anyway
for provenance.

- `qwantani-noon-puresky-2k.hdr` — ["Qwantani Noon (Pure Sky)"](https://polyhaven.com/a/qwantani_noon_puresky),
  Greg Zaal (photography), Jarod Guest (processing). Used for Photo Mode's
  light-theme environment.
- `qwantani-dusk-puresky-2k.hdr` — ["Qwantani Dusk 1 (Pure Sky)"](https://polyhaven.com/a/qwantani_dusk_1_puresky),
  Greg Zaal (photography), Jarod Guest (processing). Used for Photo Mode's
  dark-theme environment.

The two Qwantani files are "Pure Sky" variants: sky-only HDRIs with no ground/horizon objects,
chosen specifically so they don't introduce foreign geometry (unrelated
buildings, terrain) into the pool scene's reflections -- see
`docs/PHOTO_MODE.md` for how they're loaded and the fallback behaviour.

- `pool-daylight-1k.hdr` — ["Pool"](https://polyhaven.com/a/pool), Greg Zaal.
  Used by the interactive renderer for PBR lighting and water reflections.
  The photographed surroundings are reflection-only: the main camera retains
  a clean procedural sky, without adding houses, landscaping or furniture.

- `catalogue-garden-2k.hdr` — ["Symmetrical Garden 02"](https://polyhaven.com/a/symmetrical_garden_02),
  Dimitrios Savva (photography), Jarod Guest (processing), CC0.
  Source: https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/symmetrical_garden_02_2k.hdr
  Original 2048×1024 HDR retained without pixel editing, 6,782,916 bytes.
  SHA-256: `f14afaeb4ddd5ed4624b459a87f44cfc8215d4346fac0bb72304348c9a15dec7`.
  Used for the illustrative private-residence and hotel-spa daylight settings:
  backdrop, reflections and Photo Mode lighting. Spa reflections still include
  their metric room geometry. Distant photographic landscape is not a metric
  site-survey representation. General configurator and night skies unchanged.
