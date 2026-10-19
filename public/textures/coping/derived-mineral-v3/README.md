# Source-derived mineral atlases

Reproduce with `node scripts/bake-legacy-minerals.mjs` from the repository root.

These are periodic authoring derivatives of the existing Ardesia CC0 scan and
owner-supplied Prun photograph. Original files remain unchanged. Full provenance,
source/output SHA-256, dimensions and licensing limits are in `provenance.json`.
Prun remains licensed only for this project; this does not assert redistribution
rights. The Ardesia source is credited in `../CREDITS.md`.

Each atlas is exactly twice the source width and height: 1024 × 498 px for slate,
730 × 1094 px for Prun. Integer-pixel translations preserve source grain density;
all maps of a finish use the same periodic 8 × 8 window layout. Only transitions
are blended. Albedo blends in linear light; normal channels stay linear data.
No AI, generated relief, new colours, supplier measurements or certifications.

Use ordinary repeat wrapping and half the original metric UV repeat. Original
module dimensions, image aspect, slab geometry, joints and scalar roughness stay
unchanged. Standard material sampling has no additional per-fragment shader work.
