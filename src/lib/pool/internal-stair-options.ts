import { configuredPoolLayout, configuredLayoutWithSkimmers } from '@/lib/pool/resolved-layout';
import { configuredOutline } from '@/lib/pool/configured-outline';
import { outlineBounds } from '@/lib/pool/geometry';
import type { InternalStairType, PoolConfig } from '@/lib/pool/types';

export function internalStairChoice(config: PoolConfig, type: InternalStairType) {
  const plan = configuredPoolLayout({ ...config, poolAccess: 'internalSteps', internalStairType: type, internalStairPosition: undefined });
  const integrated = plan.comfort.elements.find(element => !!element.steps?.length);
  const active = config.features.includes('sunShelf') ? 'sunShelf' : config.features.includes('hydromassage') ? 'hydromassage' : null;
  const comfortReason = active && !plan.comfort.availability[active].available ? plan.comfort.availability[active].reason : null;
  const available = plan.status !== 'UNAVAILABLE' && (!!plan.access.placement || !!integrated);
  return { available, steps: integrated?.steps?.length ?? plan.access.steps,
    reason: available ? '' : comfortReason || plan.access.reason || 'Non disponibile per questa configurazione.' };
}

/** Actual geometry decides which side is usable; no unconstrained mirror meshes. */
export function configuredInternalStairSides(config: PoolConfig) {
  config = { ...config, internalStairPosition: undefined };
  const outline = configuredOutline(config);
  const bounds = outlineBounds(outline);
  const cross = bounds.spanX >= bounds.spanZ ? 1 : 0;
  const centre = cross ? (bounds.minZ + bounds.maxZ) / 2 : (bounds.minX + bounds.maxX) / 2;
  const options = [false, true].map(mirrored => {
    const { layout: plan, skimmers } = configuredLayoutWithSkimmers({ ...config, internalStairMirrored: mirrored });
    const integrated = plan.comfort.elements.find(element => !!element.steps?.length);
    const footprint = plan.access.placement ? plan.access.footprint : integrated?.steps?.[0]?.footprint ?? [];
    const position = footprint.length ? footprint.reduce((sum, point) => sum + point[cross], 0) / footprint.length : null;
    const active = config.features.includes('sunShelf') ? 'sunShelf' : config.features.includes('hydromassage') ? 'hydromassage' : null;
    const reason = active && !plan.comfort.availability[active].available ? plan.comfort.availability[active].reason : plan.access.reason;
    return { mirrored, outline, layout: plan, skimmers, available: config.poolAccess === 'internalSteps' && plan.status !== 'UNAVAILABLE' && position !== null,
      position, footprint, reason: reason || 'Spazio insufficiente sul lato scelto.' };
  });
  const baseLeft = options[0]!.position === null || options[0]!.position! < centre;
  if (options[1]!.available && JSON.stringify(options[0]!.footprint) === JSON.stringify(options[1]!.footprint)) {
    options[1]!.available = false;
    options[1]!.reason = 'Le due posizioni coincidono in questa configurazione.';
  }
  return options.map(option => ({ ...option,
    side: (option.mirrored ? !baseLeft : baseLeft) ? 'left' as const : 'right' as const,
    reason: option.available ? '' : option.reason })).sort((a,b) => a.side === b.side ? 0 : a.side === 'left' ? -1 : 1);
}
