import { useState } from "react";
import { OptionCard, MaterialSwatch, StepSection, SwatchOption } from "@/components/pool/StepSection";
import { useConfigurator } from "@/lib/pool/context";
import { SKIMMER_FINISHES, SKIMMER_TYPES } from "@/lib/pool/config";
import { cn } from "@/lib/utils";
import { COPING_MATERIALS, type CopingMaterialId } from "@/lib/pool/coping-materials";
import { getCopingSwatchDataUrl } from "@/components/pool/copingSwatchPreview";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Step 4 — selects the hydraulic system.
 * Engineering values remain derived from the existing configurator store.
 */
export function PoolSystemStep({ onSkimmerSelect }: { onSkimmerSelect?: () => void } = {}) {
  const { config, setSystem, setOverflowType, setSkimmerFinish, setSkimmerType, setCopingMaterial } =
    useConfigurator();
  const [detailMaterial, setDetailMaterial] = useState<CopingMaterialId | null>(null);
  const detail = COPING_MATERIALS.find((item) => item.id === detailMaterial) ?? null;

  const selectSkimmer = () => {
    setSystem("skimmer");
    onSkimmerSelect?.();
  };

  return (
    <StepSection title="Pool System" subtitle="Hydraulic principle and water line management.">
      <div className="grid gap-4" role="group" aria-label="Pool system">
        <OptionCard
          title="Skimmer Pool"
          description="Water line 12 cm below the coping. Skimmers sized to industry standard."
          selected={config.system === "skimmer"}
          onSelect={selectSkimmer}
        />

        {/* Inline, not a modal/route -- grid-template-rows 0fr/1fr is what
            makes this smoothly animate to its natural height without a
            measured-pixel-height hack. */}
        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
            config.system === "skimmer" ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div className="overflow-hidden">
            <div className="flex flex-col gap-4 rounded-2xl border border-hairline p-5">
              <p className="label-xs">Tipo skimmer</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {SKIMMER_TYPES.map((option) => (
                  <OptionCard
                    key={option.id}
                    title={option.title}
                    description={option.description}
                    selected={config.skimmerType === option.id}
                    onSelect={() => setSkimmerType(option.id)}
                  />
                ))}
              </div>
              <p className="label-xs">Finitura skimmer</p>
              <div className="grid grid-cols-4 gap-3">
                {SKIMMER_FINISHES.map((option) => (
                  <SwatchOption
                    key={option.id}
                    title={option.title}
                    hex={option.hex}
                    selected={config.skimmerFinish === option.id}
                    onSelect={() => setSkimmerFinish(option.id)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <OptionCard
          title="Overflow Edge Pool"
          description="A flush water line with selectable perimeter overflow collection."
          selected={config.system === "overflow"}
          onSelect={() => setSystem("overflow")}
        />
        {config.system === "overflow" ? (
          <div className="mt-4 grid gap-4" role="group" aria-label="Overflow type">
            <p className="label-xs">Overflow Type</p>
            <OptionCard
              title="Hidden Overflow"
              description="Overflow channel concealed beneath the perimeter coping."
              selected={config.overflowType === "hidden"}
              onSelect={() => setOverflowType("hidden")}
            />
            <OptionCard
              title="Visible Overflow"
              description="Deck-level overflow with visible perimeter drainage channel."
              selected={config.overflowType === "visible"}
              onSelect={() => setOverflowType("visible")}
            />
          </div>
        ) : null}
      </div>
      {!(config.system === "overflow" && config.overflowType === "visible") && (
        <div className="flex flex-col gap-3">
          <p className="label-xs">Coping Material</p>
          <div role="group" aria-label="Coping material" className="grid grid-cols-2 gap-3">
            {COPING_MATERIALS.map((option) => (
              <MaterialSwatch
                key={option.id}
                title={option.title}
                subtitle={option.subtitle}
                previewUrl={getCopingSwatchDataUrl(option.id)}
                selected={(config.copingMaterial ?? "travertine") === option.id}
                onSelect={() => setCopingMaterial(option.id)}
                onViewDetail={() => setDetailMaterial(option.id)}
              />
            ))}
          </div>
        </div>
      )}

      <Dialog open={detail !== null} onOpenChange={(open) => !open && setDetailMaterial(null)}>
        <DialogContent className="max-w-sm gap-5 rounded-2xl border-hairline p-6">
          {detail ? (
            <>
              <div
                className="aspect-[4/3] w-full rounded-xl border border-hairline bg-cover bg-center"
                style={{ backgroundImage: `url(${getCopingSwatchDataUrl(detail.id)})` }}
              />
              <DialogHeader className="gap-1.5">
                <p className="label-xs text-muted-foreground">{detail.category}</p>
                <DialogTitle className="text-[19px] font-extralight tracking-[-0.02em] text-foreground">
                  {detail.title}
                </DialogTitle>
                <DialogDescription className="text-[12.5px] leading-[1.7] font-light text-muted-foreground">
                  {detail.description}
                </DialogDescription>
              </DialogHeader>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </StepSection>
  );
}
