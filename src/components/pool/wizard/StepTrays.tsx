import { PresentationContextPicker, type PresentationContextChoice } from "../PresentationContextPicker";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { decisions, type DecisionProps } from "./decisions";
import { ArrowRight, Check, Moon, Plus, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConfigurator } from "@/lib/pool/context";
import { integratedCoping, supportsCopingStyle, supportsCopingEdge } from "@/lib/pool/coping-style";
import {
  EQUIPMENT,
  LINER_COLORS,
  POOL_SHAPES,
  CUSTOMER_STRUCTURES,
  customerStructureOf,
  POOL_TYPES,
  PROJECT_TYPES,
  SKIMMER_FINISHES,
  SELECTABLE_SKIMMER_TYPES,
} from "@/lib/pool/config";
import { copingMaterialsForPool } from "@/lib/pool/coping-materials";
import { pavingMaterialsForPool, pavingId, pavingFormats, pavingLayout, PAVING_FORMATS } from "@/lib/pool/presentation";
import { isReferenceFinish, isPorcelainReference } from "@/lib/pool/reference-finishes";
import { FinishFamilyChoice } from "@/components/pool/PorcelainFinishChoice";
import { finishFamily, isTravertineReference, type FinishFamily } from "./finish-guide";
import { GuidedFinishSection, useFinishGuide } from "./GuidedFinishSection";
import { ReferenceFinishSwatch } from "@/components/pool/ReferenceFinishSwatch";
import { MOSAIC_FINISHES } from "@/configurator/materials/interior-textures";
import { isVisibleStainlessStructure } from "@/lib/pool/structure-finish";
import { compatibleInfinityZones } from "@/lib/pool/infinity-edge";
import { configuredAccessPlan } from "@/lib/pool/access-plan";
import { configuredComfortPlan, normalizeComfortFeatures } from "@/lib/pool/comfort-plan";
import { configuredPoolLayout } from "@/lib/pool/resolved-layout";
import { configuredLightingPlan } from "@/lib/pool/lighting-plan";
import { configuredPerimeterLights, poolLedType } from "@/lib/pool/perimeter-lighting";
import { PerimeterLightSelector } from "./PerimeterLightSelector";
import { resolveAutomaticCover } from "@/lib/pool/cover-plan";
import { getCopingSwatchDataUrl } from "@/components/pool/copingSwatchPreview";
import { InfinitySideSelector } from "@/configurator/steps/pool-system/InfinitySideSelector";
import { LedColorWheel } from "@/configurator/steps/pool-features/LedColorWheel";
import { LedIntensityControl } from "@/configurator/steps/pool-features/LedIntensityControl";
import { LeadRequestDialog } from "@/configurator/steps/final-review/LeadRequestDialog";
import { ProposalComparison } from "@/components/pool/delivery/ProposalComparison";
import { ProjectSummary } from "@/components/pool/ProjectSummary";
import { ProjectDeliveryPanel } from "@/components/pool/delivery/ProjectDelivery";
import type { DayNightCapture } from "@/lib/project-delivery/heroCapture";
import { useProjectDelivery } from "@/components/pool/delivery/useProjectDelivery";
import { MetricsPanel } from "@/components/pool/MetricsPanel";
import { ShapeEditor } from "@/components/pool/ShapeEditor";
import { FileDrop } from "@/components/pool/FileDrop";
import { DimensionControl } from "@/components/pool/DimensionControl";
import { DIMENSION_LIMITS } from "@/lib/pool/config";
import {
  FloorProfileSection,
  LShapeOrientationSelector,
  LShapeRecessControls,
  OrganicShapeControls,
} from "@/configurator/steps/pool-shape/PoolShapeStep";
import type { SceneFocus } from "@/components/pool/three/PoolScene";
import { ChoiceCard, ChoiceGrid, GroupLabel, RevealSection, StepTabs } from "./ChoiceCard";
import { EXTERIOR_PANEL_FINISHES, exteriorPanelFinish } from "@/lib/pool/above-ground";
import { Illustration } from "./illustrations";
import { ProductMedia, hasProductMedia } from "./product-media";
import { configuredSunShelfLoungers, SUN_SHELF_LOUNGER_MODEL } from "@/lib/pool/sun-shelf-loungers";
import { SUN_SHELF_WATER_DEPTH } from "@/lib/pool/sun-shelf-model";
import { SunShelfLoungerColorPicker } from "./SunShelfLoungerColorPicker";
import { configuredSunShelfRange, sunShelfRunWithinRange } from "@/lib/pool/sun-shelf-range";
import { useI18n } from "@/lib/i18n";

/** What a tray may ask of the shell: point the camera at what is being edited,
 * and the presentation controls the shell owns (photo mode). */
export interface TrayContext {
  presentationContext?: PresentationContextChoice | undefined;
  openGardenStudio?: () => void;
  focus: (intent: SceneFocus | null) => void;
  /** Bumped by the final step's primary action: opens the proposal request. */
  photoMode?: { available: boolean; active: boolean; reason?: string; enter: () => void };
  /** Clean hero capture of the configured pool (Build 2). */
  captureHero?: () => Promise<string | null>;
  captureDayNight?: () => Promise<DayNightCapture>;
}

const ill = (name: string) => hasProductMedia(name) ? <ProductMedia name={name} /> : <Illustration name={name} />;

/** Customer-facing one-liners for option families whose catalogue entries
 * carry no description of their own. */
const SKIMMER_FINISH_COPY: Record<string, string> = {
  white: "Frontalino bianco, discreto sul liner chiaro.",
  graphite: "Antracite, si fonde con i rivestimenti scuri.",
  sand: "Tono sabbia per liner e mosaici caldi.",
  steel: "Acciaio satinato, coordinato con scalette inox.",
};
const LINER_COPY: Record<string, string> = {
  motionDeepSea603: "Acqua blu intenso e profondo.",
  motionBlueSky602: "Acqua azzurra luminosa, classica.",
  motionArcticWhite180: "Acqua chiarissima, turchese tenue.",
  motionSandBeach179: "Acqua verde-turchese caraibica.",
  motionGreyRock798: "Acqua verde-grigia, naturale.",
  motionBlackStone799: "Acqua scura a specchio, effetto lago.",
};

/** Customer-facing Italian lines for the coping catalogue cards. */
const COPING_COPY: Record<string, string> = {
  limestone: "Pietra calcarea chiara, grana fine e contemporanea.",
  prun: "Pietra crema con venature naturali.",
  travertine: "Pietra italiana calda, venatura naturale.",
  "anthracite-gres": "Gres porcellanato opaco, resistente e uniforme.",
  ardesia: "Ardesia naturale, scura e materica.",
  "deck-marrone": "Doghe in legno dal tono bruno.",
  wpc: "Composito legno-polimero con venatura uniforme.",
};

