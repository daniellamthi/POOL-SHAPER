import { useEffect, useRef, type ReactNode } from "react";
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
  if (optional) {
    // Frozen choice system: an add-on is never a card. It is a full-width
    // row -- dashed while available, solid violet once added -- with an
    // explicit "+ Aggiungi" / "Aggiunto" command, so it can never be read as
    // a replacement for the cards above it.
    return (
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={cn(
          "col-span-full flex min-h-[64px] w-full items-center gap-3 rounded-[14px] border p-2 pr-2.5 text-left outline-none transition-[border-color,background-color] duration-200 ease-[cubic-bezier(0.2,0,0,1)] focus-visible:ring-2 focus-visible:ring-foreground/40",
          selected
            ? "border-solid border-brand bg-card"
            : "border-dashed border-foreground/25 bg-transparent hover:border-solid hover:border-foreground/40",
        )}
      >
        <span className="relative flex h-12 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-foreground/75">
          {typeof image === "string" ? (
            <img
              src={image}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : image ? (
            <span className="flex h-full w-full items-center justify-center p-1">{image}</span>
          ) : null}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-[13.5px] tracking-[-0.01em] text-foreground">{title}</span>
          {description ? (
            <span className="truncate text-[12px] font-light text-muted-foreground">
              {description}
            </span>
          ) : null}
          {footer ? (
            <span className="text-[11px] font-light text-muted-foreground">{footer}</span>
          ) : null}
        </span>
        {badge ? (
          <span className="hidden shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] tracking-wide text-muted-foreground sm:inline">
            {badge}
          </span>
        ) : null}
        <span
          aria-hidden
          className={cn(
            "flex h-[34px] shrink-0 items-center gap-1.5 rounded-[9px] border px-3 text-[12.5px] whitespace-nowrap",
            selected
              ? "border-brand/35 bg-brand-soft text-brand"
              : "border-foreground/20 bg-card text-foreground",
          )}
        >
          {selected ? (
            <Check className="size-3.5" strokeWidth={2} />
          ) : (
            <Plus className="size-3.5" strokeWidth={1.75} />
          )}
          {selected ? "Aggiunto" : "Aggiungi"}
        </span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "group relative flex min-w-0 flex-col overflow-hidden rounded-[18px] border bg-card text-left outline-none transition-[border-color,box-shadow,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:ring-2 focus-visible:ring-foreground/40 active:scale-[0.985]",
        selected
          ? "border-brand shadow-[0_0_0_1px_var(--brand)]"
          : "border-hairline hover:border-foreground/40",
      )}
    >
      <span
        className={cn(
          "relative block w-full overflow-hidden bg-muted",
          compact ? "aspect-[16/10] lg:aspect-[2/1]" : "aspect-[4/3] lg:aspect-[2/1]",
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
              ? "bg-brand text-white"
              : "border border-foreground/20 bg-background/90 text-transparent",
          )}
        >
          <Check className="size-3.5" strokeWidth={2} />
        </span>
      </span>
      <span className={cn("flex flex-1 flex-col gap-1", compact ? "p-3" : "p-4 lg:p-3.5")}>
        <span className="flex items-baseline justify-between gap-2">
          <span
            className={cn(
              "font-normal tracking-[-0.01em] text-foreground",
              compact ? "text-[13px]" : "text-[14.5px]",
            )}
          >
            {title}
          </span>
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

/**
 * Wraps options that appear as a consequence of a choice. When `reveal` is
 * set at mount (the user just made that choice) it glides into view inside
 * the tray and glows once in the brand violet, so follow-up options are
 * noticed instead of appearing silently below the fold.
 */
export function RevealSection({ reveal, children }: { reveal: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!reveal) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = window.setTimeout(
      () =>
        ref.current?.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" }),
      120,
    );
    return () => window.clearTimeout(id);
    // Runs once: the section is (re)mounted each time it appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div
      ref={ref}
      className={cn(
        "flex scroll-mb-14 flex-col gap-3 rounded-2xl",
        reveal &&
          "animate-[rise_0.45s_cubic-bezier(0.2,0,0,1)_both,reveal-glow_1.4s_ease-out_0.35s_1]",
      )}
    >
      {children}
    </div>
  );
}
