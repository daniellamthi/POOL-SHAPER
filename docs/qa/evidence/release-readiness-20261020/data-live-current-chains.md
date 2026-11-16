# D — Current integrated cloud delivery chains

2026-10-20. Actual Chrome customer interactions on QA-only origins, current
frozen candidate served by port 3003. Supabase **Daniele 2**,
`waetxxqdlsuanqescuye` exclusively. No service credential, edit token,
attachment token or customer contact read/output in evidence. Synthetic
`QA RELEASE 20261020` contacts only; live email is not configured and no
provider send occurred.

## Actual current-candidate results

| Scenario | Source → new QA copy | New project identity | Copy/reload/technical identity | Actual PDF download | Actual quote |
|---|---|---|---|---|---|
| A Skimmer 8×4, Shelf 3.2 + 2 loungers | `PW-CNKX-R0VP19` → `PW-A24Y-7CDSQC` | `243e4207-54d7-45a2-9c36-9daafb5b462b` | PASS; all canonical technical JSON equal after removing only projectId, source unchanged. Twenty real cycles + IT/EN/IT + camera + normal Save preserved fingerprint; clean after reload | `/Users/danielelamthi/Downloads/Project-Book-PW-A24Y-7CDSQC.pdf` | PASS: `4227dea5-88b1-4ccb-a57f-a720355e8274` |
| B Infinity glass 12×5, liner/corner stair | `PW-6BR9-T08FPH` → `PW-GG50-BFDDGG` | `908d1683-9dd9-4a22-ac53-5bcc44f10c11` | PASS; exact technical equality, source unchanged, Saved after reload | `/Users/danielelamthi/Downloads/Project-Book-PW-GG50-BFDDGG.pdf` | PASS: `d223965f-6768-4763-bdf8-497a022137d6` |
| C above-ground 8×4, satin panels/external long extended stair/Pellicano | `PW-Y95N-1RC0FY` → `PW-JS5G-7S8PAB` | `9172a6fb-8706-4e25-bb86-b170b2652056` | PASS; exact technical equality, source unchanged, Saved after reload | Initial PDF had exterior stair clipped on page 6; **capture-only correction and actual `(1)` PDF retest completed**, root confirmed complete stair/platform Day/Night | PASS: `53802e46-1a23-417d-97d9-86073b9d479d` |
| Renovation existing liner → proposed mosaic | `PW-Y4AZ-4EBVCE` → `PW-VSWP-051E0V` | `4aa4a5d4-bfe5-4213-acc1-98616abdf834` | PASS; exact technical equality, existing/proposed distinction retained, source unchanged, Saved after reload | `/Users/danielelamthi/Downloads/Project-Book-PW-VSWP-051E0V.pdf` | PASS: `1ff7f6c5-1a98-46cd-91fb-7f27acd1557c` |
| Renovation liner | `PW-7XKV-GTXVQ7` → `PW-FZBT-5Q42XJ` | `94a1f7e1-054f-4276-a0bb-e697f2a4127b` | PASS; current read-only → copy → reload, no false dirty, exact full technical equality/source unchanged, Motion Sand Beach retained | Not required in reduced liner roundtrip; mosaic complete export above | Not repeated; mosaic complete quote above |

Each quoted request was checked by exact public reference plus the eight-digit
UI request prefix, then exact UUID. Results for all four: lead projectId equals
snapshot projectId, full `(lead.project_configuration - 'projectId')` equals
`(saved.snapshot - 'projectId')`, privacy accepted, **one lead and one outbox**,
notification `failed` / `EMAIL_NOT_CONFIGURED`, attempt 1, provider ID null.
No "sent"/"delivered" inference. Retry/idempotency concurrency contracts remain
separate existing tests; one submitted request per scenario is not a new live
concurrency test.

Post-submission scoped SELECT of the four new copy refs confirms, for each:
row/snapshot identity true, all public customer fields empty, public uploads
empty and the technical fingerprints below unchanged. The synthetic contact
details live only in the private lead record, not these public project rows.

Technical equality receipts:

- A: `128943cf5b242927121a25a0c56785ba`
- B: `d925f71e7e609965baa4897f47bb5790`
- C: `d1c5f50b2a6f1b960c8860e92049938b`
- Renovation mosaic: `592e4f5d230efdbb1626544a424b5417`
- Renovation liner: `30ef59eaefe9ba25924489a835f6ef45`

## Browser scope and screenshots

