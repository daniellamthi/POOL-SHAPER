import { Footprints } from "lucide-react";
import { useMemo } from "react";
import { configuredAccessPlan } from "@/lib/pool/access-plan";
import { OptionCard, StepSection } from "@/components/pool/StepSection";
import { useConfigurator } from "@/lib/pool/context";

/** Step 6 (Comfort) — pool access (internal stairs / external ladder) and
 * the in-water comfort feature (hydromassage). Split out of the old,
 * bundled "Pool Features" step so lighting and access are each their own
 * clear decision. */
export function AccessStep() {
  const { config, togglePoolFeature, setPoolAccess, setInternalStairType } = useConfigurator();
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
  const dimensions = (plan: typeof selected) =>
    plan.reason ? undefined : (
      <span className="text-xs text-muted-foreground">
        {plan.steps} gradini · {plan.width.toFixed(2)} × {plan.run.toFixed(2)} m
      </span>
    );

  return (
    <StepSection title="Accesso e comfort" subtitle="Scale, scaletta e comfort in acqua.">
      <div className="flex flex-col gap-5">
        <h3 className="label-xs">Accesso alla piscina</h3>
        <div className="grid gap-4" role="group" aria-label="Accesso alla piscina">
          <div className="grid gap-3">
            <OptionCard
              title="Scala interna"
              description="Scala integrata in cemento, coordinata con la finitura interna selezionata."
              selected={config.poolAccess === "internalSteps"}
              onSelect={() => setPoolAccess("internalSteps")}
            />
            {config.poolAccess === "internalSteps" ? (
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
            title="Scaletta inox"
            description="Corrimano tubolari e pedate antiscivolo, dimensionati sulla profondità utile."
            selected={config.poolAccess === "stainlessSteelLadder"}
            onSelect={() => setPoolAccess("stainlessSteelLadder")}
            disabled={!!plans.ladder.reason}
            disabledReason={plans.ladder.reason}
            meta={dimensions(plans.ladder)}
          />
        </div>
        {config.poolAccess && selected.reason ? (
          <p role="status" className="text-sm text-muted-foreground">
            {selected.reason} Scegli un accesso compatibile.
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-5 border-t border-hairline pt-8">
        <h3 className="label-xs">Comfort in acqua</h3>
        <OptionCard
          title="Idromassaggio"
          description="Ugelli idromassaggio integrati."
          selected={config.features.includes("hydromassage")}
          onSelect={() => togglePoolFeature("hydromassage")}
        />
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
