import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowRight, Check, Moon, Plus, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConfigurator } from "@/lib/pool/context";
import {
  EQUIPMENT,
  LINER_COLORS,
  POOL_SHAPES,
  CUSTOMER_STRUCTURES,
  customerStructureOf,
  POOL_TYPES,
  PROJECT_TYPES,
  SKIMMER_FINISHES,
  SKIMMER_TYPES,
} from "@/lib/pool/config";
import { COPING_MATERIALS } from "@/lib/pool/coping-materials";
import { PAVING, pavingId } from "@/lib/pool/presentation";
import { MOSAIC_FINISHES } from "@/configurator/materials/interior-textures";
import { isVisibleStainlessStructure } from "@/lib/pool/structure-finish";
import { compatibleInfinityZones } from "@/lib/pool/infinity-edge";
import { configuredAccessPlan } from "@/lib/pool/access-plan";
import { configuredComfortPlan, normalizeComfortFeatures } from "@/lib/pool/comfort-plan";
import { configuredPoolLayout } from "@/lib/pool/resolved-layout";
import { configuredLightingPlan } from "@/lib/pool/lighting-plan";
import { resolveAutomaticCover } from "@/lib/pool/cover-plan";
import { getCopingSwatchDataUrl } from "@/components/pool/copingSwatchPreview";
import { InfinitySideSelector } from "@/configurator/steps/pool-system/InfinitySideSelector";
import { LedColorWheel } from "@/configurator/steps/pool-features/LedColorWheel";
import { LedIntensityControl } from "@/configurator/steps/pool-features/LedIntensityControl";
import { LeadRequestDialog } from "@/configurator/steps/final-review/LeadRequestDialog";
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

/** What a tray may ask of the shell: point the camera at what is being edited,
 * and the presentation controls the shell owns (photo mode). */
export interface TrayContext {
  focus: (intent: SceneFocus | null) => void;
  /** Bumped by the final step's primary action: opens the proposal request. */
  requestToken?: number;
  photoMode?: { available: boolean; reason?: string; enter: () => void };
  /** Clean hero capture of the configured pool (Build 2). */
  captureHero?: () => Promise<string | null>;
  captureDayNight?: () => Promise<DayNightCapture>;
}

const ill = (name: string) => <Illustration name={name} />;

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
  prun: "Pietra grigia con inclusioni minerali.",
  travertine: "Pietra italiana calda, venatura naturale.",
  "anthracite-gres": "Gres porcellanato opaco, resistente e uniforme.",
  ardesia: "Ardesia naturale, scura e materica.",
  "deck-marrone": "Doghe in legno dal tono bruno.",
  wpc: "Composito legno-polimero, senza manutenzione.",
};

function useTab<T extends string>(initial: T, reset: unknown) {
  const [tab, setTab] = useState<T>(initial);
  useEffect(() => setTab(initial), [reset]); // eslint-disable-line react-hooks/exhaustive-deps
  return [tab, setTab] as const;
}

