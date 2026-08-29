import { useState } from "react";
import { OptionCard, StepSection, SwatchOption } from "@/components/pool/StepSection";
import { FINISHES, LINER_COLORS } from "@/lib/pool/config";
import { useConfigurator } from "@/lib/pool/context";
import type { FinishMaterial } from "@/lib/pool/types";
import { MOSAIC_FINISHES } from "@/configurator/materials/interior-textures";

/**
 * Step 5 — selects the interior finish and its colour.
 * The existing material resolver translates these choices for the 3D scene.
 */
export function InteriorFinishStep() {
  const { config, setFinish, setLinerColor, setMosaicFinish } = useConfigurator();
  const [expandedFinish, setExpandedFinish] = useState<FinishMaterial | null>(config.finish);

  const toggleFinish = (finish: FinishMaterial) => {
    setExpandedFinish((current) => (current === finish ? null : finish));
    if (config.finish !== finish) setFinish(finish);
  };

  return (
    <StepSection
      title="Interior Finish"
      subtitle="Select the material that defines the character and colour of the water."
    >
      <div className="grid gap-4" role="group" aria-label="Interior finish">
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
                    <h3 className="label-xs">PVC liner finishes</h3>
                    <div
                      className="grid grid-cols-2 gap-3 sm:grid-cols-3"
                      role="group"
                      aria-label="PVC liner finish"
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
                    <h3 className="label-xs">Mosaic finishes</h3>
                    <div
                      className="grid grid-cols-1 gap-4 sm:grid-cols-2"
                      role="group"
                      aria-label="Mosaic finish"
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
    </StepSection>
  );
}
