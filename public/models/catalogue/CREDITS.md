# Catalogue vegetation — CC0 sources

`evergreen.glb` derives from [Searsia Lucida](https://polyhaven.com/a/searsia_lucida),
model by James Ray Cock, photography by Jenelle van Heerden, [CC0](https://polyhaven.com/license).
These assets are free public-domain resources; no ownership or botanical-site fidelity is claimed.
Used only in the four illustrative catalogue settings. This is evergreen landscaping,
not an exact reconstruction of the olive trees in the owner's reference photograph.

Original source: `https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/searsia_lucida/searsia_lucida_1k.gltf`.
Source binary: `https://dl.polyhaven.org/file/ph-assets/Models/gltf/8k/searsia_lucida/searsia_lucida.bin`.
MD5: `aa4c42ee903a3ac22d53386d82480e6d`. Metadata was read from the Poly Haven public API.

Only `searsia_lucida_b_LOD0` (88,629 triangles) and `searsia_lucida_g_LOD0`
(6,302 triangles) are retained as `tree` and `shrub`. Accessor/buffer payloads,
UVs and normals are copied without decimation. Display-grid translations are
removed. Duplicate texture references are consolidated. The three original
materials remain; the runtime uses the original separate alpha scan as an
opaque cutout on leaves/twigs instead of JPEG-without-alpha blending.

Reproduction: `scripts/prepare-catalogue-vegetation.py SOURCE_DIR GLTF_FILE REPO_ROOT`.
The source directory must contain the binary above plus `textures/` with the
four files listed below (`alpha.png` is the original alpha file renamed).
Derivative size 4,750,256 bytes; SHA-256:
`9767942d1213b1304d3e2f74026126b61b446f214b2bbfe88ac289940204c447`.

Original 1024×1024 images are retained without pixel editing in
`public/textures/catalogue/evergreen/`:

| File | Original source below `https://dl.polyhaven.org/file/ph-assets/Models/` | MD5 |
| --- | --- | --- |
| searsia_lucida_diff_1k.jpg | jpg/1k/searsia_lucida/searsia_lucida_diff_1k.jpg | d41a7089a41122ddc4edc96288105ecd |
| searsia_lucida_nor_gl_1k.jpg | jpg/1k/searsia_lucida/searsia_lucida_nor_gl_1k.jpg | a1e95f7d4cb702b8c6ddfedaafbadcc5 |
| searsia_lucida_arm_1k.jpg | jpg/1k/searsia_lucida/searsia_lucida_arm_1k.jpg | 979fb34427cc5b5580ce89feaff65ef9 |
| alpha.png | png/1k/searsia_lucida/searsia_lucida_alpha_1k.png | dd64ebe2b0c5cabf6b8eb2e11df1c4a0 |

Total model + maps: 6,676,658 bytes. The runtime batches placed plants into
three meshes. Maximum current glass-spa layout has 886,290 vegetation triangles.
This is a geometry/network inventory, not a frame-rate guarantee.


## Current canopy WIP — Tree Small 02

`canopy-packed.glb` replaces the old tree only; Searsia Lucida remains the shrub.
Tree source: [Tree Small 02](https://polyhaven.com/a/tree_small_02), Rico Cilliers,
[CC0](https://polyhaven.com/license). This is illustrative landscaping, not an
exact reconstruction of the olive trees in the reference photographs.

Original glTF: `https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/tree_small_02/tree_small_02_1k.gltf`
(MD5 `63f42b19687332f7b3a5c8b531734d8e`). Original binary:
`https://dl.polyhaven.org/file/ph-assets/Models/gltf/8k/tree_small_02/tree_small_02.bin`
(MD5 `7a7019a87e6fe0d7475c0fa2e08d8962`, 95,102,324 bytes).

Offline derivation: `scripts/prepare-catalogue-canopy.mjs`, meshoptimizer 1.1.1,
then gltfpack 1.3.0 with meshopt compression and 16-bit quantization. Branch UV1
transforms are baked into UV0. Tree triangles fall from 2,062,487 to 393,104;
the unchanged 6,302-triangle shrub brings the asset to 399,406 triangles.
Named tree/shrub roots and source material roles are retained. Reproduction,
parameters, original image MD5/size and packed hash are recorded in
`canopy-derivation.json`; inventory is in `canopy-pack-report.json`.

The packed GLB is 6,769,740 bytes, SHA-256
`ec85a5db96544d2e23946ae26a0bdecb812b5cc1c72df206e0049f4a92f0051d`.
This excludes original external maps: 6,127,455 bytes for the tree and
1,926,402 bytes for the shrub. Their pixels are unmodified.

Live rendering shares geometry through instances; Photo Mode expands the same
placement matrices into float geometry on entry. The tree design height is
4 m times each existing placement scale. Separate original alpha masks use
opaque cutouts; their transforms match the quantized colour UV transforms.
A bounded linear shader correction reduces filtered black-atlas darkening in
raster rendering; it does not edit source images or prove traced-image parity.
The most populated glass spa contains 3,931,040 vegetation triangles. These are
asset/resource facts, not performance or photorealism acceptance.
