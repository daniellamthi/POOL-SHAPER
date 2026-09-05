import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RENOVATION_STEPS, STEPS } from "@/lib/pool/config";
import { useConfigurator } from "@/lib/pool/context";
import { ConfiguratorProvider } from "@/lib/pool/store";
import { resolveMaterials } from "@/lib/pool/materials";
import { ThemeProvider, useTheme } from "@/lib/theme";
import {
  cancelRenderJob,
  downloadPhotorealisticRenderJob,
  getRenderOutputUrl,
  isRenderBridgeAvailable,
  preparePhotorealisticRenderJob,
  runPhotorealisticRender,
  serializePoolRenderConfig,
  type RenderJobStatus,
} from "@/lib/render-pipeline";
import { ProjectTypeStep } from "@/configurator/steps/project-type";
import { PoolTypeStep } from "@/configurator/steps/pool-type";
import { PoolStructureStep } from "@/configurator/steps/pool-structure";
import { PoolShapeStep } from "@/configurator/steps/pool-shape";
import { PoolSystemStep } from "@/configurator/steps/pool-system";
import { InteriorFinishStep } from "@/configurator/steps/interior-finish";
import { PoolFeaturesStep } from "@/configurator/steps/pool-features";
import { EquipmentStep } from "@/configurator/steps/equipment";
import { ContactDetailsStep } from "@/configurator/steps/contact-details";
import { FinalReviewStep } from "@/configurator/steps/final-review";
import {
  RenovationCustomerStep,
  RenovationDetailsStep,
  RenovationPoolStep,
  RenovationReviewStep,
  RenovationScopeStep,
} from "@/configurator/steps/renovation";
import { BrandLogo } from "./BrandLogo";
import { PoolViewport } from "./PoolViewport";
import { ThemeToggle } from "./ThemeToggle";
import { StepIndicator } from "./StepIndicator";
import { LiveSummary } from "./LiveSummary";
import type { SceneFocus, PhotoModeQuality } from "./three/PoolScene";

const STEP_COMPONENTS = [
  ProjectTypeStep,
  PoolTypeStep,
  PoolStructureStep,
  PoolShapeStep,
  PoolSystemStep,
  InteriorFinishStep,
  PoolFeaturesStep,
  EquipmentStep,
  ContactDetailsStep,
  FinalReviewStep,
] as const;

/**
 * Brief automotive/architectural-style entrance -- logo + wordmark settle in,
 * then the whole veil dissolves into the already-mounted wizard underneath.
 * Purely presentational (no store/wizard state involved) and fully honours
 * prefers-reduced-motion: the global reduced-motion rule in styles.css
 * collapses every animation/transition duration to ~0, so the timers below
 * still fire but the veil never visibly holds the screen.
 */
function IntroVeil() {
  const [stage, setStage] = useState<"in" | "out" | "done">("in");

  useEffect(() => {
    const leave = window.setTimeout(() => setStage("out"), 950);
    const remove = window.setTimeout(() => setStage("done"), 1250);
    return () => {
      window.clearTimeout(leave);
      window.clearTimeout(remove);
    };
  }, []);

  if (stage === "done") return null;

  return (
    <div
      aria-hidden
      className={cn(
        "fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background transition-opacity duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
        stage === "out" ? "pointer-events-none opacity-0" : "opacity-100",
      )}
    >
      <BrandLogo className="h-10 w-auto animate-intro-mark" />
      <p className="label-xs animate-veil [animation-delay:200ms]">
        Configuratore Piscine Wellness
      </p>
    </div>
  );
}

const RENOVATION_COMPONENTS = [
  ProjectTypeStep,
  RenovationScopeStep,
  RenovationPoolStep,
  RenovationDetailsStep,
  RenovationCustomerStep,
  RenovationReviewStep,
] as const;

