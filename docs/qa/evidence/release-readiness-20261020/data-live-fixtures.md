# D — Reusable QA fixtures, read-only lookup

2026-10-20. Exact four references supplied by root from the preserved
`CUSTOMER_QA_20261015.md`, not customer-project discovery. Supabase Daniele 2,
`waetxxqdlsuanqescuye` only. Two scoped SELECTs; no contacts, edit-token hashes,
attachment grants or unrelated project rows retrieved. No browser action,
save/copy, mutation, email or migration in this preparation.

All four rows currently exist, `share_enabled=true`, snapshot version 1 and
row/snapshot project identity agrees. This establishes fixture availability,
**not a current browser/export/quote PASS**.

| Fixture | Public ref / project ID | Stored technical configuration | Technical fingerprint |
|---|---|---|---|
| B Infinity glass | `PW-6BR9-T08FPH` / `3f588431-58dd-4297-aaf5-b27a73862ef5` | New in-ground concrete rectangle 12×5×1.5, flat, Infinity side 0/full span/outward/glass, liner Sand Beach179, corner internal stair, main LEDs, Prun coping/gres paving, day | `d925f71e7e609965baa4897f47bb5790` |
| C above-ground | `PW-Y95N-1RC0FY` / `29b5ed7f-7e9a-4b71-acc1-3d057c5e4c04` | New above-ground modular steel rectangle **8×4×1.5**, flat Skimmer, liner Sand Beach179, corner stair, external stair long/extended platform, satin steel panels, main LEDs, Pellicano, Prun/gres, night | `d1c5f50b2a6f1b960c8860e92049938b` |
| Renovation liner | `PW-7XKV-GTXVQ7` / `11662d20-46d6-47d4-a2e1-a9dc344bd55b` | Renovation in-ground concrete rectangle 8×4×1.5, flat Skimmer, interiorFinish work, existing liner → proposed liner Sand Beach179, corner stair, main LEDs, Travertine/gres, night | `30ef59eaefe9ba25924489a835f6ef45` |
| Renovation mosaic | `PW-Y4AZ-4EBVCE` / `adb49133-be76-46bc-891d-881b2d468e2e` | Same renovation geometry/works, existing liner → proposed mosaic `mosaic-23dd3311-e2c5-4ba3-87bb-d056d3b75f32` (current customer label Mosaico 1), corner stair, main LEDs, Travertine/gres, night | `592e4f5d230efdbb1626544a424b5417` |

Fingerprints are MD5 of `(snapshot - 'projectId')::text` for bounded equality
receipts, not authorization/security hashes. Optional legacy fields absent on
these rows include `sunShelfRun` and `pavingFormat`; no shelf is purchased in
the four fixtures. The first query also asked nonexistent `linerColorId` and
`mosaicFinishId` fields, which yielded null; the follow-up used actual schema
keys `linerColor` and `mosaicFinish`. Nulls from wrong field names were not
interpreted as missing customer selections.

## Current-candidate use, without rebuilding full configurations

Open each `?p=PUBLIC_REF` on a **fresh QA origin** without an owner token,
observe read-only, Save a copy and verify exact canonical technical equality
with the source. Then operate only the new QA copy for save/reload/PDF/quote.
Never overwrite these historical source fixtures or reuse their former owner
tokens.

The existing above-ground fixture is 8×4, not the requested 6×3. To obtain the
requested C case, create and verify an unchanged copy first, then explicitly
edit that copy to 6×3, verify compatibility and save. Record that deliberate
dimensional difference separately; do not call modified 6×3 equal to the 8×4
source. Preserved source checks may still be reused for historical behavior.

## Evidence reuse boundary against this task's changes

- The old report is valid historical proof of those four source identities and
  old customer-chain executions. Exact stored rows are still available now.
- Current task adds optional shelf run, its whitelist/validation, and summary
  row; these fixtures have no shelf and do not establish the new field. Chain
  A already proves cloud/share/copy equality for requested 3.2 m; PDF/lead
  extension remains pending.
- Mosaic change is **display names only**; canonical IDs/photographic assets
  unchanged in checked diff. Stored mosaic ID must reopen as current Mosaico 1
  without replacing the material; retest current UI/PDF wording.
- Parser change rejects malformed/nonpositive new shelf runs. These legacy
  snapshots lack that optional field, so they need no fake migration/default
  write. Reopening/copying through the current parser still requires runtime
  evidence before claiming PASS.
- Public snapshot customer/upload stripping and server capability controls
  remain existing architecture; previous security tests are historical, not
  fresh browser evidence for the current candidate.
- Actual PDF download, page count/images, quote identity, retries and mobile
  interaction must be observed again on current candidate copies. Neither the
  old PASS table nor current existence SELECT supplies that proof.

Status: **PASS fixture lookup only; NOT VERIFIED current chains B/C/renovation**.
