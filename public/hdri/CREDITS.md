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
