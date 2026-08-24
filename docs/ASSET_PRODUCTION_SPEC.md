# Premium 3D asset production specification

## Scope

This specification covers only assets that exist in the current configurator:

1. residential wall skimmer;
2. modular overflow-channel detail;
3. PVC liner PBR surfaces;
4. mosaic PBR surfaces;
5. mineral coping PBR surfaces.

Do not produce waterfalls, lights, spa jets, furniture, gardens or hydraulic equipment: they are not rendered by the current workflow.

## Global delivery standard

- Format: binary `.glb`, glTF 2.0.
- Units: metres; one Blender unit equals one metre.
- Axes: Y-up, front facing local +Z.
- Origin: documented mounting/contact point, not model centre.
- Apply transforms; scale must be `[1,1,1]` at export.
- Mesh names and material slots must be semantic and stable.
- Closed manifolds where applicable; correct winding and vertex normals.
- Bevel manufactured edges; never rely on razor-sharp 90° shading.
- No lights, cameras, world environment or remote resource references.
- No baked shadows or reflections in albedo.
- PBR metal/rough workflow: base color, normal, roughness, metalness, AO.
- Baseline maps: 2048² PNG/JPEG; optional premium 4096² desktop set.
- Normal maps: OpenGL convention (+Y), 8-bit unless visible banding requires 16-bit.
- UV0 for materials; UV1 non-overlapping for AO when supplied.
- Compression: Meshopt preferred; Draco accepted after visual verification.
- Texture compression: KTX2/Basis optional production derivative; retain sources.
- No copyrighted logos or manufacturer trademarks.
- Record commercial redistribution licence and source in descriptor metadata.

## LOD budget

| Tier | Use | Triangle budget | Texture tier |
|---|---|---:|---:|
| Preview | distant/mobile | 5–12k | 1K |
| Standard | normal configurator | 20–45k | 2K |
| Premium | system close-up | 60–120k | 2K/4K |

The silhouette, mounting dimensions and material-slot names must remain identical across LODs.

## Asset 1 — residential skimmer

### Required files

```text
skimmer-preview.glb
skimmer-standard.glb
skimmer-premium.glb
skimmer-abs-basecolor.png
skimmer-abs-normal.png
skimmer-abs-roughness.png
skimmer-interior-basecolor.png
skimmer-steel-basecolor.png
skimmer-steel-normal.png
skimmer-steel-roughness.png
skimmer-steel-metalness.png
```

### Physical brief

- Overall faceplate target: approximately 0.38–0.45 m wide and 0.20–0.27 m high.
- Horizontal throat opening: approximately 0.25–0.32 m wide and 0.06–0.09 m high.
- Recess depth: approximately 0.12–0.20 m.
- Origin: centre of the faceplate at the finished-wall contact plane.
- The model extends behind local -Z; visible front extends toward +Z.
- Separate named objects: `housing`, `throat`, `faceplate`, `weir`, `hinge`, `basket`, `screws`.
- Material slots: `ABS_WHITE`, `ABS_INTERIOR`, `STEEL_316`, optional `BASKET`.
- Four restrained stainless fasteners; no branding.
- Floating weir may be a separate pivoted object, but no mandatory animation.
- Injection-moulded ABS: subtle parting lines, microtexture and minor roughness variation; no exaggerated dirt or damage.
- Interior darker and slightly rougher; basket visible only at useful camera angles.
- Screws behave as stainless steel, not chrome mirrors.

### Generation prompt

```text
Create a technically accurate, unbranded residential swimming-pool wall
skimmer as a manufactured product asset. Wide horizontal throat, recessed
housing, removable satin off-white injection-moulded ABS faceplate with softly
bevelled edges, floating internal weir, subtle basket behind the throat and four
small AISI 316 stainless fasteners. Real physical scale, clean industrial
design, realistic moulding seams and very subtle micro scratches. No pool wall,
no water, no environment, no text, no logo. Produce clean topology suitable for
real-time WebGL, semantic separate parts and PBR metal/rough materials.
```

## Asset 2 — modular overflow detail

The pool outline and concealed gutter remain parametric. Do not generate an entire rigid pool edge. Produce only modules that can be repeated or sampled safely.

### Required modules

- `overflow-grate-straight-{lod}.glb`: 1.0 m straight neutral module.
- `overflow-slot-profile-{lod}.glb`: optional 1.0 m stainless insert/profile.
- No fixed corner module unless separate inside/outside radii are supplied.

### Requirements

- Origin at module start, centred on slot axis.
- Exact length 1.0 m; documented width/depth.
- Seamless endpoints and UVs.
- Objects: `frame`, `grate` or `slot_insert`.
- Material: brushed/polished AISI 316 with anisotropic direction aligned to length.
- Keep water, coping and gutter volume outside the GLB; runtime owns them.
- Avoid mirror-polished chrome; use subtle machining and roughness variation.

### Generation prompt

```text
Create a one-metre modular architectural perimeter-overflow slot/grate for a
high-end residential swimming pool. Technically minimal AISI 316 stainless
steel, accurate narrow drainage geometry, seamless repeatable endpoints,
realistic bevels, subtle longitudinal brushing and physically plausible
roughness. No pool, water, coping, environment, branding or fixed corners.
Real-time WebGL topology with clean UVs and named material slots.
```

## PBR surface library

### PVC liner

- Seamless 2×2 m capture/generation area.
- Maps: base color, normal, roughness, optional AO/height.
- Reinforced PVC micro-embossing; no tile joints.
- No baked lighting, water caustics or perspective.
- Six color variants: white, sand, light grey, dark grey, blue, green.
- Seams are optional separate decals, not repeated in the base texture.

### Mosaic

- Physically declared tile size and grout width; recommended 20–25 mm tesserae.
- Maps: base color, normal, roughness, AO, optional height.
- Small per-tile color/roughness variation; no obvious repeating clusters.
- Grout remains non-metallic and rougher than tile faces.
- Six palette-compatible variants.

### Coping stone

- Seamless 2×2 m scanned/mineral surface.
- Base color, normal, roughness, AO and restrained height.
- Natural pores and grain with no baked shadows.
- Separate edge/trim texture if cut edges must differ from top face.
- Avoid conspicuous stains that reveal repetition.

## Integration paths

Store models under:

```text
public/models/pool/skimmer/
public/models/pool/overflow/
```

Store PBR textures under:

```text
public/textures/pool/liner/<collection>/<color>/
public/textures/pool/mosaic/<collection>/<color>/
public/textures/pool/coping/<collection>/
```

Register only local URLs in `src/configurator/3d/assets/registry.ts`. Use `PremiumAsset` for GLB instances. Keep the procedural implementation as fallback until all three LODs and required maps pass QA.

## Acceptance checklist

- Scale checked against a metre reference cube.
- Pivot/orientation verified on the actual pool wall.
- No texture path escapes the GLB/local public directory.
- All LODs mount identically and preserve silhouette.
- No visible normal seams or inverted faces.
- No z-fighting at wall/coping contact.
- Material names match the registry exactly.
- GPU memory and draw calls measured on standard and premium tiers.
- Asset renders correctly in dark and light showroom environments.
- Skimmer waterline intersects the throat correctly.
- Overflow module does not replace or deform the parametric custom outline.
- Commercial licence documented before repository inclusion.