A actual configure path traversed all seven phases/subcategories. B/C/renovation
reused existing QA fixtures, opened them through the **current** public restore,
observed Shared project/read-only/Save a copy, created fresh identities and
reloaded. Historical report PASS was not used as substitute for these steps.

- Desktop 1440×900: A and renovation mosaic.
- **Viewport emulation, not physical mobile**: B 390×844; C 430×932.
- PDF button clicked only in final summary: A/B/C Presentazione → Riepilogo;
  renovation phase 6 Riepilogo ristrutturazione. B day; C/renovation night.
- A Share action visibly showed Link copied. B/C/renovation ordinary Share
  controls clicked with valid public links visible; ephemeral Link copied was
  not retained as proof, so clipboard success is not independently asserted.
- Fresh-origin read-only and exact copy behavior were directly observed for
  each historical source. Final new-copy spot-check opened A
  `PW-A24Y-7CDSQC` on `release-fresh-view-data.localhost:3003` without owner
  token: Shared project/read-only/Save a copy all visible. No further copy
  clicked. Screenshot `data-live-new-copy-fresh-readonly-1440.jpg`.

Screenshots:
`data-live-A-readonly-1440.jpg`, `data-live-A-quote-confirmation-1440.jpg`,
`data-live-B-infinity-390.jpg`, `data-live-B-quote-confirmation-390.jpg`,
`data-live-C-above-ground-430.jpg`, `data-live-C-quote-confirmation-430.jpg`,
`data-live-renovation-mosaic-1440.jpg`,
`data-live-renovation-quote-confirmation-1440.jpg`,
`data-live-renovation-liner-reload-1440.jpg`,
`data-live-new-copy-fresh-readonly-1440.jpg`.

## PDF tool issue and minimal recovery

The download waiter/path API stalled without respecting bounded timeouts in D
and E independently. No conclusion about product failure was drawn from it.
Recovery used **one ordinary PDF click**, a separate DOM read and exact-filename
filesystem lookup. Four actual files now exist; root owns seven-page
text/image/layout inspection. No repeated PDF waiters or broad downloads history
inspection was used. The **real initial** clipped exterior stair in C was a
different issue, reproduced by root's PDF visual inspection. Root integrated a
capture-only framing correction. D then reran only four PDF exports on the same
saved copies, with normal clicks and no additional quote/save/copy writes.

## Capture-only correction: actual download retest

| Case / viewport | New actual downloaded file | Result known to D |
|---|---|---|
| C 430×932 emulated, final summary/night | `/Users/danielelamthi/Downloads/Project-Book-PW-JS5G-7S8PAB (1).pdf` | Download PASS, Saved/clean UI. Root independently confirmed seven pages and full external stair/platform in Day/Night, no clipped last tread |
| B 390×844 emulated, final summary/day | `/Users/danielelamthi/Downloads/Project-Book-PW-GG50-BFDDGG (1).pdf` | Download PASS, Saved/clean UI. Root independently confirmed seven pages/full pool |
| A 1440×900, final summary/day | `/Users/danielelamthi/Downloads/Project-Book-PW-A24Y-7CDSQC (1).pdf` | Download PASS, Saved/clean UI; root owns final page/image inspection |
| Renovation mosaic 1440×900, phase 6 summary/night | `/Users/danielelamthi/Downloads/Project-Book-PW-VSWP-051E0V (1).pdf` | Download PASS, Saved/clean UI; root owns final page/image inspection |

After all four captures, an exact-ref SELECT confirmed the same four technical
fingerprints and matching project identities as above. No changed measurements,
materials or optional state was saved by capture. No false dirty state observed.

The separate liner roundtrip SQL also confirms distinct identity, exact full
technical JSON equal to source, source fingerprint unchanged, empty public
customer/upload values, existing liner and proposed liner
`motionSandBeach179`. No liner material/catalogue/render changes made by D.

## Handoff / remaining work

Final D browser handoff complete: D-created replacement tab 651928344 navigated
to `about:blank`, viewport override reset, then tab closed. Original D tab
651928328 was already absent after prior turn cleanup. No user tab closed or
draft edited. No submission in flight; four quote confirmations complete,
so **do not repeat** them. D made no application source edit.

Remaining for root's release matrix: final page/image approval of corrected A
and renovation PDFs, plus any independent camera/performance/operational gates.
Production host/HTTPS/backup/privacy approval and actual email delivery
remain separate prelaunch requirements, not localhost PASS.
