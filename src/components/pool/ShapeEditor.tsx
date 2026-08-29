import { useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfigurator } from "@/lib/pool/context";

const SIZE = 320;
const PAD = 26;

/** Editable outline: drag the control points, the 3D basin follows live. */
export function ShapeEditor() {
  const { config, outline, setControlPoint, resetControlPoints } = useConfigurator();
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<number | null>(null);

  const editorHeight = SIZE * 0.62;
  const availableWidth = SIZE - PAD * 2;
  const availableHeight = editorHeight - PAD * 2;
  const metresToScreen = Math.min(
    availableWidth / config.dimensions.length,
    availableHeight / config.dimensions.width,
  );
  const centreX = SIZE / 2;
  const centreY = editorHeight / 2;
  const toScreen = ([x, z]: readonly [number, number]) => [
    centreX + x * metresToScreen,
    centreY + z * metresToScreen,
  ];
  const path =
    outline
      .map((point, index) => {
        const [x, y] = toScreen(point);
        return `${index === 0 ? "M" : "L"}${x},${y}`;
      })
      .join(" ") + " Z";

  const move = (event: React.PointerEvent) => {
    if (dragging === null || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * SIZE;
    const y = ((event.clientY - rect.top) / rect.height) * editorHeight;
    const nx = Math.max(
      -0.5,
      Math.min(0.5, (x - centreX) / metresToScreen / config.dimensions.length),
    );
    const ny = Math.max(
      -0.5,
      Math.min(0.5, (y - centreY) / metresToScreen / config.dimensions.width),
    );
    setControlPoint(dragging, [nx, ny]);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-hairline bg-card/40 p-2">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SIZE} ${editorHeight}`}
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
              cx={toScreen([x * config.dimensions.length, y * config.dimensions.width])[0]}
              cy={toScreen([x * config.dimensions.length, y * config.dimensions.width])[1]}
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
