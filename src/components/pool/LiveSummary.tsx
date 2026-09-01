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
import { getMosaicFinish } from "@/configurator/materials/interior-textures";

export function LiveSummary() {
  const { config, metrics } = useConfigurator();
  const project =
    PROJECT_TYPES.find((item) => item.id === config.projectType)?.title ?? "Not selected";
  const finish = FINISHES.find((item) => item.id === config.finish)?.title ?? config.finish;
  const poolType = POOL_TYPES.find((item) => item.id === config.poolType)?.title ?? "Not selected";
  const structure =
    POOL_STRUCTURES.find((item) => item.id === config.structure)?.title ?? "Not selected";
  const color =
    config.finish === "mosaic"
      ? getMosaicFinish(config.mosaicFinish).name
      : (LINER_COLORS.find((item) => item.id === config.linerColor)?.title ?? config.linerColor);
  const features = POOL_FEATURES.filter((item) => config.features.includes(item.id));
  const equipment = EQUIPMENT.filter((item) => config.equipment.includes(item.id));
  const featureLabels = [
    ...features.map((item) => item.title),
    ...(config.poolAccess === "internalSteps"
      ? ["Internal Steps"]
      : config.poolAccess === "stainlessSteelLadder"
        ? ["Stainless Steel Ladder"]
        : []),
    ...equipment.map((item) => item.title),
  ];
  const rows = [
    ["Project", project],
    ["Pool Type", poolType],
    ["Structure", structure],
    ["Shape", getShapeDefinition(config.shape).title],
    [
      "Dimensions",
      `${formatNumber(config.dimensions.length, 2)} × ${formatNumber(config.dimensions.width, 2)} × ${formatNumber(config.dimensions.depth, 2)} m`,
    ],
    ["Surface", `${formatNumber(metrics.waterSurface)} m²`],
    ["System", config.system === "skimmer" ? "Skimmer Pool" : "Overflow Edge Pool"],
    ["Finish", finish],
    ["Color", color],
    ["Features / Accessories", featureLabels.length ? featureLabels.join(", ") : "None"],
  ] as const;

  return (
    <aside
      className="pointer-events-none absolute right-6 top-6 z-10 hidden w-60 rounded-[1.375rem] border border-hairline/70 bg-card/93 p-5 text-foreground shadow-[0_30px_70px_-44px_rgba(0,0,0,0.6)] xl:block"
      aria-label="Live configuration summary"
    >
      <p className="label-xs mb-4">Live specification</p>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label} className="border-b border-hairline/55 py-2.5 last:border-0 last:pb-0">
            <dt className="label-xs">{label}</dt>
            <dd className="mt-1 text-[11px] font-light leading-relaxed text-foreground/92">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