function TabBody({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-4 animate-rise">{children}</div>;
}

/* ---------------------------------------------------------------- 01 */

export function ProjectTray() {
  const { t } = useI18n();
  const { config, setProjectType } = useConfigurator();
  return (
    <ChoiceGrid label={t("Tipo di progetto")}>
      {PROJECT_TYPES.map((item) => (
        <ChoiceCard
          key={item.id}
          title={t(item.title)}
          description={t(item.description)}
          image={ill(`project-${item.id}`)}
          selected={config.projectType === item.id}
          onSelect={() => setProjectType(item.id)}
        />
      ))}
    </ChoiceGrid>
  );
}

export function PoolTypeTray() {
  const { t } = useI18n();
  const { config, setPoolType } = useConfigurator();
  return (
    <ChoiceGrid label={t("Tipo di piscina")}>
      {POOL_TYPES.map((item) => (
        <ChoiceCard
          key={item.id}
          title={t(item.title)}
          description={t(item.description)}
          image={ill(`pooltype-${item.id}`)}
          selected={config.poolType === item.id}
          onSelect={() => setPoolType(item.id)}
        />
      ))}
    </ChoiceGrid>
  );
}

export function StructureTray() {
  const { t } = useI18n();
  const { config, setPoolStructure } = useConfigurator();
  const structures = CUSTOMER_STRUCTURES.filter((s) =>
    config.poolType ? s.poolTypes.includes(config.poolType) : false,
  );
  const current = customerStructureOf(config.structure);
  return (
    <ChoiceGrid label={t("Struttura della piscina")}>
      {structures.map((item) => (
        <ChoiceCard
          key={item.id}
          title={t(item.title)}
          description={t(item.description)}
          image={ill(`structure-${item.illustration}`)}
          selected={current === item.id}
          onSelect={() => {
            if (item.id === "concrete") setPoolStructure("reinforced-concrete");
            // Steel keeps an already chosen steel finish; otherwise it starts
            // lined, and the finish step offers the visible stainless basin.
            else if (current !== "steel") setPoolStructure("modular-steel-panels");
          }}
        />
      ))}
    </ChoiceGrid>
  );
}

/* ---------------------------------------------------------------- 02 */

export function ShapeTray({ ctx, tab, setTab, showTabs = true }: { ctx: TrayContext; showTabs?: boolean } & DecisionProps) {
  const { t } = useI18n();
  const { config, setShape, setCustomMode, setDimension, metrics } = useConfigurator();
  useEffect(() => { ctx.focus(tab === "plan" ? "top" : tab === "depth" ? "depth" : null); }, [tab]);
  const choose = (next: typeof tab) => {
    setTab(next);
    ctx.focus(next === "plan" ? "top" : next === "depth" ? "depth" : null);
  };
  const supportsProfile =
    config.poolType === "in-ground" &&
    (config.shape === "rectangle" || config.shape === "l-shape" || config.shape === "organic");
  return (
    <TabBody>
      {showTabs ? <StepTabs
        label={t("Forma e dimensioni")}
        value={tab}
        onChange={choose}
        tabs={[
          { id: "shape", label: "Forma" },
          { id: "plan", label: "Lunghezza e larghezza" },
          { id: "depth", label: "Profondità" },
        ]}
      /> : null}
      {tab === "shape" ? (
        <ChoiceGrid label={t("Forma della piscina")}>
          {POOL_SHAPES.map((shape) => (
            <ChoiceCard
              key={shape.id}
              title={t(shape.title)}
              description={t(shape.description)}
              image={ill(`shape-${shape.id}`)}
              selected={config.shapeSelected === true && config.shape === shape.id}
              onSelect={() => {
                setShape(shape.id);
                choose("plan");
              }}
            />
          ))}
        </ChoiceGrid>
      ) : null}
      {tab === "plan" ? (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
          <div className="flex flex-col gap-7">
            {(["length", "width"] as const).map((key) => {
              const limits = DIMENSION_LIMITS[key];
              return (
                <DimensionControl
                  key={key}
                  label={t(key === "length" ? "Lunghezza" : "Larghezza")}
                  value={config.dimensions[key]}
                  unit={limits.unit}
                  min={limits.min}
                  max={limits.max}
                  step={limits.step}
                  onChange={(value) => setDimension(key, value)}
                />
              );
            })}
          </div>
          <div className="flex flex-col gap-6">
            {config.shape === "l-shape" ? (
              <>
                <LShapeOrientationSelector disabled={false} />
                <LShapeRecessControls disabled={false} />
              </>
            ) : config.shape === "organic" ? (
              <OrganicShapeControls disabled={false} />
            ) : config.shape === "custom" ? (
              <>
                <StepTabs
                  label={t("Metodo forma personalizzata")}
                  value={config.customMode}
                  onChange={setCustomMode}
                  tabs={[
                    { id: "draw", label: "Disegna perimetro" },
                    { id: "upload", label: "Carica planimetria" },
                  ]}
                />
                {config.customMode === "draw" ? (
                  <ShapeEditor />
                ) : (
                  <FileDrop
                    category="reference"
                    label={t("Riferimento architettonico")}
                    hint="PDF, planimetria o immagine di riferimento."
                  />
                )}
              </>
            ) : (
              <p className="text-[12.5px] leading-relaxed font-light text-muted-foreground">
                {t("La vista dall’alto mostra la pianta in scala reale. Trascina i cursori: la vasca si ridimensiona in tempo reale.")}</p>
            )}
          </div>
          <div className="flex flex-col gap-3">
            <GroupLabel>{t("Valori calcolati")}</GroupLabel>
            <MetricsPanel metrics={metrics} />
          </div>
        </div>
      ) : null}
      {tab === "depth" ? (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)]">
          {supportsProfile ? (
            <FloorProfileSection disabled={false} />
          ) : (
            <DimensionControl
              label={t("Profondità")}
              value={config.dimensions.depth}
              unit={DIMENSION_LIMITS.depth.unit}
              min={DIMENSION_LIMITS.depth.min}
              max={DIMENSION_LIMITS.depth.max}
              step={DIMENSION_LIMITS.depth.step}
              onChange={(value) => setDimension("depth", value)}
            />
          )}
          <div className="flex flex-col gap-3">
            <GroupLabel>{t("Valori calcolati")}</GroupLabel>
            <MetricsPanel metrics={metrics} />
          </div>
        </div>
      ) : null}
    </TabBody>
  );
}

/* ---------------------------------------------------------------- 03 */

export function SystemTray({ tab, setTab }: {
  tab: "system" | "detail";
  setTab: (tab: "system" | "detail") => void;
}) {
  const { t } = useI18n();
  const {
    config,
    outline,
    setSystem,
    setOverflowType,
    setSkimmerFinish,
    setSkimmerType,
    setInfinitySide,
    setInfinityWall,
  } = useConfigurator();
  const infinityAvailable =
    compatibleInfinityZones(outline, config.shape, config.poolType).length > 0;
  const detailLabel =
    config.system === "skimmer"
      ? "Modello skimmer"
      : config.system === "overflow"
        ? "Tipo di sfioro"
        : "Lato Infinity";
  const systems = [
    {
      id: "skimmer" as const,
      title: "Skimmer",
      description: "Acqua 12 cm sotto il bordo, aspirata da bocchette a parete.",
    },
    {
      id: "overflow" as const,
      title: "Sfioro",
      description: "Acqua a filo bordo: tracima in un canale perimetrale.",
    },
    ...(infinityAvailable
      ? [
          {
            id: "infinity" as const,
            title: "Infinity",
            description: "Un lato senza bordo: l’acqua scompare verso il panorama.",
          },
        ]
      : []),
  ];
  return (
    <TabBody>
      <StepTabs
        label={t("Sistema piscina")}
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "system", label: "Sistema" },
          { id: "detail", label: detailLabel },
        ]}
      />
      {tab === "system" ? (
        <ChoiceGrid label={t("Sistema idraulico")}>
          {systems.map((item) => (
            <ChoiceCard
              key={item.id}
              title={t(item.title)}
              description={t(item.description)}
              image={ill(`system-${item.id}`)}
              selected={config.system === item.id}
              onSelect={() => { setSystem(item.id); setTab(item.id === "infinity" ? "detail" : "system"); }}
            />
          ))}
        </ChoiceGrid>
      ) : config.system === "skimmer" ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-3">
            <GroupLabel>{t("Modello")}</GroupLabel>
            <ChoiceGrid label={t("Tipo skimmer")} dense>
              {SELECTABLE_SKIMMER_TYPES.map((item) => (
                <ChoiceCard
                  compact
                  key={item.id}
                  title={t(item.title)}
                  description={t(item.description)}
                  image={ill(item.id === "highWaterline" ? "skimmer-high" : "skimmer-slim")}
                  selected={config.skimmerType === item.id}
                  onSelect={() => setSkimmerType(item.id)}
                />
              ))}
            </ChoiceGrid>
          </div>
          <div className="flex flex-col gap-3">
            <GroupLabel>{t("Finitura")}</GroupLabel>
            <ChoiceGrid label={t("Finitura skimmer")} dense>
              {SKIMMER_FINISHES.map((item) => (
                <ChoiceCard
                  compact
                  key={item.id}
                  title={t(item.title)}
                  description={t(SKIMMER_FINISH_COPY[item.id] ?? "Finitura del frontalino.")}
                  image={
                    <span
                      className="block h-full w-full rounded-xl"
                      style={{ background: item.hex }}
                    />
                  }
                  selected={config.skimmerFinish === item.id}
                  onSelect={() => setSkimmerFinish(item.id)}
                />
              ))}
            </ChoiceGrid>
          </div>
        </div>
      ) : config.system === "overflow" ? (
        <ChoiceGrid label={t("Tipo di sfioro")}>
          {config.poolType !== "above-ground" && <ChoiceCard
            title={t("Sfioro nascosto")}
            description={t("Bordo e pavimentazione sullo stesso piano, acqua leggermente ribassata e raccolta nascosta.")}
            image={<svg viewBox="0 0 160 90" className="h-full w-full" aria-hidden="true"><path d="M12 24h136v12H12z" fill="#c9c3b7"/><path d="M30 36v35h100V36" fill="#d1eaed"/><path d="M30 45h100v26H30z" fill="#80b9c3"/><path d="M12 24h136M30 45h100" stroke="currentColor" strokeWidth="1"/></svg>}
            selected={config.overflowType === "continuous"}
            onSelect={() => setOverflowType("continuous")}
          />}
          <ChoiceCard
            title={t("Sfioro a griglia")}
            description={t("Griglia perimetrale a vista lungo il bordo.")}
            image={ill("overflow-visible")}
            selected={config.overflowType === "visible"}
            onSelect={() => setOverflowType("visible")}
          />
          <ChoiceCard
            title={t("Sfioro a bordo continuo")}
            description={t("Il canale scompare sotto il bordo in pietra.")}
            image={ill("overflow-hidden")}
            selected={config.overflowType === "hidden"}
            onSelect={() => setOverflowType("hidden")}
          />
        </ChoiceGrid>
      ) : (
        <div className="max-w-xl">
          <InfinitySideSelector
            outline={outline}
            shape={config.shape}
            selectedSide={config.infinityEdge?.side ?? null}
            onSelect={setInfinitySide}
          />
          <GroupLabel>{t("Parete di sfioro")}</GroupLabel>
          <ChoiceGrid label={t("Parete di sfioro Infinity")}>
            <ChoiceCard compact title={t("Parete Infinity tradizionale")} description={t("Contenimento pieno.")} image={ill("system-infinity")}
              selected={config.infinityEdge?.wallType !== "glass"} onSelect={() => setInfinityWall("traditional")} />
            <ChoiceCard compact title={t("Parete Infinity in vetro")} description={t("Contenimento panoramico trasparente.")}
              image={<svg viewBox="0 0 160 90" className="h-full w-full" aria-hidden="true">
                <path d="M22 24H130V64H22Z" fill="#dcecef" />
                <path d="M22 24H130M22 64H136V71H22" fill="none" stroke="#777883" strokeWidth="2" />
                <path d="M128 24H134V64H128Z" fill="#a9d8df" fillOpacity=".5" stroke="#688d99" />
                <path d="M125 32L134 41M125 44L134 53" stroke="white" strokeWidth="2" />
              </svg>}
              selected={config.infinityEdge?.wallType === "glass"} onSelect={() => setInfinityWall("glass")} />
          </ChoiceGrid>
          <p className="mt-2 text-xs text-muted-foreground">{t("Soluzione progettuale soggetta a verifica strutturale.")}</p>
        </div>
      )}
    </TabBody>
  );
}

