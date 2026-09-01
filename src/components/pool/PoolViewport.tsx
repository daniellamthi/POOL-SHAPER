import { lazy, memo, Suspense, useEffect, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { Aperture, Camera, Download, Expand, Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import { photoModeState, PHOTO_MODE_EXPORT_READY_SAMPLES } from "@/lib/pool/photoModeState";
import type { SceneProps, PhotoModeQuality } from "./three/PoolScene";

const PoolScene = lazy(() => import("./three/PoolScene"));

type ViewportProps = SceneProps & {
  onToggleMeasurements: () => void;
  onReframe: () => void;
  onTogglePhotoMode: () => void;
  onSetPhotoModeQuality: (quality: PhotoModeQuality) => void;
  photoModeUnsupported: boolean;
  /** Exports the current configuration for the separate Blender/Cycles render pipeline -- see src/lib/render-pipeline/. */
  onGeneratePhotorealisticRender: () => void;
};

function ViewportFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-viewport">
      <div className="animate-veil flex flex-col items-center gap-5">
        <span className="size-6 animate-spin rounded-full border border-border border-t-foreground/70" />
        <p className="label-xs">Preparing the 3D studio</p>
      </div>
    </div>
  );
}

/**
 * Reads the path tracer's sample count from outside the Canvas/R3F tree,
 * where the render loop actually lives. Polls on an interval rather than
 * subscribing to every accumulated sample -- this text only needs to feel
 * live, not track the exact frame the count changed on. Also drives the
 * "Generate photo" button's enabled state off the same poll, since both are
 * reading the same underlying counter.
 */
function usePhotoModeSamples() {
  const [samples, setSamples] = useState(0);
  useEffect(() => {
    // `photoModeState.samples` mirrors WebGLPathTracer#samples, which the
    // library itself increments by `1/totalTiles` per rendered tile (see
    // PathTracingRenderer.js) and only rounds once every tile in the current
    // sample has been drawn (default tiling is 3x3, so it spends most of its
    // time sitting at a fraction like N.111 or N.333). That's a legitimate
    // "how far through this sample are we" progress value, not a bug -- the
    // bug was displaying it raw instead of flooring it to the last fully
    // completed sample count for this discrete-looking counter.
    const id = window.setInterval(() => setSamples(Math.floor(photoModeState.samples)), 200);
    return () => window.clearInterval(id);
  }, []);
  return samples;
}

function PhotoModeStatus({ samples }: { samples: number }) {
  return (
    <p className="pointer-events-none absolute left-1/2 top-6 -translate-x-1/2 text-[10px] uppercase tracking-[0.24em] text-muted-foreground/70">
      Refining… {samples} samples
    </p>
  );
}

function QualityPicker({
  quality,
  onChange,
}: {
  quality: PhotoModeQuality;
  onChange: (quality: PhotoModeQuality) => void;
}) {
  return (
    <div className="pointer-events-auto flex gap-2">
      <Button
        type="button"
        variant={quality === "standard" ? "viewportActive" : "viewport"}
        size="sm"
        onClick={() => onChange("standard")}
        title="Faster convergence, tuned bounce count -- see docs/PHOTO_MODE.md"
      >
        Standard
      </Button>
      <Button
        type="button"
        variant={quality === "high" ? "viewportActive" : "viewport"}
        size="sm"
        onClick={() => onChange("high")}
        title="Path tracer's own defaults -- slower to converge"
      >
        High
      </Button>
    </div>
  );
}

export const PoolViewport = memo(function PoolViewport({
  onToggleMeasurements,
  onReframe,
  onTogglePhotoMode,
  onSetPhotoModeQuality,
  photoModeUnsupported,
  onGeneratePhotorealisticRender,
  ...scene
}: ViewportProps) {
  const samples = usePhotoModeSamples();
  const exportReady = scene.photoMode && samples >= PHOTO_MODE_EXPORT_READY_SAMPLES;

  return (
    <div className="relative h-full w-full overflow-hidden bg-viewport">
      <ClientOnly fallback={<ViewportFallback />}>
        <Suspense fallback={<ViewportFallback />}>
          <PoolScene {...scene} />
        </Suspense>
      </ClientOnly>

      {/* Vignette for depth — purely decorative */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background:radial-gradient(120%_92%_at_50%_40%,transparent_52%,color-mix(in_oklab,var(--viewport)_74%,transparent)_100%)]"
      />

      {scene.photoMode ? <PhotoModeStatus samples={samples} /> : null}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-6 p-6 sm:p-8">
        <p className="hidden text-[10px] uppercase tracking-[0.24em] text-muted-foreground/70 sm:block">
          {scene.photoMode
            ? "Path-traced preview — camera locked while refining"
            : "Drag to orbit · Scroll to zoom · Right-drag to pan"}
        </p>
        <div className="pointer-events-auto ml-auto flex flex-wrap items-center justify-end gap-2">
          {scene.photoMode ? (
            <>
              <QualityPicker quality={scene.photoModeQuality} onChange={onSetPhotoModeQuality} />
              <Button
                type="button"
                variant="viewport"
                size="sm"
                disabled={!exportReady}
                title={
                  exportReady
                    ? "Save the current frame as a PNG"
                    : `Keep refining -- ${PHOTO_MODE_EXPORT_READY_SAMPLES} samples gives a clean image`
                }
                onClick={() => {
                  photoModeState.exportRequestId += 1;
                }}
              >
                <Download />
                Generate photo
              </Button>
            </>
          ) : null}
          <Button
            type="button"
            variant={scene.showMeasurements ? "viewportActive" : "viewport"}
            size="sm"
            onClick={onToggleMeasurements}
            disabled={scene.photoMode}
          >
            <Ruler />
            Guides
          </Button>
          <Button type="button" variant="viewport" size="sm" onClick={onReframe}>
            <Expand />
            Reframe
          </Button>
          {scene.photoMode ? null : (
            <Button
              type="button"
              variant="viewport"
              size="sm"
              onClick={onGeneratePhotorealisticRender}
              title="Exports this configuration for the Blender/Cycles render pipeline -- see rendering/blender/"
            >
              <Aperture />
              Generate Photorealistic Render
            </Button>
          )}
          <Button
            type="button"
            variant={scene.photoMode ? "viewportActive" : "viewport"}
            size="sm"
            onClick={onTogglePhotoMode}
            disabled={photoModeUnsupported}
            title={photoModeUnsupported ? "Not supported on this device" : undefined}
          >
            <Camera />
            {scene.photoMode ? "Back to Live" : "Photo Mode"}
          </Button>
        </div>
      </div>
    </div>
  );
});
