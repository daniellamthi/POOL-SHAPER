import { exteriorPanelFinish } from "@/lib/pool/above-ground";
import { normalisedLedIntensity } from "@/lib/pool/led-optics";
import { SCENE_VISUAL_PRESET } from "@/configurator/3d/scene/visual-preset";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { RENOVATION_STEPS, STEPS } from "@/lib/pool/config";
import { ACTIVE_RENDERING_QUALITY } from "@/configurator/3d/scene/visual-preset";
import { useConfigurator } from "@/lib/pool/context";
import { ConfiguratorProvider } from "@/lib/pool/store";
import { contextualIntent, focusForAction, wholePoolIntent } from "@/lib/pool/contextual-camera";
import { resolveMaterials } from "@/lib/pool/materials";
import { constructionPresentation } from "@/lib/pool/construction-presentation";
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
import {
  RenovationCustomerStep,
  RenovationDetailsStep,
  RenovationPoolStep,
  RenovationReviewStep,
  RenovationScopeStep,
} from "@/configurator/steps/renovation";
import { BrandLogo } from "./BrandLogo";
import { PoolViewport } from "./PoolViewport";
import { useTechnicalData } from "./TechnicalDataPanel";
import type { VisualFocus } from "@/lib/pool/contextual-camera";
import { ConfiguratorTray, WizardNav } from "./wizard/WizardChrome";
import { buildMacros, describeSelection, isStepSkipped, STEP_COPY } from "./wizard/wizard-model";
import {
  AccessTray,
  DeckTray,
  FinishTray,
  LightTray,
  OptionalTray,
  PoolTypeTray,
  PresentationTray,
  ProjectTray,
  ShapeTray,
  StructureTray,
  SystemTray,
  type TrayContext,
} from "./wizard/StepTrays";
import type { SceneFocus, PhotoModeQuality, SceneTimeOfDay } from "./three/PoolScene";
import { renderQualityState } from "@/lib/pool/renderQualityState";
import { requestHeroCapture } from "@/lib/project-delivery/heroCapture";


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
  const { technical, cover } = useTechnicalData();
  const {
    config,
    outline,
    skimmers,
    step,
    visualFocus,
    next,
    previous,
    goToStep,
    reset,
    canContinue,
    isStepComplete,
    setInfinitySide,
    setSceneTime,
    justRestoredProject,
    dismissRestoredProjectNotice,
    sharedProject,
  } = useConfigurator();
  const { theme } = useTheme();

  // P4 autosave: a small, non-blocking notice -- never a modal -- offering
  // to continue the restored draft or start over. Marked handled right
  // away so it can't reopen from an unrelated re-render.
  useEffect(() => {
    if (!justRestoredProject) return;
    toast.message("Abbiamo ripristinato il tuo progetto.", {
      description: "Puoi continuare da dove avevi lasciato oppure iniziare un nuovo progetto.",
      action: { label: "Nuovo progetto", onClick: () => reset() },
      duration: 8000,
    });
    dismissRestoredProjectNotice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justRestoredProject]);
  const materials = useMemo(
    () =>
      resolveMaterials({
        finish: config.finish,
        linerColor: config.linerColor,
        mosaicFinish: config.mosaicFinish,
        skimmerFinish: config.skimmerFinish,
        skimmerType: config.skimmerType,
        copingMaterial: config.copingMaterial ?? "travertine",
      }),
    [
      config.finish,
      config.linerColor,
      config.mosaicFinish,
      config.skimmerFinish,
      config.skimmerType,
      config.copingMaterial,
    ],
  );

  // Dimension/depth editing always shows live guides; optional detail views
  // start uncluttered. Customers can still toggle Guides explicitly.
  const [showMeasurements, setShowMeasurements] = useState(false);
  const sceneTime: SceneTimeOfDay = config.sceneTime === "night" ? "night" : "day";
  // Night is contextual: the live scene shows it only while LED colours are
  // being evaluated (lighting step) or while the Project Book captures its
  // day/night pair. Everywhere else the journey stays in daylight.
  const [dayNightCapture, setDayNightCapture] = useState(false);
  const [frameToken, setFrameToken] = useState(0);
  const [inspectionView, setInspectionView] = useState<SceneFocus | null>(null);
  const [technicalView, setTechnicalView] = useState(false);
  useEffect(() => setInspectionView(null), [step, visualFocus]);
  const stepContentRef = useRef<HTMLDivElement>(null);
  // P5: mobile-only fullscreen presentation of the SAME live viewport --
  // never a second Canvas/renderer, just a CSS repositioning of the
  // existing <main>, so camera/orbit state carries over untouched.
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const toggleMobileExpanded = useCallback(() => setMobileExpanded((value) => !value), []);
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
  // Build 2 · clean hero: reframe to the whole-pool hero, let the scripted
  // flight start (the camera leaves its idle state) and settle, then capture.
  const captureHero = useCallback(async () => {
    setInspectionView("review");
    reframe();
    const started = Date.now();
    while (renderQualityState.idle && Date.now() - started < 3000) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return requestHeroCapture();
  }, [reframe]);
  /** Project Book "Presentazione": the same configuration and view, by day
   * and by night. Only the presentation time changes, and it is restored. */
  const captureDayNight = useCallback(async () => {
    const original = config.sceneTime === "night" ? "night" : "day";
    const other = original === "day" ? "night" : "day";
    setDayNightCapture(true);
    let current: string | null = null;
    let alternate: string | null = null;
    try {
      current = await captureHero();
      setSceneTime(other);
      // Let the lighting transition finish before the settled capture.
      await new Promise((resolve) =>
        setTimeout(resolve, SCENE_VISUAL_PRESET.dusk.transitionSeconds * 1000 + 600),
      );
      alternate = await requestHeroCapture();
    } finally {
      setSceneTime(original);
      setDayNightCapture(false);
    }
    return original === "day"
      ? { day: current, night: alternate }
      : { day: alternate, night: current };
  }, [captureHero, config.sceneTime, setSceneTime]);
  const premiumPresentationAvailable = step === (config.projectType === "renovation" ? RENOVATION_STEPS : STEPS).length - 1;
  const openPremiumPresentation = useCallback(() => {
    if (!premiumPresentationAvailable) return;
    document.getElementById("premium-presentation")?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [premiumPresentationAvailable]);
  useEffect(() => {
    stepContentRef.current?.scrollTo({ top: 0 });
    if (window.innerWidth < 1024) window.scrollTo({ top: 0 });
  }, [step]);
  useEffect(() => {
    if (config.projectType !== "renovation" && STEPS[step]?.id === "system") reframe();
  }, [config.projectType, config.system, config.overflowType, step, reframe]);
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
  const isLast = step === activeSteps.length - 1;
  const activeStepId = activeSteps[step]?.id;
  const construction = constructionPresentation(config, activeStepId, technicalView);
  // System details frame automatically, but remain inspectable by orbit/touch.
  const cameraLocked = false;
  const cameraFocus: SceneFocus = renovationWorkflow
    ? "overview"
    : activeStepId === "structure" || activeStepId === "project" || activeStepId === "pool-type"
      ? "structure"
      : activeStepId === "shape-dimensions"
        ? "top"
        : // System and finish open on the whole basin: the choice is about
          // the waterline and the colour of the pool, which a detail close-up
          // crops away. Clicking an option still frames its detail.
          activeStepId === "system" || activeStepId === "style"
          ? "review"
          : activeStepId === "access"
            ? contextualIntent(
                focusForAction({ type: "setPoolAccess" }, config) ?? "STAIRS",
                config,
              )
            : activeStepId === "lighting"
              ? config.system === "infinity"
                ? "infinity"
                : "features"
              : "review";

  // ---- New wizard navigation: nine macro steps, skipped empty steps ----
  const macros = useMemo(
    () =>
      renovationWorkflow
        ? RENOVATION_STEPS.map((s, index) => ({
            id: s.id,
            label: s.short,
            indices: [index],
            complete: index < step && isStepComplete(index),
            reachable: index <= step || isStepComplete(Math.max(0, index - 1)),
          }))
        : buildMacros(config, step, isStepComplete),
    [renovationWorkflow, config, step, isStepComplete],
  );
  const macroIndex = Math.max(
    0,
    macros.findIndex((m) => m.indices.includes(step)),
  );
  const macro = macros[macroIndex];
  const skipped = (index: number) =>
    !renovationWorkflow && isStepSkipped(activeSteps[index]?.id, config);
  const goNext = useCallback(() => {
    let target = step + 1;
    while (target < activeSteps.length - 1 && skipped(target)) target += 1;
    goToStep(Math.min(target, activeSteps.length - 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, activeSteps.length, config, goToStep]);
  const goBack = useCallback(() => {
    let target = step - 1;
    while (target > 0 && skipped(target)) target -= 1;
    goToStep(Math.max(0, target));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, config, goToStep]);
  const selectMacro = (index: number) => {
    const indices = macros[index]?.indices ?? [];
    const target = indices.find((i) => !skipped(i)) ?? indices[0];
    if (target !== undefined) goToStep(target);
  };
  // If the configuration makes the current step empty (e.g. visible inox on
  // the finish step), move on instead of showing an empty decision.
  useEffect(() => {
    if (skipped(step)) goNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, config.structure]);
  // Phones: a step that still needs a decision opens with its cards; a step
  // revisited after it was completed opens collapsed, so the pool stays visible.
  const [trayExpanded, setTrayExpanded] = useState(true);
  useEffect(() => setTrayExpanded(!isStepComplete(step)), [step]); // eslint-disable-line react-hooks/exhaustive-deps
  // A share link lands on the Summary: open the mobile sheet so the
  // visitor sees the project, its ID and the save/share/PDF actions.
  useEffect(() => {
    if (sharedProject?.status === "ready") setTrayExpanded(true);
  }, [sharedProject?.status]);
  // The final step's primary action opens the proposal request.
  const [requestToken, setRequestToken] = useState(0);
  const finalRequest = !renovationWorkflow && activeStepId === "review";
  const trayContext: TrayContext = {
    requestToken,
    focus: (intent) => {
      setInspectionView(intent);
      reframe();
    },
    captureHero,
    captureDayNight,
    photoMode: {
      available: ACTIVE_RENDERING_QUALITY.id === "experience" && !photoModeUnsupported,
      reason: photoModeUnsupported
        ? "Il rendering fotografico non è supportato da questo dispositivo."
        : "Disponibile su computer desktop.",
      enter: () => {
        if (!photoMode) togglePhotoMode();
      },
    },
  };
  const RenovationComponent = RENOVATION_COMPONENTS[step] ?? ProjectTypeStep;
  const trayContent = renovationWorkflow ? (
    step === 0 ? (
      <ProjectTray />
    ) : (
      <RenovationComponent />
    )
  ) : activeStepId === "project" ? (
    <ProjectTray />
  ) : activeStepId === "pool-type" ? (
    <PoolTypeTray />
  ) : activeStepId === "structure" ? (
    <StructureTray />
  ) : activeStepId === "shape-dimensions" ? (
    <ShapeTray ctx={trayContext} />
  ) : activeStepId === "system" ? (
    <SystemTray />
  ) : activeStepId === "access" ? (
    <AccessTray />
  ) : activeStepId === "style" ? (
    <FinishTray />
  ) : activeStepId === "lighting" ? (
    <LightTray />
  ) : activeStepId === "deck" ? (
    <DeckTray />
  ) : activeStepId === "technology" ? (
    <OptionalTray ctx={trayContext} />
  ) : (
    <PresentationTray ctx={trayContext} />
  );
  const copy = renovationWorkflow
    ? { title: activeSteps[step]?.title ?? "", subtitle: activeSteps[step]?.subtitle ?? "" }
    : (STEP_COPY[activeStepId ?? "project"] ?? { title: "", subtitle: "" });
  const substepPosition = macro && macro.indices.length > 1 ? macro.indices.indexOf(step) + 1 : 0;

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
      <IntroVeil />
      <header className="z-30 grid shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 border-b border-hairline bg-background px-4 py-3 sm:px-6 lg:gap-8">
        <BrandLogo className="h-7 max-w-[100px]" />
        <div className="flex min-w-0 justify-center">
          <WizardNav
            macros={macros}
            current={macroIndex}
            onSelect={selectMacro}
            progress={
              macro && macro.indices.length > 1
                ? (macro.indices.indexOf(step) + 1) / macro.indices.length
                : 0.5
            }
          />
        </div>
        <div className="flex items-center gap-1 sm:gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={reset}
            aria-label="Ricomincia"
            className="rounded-full px-2.5"
          >
            <RotateCcw />
            <span className="hidden xl:inline">Ricomincia</span>
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-2 sm:p-3 lg:p-4">
        <main
          id="pool-viewport"
          className={cn(
            "relative w-full overflow-hidden bg-viewport",
            mobileExpanded
              ? "fixed inset-0 z-40 h-[100dvh] rounded-none border-0"
              : "min-h-[200px] flex-1 rounded-[20px] border border-hairline lg:rounded-[24px]",
          )}
        >
          <PoolViewport
            outline={outline}
            shape={config.shape}
            system={config.system}
            overflowType={config.overflowType}
            poolType={config.poolType ?? "in-ground"}
            materials={materials}
            construction={construction}
            features={config.features}
            ledColor={config.ledColor ?? "#ffffff"}
            ledIntensity={normalisedLedIntensity(config.ledIntensity)}
            internalStairType={config.internalStairType ?? "linear"}
            {...(config.hydromassageVariant
              ? { hydromassageVariant: config.hydromassageVariant }
              : {})}
            poolAccess={config.poolAccess}
            skimmers={skimmers}
            coverPlan={cover}
            solarShower={config.equipment.includes("solarShower")}
            loungers={config.equipment.includes("loungers")}
            {...(config.poolType === "above-ground"
              ? {
                  exteriorPanelFinish: exteriorPanelFinish(config.exteriorPanelFinish),
                  pellicano: config.equipment.includes("pellicano"),
                }
              : {})}
            technicalView={technicalView}
            technicalPlan={technical}
            onToggleTechnicalView={() => { setTechnicalView((value) => !value); setInspectionView(null); reframe(); }}
            onTechnicalFocus={(focus: VisualFocus) => { setInspectionView(contextualIntent(focus, config)); reframe(); }}
            {...(config.infinityEdge ? { infinityEdge: config.infinityEdge } : {})}
            onSelectInfinitySide={
              activeStepId === "system" && config.system === "infinity"
                ? setInfinitySide
                : undefined
            }
            length={config.dimensions.length}
            width={config.dimensions.width}
            depth={config.dimensions.depth}
            floorProfile={config.dimensions.floorProfile}
            shallowDepth={config.dimensions.shallowDepth}
            slopeReversed={config.dimensions.slopeReversed}
            showMeasurements={
              showMeasurements ||
              visualFocus?.focus === "DIMENSIONS_TOP" ||
              visualFocus?.focus === "DEPTH" ||
              activeStepId === "shape-dimensions"
            }
            onToggleMeasurements={toggleMeasurements}
            onReframe={reframe}
            frameToken={frameToken + (visualFocus?.revision ?? 0)}
            focus={
              inspectionView ??
              (technicalView
                ? "review"
                : wholePoolIntent(
                    visualFocus ? contextualIntent(visualFocus.focus, config) : cameraFocus,
                    renovationWorkflow ? undefined : activeStepId,
                  ))
            }
            cameraLocked={cameraLocked}
            showWater={construction.showWater}
            theme={theme}
            sceneTime={
              construction.showWater &&
              (activeStepId === "lighting" ||
                dayNightCapture ||
                // The final presentation may be shown at night, but only
                // for a pool that actually has LEDs to show.
                (activeStepId === "review" && config.features.includes("ledLighting")))
                ? sceneTime
                : "day"
            }
            paving={config.paving ?? "gres"}
            photoMode={photoMode}
            onTogglePhotoMode={togglePhotoMode}
            photoModeQuality={photoModeQuality}
            onSetPhotoModeQuality={setPhotoModeQuality}
            photoModeUnsupported={photoModeUnsupported}
            onPhotoModeUnsupported={handlePhotoModeUnsupported}
            onGeneratePhotorealisticRender={openPremiumPresentation}
            premiumPresentationAvailable={premiumPresentationAvailable}
            renderPhase={renderPhase}
            renderProgress={renderProgress}
            mobileExpanded={mobileExpanded}
            onToggleMobileExpanded={toggleMobileExpanded}
            onInspectionView={(view) => { setInspectionView(view); reframe(); }}
          />
        </main>

        {/* Phones: reserve the sheet's height so the 3D viewport reframes the
            pool above it, collapsed or half open, instead of hiding behind it. */}
        <div
          aria-hidden
          className={cn(
            "shrink-0 transition-[height] duration-300 lg:hidden",
            trayExpanded ? "h-[52dvh]" : "h-[136px]",
          )}
        />

        <ConfiguratorTray
          number={macroIndex + 1}
          total={renovationWorkflow ? undefined : macros.length}
          nextLabel={
            !renovationWorkflow &&
            macro &&
            macro.indices[macro.indices.length - 1] === step
              ? macros[macroIndex + 1]?.label
              : undefined
          }
          title={renovationWorkflow ? copy.title : (macro?.label ?? copy.title)}
          subtitle={copy.subtitle}
          {...(substepPosition
            ? { substep: `${substepPosition}/${macro!.indices.length} · ${copy.title}` }
            : {})}
          selection={
            renovationWorkflow
              ? (activeSteps[step]?.short ?? "")
              : describeSelection(activeStepId, config)
          }
          canBack={step > 0}
          canContinue={finalRequest || (!isLast && canContinue)}
          continueLabel={
            finalRequest ? "Richiedi proposta" : isLast ? "Configurazione completa" : "Continua"
          }
          continueHint={isLast ? undefined : "Completa la scelta per continuare"}
          onBack={goBack}
          onContinue={
            finalRequest
              ? () => {
                  setRequestToken((n) => n + 1);
                  setTrayExpanded(true);
                }
              : goNext
          }
          expanded={trayExpanded}
          onExpandedChange={setTrayExpanded}
        >
          <div key={step} className="animate-rise">
            {trayContent}
          </div>
        </ConfiguratorTray>
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
