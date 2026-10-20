# Shelf mobile projection — scoped offline check

No application or camera changes. No browser use. Diagnostic: `camera-shelf-offline-projection.ts` / generated JSON; imports current camera/layout/lounger functions and projects their actual subject points through Three `PerspectiveCamera.setViewOffset`, matching the non-Infinity Shelf path in `CameraRig`.

Fixture: 8×4×1.5 m, in-ground RC, rectangular Skimmer, straight internal stairs, selected Shelf and two full-size Esse loungers. Runs 3.035, 3.2 and 5.6 m. E supplied full-canvas bounds 430×932 / 390×844 and header, badge, toolbar and open-dock rectangles. Header/dock were conservatively represented as full-width occluders; this is an offline fixture, not captured runtime camera state.

| Width / run | Selected free frame (x,y,w,h) | Projected complete Shelf/flight/furniture subject (left…right, top…bottom) | Subject points outside frame |
| --- | --- | --- | ---: |
| 430 / 3.2 | 0,187,213,196.2 | 18.5…182.9, 229.1…362.2 | 0 |
| 430 / 5.6 | 0,187,213,196.2 | 25.9…170.0, 229.0…366.4 | 0 |
| 390 / 3.2 | 0,187,173,143.4 | 19.1…144.7, 216.2…317.9 | 0 |
| 390 / 5.6 | 0,187,173,143.4 | 27.6…132.9, 217.7…318.1 | 0 |

The 3.035 m minimum likewise has zero points outside. At maximum length, lounger bounding envelopes are approximately 30×38 / 32×37 CSS px at 430 and 22×28 / 23×27 px at 390. Their small size is consistent with fitting the complete selected subject into the remaining open-panel rectangle; this check does not establish a different legibility requirement or prescribe a full-width band.

Counterfactuals were used only to distinguish possible signatures. Keeping the 3.2 m pose while expanding geometry to 5.6 gives x−35.7…182.9 / y229.1…446.1 at 430, whereas overwriting only the inset aspect with the canvas aspect gives x−83.1…256.0 but leaves the intended vertical bounds unchanged. **Neither experiment proves that the runtime does either thing.** The scoped source already includes `sunShelfRun` in layout dependencies, derives a new pose key, and marks the local projection camera manual to avoid R3F resize overwrite. No missing dependency or overwrite was established.

E subsequently corrected the screenshot interpretation: the selected platform appears to start around x15 and its steps are above the dock; the cropped deep swimming basin is not the Shelf focus subject. The earlier suspected selected-subject clipping is therefore **NOT PROVEN**, and the zero-outside mathematical fit is consistent with that correction. No camera fix or redesign is justified by this evidence. Final independent visual classification remains with E/root.
