"""Loads and validates a ``PoolRenderConfig`` JSON export.

This module has NO dependency on ``bpy`` -- it is plain, standard-library
Python (targets 3.9+, the same baseline Blender's bundled interpreter has
used since 2.93) so it can be imported and unit-tested outside Blender too
(see the bottom of this file for a self-test you can run with a plain
``python3``, no Blender install required).

It intentionally mirrors, field for field, the Zod schema in
``src/lib/render-pipeline/schema.ts`` on the TypeScript side. There is no
shared code generation between the two -- if a field is added or renamed on
the TS side, update the matching check here by hand.
"""

from __future__ import annotations

import json
import os

SCHEMA_VERSION = 1

_INSTALLATIONS = {"in-ground", "above-ground"}
_SYSTEMS = {"skimmer", "overflow"}
_OVERFLOW_TYPES = {"hidden", "visible"}
_FINISH_MATERIALS = {"liner", "mosaic"}
_STAIRCASE_KINDS = {"external", "internal-steps", "stainless-ladder"}
_ACCESSORY_CATEGORIES = {"feature", "equipment"}
_CAMERA_PRESETS = {"hero", "overview", "skimmer", "overflow", "liner", "mosaic"}
_THEMES = {"light", "dark"}
_ENVIRONMENT_LABELS = {"Sunny Day", "Dusk"}
_OUTPUT_PRESET_IDS = {"hd", "4k"}


class PoolRenderConfigError(ValueError):
    """Raised when a PoolRenderConfig JSON document fails validation."""


def _fail(path: str, message: str) -> None:
    raise PoolRenderConfigError(f"{path}: {message}")


def _require(obj: dict, key: str, path: str):
    if key not in obj:
        _fail(path, f"missing required field '{key}'")
    return obj[key]


def _require_type(value, expected_types, path: str):
    if not isinstance(value, expected_types):
        _fail(path, f"expected {expected_types}, got {type(value).__name__}")
    return value


def _require_enum(value, allowed: set, path: str):
    if value not in allowed:
        _fail(path, f"expected one of {sorted(allowed)}, got {value!r}")
    return value


def _require_number(value, path: str, *, positive: bool = False, nonnegative: bool = False):
    _require_type(value, (int, float), path)
    if isinstance(value, bool):  # bool is a subclass of int in Python
        _fail(path, "expected a number, got a boolean")
    if positive and value <= 0:
        _fail(path, f"expected a positive number, got {value}")
    if nonnegative and value < 0:
        _fail(path, f"expected a non-negative number, got {value}")
    return float(value)


def _require_hex_color(value, path: str) -> str:
    _require_type(value, str, path)
    if len(value) != 7 or not value.startswith("#"):
        _fail(path, f"expected a 6-digit hex colour like '#aabbcc', got {value!r}")
    try:
        int(value[1:], 16)
    except ValueError:
        _fail(path, f"expected a 6-digit hex colour like '#aabbcc', got {value!r}")
    return value


def _require_vec(value, length: int, path: str) -> tuple:
    _require_type(value, (list, tuple), path)
    if len(value) != length:
        _fail(path, f"expected {length} numbers, got {len(value)}")
    return tuple(_require_number(v, f"{path}[{i}]") for i, v in enumerate(value))


def _validate_shape(shape: dict, path: str) -> dict:
    kind = _require_enum(_require(shape, "kind", path), {"rectangle", "custom"}, f"{path}.kind")
    outline_raw = _require(shape, "outline", path)
    _require_type(outline_raw, list, f"{path}.outline")
    if len(outline_raw) < 3:
        _fail(f"{path}.outline", "a pool outline needs at least 3 vertices")
    outline = [_require_vec(point, 2, f"{path}.outline[{i}]") for i, point in enumerate(outline_raw)]
    return {"kind": kind, "outline": outline}


def _validate_dimensions(dimensions: dict, path: str) -> dict:
    return {
        "length": _require_number(_require(dimensions, "length", path), f"{path}.length", positive=True),
        "width": _require_number(_require(dimensions, "width", path), f"{path}.width", positive=True),
        "depth": _require_number(_require(dimensions, "depth", path), f"{path}.depth", positive=True),
        "cornerRadius": _require_number(
            _require(dimensions, "cornerRadius", path), f"{path}.cornerRadius", nonnegative=True
        ),
    }


def _validate_structure(structure: dict, path: str) -> dict:
    installation = _require_enum(
        _require(structure, "installation", path), _INSTALLATIONS, f"{path}.installation"
    )
    system = _require_enum(_require(structure, "system", path), _SYSTEMS, f"{path}.system")
    overflow_type = structure.get("overflowType")
    if overflow_type is not None:
        _require_enum(overflow_type, _OVERFLOW_TYPES, f"{path}.overflowType")
    return {"installation": installation, "system": system, "overflowType": overflow_type}


