# Premium finish assets

Runtime images are resolved by convention from `src/configurator/premium-finish/premium-finish-assets.ts`.
Do not commit temporary or artificially colourised renders here.

Each master-view directory must contain the same six PVC variants:

```text
premium-finishes/
  inground/
    skimmer/
    overflow/
  above-ground/
    skimmer/
    overflow/
```

For every liner provide four files using its configured stem:

```text
motion-deep-sea-603-960.avif
motion-deep-sea-603-1920.avif
motion-deep-sea-603-960.webp
motion-deep-sea-603-1920.webp
```

Use a 16:9 canvas at 960×540 and 1920×1080. The WebP files are required as the
availability probe and universal fallback; AVIF is the preferred browser source.
All six images within one directory must share exactly the same camera, crop,
geometry, lighting, environment and exposure.
