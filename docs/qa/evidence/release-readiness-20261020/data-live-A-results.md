# D — Current candidate cloud chain A, checkpoint

2026-10-20. Source branch `feat/fullscreen-day-night-hidden-overflow`, starting
HEAD `0665d3b` plus frozen QA changes. Actual Chrome extension browser on a
dedicated QA origin; no original user tab/draft changed. Desktop override
1440×900. No mobile chain performed by D in this checkpoint.

## Scenario

New in-ground concrete rectangle 8×4×1.5 m, Skimmer high-waterline/satin,
straight internal stairs, requested Sun Shelf total run **3.2 m**, two dedicated
Esse loungers, Mosaico 5, Prun coping, porcelain Greige 60×60 cm, stair spots ON,
main LEDs OFF, heat pump ON, daylight. All seven phases/subcategories traversed
through normal controls. Source/copy exist in the authorized **Daniele 2**
`waetxxqdlsuanqescuye` database.

| Check | Evidence | Status |
|---|---|---|
| Actual Save | `PW-CNKX-R0VP19`, project ID `f4841af3-0b45-40b6-94da-7d4c2eefbb10`; UI showed Saved, no temporary-storage warning or error | PASS |
| Cloud identity / requested run | Scoped read-only SQL: row/snapshot identity true, schema version 1, sharing enabled, dimensions exactly 8×4×1.5 plus sunShelfRun 3.2 | PASS |
| Twenty actual Continue/Back cycles on saved project | System→model→system twenty times, high-waterline selection retained, panel expanded at each boundary. `data-live-A-navigation-cycles.json` | PASS |
| IT→EN→IT and camera | Changed language both ways, selected top-view camera, returned to summary; no unsaved-change text | PASS UI |
| Canonical snapshot after cycles/language/camera | Clicked ordinary Save again; SQL technical fingerprint remained `128943cf5b242927121a25a0c56785ba` | PASS |
| Actual reload | Source ref restored, Saved UI with no false dirty state | PASS |
| Actual Share | Share action showed Link copied; public URL contains only `?p=PW-CNKX-R0VP19` | PASS |
| Fresh-context read-only | Separate QA origin `release-share-data.localhost:3003`, no owner token transferred; UI showed Shared project, read-only explanation and Save a copy | PASS |
| Actual Save Copy | New `PW-A24Y-7CDSQC`, project ID `243e4207-54d7-45a2-9c36-9daafb5b462b`; source identity not reassigned | PASS |
| Exact source/copy snapshot | Scoped SQL JSONB equality after removing only top-level projectId: true. Original fingerprint unchanged; copied sunShelfRun 3.2 | PASS |
| Copy reload | Copy ref and Saved state restored; initial SSR text transiently Not yet saved before hydration, later settled correctly | PASS |
| Public data privacy | Scoped source and copy SQL: customer fields empty and uploads empty; both identity checks true and fingerprints unchanged; no contact/token values read/output | PASS for these two rows |
| PDF | First waiter attempt interrupted; later ordinary button click returned in 1.1 s. Actual `/Users/danielelamthi/Downloads/Project-Book-PW-A24Y-7CDSQC.pdf` found. Root separately inspected seven pages; final cross-viewport crop correction/retest tracked in combined report | PASS download; final visual gate pending scoped retest |
| Quote | Empty form showed all required-field/consent errors. Synthetic QA submission confirmed `4227DEA5`; scoped DB request `4227dea5-88b1-4ccb-a57f-a720355e8274`, one lead/one outbox, exact saved technical configuration including run 3.2 and matching project identity | PASS persistence/identity; no live-email claim |
| B / C / renovation / mobile chains | Subsequently executed; see `data-live-current-chains.md` | Separate scoped results |

The SQL equality is of full canonical technical JSON, not a few selected fields.
Identity is intentionally distinct for the copy. Hash is an equality receipt,
not a security primitive. Notification was recorded `failed`,
`EMAIL_NOT_CONFIGURED`, attempts 1, retryable true and no provider ID; lead
status `email_failed`. This is the explicit deferred-email state, not successful
delivery. No email sent, migration, backend deletion, secret change or production
deployment performed.

## Browser handoff

Browser ownership returned to root/C/E without further clicks after interruption.
D-created Chrome tab 651928326 was last at `about:blank`; tab 651928328 was last
at `http://release-share-data.localhost:3003/?p=PW-A24Y-7CDSQC` after the PDF click.
The interrupted tool may have partly completed the PDF action; do not blindly
repeat a submit or claim its success. No pending quote request exists from D.

Runtime screenshot: `data-live-A-readonly-1440.jpg`. No owner or attachment token
appears in its URL. Browser export pending is separate from tested local PDF
contracts. Subsequent successful ordinary-button download is recorded above;
the original interrupted attempt alone was not promoted to PASS.

### Interrupted tool sequencing clarification

The last call created the download promise **without awaiting it**, then clicked
the PDF control, then awaited that promise and its path:

```js
nodeRepl.write(await sharedDataTab.playwright.getByRole('region', {
  name: 'Salva e condividi', exact: true,
}).innerText());
let dataPdfWait = sharedDataTab.playwright.waitForEvent('download', {
  timeoutMs: 120000,
});
await sharedDataTab.playwright.getByTestId('delivery-pdf').click();
let dataPdfDownload = await dataPdfWait;
let dataPdfA = await dataPdfDownload.path();
nodeRepl.write(dataPdfA);
```

Thus no deliberate waiter-before-click `await` deadlock was introduced. The
outer call requested 30 seconds but returned only when interrupted after
1586.1 seconds, with no partial output or file path. Which await was pending
is not established. This is an inconclusive tool/export observation, **not a
proven PDF product failure or proof that no download ever occurred**.
