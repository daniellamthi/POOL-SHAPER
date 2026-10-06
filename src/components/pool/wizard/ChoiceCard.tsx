import type { ReactNode } from "react";
import { Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The one option card of the configurator: an image area that explains the
 * choice visually, the option name, one short line, and an unmistakable
 * selected state. Every customer decision in the wizard uses it.
 *
 * `image` is either a URL (texture / photograph) or a ReactNode (the line
 * illustrations in `illustrations.tsx`). When final photography is supplied
 * later it drops into the same slot without touching any step.
 */
export function ChoiceCard({
  title,
  description,
  image,
  imageFit = "cover",
  selected,
  onSelect,
  optional = false,
  badge,
  footer,
  compact = false,
}: {
  title: string;
  description?: string;
  image?: string | ReactNode;
  imageFit?: "cover" | "contain";
  selected: boolean;
  onSelect: () => void;
  /** Add-on semantics: "+" while off, "Aggiunto" while on. */
  optional?: boolean;
  /** Small note in the image corner (e.g. "Consigliato", "Automatico"). */
  badge?: string | undefined;
  /** Extra line under the description (dimensions, availability). */
  footer?: ReactNode;
  /** Smaller card for secondary choices (finishes, variants). */
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "group relative flex min-w-0 flex-col overflow-hidden rounded-[18px] border bg-card text-left outline-none transition-[border-color,box-shadow,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:ring-2 focus-visible:ring-foreground/40 active:scale-[0.985]",
        selected
          ? "border-foreground shadow-[0_0_0_1px_var(--foreground)]"
          : "border-hairline hover:border-foreground/40",
      )}
    >
      <span
        className={cn(
          "relative block w-full overflow-hidden bg-muted",
          compact ? "aspect-[16/10] lg:aspect-[2/1]" : "aspect-[4/3] lg:aspect-[16/9]",
        )}
      >
        {typeof image === "string" ? (
          <img
            src={image}
            alt=""
            loading="lazy"
            className={cn(
              "absolute inset-0 h-full w-full transition-transform duration-500 group-hover:scale-[1.03]",
              imageFit === "cover" ? "object-cover" : "object-contain p-4",
            )}
          />
        ) : image ? (
          <span className="absolute inset-0 flex items-center justify-center p-[10%] text-foreground/75">
            {image}
          </span>
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
            Immagine
          </span>
        )}
        {badge ? (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-background/90 px-2.5 py-1 text-[10px] tracking-wide text-foreground">
            {badge}
          </span>
        ) : null}
        <span
          aria-hidden
          className={cn(
            "absolute right-2.5 top-2.5 flex size-6 items-center justify-center rounded-full transition-all duration-300",
            selected
              ? "bg-foreground text-background"
              : optional
                ? "bg-background/90 text-foreground"
                : "bg-background/70 text-transparent",
          )}
        >
          {optional && !selected ? (
            <Plus className="size-3.5" strokeWidth={1.75} />
          ) : (
            <Check className="size-3.5" strokeWidth={2} />
          )}
        </span>
      </span>
      <span className={cn("flex flex-1 flex-col gap-1", compact ? "p-3" : "p-4")}>
        <span className="flex items-baseline justify-between gap-2">
          <span
            className={cn(
              "font-normal tracking-[-0.01em] text-foreground",
              compact ? "text-[13px]" : "text-[14.5px]",
            )}
          >
            {title}
          </span>
          {optional && selected ? (
            <span className="shrink-0 text-[10.5px] tracking-wide text-brand">Aggiunto</span>
          ) : null}
        </span>
        {description ? (
          <span className="line-clamp-2 text-[12px] leading-[1.5] font-light text-muted-foreground">
            {description}
          </span>
        ) : null}
        {footer ? (
          <span className="mt-1 text-[11px] font-light text-muted-foreground">{footer}</span>
        ) : null}
      </span>
    </button>
  );
}

/** Responsive grid every card group sits in: 2 columns on phones, 3-5 on
 * desktop, never a single tall column. */
export function ChoiceGrid({
  label,
  children,
  dense = false,
}: {
  label: string;
  children: ReactNode;
  dense?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "grid gap-3",
        dense
          ? "grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]"
          : "grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(190px,1fr))] xl:grid-cols-[repeat(auto-fill,minmax(210px,1fr))]",
      )}
    >
      {children}
    </div>
  );
}

/** Segmented sub-navigation inside one step. Only one group is visible at a
 * time, so a step never turns back into a long stack of sections. */
export function StepTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: ReadonlyArray<{ id: T; label: string; hint?: string }>;
  value: T;
  onChange: (id: T) => void;
  label: string;
}) {
  if (tabs.length < 2) return null;
  return (
    <div
      role="tablist"
      aria-label={label}
      className="inline-flex w-fit max-w-full self-start gap-1 overflow-x-auto rounded-full border border-hairline bg-background p-1"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          type="button"
          aria-selected={value === tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "min-h-9 shrink-0 rounded-full px-4 text-[12.5px] tracking-tight transition-colors duration-200",
            value === tab.id
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
          {tab.hint ? <span className="ml-1.5 opacity-60">{tab.hint}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** Small heading for a secondary choice row inside a tab. */
export function GroupLabel({ children }: { children: ReactNode }) {
  return <p className="label-xs">{children}</p>;
}
