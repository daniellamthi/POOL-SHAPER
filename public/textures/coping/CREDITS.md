# Coping material credits

Scanned PBR maps backing the coping finishes in `src/lib/pool/coping-materials.ts`.
All sets are CC0 1.0 (public domain) — no attribution is legally required,
credited here for provenance and so the upstream masters can be re-fetched.

Sourced via [CC0-Public-Domain-Textures](https://github.com/Papyszoo/CC0-Public-Domain-Textures),
which redistributes AmbientCG / ShareTextures sets as max-512px KTX2. The maps
here were decoded from those KTX2 files (`basisu -unpack`, level 0), **not**
resampled from the repository's 256px preview images. Higher-resolution masters
(1K–8K) are available from the original source pages below.

| Finish            | Set                   | Source                                                   | Maps                               | Resolution |
| :---------------- | :-------------------- | :------------------------------------------------------- | :--------------------------------- | :--------- |
| Travertino        | Travertine009         | [AmbientCG](https://ambientcg.com/view?id=Travertine009) | BaseColor, NormalGL, Roughness, AO | 512×512    |
| Gres Porcellanato | Concrete027           | [AmbientCG](https://ambientcg.com/view?id=Concrete027)   | BaseColor, NormalGL, Roughness, AO | 512×512    |
| Deck Marrone      | Planks012             | [AmbientCG](https://ambientcg.com/view?id=Planks012)     | BaseColor, NormalGL, Roughness, AO | 512×512    |
| Ardesia           | Dark Olive Slatefloor | ShareTextures (`dark-olive-slate`)                       | BaseColor, Normal (OpenGL), AO     | 512×249    |

AmbientCG sets are by Lennart Demes.

## Notes

- **BaseColor is sRGB; Normal/Roughness/AO are linear.** `loadCopingTextureMaps()`
  sets this explicitly — decoding a normal map as sRGB silently corrupts it.
- **Tints stay neutral.** Finishes backed by a scanned asset use `color: #ffffff`
  and `roughness: 1` so the maps drive the response. A colour tint or a sub-1
  roughness multiplier would destroy the scanned material identity.
- **Ardesia ships no roughness map** — the source provides a _specular_ map,
  which is not the same channel. It uses a calibrated scalar `roughness: 0.74`
  instead. A roughness map is deliberately not fabricated from the specular map.
- **Ardesia is 512×249, not square.** The triplanar sampler scales V by
  `aspect` (512/249) so the map keeps its true proportions. It is deliberately
  _not_ tiled to a square: that would halve the repeat distance along the
  coping run and produce visible duplicated veining.

## Finishes still awaiting authentic assets

`Pietra di Prun` and `WPC` have no scanned asset and fall back to the
procedural bakes in `stoneTextures.ts`. Those bakes are **development
fallbacks only and are not production-approved**: procedural noise carries no
authentic pore/grain morphology and reads as CG at close range.

No CC0 library surveyed carries either material — Pietra di Prun is a specific
Lessinia stone, and no wood-plastic-composite decking scan was available.
Substituting generic limestone for Prun, or natural timber for WPC, would
misrepresent the product and must not be done. Replace with genuine supplier
scans, then add an `asset` block to the catalog entry exactly as the four
finishes above do.
