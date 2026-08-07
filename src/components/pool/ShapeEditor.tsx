import { useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { unitFromControlPoints } from "@/lib/pool/geometry";
import { useConfigurator } from "@/lib/pool/context";

const SIZE = 320;
const PAD = 26;

const toScreen = (v: number, span: number) => PAD + (v + 0.5) * span;

/** Editable outline: drag the control points, the 3D basin follows live. */
export function ShapeEditor() {
  const { config, setControlPoint, resetControlPoints } = useConfigurator();
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<number | null>(null);

  const spanX = SIZE - PAD * 2;
  const spanY = SIZE * 0.62 - PAD * 2;
  const curve = unitFromControlPoints(config.controlPoints);
  const path =
    curve
      .map(
        ([x, y], index) => `${index === 0 ? "M" : "L"}${toScreen(x, spanX)},${toScreen(y, spanY)}`,
      )
      .join(" ") + " Z";

  const move = (event: React.PointerEvent) => {
    if (dragging === null || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * SIZE;
    const y = ((event.clientY - rect.top) / rect.height) * SIZE * 0.62;
    const nx = Math.max(-0.5, Math.min(0.5, (x - PAD) / spanX - 0.5));
    const ny = Math.max(-0.5, Math.min(0.5, (y - PAD) / spanY - 0.5));
    setControlPoint(dragging, [nx, ny]);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-hairline bg-card/40 p-2">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SIZE} ${SIZE * 0.62}`}
          className="w-full touch-none select-none"
          onPointerMove={move}
          onPointerUp={() => setDragging(null)}
          onPointerLeave={() => setDragging(null)}
        >
          <path
            d={path}
            fill="var(--brand)"
            fillOpacity={0.1}
            stroke="var(--brand)"
            strokeWidth={1.2}
          />
          {config.controlPoints.map(([x, y], index) => (
            <circle
              key={index}
              cx={toScreen(x, spanX)}
              cy={toScreen(y, spanY)}
              r={dragging === index ? 7 : 5}
              className="cursor-grab"
              fill="var(--background)"
              stroke="var(--foreground)"
              strokeWidth={1}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                setDragging(index);
              }}
            />
          ))}
        </svg>
      </div>
      <div className="flex items-center justify-between gap-4">
        <p className="text-[11.5px] font-light text-muted-foreground">
          Drag the control points to shape the basin.
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={resetControlPoints}>
          <RotateCcw />
          Reset outline
        </Button>
      </div>
    </div>
  );
}
