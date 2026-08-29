import {
  EQUIPMENT,
  FINISHES,
  POOL_FEATURES,
  POOL_STRUCTURES,
  POOL_TYPES,
  LINER_COLORS,
  PROJECT_TYPES,
  getShapeDefinition,
} from "@/lib/pool/config";
import { useConfigurator } from "@/lib/pool/context";
import { formatNumber } from "@/lib/pool/format";
import { MetricsPanel } from "./MetricsPanel";
import { getMosaicFinish } from "@/configurator/materials/interior-textures";

/** Read-only recap of everything collected. No pricing, no quotation. */
export function ProjectSummary() {
  const { config, metrics } = useConfigurator();
  const projectType = PROJECT_TYPES.find((type) => type.id === config.projectType);
  const poolType = POOL_TYPES.find((type) => type.id === config.poolType);
  const structure = POOL_STRUCTURES.find((option) => option.id === config.structure);
  const shape = getShapeDefinition(config.shape);
  const finish = FINISHES.find((option) => option.id === config.finish);
  const color = LINER_COLORS.find((option) => option.id === config.linerColor);
  const finishColor =
    config.finish === "mosaic"
      ? getMosaicFinish(config.mosaicFinish).name
      : (color?.title ?? config.linerColor);
  const selectedFeatures = POOL_FEATURES.filter((option) => config.features.includes(option.id));
  const selectedEquipment = EQUIPMENT.filter((option) => config.equipment.includes(option.id));
  const poolAccess =
    config.poolAccess === "internalSteps"
      ? "Internal Steps"
      : config.poolAccess === "stainlessSteelLadder"
        ? "Stainless Steel Ladder"
        : null;

  const rows: ReadonlyArray<{ label: string; value: string }> = [
    { label: "Project Type", value: projectType?.title ?? "Not selected" },
    { label: "Pool Type", value: poolType?.title ?? "Not selected" },
    { label: "Pool Structure", value: structure?.title ?? "Not selected" },
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
    { label: "Interior Color / Finish Color", value: finishColor },
    {
      label: "Pool Features",
      value:
        [
          ...selectedFeatures.map((option) => option.title),
          ...(poolAccess ? [poolAccess] : []),
        ].join(", ") || "None selected",
    },
    {
      label: "Equipment",
      value: selectedEquipment.length
        ? selectedEquipment.map((option) => option.title).join(", ")
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
