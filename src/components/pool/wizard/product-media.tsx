import { useI18n } from "@/lib/i18n";

type Caption = { it: string; en: string };
type ProductMediaEntry = {
  src: string;
  kind: "3d-preview";
  alt: Caption;
};

/** Explicit product mapping: a shelf, an immersed chaise and dry furniture
 * must never share an image. Captures come from the actual configurator. */
export const productMedia: Record<string, ProductMediaEntry> = {
  "skimmer-slim": {
    src: "/product-previews/skimmer-slim.jpg",
    kind: "3d-preview",
    alt: { it: "Skimmer Slim con cornice sottile e apertura ampia, montato nella parete della vasca.", en: "Slim skimmer with a thin frame and wide opening, fitted in the pool wall." },
  },
  "skimmer-high": {
    src: "/product-previews/skimmer-high.jpg",
    kind: "3d-preview",
    alt: { it: "Skimmer a livello acqua alto, con apertura bassa vicino al bordo.", en: "High waterline skimmer with a shallow opening close to the coping." },
  },
  "overflow-visible": {
    src: "/product-previews/overflow-visible.jpg",
    kind: "3d-preview",
    alt: { it: "Griglia bianca a vista sopra il canale di sfioro perimetrale.", en: "Visible white grille over the perimeter overflow channel." },
  },
  "overflow-hidden": {
    src: "/product-previews/overflow-hidden.jpg",
    kind: "3d-preview",
    alt: { it: "Sfioro nascosto con canale celato sotto il bordo in pietra.", en: "Hidden overflow channel concealed beneath the stone coping." },
  },
  "access-ladder": {
    src: "/product-previews/access-ladder.jpg",
    kind: "3d-preview",
    alt: { it: "Scaletta inox tubolare con corrimano curvi e pedate immerse nella vasca.", en: "Tubular stainless steel ladder with curved handrails and submerged treads." },
  },
  "access-external": {
    src: "/product-previews/access-external.jpg",
    kind: "3d-preview",
    alt: { it: "Scala esterna integrata alla piscina fuori terra, chiusa da pannelli e protetta da parapetto inox.", en: "External staircase integrated with the above ground pool, enclosed by panels with a stainless steel guardrail." },
  },
  "comfort-sunShelf": {
    src: "/product-previews/comfort-sunShelf.jpg",
    kind: "3d-preview",
    alt: { it: "Spiaggetta sommersa in muratura, collegata alla vasca da gradini.", en: "Built in shallow sun shelf connected to the pool by submerged steps." },
  },
  "equipment-pellicano": {
    src: "/product-previews/equipment-pellicano.jpg",
    kind: "3d-preview",
    alt: { it: "Pellicano: lama curva inox sul bordo con cascata d’acqua nella piscina.", en: "Pellicano: curved stainless steel blade on the coping with a waterfall into the pool." },
  },
  "equipment-loungers": {
    src: "/product-previews/equipment-loungers.jpg",
    kind: "3d-preview",
    alt: { it: "Chaise longue esterne su telaio, posate sulla pavimentazione asciutta intorno alla piscina.", en: "Outdoor frame loungers standing on the dry paving around the pool." },
  },
  "equipment-sunShelfLoungers": {
    src: "/product-previews/equipment-sunShelfLoungers.jpg",
    kind: "3d-preview",
    alt: { it: "Lettini sagomati immersi nell’acqua bassa della spiaggetta.", en: "Sculpted in water loungers standing in the shallow water of the sun shelf." },
  },
};

export function hasProductMedia(name: string): boolean {
  return Object.hasOwn(productMedia, name);
}

/** Media only: the enclosing ChoiceCard retains its action and selection UI. */
export function ProductMedia({ name }: { name: string }) {
  const { locale } = useI18n();
  const media = hasProductMedia(name) ? productMedia[name] : undefined;
  if (!media) return null;
  const label = locale === "en" ? "3D preview" : "Anteprima 3D";
  const note = locale === "en"
    ? "Illustrative 3D model. The finish shown is an example; the selected configuration determines the materials."
    : "Modello 3D indicativo. La finitura mostrata è un esempio; i materiali dipendono dalla configurazione scelta.";
  return (
    <span
      className="absolute inset-0 block h-full w-full overflow-hidden"
      style={{ containerType: "inline-size" }}
      data-product-media={name}
      data-media-kind={media.kind}
      title={`${label}. ${note}`}
    >
      <img
        src={media.src}
        alt={`${label}: ${media.alt[locale]}`}
        width={900}
        height={500}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
      />
      <span
        aria-hidden="true"
        className="absolute bottom-1 left-1 whitespace-nowrap rounded-sm bg-background/90 px-1 py-0.5 leading-none text-foreground"
        style={{ fontSize: "clamp(6px, 2.5cqw, 10px)" }}
      >
        {label}
      </span>
    </span>
  );
}
