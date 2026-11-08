import { useId, useMemo } from 'react';
import { AccessPlanPreview } from './AccessPlanPreview';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { configuredInternalStairSides } from '@/lib/pool/internal-stair-options';
import type { PoolConfig } from '@/lib/pool/types';

export function InternalStairSideControl({ config, onChange }: {
  config: PoolConfig;
  onChange: (mirrored: boolean) => void;
}) {
  const { t } = useI18n();
  const options = useMemo(() => configuredInternalStairSides(config), [config]);
  const reasonId = useId();
  const selected = options.find(option => option.mirrored === !!config.internalStairMirrored)!;
  return <fieldset className="flex flex-col gap-3" data-internal-stair-side>
    <legend className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">{t('Posizione della scala')}</legend>
    <AccessPlanPreview option={selected} />
    <div className="grid grid-cols-2 gap-3">
      {options.map(option => {
        const left = option.side === 'left';
        const Arrow = left ? ArrowLeft : ArrowRight;
        const selected = option.mirrored === !!config.internalStairMirrored;
        return <button key={option.side} type="button"
          aria-label={t(left ? 'Scala a sinistra (SX)' : 'Scala a destra (DX)')}
          aria-pressed={selected} aria-describedby={!option.available ? `${reasonId}-${option.side}` : undefined} disabled={!option.available} onClick={() => onChange(option.mirrored)}
          className={`flex min-h-12 items-center justify-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 ${selected ? 'border-brand bg-brand-soft text-brand' : 'border-border bg-background hover:border-brand/50'}`}>
          <Arrow className="size-4 shrink-0" aria-hidden="true" />
          <span className="font-semibold">{t(left ? 'SX' : 'DX')}</span>
          <span>{t(left ? 'Sinistra' : 'Destra')}</span>
        </button>;
      })}
    </div>
    {options.filter(option => !option.available).map(option => <p key={option.side} id={`${reasonId}-${option.side}`} className="text-xs leading-relaxed text-muted-foreground">
      <span className="font-medium">{t(option.side === 'left' ? 'SX' : 'DX')}: </span>{t(option.reason)}
    </p>)}
    <p className="text-xs leading-relaxed text-muted-foreground">{t('SX e DX indicano i due lati della stessa testata. Le posizioni senza spazio sono disabilitate.')}</p>
  </fieldset>;
}
