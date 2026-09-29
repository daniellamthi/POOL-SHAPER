import { OptionCard, StepSection } from "@/components/pool/StepSection";
import { useMemo } from "react";
import { configuredLightingPlan } from "@/lib/pool/lighting-plan";
import { useConfigurator } from "@/lib/pool/context";
import { LedColorWheel } from "@/configurator/steps/pool-features/LedColorWheel";
import { LedIntensityControl } from "@/configurator/steps/pool-features/LedIntensityControl";
import { Button } from "@/components/ui/button";
import type { SceneTimeOfDay } from "@/components/pool/three/PoolScene";

/** Step 7 (Luce) — underwater LED lighting: on/off, colour and intensity.
 * Split out of the old, bundled "Pool Features" step so this is its own
 * dedicated decision instead of being buried under access/comfort. */
export function LightingStep({
  sceneTime = "day",
  onSceneTimeChange,
}: {
  sceneTime?: SceneTimeOfDay;
  onSceneTimeChange?: (value: SceneTimeOfDay) => void;
}) {
  const { config, togglePoolFeature, setLedColor, setLedIntensity } = useConfigurator();
  const hasLed = config.features.includes("ledLighting");
  const plan = useMemo(() => (hasLed ? configuredLightingPlan(config) : null), [config, hasLed]);

  return (
    <StepSection
      title="Illuminazione"
      subtitle="Illuminazione subacquea a LED: colore e intensità."
    >
      {config.system === "infinity" && onSceneTimeChange ? (
        <div className="flex flex-col gap-3 border-b border-hairline pb-6">
          <h3 className="label-xs">Atmosfera Infinity</h3>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Atmosfera Infinity">
            <Button
              type="button"
              variant={sceneTime === "day" ? "default" : "outline"}
              onClick={() => onSceneTimeChange("day")}
              aria-pressed={sceneTime === "day"}
            >
              Giorno
            </Button>
            <Button
              type="button"
              variant={sceneTime === "night" ? "default" : "outline"}
              onClick={() => onSceneTimeChange("night")}
              aria-pressed={sceneTime === "night"}
            >
              Notte
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Stesso panorama, orientamento e camera; cambia soltanto la luce della scena.
          </p>
        </div>
      ) : null}
      <div className="grid gap-3" role="group" aria-label="Illuminazione subacquea">
        <OptionCard
          title="Illuminazione LED"
          description="Illuminazione subacquea a LED, colore e intensità regolabili."
          selected={hasLed}
          onSelect={() => togglePoolFeature("ledLighting")}
        />
        {hasLed ? (
          <>
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {plan?.count} LED · disposizione automatica su {plan?.surfaceArea.toFixed(1)} m²
            </p>
            <details className="text-xs text-muted-foreground">
              <summary className="min-h-11 cursor-pointer">
                Criterio indicativo di dimensionamento
              </summary>
              <p>
                Preset provvisorio: apparecchio generico da 1500 lm, circa{" "}
                {plan?.coveragePerFixture.toFixed(1)} m² per punto luce. Ipotesi: 45 lx, utilizzo
                65%, manutenzione 85%, immersione nominale 60 cm e fascio simulato 155°. Finiture
                scure e ostacoli richiedono verifica fotometrica. Non è una certificazione elettrica
                né una specifica LumiPlus Flexi.
              </p>
              {plan?.warnings.map((w) => (
                <p key={w}>{w}</p>
              ))}
            </details>
            <LedColorWheel value={config.ledColor ?? "#ffffff"} onChange={setLedColor} />
            <LedIntensityControl value={config.ledIntensity} onChange={setLedIntensity} />
          </>
        ) : null}
      </div>
    </StepSection>
  );
}