function ConfiguratorLayout() {
  const {
    config,
    outline,
    skimmers,
    step,
    next,
    previous,
    goToStep,
    reset,
    canContinue,
    isStepComplete,
  } = useConfigurator();
  const { theme } = useTheme();
  const materials = useMemo(
    () =>
      resolveMaterials({
        finish: config.finish,
        linerColor: config.linerColor,
        mosaicFinish: config.mosaicFinish,
        skimmerFinish: config.skimmerFinish,
      }),
    [config.finish, config.linerColor, config.mosaicFinish, config.skimmerFinish],
  );

  const [showMeasurements, setShowMeasurements] = useState(true);
  const [frameToken, setFrameToken] = useState(0);
  const [photoMode, setPhotoMode] = useState(false);
  const [photoModeQuality, setPhotoModeQuality] = useState<PhotoModeQuality>("standard");
  // Set once the path tracer has proven it can't run on this device (no
  // WebGL2, or WebGLPathTracer threw during setup -- see
  // PhotoModeRenderer's onUnsupported). Sticky for the rest of the session:
  // once known unsupported, the toggle stays disabled instead of letting
  // the user retry into the same failure repeatedly.
  const [photoModeUnsupported, setPhotoModeUnsupported] = useState(false);
  const toggleMeasurements = useCallback(() => setShowMeasurements((value) => !value), []);
  const reframe = useCallback(() => setFrameToken((value) => value + 1), []);
  const togglePhotoMode = useCallback(() => {
    if (photoModeUnsupported) return;
    setPhotoMode((value) => !value);
  }, [photoModeUnsupported]);
  // PhotoModeRenderer's setup effect can genuinely run more than once for a
  // single user click (e.g. an intervening re-render changing
  // `photoModeSceneKey` remounts it before the first attempt's failure is
  // even reported). A `useCallback` closure can't guard against that with
  // `photoModeUnsupported` alone -- it's created once and never sees the
  // updated value -- so a ref-backed one-shot latch ensures the toast fires
  // exactly once instead of a second call re-triggering (and visually
  // cutting short) the first toast's animation.
  const hasReportedUnsupported = useRef(false);
  const handlePhotoModeUnsupported = useCallback(() => {
    if (hasReportedUnsupported.current) return;
    hasReportedUnsupported.current = true;
    setPhotoModeUnsupported(true);
    setPhotoMode(false);
    toast.error("Photo Mode isn't supported on this device", {
      description: "The live 3D view is unaffected -- keep configuring as normal.",
    });
  }, []);

  // "Generate Photorealistic Render" -- hands the current configuration to
  // the separate Blender/Cycles pipeline (see src/lib/render-pipeline/ and
  // rendering/blender/). This app deploys to Cloudflare Workers, which
  // cannot run Blender itself, so the real render runs through the local
  // dev bridge (scripts/render-bridge.mjs, `npm run render-bridge`) when
  // it's reachable; without it, this falls back to exporting the validated
  // JSON + the exact CLI command, exactly as before. Either way it never
  // touches the live Three.js scene or blocks the configurator.
  type RenderPhase = "idle" | "rendering" | "complete" | "error";
  const [renderPhase, setRenderPhase] = useState<RenderPhase>("idle");
  const [renderProgress, setRenderProgress] = useState<RenderJobStatus["progress"]>(null);
  const [renderJobId, setRenderJobId] = useState<string | null>(null);
  const renderAbortRef = useRef<AbortController | null>(null);

  const downloadRenderedPng = useCallback((jobId: string) => {
    const link = document.createElement("a");
    link.href = getRenderOutputUrl(jobId);
    link.download = `pool-render-${jobId}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const handleGeneratePhotorealisticRender = useCallback(async () => {
    if (renderPhase === "rendering") {
      renderAbortRef.current?.abort();
      if (renderJobId) void cancelRenderJob(renderJobId);
      setRenderPhase("idle");
      setRenderProgress(null);
      toast.info("Render cancelled");
      return;
    }
    if (renderPhase === "complete" && renderJobId) {
      downloadRenderedPng(renderJobId);
      return;
    }

    let job;
    try {
      const renderConfig = serializePoolRenderConfig({ config, outline, skimmers, theme });
      job = preparePhotorealisticRenderJob(renderConfig);
    } catch (error) {
      console.error("[PhotorealisticRender] invalid render config", error);
      toast.error("Couldn't prepare the render config", {
        description: error instanceof Error ? error.message : "Unknown error.",
      });
      return;
    }

    const bridgeUp = await isRenderBridgeAvailable();
    if (!bridgeUp) {
      downloadPhotorealisticRenderJob(job);
      toast.info("Local render bridge isn't running", {
        description: `Start it with "npm run render-bridge", or run manually: ${job.cyclesCommand}`,
        duration: 15000,
      });
      return;
    }

    setRenderPhase("rendering");
    setRenderProgress(null);
    setRenderJobId(null);
    const controller = new AbortController();
    renderAbortRef.current = controller;

    try {
      const jobId = await runPhotorealisticRender(job.config, {
        signal: controller.signal,
        onProgress: (status) => setRenderProgress(status.progress),
      });
      // The user's own Cancel click already reset the UI and told them --
      // this response is racing in after that, so it must not resurrect a
      // finished-looking state (or a stray "complete" toast) over it.
      if (controller.signal.aborted) return;
      setRenderJobId(jobId);
      setRenderPhase("complete");
      toast.success("Render complete", { description: "Your photorealistic render is ready." });
    } catch (error) {
      if (controller.signal.aborted) return;
      setRenderPhase("error");
      console.error("[PhotorealisticRender] render failed", error);
      toast.error("Render failed", {
        description: error instanceof Error ? error.message : "Unknown error.",
      });
    }
  }, [config, outline, skimmers, theme, renderPhase, renderJobId, downloadRenderedPng]);

  const renovationWorkflow = config.projectType === "renovation";
  const activeSteps = renovationWorkflow ? RENOVATION_STEPS : STEPS;
  const components = renovationWorkflow ? RENOVATION_COMPONENTS : STEP_COMPONENTS;
  const StepComponent = components[step] ?? ProjectTypeStep;
  const isLast = step === activeSteps.length - 1;
  const activeStepId = activeSteps[step]?.id;
  const cameraFocus: SceneFocus = renovationWorkflow
    ? "overview"
    : activeStepId === "system"
      ? config.system
      : activeStepId === "finish" || activeStepId === "color"
        ? config.finish === "mosaic"
          ? "mosaic"
          : "liner"
        : activeStepId === "review"
          ? "review"
          : "overview";
  const stepContent =
    !renovationWorkflow && activeStepId === "system" ? (
      <PoolSystemStep onSkimmerSelect={reframe} />
    ) : (
      <StepComponent />
    );

  return (
    <div className="flex min-h-screen flex-col bg-background lg:h-screen lg:overflow-hidden">
      <IntroVeil />
      <header className="z-20 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-8 border-b border-hairline bg-background/90 px-6 py-4 backdrop-blur-sm sm:px-9">
        <div className="flex min-w-0 items-center">
          <BrandLogo className="h-8 max-w-[112px]" />
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button type="button" variant="ghost" size="sm" onClick={reset} className="rounded-full px-3">
            <RotateCcw />
            <span className="hidden sm:inline">Reset</span>
          </Button>
        </div>
      </header>

      <div className="flex flex-1 flex-col-reverse gap-3 p-3 lg:min-h-0 lg:flex-row lg:p-4">
        <aside className="relative z-10 flex w-full flex-col rounded-[1.75rem] border border-hairline bg-background/95 shadow-[0_30px_80px_-44px_rgba(0,0,0,0.85)] lg:w-[452px] xl:w-[512px]">
          <div className="border-b border-hairline/80 px-5 pb-6 pt-6 sm:px-8">
            <StepIndicator
              current={step}
              steps={activeSteps}
              isStepComplete={isStepComplete}
              onSelect={goToStep}
            />
          </div>

          <div className="scroll-slim flex-1 overflow-y-auto px-5 pb-18 pt-8 sm:px-8 lg:min-h-0">
            {stepContent}
          </div>

          <div className="flex items-center justify-between gap-6 border-t border-hairline bg-background/60 px-5 py-5 sm:px-8">
            <Button
              type="button"
              variant="ghost"
              onClick={previous}
              disabled={step === 0}
              className="px-0 hover:bg-transparent"
            >
              <ArrowLeft />
              <span className="hidden sm:inline">Back</span>
            </Button>
            <Button
              type="button"
              onClick={next}
              disabled={isLast || !canContinue}
              title={canContinue ? undefined : "Complete this step to continue"}
              className="px-6"
            >
              Continue
              <ArrowRight className="size-3.5" strokeWidth={1.5} />
            </Button>
          </div>
        </aside>

        <main className="relative h-[46vh] w-full min-h-[320px] overflow-hidden rounded-[1.75rem] border border-hairline bg-viewport sm:h-[54vh] lg:h-auto lg:flex-1">
          <PoolViewport
            outline={outline}
            shape={config.shape}
            system={config.system}
            overflowType={config.overflowType}
            poolType={config.poolType ?? "in-ground"}
            materials={materials}
            features={config.features}
            skimmers={skimmers}
            length={config.dimensions.length}
            width={config.dimensions.width}
            depth={config.dimensions.depth}
            showMeasurements={showMeasurements}
            onToggleMeasurements={toggleMeasurements}
            onReframe={reframe}
            frameToken={frameToken}
            focus={cameraFocus}
            showWater={renovationWorkflow || activeStepId !== "finish"}
            theme={theme}
            photoMode={photoMode}
            onTogglePhotoMode={togglePhotoMode}
            photoModeQuality={photoModeQuality}
            onSetPhotoModeQuality={setPhotoModeQuality}
            photoModeUnsupported={photoModeUnsupported}
            onPhotoModeUnsupported={handlePhotoModeUnsupported}
            onGeneratePhotorealisticRender={handleGeneratePhotorealisticRender}
            renderPhase={renderPhase}
            renderProgress={renderProgress}
          />
          <LiveSummary />
        </main>
      </div>
    </div>
  );
}

export function PoolConfigurator() {
  return (
    <ThemeProvider>
      <ConfiguratorProvider>
        <ConfiguratorLayout />
      </ConfiguratorProvider>
    </ThemeProvider>
  );
}
