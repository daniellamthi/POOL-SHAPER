import { lazy, memo, Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { Expand, Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SceneProps } from "./three/PoolScene";

const PoolScene = lazy(() => import("./three/PoolScene"));

type ViewportProps = SceneProps & {
  onToggleMeasurements: () => void;
  onReframe: () => void;
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

export const PoolViewport = memo(function PoolViewport({
  onToggleMeasurements,
  onReframe,
  ...scene
}: ViewportProps) {
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
        className="pointer-events-none absolute inset-0 [background:radial-gradient(120%_90%_at_50%_35%,transparent_45%,color-mix(in_oklab,var(--viewport)_85%,transparent)_100%)]"
      />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-6 p-6 sm:p-8">
        <p className="hidden text-[10px] uppercase tracking-[0.24em] text-muted-foreground/70 sm:block">
          Drag to orbit · Scroll to zoom · Right-drag to pan
        </p>
        <div className="pointer-events-auto ml-auto flex gap-2">
          <Button
            type="button"
            variant={scene.showMeasurements ? "viewportActive" : "viewport"}
            size="sm"
            onClick={onToggleMeasurements}
          >
            <Ruler />
            Guides
          </Button>
          <Button type="button" variant="viewport" size="sm" onClick={onReframe}>
            <Expand />
            Reframe
          </Button>
        </div>
      </div>
    </div>
  );
});
