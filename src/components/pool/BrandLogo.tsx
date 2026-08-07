import { PRODUCT_BRAND } from "@/configurator/config/product";
import { cn } from "@/lib/utils";

/**
 * Piscine Wellness brand mark. Aspect ratio is preserved by fixing the height
 * and letting the width follow; inverted in dark mode so the mark stays legible.
 */
export function BrandLogo({ className }: { className?: string }) {
  if (!PRODUCT_BRAND.logoUrl) {
    return (
      <span
        aria-label={PRODUCT_BRAND.logoAlt}
        className={cn(
          "whitespace-nowrap text-[10px] font-medium tracking-[0.18em] text-foreground uppercase",
          className,
        )}
      >
        PW
      </span>
    );
  }

  return (
    <img
      src={PRODUCT_BRAND.logoUrl}
      alt={PRODUCT_BRAND.logoAlt}
      className={cn("h-7 w-auto object-contain dark:invert", className)}
      loading="eager"
      decoding="async"
    />
  );
}
