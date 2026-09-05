"""Builds physically-based Cycles materials (liner/mosaic finish, coping
stone) from a validated ``PoolRenderConfig`` dict.

Deliberately NOT a port of the Three.js shaders in WaterSurfaceMaterial.tsx /
PoolModel.tsx -- those are raster tricks (onBeforeCompile GLSL patches,
canvas-baked procedural normal maps) tuned for a real-time budget. Cycles
gets a real Principled BSDF fed by the same base-colour texture the live app
already ships in `public/textures/...`, with a `Bump` node standing in for
"real" normal detail. That is what "physically correct" means here: a
standard, renderer-native PBR material, not a literal shader translation.

Requires ``bpy``.
"""

from __future__ import annotations

try:
    import bpy
except ImportError as exc:  # pragma: no cover - exercised only outside Blender
    raise RuntimeError(
        "material_builder.py requires Blender's `bpy` module -- run it via "
        "`blender --background --python pool_render.py`, not a plain `python3`."
    ) from exc

from config_loader import resolve_asset_path


def _hex_to_linear_rgb(hex_color: str):
    hex_color = hex_color.lstrip("#")
    r, g, b = (int(hex_color[i : i + 2], 16) / 255.0 for i in (0, 2, 4))

    def to_linear(c: float) -> float:
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    return (to_linear(r), to_linear(g), to_linear(b), 1.0)


def _load_base_color_image(assets_root: str, site_relative_url: str):
    path = resolve_asset_path(assets_root, site_relative_url)
    return bpy.data.images.load(path, check_existing=True)


def build_finish_material(config: dict, assets_root: str) -> "bpy.types.Material":
    """Liner or mosaic interior finish -- walls, floor, coping-facing skirts."""
    finish = config["finish"]
    material = bpy.data.materials.new(name=f"pool-finish-{finish['colorId']}")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()

    output = nodes.new("ShaderNodeOutputMaterial")
    output.location = (400, 0)
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (100, 0)
    bsdf.inputs["Roughness"].default_value = finish["roughness"]
    if "Metallic" in bsdf.inputs:
        bsdf.inputs["Metallic"].default_value = finish["metalness"]
    links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])

    if finish["textureUrl"]:
        try:
            image = _load_base_color_image(assets_root, finish["textureUrl"])
        except RuntimeError:
            image = None
        if image is not None:
            tex_coord = nodes.new("ShaderNodeTexCoord")
            tex_coord.location = (-600, 0)
            mapping = nodes.new("ShaderNodeMapping")
            mapping.location = (-400, 0)
            links.new(tex_coord.outputs["Object"], mapping.inputs["Vector"])

            if finish["material"] == "liner":
                # Object-space coordinates are in metres and Image Texture
                # repeats every 1.0 unit, so left at scale 1 this texture
                # tiles once per metre -- not the real module size the live
                # app tiles the same PNG at (PVC_TEXTURE_MODULE_SIZE_METERS
                # in src/configurator/materials/interior-textures.ts = 0.7m).
                # Scaling by 1/tile_size makes one repeat cover one real
                # 0.7m module instead, matching the finish's actual scale.
                liner_tile_size_m = 0.7
                tile_scale = 1.0 / liner_tile_size_m
                mapping.inputs["Scale"].default_value = (tile_scale, tile_scale, tile_scale)

            image_node = nodes.new("ShaderNodeTexImage")
            image_node.location = (-200, 100)
            image_node.image = image
            links.new(mapping.outputs["Vector"], image_node.inputs["Vector"])
            links.new(image_node.outputs["Color"], bsdf.inputs["Base Color"])

            # Subtle bump from the same texture's luminance -- a physically
            # plausible stand-in for the app's procedural JS normal maps,
            # not a translation of them (see module docstring).
            bump = nodes.new("ShaderNodeBump")
            bump.location = (-200, -200)
            bump.inputs["Strength"].default_value = 0.08
            links.new(image_node.outputs["Color"], bump.inputs["Height"])
            links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
        else:
            bsdf.inputs["Base Color"].default_value = _hex_to_linear_rgb(finish["baseColorHex"])
    else:
        bsdf.inputs["Base Color"].default_value = _hex_to_linear_rgb(finish["baseColorHex"])

    return material


