import { useI18n } from "@/lib/i18n";
import { useEffect, useId, useRef, useState } from "react";
import { Slider } from "@/components/ui/slider";

interface Props {
  label: string;
  hint?: string | undefined;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  precision?: number;
  onChange: (value: number) => void;
}

export function DimensionControl({ label, hint, value, min, max, step, unit, precision, onChange }: Props) {
  const { t, number, locale } = useI18n();
  const id = useId();
  const decimals = precision ?? (step < 0.1 ? 2 : step < 1 ? 1 : 0);

  const [draft, setDraft] = useState<string | null>(null);
  const [adapted, setAdapted] = useState<number | null>(null);
  const cancelled = useRef(false);
  const frame = useRef<number | null>(null);
  const pending = useRef<number | null>(null);
  const latestValue = useRef(value);
  latestValue.current = value;
  const change = useRef(onChange);
  change.current = onChange;
  const flush = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    if (pending.current !== null) {
      const next = pending.current;
      pending.current = null;
      if (next !== latestValue.current) {
        latestValue.current = next;
        change.current(next);
      }
    }
  };
  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
  }, []);

  return (
    <div className="group flex flex-col gap-3.5 border-b border-hairline pb-6 last:border-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor={id} className="label-xs">
            {t(label)}
          </label>
          {hint ? (
            <span className="truncate text-[11px] font-light text-muted-foreground/70">{t(hint)}</span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-baseline gap-1.5">
          <input
            id={id}
            type="number"
            inputMode="decimal"
            lang={locale}
            value={draft ?? Number(value.toFixed(decimals))}
            min={min}
            max={max}
            step={step}
            aria-describedby={adapted !== null ? `${id}-adapted` : undefined}
            onFocus={() => { cancelled.current = false; setAdapted(null); }}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={(event) => {
              const next = Number.parseFloat(event.currentTarget.value);
              if (!cancelled.current && Number.isFinite(next)) {
                const clamped = Math.max(min, Math.min(max, next));
                setAdapted(clamped !== next ? clamped : null);
                if (clamped !== value) onChange(clamped);
              }
              cancelled.current = false;
              setDraft(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === "Escape") {
                event.preventDefault();
                cancelled.current = event.key === "Escape";
                event.currentTarget.blur();
              }
            }}
            className="numeric w-[5.5rem] border-0 bg-transparent p-0 text-right text-[22px] leading-none text-foreground outline-none [appearance:textfield] focus:text-foreground [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
          if (typeof next !== "number") return;
          setDraft(null);
          setAdapted(null);
          pending.current = next;
          if (frame.current === null) frame.current = requestAnimationFrame(flush);
        }}
        onValueCommit={([next]) => {
          if (typeof next === "number") pending.current = next;
          flush();
        }}
        aria-label={t(label)}
      />

      {adapted !== null ? <p id={`${id}-adapted`} role="status" className="text-xs leading-relaxed text-muted-foreground">
        {t("Misura adattata a {value} {unit}. Intervallo consentito: {min}–{max} {unit}.", {
          value: number(adapted), min: number(min), max: number(max), unit,
        })}
      </p> : null}

      <div className="flex justify-between text-[10px] font-light tracking-widest tabular-nums text-muted-foreground/50">
        <span>
          {number(min)} {unit}
        </span>
        <span>
          {number(max)} {unit}
        </span>
      </div>
    </div>
  );
}
