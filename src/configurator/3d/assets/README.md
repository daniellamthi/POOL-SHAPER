# Premium asset library

Place licensed, optimized `.glb`/`.gltf` files in
`src/configurator/assets/models` (or the public equivalent) and register local
URLs in `registry.ts`. The current parametric/procedural renderer remains the
runtime fallback until a descriptor is registered.

Asset requirements:

- metres, Y-up, documented origin/pivot;
- Draco/Meshopt compression where supported;
- preview/standard/premium LODs;
- 2K maximum baseline PBR maps, optional higher desktop tier;
- named material slots and variants;
- correct tangents/normals, no embedded remote resources;
- commercial redistribution licence recorded in metadata;
- geometry must not replace dimension-driven pool shell/overflow outlines.
