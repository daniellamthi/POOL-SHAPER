import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useConfigurator } from "@/lib/pool/context";
import {
  EQUIPMENT,
  FINISHES,
  LINER_COLORS,
  POOL_SHAPES,
  POOL_STRUCTURES,
  POOL_TYPES,
  PROJECT_TYPES,
  SKIMMER_FINISHES,
  SKIMMER_TYPES,
} from "@/lib/pool/config";
import { COPING_MATERIALS } from "@/lib/pool/coping-materials";
import {
  PAVING,
  PREMIUM_ENVIRONMENTS,
  pavingId,
  premiumEnvironment,
} from "@/lib/pool/presentation";
import { MOSAIC_FINISHES } from "@/configurator/materials/interior-textures";
import { allowedFinishesForStructure } from "@/lib/pool/structure-finish";
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
import { ChoiceCard, ChoiceGrid, GroupLabel, StepTabs } from "./ChoiceCard";
import { Illustration } from "./illustrations";

/** What a tray may ask of the shell: point the camera at what is being edited,
 * and the presentation controls the shell owns (photo mode). */
export interface TrayContext {
  focus: (intent: SceneFocus | null) => void;
  /** Bumped by the final step's primary action: opens the proposal request. */
  requestToken?: number;
  photoMode?: { available: boolean; reason?: string; enter: () => void };
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
  const structures = POOL_STRUCTURES.filter((s) =>
    config.poolType ? s.poolTypes.includes(config.poolType) : false,
  );
  return (
    <ChoiceGrid label="Struttura della piscina">
      {structures.map((item) => (
        <ChoiceCard
          key={item.id}
          title={item.title}
          description={item.description}
          image={ill(`structure-${item.id}`)}
          selected={config.structure === item.id}
          onSelect={() => setPoolStructure(item.id)}
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
          { id: "comfort", label: "Comfort in acqua" },
        ]}
      />
      {tab === "access" ? (
        <div className="flex flex-col gap-5">
          <ChoiceGrid label="Accesso alla piscina">
            <ChoiceCard
              title="Scala interna"
              description="Gradini in muratura, rivestiti come la vasca."
              image={ill("access-steps")}
              selected={stepsOn}
              onSelect={() => toggleInternalSteps()}
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
                title="Scala esterna"
                description="Gradini esterni fino al bordo vasca."
                image={ill("access-external")}
                selected={config.features.includes("externalStaircase")}
                onSelect={() => togglePoolFeature("externalStaircase")}
              />
            ) : null}
          </ChoiceGrid>
          {stepsOn &&
          !comfort.elements.some((e) => e.kind === "sunShelf" || e.kind === "hydromassage") ? (
            <div className="flex flex-col gap-3">
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
            </div>
          ) : null}
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
              <GroupLabel>Compatibile con il sun shelf</GroupLabel>
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
  const { config, setFinish, setLinerColor, setMosaicFinish } = useConfigurator();
  const allowed = allowedFinishesForStructure(config.structure);
  const finishes = FINISHES.filter((f) => allowed.includes(f.id));
  const active = config.finish === "mosaic" ? "mosaic" : "liner";
  const linerTexture = LINER_COLORS.find((c) => c.id === config.linerColor)?.texture;
  const mosaicPreview = MOSAIC_FINISHES.find((m) => m.id === config.mosaicFinish)?.preview;
  return (
    <TabBody>
      {finishes.length > 1 ? (
        <StepTabs
          label="Rivestimento interno"
          value={active}
          onChange={(id) => setFinish(id)}
          tabs={finishes.map((f) => ({ id: f.id as "liner" | "mosaic", label: f.title }))}
        />
      ) : null}
      {active === "liner" ? (
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
      ) : (
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
      )}
    </TabBody>
  );
}

/* ---------------------------------------------------------------- 06 */

export function LightTray() {
  const { config, togglePoolFeature, setLedColor, setLedIntensity, setSceneTime } =
    useConfigurator();
  const hasLed = config.features.includes("ledLighting");
  const plan = useMemo(() => (hasLed ? configuredLightingPlan(config) : null), [config, hasLed]);
  const [tab, setTab] = useState<"atmosphere" | "lighting" | "color">("atmosphere");
  const night = config.sceneTime === "night";
  return (
    <TabBody>
      <StepTabs
        label="Acqua e luci"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "atmosphere", label: "Acqua · giorno e notte" },
          { id: "lighting", label: "Illuminazione" },
          ...(hasLed ? [{ id: "color" as const, label: "Colore LED" }] : []),
        ]}
      />
      {tab === "atmosphere" ? (
        <ChoiceGrid label="Atmosfera">
          <ChoiceCard
            title="Giorno"
            description="Luce naturale: colore reale di acqua e rivestimento."
            image={ill("time-day")}
            selected={!night}
            onSelect={() => setSceneTime("day")}
          />
          <ChoiceCard
            title="Notte"
            description="Scena serale per vedere l’illuminazione subacquea."
            image={ill("time-night")}
            selected={night}
            onSelect={() => setSceneTime("night")}
          />
        </ChoiceGrid>
      ) : tab === "lighting" ? (
        <ChoiceGrid label="Illuminazione subacquea">
          <ChoiceCard
            title="Senza illuminazione"
            description="Nessun faro subacqueo."
            image={ill("led-off")}
            selected={!hasLed}
            onSelect={() => hasLed && togglePoolFeature("ledLighting")}
          />
          <ChoiceCard
            title="LED subacquei"
            description="Fari RGB a parete, disposti automaticamente."
            image={ill("led-on")}
            selected={hasLed}
            onSelect={() => {
              if (!hasLed) togglePoolFeature("ledLighting");
              setSceneTime("night");
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
  gres: "/textures/coping/gres/basecolor.png",
  wood: "/textures/coping/deck/basecolor.png",
};

export function DeckTray() {
  const { config, setCopingMaterial, setPaving } = useConfigurator();
  const copingVisible = !(config.system === "overflow" && config.overflowType === "visible");
  const [tab, setTab] = useState<"coping" | "paving">(copingVisible ? "coping" : "paving");
  return (
    <TabBody>
      <StepTabs
        label="Bordo e decking"
        value={tab}
        onChange={setTab}
        tabs={[
          ...(copingVisible ? [{ id: "coping" as const, label: "Bordo vasca" }] : []),
          { id: "paving", label: "Pavimentazione" },
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
            {card("solarShower")}
          </ChoiceGrid>
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
  const { config, setSceneTime, setPremiumEnvironment, projectConfiguration } = useConfigurator();
  const [tab, setTab] = useState<"scene" | "summary" | "request">("scene");
  useEffect(() => {
    if (ctx.requestToken) setTab("request");
  }, [ctx.requestToken]);
  const night = config.sceneTime === "night";
  const environments = PREMIUM_ENVIRONMENTS.filter(
    (e) => e.id !== "panorama-infinity" || config.system === "infinity",
  );
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
            <ChoiceCard
              compact
              title="Notte"
              description="Il bagliore dei fari LED nell’acqua."
              image={ill("time-night")}
              selected={night}
              onSelect={() => setSceneTime("night")}
            />
          </ChoiceGrid>
          <GroupLabel>Ambientazione</GroupLabel>
          <ChoiceGrid label="Ambientazione">
            {environments.map((e) => (
              <ChoiceCard
                compact
                key={e.id}
                title={e.label}
                description={e.description}
                image={ill(`env-${e.id}`)}
                selected={premiumEnvironment(config.premiumEnvironment) === e.id}
                onSelect={() => setPremiumEnvironment(e.id)}
              />
            ))}
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
        <div className="max-w-3xl">
          <ProjectSummary />
        </div>
      ) : (
        <section className="flex max-w-xl flex-col items-start gap-4">
          <h3 className="text-[20px] font-extralight tracking-[-0.015em] text-foreground">
            Vuoi trasformare questo progetto in una proposta reale?
          </h3>
          <p className="text-[13px] leading-[1.7] font-light text-muted-foreground">
            Un consulente verifica configurazione, fattibilità e investimento.
          </p>
          <LeadRequestDialog projectConfiguration={projectConfiguration} />
        </section>
      )}
    </TabBody>
  );
}
