import { useI18n } from "@/lib/i18n";
import { lazy, memo, Suspense, useEffect, useRef, useState } from "react";
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
import type { SceneProps, PhotoModeQuality, CameraRecoveryState } from "./three/PoolScene";
import { TechnicalDataPanel } from "./TechnicalDataPanel";
import type { TechnicalPlan } from "@/lib/pool/technical-plan";
import type { VisualFocus } from "@/lib/pool/contextual-camera";

const GardenPhotoStudio = lazy(() => import("./GardenPhotoStudio"));
const PoolScene = lazy(() => import("./three/PoolScene"));

type ViewportProps = SceneProps & {
  gardenStudio: boolean;
  gardenProjectId: string;
  onCloseGardenStudio: () => void;
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
  onInspectionView: (view: InspectionView) => void;
};

/** Shared surface for the floating viewport controls: solid white pill,
 * hairline outline, soft shadow -- one system for every control. */
const CONTROL_SURFACE =
  "pointer-events-auto inline-flex items-center rounded-full border border-hairline bg-card/95 shadow-[0_1px_2px_rgb(16_16_24/0.05),0_8px_24px_-12px_rgb(16_16_24/0.18)] transition-colors duration-200";

const INSPECTION_VIEWS = [
  { id: "review", label: "Vista d’insieme" },
  { id: "elevation-long", label: "Prospetto lato lungo" },
  { id: "elevation-short", label: "Prospetto lato corto" },
  { id: "waterline", label: "Linea d’acqua" },
  { id: "access", label: "Accesso" },
  { id: "top", label: "Dall’alto" },
  { id: "infinity", label: "Bordo Infinity" },
] as const;
export type InspectionView = (typeof INSPECTION_VIEWS)[number]["id"];

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
  const { t } = useI18n();
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
      {t(label)}
    </button>
  );
}

function ViewportFallback() {
  const { t } = useI18n();
  return (
    <div className="flex h-full w-full items-center justify-center bg-viewport">
      <div className="animate-veil flex flex-col items-center gap-5">
        <span className="size-6 animate-spin rounded-full border border-border border-t-foreground/70" />
        <p className="label-xs">{t("Preparazione della scena 3D")}</p>
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
function usePhotoModeSamples(sessionKey: string | null) {
  const [snapshot, setSnapshot] = useState({ sessionKey, samples: 0, preparing: true, contextLost: false });
  useEffect(() => {
    if (sessionKey === null) return;
    const id = window.setInterval(() => {
      const next = {
        sessionKey,
        samples: Math.floor(photoModeState.samples),
        preparing: !photoModeState.active || photoModeState.preparing || photoModeState.contextLost,
        contextLost: photoModeState.contextLost,
      };
      setSnapshot(previous => previous.sessionKey === next.sessionKey && previous.samples === next.samples &&
        previous.preparing === next.preparing && previous.contextLost === next.contextLost ? previous : next);
    }, 200);
    return () => window.clearInterval(id);
  }, [sessionKey]);
  // A new render must be covered immediately, before the first polling tick.
  // A completed previous session must never briefly expose unfinished tiles.
  if (sessionKey === null || snapshot.sessionKey !== sessionKey) return { samples: 0, preparing: sessionKey !== null, contextLost: false };
  return snapshot;
}

function PhotoModeStatus({ samples, preparing, contextLost, onRetry, onCancel }: { samples: number; preparing: boolean; contextLost: boolean; onRetry: () => void; onCancel: () => void }) {
  const { t } = useI18n();
  const percent = Math.max(0, Math.min(100, Math.floor(samples / PHOTO_MODE_EXPORT_READY_SAMPLES * 100)));
  const loading = contextLost || preparing || samples < PHOTO_MODE_EXPORT_READY_SAMPLES;
  const loadingRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!loading) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    loadingRef.current?.focus({ preventScroll: true });
    return () => { if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, [loading]);
  if (loading) return (
    <div ref={loadingRef} data-photo-loading role="dialog" aria-modal="true" aria-label={t("Preparazione foto…")} tabIndex={-1}
      className="absolute inset-0 z-30 flex items-center justify-center bg-neutral-950 px-8 text-white outline-none"
      onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); onCancel(); }
        if (event.key === "Tab") {
          event.preventDefault();
          (loadingRef.current?.querySelector<HTMLButtonElement>("button") ?? loadingRef.current)?.focus();
        }
      }}>
      {contextLost ? <div role="status" className="max-w-sm text-center text-sm text-white/80">
        <p>{t("Rendering in pausa. Premi Riprova per riprendere.")}</p>
        <Button type="button" variant="viewport" size="sm" className="mt-4" onClick={onRetry}>{t("Riprova")}</Button>
      </div> : <div className="w-full max-w-xs">
        <div className="mb-4 text-center">
          <span data-photo-progress aria-hidden="true" className="text-2xl font-light tabular-nums tracking-tight text-white/90">{percent}%</span>
        </div>
        <div role="progressbar" aria-label={t("Preparazione foto…")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}
          className="h-px w-full overflow-hidden bg-white/15">
          <div className="h-full w-full origin-left bg-white/85 transition-transform duration-200 motion-reduce:transition-none" style={{ transform: `scaleX(${percent / 100})` }} />
        </div>
      </div>}
    </div>
  );
  return <p data-photo-progress className="pointer-events-none absolute left-1/2 top-[calc(var(--pool-header-height,0px)+4.5rem)] z-20 max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-full border border-hairline bg-background/95 px-4 py-2 text-center text-xs text-foreground shadow-sm">{t("Foto pronta da scaricare")}</p>;
}

