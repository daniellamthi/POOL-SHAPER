"""Orchestrates one full Cycles scene from a validated ``PoolRenderConfig``
dict: clears the default scene, builds the pool geometry + materials +
water + camera, sets up the HDRI world environment, and configures Cycles'
render settings (engine, samples, denoising, output resolution).

Requires ``bpy``. This is the only module `pool_render.py` calls directly;
everything else is a building block it composes.
"""

from __future__ import annotations

import math
import os

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


# Each HDRI's own sun azimuth (degrees), in the Environment Texture node's
# raw/unrotated sample space -- i.e. where the sun sits in the image BEFORE
# any Mapping rotation. A fixed property of the .hdr file itself, found once
# by locating its brightest pixel (see the "HDRI sun alignment" note on
# `_sun_target_azimuth_deg` below for how this combines with a per-render
# camera azimuth). Falls back to the noon file's value for any HDRI not
# listed here -- close enough among this "qwantani" family (34-36 deg
# apart) to still land the glint in frame rather than guessing 0.
_HDRI_SUN_AZIMUTH_DEG = {
    "qwantani-noon-puresky-2k.hdr": 36.12,
    "qwantani-dusk-puresky-2k.hdr": 34.89,
}
_HDRI_SUN_AZIMUTH_FALLBACK_DEG = 36.12


def _sun_target_direction(config: dict) -> tuple[float, float, float]:
    """The world-space direction (unit vector, from a water point toward the
    sun) THIS render's camera needs the sun at to catch its own mirror
    reflection off the water.

    Physical law, not a per-camera guess: reflecting a ray about a
    horizontal plane (the water) negates only its vertical component, so
    for the camera to see the sun's reflection at a point P on the water,
    the sun's direction from P must share the camera's elevation but sit
    180 deg from the camera's own azimuth as seen from P (standard
    mirror-law derivation -- swap the incoming/outgoing rays at a
    horizontal interface). That makes this camera-independent: any camera
    pose plugged in here gets its own correctly-aimed glint, not just the
    one pose this used to be hand-solved for.
    """
    outline = config["shape"]["outline"]
    center_x = sum(point[0] for point in outline) / len(outline)
    center_z = sum(point[1] for point in outline) / len(outline)
    water_y = config["verticalLayout"]["waterY"]

    cam_pos = config["camera"]["position"]
    dx = cam_pos[0] - center_x
    dy = cam_pos[1] - water_y
    dz = cam_pos[2] - center_z
    length = math.sqrt(dx * dx + dy * dy + dz * dz) or 1.0
    dx, dy, dz = dx / length, dy / length, dz / length

    return (-dx, dy, -dz)


def _sun_target_azimuth_deg(config: dict) -> float:
    """`_sun_target_direction`'s azimuth alone (atan2(z, x) convention,
    degrees) -- what the HDRI's own Z rotation (azimuth-only control) can
    actually act on; see `_build_environment`."""
    sun_x, _sun_y, sun_z = _sun_target_direction(config)
    return math.degrees(math.atan2(sun_z, sun_x))


def _build_sun_light(config: dict, collection) -> "bpy.types.Object":
    """A real Sun (directional) lamp aimed at the exact direction
    `_sun_target_direction` computes for this camera, on top of the HDRI.

    The HDRI alone can't give every camera a crisp glint: its own sun is
    baked into the image at one fixed elevation (whatever time of day the
    photo was shot), and the Mapping node's Z rotation only controls
    azimuth -- a camera whose required elevation differs much from the
    HDRI's native sun elevation would see a dim or absent reflection no
    matter how well azimuth is aligned. A dedicated Sun lamp has no such
    constraint: full direction control, so every camera gets a correctly
    -placed key light and specular catch. Kept deliberately modest in
    strength (the HDRI still carries ambient/fill/reflections) and at
    Blender's real-sun angular size (~0.5 deg) rather than a hard point
    light, so it reads as a photographic key light, not a videogame glow.
    """
    light_data = bpy.data.lights.new(name="pool-sun", type="SUN")
    light_data.energy = 2.2
    light_data.angle = math.radians(0.526)
    light_object = bpy.data.objects.new("pool-sun", light_data)
    collection.objects.link(light_object)

    direction = _sun_target_direction(config)
    shine_toward = tuple(-c for c in direction)  # light travels from sun into the scene
    rotation = camera_builder.compute_look_at_matrix((0.0, 0.0, 0.0), shine_toward)
    from mathutils import Matrix

    light_object.matrix_world = Matrix(rotation).to_4x4()
    return light_object


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
        # the input vector 90 deg about X swaps Y into that pole slot -- that
        # part is fixed, it only handles the up-axis convention mismatch.
        #
        # The Z rotation is azimuth, and is computed per render (not
        # hardcoded to one camera pose): `_sun_target_azimuth_deg` derives
        # where THIS render's camera needs the sun via the mirror-reflection
        # law, and `_HDRI_SUN_AZIMUTH_DEG` is where the sun actually sits in
        # this HDRI file's own raw pixels (found once per file, empirically,
        # by locating its brightest pixel). Their sum is the rotation that
        # lands the real sun exactly there -- validated against the old
        # hand-solved constant (266 deg) for the Golden Scene's own camera:
        # this formula independently lands within ~2 deg of it.
        tex_coord = nodes.new("ShaderNodeTexCoord")
        tex_coord.location = (-600, 0)
        mapping = nodes.new("ShaderNodeMapping")
        mapping.location = (-400, 0)
        hdri_filename = os.path.basename(config["environment"]["hdriUrl"])
        raw_sun_azimuth = _HDRI_SUN_AZIMUTH_DEG.get(hdri_filename, _HDRI_SUN_AZIMUTH_FALLBACK_DEG)
        azimuth_deg = (_sun_target_azimuth_deg(config) + raw_sun_azimuth) % 360.0
        mapping.inputs["Rotation"].default_value = (math.radians(90.0), 0.0, math.radians(azimuth_deg))
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

    _enable_gpu_compute(scene)


def _enable_gpu_compute(scene) -> None:
    """Opts into GPU compute (Metal on macOS, otherwise whatever backend
    Blender's own preferences already have configured) when the machine
    actually has a usable device -- falls back to CPU silently otherwise, so
    this never turns a working headless render into a hard failure on a
    render box with no GPU."""
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
    except (KeyError, AttributeError):
        return

    for backend in ("METAL", "OPTIX", "CUDA", "HIP", "ONEAPI"):
        try:
            prefs.compute_device_type = backend
        except TypeError:
            continue
        prefs.get_devices()
        devices = [d for d in prefs.devices if d.type == backend]
        if devices:
            for device in prefs.devices:
                device.use = device.type == backend
            scene.cycles.device = "GPU"
            print(f"[pool_render] Cycles compute device: {backend} ({len(devices)} device(s))")
            return

    scene.cycles.device = "CPU"
    print("[pool_render] Cycles compute device: CPU (no supported GPU backend found)")


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
    objects["sun"] = _build_sun_light(config, collection)

    _build_environment(config, assets_root)
    _configure_render_settings(config)

    return objects
