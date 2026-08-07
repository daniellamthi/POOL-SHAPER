import { useCallback, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RENOVATION_STEPS, STEPS } from "@/lib/pool/config";
import { useConfigurator } from "@/lib/pool/context";
import { ConfiguratorProvider } from "@/lib/pool/store";
import { resolveMaterials } from "@/lib/pool/materials";
import { ThemeProvider, useTheme } from "@/lib/theme";
import { ProjectTypeStep } from "@/configurator/steps/project-type";
import { PoolShapeStep } from "@/configurator/steps/pool-shape";
import { PoolDimensionsStep } from "@/configurator/steps/pool-dimensions";
import { PoolSystemStep } from "@/configurator/steps/pool-system";
import { InteriorFinishStep } from "@/configurator/steps/interior-finish";
import { InteriorColorStep } from "@/configurator/steps/interior-color";
import { AccessoriesStep } from "@/configurator/steps/accessories";
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
import type { SceneFocus } from "./three/PoolScene";

const STEP_COMPONENTS = [
  ProjectTypeStep,
  PoolShapeStep,
  PoolDimensionsStep,
  PoolSystemStep,
  InteriorFinishStep,
  InteriorColorStep,
  AccessoriesStep,
  ContactDetailsStep,
  FinalReviewStep,
] as const;

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
    () => resolveMaterials({ finish: config.finish, linerColor: config.linerColor }),
    [config.finish, config.linerColor],
  );

  const [showMeasurements, setShowMeasurements] = useState(true);
  const [frameToken, setFrameToken] = useState(0);
  const toggleMeasurements = useCallback(() => setShowMeasurements((value) => !value), []);
  const reframe = useCallback(() => setFrameToken((value) => value + 1), []);

  const renovationWorkflow = config.projectType === "renovation";
  const activeSteps = renovationWorkflow ? RENOVATION_STEPS : STEPS;
  const components = renovationWorkflow ? RENOVATION_COMPONENTS : STEP_COMPONENTS;
  const StepComponent = components[step] ?? ProjectTypeStep;
  const isLast = step === activeSteps.length - 1;
  const cameraFocus: SceneFocus = renovationWorkflow
    ? "overview"
    : step === 3
      ? config.system
      : step === 4 || step === 5
        ? "interior"
        : step === 8
          ? "review"
          : "overview";

  return (
    <div className="flex min-h-screen flex-col bg-background lg:h-screen lg:overflow-hidden">
      {/* Masthead */}
      <header className="z-20 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-8 border-b border-hairline bg-background/90 px-6 py-4 backdrop-blur-2xl sm:px-9">
        <div className="flex min-w-0 items-center">
          <BrandLogo className="h-8 max-w-[104px] opacity-90" />
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button type="button" variant="ghost" size="sm" onClick={reset}>
            <RotateCcw />
            <span className="hidden sm:inline">Reset</span>
          </Button>
        </div>
      </header>

      <div className="flex flex-1 flex-col-reverse lg:min-h-0 lg:flex-row">
        {/* Command column */}
        <aside className="relative z-10 flex w-full flex-col border-hairline bg-background shadow-[18px_0_60px_-48px_rgba(0,0,0,0.75)] lg:w-[452px] lg:border-r xl:w-[512px]">
          <div className="border-b border-hairline px-6 pt-8 pb-8 sm:px-11">
            <StepIndicator
              current={step}
              steps={activeSteps}
              isStepComplete={isStepComplete}
              onSelect={goToStep}
            />
          </div>

          <div className="scroll-slim flex-1 overflow-y-auto px-6 pt-12 pb-20 sm:px-11 lg:min-h-0">
            <StepComponent />
          </div>

          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-5 border-t border-hairline bg-background/88 px-6 py-5 backdrop-blur-2xl sm:px-11">
            <Button
              type="button"
              variant="outline"
              onClick={previous}
              disabled={step === 0}
              className="px-5"
            >
              <ArrowLeft />
              <span className="hidden sm:inline">Back</span>
            </Button>
            <span className="text-center text-[10px] uppercase tracking-[0.24em] text-muted-foreground/70">
              {String(step + 1).padStart(2, "0")} / {String(activeSteps.length).padStart(2, "0")}
            </span>
            <Button
              type="button"
              onClick={next}
              disabled={isLast || !canContinue}
              title={canContinue ? undefined : "Complete this step to continue"}
              className="px-7"
            >
              Continue
              <ArrowRight />
            </Button>
          </div>
        </aside>

        {/* Centrepiece */}
        <main className="relative h-[46vh] w-full min-h-[320px] bg-viewport sm:h-[54vh] lg:h-auto lg:flex-1">
          <PoolViewport
            outline={outline}
            shape={config.shape}
            system={config.system}
            materials={materials}
            skimmers={skimmers}
            length={config.dimensions.length}
            width={config.dimensions.width}
            depth={config.dimensions.depth}
            showMeasurements={showMeasurements}
            onToggleMeasurements={toggleMeasurements}
            onReframe={reframe}
            frameToken={frameToken}
            focus={cameraFocus}
            showWater={renovationWorkflow || step !== 4}
            theme={theme}
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
