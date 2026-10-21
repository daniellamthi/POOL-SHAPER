/** Exact pre-S Infinity waterline/Rig and captured1440 UI. Portable causal oracle; no screenshots or ignored source required. */
export const INFINITY_WATERLINE_R = {
  "sourceSha": {
    "camera": "39341a1961cab99c6bc04c659e60b65aef80aa010fb6499b14ce8d37bcec16a0",
    "scene": "8637c4ce08eec74fc65ad180890d4c0eb9493fde13e370b625397b83f0ff6c9e"
  },
  "rig": {
    "detail": "[\"access\", \"liner\", \"mosaic\", \"inox\", \"shelf\", \"hydromassage\", \"bench\", \"coping\", \"infinity\",\n    \"paving\", \"exterior-panel\", \"external-stairs\", \"pellicano\", \"stair-lighting\", \"bench-lighting\", \"skimmer-detail\", \"overflow-hidden\", \"overflow-visible\", \"features\", \"cover\"].includes(focus)",
    "coastal": "!!infinityZone && [\"review\", \"overview\"].includes(focus)",
    "optical": "detail",
    "local": "(focus === \"external-stairs\" && !!externalStairPlan) || (focus === \"cover\" && !!coverSubject)\n    || (!infinityZone && [\"paving\", \"review\", \"overview\", \"waterline\"].includes(focus))",
    "aspect": "() => {\n    if (focus === \"top\" && compactPlan) {\n      const b = outlineBounds(planBounds);\n      return b.spanX / Math.max(0.01, b.spanZ);\n    }\n    const subject = focus === \"shelf\" ? sunShelfCameraSubject(resolvedLayout, layout, outline, shelfLoungerEnvelope)\n      : focus === \"access\" ? accessFlightCameraSubject(resolvedLayout, layout, outline, shelfLoungerEnvelope)\n      : focus === \"inox\" ? accessCameraSubject(resolvedLayout.ladder?.plan ?? resolvedLayout.access, layout, outline)\n      : focus === \"hydromassage\" || focus === \"bench\" ? comfortCameraSubject(focus, resolvedLayout, layout, outline)\n      : focus === \"stair-lighting\" || focus === \"bench-lighting\" ? microLightCameraSubject(focus, resolvedLayout, layout, outline)\n      : focus === \"features\" ? lightingCameraSubject(outline, layout, ledRow)\n      : focus === \"external-stairs\" && externalStairPlan ? externalStairCameraSubject(externalStairPlan, layout)\n      : focus === \"cover\" ? coverSubject\n      : focus === \"paving\" && !infinityZone ? pavingCameraSubject(outline, layout, skimmers)\n      : !infinityZone && (focus === \"review\" || focus === \"overview\") ? overviewCameraSubject(outline, layout)\n      : focus === \"waterline\" && !infinityZone ? waterlineCameraSubject(outline, layout, skimmers)\n      : focus === \"infinity\" && infinityZone ? infinityDetailCameraSubject(outline, infinityZone, layout)\n      : focus === \"coping\" && infinityZone ? infinityCopingCameraSubject(outline, infinityZone, layout)\n      : focus === \"overflow-hidden\" || focus === \"overflow-visible\" ? overflowCameraSubject(focus, outline, layout, skimmers)\n      : null;\n    return subject ? componentCameraAspect(subject.points, subject.direction) : undefined;\n  }",
    "fit": "localFraming ? SCENE_VISUAL_PRESET.camera.fov\n    : cameraFrameFit(SCENE_VISUAL_PRESET.camera.fov, viewportSize.height, visibleFrame).verticalFov",
    "owner": "() => {\n    if (!(camera instanceof PerspectiveCamera) || !localFraming) return;\n    // This inset projection owns its aspect; R3F's DPR resize otherwise\n    // replaces it with the full canvas aspect after the camera has settled.\n    const owned = camera as PerspectiveCamera & { manual?: boolean };\n    const previous = owned.manual;\n    owned.manual = true;\n    return () => { if (previous === undefined) delete owned.manual; else owned.manual = previous; };\n  }",
    "projection": "canvas.dataset[\"cameraProjection\"] = camera instanceof OrthographicCamera ? \"orthographic\" : \"perspective\";\ncanvas.dataset[\"cameraFocus\"] = focus;\nif (camera instanceof OrthographicCamera && planFit.current) {\n      const fit = planFit.current;\n      camera.left = -fit.width/2; camera.right = fit.width/2;\n      camera.top = fit.height/2; camera.bottom = -fit.height/2;\n      camera.zoom = 1;\n      camera.updateProjectionMatrix();\n    }\nif (\"fov\" in camera) {\n      camera.fov = \"fov\" in pose ? Number(pose.fov) : SCENE_VISUAL_PRESET.camera.fov;\n      camera.updateProjectionMatrix();\n    }\nif (camera instanceof PerspectiveCamera) {\n      // clearViewOffset does not undo the inset's aspect. Restore the current\n      // canvas ratio on handoff, even if no R3F resize/DPR event follows.\n      if (!localFraming) camera.aspect = viewportSize.width / Math.max(1, viewportSize.height);\n      if (coastalHero) {\n        // Fit the original coastal image into the unobscured UI rectangle.\n        // Keep its photographic eye/target/FOV and site standoff unchanged.\n        const scale = Math.min(visibleFrame.width / viewportSize.width, visibleFrame.height / viewportSize.height);\n        const width = viewportSize.width * scale, height = viewportSize.height * scale;\n        const left = visibleFrame.left + (visibleFrame.width - width) / 2;\n        const top = visibleFrame.top + (visibleFrame.height - height) / 2;\n        camera.setViewOffset(width, height, -left, -top, viewportSize.width, viewportSize.height);\n      } else if (localFraming) {\n        // Keep the component's physical 34° lens close to the installation.\n        // A full-canvas lens fitted into a tiny UI strip pushed it into fog.\n        camera.setViewOffset(visibleFrame.width, visibleFrame.height,\n          -visibleFrame.left, -visibleFrame.top, viewportSize.width, viewportSize.height);\n      } else if (opticalDetail) {\n        // Shift the lens inside the available UI frame, not the installation\n        // viewpoint. Translating the eye/target moved it away from the real\n        // selected surface and could lower the physical architectural eye line.\n        camera.setViewOffset(viewportSize.width, viewportSize.height,\n          viewportSize.width / 2 - (visibleFrame.left + visibleFrame.width / 2),\n          viewportSize.height / 2 - (visibleFrame.top + visibleFrame.height / 2),\n          viewportSize.width, viewportSize.height);\n      } else camera.clearViewOffset();\n    }"
  },
  "oldPose": "const distance = Math.max(bounds.spanX, bounds.spanZ / Math.max(0.25, viewportAspect)) * 1.1;\nreturn { position: [bounds.maxX + distance, layout.waterY + 0.85, centre[1] + bounds.spanZ * 0.4], target: [centre[0], layout.waterY - 0.15, centre[1]] };",
  "protectedHashes": {
    "infinityDetailCameraSubject": "79f4b1fd80a9658c22c8e31cdace45522928f099ef277bacae6a6b5bda221125",
    "infinityCopingCameraSubject": "5d2de8647e0e2804183ee91e9b2f2a2d98e2bf8c66905c556efc143c29158d42",
    "getInfinityDetailCamera": "78549876df6e01af2d4e03c92e50e2934050f54b6b83effd2971b6e31f65aac0"
  },
  "desktopUI": {
    "canvas": {
      "bottom": 900,
      "height": 900,
      "left": 0,
      "right": 1440,
      "top": 0,
      "width": 1440,
      "x": 0,
      "y": 0
    },
    "overlays": [
      {
        "bottom": 84,
        "height": 72,
        "left": 16,
        "right": 1424,
        "top": 12,
        "width": 1408,
        "x": 16,
        "y": 12
      },
      {
        "bottom": 132,
        "height": 36,
        "left": 16,
        "right": 147.9140625,
        "top": 96,
        "width": 131.9140625,
        "x": 16,
        "y": 96
      },
      {
        "bottom": 487.5078125,
        "height": 40,
        "left": 1114.8515625,
        "right": 1420,
        "top": 447.5078125,
        "width": 305.1484375,
        "x": 1114.8515625,
        "y": 447.5078125
      },
      {
        "bottom": 884,
        "height": 368.4921875,
        "left": 130,
        "right": 1310,
        "top": 515.5078125,
        "width": 1180,
        "x": 130,
        "y": 515.5078125
      }
    ]
  }
};
