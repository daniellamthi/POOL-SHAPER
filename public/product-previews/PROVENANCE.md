# Product preview provenance

These are explicitly labelled **3D previews**, captured from the local POOL-SHAPER configurator using its actual geometry, materials and lighting. They are not product photographs or manufacturer renders. Only the capture camera changes; no generated product imagery or third party product asset is used.

`scripts/capture-product-previews.mjs` creates synthetic local project fixtures, rejects external POST requests and exports pixels directly from the WebGL canvas, so interface overlays and customer data are excluded. `capture-audit.json` records the fixture configuration, actual GPU renderer, component and framing for each image.

| Asset | Actual source component |
| --- | --- |
| skimmer-slim.jpg | Skimmers.tsx, `slim` |
| skimmer-high.jpg | Skimmers.tsx, `highWaterline` |
| overflow-visible.jpg | PoolModel.tsx, `overflow-grille` |
| overflow-hidden.jpg | PoolModel.tsx, `overflow-edge-without-grille` |
| access-ladder.jpg | PoolAccessModel.tsx, stainlessSteelLadder |
| access-external.jpg | ExternalStaircase.tsx |
| comfort-sunShelf.jpg | PoolComfortModel.tsx, actual configured shelf and stairs |
| equipment-pellicano.jpg | Pellicano.tsx |
| equipment-loungers.jpg | DeckLoungers.tsx, dry external furniture |
| equipment-sunShelfLoungers.jpg | SunShelfLoungers.tsx, original procedural model |

The finishes in each fixture are illustrative. The customer’s chosen configuration determines final materials. The immersed chaise is an original schematic procedural mesh, not manufacturer CAD and not a claim of an exact supplied brand/model.

The five previously supplied clipboard reference paths could not be opened on 15 October 2026 because the temporary files were no longer present. No substitute photograph has been downloaded and no image licensing claim is made.
