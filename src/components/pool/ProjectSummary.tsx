import {
  ACCESSORIES,
  FINISHES,
  LINER_COLORS,
  PROJECT_TYPES,
  getShapeDefinition,
} from "@/lib/pool/config";
import { useConfigurator } from "@/lib/pool/context";
import { formatNumber } from "@/lib/pool/format";
import { MetricsPanel } from "./MetricsPanel";

/** Read-only recap of everything collected. No pricing, no quotation. */
export function ProjectSummary() {
  const { config, metrics } = useConfigurator();
  const projectType = PROJECT_TYPES.find((type) => type.id === config.projectType);
  const shape = getShapeDefinition(config.shape);
  const finish = FINISHES.find((option) => option.id === config.finish);
  const color = LINER_COLORS.find((option) => option.id === config.linerColor);
  const selectedAccessories = ACCESSORIES.filter((option) =>
    config.accessories.includes(option.id),
  );

  const rows: ReadonlyArray<{ label: string; value: string }> = [
    { label: "Project Type", value: projectType?.title ?? "Not selected" },
    { label: "Pool Shape", value: shape.title },
    {
      label: "Dimensions",
      value: `${formatNumber(config.dimensions.length, 2)} × ${formatNumber(config.dimensions.width, 2)} × ${formatNumber(config.dimensions.depth, 2)} m`,
    },
    {
      label: "Pool System",
      value: config.system === "skimmer" ? "Skimmer Pool" : "Overflow Edge Pool",
    },
    { label: "Interior Finish", value: finish?.title ?? config.finish },
    { label: "Interior Color", value: color?.title ?? config.linerColor },
    {
      label: "Selected Accessories",
      value: selectedAccessories.length
        ? selectedAccessories.map((option) => option.title).join(", ")
        : "None selected",
    },
  ];

  return (
    <section className="animate-rise flex flex-col gap-8 rounded-2xl border border-hairline bg-card/40 p-7">
      <h3 className="label-xs">Configuration</h3>
      <dl className="flex flex-col">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-baseline justify-between gap-6 border-b border-hairline py-3 last:border-0 last:pb-0"
          >
            <dt className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              {row.label}
            </dt>
            <dd className="max-w-[60%] text-right text-[13px] font-light text-foreground">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="border-t border-hairline pt-7">
        <h3 className="mb-4 text-[10px] font-normal uppercase tracking-[0.18em] text-muted-foreground">
          Pool Metrics
        </h3>
        <MetricsPanel metrics={metrics} compact />
      </div>
    </section>
  );
}