function QualityPicker({
  quality,
  onChange,
}: {
  quality: PhotoModeQuality;
  onChange: (quality: PhotoModeQuality) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="pointer-events-auto flex gap-2">
      <Button
        type="button"
        variant={quality === "standard" ? "viewportActive" : "viewport"}
        size="sm"
        onClick={() => onChange("standard")}
        title={t("Faster convergence, tuned bounce count -- see docs/PHOTO_MODE.md")}
      >
        {t("Standard")}</Button>
      <Button
        type="button"
        variant={quality === "high" ? "viewportActive" : "viewport"}
        size="sm"
        onClick={() => onChange("high")}
        title={t("Path tracer's own defaults -- slower to converge")}
      >
        {t("High")}</Button>
    </div>
  );
}

export const PoolViewport = memo(function PoolViewport({
  gardenStudio, gardenProjectId, onCloseGardenStudio,
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
  const { t } = useI18n();
  const [graphicsGeneration, setGraphicsGeneration] = useState(0);
  const cameraRecovery = useRef<CameraRecoveryState>({ capture: null, pending: null });
  const retryGraphics = () => {
    cameraRecovery.current.pending ??= cameraRecovery.current.capture?.() ?? null;
    setGraphicsGeneration(value => value + 1);
  };
  const { samples, preparing, contextLost } = usePhotoModeSamples(scene.photoMode ? `${scene.photoModeQuality}:${graphicsGeneration}` : null);
  const photoLoading = scene.photoMode && (preparing || contextLost || samples < PHOTO_MODE_EXPORT_READY_SAMPLES);
  const exportReady = scene.photoMode && !preparing && samples >= PHOTO_MODE_EXPORT_READY_SAMPLES;
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

  if (gardenStudio) return <Suspense fallback={<ViewportFallback />}><GardenPhotoStudio key={gardenProjectId}
    projectId={gardenProjectId} poolLength={scene.length} poolWidth={scene.width} onClose={onCloseGardenStudio}
    renderScene={sitePhotoView => <Suspense fallback={<ViewportFallback />}><PoolScene {...scene}
      sitePhotoView={sitePhotoView} photoMode={false} cleanCapture cameraLocked focus="review"
      showMeasurements={false} technicalView={false}
    /></Suspense>} /></Suspense>;

  return (
    <div data-architectural-plan={scene.focus === "top" && scene.poolType === "in-ground" && !scene.photoMode ? scene.technicalView ? "technical" : "true" : undefined}
      className="relative h-full w-full overflow-hidden bg-viewport">
      <ClientOnly fallback={<ViewportFallback />}>
        <Suspense fallback={<ViewportFallback />}>
          <PoolScene key={graphicsGeneration} {...scene} cameraRecovery={cameraRecovery} />
        </Suspense>
      </ClientOnly>
      {scene.construction && <div key={`${scene.construction.stage}-${scene.construction.structure}`}
        aria-hidden className="pointer-events-none absolute inset-0 z-[1] bg-viewport animate-[construction-reveal_240ms_ease-out_both] motion-reduce:hidden" />}

      <div data-viewport-view-menu inert={photoLoading} aria-hidden={photoLoading || undefined} className="absolute left-3 top-3 z-10 sm:left-4 sm:top-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              data-camera-occluder="view-menu"
              aria-label={t("Vista della piscina")}
              className={cn(CONTROL_SURFACE, "h-9 gap-1.5 pl-3 pr-2.5 text-[12px] text-foreground/85 hover:text-foreground")}
            >
              <Eye className="size-3.5 text-muted-foreground" strokeWidth={1.4} aria-hidden />
              {t("Vista piscina")}<ChevronDown className="size-3.5 text-muted-foreground" strokeWidth={1.4} aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={6} className="min-w-44 rounded-2xl p-1.5">
            {INSPECTION_VIEWS.filter(
              (view) =>
                (view.id !== "infinity" || scene.system === "infinity") &&
                (!view.id.startsWith("elevation") || scene.poolType === "above-ground"),
            ).map((view) => (
              <DropdownMenuItem
                key={view.id}
                onSelect={() => onInspectionView(view.id)}
                className="rounded-xl px-3 py-2 text-[12.5px]"
              >
                {t(view.label)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {scene.construction?.label && !scene.technicalView ? <div key={scene.construction.label}
        className="pointer-events-none absolute right-3 top-16 z-10 max-w-[75%] animate-veil rounded-xl border border-hairline bg-card/95 px-3 py-2 text-[11px] text-foreground"
        role="status" data-testid="construction-stage">
        {t(scene.construction.label)}
      </div> : null}
      {scene.technicalView && !scene.photoMode ? <div data-technical-panel className="pointer-events-auto absolute right-3 top-3 z-10 w-36 sm:max-h-[58%] sm:w-[260px] sm:overflow-y-auto sm:rounded-2xl sm:shadow-lg">
        <div className="hidden sm:block"><TechnicalDataPanel technical={technicalPlan} cover={scene.coverPlan} compact /></div>
        <label className="sr-only" htmlFor="technical-focus">{t("Dettaglio tecnico")}</label>
        <select id="technical-focus" aria-label={t("Dettaglio tecnico")} defaultValue="" onChange={(event) => onTechnicalFocus(event.target.value as VisualFocus)} className="mt-1 min-h-11 w-full rounded-xl border border-hairline bg-card px-3 text-xs text-foreground">
          <option value="" disabled>{t("Esamina componente")}</option>
          {scene.system === "skimmer" ? <option value="TECHNICAL_SKIMMER">{t("Skimmer")}</option> : <option value="TECHNICAL_OVERFLOW">{t("Bordo e raccolta")}</option>}
          <option value="TECHNICAL_RETURNS" disabled>{t("Mandate · da progettare")}</option>
          <option value="TECHNICAL_DRAINS" disabled>{t("Scarichi · da progettare")}</option>
          {scene.coverPlan.enabled && scene.coverPlan.geometry ? <option value="TECHNICAL_COVER">{t("Copertura")}</option> : null}
        </select>
      </div> : null}

      {scene.photoMode ? <PhotoModeStatus samples={samples} preparing={preparing} contextLost={contextLost} onRetry={retryGraphics} onCancel={onTogglePhotoMode} /> : null}

      <div data-viewport-toolbar inert={photoLoading} aria-hidden={photoLoading || undefined} className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-6 p-4 sm:p-5">
        <p className="hidden pb-2 text-[10px] tracking-[0.02em] text-muted-foreground/55 sm:block">
          {t(scene.photoMode
            ? "Path-traced preview — camera locked while refining"
            : scene.cameraLocked
              ? "Camera locked · Live 3D"
              : "Trascina per ruotare · Scorri per lo zoom · Tasto destro per spostare")}
        </p>
        {/* Compact mobile row: only the actions a customer needs on every
            visit stay directly on screen (reframe, expand); Guides, Photo
            Mode and the Blender render are advanced/rare here, so they move
            into the "More" menu instead of eating the small viewport. */}
        <div data-camera-occluder="mobile-view-tools" className="pointer-events-auto ml-auto flex items-center justify-end gap-2 sm:hidden">
          <div className={cn(CONTROL_SURFACE, "h-10 gap-0.5 p-1")}>
            <ToolButton onClick={onReframe} icon={<Focus />} label={t("Riquadra")} />
            <span aria-hidden className="mx-0.5 h-4 w-px bg-hairline" />
            <button
              type="button"
              onClick={onToggleMobileExpanded}
              data-camera-occluder={!mobileExpanded ? "expand" : undefined}
              aria-label={t(mobileExpanded ? "Chiudi piscina espansa" : "Espandi piscina")}
              title={t(mobileExpanded ? "Chiudi piscina espansa" : "Espandi piscina")}
              className="inline-flex size-8 items-center justify-center rounded-full text-foreground/70 hover:text-foreground [&_svg]:size-3.5 [&_svg]:stroke-[1.4]"
            >
              {mobileExpanded ? <Shrink /> : <Expand />}
            </button>
          </div>
          {scene.photoMode ? (
            <Button type="button" variant="viewportActive" size="sm" onClick={onTogglePhotoMode}>
              <Camera />
              {t("Live")}</Button>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                data-camera-occluder="more-tools"
                aria-label={t("Altri strumenti")}
                className={cn(CONTROL_SURFACE, "size-10 justify-center text-foreground/70 hover:text-foreground [&_svg]:size-4 [&_svg]:stroke-[1.4]")}
              >
                <MoreHorizontal />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {scene.photoMode ? (
                <>
                  <DropdownMenuItem onSelect={() => onSetPhotoModeQuality("standard")}>
                    {t("Qualità standard")}{t(scene.photoModeQuality === "standard" ? " ✓" : "")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onSetPhotoModeQuality("high")}>
                    {t("Qualità alta")}{t(scene.photoModeQuality === "high" ? " ✓" : "")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!exportReady}
                    onSelect={() => {
                      if (!photoModeState.preparing && !photoModeState.contextLost) photoModeState.exportRequestId += 1;
                    }}
                  >
                    {t(exportReady ? "Genera foto" : "Preparazione foto…")}
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem onSelect={onToggleMeasurements}>
                    {t(scene.showMeasurements ? "Nascondi guide" : "Mostra guide")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={onToggleTechnicalView}>
                    {t(scene.technicalView ? "Chiudi vista tecnica" : "Vista tecnica")}
                  </DropdownMenuItem>
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
                title={t(preparing
                    ? "Preparazione foto…"
                    : exportReady ? "Save the current frame as a PNG"
                    : "L’immagine si sta affinando. Attendi che sia pronta per scaricarla.")}
                onClick={() => {
                  if (!photoModeState.preparing && !photoModeState.contextLost) photoModeState.exportRequestId += 1;
                }}
              >
                <Download />
                {t(preparing ? "Preparazione foto…" : "Generate photo")}</Button>
            </>
          ) : null}
          <div role="toolbar" data-camera-occluder="view-tools" aria-label={t("Strumenti vista")} className={cn(CONTROL_SURFACE, "h-10 gap-0.5 p-1")}>
            <ToolButton
              active={scene.showMeasurements}
              onClick={onToggleMeasurements}
              disabled={scene.photoMode}
              icon={<Ruler />}
              label={t("Guide")}
            />
            <ToolButton
              active={scene.technicalView ?? false}
              onClick={onToggleTechnicalView}
              disabled={scene.photoMode}
              icon={<Layers />}
              label={t("Vista tecnica")}
            />
            <span aria-hidden className="mx-0.5 h-4 w-px bg-hairline" />
            <ToolButton onClick={onReframe} icon={<Focus />} label={t("Riquadra")} />
          </div>
        </div>
      </div>
    </div>
  );
});
