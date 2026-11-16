# Independent customer review — materials upgrade, 2026-10-19

Reviewer is separate from the implementers. Source inspection defines coverage,
but does not prove rendered quality. All runtime gates below start NOT VERIFIED.
No cloud save, database, email or unrelated system mutations are authorised here.

## Runtime checklist

| ID | Required actual-browser evidence | Initial status |
| --- | --- | --- |
| IC01 | Coping: limestone, Prun, legacy travertine, Gres family/four supplied variants, slate, WPC, Ipè, light/veined travertine | NOT VERIFIED |
| IC02 | Paving: the same applicable stone/reference families, wood decking and Istria, real selected module formats | NOT VERIFIED |
| IC03 | All nine available catalog mosaics, selected individually; settled floor/wall close-up and overview, no identical mirrored sheets | NOT VERIFIED |
| IC04 | Above-ground exterior panels: satin steel, light composite, Gres and WPC; actual selection visibly changes material | NOT VERIFIED |
| IC05 | Technical top: coping/basin/stairs/comfort boundaries clean and readable; perspective view restored without technical outlines | NOT VERIFIED |
| IC06 | Day/night: representative light stone, dark/wood and mosaic response, visible material identity and no false plastic shine | NOT VERIFIED |
| IC07 | Material-family selection scrolls relevant scrollport; Gres four variants and travertine distinction clear; format selection preserves material | NOT VERIFIED |
| IC08 | Continue/Back retains selected material/format; panel remains open unless voluntarily reduced | NOT VERIFIED |
| IC09 | Desktop 1440×900 and emulated 390×844 / 430×932 customer replay and screenshots | NOT VERIFIED |
| IC10 | No visible shader errors, missing textures, unintended liner change or material mismatch in sampled configurations | NOT VERIFIED |

Catalog mosaics (nine existing originals, not fourteen invented finishes):
23DD3311, 3470EA07, 3A6FF20D, 5ABDEF81, 8ED505EE, 8F6945D0,
C36940E8, DC6E8362, DD99152F.

## Evidence rules

- Use the real Codex integrated browser and normal UI actions, not store injection.
- Save captures only after the selected material and resulting paint settle.
- Record selected control, material/format, camera and viewport alongside capture.
- A screenshot count is not requirement coverage; each row needs explicit findings.
- Mobile viewport emulation is not physical-device or GPU performance evidence.
- Existing historical PASS and implementer reports do not approve this candidate.
- Do not run another 3D scene during the orchestrator's controlled measurements.

## Final independent runtime review

Actual Codex IAB UI, isolated origin `independent-materials.localhost:3003`.
The reviewer did not use the implementer's tab, inject configuration/state,
call backend writes, or infer visual PASS from source/test reports.
Desktop 1440×900; mobile viewport emulations 390×844 and 430×932.
Primary configuration: 8×4 m concrete Skimmer with curved corner stairs;
above-ground steel structure was selected through the actual installation and
structure steps for the exterior panel checks. Pool dimensions remained 8×4.

