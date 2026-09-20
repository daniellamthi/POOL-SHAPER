import { useState } from "react";
import {
  MaterialSwatch,
  OptionCard,
  StepSection,
  SwatchOption,
} from "@/components/pool/StepSection";
import { FINISHES, LINER_COLORS } from "@/lib/pool/config";
import { useConfigurator } from "@/lib/pool/context";
import type { FinishMaterial } from "@/lib/pool/types";
import { MOSAIC_FINISHES } from "@/configurator/materials/interior-textures";
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
 * Step 5 (Stile) — the interior finish/colour that defines the water, plus
 * the coping/border material. Both are the same customer decision -- "what
 * is this pool made of, and how does it read" -- so they live on one step;
 * the underlying store fields (`finish`/`linerColor`/`mosaicFinish` and
 * `copingMaterial`) are unchanged and independently editable elsewhere
 * (e.g. `ProjectSummary`'s edit links).
 */
export function InteriorFinishStep() {
  const { config, setFinish, setLinerColor, setMosaicFinish, setCopingMaterial } =
    useConfigurator();
  const [expandedFinish, setExpandedFinish] = useState<FinishMaterial | null>(config.finish);
  const [detailMaterial, setDetailMaterial] = useState<CopingMaterialId | null>(null);
  const detail = COPING_MATERIALS.find((item) => item.id === detailMaterial) ?? null;

  const toggleFinish = (finish: FinishMaterial) => {
    setExpandedFinish((current) => (current === finish ? null : finish));
    if (config.finish !== finish) setFinish(finish);
  };

  return (
    <StepSection
      title="Materiali e stile"
      subtitle="Il materiale che definisce carattere e colore dell'acqua, e il bordo vasca."
    >
      <div className="grid gap-4" role="group" aria-label="Rivestimento interno">
        {FINISHES.map((finish) => {
          const expanded = expandedFinish === finish.id;
          return (
            <div key={finish.id} className="flex flex-col">
              <OptionCard
                title={finish.title}
                description={finish.description}
                selected={config.finish === finish.id}
                onSelect={() => toggleFinish(finish.id)}
              />
              <div
                className={`grid transition-[grid-template-rows,opacity,transform,margin] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  expanded
                    ? "mt-4 grid-rows-[1fr] translate-y-0 opacity-100"
                    : "pointer-events-none mt-0 grid-rows-[0fr] -translate-y-1 opacity-0"
                }`}
                aria-hidden={!expanded}
              >
                <div className="overflow-hidden">
                  {finish.id === "liner" ? (
                    <div className="ml-3 flex flex-col gap-4 border-l border-hairline py-2 pl-4">
                      <h3 className="label-xs">Finiture liner PVC</h3>
                      <div
                        className="grid grid-cols-2 gap-3 sm:grid-cols-3"
                        role="group"
                        aria-label="Finitura liner PVC"
                      >
                        {LINER_COLORS.map((color) => (
                          <SwatchOption
                            key={color.id}
                            title={color.title}
                            hex={color.hex}
                            texture={color.texture}
                            selected={config.linerColor === color.id}
                            onSelect={() => setLinerColor(color.id)}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="ml-3 flex flex-col gap-4 border-l border-hairline py-2 pl-4">
                      <h3 className="label-xs">Finiture mosaico</h3>
                      <div
                        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
                        role="group"
                        aria-label="Finitura mosaico"
                      >
                        {MOSAIC_FINISHES.map((mosaic) => (
                          <OptionCard
                            key={mosaic.id}
                            title={mosaic.name}
                            selected={config.mosaicFinish === mosaic.id}
                            onSelect={() => setMosaicFinish(mosaic.id)}
                            meta={
                              <img
                                src={mosaic.preview}
                                alt=""
                                className="block aspect-square w-full rounded-xl border border-hairline object-cover"
                              />
                            }
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!(config.system === "overflow" && config.overflowType === "visible") && (
        <div className="flex flex-col gap-3 border-t border-hairline pt-8">
          <p className="label-xs">Materiale del bordo</p>
          <div role="group" aria-label="Materiale del bordo" className="grid grid-cols-2 gap-3">
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
