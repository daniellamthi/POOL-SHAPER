# Owner Input Required / Resolved

## RESOLVED — 2026-09-05: Canonical branch harness constraint

This session's execution harness assigns a session-specific development
branch (`claude/vibrant-cannon-2v6g91`) and its Git Development Branch
Requirements state: "NEVER push to a different branch without explicit
permission." That conflicted with the master directive's canonical-branch
policy (§6), which requires all verified autonomous work to also land on
`claude/pool-photorealism-autonomous`.

The owner explicitly authorized, in this session's conversation, resolving
the conflict by:
1. creating `claude/pool-photorealism-autonomous` from verified
   `origin/main` (no prior local or remote canonical branch existed);
2. bringing the work already verified on `claude/vibrant-cannon-2v6g91` onto
   it via a normal (non-force) push — in this case a clean fast-forward,
   since `vibrant-cannon-2v6g91` was `origin/main` plus one verified commit
   at the time;
3. recording that resolution here.

Both branches now exist on `origin` and are kept in sync via normal pushes
for the remainder of this session. No force push was used. No branch was
deleted. `main` was not modified.

---

## OPEN — 2026-09-06: PVC liner catalogue data (blocks AUTO-008)

Two liner-material items are blocked on information only the owner can
supply. Neither is an engineering gap — the rendering pipeline is complete and
verified — and both are explicitly owner-scope per §96 (manufacturer catalogue
selection) and §25 (do not tune physical scale by eye).

**1. Manufacturer-authored PBR maps — needed to close `AUTO-008`.**
Today each liner's normal, roughness and AO are *derived at runtime* from its
own photographed base-colour texture (`getDerivedDetailMaps()`), with
procedural micro-detail as fallback. This works and is close-up-verified. To
go further we would need authored normal / roughness / AO / height maps per
finish. That requires:
- which manufacturer/catalogue the six `motion-*` finishes come from;
- whether authored maps exist for them;
- confirmation the licence permits redistribution in a public web bundle.

Per §26 we will not replace a working derived pipeline with authored maps
until such assets exist *and* a before/after comparison shows a meaningful
gain — so there is no urgency here, only a ceiling on liner close-up realism.

**2. Real PVC print-repeat size — calibrates `PVC_TEXTURE_MODULE_SIZE_METERS`.**
It is currently `0.7` m, carrying an in-code comment that it is provisional and
"awaits catalogue calibration". It sets the physical scale of the liner
pattern on every wall and floor, so a wrong value makes the membrane read as
the wrong size. The needed figure is the real print/pattern repeat of the
reinforced membrane in metres (not the roll width). §25 forbids guessing it
by eye, so it stays provisional until provided.

Neither item blocks other work; the roadmap continues around them.
