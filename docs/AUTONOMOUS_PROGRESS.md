# Autonomous progress log

Newest first.

## 2026-09-05
- Established baseline: `npm install` (public registry, see
  AUTONOMOUS_DECISIONS.md), `npx tsc --noEmit` clean, `npm run lint` shows
  ~82 pre-existing prettier findings (untouched, logged as AB-003),
  `npm run test:geometry` **failing** on its first case.
- Root-caused and fixed the geometry-audit camera regression (AB-001,
  COMPLETE). `npm run test:geometry` now passes: 108 shape/dimension/system
  cases, 6 custom-shape offset cases, 12 guardrail regressions, 72 camera
  poses, 24 clamped drag steps.
- Re-verified `npx tsc --noEmit` and `npx eslint scripts/geometry-audit.ts`
  clean after the fix.
- Audited the interior-material pipeline for the next roadmap item (liner/
  mosaic PBR) and found normal+roughness are already procedurally derived
  from each finish's base-colour photo, but AO is not -- filed as AB-002 for
  the next session.
- Created the required autonomous tracking docs (this file,
  AUTONOMOUS_STATE.md, AUTONOMOUS_BACKLOG.md, AUTONOMOUS_DECISIONS.md,
  REALISM_SCORECARD.md, AUTONOMOUS_SKILLS_USED.md) since none existed yet.
