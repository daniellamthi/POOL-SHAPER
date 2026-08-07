import { useId } from "react";
import { Slider } from "@/components/ui/slider";

interface Props {
  label: string;
  hint?: string | undefined;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
}

export function DimensionControl({ label, hint, value, min, max, step, unit, onChange }: Props) {
  const id = useId();
  const decimals = step < 0.1 ? 2 : step < 1 ? 1 : 0;

  return (
    <div className="group flex flex-col gap-4 border-b border-hairline pb-6 last:border-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor={id} className="label-xs">
            {label}
          </label>
          {hint ? (
            <span className="truncate text-[11px] font-light text-muted-foreground/70">{hint}</span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-baseline gap-1.5">
          <input
            id={id}
            type="number"
            inputMode="decimal"
            value={Number(value.toFixed(decimals))}
            min={min}
            max={max}
            step={step}
            onChange={(event) => {
              const next = Number.parseFloat(event.target.value);
              if (Number.isFinite(next)) onChange(next);
            }}
            className="numeric w-[5.5rem] border-0 bg-transparent p-0 text-right text-[26px] leading-none text-foreground outline-none [appearance:textfield] focus:text-foreground [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <span className="text-[11px] font-light text-muted-foreground">{unit}</span>
        </div>
      </div>

      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([next]) => {
          if (typeof next === "number") onChange(next);
        }}
        aria-label={label}
      />

      <div className="flex justify-between text-[10px] font-light tracking-widest tabular-nums text-muted-foreground/50">
        <span>
          {min} {unit}
        </span>
        <span>
          {max} {unit}
        </span>
      </div>
    </div>
  );
}
