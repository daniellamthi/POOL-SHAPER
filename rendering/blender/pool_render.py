#!/usr/bin/env python3
"""CLI entry point for the Blender/Cycles photorealistic pool render.

Usage (see src/lib/render-pipeline/renderJob.ts, which prints this exact
invocation from the "Generate Photorealistic Render" button in the app):

    blender --background --factory-startup --python pool_render.py -- \\
        --config pool-render-config-2026-08-29T12-00-00-000Z.json \\
        --assets-root public \\
        --out pool-render-2026-08-29T12-00-00-000Z.png \\
        --width 1920 --height 1080 --samples 256

`--width`/`--height`/`--samples` are optional overrides -- without them the
config's own `outputPreset` is used, which is what the app always sends. They
exist for quick manual re-renders at a different resolution without hand-
editing the JSON.

Must be run through Blender (`blender --background --python pool_render.py`)
-- it imports `bpy`, which only exists inside Blender's own interpreter.
"""

from __future__ import annotations

import argparse
import os
import sys

# Blender does not add this script's own directory to `sys.path`
# automatically in every version -- make the sibling modules
# (config_loader, geometry_builder, ...) importable regardless.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    import bpy
except ImportError:
    bpy = None


def parse_args(argv):
    parser = argparse.ArgumentParser(description="Render a PoolRenderConfig JSON with Cycles.")
    parser.add_argument("--config", required=True, help="Path to the PoolRenderConfig JSON file.")
    parser.add_argument(
        "--assets-root",
        default="public",
        help="Directory the config's site-relative texture/HDRI URLs are resolved against "
        "(the exporting app's own `public/` directory).",
    )
    parser.add_argument("--out", required=True, help="Output image path (PNG).")
    parser.add_argument("--width", type=int, default=None, help="Override outputPreset.width.")
    parser.add_argument("--height", type=int, default=None, help="Override outputPreset.height.")
    parser.add_argument("--samples", type=int, default=None, help="Override outputPreset.samples.")
    return parser.parse_args(argv)


def _argv_after_double_dash():
    """Blender swallows everything before a bare `--` on its own command
    line; only what follows is this script's own argv."""
    argv = sys.argv
    if "--" in argv:
        return argv[argv.index("--") + 1 :]
    return argv[1:]


def main() -> int:
    if bpy is None:
        print(
            "ERROR: pool_render.py must be run through Blender, e.g.:\n"
            "  blender --background --factory-startup --python pool_render.py -- --config <file> --out <file>",
            file=sys.stderr,
        )
        return 1

    args = parse_args(_argv_after_double_dash())

    from config_loader import load_pool_render_config, PoolRenderConfigError
    import scene_builder

    try:
        config = load_pool_render_config(args.config)
    except (PoolRenderConfigError, FileNotFoundError, ValueError) as error:
        print(f"ERROR: invalid PoolRenderConfig ({args.config}): {error}", file=sys.stderr)
        return 1

    if args.width:
        config["outputPreset"]["width"] = args.width
    if args.height:
        config["outputPreset"]["height"] = args.height
    if args.samples:
        config["outputPreset"]["samples"] = args.samples

    scene_builder.build_scene(config, assets_root=args.assets_root)

    bpy.context.scene.render.filepath = os.path.abspath(args.out)
    bpy.ops.render.render(write_still=True)
    print(f"Rendered {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
