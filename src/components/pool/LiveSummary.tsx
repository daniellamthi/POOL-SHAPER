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
import { normalizeComfortFeatures } from "@/lib/pool/comfort-selection";
import { useConfigurator } from "@/lib/pool/context";
import { formatNumber } from "@/lib/pool/format";
import { getMosaicFinish } from "@/configurator/materials/interior-textures";
import { isSlopedFloorDisplay } from "@/lib/pool/floor-profile";
import { finishDescription } from "@/lib/pool/structure-finish";

export function LiveSummary() {
  const { config, metrics } = useConfigurator();
  const project =
    PROJECT_TYPES.find((item) => item.id === config.projectType)?.title ?? "Non selezionato";
  const finish = config.finish === "none"
    ? finishDescription(config.structure, config.finish)
    : FINISHES.find((item) => item.id === config.finish)?.title ?? config.finish;
  const poolType =
    POOL_TYPES.find((item) => item.id === config.poolType)?.title ?? "Non selezionato";
  const structure =
    POOL_STRUCTURES.find((item) => item.id === config.structure)?.title ?? "Non selezionata";
  const color = config.finish === "none"
    ? "Acciaio inox satinato"
    : config.finish === "mosaic"
      ? getMosaicFinish(config.mosaicFinish).name
      : (LINER_COLORS.find((item) => item.id === config.linerColor)?.title ?? config.linerColor);
  const features = POOL_FEATURES.filter((item) =>
    normalizeComfortFeatures(config.features).includes(item.id),
  );
  const equipment = EQUIPMENT.filter((item) => config.equipment.includes(item.id));
  const isSlopedFloor = isSlopedFloorDisplay(config.shape, config.poolType, config.dimensions);
  const depthLabel = isSlopedFloor
    ? `${formatNumber(config.dimensions.shallowDepth!, 2)} → ${formatNumber(config.dimensions.depth, 2)} m`
    : `${formatNumber(config.dimensions.depth, 2)} m`;
  const featureLabels = [
    ...features.map((item) =>
      item.id === "hydromassage"
        ? `${item.title} ${config.hydromassageVariant === "open" ? "B" : "A"}`
        : item.title,
    ),
    ...(config.poolAccess === "internalSteps"
      ? ["Scala interna"]
      : config.poolAccess === "stainlessSteelLadder"
        ? ["Scaletta esterna in acciaio inox"]
        : []),
    ...(config.poolAccess === "internalSteps" && config.features.includes("inoxLadder")
      ? ["Scaletta inox opzionale"]
      : []),
    ...equipment.map((item) => item.title),
  ];
  const rows = [
    ["Progetto", project],
    ["Tipo piscina", poolType],
    ["Struttura", structure],
    ["Forma", getShapeDefinition(config.shape).title],
    [
      "Dimensioni",
      `${formatNumber(config.dimensions.length, 2)} × ${formatNumber(config.dimensions.width, 2)} m · h ${depthLabel}`,
    ],
    ["Superficie", `${formatNumber(metrics.waterSurface)} m²`],
    [
      "Sistema",
      config.system === "skimmer"
        ? "Piscina a skimmer"
        : config.system === "infinity"
          ? "Piscina Infinity"
          : "Piscina a sfioro",
    ],
    ["Rivestimento", finish],
    ["Colore", color],
    ["Comfort / Accessori", featureLabels.length ? featureLabels.join(", ") : "Nessuno"],
  ] as const;

  return (
    <details
      className="absolute right-6 top-6 z-10 hidden w-56 border border-hairline/80 bg-card/92 px-4 py-2.5 text-foreground shadow-sm backdrop-blur-sm xl:block"
      aria-label="Riepilogo configurazione"
    >
      <summary className="label-xs cursor-pointer select-none">Specifica live</summary>
      <dl>
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2 border-b border-hairline/45 py-1.5 last:border-0 last:pb-0"
          >
            <dt className="text-[8px] font-medium uppercase leading-4 tracking-[0.12em] text-muted-foreground">
              {label}
            </dt>
            <dd className="text-[10px] font-normal leading-4 text-foreground/88">{value}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
