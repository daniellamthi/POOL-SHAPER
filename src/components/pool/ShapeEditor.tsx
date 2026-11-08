import { useI18n } from "@/lib/i18n";
import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfigurator } from "@/lib/pool/context";
import { DIMENSION_LIMITS } from "@/lib/pool/config";
import { buildOutline, POOL_SHAPE_GUARDRAILS, validatePoolShape } from "@/lib/pool/geometry";
import type { ControlPoint } from "@/lib/pool/types";

const SIZE = 320;
const PAD = 26;

/** Editable outline: drag the control points, the 3D basin follows live. */
export function ShapeEditor() {
  const { t } = useI18n();
  const { config, outline, setControlPoint, resetControlPoints, setDimension } = useConfigurator();
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ index: number; pointerId: number; offset: ControlPoint } | null>(null);
  const pendingRef = useRef<{ index: number; point: ControlPoint } | null>(null);
  const frameRef = useRef<number | null>(null);
  const updateRef = useRef(setControlPoint);
  updateRef.current = setControlPoint;
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

  const shapeStatus = useMemo(() => {
    const validation = validatePoolShape(
      buildOutline("custom", config.dimensions, config.controlPoints),
      config.controlPoints,
    );
    if (validation.valid) return { valid: true, suggested: null };
    // A uniformly larger version preserves the chosen silhouette. Offer it
    // only when the same production guardrails validate the rounded dimensions.
    const scale = Math.max(
      POOL_SHAPE_GUARDRAILS.minimumHardRadius / validation.minimumRadius,
      POOL_SHAPE_GUARDRAILS.minimumNeckWidth / validation.minimumNeckWidth,
    );
    const length = Math.ceil(config.dimensions.length * scale * 10) / 10;
    const width = Math.ceil(config.dimensions.width * scale * 10) / 10;
    const dimensions = { ...config.dimensions, length, width };
    const suggested = Number.isFinite(scale) && scale > 1 &&
      length <= DIMENSION_LIMITS.length.max && width <= DIMENSION_LIMITS.width.max &&
      validatePoolShape(buildOutline("custom", dimensions, config.controlPoints), config.controlPoints).valid
      ? { length, width }
      : null;
    return { valid: false, suggested };
  }, [config.dimensions, config.controlPoints]);

  const pointFromEvent = (event: React.PointerEvent): ControlPoint | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const x = ((event.clientX - rect.left) / rect.width) * SIZE;
    const y = ((event.clientY - rect.top) / rect.height) * editorHeight;
    return [
      (x - centreX) / metresToScreen / config.dimensions.length,
      (y - centreY) / metresToScreen / config.dimensions.width,
    ];
  };

  const flush = () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending) updateRef.current(pending.index, pending.point);
  };

  const move = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const point = pointFromEvent(event);
    if (!point) return;
    pendingRef.current = {
      index: drag.index,
      point: [
        Math.max(-0.5, Math.min(0.5, point[0] + drag.offset[0])),
        Math.max(-0.5, Math.min(0.5, point[1] + drag.offset[1])),
      ],
    };
    // Pointer devices can emit more often than the screen refreshes. Keep
    // the newest position and rebuild the basin at most once per frame.
    if (frameRef.current === null) frameRef.current = requestAnimationFrame(flush);
  };

  const finish = (event: React.PointerEvent, includePosition: boolean) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (includePosition) move(event);
    flush();
    dragRef.current = null;
    setDragging(null);
    if (svgRef.current?.hasPointerCapture(event.pointerId)) {
      svgRef.current.releasePointerCapture(event.pointerId);
    }
  };

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    pendingRef.current = null;
    dragRef.current = null;
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-hairline bg-card/40 p-2">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SIZE} ${editorHeight}`}
          className="w-full touch-none select-none"
          onPointerMove={move}
          onPointerUp={(event) => finish(event, true)}
          onPointerCancel={(event) => finish(event, false)}
          onLostPointerCapture={(event) => finish(event, false)}
        >
          <path
            d={path}
            fill="var(--brand)"
            fillOpacity={0.1}
            stroke="var(--brand)"
            strokeWidth={1.2}
          />
          {config.controlPoints.map(([x, y], index) => (
            <g key={index}>
              <circle
                cx={toScreen([x * config.dimensions.length, y * config.dimensions.width])[0]}
                cy={toScreen([x * config.dimensions.length, y * config.dimensions.width])[1]}
                r={16}
                className={shapeStatus.valid ? "cursor-grab" : "cursor-not-allowed"}
                fill="transparent"
                onPointerDown={(event) => {
                  if (!shapeStatus.valid || dragRef.current || event.button !== 0) return;
                  const point = pointFromEvent(event);
                  if (!point || !svgRef.current) return;
                  event.preventDefault();
                  dragRef.current = { index, pointerId: event.pointerId, offset: [x - point[0], y - point[1]] };
                  svgRef.current.setPointerCapture(event.pointerId);
                  setDragging(index);
                }}
              />
              <circle
                cx={toScreen([x * config.dimensions.length, y * config.dimensions.width])[0]}
                cy={toScreen([x * config.dimensions.length, y * config.dimensions.width])[1]}
                r={dragging === index ? 7 : 5}
                pointerEvents="none"
                fill="var(--background)"
                stroke="var(--foreground)"
                strokeWidth={1}
              />
            </g>
          ))}
        </svg>
      </div>
      {!shapeStatus.valid ? (
        <div className="flex flex-col items-start gap-2 text-[11.5px] text-muted-foreground" role="status">
          <p>{t("Questa sagoma è troppo stretta o curva per le dimensioni scelte. Aumenta le dimensioni per modificarla in sicurezza.")}</p>
          {shapeStatus.suggested ? (
            <Button type="button" variant="outline" size="sm" onClick={() => {
              setDimension("length", shapeStatus.suggested!.length);
              setDimension("width", shapeStatus.suggested!.width);
            }}>
              {t("Adatta dimensioni")} · {shapeStatus.suggested.length} × {shapeStatus.suggested.width} m
            </Button>
          ) : null}
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-4">
        <p className="text-[11.5px] font-light text-muted-foreground">
          {t("Drag the control points to shape the basin.")} </p>
        <Button type="button" variant="ghost" size="sm" onClick={() => {
          if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
          frameRef.current = null;
          pendingRef.current = null;
          dragRef.current = null;
          setDragging(null);
          resetControlPoints();
        }}>
          <RotateCcw />
          {t("Reset outline")} </Button>
      </div>
    </div>
  );
}