function TabBody({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-4 animate-rise">{children}</div>;
}

/* ---------------------------------------------------------------- 01 */

export function ProjectTray() {
  const { config, setProjectType } = useConfigurator();
  return (
    <ChoiceGrid label="Tipo di progetto">
      {PROJECT_TYPES.map((item) => (
        <ChoiceCard
          key={item.id}
          title={item.title}
          description={item.description}
          image={ill(`project-${item.id}`)}
          selected={config.projectType === item.id}
          onSelect={() => setProjectType(item.id)}
        />
      ))}
    </ChoiceGrid>
  );
}

export function PoolTypeTray() {
  const { config, setPoolType } = useConfigurator();
  return (
    <ChoiceGrid label="Tipo di piscina">
      {POOL_TYPES.map((item) => (
        <ChoiceCard
          key={item.id}
          title={item.title}
          description={item.description}
          image={ill(`pooltype-${item.id}`)}
          selected={config.poolType === item.id}
          onSelect={() => setPoolType(item.id)}
        />
      ))}
    </ChoiceGrid>
  );
}

export function StructureTray() {
  const { config, setPoolStructure } = useConfigurator();
  const structures = CUSTOMER_STRUCTURES.filter((s) =>
    config.poolType ? s.poolTypes.includes(config.poolType) : false,
  );
  const current = customerStructureOf(config.structure);
  return (
    <ChoiceGrid label="Struttura della piscina">
      {structures.map((item) => (
        <ChoiceCard
          key={item.id}
          title={item.title}
          description={item.description}
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

export function ShapeTray({ ctx }: { ctx: TrayContext }) {
  const { config, setShape, setCustomMode, setDimension, metrics } = useConfigurator();
  const [tab, setTab] = useState<"shape" | "plan" | "depth">(
    config.shapeSelected ? "plan" : "shape",
  );
  const choose = (next: typeof tab) => {
    setTab(next);
    ctx.focus(next === "plan" ? "top" : next === "depth" ? "depth" : null);
  };
  const supportsProfile =
    config.poolType === "in-ground" &&
    (config.shape === "rectangle" || config.shape === "l-shape" || config.shape === "organic");
  return (
    <TabBody>
      <StepTabs
        label="Forma e dimensioni"
        value={tab}
        onChange={choose}
        tabs={[
          { id: "shape", label: "Forma" },
          { id: "plan", label: "Lunghezza e larghezza" },
          { id: "depth", label: "Profondità" },
        ]}
      />
      {tab === "shape" ? (
        <ChoiceGrid label="Forma della piscina">
          {POOL_SHAPES.map((shape) => (
            <ChoiceCard
              key={shape.id}
              title={shape.title}
              description={shape.description}
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
                  label={key === "length" ? "Lunghezza" : "Larghezza"}
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
                  label="Metodo forma personalizzata"
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
                    label="Riferimento architettonico"
                    hint="PDF, planimetria o immagine di riferimento."
                  />
                )}
              </>
            ) : (
              <p className="text-[12.5px] leading-relaxed font-light text-muted-foreground">
                La vista dall’alto mostra la pianta in scala reale. Trascina i cursori: la vasca si
                ridimensiona in tempo reale.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-3">
            <GroupLabel>Valori calcolati</GroupLabel>
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
              label="Profondità"
              value={config.dimensions.depth}
              unit={DIMENSION_LIMITS.depth.unit}
              min={DIMENSION_LIMITS.depth.min}
              max={DIMENSION_LIMITS.depth.max}
              step={DIMENSION_LIMITS.depth.step}
              onChange={(value) => setDimension("depth", value)}
            />
          )}
          <div className="flex flex-col gap-3">
            <GroupLabel>Valori calcolati</GroupLabel>
            <MetricsPanel metrics={metrics} />
          </div>
        </div>
      ) : null}
    </TabBody>
  );
}

/* ---------------------------------------------------------------- 03 */

export function SystemTray() {
  const {
    config,
    outline,
    setSystem,
    setOverflowType,
    setSkimmerFinish,
    setSkimmerType,
    setInfinitySide,
  } = useConfigurator();
  const infinityAvailable =
    compatibleInfinityZones(outline, config.shape, config.poolType).length > 0;
  const [tab, setTab] = useTab<"system" | "detail">("system", config.system);
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
        label="Sistema piscina"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "system", label: "Sistema" },
          { id: "detail", label: detailLabel },
        ]}
      />
      {tab === "system" ? (
        <ChoiceGrid label="Sistema idraulico">
          {systems.map((item) => (
            <ChoiceCard
              key={item.id}
              title={item.title}
              description={item.description}
              image={ill(`system-${item.id}`)}
              selected={config.system === item.id}
              onSelect={() => setSystem(item.id)}
            />
          ))}
        </ChoiceGrid>
      ) : config.system === "skimmer" ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-3">
            <GroupLabel>Modello</GroupLabel>
            <ChoiceGrid label="Tipo skimmer" dense>
              {SKIMMER_TYPES.map((item) => (
                <ChoiceCard
                  compact
                  key={item.id}
                  title={item.title}
                  description={item.description}
                  image={ill("system-skimmer")}
                  selected={config.skimmerType === item.id}
                  onSelect={() => setSkimmerType(item.id)}
                />
              ))}
            </ChoiceGrid>
          </div>
          <div className="flex flex-col gap-3">
            <GroupLabel>Finitura</GroupLabel>
            <ChoiceGrid label="Finitura skimmer" dense>
              {SKIMMER_FINISHES.map((item) => (
                <ChoiceCard
                  compact
                  key={item.id}
                  title={item.title}
                  description={SKIMMER_FINISH_COPY[item.id] ?? "Finitura del frontalino."}
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
        <ChoiceGrid label="Tipo di sfioro">
          <ChoiceCard
            title="Sfioro nascosto"
            description="Il canale scompare sotto il bordo in pietra."
            image={ill("overflow-hidden")}
            selected={config.overflowType === "hidden"}
            onSelect={() => setOverflowType("hidden")}
          />
          <ChoiceCard
            title="Sfioro a vista"
            description="Griglia perimetrale a vista lungo il bordo."
            image={ill("overflow-visible")}
            selected={config.overflowType === "visible"}
            onSelect={() => setOverflowType("visible")}
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
        </div>
      )}
    </TabBody>
  );
}

/* ---------------------------------------------------------------- 04 */

export function AccessTray() {
  const {
    config,
    togglePoolFeature,
    setPoolAccess,
    setInternalStairType,
    setHydromassageVariant,
    toggleInternalSteps,
    toggleInoxLadder,
  } = useConfigurator();
  const [tab, setTab] = useState<"access" | "comfort">("access");
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
  const inoxAvailable = inoxOn || !!inoxPlan?.placement;

  const comfort = useMemo(() => configuredComfortPlan(config), [config]);
  const shelfOn = config.features.includes("sunShelf");
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
      if (!shelfOn) togglePoolFeature("sunShelf");
      return;
    }
    setHydromassageVariant(choice);
    if (!hydroOn) togglePoolFeature("hydromassage");
  };
  const comfortChoice = shelfOn ? "sunShelf" : hydroOn ? hydroVariant : "none";
  const benchOn = config.features.includes("integratedBench");
  const benchAvailable =
    shelfOn && !hydroOn && (benchOn || comfort.availability.integratedBench.available);

  return (
    <TabBody>
      <StepTabs
        label="Accesso e comfort"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "access", label: "Accesso" },
          // Above ground there is no shelf, bench or hydromassage to choose.
          ...(config.poolType === "above-ground"
            ? []
            : [{ id: "comfort" as const, label: "Comfort in acqua" }]),
        ]}
      />
      {tab === "access" || config.poolType === "above-ground" ? (
        <div className="flex flex-col gap-5">
          <ChoiceGrid label="Accesso alla piscina">
            <ChoiceCard
              title="Scala interna"
              description="Gradini in muratura, rivestiti come la vasca."
              image={ill("access-steps")}
              selected={stepsOn}
              onSelect={() => {
                setStairsJustChosen(!stepsOn);
                toggleInternalSteps();
              }}
            />
            {inoxAvailable ? (
              <ChoiceCard
                optional={stepsOn}
                title="Scaletta inox"
                description={
                  stepsOn
                    ? "Aggiuntiva alla scala interna."
                    : "Corrimano tubolari e pedate antiscivolo."
                }
                image={ill("access-ladder")}
                selected={inoxOn}
                onSelect={() => toggleInoxLadder()}
              />
            ) : null}
            {config.poolType === "above-ground" ? (
              <ChoiceCard
                optional
                title="Scala esterna di accesso"
                description="Blocco a gradini rivestito come la piscina, pedate nel materiale del bordo."
                image={ill("access-external")}
                selected={config.features.includes("externalStaircase")}
                onSelect={() => togglePoolFeature("externalStaircase")}
              />
            ) : null}
          </ChoiceGrid>
          {stepsOn &&
          !comfort.elements.some((e) => e.kind === "sunShelf" || e.kind === "hydromassage") ? (
            <RevealSection reveal={stairsJustChosen}>
              <GroupLabel>Forma della scala</GroupLabel>
              <ChoiceGrid label="Tipo di scala interna" dense>
                {(["linear", "corner"] as const)
                  .filter((type) => !plans[type].reason || stairType === type)
                  .map((type) => (
                    <ChoiceCard
                      compact
                      key={type}
                      title={type === "linear" ? "Rettilinea" : "Angolare"}
                      description={
                        type === "linear"
                          ? "Gradini dritti sul lato corto."
                          : "Gradini a quarto di cerchio nell’angolo."
                      }
                      image={ill(type === "linear" ? "access-steps-linear" : "access-steps-corner")}
                      selected={stairType === type}
                      onSelect={() => setInternalStairType(type)}
                      footer={plans[type].reason ? undefined : `${plans[type].steps} gradini`}
                    />
                  ))}
              </ChoiceGrid>
              {inoxAvailable ? (
                <button
                  type="button"
                  aria-pressed={inoxOn}
                  onClick={() => toggleInoxLadder()}
                  className={cn(
                    "inline-flex w-fit items-center gap-2 rounded-full border px-3.5 py-2 text-[12px] transition-colors duration-200",
                    inoxOn
                      ? "border-brand/30 bg-brand-soft text-foreground"
                      : "border-hairline bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  {inoxOn ? (
                    <Check className="size-3.5 text-brand" strokeWidth={1.8} aria-hidden />
                  ) : (
                    <Plus className="size-3.5 text-brand" strokeWidth={1.6} aria-hidden />
                  )}
                  {inoxOn ? "Scaletta inox aggiunta" : "Aggiungi anche la scaletta inox"}
                </button>
              ) : null}
            </RevealSection>
          ) : null}
          {config.poolType === "above-ground" ? null : (
            <button
              type="button"
              onClick={() => setTab("comfort")}
              className="inline-flex w-fit items-center gap-1.5 self-start rounded-full px-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
            >
              Prosegui con <span className="text-foreground">Comfort in acqua</span>
              <ArrowRight className="size-3.5 text-brand" strokeWidth={1.5} aria-hidden />
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <ChoiceGrid label="Zona comfort">
            <ChoiceCard
              title="Nessuna zona comfort"
              description="Vasca libera, solo la scala scelta."
              image={ill("comfort-none")}
              selected={comfortChoice === "none"}
              onSelect={() => chooseComfort("none")}
            />
            {shelfOn || shelfProposal.availability.sunShelf.available ? (
              <ChoiceCard
                title="Sun shelf"
                description="Solarium sommerso a 22 cm per sdraiarsi in acqua."
                image={ill("comfort-sunShelf")}
                selected={comfortChoice === "sunShelf"}
                onSelect={() => chooseComfort("sunShelf")}
              />
            ) : null}
            {hydroOn || hydroProposal.availability.hydromassage.available ? (
              <>
                <ChoiceCard
                  title="Idromassaggio A"
                  description="Zona delimitata da un muretto, panca a L con getti."
                  image={ill("comfort-hydro-closed")}
                  selected={comfortChoice === "closed"}
                  onSelect={() => chooseComfort("closed")}
                />
                <ChoiceCard
                  title="Idromassaggio B"
                  description="Panca a U con getti, aperta sulla vasca."
                  image={ill("comfort-hydro-open")}
                  selected={comfortChoice === "open"}
                  onSelect={() => chooseComfort("open")}
                />
              </>
            ) : null}
          </ChoiceGrid>
          {benchAvailable ? (
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
                  <span className="font-normal text-foreground">Per il tuo Sun shelf</span> ·
                  compare solo con questa scelta
                </span>
              </p>
              <ChoiceGrid label="Panca integrata" dense>
                <ChoiceCard
                  compact
                  optional
                  title="Panca integrata"
                  description="Seduta sommersa lungo parete."
                  image={ill("comfort-bench")}
                  selected={benchOn}
                  onSelect={() => togglePoolFeature("integratedBench")}
                />
              </ChoiceGrid>
            </div>
          ) : null}
        </div>
      )}
    </TabBody>
  );
}

