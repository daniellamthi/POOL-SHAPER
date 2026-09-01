"""Orchestrates one full Cycles scene from a validated ``PoolRenderConfig``
dict: clears the default scene, builds the pool geometry + materials +
water + camera, sets up the HDRI world environment, and configures Cycles'
render settings (engine, samples, denoising, output resolution).

Requires ``bpy``. This is the only module `pool_render.py` calls directly;
everything else is a building block it composes.
"""

from __future__ import annotations

import math

try:
    import bpy
except ImportError as exc:  # pragma: no cover - exercised only outside Blender
    raise RuntimeError(
        "scene_builder.py requires Blender's `bpy` module -- run it via "
        "`blender --background --python pool_render.py`, not a plain `python3`."
    ) from exc

import camera_builder
import geometry_builder
import material_builder
import water_builder
from config_loader import resolve_asset_path


def _clear_scene() -> None:
    """Removes every object from the current scene -- `pool_render.py` is
    always invoked with `--factory-startup`, so this is mainly a defensive
    reset in case a `.blend` was passed instead of starting from Blender's
    factory default."""
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)


def _build_environment(config: dict, assets_root: str) -> None:
    """World background + lighting from the same HDRI Photo Mode uses (see
    PhotoModeRenderer.tsx's HDRI_BY_THEME) -- Cycles samples it directly for
    both the visible background and image-based lighting, no separate sun
    lamp needed for a "Sunny Day" exterior shot."""
    world = bpy.data.worlds.get("PoolRenderWorld") or bpy.data.worlds.new("PoolRenderWorld")
    bpy.context.scene.world = world
    world.use_nodes = True
    nodes = world.node_tree.nodes
    links = world.node_tree.links
    nodes.clear()

    output = nodes.new("ShaderNodeOutputWorld")
    output.location = (400, 0)
    background = nodes.new("ShaderNodeBackground")
    background.location = (200, 0)
    links.new(background.outputs["Background"], output.inputs["Surface"])

    hdri_path = resolve_asset_path(assets_root, config["environment"]["hdriUrl"])
    try:
        image = bpy.data.images.load(hdri_path, check_existing=True)
        env_tex = nodes.new("ShaderNodeTexEnvironment")
        env_tex.location = (-200, 0)
        env_tex.image = image
        # The rest of this pipeline places "up" along world Y (matching the
        # app's own Three.js/R3F, Y-up convention -- see geometry_builder's
        # `_outline_to_vectors` and camera_builder's look-at `up`), but an
        # Environment Texture's implicit Generated coordinate treats world Z
        # as the sphere's pole. Left unrotated, the HDRI's sun/sky zenith
        # projects out to the horizon instead of overhead, so the camera
        # never sees the sun and every surface loses its key light. Rotating
        # the input vector -90 deg about X swaps Y into that pole slot. The
        # extra Z rotation is azimuth: it spins the sun around that new pole
        # so its disk actually lands where the hero camera can catch its
        # mirror reflection off the water. Solved (not guessed) for this
        # HDRI/hero-camera pair by reflecting the camera's view direction
        # off the water plane and sampling the raw HDRI pixels along a 0.5
        # deg azimuth sweep for the brightest hit -- without it the sun is
        # real but always reflects harmlessly out of frame.
        tex_coord = nodes.new("ShaderNodeTexCoord")
        tex_coord.location = (-600, 0)
        mapping = nodes.new("ShaderNodeMapping")
        mapping.location = (-400, 0)
        mapping.inputs["Rotation"].default_value = (math.radians(90.0), 0.0, math.radians(266.0))
        links.new(tex_coord.outputs["Generated"], mapping.inputs["Vector"])
        links.new(mapping.outputs["Vector"], env_tex.inputs["Vector"])
        links.new(env_tex.outputs["Color"], background.inputs["Color"])
    except RuntimeError:
        # HDRI file missing on this machine -- fall back to a flat sky tint
        # rather than failing the whole render, matching PhotoModeRenderer's
        # own "gradient sky if the HDRI never loads" fallback philosophy.
        fallback = (0.65, 0.78, 0.92) if config["environment"]["theme"] == "light" else (0.05, 0.07, 0.09)
        background.inputs["Color"].default_value = (*fallback, 1.0)


def _configure_render_settings(config: dict) -> None:
    scene = bpy.context.scene
    output_preset = config["outputPreset"]

    scene.render.engine = "CYCLES"
    scene.render.resolution_x = output_preset["width"]
    scene.render.resolution_y = output_preset["height"]
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"

    # AgX's default "Base Contrast" look is deliberately flat/log-like --
    # right for grading, but it's exactly why straight-out-of-Cycles renders
    # read as a muted CG viewport instead of a graded photo. "Punchy" is a
    # stock AgX look (no custom OCIO config needed) that pushes contrast and
    # saturation the way a real camera JPEG/finished product photo would.
    scene.view_settings.look = "AgX - Punchy"

    scene.cycles.samples = output_preset["samples"]
    scene.cycles.use_denoising = output_preset["denoise"]
    # OIDN is bundled with Blender and needs no external dependency, unlike
    # OptiX (NVIDIA-only) -- the safer cross-machine default for a pipeline
    # meant to run wherever Blender is installed, not just on a GPU render box.
    if hasattr(scene.cycles, "denoiser"):
        scene.cycles.denoiser = "OPENIMAGEDENOISE"


def build_scene(config: dict, assets_root: str) -> dict:
    """Builds the full scene and returns the created objects/materials for
    inspection or further tweaking, keyed the same way
    `geometry_builder.build_pool_geometry` does."""
    _clear_scene()

    collection = bpy.context.scene.collection

    objects = geometry_builder.build_pool_geometry(config, collection)
    material_builder.assign_materials(objects, config, assets_root)
    water_builder.assign_water_material(objects["water"], config)
    objects["camera"] = camera_builder.create_camera(config, collection)

    _build_environment(config, assets_root)
    _configure_render_settings(config)

    return objects
