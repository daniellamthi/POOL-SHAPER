# Autonomous Decisions

Durable engineering decisions and, importantly, **negative results** — things
deliberately NOT built, with the evidence that settled it. The point is that a
later session (or a later roadmap re-read) does not re-open a closed question
and re-do the analysis. Reverse a decision when new evidence arrives, not
because the roadmap still lists the item.

---

## D-001 — Mosaic anti-tiling: NOT implemented (no demonstrable gap)

**Date:** 2026-09-06 · **Roadmap item:** directive §28, P2 item 13 · **Issue:** `AUTO-016`

**Question.** The roadmap treats mosaic anti-tiling as a likely gap: a 0.2 m
mosaic module repeats ~145x along the wall perimeter of a 10 x 4.5 m pool and
50x across the floor, and "obvious repetition" is on the §65 visual rejection
list. Does the shipped product actually exhibit it?

**How it was tested.** Rather than infer from the roadmap or from a 3-minute
app run, both shipped mosaic assets were tiled 4x4 directly from the source
PNGs and inspected — the cheapest test that isolates exactly the phenomenon in
question (a wall covered in repeats, seen at once):

```js
// tile the asset NxN, downscale to ~900px, look at it
const sx = (x * DOWN) % src.width;
const sy = (y * DOWN) % src.height;
```

**Result.** Both artworks tile **seamlessly** — no seam, no discontinuity, no
luminance step at module boundaries — and neither exposes a repeating tessera
constellation. The teal asset's tesserae are near-uniform in colour, so there
is nothing distinctive to repeat; the pale grey/white asset's variation is too
low-contrast to read as a pattern at any realistic viewing distance.

**Decision.** Do not implement stochastic/hex-grid anti-tiling. It carries real
shader and GPU cost, and §28's own constraints (preserve pattern identity,
grout-line continuity, wall/floor continuity) make it a genuinely risky change
— all to fix something not visible on any shipped asset. §111: if the gap is
unclear, do not implement. §108: no useless churn.

**Re-open if.** A mosaic asset ships with high-contrast or strongly non-uniform
tesserae (a distinctive constellation, a blend/gradient artwork, or a
directional pattern), or the module size shrinks enough to sharply raise the
repeat count. Re-run the 4x4 tiling check on the new asset first — do not
assume the gap exists.

---

## D-002 — Interior floor/wall texture scaling is correct as written

**Date:** 2026-09-06 · **Subsystem:** materials/geometry

**Question.** `PoolModel.tsx` sets the floor repeat to a constant
(`1 / tileSize`) while the wall repeat is world-space
(`perimeter / tileSize`, `depth / tileSize`). Read cold this looks like a bug —
as if floor tesserae would stretch with pool size while wall tesserae stay
fixed, breaking scale and wall/floor continuity at the cove.

**Why it is not a bug.** The two surfaces carry different UV parameterisations,
and the repeat values are each correct for their own:

- **Floor** UVs are authored in **world metres** — `poolGeometry.ts` emits
  `uvs.push(x, z)` directly from world coordinates. So `repeat = 1 / tileSize`
  yields `u = x / tileSize`, i.e. one module spans exactly `tileSize` metres,
  at any pool size.
- **Wall** UVs are **normalised** perimeter/depth parameters, so reaching the
  same physical module requires scaling by `perimeter / tileSize` and
  `depth / tileSize`.

Both therefore produce the same physical module size, and the cove stays
continuous. The micro-detail maps use the identical pairing, consistently.

**Decision.** Leave as is. Recorded because the asymmetry reliably reads as a
defect on inspection — §4: never "fix" correct production code to satisfy a
first impression. Verify the UV source before touching either value.

**Invalidate if:** `poolGeometry.ts` changes how floor or wall UVs are
generated (world-metre vs normalised) — then both repeat calls must be
re-derived together.
