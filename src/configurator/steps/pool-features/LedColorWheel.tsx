import { useId, useRef, type PointerEvent } from "react";
import { hueToLedHex, ledHexToHue } from "@/lib/pool/led-optics";

const PRESETS = [
  { name: "Blue", hue: 225 }, { name: "Cyan", hue: 180 },
  { name: "Green", hue: 125 }, { name: "Red", hue: 0 }, { name: "Purple", hue: 280 },
] as const;

export function LedColorWheel({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const helpId = useId();
  const activePointer = useRef<number | null>(null);
  const hue = ledHexToHue(value);
  const white = value.toLowerCase() === "#ffffff";
  const selectPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    if (Math.hypot(x, y) < 12) return;
    onChange(hueToLedHex((Math.atan2(x, -y) * 180 / Math.PI + 360) % 360));
  };
  const release = (event: PointerEvent<HTMLDivElement>) => {
    if (activePointer.current !== event.pointerId) return;
    activePointer.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return (
    <section aria-label="LED color" className="rounded-2xl border border-hairline px-5 py-5">
      <h4 className="label-xs mb-4">LED color</h4>
      <div className="flex flex-wrap items-center gap-6">
        <div
          role="slider" tabIndex={0} aria-label="LED hue" aria-valuemin={0} aria-valuemax={359}
          aria-valuenow={Math.round(hue) % 360} aria-valuetext={white ? "Neutral white" : `${Math.round(hue)} degrees, ${value}`}
          aria-describedby={helpId}
          className="relative size-36 shrink-0 cursor-crosshair touch-none select-none rounded-full outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
          style={{ background: "conic-gradient(#ff0000,#ffff00,#00ff00,#00ffff,#0000ff,#ff00ff,#ff0000)" }}
          onPointerDown={event => {
            if (event.button !== 0 || activePointer.current !== null) return;
            activePointer.current = event.pointerId;
            event.currentTarget.focus();
            event.currentTarget.setPointerCapture(event.pointerId);
            selectPointer(event);
          }}
          onPointerMove={event => { if (activePointer.current === event.pointerId) selectPointer(event); }}
          onPointerUp={release} onPointerCancel={release} onLostPointerCapture={() => { activePointer.current = null; }}
          onKeyDown={event => {
            const step = event.shiftKey ? 10 : 1;
            const next = event.key === "Home" ? 0 : event.key === "End" ? 359
              : event.key === "ArrowRight" || event.key === "ArrowUp" ? hue + step
                : event.key === "ArrowLeft" || event.key === "ArrowDown" ? hue - step : null;
            if (next !== null) { event.preventDefault(); onChange(hueToLedHex(next)); }
          }}
        >
          <span className="pointer-events-none absolute inset-[18px] flex items-center justify-center rounded-full bg-card shadow-inner">
            <span className="size-12 rounded-full border border-hairline" style={{ backgroundColor: value }} />
          </span>
          {!white ? <span className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_#333]" style={{ left: `${50 + 43.75 * Math.sin(hue * Math.PI / 180)}%`, top: `${50 - 43.75 * Math.cos(hue * Math.PI / 180)}%`, backgroundColor: value }} /> : null}
        </div>
        <div className="flex min-w-24 flex-1 flex-col items-start gap-3">
          <button type="button" aria-pressed={white} onClick={() => onChange("#ffffff")} className="flex min-h-11 items-center gap-2 rounded-full border border-hairline px-4 text-sm focus-visible:outline-2 focus-visible:outline-ring">
            <span className="size-4 rounded-full border border-black/20 bg-white" />White
          </button>
          <output aria-label="Selected LED color" className="font-mono text-xs text-muted-foreground">{white ? "Neutral white" : value.toUpperCase()}</output>
          <p id={helpId} className="max-w-40 text-xs leading-relaxed text-muted-foreground">Drag to choose a hue. Arrow keys fine-tune.</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-1" aria-label="LED color presets">
        {PRESETS.map(preset => {
          const color = hueToLedHex(preset.hue);
          return <button key={preset.name} type="button" aria-label={`${preset.name} LED`} aria-pressed={value.toLowerCase() === color} title={preset.name} onClick={() => onChange(color)} className="flex size-11 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-ring">
            <span className="size-6 rounded-full border border-white/30 ring-offset-2 ring-offset-background" style={{ backgroundColor: color, outline: value.toLowerCase() === color ? "1px solid currentColor" : undefined, outlineOffset: 3 }} />
          </button>;
        })}
      </div>
    </section>
  );
}
