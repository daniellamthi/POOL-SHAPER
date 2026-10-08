import { lazy, memo, Suspense, useEffect, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import {
  Aperture,
  Camera,
  ChevronDown,
  Download,
  Expand,
  Eye,
  Focus,
  Layers,
  Loader2,
  MoreHorizontal,
  Ruler,
  Shrink,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { photoModeState, PHOTO_MODE_EXPORT_READY_SAMPLES } from "@/lib/pool/photoModeState";
import type { RenderJobStatus } from "@/lib/render-pipeline";
import type { SceneProps, PhotoModeQuality } from "./three/PoolScene";
import { TechnicalDataPanel } from "./TechnicalDataPanel";
import type { TechnicalPlan } from "@/lib/pool/technical-plan";
import type { VisualFocus } from "@/lib/pool/contextual-camera";

const PoolScene = lazy(() => import("./three/PoolScene"));

type ViewportProps = SceneProps & {
  technicalPlan: TechnicalPlan;
  onToggleTechnicalView: () => void;
  onTechnicalFocus: (focus: VisualFocus) => void;
  onToggleMeasurements: () => void;
  onReframe: () => void;
  onTogglePhotoMode: () => void;
  onSetPhotoModeQuality: (quality: PhotoModeQuality) => void;
  photoModeUnsupported: boolean;
  /** Opens final presentation choices; no renderer is invoked. */
  onGeneratePhotorealisticRender: () => void;
  premiumPresentationAvailable: boolean;
  renderPhase: "idle" | "rendering" | "complete" | "error";
  renderProgress: RenderJobStatus["progress"];
  /** P5: on narrow viewports the live pool can otherwise read as cropped
   * once the wizard controls take their share of the screen -- this lets
   * the customer blow the same live view up to fill the screen without
   * losing camera/orbit state (it's the same mounted scene, just
   * repositioned by the parent layout, never remounted). */
  mobileExpanded: boolean;
  onToggleMobileExpanded: () => void;
  onInspectionView: (view: "review" | "waterline" | "access" | "top" | "infinity") => void;
};

/** Shared surface for the floating viewport controls: solid white pill,
 * hairline outline, soft shadow -- one system for every control. */
const CONTROL_SURFACE =
  "pointer-events-auto inline-flex items-center rounded-full border border-hairline bg-card/95 shadow-[0_1px_2px_rgb(16_16_24/0.05),0_8px_24px_-12px_rgb(16_16_24/0.18)] transition-colors duration-200";

const INSPECTION_VIEWS = [
  { id: "review", label: "Vista d’insieme" },
  { id: "waterline", label: "Linea d’acqua" },
  { id: "access", label: "Accesso" },
  { id: "top", label: "Dall’alto" },
  { id: "infinity", label: "Bordo Infinity" },
] as const;

function ToolButton({
  active = false,
  disabled = false,
  onClick,
  icon,
  label,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] transition-colors duration-200 disabled:pointer-events-none disabled:opacity-35 [&_svg]:size-3.5 [&_svg]:stroke-[1.4]",
        active
          ? "bg-brand-soft text-brand"
          : "text-foreground/70 hover:bg-foreground/[0.04] hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

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
  technicalPlan,
  onToggleTechnicalView,
  onTechnicalFocus,
  onToggleMeasurements,
  onReframe,
  onTogglePhotoMode,
  onSetPhotoModeQuality,
  photoModeUnsupported,
  onGeneratePhotorealisticRender,
  premiumPresentationAvailable,
  renderPhase,
  renderProgress,
  mobileExpanded,
  onToggleMobileExpanded,
  onInspectionView,
  ...scene
}: ViewportProps) {
  const samples = usePhotoModeSamples();
  const exportReady = scene.photoMode && samples >= PHOTO_MODE_EXPORT_READY_SAMPLES;
  const renderButtonLabel =
    renderPhase === "rendering"
      ? renderProgress
        ? `Rendering… ${Math.round((renderProgress.current / renderProgress.total) * 100)}%`
        : "Rendering…"
      : renderPhase === "complete"
        ? "Download Render"
        : renderPhase === "error"
          ? "Retry Photorealistic Render"
          : "Generate Photorealistic Render";

  return (
    <div className="relative h-full w-full overflow-hidden bg-viewport">
      <ClientOnly fallback={<ViewportFallback />}>
        <Suspense fallback={<ViewportFallback />}>
          <PoolScene {...scene} />
        </Suspense>
      </ClientOnly>
      {scene.construction && <div key={`${scene.construction.stage}-${scene.construction.structure}`}
        aria-hidden className="pointer-events-none absolute inset-0 z-[1] bg-viewport animate-[construction-reveal_240ms_ease-out_both] motion-reduce:hidden" />}

      <div className="absolute left-3 top-3 z-10 sm:left-4 sm:top-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Vista della piscina"
              className={cn(CONTROL_SURFACE, "h-9 gap-1.5 pl-3 pr-2.5 text-[12px] text-foreground/85 hover:text-foreground")}
            >
              <Eye className="size-3.5 text-muted-foreground" strokeWidth={1.4} aria-hidden />
              Vista piscina
              <ChevronDown className="size-3.5 text-muted-foreground" strokeWidth={1.4} aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={6} className="min-w-44 rounded-2xl p-1.5">
            {INSPECTION_VIEWS.filter((view) => view.id !== "infinity" || scene.system === "infinity").map((view) => (
              <DropdownMenuItem
                key={view.id}
                onSelect={() => onInspectionView(view.id)}
                className="rounded-xl px-3 py-2 text-[12.5px]"
              >
                {view.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {scene.construction?.label && !scene.technicalView ? <div key={scene.construction.label}
        className="pointer-events-none absolute right-3 top-16 z-10 max-w-[75%] animate-veil rounded-xl border border-hairline bg-card/95 px-3 py-2 text-[11px] text-foreground"
        role="status" data-testid="construction-stage">
        {scene.construction.label}
      </div> : null}
      {scene.technicalView && !scene.photoMode ? <div className="pointer-events-auto absolute right-3 top-3 z-10 w-36 sm:max-h-[58%] sm:w-[260px] sm:overflow-y-auto sm:rounded-2xl sm:shadow-lg">
        <div className="hidden sm:block"><TechnicalDataPanel technical={technicalPlan} cover={scene.coverPlan} compact /></div>
        <label className="sr-only" htmlFor="technical-focus">Dettaglio tecnico</label>
        <select id="technical-focus" aria-label="Dettaglio tecnico" defaultValue="" onChange={(event) => onTechnicalFocus(event.target.value as VisualFocus)} className="mt-1 min-h-11 w-full rounded-xl border border-hairline bg-card px-3 text-xs text-foreground">
          <option value="" disabled>Esamina componente</option>
          {scene.system === "skimmer" ? <option value="TECHNICAL_SKIMMER">Skimmer</option> : <option value="TECHNICAL_OVERFLOW">Bordo e raccolta</option>}
          <option value="TECHNICAL_RETURNS" disabled>Mandate · da progettare</option>
          <option value="TECHNICAL_DRAINS" disabled>Scarichi · da progettare</option>
          {scene.coverPlan.enabled && scene.coverPlan.geometry ? <option value="TECHNICAL_COVER">Copertura</option> : null}
        </select>
      </div> : null}

      {scene.photoMode ? <PhotoModeStatus samples={samples} /> : null}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-6 p-4 sm:p-5">
        <p className="hidden pb-2 text-[10px] tracking-[0.02em] text-muted-foreground/55 sm:block">
          {scene.photoMode
            ? "Path-traced preview — camera locked while refining"
            : scene.cameraLocked
              ? "Camera locked · Live 3D"
              : "Trascina per ruotare · Scorri per lo zoom · Tasto destro per spostare"}
        </p>
        {/* Compact mobile row: only the actions a customer needs on every
            visit stay directly on screen (reframe, expand); Guides, Photo
            Mode and the Blender render are advanced/rare here, so they move
            into the "More" menu instead of eating the small viewport. */}
        <div className="pointer-events-auto ml-auto flex items-center justify-end gap-2 sm:hidden">
          <div className={cn(CONTROL_SURFACE, "h-10 gap-0.5 p-1")}>
            <ToolButton onClick={onReframe} icon={<Focus />} label="Riquadra" />
            <span aria-hidden className="mx-0.5 h-4 w-px bg-hairline" />
            <button
              type="button"
              onClick={onToggleMobileExpanded}
              aria-label={mobileExpanded ? "Chiudi piscina espansa" : "Espandi piscina"}
              title={mobileExpanded ? "Chiudi piscina espansa" : "Espandi piscina"}
              className="inline-flex size-8 items-center justify-center rounded-full text-foreground/70 hover:text-foreground [&_svg]:size-3.5 [&_svg]:stroke-[1.4]"
            >
              {mobileExpanded ? <Shrink /> : <Expand />}
            </button>
          </div>
          {scene.photoMode ? (
            <Button type="button" variant="viewportActive" size="sm" onClick={onTogglePhotoMode}>
              <Camera />
              Live
            </Button>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Altri strumenti"
                className={cn(CONTROL_SURFACE, "size-10 justify-center text-foreground/70 hover:text-foreground [&_svg]:size-4 [&_svg]:stroke-[1.4]")}
              >
                <MoreHorizontal />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {scene.photoMode ? (
                <>
                  <DropdownMenuItem onSelect={() => onSetPhotoModeQuality("standard")}>
                    Qualità standard{scene.photoModeQuality === "standard" ? " ✓" : ""}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onSetPhotoModeQuality("high")}>
                    Qualità alta{scene.photoModeQuality === "high" ? " ✓" : ""}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!exportReady}
                    onSelect={() => {
                      photoModeState.exportRequestId += 1;
                    }}
                  >
                    Genera foto
                    {!exportReady ? ` (ancora ${PHOTO_MODE_EXPORT_READY_SAMPLES}+ campioni)` : ""}
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem onSelect={onToggleMeasurements}>
                    {scene.showMeasurements ? "Nascondi guide" : "Mostra guide"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={onToggleTechnicalView}>
                    {scene.technicalView ? "Chiudi vista tecnica" : "Vista tecnica"}
                  </DropdownMenuItem>
                  {premiumPresentationAvailable ? <DropdownMenuItem onSelect={onGeneratePhotorealisticRender}>
                    Premium Visualization · prepara
                  </DropdownMenuItem> : null}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="pointer-events-auto ml-auto hidden flex-wrap items-center justify-end gap-2 sm:flex">
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
          <div role="toolbar" aria-label="Strumenti vista" className={cn(CONTROL_SURFACE, "h-10 gap-0.5 p-1")}>
            <ToolButton
              active={scene.showMeasurements}
              onClick={onToggleMeasurements}
              disabled={scene.photoMode}
              icon={<Ruler />}
              label="Guide"
            />
            <ToolButton
              active={scene.technicalView ?? false}
              onClick={onToggleTechnicalView}
              disabled={scene.photoMode}
              icon={<Layers />}
              label="Vista tecnica"
            />
            <span aria-hidden className="mx-0.5 h-4 w-px bg-hairline" />
            <ToolButton onClick={onReframe} icon={<Focus />} label="Riquadra" />
          </div>
          {scene.photoMode || !premiumPresentationAvailable ? null : (
            <Button
              type="button"
              variant={renderPhase === "complete" ? "viewportActive" : "viewport"}
              size="sm"
              onClick={onGeneratePhotorealisticRender}
              title="Prepara l’ambiente della futura vista fotografica; rendering non ancora disponibile"
            >
              {renderPhase === "rendering" ? (
                <>
                  <Loader2 className="animate-spin" />
                  {renderProgress
                    ? `Rendering… ${Math.round((renderProgress.current / renderProgress.total) * 100)}%`
                    : "Rendering…"}
                  <X className="size-3.5" strokeWidth={1.5} />
                </>
              ) : renderPhase === "complete" ? (
                <>
                  <Download />
                  Download Render
                </>
              ) : (
                <>
                  <Aperture />
                  {renderPhase === "error"
                    ? "Retry Photorealistic Render"
                    : "Premium Visualization"}
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
});
