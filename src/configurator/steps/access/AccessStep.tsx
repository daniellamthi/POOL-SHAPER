import { Footprints } from "lucide-react";
import { useMemo } from "react";
import { configuredAccessPlan } from "@/lib/pool/access-plan";
import { configuredComfortPlan, HYDRO_DIMENSIONS, activeFlightKind, normalizeComfortFeatures } from "@/lib/pool/comfort-plan";
import { configuredPoolLayout } from "@/lib/pool/resolved-layout";
import { OptionCard, StepSection } from "@/components/pool/StepSection";
import { useConfigurator } from "@/lib/pool/context";

/** Step 6 (Comfort) — pool access (internal stairs / external ladder) and
 * the in-water comfort feature (hydromassage). Split out of the old,
 * bundled "Pool Features" step so lighting and access are each their own
 * clear decision. */
export function AccessStep() {
  const {
    config,
    togglePoolFeature,
    setPoolAccess,
    setInternalStairType,
    setHydromassageVariant,
    toggleInternalSteps,
    toggleInoxLadder,
  } = useConfigurator();
  const hydroVariant = config.hydromassageVariant ?? "closed";
  const stairType = config.internalStairType ?? "linear";
  // Geometry, obstacles and elevations determine availability, not a shape label.
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
      ladder: configuredAccessPlan({ ...config, poolAccess: "stainlessSteelLadder" }),
    }),
    [config],
  );
  const selected = config.poolAccess === "stainlessSteelLadder" ? plans.ladder : plans[stairType];
  const comfort = useMemo(() => configuredComfortPlan(config), [config]);
  const shelfEnabled = config.features.includes("sunShelf");
  const shelfProposal = useMemo(() => configuredComfortPlan({
    ...config, features: shelfEnabled ? config.features : [...config.features, "sunShelf"],
  }), [config, shelfEnabled]);
  const shelf = comfort.elements.find(element => element.kind === "sunShelf");
  const hydroEnabled = config.features.includes("hydromassage") && !shelfEnabled;
  const hydro = comfort.elements.find(element => element.kind === "hydromassage");
  const hydroProposal = useMemo(() => configuredComfortPlan({
    ...config, features: normalizeComfortFeatures(hydroEnabled ? config.features : [...config.features, "hydromassage"], "hydromassage"),
  }), [config, hydroEnabled]);
  const stepsOn = config.poolAccess === "internalSteps";
  const inoxOn = config.poolAccess === "stainlessSteelLadder" || (stepsOn && config.features.includes("inoxLadder"));
  // Same engine, asked what happens if the ladder is added next to the current selection.
  const inoxLayout = useMemo(() => configuredPoolLayout({
    ...config,
    poolAccess: stepsOn ? "internalSteps" : "stainlessSteelLadder",
    features: stepsOn ? [...config.features.filter(id => id !== "inoxLadder"), "inoxLadder"] : config.features,
  }), [config, stepsOn]);
  const inoxPlan = stepsOn ? inoxLayout.ladder?.plan : inoxLayout.access;
  const inoxStatus = !inoxPlan?.placement ? "UNAVAILABLE" : stepsOn ? inoxLayout.ladder?.status : "VALID";
  const flightKind = activeFlightKind(config.features);
  const flightActive = flightKind !== null;
  const selectComfort = (id: "sunShelf" | "hydromassage") => {
    const on = config.features.includes(id);
    if (!on && config.poolAccess === null) {
      setInternalStairType("linear");
      setPoolAccess("internalSteps");
    }
    togglePoolFeature(id);
  };
  const dimensions = (plan: typeof selected) =>
    plan.reason ? undefined : (
      <span className="text-xs text-muted-foreground">
        {plan.steps} gradini · {plan.width.toFixed(2)} × {plan.run.toFixed(2)} m
      </span>
    );

  return (
    <StepSection title="Accesso e comfort" subtitle="Scale, scaletta e comfort in acqua.">
      <div className="flex flex-col gap-5">
        {comfort.adjusted ? <p className="text-xs text-muted-foreground">Optimized for your pool</p> : null}
        {shelfEnabled && !comfort.availability.sunShelf.available ?
          <p className="text-xs text-muted-foreground">Sun Shelf: {comfort.availability.sunShelf.reason}</p> : null}
        {hydroEnabled && !comfort.availability.hydromassage.available ?
          <p className="text-xs text-muted-foreground">Idromassaggio: {comfort.availability.hydromassage.reason}</p> : null}
        <h3 className="label-xs">Accesso</h3>
        <div className="grid gap-4" role="group" aria-label="Accesso alla piscina">
          <div className="grid gap-3">
            <OptionCard
              title={flightActive ? "Scala interna — inclusa nel comfort" : "Scala interna"}
              description={flightActive ? "Collegamento rettilineo automatico dalla zona comfort al fondo, con la stessa finitura della vasca." : "Scala integrata in cemento, coordinata con la finitura interna selezionata."}
              selected={stepsOn}
              onSelect={() => toggleInternalSteps()}
            />
            {stepsOn && !flightActive ? (
              <section
                aria-label="Tipo di scala interna"
                className="rounded-2xl border border-hairline px-5 py-5"
              >
                <h4 className="label-xs mb-4">Tipo di scala</h4>
                <div className="grid gap-3" role="group" aria-label="Tipo di scala interna">
                  <OptionCard
                    title="Scala interna rettilinea"
                    description="Gradini dritti sul lato corto, addossati alla parete lunga."
                    selected={stairType === "linear"}
                    onSelect={() => setInternalStairType("linear")}
                    disabled={!!plans.linear.reason}
                    disabledReason={plans.linear.reason}
                    meta={dimensions(plans.linear)}
                  />
                  <OptionCard
                    title="Scala interna angolare"
                    description="Gradini a quarto di cerchio che si aprono dall'angolo della vasca."
                    disabled={!!plans.corner.reason}
                    disabledReason={plans.corner.reason}
                    selected={stairType === "corner"}
                    onSelect={() => setInternalStairType("corner")}
                    meta={dimensions(plans.corner)}
                  />
                </div>
              </section>
            ) : null}
          </div>
          <OptionCard
            optional
            title="Scaletta inox"
            description="Optional. Corrimano tubolari e pedate antiscivolo, dimensionati sulla profondità utile."
            selected={inoxOn}
            onSelect={() => toggleInoxLadder()}
            disabled={!inoxOn && inoxStatus === "UNAVAILABLE"}
            disabledReason={inoxPlan?.reason ?? "Nessuna posizione valida senza collisioni."}
            meta={
              inoxPlan && !inoxPlan.reason ? (
                <span className="text-xs text-muted-foreground">
                  {inoxStatus === "REPOSITION" ? "Riposizionata automaticamente · " : ""}
                  {inoxPlan.steps} gradini · {inoxPlan.width.toFixed(2)} × {inoxPlan.run.toFixed(2)} m
                </span>
              ) : undefined
            }
          />
        </div>
        {!flightActive && config.poolAccess && selected.reason ? (
          <p role="status" className="text-sm text-muted-foreground">
            {selected.reason} Scegli un accesso compatibile.
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-5 border-t border-hairline pt-8">
        <h3 className="label-xs">Comfort</h3>
        <p className="text-xs text-muted-foreground">Sun shelf e idromassaggio sono alternative della stessa zona comfort.</p>
        <div className="grid gap-3" role="group" aria-label="Comfort integrato">
          <OptionCard
            optional
            title="Sun shelf"
            description="Solarium sommerso a 22 cm, rivestito con la stessa finitura della vasca."
            selected={shelfEnabled}
            onSelect={() => selectComfort("sunShelf")}
            disabled={!shelfEnabled && !shelfProposal.availability.sunShelf.available}
            {...(shelfProposal.availability.sunShelf.reason
              ? { disabledReason: shelfProposal.availability.sunShelf.reason }
              : {})}
            meta={<span className="text-xs text-muted-foreground">Profondità acqua 0,22 m · scala rettilinea inclusa{ shelf?.steps ? ` · ${shelf.steps.length} pedate da 30 cm · alzata ${Math.round((shelf.riser ?? 0) * 100)} cm` : ""}</span>}
          />
          <OptionCard
            optional
            title="Idromassaggio"
            description={`Zona idromassaggio accanto alla scala rettilinea: divisorio verso la scala, panca a ${hydroVariant === "open" ? "U" : "L"} e getti nello schienale.`}
            selected={hydroEnabled}
            onSelect={() => selectComfort("hydromassage")}
            disabled={!hydroEnabled && !hydroProposal.availability.hydromassage.available}
            {...(hydroProposal.availability.hydromassage.reason
              ? { disabledReason: hydroProposal.availability.hydromassage.reason }
              : {})}
            meta={<span className="text-xs text-muted-foreground">Seduta a {hydroVariant === "open" ? "U" : "L"} {Math.round(HYDRO_DIMENSIONS.seatWaterDepth * 100)} cm sotto l’acqua{ hydro?.jets ? ` · ${hydro.run.toFixed(2)} × ${(hydro.width + HYDRO_DIMENSIONS.partitionThickness).toFixed(2)} m · ${hydro.jets.length} getti` : ""}</span>}
          />
          {hydroEnabled ? (
            <section
              aria-label="Stile idromassaggio"
              className="rounded-2xl border border-hairline px-5 py-5"
            >
              <h4 className="label-xs mb-4">Stile idromassaggio</h4>
              <div className="grid gap-3" role="group" aria-label="Stile idromassaggio">
                <OptionCard
                  title="Chiuso"
                  description="Muretto frontale alla stessa quota del divisorio: zona delimitata."
                  selected={hydroVariant === "closed"}
                  onSelect={() => setHydromassageVariant("closed")}
                />
                <OptionCard
                  title="Aperto"
                  description="Nessun muretto frontale: la zona si apre sulla vasca principale."
                  selected={hydroVariant === "open"}
                  onSelect={() => setHydromassageVariant("open")}
                />
              </div>
            </section>
          ) : null}
          <OptionCard
            optional
            title="Panca integrata"
            description="Seduta sommersa lungo parete, chiusa fino al fondo e coordinata al rivestimento."
            selected={config.features.includes("integratedBench")}
            onSelect={() => togglePoolFeature("integratedBench")}
            disabled={!config.features.includes("integratedBench") && !comfort.availability.integratedBench.available}
            {...(comfort.availability.integratedBench.reason
              ? { disabledReason: comfort.availability.integratedBench.reason }
              : {})}
            meta={<span className="text-xs text-muted-foreground">Seduta a 0,48 m dall’acqua</span>}
          />
        </div>
      </div>

      {config.poolType === "above-ground" ? (
        <div className="flex flex-col gap-5 border-t border-hairline pt-8">
          <h3 className="label-xs">Accesso piscina fuori terra</h3>
          <OptionCard
            title="Scala esterna"
            description="Accesso esterno alla piscina."
            selected={config.features.includes("externalStaircase")}
            onSelect={() => togglePoolFeature("externalStaircase")}
            meta={<Footprints className="size-5 text-muted-foreground" strokeWidth={1.25} />}
          />
        </div>
      ) : null}
    </StepSection>
  );
}