| ID | Actual evidence / finding | Final scoped status |
| --- | --- | --- |
| IC01 | Eleven currently selectable coping finishes inspected in settled close-up: Limestone Ivory, Prun, slate, WPC, Ipè, light/veined travertine, Gres Grigio/Avorio/Beige/Greige. Legacy default travertine also visible in the nine filled-pool overviews. `independent-coping-*-close-1440.jpg` | PASS for these views after slate/Prun retest |
| IC02 | Thirteen paving finishes selected in actual UI: the eleven applicable coping finishes plus wood decking and Istria. Appropriate module labels retained; paving/coping selections independent. `independent-paving-*-close-1440.jpg`, wood `*-final-*` supersedes earlier diagnostic captures | PASS for sampled close views and WPC overview |
| IC03 | All nine catalog mosaics individually selected and inspected on floor/wall in dry close-up, filled final overview, and night close-up. 27 settled captures `independent-mosaic-{ID}-{close,overview,night}-1440.jpg`. No recognizable duplicated/mirrored 8×8 sheets in the rendered sampling; pitch consistent between floor/wall in these views | PASS |
| IC04 | Four actual panel selections visibly change exterior: satin gray steel, light composite, warm Gres, vertical brown WPC. `independent-panel-{steel,composite,gres,wpc}-1440.jpg`; WPC mobile430 night also sampled | PASS for selection/material coherence, not measured supplier PBR certification |
| IC05 | 1440 day/night top: coping/perimeter separation clear, six curved treads individually legible, no random triangle diagonals. Above-ground430 top whole pool visible. `independent-top-prun-corner-1440.jpg`, `independent-top-prun-night-1440.jpg`, `independent-top-aboveground-430.jpg` | PASS for sampled semantic boundary clarity; fine JPEG rasterization is not lossless pixel evidence |
| IC06 | Nine mosaics and thirteen paving finishes inspected at night without changing exposure/lights. `independent-mosaic-*-night-1440.jpg`, `independent-paving-*-night-1440.jpg`; natural subdued response, no emissive/plastic blowout. Unlit walls and exterior panels are intentionally dark | PASS where visible; not a color-fidelity approval of unlit surfaces |
| IC07 | Actual family action brings the relevant Gres four-colour or travertine two-variant section into the scrollport. Opening family preserves previous technical material until a variant is chosen. Paving choice brings format section into view. `independent-mobile390-gres-family.jpg`, `independent-mobile430-wpc-format.jpg` | PASS |
| IC08 | Mobile390 Beige coping → Continue to paving → Back retained `aria-pressed=true`; panel `aria-expanded=true`. Mobile430 WPC paving → Back/Continue retained WPC and expanded panel. Many additional normal header/back transitions preserved chosen materials. No claim of repeating historical 20-cycle gate | PASS for changed finish flow |
| IC09 | All finish day close-ups and mosaic overviews at1440; real 390 family/format/Back replay; real430 WPC panel/night/format/Back/top replay. These are emulated viewport dimensions, not physical phones | PASS for documented responsive samples, not every material×viewport permutation |
| IC10 | Final browser warnings/errors query empty (`independent-console-final.json`). First fresh load had only Three.Clock deprecation, captured in `independent-console-prepause.json`; no missing-texture or shader-compilation warnings observed. Liner was not edited or re-certified by this reviewer | PASS for sampled runtime, with old Clock warning disclosed |

### Defects reported to implementers and independently retested

1. **Slate duplicated bands — confirmed FAIL, corrected/retested.** Initial
   slate coping and 90×90 paving repeated matching bright horizontal vein bands
   on adjoining modules. Compare `independent-{coping,paving}-ardesia-close-1440.jpg`
   with `independent-{coping,paving}-ardesia-after-close-1440.jpg`.
   After the coherent non-mirrored sampler fix, the conspicuous matching bands
   are absent in the same camera/configuration; slate mineral identity retained.
2. **Prun repetition risk — initially inconclusive, then retested after fix.**
   No false initial mirroring PASS/FAIL was assigned at the screenshot's scale.
   After coherent variation was introduced, coping/paving captures
   `independent-{coping,paving}-prun-after-close-1440.jpg` show naturally uneven
   freckles without recognizable bilateral symmetry in these samples.
3. **Wood short cross-joints — visual suspicion, source confirmation by PBR
   specialist, final retest.** Merely remounting/rekeying the material did not
   constitute proof of resolution. Earlier `*-wood-after-*` and `*-wood-v2-*`
   captures remain diagnostic only. Final sampler excludes the photographed
   end-joint strips (implementer verified numerically). The reviewer reselected
   Gres → Legno decking, inspected settled full/native-detail captures
   `independent-paving-wood-final-close-1440.jpg` and
   `independent-paving-wood-final-detailcrop.jpg`: longitudinal wood grain with
   real staggered module joints; no conspicuous extra printed tile-grid artifact
   remains in this view. Original image source and physical board size retained.

### Boundaries / no overclaim

- These are qualitative customer-facing visual/interaction checks, not a claim
  that one image certifies all materials, hardware, angles or physical products.
- All nine mosaics have both close and filled overview evidence. All other
  families have actual close selection evidence; WPC has a dedicated filled
  overview. No claim that all thirteen paving families received a separate
  full-pool overview on each of the three viewports.
- Night captures prove visible-surface behavior and absence of obvious shader
  artifacts, not fidelity on walls/panels with no incident light.
- No cloud Save/Share/PDF/email or physical-device performance claims made.
- No renderer-performance claim from these screenshots. Performance reviewer
  receives the scene only after this tab is verified `about:blank`, viewport
  override reset; no second reviewer 3D scene is left active.
- Final independent review changes only this evidence file and its screenshots;
  no application source edits or commits by the reviewer.