/* ---------------------------------------------------------------- 05 */

export function FinishTray() {
  const {
    config,
    setFinish,
    setLinerColor,
    setMosaicFinish,
    setPoolStructure,
    setExteriorPanelFinish,
  } = useConfigurator();
  const [finishTab, setFinishTab] = useState<"interior" | "exterior">("interior");
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
          label="Finiture"
          value={finishTab}
          onChange={setFinishTab}
          tabs={[
            { id: "interior", label: "Rivestimento interno" },
            { id: "exterior", label: "Pannelli esterni" },
          ]}
        />
      ) : null}
      {aboveGround && finishTab === "exterior" ? (
        <ChoiceGrid label="Pannelli esterni">
          {EXTERIOR_PANEL_FINISHES.map((panel) => (
            <ChoiceCard
              key={panel.id}
              title={panel.title}
              description={panel.description}
              image={PANEL_SWATCH[panel.id]}
              selected={exteriorPanelFinish(config.exteriorPanelFinish) === panel.id}
              onSelect={() => setExteriorPanelFinish(panel.id)}
            />
          ))}
        </ChoiceGrid>
      ) : (
        <>
          <ChoiceGrid label="Rivestimento interno">
            {options.map((option) => (
              <ChoiceCard
                key={option.id}
                title={option.title}
                description={option.description}
                image={option.image}
                selected={active === option.id}
                onSelect={option.select}
              />
            ))}
          </ChoiceGrid>
          {active === "liner" ? (
            <div className="flex flex-col gap-3">
              <GroupLabel>Colore del liner</GroupLabel>
              <ChoiceGrid label="Colore liner PVC" dense>
                {LINER_COLORS.map((color) => (
                  <ChoiceCard
                    compact
                    key={color.id}
                    title={color.title.replace("Motion ", "")}
                    description={LINER_COPY[color.id] ?? "Liner PVC armato."}
                    image={color.texture}
                    selected={config.linerColor === color.id}
                    onSelect={() => setLinerColor(color.id)}
                  />
                ))}
              </ChoiceGrid>
            </div>
          ) : active === "mosaic" ? (
            <div className="flex flex-col gap-3">
              <GroupLabel>Finitura mosaico</GroupLabel>
              <ChoiceGrid label="Finitura mosaico" dense>
                {MOSAIC_FINISHES.map((mosaic) => (
                  <ChoiceCard
                    compact
                    key={mosaic.id}
                    title={mosaic.name}
                    description="Tessere in vetro, posa a mano."
                    image={mosaic.preview}
                    selected={config.mosaicFinish === mosaic.id}
                    onSelect={() => setMosaicFinish(mosaic.id)}
                  />
                ))}
              </ChoiceGrid>
            </div>
          ) : null}
        </>
      )}
    </TabBody>
  );
}

