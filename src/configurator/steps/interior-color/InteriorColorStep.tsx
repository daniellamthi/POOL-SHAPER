import { StepSection, SwatchOption } from "@/components/pool/StepSection";
import { LINER_COLORS } from "@/lib/pool/config";
import { useConfigurator } from "@/lib/pool/context";

/** Step 6 — applies a replaceable placeholder colour to the selected finish. */
export function InteriorColorStep() {
  const { config, setLinerColor } = useConfigurator();

  return (
    <StepSection
      title="Interior Color"
      subtitle={`Choose the ${config.finish === "mosaic" ? "mosaic" : "liner"} tone. Placeholder assets can be replaced centrally later.`}
    >
      <div
        className="grid grid-cols-2 gap-3 sm:grid-cols-3"
        role="group"
        aria-label="Interior color"
      >
        {LINER_COLORS.map((color) => (
          <SwatchOption
            key={color.id}
            title={color.title}
            hex={color.hex}
            selected={config.linerColor === color.id}
            onSelect={() => setLinerColor(color.id)}
          />
        ))}
      </div>
    </StepSection>
  );
}
