import { useState } from "react";
import { ImageOff } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { productPhotographs } from "@/lib/pool/product-photography";
import { Illustration } from "./illustrations";

/** Retired configurator captures must not reappear when a photograph is absent. */
const retiredPreviews = new Set([
  "skimmer-slim",
  "skimmer-high",
  "overflow-visible",
  "overflow-hidden",
  "access-ladder",
  "access-external",
  "comfort-sunShelf",
  "equipment-pellicano",
  "equipment-loungers",
  "equipment-sunShelfLoungers",
]);
const lineIllustrations = new Set([
  "overflow-visible",
  "overflow-hidden",
  "access-external",
  "comfort-sunShelf",
  "equipment-pellicano",
]);

export function hasProductMedia(name: string): boolean {
  return Object.hasOwn(productPhotographs, name) || retiredPreviews.has(name);
}

/** Media only: dimensions, selection icons and card actions are unchanged. */
export function ProductMedia({ name }: { name: string }) {
  const { locale } = useI18n();
  const [failed, setFailed] = useState<string | null>(null);
  const media = Object.hasOwn(productPhotographs, name) ? productPhotographs[name] : undefined;
  const available = media && failed !== media.src;
  const label = available
    ? media.match === "exact-sample"
      ? locale === "en"
        ? "Photo sample"
        : "Campione fotografico"
      : locale === "en"
        ? "Reference photo"
        : "Foto indicativa"
    : locale === "en"
      ? "Photo unavailable"
      : "Foto non disponibile";
  const note = available
    ? media.note[locale]
    : locale === "en"
      ? "A photograph of the correct product with verified reuse permission is not available. Any line illustration is schematic, not a photograph."
      : "Manca una fotografia del prodotto corretto con diritti d’uso verificati. L’eventuale disegno è schematico, non una fotografia.";
  return (
    <span
      className="absolute inset-0 block h-full w-full overflow-hidden"
      style={{ containerType: "inline-size" }}
      data-product-media={name}
      data-media-kind={available ? media.match : "missing-photo"}
      title={`${label}. ${note}`}
    >
      {available ? (
        <img
          src={media.src}
          srcSet={media.variants.map((variant) => `${variant.src} ${variant.width}w`).join(", ")}
          sizes={
            name === "equipment-loungers"
              ? "56px"
              : "(min-width: 1440px) 420px, (min-width: 1024px) 32vw, (min-width: 640px) 45vw, 90vw"
          }
          alt={`${label}: ${media.alt[locale]}`}
          width={media.variants.at(-1)!.width}
          height={media.variants.at(-1)!.height}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
          style={{ objectPosition: `${media.focalPoint[0] * 100}% ${media.focalPoint[1] * 100}%` }}
          onError={() => setFailed(media.src)}
        />
      ) : (
        <span
          className="absolute inset-0 flex items-center justify-center p-[10%] text-foreground/60"
          role="img"
          aria-label={`${label}. ${note}`}
        >
          {lineIllustrations.has(name) ? (
            <Illustration name={name} />
          ) : (
            <ImageOff className="h-1/3 w-1/3" strokeWidth={1} aria-hidden="true" />
          )}
        </span>
      )}
      <span
        aria-hidden="true"
        className="absolute bottom-1 left-1 max-w-[calc(100%-0.5rem)] rounded-sm bg-background/90 px-1 py-0.5 leading-none text-foreground"
        style={{ fontSize: "clamp(6px, 2.5cqw, 10px)" }}
      >
        {label}
      </span>
    </span>
  );
}
