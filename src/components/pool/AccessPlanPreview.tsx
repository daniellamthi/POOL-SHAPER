import type { SVGProps } from 'react';
import { useI18n } from '@/lib/i18n';
import { outlineBounds } from '@/lib/pool/geometry';
import type { configuredInternalStairSides } from '@/lib/pool/internal-stair-options';

type Option = ReturnType<typeof configuredInternalStairSides>[number];

/** The same solved geometry as the scene, in a fixed top projection. */
export function AccessPlanPreview({ option, interaction }: { option: Option; interaction?: SVGProps<SVGGElement> | undefined }) {
  const { t, number } = useI18n();
  const { outline, layout, skimmers } = option;
  if (outline.length < 3) return null;
  const bounds = outlineBounds(outline);
  const scale = Math.min(208 / Math.max(bounds.spanX, .1), 112 / Math.max(bounds.spanZ, .1));
  const project = ([x, z]: readonly [number, number]) => [
    120 + (x - (bounds.minX + bounds.maxX) / 2) * scale,
    72 + (z - (bounds.minZ + bounds.maxZ) / 2) * scale,
  ];
  const points = (footprint: typeof outline) => footprint.map(point => project(point).join(',')).join(' ');
  const integrated = layout.comfort.elements.find(element => element.steps?.length);
  const flight = layout.access.placement ? layout.access.footprint : integrated?.steps?.[0]?.footprint ?? [];
  const shelf = layout.comfort.elements.find(element => element.kind === 'sunShelf');
  const width = layout.access.placement ? layout.access.width : flight.length ? (bounds.spanX >= bounds.spanZ ? outlineBounds(flight).spanZ : outlineBounds(flight).spanX) : 0;
  const side = t(option.side === 'left' ? 'SX' : 'DX');
  return <figure className="m-0 grid gap-2" data-access-plan>
    <figcaption className="text-xs text-muted-foreground">{t('Vista dall’alto · orientamento fisso')}</figcaption>
    <svg viewBox="0 0 240 144" role={interaction ? "group" : "img"} style={interaction ? {touchAction:"none"} : undefined} aria-label={t('Pianta di scala, zona comfort e skimmer')} className={interaction ? "mx-auto h-52 w-full max-w-md" : "mx-auto h-36 w-full max-w-xs"}>
      <polygon points={points(outline)} fill="currentColor" fillOpacity=".035" stroke="currentColor" strokeWidth="1" className="text-foreground" />
      {layout.comfort.elements.map(element => <g key={element.kind}>
        <polygon points={points(element.footprint)} fill="currentColor" fillOpacity=".15" stroke="currentColor" strokeWidth="1" className="text-muted-foreground" />
        {element.steps?.map((step, index) => <polygon key={index} points={points(step.footprint)} fill="currentColor" fillOpacity=".12" stroke="currentColor" strokeWidth=".7" className="text-brand" />)}
      </g>)}
      <g {...interaction} tabIndex={undefined} role={undefined} aria-label={undefined}>
      {flight.length ? <polygon points={points(flight)} fill="currentColor" fillOpacity=".3" stroke="currentColor" strokeWidth="1.5" className="text-brand" /> : null}
      </g>
      {skimmers.positions.map((point, index) => {
        const [cx, cy] = project([point.x, point.z]);
        return <circle key={index} cx={cx} cy={cy} r="2.5" fill="currentColor" className="text-foreground" />;
      })}
      {flight.length ? (() => {
        const centre = flight.reduce((sum, point) => [sum[0]! + point[0] / flight.length, sum[1]! + point[1] / flight.length], [0, 0]);
        const [x, y] = project([centre[0]!, centre[1]!]);
        return <g {...interaction} data-stair-drag-handle>
          {interaction ? <><circle cx={x} cy={y} r="20" fill="transparent" /><circle cx={x} cy={y} r="8" fill="var(--background)" stroke="currentColor" className="text-brand" /></> : null}
          <text pointerEvents="none" x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="9" fontWeight="600" fill="currentColor" className="text-foreground">{interaction ? "↔" : side}</text></g>;
      })() : null}
    </svg>
    <p className="text-[11px] leading-relaxed text-muted-foreground">{t('Scala evidenziata · zona comfort in grigio · skimmer a punti')}</p>
    {option.available ? <dl className="flex flex-wrap gap-x-5 gap-y-2 text-xs tabular-nums">
      {width > 0 ? <div><dt className="text-muted-foreground">{t(layout.access.corner ? 'Ingombro scala' : 'Larghezza scala')}</dt><dd className="mt-1 font-medium">{number(width, { maximumFractionDigits: 2 })} m</dd></div> : null}
      {shelf ? <>
        <div><dt className="text-muted-foreground">{t(shelf.steps?.length ? 'Lunghezza spiaggetta e gradini' : 'Lunghezza spiaggetta')}</dt><dd className="mt-1 font-medium">{number(shelf.run, { maximumFractionDigits: 2 })} m</dd></div>
        <div><dt className="text-muted-foreground">{t('Nuoto residuo')}</dt><dd className="mt-1 font-medium">{number(Math.max(0, Math.max(bounds.spanX, bounds.spanZ) - shelf.run), { maximumFractionDigits: 2 })} m</dd></div>
      </> : null}
    </dl> : null}
  </figure>;
}