def _validate_vertical_layout(layout: dict, path: str) -> dict:
    fields = ["groundY", "floorY", "wallTopY", "waterY", "copingY"]
    result = {f: _require_number(_require(layout, f, path), f"{path}.{f}") for f in fields}
    result["copingThickness"] = _require_number(
        _require(layout, "copingThickness", path), f"{path}.copingThickness", nonnegative=True
    )
    result["copingWidth"] = _require_number(
        _require(layout, "copingWidth", path), f"{path}.copingWidth", nonnegative=True
    )
    return result


def _validate_finish(finish: dict, path: str) -> dict:
    texture_url = finish.get("textureUrl")
    if texture_url is not None:
        _require_type(texture_url, str, f"{path}.textureUrl")
    return {
        "material": _require_enum(_require(finish, "material", path), _FINISH_MATERIALS, f"{path}.material"),
        "colorId": _require_type(_require(finish, "colorId", path), str, f"{path}.colorId"),
        "title": _require_type(_require(finish, "title", path), str, f"{path}.title"),
        "baseColorHex": _require_hex_color(_require(finish, "baseColorHex", path), f"{path}.baseColorHex"),
        "textureUrl": texture_url,
        "roughness": _require_number(_require(finish, "roughness", path), f"{path}.roughness", nonnegative=True),
        "metalness": _require_number(_require(finish, "metalness", path), f"{path}.metalness", nonnegative=True),
    }


def _validate_coping(coping: dict, path: str) -> dict:
    return {
        "colorHex": _require_hex_color(_require(coping, "colorHex", path), f"{path}.colorHex"),
        "roughness": _require_number(_require(coping, "roughness", path), f"{path}.roughness", nonnegative=True),
        "thickness": _require_number(_require(coping, "thickness", path), f"{path}.thickness", positive=True),
        "width": _require_number(_require(coping, "width", path), f"{path}.width", positive=True),
    }


def _validate_water(water: dict, path: str) -> dict:
    return {
        "waterY": _require_number(_require(water, "waterY", path), f"{path}.waterY"),
        "ior": _require_number(_require(water, "ior", path), f"{path}.ior", positive=True),
        "roughness": _require_number(_require(water, "roughness", path), f"{path}.roughness", nonnegative=True),
        "transmission": _require_number(
            _require(water, "transmission", path), f"{path}.transmission", nonnegative=True
        ),
        "scatteringColor": _require_vec(_require(water, "scatteringColor", path), 3, f"{path}.scatteringColor"),
        "absorption": _require_vec(_require(water, "absorption", path), 3, f"{path}.absorption"),
        "attenuationColorHex": _require_hex_color(
            _require(water, "attenuationColorHex", path), f"{path}.attenuationColorHex"
        ),
        "attenuationDistance": _require_number(
            _require(water, "attenuationDistance", path), f"{path}.attenuationDistance", positive=True
        ),
    }


def _validate_staircase(staircase: dict, path: str) -> dict:
    present = _require_type(_require(staircase, "present", path), bool, f"{path}.present")
    kind = staircase.get("kind")
    if kind is not None:
        _require_enum(kind, _STAIRCASE_KINDS, f"{path}.kind")
    return {"present": present, "kind": kind}


def _validate_accessories(accessories, path: str) -> list:
    _require_type(accessories, list, path)
    result = []
    for i, item in enumerate(accessories):
        item_path = f"{path}[{i}]"
        result.append(
            {
                "id": _require_type(_require(item, "id", item_path), str, f"{item_path}.id"),
                "category": _require_enum(
                    _require(item, "category", item_path), _ACCESSORY_CATEGORIES, f"{item_path}.category"
                ),
                "title": _require_type(_require(item, "title", item_path), str, f"{item_path}.title"),
            }
        )
    return result


def _validate_camera(camera: dict, path: str) -> dict:
    return {
        "preset": _require_enum(_require(camera, "preset", path), _CAMERA_PRESETS, f"{path}.preset"),
        "position": _require_vec(_require(camera, "position", path), 3, f"{path}.position"),
        "target": _require_vec(_require(camera, "target", path), 3, f"{path}.target"),
        "verticalFovDeg": _require_number(
            _require(camera, "verticalFovDeg", path), f"{path}.verticalFovDeg", positive=True
        ),
    }


