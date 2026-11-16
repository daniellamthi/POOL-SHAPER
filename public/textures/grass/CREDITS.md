# Photographic lawn

- Author: Sisters.seamless.
- Source: https://commons.wikimedia.org/wiki/File:Mowed_fresh_green_seamless_healthy_lawn_grass_turf_texture.jpg
- Licence: CC0 1.0, https://creativecommons.org/publicdomain/zero/1.0/
- Source photograph: 25 June 2020; author made it seamless using GIMP.
- Reviewed original SHA-256: `8f583d90b92e520aa523fed7ae0bef0d801b521d5ae7e02f1e44c20dc8d8b0c9`.

The base colour is resized/compressed photography, not generated grass. Its
one-metre rendering footprint is a visual blade-scale calibration; the source
does not document a physically measured scan area. The packed small normal and
matte roughness are explicitly authored approximations, not measured PBR maps.
No botanical dimensions, drainage or construction specifications are certified.

`scripts/prepare-natural-grass.mjs` reproduces the two optimized texture files
from that reviewed original. `provenance.json` records sizes and content hashes.
The sampler introduces deterministic offsets only: no mirrors, stretched
blades, extra grass geometry, runtime texture baking or animated noise.
