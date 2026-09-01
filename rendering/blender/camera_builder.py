"""Builds the render camera from a validated ``PoolRenderConfig`` dict's
``camera`` block.

The camera *pose* (position/target/FOV) is never recomputed here -- it comes
pre-baked from the TS side's `getCameraPose()` (see
src/lib/pool/camera.ts and src/lib/render-pipeline/serialize.ts), which is
the one place that framing algorithm lives. This module only turns that pose
into a Blender camera: a look-at rotation (pure math, no ``bpy`` -- see
`compute_look_at_matrix`, runnable and tested with a plain ``python3``) and a
physical lens (focal length + sensor size derived from the vertical FOV,
``bpy``-dependent).
"""

from __future__ import annotations

import math


def compute_look_at_matrix(position, target, up=(0.0, 1.0, 0.0)):
    """Right-handed look-at rotation, as a 3x3 matrix (row-major tuple of
    tuples), pointing Blender's camera (-Z forward, +Y up in its own local
    space) from `position` toward `target`. Pure math -- no bpy, no mathutils
    -- so it can be unit-tested without Blender installed (see the bottom of
    this file).
    """

    def sub(a, b):
        return (a[0] - b[0], a[1] - b[1], a[2] - b[2])

    def normalize(v):
        length = math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2)
        if length < 1e-9:
            raise ValueError("camera position and target must not coincide")
        return (v[0] / length, v[1] / length, v[2] / length)

    def cross(a, b):
        return (
            a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0],
        )

    # Blender cameras look down their local -Z, with +Y up.
    forward = normalize(sub(target, position))
    backward = (-forward[0], -forward[1], -forward[2])
    right = normalize(cross(up, backward))
    real_up = cross(backward, right)

    # Columns of the rotation matrix are the local axes (right, up, backward)
    # expressed in world space -- this is the standard camera-space basis.
    return (
        (right[0], real_up[0], backward[0]),
        (right[1], real_up[1], backward[1]),
        (right[2], real_up[2], backward[2]),
    )


def compute_focal_length_mm(vertical_fov_deg: float, sensor_height_mm: float = 24.0) -> float:
    """Standard photographic focal length for a given vertical field of view
    and sensor height -- matches Blender's own `angle` <-> `lens` conversion
    for a vertical-fit camera (`sensor_fit = 'VERTICAL'`, set in
    `create_camera` below), so this fully determines it without touching bpy.
    """
    half_fov = math.radians(vertical_fov_deg) / 2.0
    return (sensor_height_mm / 2.0) / math.tan(half_fov)


def create_camera(config: dict, collection) -> "bpy.types.Object":
    try:
        import bpy
        from mathutils import Matrix, Vector
    except ImportError as exc:  # pragma: no cover - exercised only outside Blender
        raise RuntimeError(
            "camera_builder.create_camera requires Blender's `bpy` module -- "
            "run it via `blender --background --python pool_render.py`."
        ) from exc

    camera_data = bpy.data.cameras.new(name=f"pool-camera-{config['camera']['preset']}")
    camera_data.sensor_fit = "VERTICAL"
    camera_data.sensor_height = 24.0
    camera_data.lens = compute_focal_length_mm(config["camera"]["verticalFovDeg"], camera_data.sensor_height)

    camera_object = bpy.data.objects.new(f"pool-camera-{config['camera']['preset']}", camera_data)
    collection.objects.link(camera_object)

    position = config["camera"]["position"]
    target = config["camera"]["target"]
    rotation_columns = compute_look_at_matrix(position, target)
    rotation_matrix = Matrix(rotation_columns).to_4x4()
    camera_object.matrix_world = Matrix.Translation(Vector(position)) @ rotation_matrix

    # A perfectly deep-focus image is the single strongest "this is a CG
    # viewport" tell -- real camera glass always has some falloff. A subtle,
    # photographic f/5.6 focused right on the pose's own target (not a new
    # number: the same `target` distance getCameraPose already chose) keeps
    # the pool sharp while letting the far corners/background soften slightly.
    camera_data.dof.use_dof = True
    camera_data.dof.focus_distance = (Vector(target) - Vector(position)).length
    camera_data.dof.aperture_fstop = 5.6

    bpy.context.scene.camera = camera_object
    return camera_object


if __name__ == "__main__":
    # Self-test: `python3 camera_builder.py` exercises the pure-math half
    # (look-at + focal length) with no Blender install required.
    matrix = compute_look_at_matrix((5.3939, 4.4941, 6.8922), (0.0, -0.75, 0.0))
    print("look-at matrix:", matrix)
    focal_length = compute_focal_length_mm(35.0)
    print(f"focal length for 35 deg vertical FOV on a 24mm sensor: {focal_length:.2f}mm")
    assert 30.0 < focal_length < 45.0, "sanity check failed: unexpected focal length"
    print("OK")
