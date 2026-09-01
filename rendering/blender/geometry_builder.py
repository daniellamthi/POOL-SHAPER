"""Builds the pool's structural geometry (floor, walls, coping ring) in
Blender from a validated ``PoolRenderConfig`` dict (see config_loader.py).

Requires ``bpy`` -- this only runs inside Blender. First pass covers the
Golden Scene shape: a rectangle (or any simple closed polygon, since the
outline is just a list of XZ points either way -- a "custom" shape works
through the same code path, only the coping/staircase edge-case handling
below is Rectangle-only for now).

NOT YET IMPLEMENTED (see rendering/blender/README.md "What's next"):
  - external staircase geometry (the config carries `staircase`, but no mesh
    is built for it yet -- the Golden Scene has none, so this was left as an
    extension point rather than guessed at)
  - accessory geometry (ledLighting/hydromassage are metadata-only so far)
"""

from __future__ import annotations

try:
    import bpy
    import bmesh
    from mathutils import Vector
except ImportError as exc:  # pragma: no cover - exercised only outside Blender
    raise RuntimeError(
        "geometry_builder.py requires Blender's `bpy` module -- run it via "
        "`blender --background --python pool_render.py`, not a plain `python3`."
    ) from exc


def _outline_to_vectors(outline, y: float):
    return [Vector((x, y, z)) for x, z in outline]


def _offset_outline_2d(outline, distance: float):
    """Expands a convex polygon outward by `distance` along each edge's
    outward normal, averaged at shared vertices. Mirrors the *effect* of
    `offsetOutline()` in src/lib/pool/geometry.ts (used there for the coping
    ring) closely enough for the Golden Scene's rectangle; a true miter/round
    offset for arbitrary concave custom shapes is future work, not needed
    while only "rectangle" is generated.
    """
    n = len(outline)
    result = []
    for i in range(n):
        prev_pt = outline[(i - 1) % n]
        curr_pt = outline[i]
        next_pt = outline[(i + 1) % n]

        def edge_normal(a, b):
            dx, dz = b[0] - a[0], b[1] - a[1]
            length = (dx**2 + dz**2) ** 0.5 or 1.0
            return (dz / length, -dx / length)

        n1 = edge_normal(prev_pt, curr_pt)
        n2 = edge_normal(curr_pt, next_pt)
        avg = ((n1[0] + n2[0]) / 2, (n1[1] + n2[1]) / 2)
        avg_len = (avg[0] ** 2 + avg[1] ** 2) ** 0.5 or 1.0
        # Correct for the angle between the two edge normals so a straight
        # rectangle edge offsets by exactly `distance`, not less.
        cos_half_angle = max(0.2, avg_len)
        scale = distance / cos_half_angle
        result.append((curr_pt[0] + avg[0] * scale, curr_pt[1] + avg[1] * scale))
    return result


def _new_mesh_object(name: str, verts, faces, collection):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    return obj


def build_floor(config: dict, collection) -> "bpy.types.Object":
    outline = config["shape"]["outline"]
    floor_y = config["verticalLayout"]["floorY"]
    verts = _outline_to_vectors(outline, floor_y)
    faces = [tuple(range(len(verts)))]
    return _new_mesh_object("pool-floor", verts, faces, collection)


def build_walls(config: dict, collection) -> "bpy.types.Object":
    outline = config["shape"]["outline"]
    floor_y = config["verticalLayout"]["floorY"]
    wall_top_y = config["verticalLayout"]["wallTopY"]
    n = len(outline)
    bottom = _outline_to_vectors(outline, floor_y)
    top = _outline_to_vectors(outline, wall_top_y)
    verts = bottom + top
    faces = []
    for i in range(n):
        j = (i + 1) % n
        # Wall quad winds so its normal faces inward (into the pool basin).
        faces.append((i, j, n + j, n + i))
    return _new_mesh_object("pool-walls", verts, faces, collection)


def build_coping(config: dict, collection) -> "bpy.types.Object":
    outline = config["shape"]["outline"]
    coping_width = config["coping"]["width"]
    coping_y = config["verticalLayout"]["copingY"]
    wall_top_y = config["verticalLayout"]["wallTopY"]
    outer = _offset_outline_2d(outline, coping_width)
    n = len(outline)
    inner_top = _outline_to_vectors(outline, coping_y)
    outer_top = _outline_to_vectors(outer, coping_y)
    inner_bottom = _outline_to_vectors(outline, wall_top_y)
    verts = inner_top + outer_top + inner_bottom
    faces = []
    for i in range(n):
        j = (i + 1) % n
        # Top ring face (walkable surface).
        faces.append((i, j, n + j, n + i))
        # Inner bevel face, down to the wall top.
        faces.append((2 * n + i, 2 * n + j, j, i))
    return _new_mesh_object("pool-coping", verts, faces, collection)


def build_water(config: dict, collection) -> "bpy.types.Object":
    outline = config["shape"]["outline"]
    water_y = config["verticalLayout"]["waterY"]
    verts = _outline_to_vectors(outline, water_y)
    faces = [tuple(range(len(verts)))]
    return _new_mesh_object("pool-water", verts, faces, collection)


def build_pool_geometry(config: dict, collection) -> dict:
    """Builds floor/walls/coping/water for the given config and returns the
    created objects keyed by role, so material_builder.py / water_builder.py
    can assign materials without re-deriving which object is which."""
    if config["shape"]["kind"] not in ("rectangle", "custom"):
        raise ValueError(f"Unsupported shape kind: {config['shape']['kind']!r}")

    objects = {
        "floor": build_floor(config, collection),
        "walls": build_walls(config, collection),
        "coping": build_coping(config, collection),
        "water": build_water(config, collection),
    }

    for obj in objects.values():
        # Recalculate normals outward/consistently -- the hand-authored
        # winding above is correct for a convex outline but bmesh's
        # `normals_make_consistent` is cheap insurance against a
        # concave/custom outline flipping a face.
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(obj.data)
        bm.free()

    return objects
