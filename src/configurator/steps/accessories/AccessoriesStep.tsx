import { StepSection } from "@/components/pool/StepSection";
import { ACCESSORIES } from "@/lib/pool/config";
import { useConfigurator } from "@/lib/pool/context";
import type { AccessoryId } from "@/lib/pool/types";
import { cn } from "@/lib/utils";
import {
  Activity,
  Bot,
  Check,
  CircleDashed,
  Droplets,
  FlaskConical,
  HeartPulse,
  Lightbulb,
  Shield,
  ShowerHead,
  Smartphone,
  Thermometer,
  Waves,
  type LucideIcon,
} from "lucide-react";

const ACCESSORY_ICONS: Record<AccessoryId, LucideIcon> = {
  automaticCover: Shield,
  heatPump: Thermometer,
  saltElectrolysis: Droplets,
  automaticDosing: FlaskConical,
  ledLighting: Lightbulb,
  perimeterLed: CircleDashed,
  waterfall: Waves,
  hydromassage: HeartPulse,
  counterCurrent: Activity,
  poolRobot: Bot,
  smartControl: Smartphone,
  solarShower: ShowerHead,
};

/**
 * Step 9 — manages optional pool equipment and features.
 * Selection and cross-domain rules remain centralized in toggleAccessory.
 */
export function AccessoriesStep() {
  const { config, toggleAccessory } = useConfigurator();

  return (
    <StepSection
      title="Optional Accessories"
      subtitle="Select products for the future quotation. These options never alter the 3D model."
    >
      <AccessoryGroup
        title="Quotation options"
        label="Optional accessories"
        accessories={ACCESSORIES}
        selected={config.accessories}
        onToggle={toggleAccessory}
      />
    </StepSection>
  );
}

interface AccessoryGroupProps {
  title: string;
  label: string;
  accessories: typeof ACCESSORIES;
  selected: ReadonlyArray<AccessoryId>;
  onToggle: (accessory: AccessoryId) => void;
}

function AccessoryGroup({ title, label, accessories, selected, onToggle }: AccessoryGroupProps) {
  return (
    <div className="flex flex-col gap-6">
      <h3 className="label-xs">{title}</h3>
      <div
        className="grid auto-rows-fr grid-cols-1 gap-4 xl:grid-cols-2"
        role="group"
        aria-label={label}
      >
        {accessories.map((accessory) => {
          const Icon = ACCESSORY_ICONS[accessory.id];
          const isSelected = selected.includes(accessory.id);

          return (
            <button
              key={accessory.id}
              type="button"
              onClick={() => onToggle(accessory.id)}
              aria-pressed={isSelected}
              className={cn(
                "group relative flex min-h-44 w-full flex-col rounded-[1.125rem] border p-6 text-left outline-none transition-[border-color,background-color,box-shadow,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:ring-1 focus-visible:ring-foreground/40 focus-visible:ring-offset-4 focus-visible:ring-offset-background active:scale-[0.992]",
                isSelected
                  ? "border-brand/45 bg-brand/[0.055] shadow-[0_18px_46px_-38px_var(--brand)]"
                  : "border-hairline bg-card/30 hover:-translate-y-0.5 hover:border-foreground/18 hover:bg-card/60 hover:shadow-[0_22px_54px_-42px_rgba(0,0,0,0.8)]",
              )}
            >
              <span className="mb-6 flex w-full items-center justify-between">
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-xl border transition-[border-color,background-color,color] duration-500 [&_svg]:size-[18px] [&_svg]:stroke-[1.2]",
                    isSelected
                      ? "border-brand/35 bg-brand/10 text-brand"
                      : "border-hairline bg-background/30 text-muted-foreground group-hover:border-foreground/15 group-hover:text-foreground",
                  )}
                >
                  <Icon aria-hidden="true" />
                </span>

                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border transition-[border-color,background-color,color,transform] duration-300",
                    isSelected
                      ? "scale-100 border-brand bg-brand text-background"
                      : "scale-90 border-border text-transparent group-hover:scale-100 group-hover:border-foreground/30",
                  )}
                >
                  <Check className="size-3" strokeWidth={1.75} aria-hidden="true" />
                </span>
              </span>

              <span className="min-h-10 text-[14px] leading-5 font-normal tracking-[-0.01em] text-balance text-foreground">
                {accessory.title}
              </span>
              <span className="mt-2 line-clamp-2 text-[12px] leading-[1.6] font-light text-pretty text-muted-foreground">
                {accessory.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
