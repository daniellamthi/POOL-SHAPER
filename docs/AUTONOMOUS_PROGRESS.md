# Autonomous progress log

## 2026-09-05

- Discovered `npm run test:geometry` (`scripts/geometry-audit.ts`) was
  failing unconditionally: Interior Finish (liner/mosaic) camera assertions
  were written against a pre-refactor camera model and never updated after
  `getInteriorFinishCamera` (`src/lib/pool/camera.ts`) intentionally gave
  Liner a pulled-back composition and Mosaic a tight one.
- Rewrote the affected assertions to check the invariants that actually hold
  under the current, intentional design (wall-plane target, wall-centred
  alignment, frontal view direction, Mosaic strictly tighter than Liner)
  instead of brittle exact-equality checks. No production rendering code was
  changed.
- Verified: `npm run test:geometry` passes (108 shape/dimension/system
  cases, 6 custom-shape offset cases, 12 guardrail regressions, 72 camera
  poses, 24 clamped drag steps). `npx tsc --noEmit`, `npx eslint
  scripts/geometry-audit.ts`, and `npm run build` are all clean.
- Created the autonomous state/backlog docs required by the operating
  directive (`AUTONOMOUS_STATE.md`, `AUTONOMOUS_BACKLOG.md`,
  `AUTONOMOUS_PROGRESS.md`, `AUTONOMOUS_DECISIONS.md`) since none existed yet.
- Audited liner/mosaic PBR maps (AUTO-002, roadmap default-priority item 2).
  `getDerivedDetailMaps` (`src/components/pool/three/textures.ts`) already
  derives a photo-correlated normal + roughness map per finish (Sobel
  gradient of the base-color photo's own high-frequency detail) and it's
  wired into liner wall/floor, above-ground panel, and coping materials in
  `PoolModel.tsx`. Conclusion: this already satisfies mission section 8;
  no source change made. Recorded in `docs/AUTONOMOUS_BACKLOG.md`.
