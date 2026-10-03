/** Presentation choices never change the pool or its compatibility rules. */
export type PavingId = "gres" | "wood" | "istria";
export type PremiumEnvironment = "outdoor-villa" | "indoor-wellness" | "panorama-infinity";
export const PAVING = [
  { id: "gres", label: "Gres porcellanato", module: [1.2, 0.6], color: "#c5bfb5", maps: "gres", note: "Effetto minerale · lastre 120 × 60 cm" },
  { id: "wood", label: "Legno decking", module: [2.4, 0.14], color: "#a88b6b", maps: "deck", note: "Doghe 240 × 14 cm" },
  { id: "istria", label: "Pietra d’Istria", module: [0.6, 0.4], color: "#dad8c9", maps: null, note: "Resa indicativa, non scansione certificata · 60 × 40 cm" },
] as const;
export const PREMIUM_ENVIRONMENTS = [
  { id: "outdoor-villa", label: "Outdoor Villa", description: "Architettura contemporanea intorno alla tua piscina." },
  { id: "indoor-wellness", label: "Indoor Wellness", description: "Vetrate, bosco e sauna: spazio dimensionato sulla vasca." },
  { id: "panorama-infinity", label: "Panorama Infinity", description: "Identità costiera Simons Town, senza modificare il sistema piscina." },
] as const;
export const pavingId = (value: unknown): PavingId => PAVING.some(p => p.id === value) ? value as PavingId : "gres";
export const premiumEnvironment = (value: unknown): PremiumEnvironment => PREMIUM_ENVIRONMENTS.some(p => p.id === value) ? value as PremiumEnvironment : "outdoor-villa";