/* ---------------------------------------------------------------- 04 */

export function AccessTray({ tab, setTab }: DecisionProps) {
  const { t, number } = useI18n();
  const {
    config,
    togglePoolFeature,
    setPoolAccess,
    setInternalStairType,
    setInternalStairMirrored,
    setHydromassageVariant,
    toggleInternalSteps,
    toggleInoxLadder,
    setExternalStairSide,
    setSunShelfLoungerCount,
    setIntegratedBenchStations,
    setSunShelfLoungerColor,
    setSunShelfRun,
    sunShelfNotice,
  } = useConfigurator();
  // Set when the customer turns the internal stair on in this visit, so the
  // follow-up options (stair shape, optional inox ladder) are brought into view.
  const [stairsJustChosen, setStairsJustChosen] = useState(false);
  const stairType = config.internalStairType ?? "linear";
  const plans = useMemo(
    () => ({
      linear: configuredAccessPlan({
        ...config,
        poolAccess: "internalSteps",
        internalStairType: "linear",
      }),
      corner: configuredAccessPlan({
        ...config,
        poolAccess: "internalSteps",
        internalStairType: "corner",
      }),
    }),
    [config],
  );
  const stepsOn = config.poolAccess === "internalSteps";
  const inoxOn =
    config.poolAccess === "stainlessSteelLadder" ||
    (stepsOn && config.features.includes("inoxLadder"));
  const inoxLayout = useMemo(
    () =>
      configuredPoolLayout({
        ...config,
        poolAccess: stepsOn ? "internalSteps" : "stainlessSteelLadder",
        features: stepsOn
          ? [...config.features.filter((id) => id !== "inoxLadder"), "inoxLadder"]
          : config.features,
      }),
    [config, stepsOn],
  );
  const inoxPlan = stepsOn ? inoxLayout.ladder?.plan : inoxLayout.access;
  const inoxAvailable = config.poolType !== "above-ground" && (inoxOn || !!inoxPlan?.placement);
  const orientations = useMemo(() => config.poolType === "above-ground" && stepsOn
    ? [false,true].map(mirrored => ({mirrored,plan:configuredAccessPlan({...config,internalStairMirrored:mirrored})}))
    : [],[config,stepsOn]);

  const comfort = useMemo(() => configuredComfortPlan(config), [config]);
  const shelfOn = config.features.includes("sunShelf");
  const shelfLoungers = useMemo(() => configuredSunShelfLoungers(config), [config]);
  const hydroOn = config.features.includes("hydromassage") && !shelfOn;
  const hydroVariant = config.hydromassageVariant ?? "closed";
  const shelfProposal = useMemo(
    () =>
      configuredComfortPlan({
        ...config,
        features: shelfOn ? config.features : [...config.features, "sunShelf"],
      }),
    [config, shelfOn],
  );
  const hydroProposal = useMemo(
    () =>
      configuredComfortPlan({
        ...config,
        features: normalizeComfortFeatures(
          hydroOn ? config.features : [...config.features, "hydromassage"],
          "hydromassage",
        ),
      }),
    [config, hydroOn],
  );
  const hydroVariants = useMemo(() => (["closed", "open"] as const).map(variant => ({
    variant,
    plan: configuredComfortPlan({ ...config, hydromassageVariant: variant,
      features: normalizeComfortFeatures([...config.features, "hydromassage"], "hydromassage") }),
  })), [config]);
  const shelfElement = shelfProposal.elements.find(element => element.kind === "sunShelf");
  // Include the complete configuration so a new layout dependency cannot
  // leave the advertised interval stale. Locale-only renders reuse this value.
  const shelfRange = useMemo(() => configuredSunShelfRange(config), [config]);
  const requestedShelfRun = config.dimensions.sunShelfRun ?? shelfElement?.run ?? (shelfRange.available ? shelfRange.defaultRun : 0);
  const shelfRunInvalid = shelfOn && !sunShelfRunWithinRange(shelfRange, requestedShelfRun);
  const ensureAccess = () => {
    if (config.poolAccess === null) {
      setInternalStairType("linear");
      setPoolAccess("internalSteps");
    }
  };
  const chooseComfort = (choice: "none" | "sunShelf" | "closed" | "open") => {
    if (choice === "none") {
      if (shelfOn) togglePoolFeature("sunShelf");
      if (config.features.includes("hydromassage")) togglePoolFeature("hydromassage");
      return;
    }
    ensureAccess();
    if (choice === "sunShelf") {
      if (!shelfProposal.availability.sunShelf.available) return;
      if (!shelfOn) togglePoolFeature("sunShelf");
      return;
    }
    if (!hydroVariants.find(item => item.variant === choice)?.plan.availability.hydromassage.available) return;
    setHydromassageVariant(choice);
    if (!hydroOn) togglePoolFeature("hydromassage");
  };
  const comfortChoice = shelfOn ? "sunShelf" : hydroOn ? hydroVariant : "none";
  const benchOn = config.features.includes("integratedBench");
  const benchElement = comfort.elements.find(element => element.kind === "integratedBench");
  const benchAvailable =
    shelfOn && !hydroOn && (benchOn || comfort.availability.integratedBench.available);

  return (
    <TabBody>
      <StepTabs
        label={t("Accesso e comfort")}
        value={tab}
        onChange={setTab}
        tabs={decisions("access", config)}
      />
      {tab !== "comfort" && tab !== "shelf-options" ? (
        <div className="flex flex-col gap-5">
          <ChoiceGrid label={t("Accesso alla piscina")}>
            {tab === "access" ? <ChoiceCard
              title={t("Scala interna")}
              description={t("Gradini in muratura, rivestiti come la vasca.")}
              image={ill("access-steps")}
              selected={stepsOn}
              onSelect={() => {
                setStairsJustChosen(!stepsOn);
                toggleInternalSteps();
              }}
            /> : null}
            {tab === "ladder" && inoxAvailable ? (
              <ChoiceCard
                optional={stepsOn}
                title={t("Scaletta inox")}
                description={t(stepsOn
                    ? "Aggiuntiva alla scala interna."
                    : "Corrimano tubolari e pedate antiscivolo.")}
                image={ill("access-ladder")}
                selected={inoxOn}
                onSelect={() => toggleInoxLadder()}
              />
            ) : null}
            {tab === "external" && config.poolType === "above-ground" ? (
              <ChoiceCard
                optional
                title={t("Scala esterna di accesso")}
                description={t("Struttura e parapetto in acciaio inox, pedate coordinate al bordo.")}
                image={ill("access-external")}
                selected={config.features.includes("externalStaircase")}
                onSelect={() => togglePoolFeature("externalStaircase")}
              />
            ) : null}
          </ChoiceGrid>
          {tab === "ladder" && !inoxAvailable ? <p role="status" className="text-xs text-muted-foreground">{t(inoxPlan?.reason ?? "Non disponibile per questa configurazione.")}</p> : null}
          {tab === "external" && config.poolType === "above-ground" && config.features.includes("externalStaircase") ? (
            <>
            <ChoiceGrid label={t("Posizione scala esterna")} dense>
              {(["short", "long"] as const).map(side => (
                <ChoiceCard key={side} compact title={t(side === "short" ? "Lato corto" : "Lato lungo")}
                  description={t("Accostata alla vasca, collegata all’accesso interno.")}
                  image={<svg viewBox="0 0 120 84" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                    <rect x="16" y="16" width="80" height="42" rx="1" />
                    {side === "short" ? <><rect x="96" y="16" width="12" height="42" />
                      <path d="M96 25h12M96 33h12M96 41h12M96 49h12" /></>
                      : <><rect x="54" y="58" width="42" height="12" />
                        <path d="M63 58v12M71 58v12M79 58v12M87 58v12" /></>}
                  </svg>}
                  selected={(config.externalStairSide ?? "short") === side}
                  onSelect={() => setExternalStairSide(side)} />
              ))}
            </ChoiceGrid>
            <p className="text-sm text-muted-foreground">{t("Piattaforma prolungata inclusa, con parapetto sui soli lati esterni.")}</p>
            </>
          ) : null}
          {tab === "access" && stepsOn &&
          !comfort.elements.some((e) => e.kind === "sunShelf") ? (
            <RevealSection reveal={stairsJustChosen}>
              <GroupLabel>{t("Forma della scala")}</GroupLabel>
              <ChoiceGrid label={t("Tipo di scala interna")} dense>
                {(["linear", "corner"] as const)
                  .filter((type) => (type === "linear" && hydroOn) || !plans[type].reason || stairType === type)
                  .map((type) => (
                    <ChoiceCard
                      compact
                      key={type}
                      title={t(type === "linear" ? "Rettilinea" : "Angolare")}
                      description={t(type === "linear"
                          ? "Gradini dritti sul lato corto."
                          : config.poolType === "above-ground" ? "Gradini rettangolari integrati nell’angolo." : "Gradini a quarto di cerchio nell’angolo.")}
                      image={ill(type === "linear" ? "access-steps-linear" : "access-steps-corner")}
                      selected={stairType === type}
                      onSelect={() => setInternalStairType(type)}
                      footer={plans[type].reason ? undefined : `${plans[type].steps} gradini`}
                    />
                  ))}
              </ChoiceGrid>
              {config.poolType === "above-ground" ? <ChoiceGrid label={t("Orientamento scala interna")} dense>
                {orientations.filter(option=>!!option.plan.placement || option.mirrored===!!config.internalStairMirrored).map(option => (
                  <ChoiceCard key={String(option.mirrored)} compact
                    title={t(option.mirrored ? "Speculare" : "Standard")}
                    description={t("Ingresso integrato nell’angolo del lato corto.")}
                    image={<span className={option.mirrored ? "-scale-x-100" : ""}>{ill(stairType==="corner"?"access-steps-corner":"access-steps-linear")}</span>}
                    selected={option.mirrored===!!config.internalStairMirrored}
                    onSelect={()=>setInternalStairMirrored(option.mirrored)}
                    footer={option.plan.reason || undefined} />
                ))}
              </ChoiceGrid> : null}
            </RevealSection>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {tab === "comfort" ? <>
          <ChoiceGrid label={t("Zona comfort")}>
            <ChoiceCard
              title={t("Nessuna zona comfort")}
              description={t("Vasca libera, solo la scala scelta.")}
              image={ill("comfort-none")}
              selected={comfortChoice === "none"}
              onSelect={() => chooseComfort("none")}
            />
            {shelfOn || shelfProposal.availability.sunShelf.available ? (
              <ChoiceCard
                title={t("Sun shelf")}
                description={t("Solarium sommerso a {depth} cm per sdraiarsi in acqua.", {depth: number(SUN_SHELF_WATER_DEPTH * 100)})}
                image={ill("comfort-sunShelf")}
                selected={comfortChoice === "sunShelf"}
                disabled={!shelfProposal.availability.sunShelf.available}
                onSelect={() => chooseComfort("sunShelf")}
              />
            ) : null}
            {hydroVariants.filter(item => item.plan.availability.hydromassage.available || (hydroOn && hydroVariant === item.variant)).map(({variant,plan}) => (
                <ChoiceCard
                  key={variant}
                  title={t(variant === "closed" ? "Idromassaggio A" : "Idromassaggio B")}
                  description={t(variant === "closed" ? "Zona delimitata da un muretto, panca a L con getti." : "Panca a U con getti, aperta sulla vasca.")}
                  image={ill(variant === "closed" ? "comfort-hydro-closed" : "comfort-hydro-open")}
                  selected={comfortChoice === variant}
                  disabled={!plan.availability.hydromassage.available}
                  onSelect={() => chooseComfort(variant)}
                />
            ))}
          </ChoiceGrid>
          {!shelfProposal.availability.sunShelf.available ? <p role="status" className="text-xs text-muted-foreground">{t("Sun Shelf")}: {t(shelfProposal.availability.sunShelf.reason ?? "Non disponibile per questa configurazione.")}</p> : null}
          {!hydroProposal.availability.hydromassage.available ? <p role="status" className="text-xs text-muted-foreground">{t("Idromassaggio")}: {t(hydroProposal.availability.hydromassage.reason ?? "Non disponibile per questa configurazione.")}</p> : null}
          {shelfOn && shelfRange.available ? <div className="flex flex-col gap-3" data-sun-shelf-dimensions data-wizard-guidance-group tabIndex={-1}>
            <DimensionControl label="Lunghezza spiaggetta e gradini" unit="m" step={0.005} precision={3}
              value={requestedShelfRun} min={shelfRange.min} max={shelfRange.max} onChange={setSunShelfRun} />
            <p className="text-xs text-muted-foreground">{t("Intervallo utile: {min}–{max} m, ricavato da due lettini, gradini, passaggi e spazio residuo della vasca.", {
              min: number(shelfRange.min, { maximumFractionDigits: 3 }), max: number(shelfRange.max, { maximumFractionDigits: 3 }),
            })}</p>
            <p className="text-xs text-muted-foreground">{t("Larghezza utile della spiaggetta: {width} m. Acqua: {depth} cm. Criteri progettuali preliminari, da verificare tecnicamente.", {
              depth: number(SUN_SHELF_WATER_DEPTH * 100),
              width: number(shelfRange.width, { maximumFractionDigits: 3 }),
            })}</p>
            {shelfRunInvalid ? <div role="alert" className="flex flex-col items-start gap-2 text-xs text-destructive">
              <p>{t("La misura della spiaggetta è conservata, ma non è compatibile con la vasca attuale. Modifica la misura o ripristina le dimensioni della piscina.")}</p>
              <button type="button" className="underline underline-offset-4" onClick={() => setSunShelfRun(Math.min(shelfRange.max, Math.max(shelfRange.min, requestedShelfRun)))}>
                {t("Applica una misura compatibile")}
              </button>
            </div> : null}
          </div> : null}
          {shelfOn && !shelfRange.available ? <p role="alert" className="text-xs text-destructive">{t(shelfRange.reason)}</p> : null}
          {shelfOn && shelfElement ? <p className="text-xs text-muted-foreground">{t("Spiaggetta: {run} m. Lunghezza di nuoto residua: {swim} m. Accesso separato di almeno 90 cm.", {
            run: number(shelfElement.run,{maximumFractionDigits:2}),
            swim: number(Math.max(config.dimensions.length,config.dimensions.width)-shelfElement.run,{maximumFractionDigits:2}),
          })}</p> : null}
          </> : null}
          {tab === "shelf-options" && shelfOn ? <div className="flex flex-col gap-3">
            <ChoiceGrid label={t("Optional per la spiaggetta")}>
              <ChoiceCard optional title={t("Lettini per spiaggetta")}
                description={t("Esse · Lyxo, senza telaio. Per acqua fino a 20 cm, con zavorramento.")}
                image="/product-previews/esse-white.jpg"
                imageFit="contain"
                selected={config.features.includes("sunShelfLoungers")} disabled={!shelfLoungers.available && !config.features.includes("sunShelfLoungers")}
                onSelect={() => togglePoolFeature("sunShelfLoungers")} />
            </ChoiceGrid>
            {config.features.includes("sunShelfLoungers") ? <SunShelfLoungerColorPicker value={config.sunShelfLoungerColor} onChange={setSunShelfLoungerColor} /> : null}
            {shelfLoungers.available ? <>
              <p className="text-xs text-muted-foreground">{t("Quantità consentite: da 1 a {count}.", { count: number(shelfLoungers.capacity) })}</p>
              {config.features.includes("sunShelfLoungers") ? <label className="flex items-center gap-3 text-sm" data-wizard-guidance-group tabIndex={-1}>
                {t("Quantità lettini")}
                <select aria-label={t("Quantità lettini")} className="rounded-lg border border-hairline bg-card px-3 py-2"
                  value={config.sunShelfLoungerCount ?? shelfLoungers.capacity} onChange={event => setSunShelfLoungerCount(Number(event.target.value))}>
                  {shelfLoungers.adjusted ? <option value={config.sunShelfLoungerCount}>{config.sunShelfLoungerCount} · {t("Da verificare")}</option> : null}
                  {Array.from({length: shelfLoungers.capacity}, (_,i) => i+1).map(count => <option key={count} value={count}>{t(number(count))}</option>)}
                </select>
              </label> : null}
            </> : <p role="status" className="text-xs text-muted-foreground">{t(shelfLoungers.reason ?? "Non disponibile per questa configurazione.")}</p>}
            {shelfLoungers.adjusted ? <p role="alert" className="text-xs text-destructive">{t(shelfLoungers.reason ?? "Non disponibile per questa configurazione.")}</p> : null}
            <p className="text-xs text-muted-foreground">{t("Anteprima 3D dimensionale; modello e fornitura da confermare.")} {t(number(SUN_SHELF_LOUNGER_MODEL.length, {maximumFractionDigits:3}))} {t("×")}{t(number(SUN_SHELF_LOUNGER_MODEL.width, {maximumFractionDigits:4}))} {t("m.")}</p>
          </div> : null}
          {sunShelfNotice ? <p role="status" className="text-xs text-muted-foreground">{t(sunShelfNotice)}</p> : null}
          {tab === "shelf-options" && benchAvailable ? (
            <div className="flex flex-col gap-3">
              <p className="flex items-center gap-2 text-[12px] text-muted-foreground">
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden
                  className="size-[18px] fill-none stroke-brand [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.25]"
                >
                  <path d="M6 3v7.5A3.5 3.5 0 0 0 9.5 14H18M14.5 10.5L18 14l-3.5 3.5" />
                </svg>
                <span>
                  <span className="font-normal text-foreground">{t("Per il tuo Sun shelf")}</span> {t("· compare solo con questa scelta")}</span>
              </p>
              <ChoiceGrid label={t("Panca integrata")} dense>
                <ChoiceCard
                  compact
                  optional
                  title={t("Panca integrata")}
                  description={t("Seduta sommersa lungo parete.")}
                  image={ill("comfort-bench")}
                  selected={benchOn}
                  onSelect={() => togglePoolFeature("integratedBench")}
                />
              </ChoiceGrid>
              {benchOn && benchElement?.stations ? <div className="flex flex-col gap-2" data-wizard-guidance-group tabIndex={-1}>
                <label className="flex items-center gap-3 text-sm">
                  {t("Postazioni panca")}
                  <select aria-label={t("Postazioni panca")} className="rounded-lg border border-hairline bg-card px-3 py-2"
                    value={benchElement.stations.count} onChange={event => setIntegratedBenchStations(Number(event.target.value))}>
                    {Array.from({ length: benchElement.stations.capacity }, (_, i) => i + 1).map(count => <option key={count} value={count}>{number(count)}</option>)}
                  </select>
                </label>
                <p className="text-xs text-muted-foreground">{t("Per postazione: 2 bocchette schiena e 2 bocchette gambe.")}</p>
                {benchElement.stations.adjusted ? <p role="alert" className="text-xs text-destructive">{t("Conferma le postazioni della panca: la richiesta supera lo spazio disponibile.")}</p> : null}
              </div> : null}
              {benchOn && !benchElement ? <p role="status" className="text-xs text-muted-foreground">{t(comfort.availability.integratedBench.reason ?? "Non disponibile per questa configurazione.")}</p> : null}
            </div>
          ) : null}
        </div>
      )}
    </TabBody>
  );
}

/* ---------------------------------------------------------------- 05 */

export function FinishTray({ tab: finishTab, setTab: setFinishTab }: DecisionProps) {
  const { t } = useI18n();
  const finishGuide = useFinishGuide();
  const {
    config,
    setFinish,
    setLinerColor,
    setMosaicFinish,
    setPoolStructure,
    setExteriorPanelFinish,
  } = useConfigurator();
  const steel = customerStructureOf(config.structure) === "steel";
  const visibleSteel = isVisibleStainlessStructure(config.structure);
  const active: "steel" | "liner" | "mosaic" = visibleSteel
    ? "steel"
    : config.finish === "mosaic"
      ? "mosaic"
      : "liner";
  const linerTexture = LINER_COLORS.find((c) => c.id === config.linerColor)?.texture;
  const mosaicPreview = MOSAIC_FINISHES.find((m) => m.id === config.mosaicFinish)?.preview;
  // Steel: the two canonical steel structures; concrete: liner or mosaic.
  const options = steel
    ? [
        {
          id: "steel" as const,
          title: "Acciaio a vista",
          description: "Vasca stagna in inox satinato grigio, senza rivestimento.",
          image: ill("structure-visible-stainless-steel"),
          select: () => setPoolStructure("visible-stainless-steel"),
        },
        {
          id: "liner" as const,
          title: "Liner / PVC",
          description: "Membrana armata che riveste tutte le superfici bagnate.",
          image: linerTexture ?? ill("structure-modular-steel-panels"),
          select: () => setPoolStructure("modular-steel-panels"),
        },
      ]
    : [
        {
          id: "liner" as const,
          title: "Liner / PVC",
          description: "Membrana armata, continua e impermeabile.",
          image: linerTexture ?? ill("structure-reinforced-concrete"),
          select: () => setFinish("liner"),
        },
        {
          id: "mosaic" as const,
          title: "Mosaico",
          description: "Tessere in vetro posate a mano.",
          image: mosaicPreview ?? ill("structure-reinforced-concrete"),
          select: () => setFinish("mosaic"),
        },
      ];
  const aboveGround = config.poolType === "above-ground";
  return (
    <TabBody>
      {aboveGround ? (
        <StepTabs
          label={t("Finiture")}
          value={finishTab}
          onChange={setFinishTab}
          tabs={[
            { id: "interior", label: "Rivestimento interno" },
            { id: "exterior", label: "Pannelli esterni" },
          ]}
        />
      ) : null}
      {aboveGround && finishTab === "exterior" ? (
        <ChoiceGrid label={t("Pannelli esterni")}>
          {EXTERIOR_PANEL_FINISHES.map((panel) => (
            <ChoiceCard
              key={panel.id}
              title={t(panel.title)}
              description={t(panel.description)}
              image={PANEL_SWATCH[panel.id]}
              selected={exteriorPanelFinish(config.exteriorPanelFinish) === panel.id}
              onSelect={() => setExteriorPanelFinish(panel.id)}
            />
          ))}
        </ChoiceGrid>
      ) : (
        <>
          <ChoiceGrid label={t("Rivestimento interno")}>
            {options.map((option) => (
              <ChoiceCard
                key={option.id}
                title={t(option.title)}
                description={t(option.description)}
                image={option.image}
                selected={active === option.id}
                onSelect={() => { option.select(); finishGuide.request(); }}
              />
            ))}
          </ChoiceGrid>
          {active === "liner" ? (
            <GuidedFinishSection guide={finishGuide.guide} label={t("Colore del liner")}>
              <ChoiceGrid label={t("Colore liner PVC")} dense>
                {LINER_COLORS.map((color) => (
                  <ChoiceCard
                    compact
                    key={color.id}
                    title={t(color.title.replace("Motion ", ""))}
                    description={t(LINER_COPY[color.id] ?? "Liner PVC armato.")}
                    image={color.texture}
                    selected={config.linerColor === color.id}
                    onSelect={() => setLinerColor(color.id)}
                  />
                ))}
              </ChoiceGrid>
            </GuidedFinishSection>
          ) : active === "mosaic" ? (
            <GuidedFinishSection guide={finishGuide.guide} label={t("Finitura mosaico")}>
              <ChoiceGrid label={t("Finitura mosaico")} dense>
                {MOSAIC_FINISHES.map((mosaic) => (
                  <ChoiceCard
                    compact
                    key={mosaic.id}
                    title={t(mosaic.name)}
                    description={t("Tessere in vetro, posa a mano.")}
                    image={mosaic.preview}
                    selected={config.mosaicFinish === mosaic.id}
                    onSelect={() => setMosaicFinish(mosaic.id)}
                  />
                ))}
              </ChoiceGrid>
            </GuidedFinishSection>
          ) : null}
        </>
      )}
    </TabBody>
  );
}

/** Card images for the exterior panels: a steel swatch drawn as boards,
 * and the real textures for gres and composite. */
const PANEL_SWATCH: Record<string, string> = {
  wpc: `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100"><defs><pattern id="w" width="20" height="100" patternUnits="userSpaceOnUse"><rect width="20" height="100" fill="#80634a"/><path d="M1 0v100M6 0v100M12 0v100M18 0v100" stroke="#a38463" stroke-width=".6"/><path d="M0 0v100" stroke="#594735" stroke-width="1"/></pattern></defs><rect width="160" height="100" fill="url(#w)"/></svg>')}`,
  "steel-satin": `data:image/svg+xml;utf8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#9a9da1"/><stop offset=".5" stop-color="#b9bcc0"/><stop offset="1" stop-color="#8e9195"/></linearGradient></defs><rect width="160" height="100" fill="url(#g)"/><g stroke="#6f7276" stroke-width="1.2"><line x1="40" y1="0" x2="40" y2="100"/><line x1="80" y1="0" x2="80" y2="100"/><line x1="120" y1="0" x2="120" y2="100"/></g></svg>',
  )}`,
  "composite-light": `data:image/svg+xml;utf8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100"><rect width="160" height="100" fill="#e2e0da"/><g stroke="#b7b4ad" stroke-width="1.2"><line x1="40" y1="0" x2="40" y2="100"/><line x1="80" y1="0" x2="80" y2="100"/><line x1="120" y1="0" x2="120" y2="100"/></g></svg>',
  )}`,
  gres: `data:image/svg+xml;utf8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100"><rect width="160" height="100" fill="#b9afa2"/><g stroke="#8f867a" stroke-width="1.2"><line x1="40" y1="0" x2="40" y2="100"/><line x1="80" y1="0" x2="80" y2="100"/><line x1="120" y1="0" x2="120" y2="100"/></g></svg>',
  )}`,
};

/* ---------------------------------------------------------------- 06 */

export function LightTray({ tab, setTab }: DecisionProps) {
  const { t } = useI18n();
  const { config, togglePoolFeature, setLedColor, setLedIntensity, setSceneTime, setLedType, setLedPerimeterSides } =
    useConfigurator();
  const hasLed = config.features.includes("ledLighting");
  const perimeter = hasLed && poolLedType(config.ledType) === "perimeter";
  const perimeterPlan = useMemo(() => configuredPerimeterLights(config), [config]);
  const stairSpots = useMemo(() => configuredPoolLayout(config).stairMicroSpots, [config]);
  const hasStairLed = config.features.includes("stairLighting") && stairSpots.length > 0;
  const hasBenchLed = config.features.includes("hydromassageBenchLighting");
  const hasAnyLed = hasLed || hasStairLed || (hasBenchLed && config.features.includes("hydromassage"));
  const plan = useMemo(() => (hasLed ? configuredLightingPlan(config) : null), [config, hasLed]);
  useEffect(() => { if (tab === "color" && hasLed) setSceneTime("night"); }, [tab, hasLed]);
  const night = config.sceneTime === "night";
  return (
    <TabBody>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StepTabs
          label={t("Acqua e luci")}
          value={tab}
          onChange={(next) => {
            setTab(next);
            // Choosing a colour is judged in the dark.
            if (next === "color" && hasLed) setSceneTime("night");
          }}
          tabs={[
            { id: "lighting", label: "Illuminazione" },
            ...(hasLed ? [{ id: "color" as const, label: "Colore LED" }] : []),
          ]}
        />
        {hasAnyLed ? (
          <div
            role="radiogroup"
            aria-label={t("Anteprima luce")}
            data-wizard-guidance-ignore
            className="inline-flex items-center gap-0.5 rounded-full border border-hairline bg-card p-0.5"
          >
            <span className="px-2.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {t("Anteprima")}</span>
            {(
              [
                { id: "day", label: "Giorno", Icon: Sun },
                { id: "night", label: "Notte", Icon: Moon },
              ] as const
            ).map(({ id, label, Icon }) => {
              const active = (id === "night") === night;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setSceneTime(id)}
                  className={cn(
                    "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[12px] transition-colors duration-200",
                    active
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-3.5" strokeWidth={1.4} aria-hidden />
                  {t(label)}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
      {tab === "lighting" ? (<>
        <ChoiceGrid label={t("Illuminazione subacquea")}>
          <ChoiceCard
            title={t("Senza illuminazione")}
            description={t("Nessun faro subacqueo a parete. I micro-spot delle scale sono indipendenti.")}
            image={ill("led-off")}
            selected={!hasLed}
            onSelect={() => {
              if (hasLed) togglePoolFeature("ledLighting");
            }}
          />
          {stairSpots.length > 0 ? <ChoiceCard
            title={t("+ Micro-spot sulle scale")}
            description={t("Micro-spot discreti nelle alzate, coordinati al colore dei fari piscina. Optional indipendente.")}
            image={ill("led-on")}
            selected={hasStairLed}
            footer={stairSpots.length ? `${stairSpots.length} micro-spot · nelle alzate` : "Seleziona una scala interna o un accesso comfort compatibile"}
            onSelect={() => {
              togglePoolFeature("stairLighting");
              if (!hasStairLed) setSceneTime("night");
            }}
          /> : <p className="text-sm text-muted-foreground">{t("Micro-spot sulle scale: seleziona una scala interna o un accesso comfort compatibile.")}</p>}
          <ChoiceCard
            title={t("LED subacquei")}
            description={t("Fari RGB a parete, disposti automaticamente. Anteprima notturna.")}
            image={ill("led-on")}
            selected={hasLed && !perimeter}
            onSelect={() => {
              setLedType("underwater");
              setSceneTime("night");
              setTab("color");
            }}
            footer={plan ? `${plan.count} fari · ${plan.surfaceArea.toFixed(1)} m²` : undefined}
          />
          <ChoiceCard title={t("LED perimetrali")}
            description={t("Fascia continua sotto il bordo, rivolta verso la vasca. Scegli i lati da illuminare.")}
            image={<svg viewBox="0 0 160 100" fill="none" aria-hidden><rect x="25" y="20" width="110" height="60" rx="7" stroke="currentColor" opacity=".2"/><path d="M33 66V31a3 3 0 013-3h88" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>}
            selected={perimeter} onSelect={() => { setLedType("perimeter"); setSceneTime("night"); }} />
          {config.features.includes("hydromassage") ? (
            <ChoiceCard
              title={t("Micro-spot sulla panca")}
              description={t("Micro-spot sotto la seduta, coordinati al colore dei fari piscina. Optional indipendente.")}
              image={ill("led-on")}
              selected={hasBenchLed}
              onSelect={() => {
                togglePoolFeature("hydromassageBenchLighting");
                if (!hasBenchLed) setSceneTime("night");
              }}
            />
          ) : null}
        </ChoiceGrid>
        {perimeter ? <PerimeterLightSelector plan={perimeterPlan} onChange={setLedPerimeterSides}/> : null}
      </>) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <LedColorWheel value={config.ledColor ?? "#ffffff"} onChange={setLedColor} />
          <LedIntensityControl value={config.ledIntensity} onChange={setLedIntensity} />
        </div>
      )}
    </TabBody>
  );
}

/* ---------------------------------------------------------------- 07 */

const PAVING_IMAGES: Record<string, string | undefined> = {
  gres: `data:image/svg+xml;utf8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100"><rect width="160" height="100" fill="#b9afa2"/><g stroke="#8f867a" stroke-width="1.2"><line x1="40" y1="0" x2="40" y2="100"/><line x1="80" y1="0" x2="80" y2="100"/><line x1="120" y1="0" x2="120" y2="100"/></g></svg>',
  )}`,
  wood: "/textures/coping/deck/basecolor.png",
};

export function DeckTray({ tab, setTab }: DecisionProps) {
  const { t } = useI18n();
  const { config, setCopingMaterial, setCopingStyle, setCopingEdge, setPaving, setPavingFormat } = useConfigurator();
  const deckCoping = integratedCoping(config);
  const layout = pavingLayout(config.paving, config.pavingFormat);
  const copingVisible = !(config.system === "overflow" && config.overflowType === "visible");
  // Disclosure is presentation-only; it must not create a technical selection
  // or dirty a saved project. Each existing subcategory keeps its own guide.
  const [openFamilies, setOpenFamilies] = useState<Partial<Record<string, FinishFamily | null>>>({});
  const formatGuide = useFinishGuide();
  const openFamily = openFamilies[tab] === undefined
    ? finishFamily(tab === "coping" ? config.copingMaterial ?? "travertine" : pavingId(config.paving))
    : openFamilies[tab];
  const open = (family: FinishFamily | null) => setOpenFamilies(current => ({ ...current, [tab]: family }));
  return (
    <TabBody>
      <StepTabs
        label={t("Bordo e decking")}
        value={tab}
        onChange={setTab}
        tabs={[
          ...(copingVisible ? [{ id: "coping" as const, label: "Bordo vasca" }] : []),
          { id: "paving" as const, label: "Pavimentazione" },
        ]}
      />
      {tab === "coping" && copingVisible ? (
        <div className="space-y-4">
        {supportsCopingStyle(config) ? <ChoiceGrid label={t("Tipo di bordo")}>
          <ChoiceCard title={t("Bordo dedicato")} description={t(config.shape === "rectangle" ? "Angoli vasca arrotondati R20 cm, finitura del bordo indipendente." : "Finitura del bordo indipendente dalla pavimentazione.")}
            image="/product-previews/coping-dedicated.jpg" selected={!deckCoping} onSelect={() => setCopingStyle("dedicated")} />
          <ChoiceCard title={t("Bordo filo pavimentazione")} description={t("Un unico piano e la stessa finitura della pavimentazione.")}
            image="/product-previews/coping-flush.jpg" selected={deckCoping} onSelect={() => setCopingStyle("flush")} />
        </ChoiceGrid> : null}
        {supportsCopingEdge(config) ? <ChoiceGrid label={t("Angoli della vasca")} dense>
          {(["square", "rounded"] as const).map(edge => <ChoiceCard compact key={edge}
            title={t(edge === "square" ? "Retto" : "Arrotondato")}
            description={t(edge === "square" ? "Angoli della vasca a 90°." : config.shape === "l-shape" ? "Angoli esterni arrotondati: raggio 20 cm." : "Angoli vasca arrotondati: raggio 20 cm.")}
            image={<svg aria-hidden="true" viewBox="0 0 120 60" className="h-full w-full" fill="none" stroke="currentColor" strokeWidth="2">
              <path d={edge === "square" ? "M18 45V15H102" : "M18 45V29A14 14 0 0 1 32 15H102"} />
            </svg>}
            selected={(config.copingEdge ?? "square") === edge} onSelect={() => setCopingEdge(edge)} />)}
        </ChoiceGrid> : null}
        {deckCoping ? <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">{t("Il bordo segue materiale, formato e posa della pavimentazione.")}</p>
          <button type="button" className="inline-flex items-center gap-2 self-start text-sm" onClick={() => setTab("paving")}>
            {t("Scegli pavimentazione")} <ArrowRight className="size-4" />
          </button>
        </div> : <ChoiceGrid label={t("Materiale del bordo")} dense>
          {copingMaterialsForPool(config.poolType).filter(option => config.poolType === "above-ground" || (!isPorcelainReference(option.id) && !isTravertineReference(option.id))).map((option) => (
            config.poolType === "in-ground" && (option.id === "anthracite-gres" || option.id === "travertine") ?
            <FinishFamilyChoice key={option.id} family={option.id === "travertine" ? "travertine" : "porcelain"}
              value={config.copingMaterial ?? "travertine"} onSelect={setCopingMaterial}
              open={openFamily === (option.id === "travertine" ? "travertine" : "porcelain")}
              onOpen={() => open(option.id === "travertine" ? "travertine" : "porcelain")} /> :
            <ChoiceCard
              compact
              key={option.id}
              title={t(option.title)}
              description={t(COPING_COPY[option.id] ?? option.subtitle)}
              image={isReferenceFinish(option.id) ? <ReferenceFinishSwatch id={option.id} /> : hasProductMedia(`coping-${option.id}`) ? <ProductMedia name={`coping-${option.id}`} /> : getCopingSwatchDataUrl(option.id)}
              selected={(config.copingMaterial ?? "travertine") === option.id}
              onSelect={() => { open(null); setCopingMaterial(option.id); }}
            />
          ))}
        </ChoiceGrid>}
        </div>
      ) : (
        <div className="space-y-5">
        <ChoiceGrid label={t("Pavimentazione")} dense>
          {pavingMaterialsForPool(config.poolType).filter(p => config.poolType === "above-ground" || (!isPorcelainReference(p.id) && !isTravertineReference(p.id))).map((p) => (
            config.poolType === "in-ground" && (p.id === "gres" || p.id === "travertine") ?
            <FinishFamilyChoice key={p.id} family={p.id === "travertine" ? "travertine" : "porcelain"}
              value={pavingId(config.paving)} onSelect={id => { setPaving(id); formatGuide.request(); }}
              open={openFamily === (p.id === "travertine" ? "travertine" : "porcelain")}
              onOpen={() => open(p.id === "travertine" ? "travertine" : "porcelain")} /> :
            <ChoiceCard
              key={p.id}
              compact
              title={t(p.label)}
              description={t(p.note)}
              image={
                isReferenceFinish(p.id) ? <ReferenceFinishSwatch id={p.id} /> : hasProductMedia(`paving-${p.id}`) ? <ProductMedia name={`paving-${p.id}`} /> : PAVING_IMAGES[p.id] ?? (p.id !== "gres" && p.id !== "wood" && p.id !== "istria" ? getCopingSwatchDataUrl(p.id) : (
                  <span
                    className="block h-full w-full rounded-xl"
                    style={{ background: p.color }}
                  />
                ))
              }
              selected={pavingId(config.paving) === p.id}
              onSelect={() => { open(null); setPaving(p.id); formatGuide.request(); }}
            />
          ))}
        </ChoiceGrid>
        <GuidedFinishSection guide={formatGuide.guide} label={t("Formato pavimentazione")}>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{t("Formato ·")}{t(layout.label)}</p>
          <ChoiceGrid label={t("Formato pavimentazione")} dense>
            {pavingFormats(config.paving).map(format => (
              <ChoiceCard compact key={format} title={t(PAVING_FORMATS[format].label)}
                image={<svg aria-hidden="true" viewBox="0 0 120 60" className="h-full w-full" fill="none" stroke="currentColor" strokeWidth="1">
                  <rect x={60 - Math.min(50, 25 * PAVING_FORMATS[format].module[0] / PAVING_FORMATS[format].module[1])}
                    y={30 - Math.min(25, 50 * PAVING_FORMATS[format].module[1] / PAVING_FORMATS[format].module[0])}
                    width={Math.min(100, 50 * PAVING_FORMATS[format].module[0] / PAVING_FORMATS[format].module[1])}
                    height={Math.min(50, 100 * PAVING_FORMATS[format].module[1] / PAVING_FORMATS[format].module[0])} rx="1" />
                </svg>}
                selected={layout.formatId === format} onSelect={() => setPavingFormat(format)} />
            ))}
          </ChoiceGrid>
          <p className="text-xs text-muted-foreground">{t("Dimensioni di riferimento della posa. Formati e spessori di fornitura da confermare.")}</p>
        </GuidedFinishSection>
        </div>
      )}
    </TabBody>
  );
}

/* ---------------------------------------------------------------- 08 */

export function OptionalTray({ ctx, tab, setTab }: { ctx: TrayContext } & DecisionProps) {
  const { t } = useI18n();
  const { config, toggleEquipment, setCoverExtension } = useConfigurator();
  const coverOn = config.equipment.includes("automaticCover");
  const coverPlan = resolveAutomaticCover(
    coverOn ? config : { ...config, equipment: [...config.equipment, "automaticCover"] },
  );
  const coverPercent = Math.round(resolveAutomaticCover(config).extension * 100);
  const item = (id: (typeof EQUIPMENT)[number]["id"]) => EQUIPMENT.find((e) => e.id === id)!;
  const card = (id: (typeof EQUIPMENT)[number]["id"], onSelect?: () => void) => (
    <ChoiceCard
      key={id}
      optional
      title={t(item(id).title)}
      description={t(id === "loungers" ? "Esse · Lyxo, con telaio e cuscino per la pavimentazione." : item(id).description)}
      image={id === "loungers" ? "/product-previews/lympha-deck.jpg" : ill(`equipment-${id}`)}
      imageFit={id === "loungers" ? "contain" : "cover"}
      {...(id === "loungers" ? { footer: t("Visibili nella presentazione finale.") } : {})}
      selected={config.equipment.includes(id)}
      onSelect={onSelect ?? (() => toggleEquipment(id))}
    />
  );
  return (
    <TabBody>
      <StepTabs
        label={t("Optional")}
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "outdoor", label: "Esterni" },
          { id: "water", label: "Trattamento acqua" },
          { id: "heat", label: "Temperatura" },
        ]}
      />
      {tab === "outdoor" ? (
        <div className="flex flex-col gap-5">
          <ChoiceGrid label={t("Optional esterni")}>
            {coverOn || coverPlan.status !== "UNAVAILABLE"
              ? card("automaticCover", () => {
                  toggleEquipment("automaticCover");
                  ctx.focus(null);
                })
              : null}
            {config.poolType === "above-ground" ? card("pellicano") : null}
            {config.system === "infinity" ? null : card("loungers")}
            {card("solarShower")}
          </ChoiceGrid>
          {config.system === "infinity" ? (
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              {t("Con il bordo Infinity l’esterno è il paesaggio: niente lettini sul bordo a sfioro. La doccia solare resta nella proposta, posizionata in fase di progetto.")}</p>
          ) : null}
          {coverOn && coverPlan.status !== "UNAVAILABLE" ? (
            <div className="flex max-w-xl flex-col gap-2 rounded-2xl border border-hairline p-4" data-wizard-guidance-group tabIndex={-1}>
              <div className="flex items-baseline justify-between">
                <GroupLabel>{t("Apertura copertura")}</GroupLabel>
                <output className="font-mono text-xs text-muted-foreground">
                  {coverPercent}{t("% chiusa")}</output>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={coverPercent}
                aria-label={t("Estensione copertura automatica")}
                onChange={(event) => setCoverExtension(Number(event.target.value) / 100)}
                className="h-9 w-full accent-[var(--foreground)]"
              />
            </div>
          ) : null}
          {!coverOn && coverPlan.status === "UNAVAILABLE" && coverPlan.reason ? (
            <p className="text-xs text-muted-foreground">
              {t("Copertura automatica:")}{t(coverPlan.reason)}
            </p>
          ) : null}
        </div>
      ) : tab === "water" ? (
        <ChoiceGrid label={t("Trattamento acqua")}>
          {card("saltElectrolysis")}
          {card("automaticDosing")}
        </ChoiceGrid>
      ) : (
        <ChoiceGrid label={t("Temperatura")}>{card("heatPump")}</ChoiceGrid>
      )}
    </TabBody>
  );
}

/* ---------------------------------------------------------------- 09 */

export function PresentationTray({ ctx, tab, setTab }: { ctx: TrayContext } & DecisionProps) {
  const { t } = useI18n();
  const { config, setSceneTime, projectConfiguration } = useConfigurator();
  const delivery = useProjectDelivery();
  // The recap opens with a clean capture of the configured pool.
  const { heroUrl, setHeroUrl } = delivery;
  const capture = ctx.captureHero;
  useEffect(() => {
    if (tab !== "summary" || heroUrl || !capture) return;
    let active = true;
    void capture().then((url) => {
      if (active && url) setHeroUrl(url);
    });
    return () => {
      active = false;
    };
  }, [tab, heroUrl, capture, setHeroUrl]);
  const night = config.sceneTime === "night";
  return (
    <TabBody>
      <StepTabs
        label={t("Presentazione")}
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "scene", label: "Scena" },
          { id: "summary", label: "Riepilogo" },
          { id: "request", label: "Richiedi proposta" },
        ]}
      />
      {tab === "scene" ? (
        <div className="flex flex-col gap-5" data-wizard-guidance-ignore>
          {ctx.openGardenStudio ? <Button variant="outline" onClick={ctx.openGardenStudio}>{t("Nel tuo giardino")}</Button> : null}
          {ctx.presentationContext ? <PresentationContextPicker choice={ctx.presentationContext} /> : null}
          <GroupLabel>{t("Momento della giornata")}</GroupLabel>
          <ChoiceGrid label={t("Momento della giornata")} dense>
            <ChoiceCard
              compact
              title={t("Giorno")}
              description={t("Luce naturale, colori reali del rivestimento.")}
              image={ill("time-day")}
              selected={!night}
              onSelect={() => setSceneTime("day")}
            />
              <ChoiceCard
                compact
                title={t("Notte")}
                description={t("Scena notturna, con le luci selezionate.")}
                image={ill("time-night")}
                selected={night}
                onSelect={() => setSceneTime("night")}
              />
          </ChoiceGrid>
        </div>
      ) : tab === "summary" ? (
        <div className="flex max-w-3xl flex-col gap-4">
          <ProjectDeliveryPanel
            delivery={delivery}
            captureHero={ctx.captureHero}
            captureDayNight={ctx.captureDayNight}
          />
          <ProposalComparison captureHero={ctx.captureHero} onApplied={() => delivery.setHeroUrl(null)} />
          <ProjectSummary publicRef={delivery.link?.publicRef} heroUrl={delivery.heroUrl} />
        </div>
      ) : (
        <section className="flex max-w-xl flex-col items-start gap-4">
          <h3 className="text-[20px] font-extralight tracking-[-0.015em] text-foreground">
            {t("Vuoi trasformare questo progetto in una proposta reale?")}</h3>
          <p className="text-[13px] leading-[1.7] font-light text-muted-foreground">
            {t("Un consulente verifica configurazione, fattibilità e investimento.")}</p>
          <LeadRequestDialog
            projectConfiguration={projectConfiguration}
            projectReference={delivery.link?.publicRef}
            prepareProject={async () => {
              const saved = await delivery.save();
              return saved ? { projectConfiguration: saved.projectConfiguration, projectReference: saved.publicRef } : null;
            }}
          />
        </section>
      )}
    </TabBody>
  );
}
