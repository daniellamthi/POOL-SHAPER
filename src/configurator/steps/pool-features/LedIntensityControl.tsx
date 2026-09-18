import { useId } from "react";
import { LED_OPTICS, normalisedLedIntensity } from "@/lib/pool/led-optics";

/** Quick settings, in the language of a lighting scene rather than of a number. */
const PRESETS = [
  { value: 0.25, label: "25%", hint: "Soffusa" },
  { value: 0.5, label: "50%", hint: "Serale" },
  { value: 0.75, label: "75%", hint: "Intensa" },
  { value: 1, label: "100%", hint: "Massima" },
] as const;

/**
 * The dimmer for the underwater LEDs.
 *
 * It sits directly under the colour wheel because colour and level are one
 * decision, not two, and it drives the real photometry -- lamp output, lens
 * emission, beam and the light landing in the water -- rather than a display
 * value. There is no new wizard step: the lighting choice stays on one screen.
 */
export function LedIntensityControl({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (value: number) => void;
}) {
  const helpId = useId();
  const level = normalisedLedIntensity(value);
  const percent = Math.round(level * 100);
  return (
    <section
      aria-label="Intensità luce LED"
      className="rounded-2xl border border-hairline px-5 py-5"
    >
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h4 className="label-xs">Intensità luce</h4>
        <output aria-live="off" className="font-mono text-sm tabular-nums text-muted-foreground">
          {percent}%
        </output>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={percent}
        aria-label="Intensità luce LED"
        aria-describedby={helpId}
        aria-valuetext={`${percent} per cento`}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
        className="h-11 w-full cursor-pointer appearance-none bg-transparent outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-hairline [&::-moz-range-thumb]:bg-card [&::-moz-range-thumb]:shadow [&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-hairline [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-hairline [&::-webkit-slider-thumb]:-mt-2 [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-hairline [&::-webkit-slider-thumb]:bg-card [&::-webkit-slider-thumb]:shadow"
      />
      <div className="mt-3 flex flex-wrap gap-2" aria-label="Livelli rapidi">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            title={preset.hint}
            aria-pressed={Math.abs(level - preset.value) < 0.005}
            onClick={() => onChange(preset.value)}
            className="min-h-11 rounded-full border border-hairline px-4 text-sm tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-ring aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background"
          >
            {preset.label}
          </button>
        ))}
      </div>
      <p id={helpId} className="mt-3 text-xs leading-relaxed text-muted-foreground">
        Regola la resa reale dei fari: lente, fascio e luce nell&apos;acqua. Predefinito{" "}
        {Math.round(LED_OPTICS.defaultIntensity * 100)}%, come una serata tipo.
      </p>
    </section>
  );
}