def build_coping_material(config: dict) -> "bpy.types.Material":
    """Coping/deck stone -- no texture asset in the app yet (see
    src/configurator/materials/visual-presets.ts POOL_BORDER_PRESET), so this
    is a flat physically-based stone: matte dielectric, a hint of clearcoat
    to match the live renderer's `clearcoat` on the same surface."""
    coping = config["coping"]
    material = bpy.data.materials.new(name="pool-coping-stone")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()

    output = nodes.new("ShaderNodeOutputMaterial")
    output.location = (400, 0)
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (100, 0)
    bsdf.inputs["Base Color"].default_value = _hex_to_linear_rgb(coping["colorHex"])
    if "Coat Weight" in bsdf.inputs:  # Blender 4.x Principled BSDF naming
        bsdf.inputs["Coat Weight"].default_value = 0.1
    elif "Clearcoat" in bsdf.inputs:  # Blender 3.x naming
        bsdf.inputs["Clearcoat"].default_value = 0.1

    # A single flat roughness value is what reads as painted CG plastic --
    # real cut stone/coping has grain. Noise-driven roughness (+ a matching
    # bump) around the configured value gives the same surface a believable,
    # uneven premium-stone finish instead of a uniform coat.
    grain_coord = nodes.new("ShaderNodeTexCoord")
    grain_coord.location = (-400, -200)
    grain_noise = nodes.new("ShaderNodeTexNoise")
    grain_noise.location = (-200, -200)
    grain_noise.inputs["Scale"].default_value = 35.0
    grain_noise.inputs["Detail"].default_value = 8.0
    links.new(grain_coord.outputs["Object"], grain_noise.inputs["Vector"])

    roughness_range = nodes.new("ShaderNodeMapRange")
    roughness_range.location = (0, -200)
    roughness_range.inputs["To Min"].default_value = max(coping["roughness"] - 0.15, 0.0)
    roughness_range.inputs["To Max"].default_value = min(coping["roughness"] + 0.15, 1.0)
    links.new(grain_noise.outputs["Fac"], roughness_range.inputs["Value"])
    links.new(roughness_range.outputs["Result"], bsdf.inputs["Roughness"])

    grain_bump = nodes.new("ShaderNodeBump")
    grain_bump.location = (0, -350)
    grain_bump.inputs["Strength"].default_value = 0.06
    links.new(grain_noise.outputs["Fac"], grain_bump.inputs["Height"])
    links.new(grain_bump.outputs["Normal"], bsdf.inputs["Normal"])

    links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    return material


def build_ground_material() -> "bpy.types.Material":
    """Neutral deck/terrace stone for `geometry_builder.build_ground` -- a
    light warm dielectric with the same noise-driven roughness variation
    `build_coping_material` uses, so the ring the pool actually sits on
    reads as real cut stone catching the sun, not a flat grey backdrop."""
    material = bpy.data.materials.new(name="pool-ground-stone")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()

    output = nodes.new("ShaderNodeOutputMaterial")
    output.location = (400, 0)
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (100, 0)
    bsdf.inputs["Base Color"].default_value = _hex_to_linear_rgb("#d9d4c8")
    if "Coat Weight" in bsdf.inputs:
        bsdf.inputs["Coat Weight"].default_value = 0.05
    elif "Clearcoat" in bsdf.inputs:
        bsdf.inputs["Clearcoat"].default_value = 0.05

    grain_coord = nodes.new("ShaderNodeTexCoord")
    grain_coord.location = (-400, -200)
    grain_noise = nodes.new("ShaderNodeTexNoise")
    grain_noise.location = (-200, -200)
    grain_noise.inputs["Scale"].default_value = 12.0
    grain_noise.inputs["Detail"].default_value = 6.0
    links.new(grain_coord.outputs["Object"], grain_noise.inputs["Vector"])

    roughness_range = nodes.new("ShaderNodeMapRange")
    roughness_range.location = (0, -200)
    roughness_range.inputs["To Min"].default_value = 0.45
    roughness_range.inputs["To Max"].default_value = 0.75
    links.new(grain_noise.outputs["Fac"], roughness_range.inputs["Value"])
    links.new(roughness_range.outputs["Result"], bsdf.inputs["Roughness"])

    grain_bump = nodes.new("ShaderNodeBump")
    grain_bump.location = (0, -350)
    grain_bump.inputs["Strength"].default_value = 0.04
    links.new(grain_noise.outputs["Fac"], grain_bump.inputs["Height"])
    links.new(grain_bump.outputs["Normal"], bsdf.inputs["Normal"])

    links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    return material


def assign_materials(objects: dict, config: dict, assets_root: str) -> None:
    """Assigns finish/coping/ground materials to the geometry objects
    returned by `geometry_builder.build_pool_geometry`. Water is handled
    separately by `water_builder.py` since it needs a different BSDF setup
    entirely."""
    finish_material = build_finish_material(config, assets_root)
    coping_material = build_coping_material(config)

    for role in ("floor", "walls"):
        obj = objects.get(role)
        if obj is not None:
            obj.data.materials.append(finish_material)

    coping_obj = objects.get("coping")
    if coping_obj is not None:
        coping_obj.data.materials.append(coping_material)

    ground_obj = objects.get("ground")
    if ground_obj is not None:
        ground_obj.data.materials.append(build_ground_material())
