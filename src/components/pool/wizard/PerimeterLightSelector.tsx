import { Check } from "lucide-react";
import { useI18n, formatNumber } from "@/lib/i18n";
import type { PerimeterLightingPlan } from "@/lib/pool/perimeter-lighting";
import { cn } from "@/lib/utils";

export function PerimeterLightSelector({
  plan,
  onChange,
}: {
  plan: PerimeterLightingPlan;
  onChange: (sides: ReadonlyArray<number>) => void;
}) {
  const { t, locale } = useI18n();
  const selected = plan.selected.map((side) => side.id);
  const points = plan.sides.flatMap((side) => side.points);
  const minX = Math.min(...points.map((p) => p[0])),
    maxX = Math.max(...points.map((p) => p[0]));
  const minZ = Math.min(...points.map((p) => p[2])),
    maxZ = Math.max(...points.map((p) => p[2]));
  const scale = 140 / Math.max(maxX - minX, maxZ - minZ, 1);
  const project = (point: readonly [number, number, number]) =>
    `${80 + (point[0] - (minX + maxX) / 2) * scale},${80 + (point[2] - (minZ + maxZ) / 2) * scale}`;
  const toggle = (id: number) =>
    onChange(
      selected.includes(id)
        ? selected.filter((side) => side !== id)
        : [...selected, id].sort((a, b) => a - b),
    );
  return (
    <fieldset
      className="mt-5 grid gap-3 rounded-xl border border-hairline p-4"
      data-wizard-guidance-ignore
    >
      <legend className="px-2 text-sm">{t("Lati illuminati")}</legend>
      <svg
        viewBox="0 0 160 160"
        role="img"
        aria-label={t("Pianta LED perimetrali")}
        className="mx-auto w-40"
      >
        {plan.sides.map((side) => (
          <polyline
            key={side.id}
            points={side.points.map(project).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={selected.includes(side.id) ? 4 : 1.5}
            className={selected.includes(side.id) ? "text-brand" : "text-muted-foreground/40"}
          />
        ))}
        {plan.sides.map((side) => {
          const first = side.points[0],
            last = side.points[side.points.length - 1];
          if (!first || !last) return null;
          const [x, z] = project([
            (first[0] + last[0]) / 2,
            first[1],
            (first[2] + last[2]) / 2,
          ]).split(",");
          return (
            <text
              key={side.id}
              x={x}
              y={z}
              dy="-5"
              textAnchor="middle"
              fontSize="10"
              fill="currentColor"
            >
              {side.id + 1}
            </text>
          );
        })}
      </svg>
      <div className="flex flex-wrap justify-center gap-2">
        {plan.sides.map((side) => (
          <button
            key={side.id}
            type="button"
            disabled={!side.available}
            aria-pressed={selected.includes(side.id)}
            onClick={() => toggle(side.id)}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-xs disabled:cursor-not-allowed disabled:opacity-40",
              selected.includes(side.id)
                ? "border-brand bg-brand/10 text-brand"
                : "border-hairline",
            )}
          >
            {selected.includes(side.id) ? <Check className="size-3" aria-hidden /> : null}
            {t("Lato {side}", { side: side.id + 1 })}
          </button>
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        {selected.length
          ? t("Lunghezza LED selezionata: {length} m", {
              length: formatNumber(plan.length, locale, { maximumFractionDigits: 1 }),
            })
          : t("Seleziona almeno un lato.")}
      </p>
      {plan.sides.some((side) => !side.available) ? (
        <p className="text-xs text-muted-foreground">
          {t("Il lato Infinity resta libero: la fascia segue soltanto i bordi con contenimento.")}
        </p>
      ) : null}
    </fieldset>
  );
}