/** Card images for the exterior panels: a steel swatch drawn as boards,
 * and the real textures for gres and composite. */
const PANEL_SWATCH: Record<string, string> = {
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

export function LightTray() {
  const { config, togglePoolFeature, setLedColor, setLedIntensity, setSceneTime } =
    useConfigurator();
  const hasLed = config.features.includes("ledLighting");
  const plan = useMemo(() => (hasLed ? configuredLightingPlan(config) : null), [config, hasLed]);
  const [tab, setTab] = useState<"lighting" | "color">(hasLed ? "color" : "lighting");
  const night = config.sceneTime === "night";
  // Night exists only to judge the LEDs: no LEDs, no night.
  useEffect(() => {
    if (!hasLed && night) setSceneTime("day");
  }, [hasLed, night, setSceneTime]);
  return (
    <TabBody>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StepTabs
          label="Acqua e luci"
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
        {hasLed ? (
          <div
            role="radiogroup"
            aria-label="Anteprima luce"
            className="inline-flex items-center gap-0.5 rounded-full border border-hairline bg-card p-0.5"
          >
            <span className="px-2.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Anteprima
            </span>
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
                  {label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
      {tab === "lighting" ? (
        <ChoiceGrid label="Illuminazione subacquea">
          <ChoiceCard
            title="Senza illuminazione"
            description="Nessun faro subacqueo: la piscina resta in luce diurna."
            image={ill("led-off")}
            selected={!hasLed}
            onSelect={() => {
              if (hasLed) togglePoolFeature("ledLighting");
              setSceneTime("day");
            }}
          />
          <ChoiceCard
            title="LED subacquei"
            description="Fari RGB a parete, disposti automaticamente. Anteprima notturna."
            image={ill("led-on")}
            selected={hasLed}
            onSelect={() => {
              if (!hasLed) togglePoolFeature("ledLighting");
              setSceneTime("night");
              setTab("color");
            }}
            footer={plan ? `${plan.count} fari · ${plan.surfaceArea.toFixed(1)} m²` : undefined}
          />
        </ChoiceGrid>
      ) : (
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

export function DeckTray() {
  const { config, setCopingMaterial, setPaving } = useConfigurator();
  const copingVisible = !(config.system === "overflow" && config.overflowType === "visible");
  // Above ground the pool stands on the lawn: the coping is the only finish.
  const pavingOffered = config.poolType !== "above-ground";
  const [tab, setTab] = useState<"coping" | "paving">(copingVisible ? "coping" : "paving");
  return (
    <TabBody>
      <StepTabs
        label="Bordo e decking"
        value={tab}
        onChange={setTab}
        tabs={[
          ...(copingVisible ? [{ id: "coping" as const, label: "Bordo vasca" }] : []),
          ...(pavingOffered ? [{ id: "paving" as const, label: "Pavimentazione" }] : []),
        ]}
      />
      {tab === "coping" && copingVisible ? (
        <ChoiceGrid label="Materiale del bordo" dense>
          {COPING_MATERIALS.map((option) => (
            <ChoiceCard
              compact
              key={option.id}
              title={option.title}
              description={COPING_COPY[option.id] ?? option.subtitle}
              image={getCopingSwatchDataUrl(option.id)}
              selected={(config.copingMaterial ?? "travertine") === option.id}
              onSelect={() => setCopingMaterial(option.id)}
            />
          ))}
        </ChoiceGrid>
      ) : (
        <ChoiceGrid label="Pavimentazione">
          {PAVING.map((p) => (
            <ChoiceCard
              key={p.id}
              title={p.label}
              description={p.note}
              image={
                PAVING_IMAGES[p.id] ?? (
                  <span
                    className="block h-full w-full rounded-xl"
                    style={{ background: p.color }}
                  />
                )
              }
              selected={pavingId(config.paving) === p.id}
              onSelect={() => setPaving(p.id)}
            />
          ))}
        </ChoiceGrid>
      )}
    </TabBody>
  );
}

/* ---------------------------------------------------------------- 08 */

export function OptionalTray({ ctx }: { ctx: TrayContext }) {
  const { config, toggleEquipment, setCoverExtension } = useConfigurator();
  const [tab, setTab] = useState<"outdoor" | "water" | "heat">("outdoor");
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
      title={item(id).title}
      description={item(id).description}
      image={ill(`equipment-${id}`)}
      selected={config.equipment.includes(id)}
      onSelect={onSelect ?? (() => toggleEquipment(id))}
    />
  );
  return (
    <TabBody>
      <StepTabs
        label="Optional"
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
          <ChoiceGrid label="Optional esterni">
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
              Con il bordo Infinity l’esterno è il paesaggio: niente lettini sul bordo a sfioro. La
              doccia solare resta nella proposta, posizionata in fase di progetto.
            </p>
          ) : null}
          {coverOn && coverPlan.status !== "UNAVAILABLE" ? (
            <div className="flex max-w-xl flex-col gap-2 rounded-2xl border border-hairline p-4">
              <div className="flex items-baseline justify-between">
                <GroupLabel>Apertura copertura</GroupLabel>
                <output className="font-mono text-xs text-muted-foreground">
                  {coverPercent}% chiusa
                </output>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={coverPercent}
                aria-label="Estensione copertura automatica"
                onChange={(event) => setCoverExtension(Number(event.target.value) / 100)}
                className="h-9 w-full accent-[var(--foreground)]"
              />
            </div>
          ) : null}
          {!coverOn && coverPlan.status === "UNAVAILABLE" && coverPlan.reason ? (
            <p className="text-xs text-muted-foreground">
              Copertura automatica: {coverPlan.reason}
            </p>
          ) : null}
        </div>
      ) : tab === "water" ? (
        <ChoiceGrid label="Trattamento acqua">
          {card("saltElectrolysis")}
          {card("automaticDosing")}
        </ChoiceGrid>
      ) : (
        <ChoiceGrid label="Temperatura">{card("heatPump")}</ChoiceGrid>
      )}
    </TabBody>
  );
}

/* ---------------------------------------------------------------- 09 */

export function PresentationTray({ ctx }: { ctx: TrayContext }) {
  const { config, setSceneTime, projectConfiguration, sharedProject } = useConfigurator();
  const [tab, setTab] = useState<"scene" | "summary" | "request">("scene");
  const delivery = useProjectDelivery();
  // A shared link lands on the project recap.
  useEffect(() => {
    if (sharedProject?.status === "ready") setTab("summary");
  }, [sharedProject?.status]);
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
  useEffect(() => {
    if (ctx.requestToken) setTab("request");
  }, [ctx.requestToken]);
  // Without LEDs the presentation is always the daylight one.
  const night = config.sceneTime === "night" && config.features.includes("ledLighting");
  return (
    <TabBody>
      <StepTabs
        label="Presentazione"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "scene", label: "Scena" },
          { id: "summary", label: "Riepilogo" },
          { id: "request", label: "Richiedi proposta" },
        ]}
      />
      {tab === "scene" ? (
        <div className="flex flex-col gap-5">
          <GroupLabel>Momento della giornata</GroupLabel>
          <ChoiceGrid label="Momento della giornata" dense>
            <ChoiceCard
              compact
              title="Giorno"
              description="Luce naturale, colori reali del rivestimento."
              image={ill("time-day")}
              selected={!night}
              onSelect={() => setSceneTime("day")}
            />
            {config.features.includes("ledLighting") ? (
              <ChoiceCard
                compact
                title="Notte"
                description="Il bagliore dei fari LED nell’acqua."
                image={ill("time-night")}
                selected={night}
                onSelect={() => setSceneTime("night")}
              />
            ) : null}
          </ChoiceGrid>
          {/* Outdoor Villa / Indoor Wellness are Photo Mode environments
              (Build 08), not realtime scenes: they are not offered here, so
              the live preview never shows a choice that changes nothing. */}
          {ctx.photoMode ? <GroupLabel>Immagine fotografica</GroupLabel> : null}
          <ChoiceGrid label="Immagine fotografica" dense>
            {ctx.photoMode ? (
              <ChoiceCard
                compact
                title="Modalità foto"
                description={
                  ctx.photoMode.available
                    ? "Immagine fotografica della stessa piscina, stessa geometria."
                    : (ctx.photoMode.reason ?? "Disponibile su computer desktop.")
                }
                image={ill("photo")}
                badge={ctx.photoMode.available ? undefined : "Desktop"}
                selected={false}
                onSelect={() => ctx.photoMode?.available && ctx.photoMode.enter()}
              />
            ) : null}
          </ChoiceGrid>
        </div>
      ) : tab === "summary" ? (
        <div className="flex max-w-3xl flex-col gap-4">
          <ProjectDeliveryPanel
            delivery={delivery}
            captureHero={ctx.captureHero}
            captureDayNight={ctx.captureDayNight}
          />
          <ProjectSummary publicRef={delivery.link?.publicRef} heroUrl={delivery.heroUrl} />
        </div>
      ) : (
        <section className="flex max-w-xl flex-col items-start gap-4">
          <h3 className="text-[20px] font-extralight tracking-[-0.015em] text-foreground">
            Vuoi trasformare questo progetto in una proposta reale?
          </h3>
          <p className="text-[13px] leading-[1.7] font-light text-muted-foreground">
            Un consulente verifica configurazione, fattibilità e investimento.
          </p>
          <LeadRequestDialog
            projectConfiguration={projectConfiguration}
            projectReference={delivery.link?.publicRef}
          />
        </section>
      )}
    </TabBody>
  );
}
