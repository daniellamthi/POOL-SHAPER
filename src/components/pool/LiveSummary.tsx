import {
  ACCESSORIES,
  FINISHES,
  LINER_COLORS,
  PROJECT_TYPES,
  getShapeDefinition,
} from "@/lib/pool/config";
import { useConfigurator } from "@/lib/pool/context";
import { formatNumber } from "@/lib/pool/format";

export function LiveSummary() {
  const { config, metrics } = useConfigurator();
  const project =
    PROJECT_TYPES.find((item) => item.id === config.projectType)?.title ?? "Not selected";
  const finish = FINISHES.find((item) => item.id === config.finish)?.title ?? config.finish;
  const color =
    LINER_COLORS.find((item) => item.id === config.linerColor)?.title ?? config.linerColor;
  const accessories = ACCESSORIES.filter((item) => config.accessories.includes(item.id));
  const rows = [
    ["Project", project],
    ["Shape", getShapeDefinition(config.shape).title],
    [
      "Dimensions",
      `${formatNumber(config.dimensions.length, 2)} × ${formatNumber(config.dimensions.width, 2)} × ${formatNumber(config.dimensions.depth, 2)} m`,
    ],
    ["Surface", `${formatNumber(metrics.waterSurface)} m²`],
    ["System", config.system === "skimmer" ? "Skimmer Pool" : "Overflow Edge Pool"],
    ["Finish", finish],
    ["Color", color],
    ["Accessories", accessories.length ? accessories.map((item) => item.title).join(", ") : "None"],
  ] as const;

  return (
    <aside
      className="pointer-events-none absolute right-6 top-6 z-10 hidden w-64 rounded-2xl border border-white/10 bg-black/45 p-5 text-white shadow-2xl backdrop-blur-xl xl:block"
      aria-label="Live configuration summary"
    >
      <p className="mb-4 text-[9px] uppercase tracking-[0.24em] text-white/55">
        Live specification
      </p>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label} className="border-b border-white/10 py-2.5 last:border-0 last:pb-0">
            <dt className="text-[9px] uppercase tracking-[0.16em] text-white/45">{label}</dt>
            <dd className="mt-1 text-[11px] font-light leading-relaxed text-white/90">{value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