def _validate_environment(environment: dict, path: str) -> dict:
    return {
        "theme": _require_enum(_require(environment, "theme", path), _THEMES, f"{path}.theme"),
        "label": _require_enum(_require(environment, "label", path), _ENVIRONMENT_LABELS, f"{path}.label"),
        "hdriUrl": _require_type(_require(environment, "hdriUrl", path), str, f"{path}.hdriUrl"),
    }


def _validate_output_preset(preset: dict, path: str) -> dict:
    return {
        "id": _require_enum(_require(preset, "id", path), _OUTPUT_PRESET_IDS, f"{path}.id"),
        "width": int(_require_number(_require(preset, "width", path), f"{path}.width", positive=True)),
        "height": int(_require_number(_require(preset, "height", path), f"{path}.height", positive=True)),
        "samples": int(_require_number(_require(preset, "samples", path), f"{path}.samples", positive=True)),
        "denoise": _require_type(_require(preset, "denoise", path), bool, f"{path}.denoise"),
    }


def validate_pool_render_config(data: dict) -> dict:
    """Validates a decoded ``PoolRenderConfig`` JSON document.

    Returns a plain dict with the same shape, with every numeric leaf
    coerced to ``float`` (JSON ints and floats are otherwise indistinguishable
    in ways that matter for Blender's own APIs) and every vector coerced to a
    tuple. Raises ``PoolRenderConfigError`` with a field path on the first
    problem found -- deliberately fail-fast rather than collecting every
    error, since this only ever runs once per render, right before Blender
    starts building geometry from it.
    """
    _require_type(data, dict, "<root>")
    schema_version = _require(data, "schemaVersion", "<root>")
    if schema_version != SCHEMA_VERSION:
        _fail("schemaVersion", f"expected {SCHEMA_VERSION}, got {schema_version!r}")
    source_project = _require(data, "sourceProject", "<root>")
    if source_project != "pool-shape-shaper-main":
        _fail("sourceProject", f"expected 'pool-shape-shaper-main', got {source_project!r}")

    return {
        "schemaVersion": SCHEMA_VERSION,
        "generatedAt": _require_type(_require(data, "generatedAt", "<root>"), str, "generatedAt"),
        "sourceProject": source_project,
        "shape": _validate_shape(_require(data, "shape", "<root>"), "shape"),
        "dimensions": _validate_dimensions(_require(data, "dimensions", "<root>"), "dimensions"),
        "structure": _validate_structure(_require(data, "structure", "<root>"), "structure"),
        "verticalLayout": _validate_vertical_layout(_require(data, "verticalLayout", "<root>"), "verticalLayout"),
        "finish": _validate_finish(_require(data, "finish", "<root>"), "finish"),
        "coping": _validate_coping(_require(data, "coping", "<root>"), "coping"),
        "water": _validate_water(_require(data, "water", "<root>"), "water"),
        "staircase": _validate_staircase(_require(data, "staircase", "<root>"), "staircase"),
        "accessories": _validate_accessories(_require(data, "accessories", "<root>"), "accessories"),
        "camera": _validate_camera(_require(data, "camera", "<root>"), "camera"),
        "environment": _validate_environment(_require(data, "environment", "<root>"), "environment"),
        "outputPreset": _validate_output_preset(_require(data, "outputPreset", "<root>"), "outputPreset"),
    }


def load_pool_render_config(config_path: str) -> dict:
    """Reads and validates a PoolRenderConfig JSON file from disk."""
    if not os.path.isfile(config_path):
        raise FileNotFoundError(f"PoolRenderConfig file not found: {config_path}")
    with open(config_path, "r", encoding="utf-8") as handle:
        data = json.load(handle)
    return validate_pool_render_config(data)


def resolve_asset_path(assets_root: str, site_relative_url: str) -> str:
    """Resolves a site-relative URL (e.g. "/textures/pvc-liner/foo.png", the
    same strings the live Three.js app fetches from its own `public/`
    directory) against the given assets root, so config_loader stays the
    only place that knows this convention exists."""
    return os.path.join(assets_root, site_relative_url.lstrip("/"))


if __name__ == "__main__":
    # Self-test: `python3 config_loader.py` validates the Golden Scene
    # fixture with no Blender install required. This is the check actually
    # run in this environment (see rendering/blender/README.md) -- it proves
    # the validation logic and the fixture agree, not that Cycles renders it.
    import sys

    fixture = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures", "golden_scene.json")
    config = load_pool_render_config(fixture)
    print(f"OK: loaded and validated {fixture}")
    print(f"  shape.kind={config['shape']['kind']} outline points={len(config['shape']['outline'])}")
    print(f"  dimensions={config['dimensions']}")
    print(f"  camera.preset={config['camera']['preset']} position={config['camera']['position']}")
    sys.exit(0)
