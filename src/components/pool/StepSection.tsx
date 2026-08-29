import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function StepSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section key={title} className="animate-rise flex flex-col gap-14">
      <header className="flex flex-col gap-5">
        <span aria-hidden className="h-px w-8 bg-foreground/35" />
        <h2 className="text-[38px] leading-[1.02] font-extralight tracking-[-0.045em] text-foreground sm:text-[42px]">
          {title}
        </h2>
        <p className="max-w-[40ch] text-[13px] leading-[1.8] font-light text-muted-foreground">
          {subtitle}
        </p>
      </header>
      {children}
    </section>
  );
}

export function OptionCard({
  title,
  description,
  selected,
  onSelect,
  meta,
}: {
  title: string;
  description?: string;
  selected: boolean;
  onSelect: () => void;
  meta?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "group relative flex w-full flex-col gap-3.5 overflow-hidden rounded-[1.125rem] border p-7 text-left outline-none transition-[border-color,background-color,box-shadow,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:ring-1 focus-visible:ring-foreground/40 focus-visible:ring-offset-4 focus-visible:ring-offset-background active:scale-[0.992]",
        selected
          ? "border-foreground/28 bg-card lift"
          : "border-hairline bg-card/35 hover:-translate-y-0.5 hover:border-foreground/16 hover:bg-card/75 hover:shadow-[0_22px_54px_-38px_rgba(0,0,0,0.75)]",
      )}
    >
      <span className="flex items-start justify-between gap-4">
        <span className="text-[15px] font-light tracking-[-0.012em] text-foreground">{title}</span>
        <span
          className={cn(
            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
            selected
              ? "scale-100 border-brand bg-brand text-background shadow-[0_0_0_4px_var(--brand-soft)]"
              : "scale-90 border-border bg-transparent text-transparent group-hover:scale-100 group-hover:border-foreground/30",
          )}
        >
          <Check
            className={cn(
              "size-3 transition-all duration-300",
              selected ? "scale-100 opacity-100" : "scale-50 opacity-0",
            )}
            strokeWidth={1.75}
          />
        </span>
      </span>
      {description ? (
        <span className="max-w-[38ch] text-[12.5px] leading-[1.65] font-light text-muted-foreground">
          {description}
        </span>
      ) : null}
      {meta}
      <span
        className={cn(
          "absolute inset-x-7 bottom-0 h-px origin-center bg-brand transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]",
          selected ? "scale-x-100" : "scale-x-0",
        )}
      />
    </button>
  );
}

/** Compact colour / material swatch selector. */
export function SwatchOption({
  title,
  hex,
  texture,
  selected,
  onSelect,
}: {
  title: string;
  hex: string;
  texture?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "group flex flex-col items-start gap-3 rounded-2xl border p-3 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:ring-1 focus-visible:ring-foreground/35",
        selected ? "border-foreground/30 bg-card lift" : "border-hairline hover:border-border",
      )}
    >
      <span
        className="relative block h-12 w-full rounded-lg border border-hairline bg-cover bg-center"
        style={{ backgroundColor: hex, backgroundImage: texture ? `url(${texture})` : undefined }}
      >
        {selected ? (
          <Check
            className="absolute right-1.5 bottom-1.5 size-3.5 text-foreground/80 mix-blend-difference"
            strokeWidth={1.25}
          />
        ) : null}
      </span>
      <span className="text-[11px] font-light tracking-tight text-muted-foreground group-hover:text-foreground">
        {title}
      </span>
    </button>
  );
}

/** Multi-select chip used for accessories. */
export function ToggleChip({
  title,
  description,
  selected,
  onToggle,
  icon,
}: {
  title: string;
  description: string;
  selected: boolean;
  onToggle: () => void;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={cn(
        "flex items-start gap-3.5 rounded-2xl border p-5 text-left transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:ring-1 focus-visible:ring-foreground/35",
        selected
          ? "border-foreground/25 bg-card lift"
          : "border-hairline bg-card/30 hover:border-border",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors duration-300",
          selected ? "border-brand bg-brand/15" : "border-border",
        )}
      >
        {selected ? <Check className="size-3 text-brand" strokeWidth={1.75} /> : null}
      </span>
      {icon ? (
        <span className="mt-0.5 text-muted-foreground [&_svg]:size-4 [&_svg]:stroke-[1.25]">
          {icon}
        </span>
      ) : null}
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-[13px] font-normal tracking-tight text-foreground">{title}</span>
        <span className="text-[11.5px] leading-relaxed font-light text-muted-foreground">
          {description}
        </span>
      </span>
    </button>
  );
}

/** Small labelled technical readout used across engineering panels. */
export function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-hairline pb-2.5 last:border-0 last:pb-0">
      <span className="label-xs">{label}</span>
      <span className="numeric text-[13px] text-foreground">{value}</span>
    </div>
  );
}
