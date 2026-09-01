"""Builds the Cycles water material from a validated ``PoolRenderConfig``
dict's ``water`` block.

Physically based, built from Cycles' own primitives -- Principled BSDF for
the IOR-driven Fresnel reflection/refraction at the surface, plus a Volume
Absorption shader for the tinted, depth-dependent light loss inside the water
body -- rather than a translation of WaterSurfaceMaterial.tsx's raster
shader (which fakes all of that with a screen-space mirror texture and a
hand-tuned "opacity" hack; see that file's own comments on why). The
`absorption`/`scatteringColor`/`attenuationDistance` numbers it reads come
from the same WATER_VISUAL_PRESET the live app uses, just re-expressed as
Beer-Lambert volume coefficients instead of a raymarched approximation.

Requires ``bpy``.
"""

from __future__ import annotations

try:
    import bpy
except ImportError as exc:  # pragma: no cover - exercised only outside Blender
    raise RuntimeError(
        "water_builder.py requires Blender's `bpy` module -- run it via "
        "`blender --background --python pool_render.py`, not a plain `python3`."
    ) from exc


def build_water_material(config: dict) -> "bpy.types.Material":
    water = config["water"]
    material = bpy.data.materials.new(name="pool-water-cycles")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()

    output = nodes.new("ShaderNodeOutputMaterial")
    output.location = (600, 0)

    # Surface: a near-mirror-smooth dielectric. `IOR` drives the physically
    # correct Fresnel split between reflection and transmission -- no manual
    # blend factor like the raster material's `mirrorFresnel` needed.
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (200, 200)
    # `water["roughness"]` is tuned for the raster renderer's screen-space
    # reflection hack, not a physically-based Fresnel surface -- fed
    # straight into Cycles it spreads the sun highlight into a dull, wide
    # smear instead of a crisp glint. Capped to a still-water value; a
    # config that ever asks for less roughness than this is left alone.
    bsdf.inputs["Roughness"].default_value = min(water["roughness"], 0.05)
    bsdf.inputs["IOR"].default_value = water["ior"]
    transmission_key = "Transmission Weight" if "Transmission Weight" in bsdf.inputs else "Transmission"
    bsdf.inputs[transmission_key].default_value = water["transmission"]
    r, g, b = water["scatteringColor"]
    bsdf.inputs["Base Color"].default_value = (r, g, b, 1.0)

    # A perfectly flat surface only ever shows one single specular highlight,
    # exactly where the sun's mirror angle lines up with the camera -- real
    # pool water always carries a light surface ripple, which breaks that
    # into the many small glints a photo actually shows instead of a dead
    # mirror. Object-space noise keeps it independent of pool size/scale.
    ripple_coord = nodes.new("ShaderNodeTexCoord")
    ripple_coord.location = (-400, -150)
    ripple_noise = nodes.new("ShaderNodeTexNoise")
    ripple_noise.location = (-200, -150)
    ripple_noise.inputs["Scale"].default_value = 60.0
    ripple_noise.inputs["Detail"].default_value = 3.0
    links.new(ripple_coord.outputs["Object"], ripple_noise.inputs["Vector"])
    ripple_bump = nodes.new("ShaderNodeBump")
    ripple_bump.location = (0, -150)
    ripple_bump.inputs["Strength"].default_value = 0.035
    links.new(ripple_noise.outputs["Fac"], ripple_bump.inputs["Height"])
    links.new(ripple_bump.outputs["Normal"], bsdf.inputs["Normal"])

    # Volume: Beer-Lambert absorption over `attenuationDistance`, tinted
    # toward `attenuationColorHex` -- this is what actually makes deep water
    # read as darker/tinted instead of just "clear glass with a colour cast".
    volume_absorption = nodes.new("ShaderNodeVolumeAbsorption")
    volume_absorption.location = (200, -200)
    density = 1.0 / max(water["attenuationDistance"], 1e-4)
    volume_absorption.inputs["Density"].default_value = density
    ar, ag, ab = water["absorption"]
    # Combines the per-channel absorption coefficients with the attenuation
    # tint so both signals from the source config end up represented, rather
    # than picking one and silently dropping the other.
    tint = _hex_to_linear_rgb(water["attenuationColorHex"])
    volume_absorption.inputs["Color"].default_value = (
        tint[0] * (1.0 - min(ar, 1.0)),
        tint[1] * (1.0 - min(ag, 1.0)),
        tint[2] * (1.0 - min(ab, 1.0)),
        1.0,
    )

    links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    links.new(volume_absorption.outputs["Volume"], output.inputs["Volume"])

    return material


def _hex_to_linear_rgb(hex_color: str):
    hex_color = hex_color.lstrip("#")
    r, g, b = (int(hex_color[i : i + 2], 16) / 255.0 for i in (0, 2, 4))

    def to_linear(c: float) -> float:
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    return (to_linear(r), to_linear(g), to_linear(b))


def assign_water_material(water_object: "bpy.types.Object", config: dict) -> None:
    material = build_water_material(config)
    water_object.data.materials.append(material)
