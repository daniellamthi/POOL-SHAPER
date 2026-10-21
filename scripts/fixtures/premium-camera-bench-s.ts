/** Exact pre-T S camera/Rig and real430 UI. Opaque-ray oracle, not material/rendering QA. */
export const BENCH_LIGHTING_S = {
  "sourceSha": {
    "camera": "cb499a74cbc76aba0798c7a93db011150271f8c4c4d3e05c35a841bc0ce4d8c5",
    "scene": "6cef09cb941be1f3e93ab86fa011fbab4b1b707c0cf162622b5db316ac69e013"
  },
  "rig": {
    "detail": "[\"access\", \"liner\", \"mosaic\", \"inox\", \"shelf\", \"hydromassage\", \"bench\", \"coping\", \"infinity\",\n    \"paving\", \"exterior-panel\", \"external-stairs\", \"pellicano\", \"stair-lighting\", \"bench-lighting\", \"skimmer-detail\", \"overflow-hidden\", \"overflow-visible\", \"features\", \"cover\"].includes(focus)",
    "coastal": "!!infinityZone && [\"review\", \"overview\"].includes(focus)",
    "optical": "detail",
    "local": "(focus === \"external-stairs\" && !!externalStairPlan) || (focus === \"cover\" && !!coverSubject)\n    || focus === \"waterline\" || (!infinityZone && [\"paving\", \"review\", \"overview\"].includes(focus))",
    "aspect": "() => {\n    if (focus === \"top\" && compactPlan) {\n      const b = outlineBounds(planBounds);\n      return b.spanX / Math.max(0.01, b.spanZ);\n    }\n    const subject = focus === \"shelf\" ? sunShelfCameraSubject(resolvedLayout, layout, outline, shelfLoungerEnvelope)\n      : focus === \"access\" ? accessFlightCameraSubject(resolvedLayout, layout, outline, shelfLoungerEnvelope)\n      : focus === \"inox\" ? accessCameraSubject(resolvedLayout.ladder?.plan ?? resolvedLayout.access, layout, outline)\n      : focus === \"hydromassage\" || focus === \"bench\" ? comfortCameraSubject(focus, resolvedLayout, layout, outline)\n      : focus === \"stair-lighting\" || focus === \"bench-lighting\" ? microLightCameraSubject(focus, resolvedLayout, layout, outline)\n      : focus === \"features\" ? lightingCameraSubject(outline, layout, ledRow)\n      : focus === \"external-stairs\" && externalStairPlan ? externalStairCameraSubject(externalStairPlan, layout)\n      : focus === \"cover\" ? coverSubject\n      : focus === \"paving\" && !infinityZone ? pavingCameraSubject(outline, layout, skimmers)\n      : !infinityZone && (focus === \"review\" || focus === \"overview\") ? overviewCameraSubject(outline, layout)\n      : focus === \"waterline\" ? (infinityZone ? infinityWaterlineCameraSubject(outline, infinityZone, layout) : waterlineCameraSubject(outline, layout, skimmers))\n      : focus === \"infinity\" && infinityZone ? infinityDetailCameraSubject(outline, infinityZone, layout)\n      : focus === \"coping\" && infinityZone ? infinityCopingCameraSubject(outline, infinityZone, layout)\n      : focus === \"overflow-hidden\" || focus === \"overflow-visible\" ? overflowCameraSubject(focus, outline, layout, skimmers)\n      : null;\n    return subject ? componentCameraAspect(subject.points, subject.direction) : undefined;\n  }",
    "fit": "localFraming ? SCENE_VISUAL_PRESET.camera.fov\n    : cameraFrameFit(SCENE_VISUAL_PRESET.camera.fov, viewportSize.height, visibleFrame).verticalFov",
    "owner": "() => {\n    if (!(camera instanceof PerspectiveCamera) || !localFraming) return;\n    // This inset projection owns its aspect; R3F's DPR resize otherwise\n    // replaces it with the full canvas aspect after the camera has settled.\n    const owned = camera as PerspectiveCamera & { manual?: boolean };\n    const previous = owned.manual;\n    owned.manual = true;\n    return () => { if (previous === undefined) delete owned.manual; else owned.manual = previous; };\n  }",
    "projection": "canvas.dataset[\"cameraProjection\"] = camera instanceof OrthographicCamera ? \"orthographic\" : \"perspective\";\ncanvas.dataset[\"cameraFocus\"] = focus;\nif (camera instanceof OrthographicCamera && planFit.current) {\n      const fit = planFit.current;\n      camera.left = -fit.width/2; camera.right = fit.width/2;\n      camera.top = fit.height/2; camera.bottom = -fit.height/2;\n      camera.zoom = 1;\n      camera.updateProjectionMatrix();\n    }\nif (\"fov\" in camera) {\n      camera.fov = \"fov\" in pose ? Number(pose.fov) : SCENE_VISUAL_PRESET.camera.fov;\n      camera.updateProjectionMatrix();\n    }\nif (camera instanceof PerspectiveCamera) {\n      // clearViewOffset does not undo the inset's aspect. Restore the current\n      // canvas ratio on handoff, even if no R3F resize/DPR event follows.\n      if (!localFraming) camera.aspect = viewportSize.width / Math.max(1, viewportSize.height);\n      if (coastalHero) {\n        // Fit the original coastal image into the unobscured UI rectangle.\n        // Keep its photographic eye/target/FOV and site standoff unchanged.\n        const scale = Math.min(visibleFrame.width / viewportSize.width, visibleFrame.height / viewportSize.height);\n        const width = viewportSize.width * scale, height = viewportSize.height * scale;\n        const left = visibleFrame.left + (visibleFrame.width - width) / 2;\n        const top = visibleFrame.top + (visibleFrame.height - height) / 2;\n        camera.setViewOffset(width, height, -left, -top, viewportSize.width, viewportSize.height);\n      } else if (localFraming) {\n        // Keep the component's physical 34° lens close to the installation.\n        // A full-canvas lens fitted into a tiny UI strip pushed it into fog.\n        camera.setViewOffset(visibleFrame.width, visibleFrame.height,\n          -visibleFrame.left, -visibleFrame.top, viewportSize.width, viewportSize.height);\n      } else if (opticalDetail) {\n        // Shift the lens inside the available UI frame, not the installation\n        // viewpoint. Translating the eye/target moved it away from the real\n        // selected surface and could lower the physical architectural eye line.\n        camera.setViewOffset(viewportSize.width, viewportSize.height,\n          viewportSize.width / 2 - (visibleFrame.left + visibleFrame.width / 2),\n          viewportSize.height / 2 - (visibleFrame.top + visibleFrame.height / 2),\n          viewportSize.width, viewportSize.height);\n      } else camera.clearViewOffset();\n    }"
  },
  "microSource": "function microLightCameraSubject(intent: \"stair-lighting\" | \"bench-lighting\", resolved: ResolvedPoolLayout, layout: PoolVerticalLayout, outline: Outline): { points: CameraPoint[]; direction: CameraPoint } | null {\n  const hydro = resolved.comfort.elements.find(element => element.kind === \"hydromassage\");\n  const available = intent === \"stair-lighting\" ? resolved.stairMicroSpots : hydro?.spots ?? [];\n  if (!available.length) return null;\n  const levels = [...new Set(available.map(spot => spot.y))].sort((a, b) => b - a);\n  const selectedLevels = intent === \"stair-lighting\" ? levels.slice(Math.max(0, Math.floor((levels.length - 3) / 2)), Math.max(0, Math.floor((levels.length - 3) / 2)) + 3) : levels;\n  const spots = available.filter(spot => selectedLevels.includes(spot.y)), points: CameraPoint[] = [];\n  const low = Math.min(...selectedLevels), high = Math.max(...selectedLevels);\n  for (const spot of spots) {\n    const r = HYDRO_DIMENSIONS.spotDiameter / 2;\n    for (const side of [-1, 1]) for (const dy of [-1, 1]) points.push([spot.x + spot.dir[1] * r * side, spot.y + r * dy, spot.z - spot.dir[0] * r * side]);\n  }\n  if (intent === \"stair-lighting\") {\n    const access = accessCameraSubject(resolved.access, layout, outline);\n    const context = access?.points ?? resolved.comfort.elements.flatMap(element =>\n      [...(element.steps ?? []), ...(element.landing ? [element.landing] : [])].flatMap(part =>\n        part.footprint.flatMap(([x, z]) => [[x, part.topY, z], [x, part.topY - (element.riser ?? 0), z]] as CameraPoint[])));\n    const rise = resolved.access.rise || resolved.comfort.elements.find(element => element.riser)?.riser || 0;\n    points.push(...context.filter(point => point[1] >= low - rise * 0.51 && point[1] <= high + rise * 0.51));\n  } else if (hydro) {\n    const floor = hydro.tiers?.find(tier => tier.role === \"tubFloor\")?.topY ?? layout.floorY;\n    for (const tier of hydro.tiers ?? []) if ([\"backSeat\", \"sideSeat\", \"innerSideSeat\"].includes(tier.role))\n      for (const [x, z] of tier.footprint) points.push([x, tier.topY, z]);\n    for (const spot of spots) points.push([spot.x + spot.dir[0] * 0.15, floor, spot.z + spot.dir[1] * 0.15]);\n  }\n  let nx = spots.reduce((sum, spot) => sum + spot.dir[0], 0), nz = spots.reduce((sum, spot) => sum + spot.dir[1], 0);\n  const n = Math.hypot(nx, nz); if (n < 0.1) { nx = 1; nz = 0; } else { nx /= n; nz /= n; }\n  return { points, direction: [nx + nz * 0.2, 0.65, nz - nx * 0.2] };\n}",
  "protectedHashes": {
    "sunShelfCameraSubject": "1ad5040fd0ed434f7cf530c1e003cd51f3491b5d206acef4b5e2eb0f23ccc702",
    "accessCameraSubject": "aa1287c7ae32eac0a0bba7b880f1d3b497fe7fce455343b0a0092df35c53281b",
    "accessFlightCameraSubject": "784f5a795da857b23af234e9c26d034553d1deef168d4a190de461222cd772c7",
    "comfortCameraSubject": "fdca658bf3be0db69ec63cb6456f7d3fb9c78f3c3dfbd2195eda9610364e4d2b",
    "lightingCameraSubject": "41aa7b811c2220cd142e00c840e543e7b8987e63a84185c64dbb6d9884119086",
    "infinityDetailCameraSubject": "79f4b1fd80a9658c22c8e31cdace45522928f099ef277bacae6a6b5bda221125",
    "infinityCopingCameraSubject": "5d2de8647e0e2804183ee91e9b2f2a2d98e2bf8c66905c556efc143c29158d42",
    "infinityWaterlineCameraSubject": "b8f4792eeb83d7bf524bf5c696376bb17c55a72913a8356bcef86b695aee88f9",
    "getInfinityDetailCamera": "78549876df6e01af2d4e03c92e50e2934050f54b6b83effd2971b6e31f65aac0"
  },
  "geometryHash": "1dd077a0a7a2584e2e6cce461db65884d5ecb43bcb9482772c6ad9e292f0b42e",
  "geometryPlanHash": "7b7baf08477d1ce9e0e66159437abb0837ad434356aec76af411601b96cd6dc9",
  "ui430": {
    "canvas": {
      "bottom": 932,
      "height": 932,
      "left": 0,
      "right": 430,
      "top": 0,
      "width": 430,
      "x": 0,
      "y": 0
    },
    "overlays": [
      {
        "bottom": 116,
        "height": 108,
        "left": 8,
        "right": 422,
        "top": 8,
        "width": 414,
        "x": 8,
        "y": 8
      },
      {
        "bottom": 168,
        "height": 36,
        "left": 12,
        "right": 143.9140625,
        "top": 132,
        "width": 131.9140625,
        "x": 12,
        "y": 132
      },
      {
        "bottom": 386.3125,
        "height": 40,
        "left": 220.921875,
        "right": 414,
        "top": 346.3125,
        "width": 193.078125,
        "x": 220.921875,
        "y": 346.3125
      },
      {
        "bottom": 382.3125,
        "height": 32,
        "left": 329,
        "right": 361,
        "top": 350.3125,
        "width": 32,
        "x": 329,
        "y": 350.3125
      },
      {
        "bottom": 386.3125,
        "height": 40,
        "left": 374,
        "right": 414,
        "top": 346.3125,
        "width": 40,
        "x": 374,
        "y": 346.3125
      },
      {
        "bottom": 924,
        "height": 505.6875,
        "left": 8,
        "right": 422,
        "top": 418.3125,
        "width": 414,
        "x": 8,
        "y": 418.3125
      }
    ]
  }
};
